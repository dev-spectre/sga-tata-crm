import 'dotenv/config';
import dns from 'dns';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Force IPv4-first DNS resolution in Node.js to prevent DNS hangs / EAI_AGAIN errors with Supabase pooler
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

export type ExtendedPrismaClient = PrismaClient & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  consultant: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  branch: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  locationCache: any;
};

const PRIMARY_POOL_MAX = 15;
const PRIMARY_CONNECTION_TIMEOUT_MS = 20000;
const SECONDARY_POOL_MAX = 5;
const SECONDARY_WRITE_TIMEOUT_MS = 4000;
const SECONDARY_CREATE_MANY_CHUNK_SIZE = 500;

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
  pool: Pool | undefined;
  secondaryPrisma: PrismaClient | undefined;
  secondaryPool: Pool | undefined;
};

interface ClientOptions {
  maxPool: number;
  connectionTimeoutMillis: number;
  queryTimeoutMillis?: number;
  poolCacheKey?: 'pool' | 'secondaryPool';
}

/**
 * Checks whether double-write migration mode is enabled via env config.
 */
export function isDoubleWriteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.DOUBLE_WRITE ?? '').trim().toLowerCase();
  const newDbUrl = (env.NEW_DB_URL ?? '').trim();
  const primaryDbUrl = (env.DATABASE_URL ?? '').trim();

  return (
    flag === 'true' &&
    newDbUrl.length > 0 &&
    /^postgres(ql)?:\/\//i.test(newDbUrl) &&
    newDbUrl !== primaryDbUrl
  );
}

/**
 * Creates a PrismaClient configured for Neon, Supabase pooler, or standard Postgres.
 */
export function createBasePrismaClient(url: string | undefined, options: ClientOptions): PrismaClient {
  if (!url || !url.trim()) {
    // If no URL is set (e.g. static analysis or CI), initialize with dummy connection
    const pool = new Pool({ connectionString: 'postgresql://localhost:5432/postgres' });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  let normalizedUrl = url.trim();

  if (normalizedUrl.includes('neon.tech')) {
    const adapter = new PrismaNeon({ connectionString: normalizedUrl });
    return new PrismaClient({ adapter });
  }

  // If using Supabase pooler with session port 5432, switch to transaction pooler port 6543
  // to avoid (EMAXCONNSESSION) max 15 clients limit and connection timeouts under load
  if (normalizedUrl.includes('pooler.supabase.com') && normalizedUrl.includes(':5432/')) {
    normalizedUrl = normalizedUrl.replace(':5432/', ':6543/');
  }

  const cachedPool = options.poolCacheKey ? globalForPrisma[options.poolCacheKey] : undefined;
  const pool =
    cachedPool ??
    new Pool({
      connectionString: normalizedUrl,
      ssl:
        normalizedUrl.includes('localhost') || normalizedUrl.includes('127.0.0.1')
          ? false
          : { rejectUnauthorized: false },
      max: options.maxPool,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: options.connectionTimeoutMillis,
      ...(options.queryTimeoutMillis ? { query_timeout: options.queryTimeoutMillis } : {}),
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

  if (!cachedPool) {
    pool.on('error', (err) => {
      console.warn('PG pool background client warning:', err?.message || err);
    });
    if (process.env.NODE_ENV !== 'production' && options.poolCacheKey) {
      globalForPrisma[options.poolCacheKey] = pool;
    }
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  // Attach no-op catch so a late rejection after timeout never triggers UnhandledPromiseRejection
  promise.catch(() => {});

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function logSecondaryWriteFailure(target: string, err: unknown): void {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorCode = (err as { code?: string } | null)?.code;
  console.error(
    `[DOUBLE_WRITE_ERROR] ${target} failed on secondary DB${errorCode ? ` (code: ${errorCode})` : ''}: ${errorMessage}`
  );
}

function toModelDelegateKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function stripIdField<T>(record: T): T {
  if (record && typeof record === 'object' && 'id' in record) {
    const { id: _omit, ...rest } = record as Record<string, unknown>;
    return rest as T;
  }
  return record;
}

/**
 * Wraps a primary PrismaClient so every write succeeds on primary first and is then
 * replicated to secondary with explicit IDs and a 4000ms timeout. Secondary failures
 * are logged for Vercel logs and ignored.
 */
export function createDoubleWriteClient(
  primaryClient: PrismaClient,
  secondaryClient: PrismaClient,
  timeoutMs: number = SECONDARY_WRITE_TIMEOUT_MS
): ExtendedPrismaClient {
  const primaryDelegates = primaryClient as unknown as Record<string, any>;
  const secondaryDelegates = secondaryClient as unknown as Record<string, any>;

  const extended = primaryClient.$extends({
    name: 'doubleWriteMigration',
    query: {
      async $executeRaw({ args, query }) {
        const result = await query(args);
        try {
          await withTimeout(
            secondaryClient.$executeRaw(args as Parameters<PrismaClient['$executeRaw']>[0]),
            timeoutMs,
            'Secondary $executeRaw'
          );
        } catch (err) {
          logSecondaryWriteFailure('$executeRaw', err);
        }
        return result;
      },
      async $executeRawUnsafe({ args, query }) {
        const result = await query(args);
        try {
          const [sql, ...values] = args as [string, ...unknown[]];
          await withTimeout(
            secondaryClient.$executeRawUnsafe(sql, ...values),
            timeoutMs,
            'Secondary $executeRawUnsafe'
          );
        } catch (err) {
          logSecondaryWriteFailure('$executeRawUnsafe', err);
        }
        return result;
      },
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !WRITE_OPERATIONS.has(operation)) {
            return query(args);
          }

          const modelKey = toModelDelegateKey(model);
          const secondaryDelegate = secondaryDelegates[modelKey];
          const typedArgs = (args ?? {}) as Record<string, any>;

          if (operation === 'createMany') {
            const rawRows = typedArgs.data;
            const rows = Array.isArray(rawRows) ? rawRows : rawRows ? [rawRows] : [];
            if (rows.length === 0) {
              return { count: 0 };
            }

            // Use createManyAndReturn on primary so we capture exact auto-generated IDs
            const insertedRows: Record<string, unknown>[] = await primaryDelegates[
              modelKey
            ].createManyAndReturn({
              data: typedArgs.data,
              ...(typedArgs.skipDuplicates !== undefined
                ? { skipDuplicates: typedArgs.skipDuplicates }
                : {}),
            });

            if (insertedRows.length > 0 && secondaryDelegate) {
              try {
                for (let i = 0; i < insertedRows.length; i += SECONDARY_CREATE_MANY_CHUNK_SIZE) {
                  const chunk = insertedRows.slice(i, i + SECONDARY_CREATE_MANY_CHUNK_SIZE);
                  await withTimeout(
                    secondaryDelegate.createMany({
                      data: chunk,
                      skipDuplicates: true,
                    }),
                    timeoutMs,
                    `Secondary ${model}.createMany`
                  );
                }
              } catch (err) {
                logSecondaryWriteFailure(`${model}.createMany`, err);
              }
            }

            return { count: insertedRows.length };
          }

          if (operation === 'createManyAndReturn') {
            const hasSelect = Boolean(typedArgs.select && typeof typedArgs.select === 'object');
            const selectHadId = hasSelect && Boolean(typedArgs.select.id);
            const primaryArgs =
              hasSelect && !selectHadId
                ? { ...typedArgs, select: { ...typedArgs.select, id: true } }
                : typedArgs;

            const primaryRows = (await query(primaryArgs)) as Record<string, unknown>[];

            if (Array.isArray(primaryRows) && primaryRows.length > 0 && secondaryDelegate) {
              try {
                const rawRows = Array.isArray(typedArgs.data)
                  ? typedArgs.data
                  : typedArgs.data
                  ? [typedArgs.data]
                  : [];
                const secondaryRows =
                  !hasSelect
                    ? primaryRows
                    : rawRows.length === primaryRows.length
                    ? rawRows.map((row: Record<string, unknown>, idx: number) => ({
                        ...row,
                        ...(primaryRows[idx]?.id !== undefined && row.id === undefined
                          ? { id: primaryRows[idx].id }
                          : {}),
                      }))
                    : primaryRows;

                for (let i = 0; i < secondaryRows.length; i += SECONDARY_CREATE_MANY_CHUNK_SIZE) {
                  const chunk = secondaryRows.slice(i, i + SECONDARY_CREATE_MANY_CHUNK_SIZE);
                  await withTimeout(
                    secondaryDelegate.createMany({
                      data: chunk,
                      skipDuplicates: true,
                    }),
                    timeoutMs,
                    `Secondary ${model}.createManyAndReturn`
                  );
                }
              } catch (err) {
                logSecondaryWriteFailure(`${model}.createManyAndReturn`, err);
              }
            }

            if (hasSelect && !selectHadId && Array.isArray(primaryRows)) {
              return primaryRows.map(stripIdField);
            }
            return primaryRows;
          }

          if (operation === 'create') {
            const hasSelect = Boolean(typedArgs.select && typeof typedArgs.select === 'object');
            const selectHadId = hasSelect && Boolean(typedArgs.select.id);
            const primaryArgs =
              hasSelect && !selectHadId
                ? { ...typedArgs, select: { ...typedArgs.select, id: true } }
                : typedArgs;

            const primaryResult = await query(primaryArgs);

            if (secondaryDelegate) {
              try {
                const createdId =
                  primaryResult && typeof primaryResult === 'object'
                    ? (primaryResult as Record<string, unknown>).id
                    : undefined;
                const secondaryData =
                  createdId !== undefined && typedArgs.data?.id === undefined
                    ? { ...(typedArgs.data ?? {}), id: createdId }
                    : typedArgs.data;

                await withTimeout(
                  secondaryDelegate.create({
                    data: secondaryData,
                  }),
                  timeoutMs,
                  `Secondary ${model}.create`
                );
              } catch (err) {
                logSecondaryWriteFailure(`${model}.create`, err);
              }
            }

            if (hasSelect && !selectHadId) {
              return stripIdField(primaryResult);
            }
            return primaryResult;
          }

          if (operation === 'upsert') {
            const hasSelect = Boolean(typedArgs.select && typeof typedArgs.select === 'object');
            const selectHadId = hasSelect && Boolean(typedArgs.select.id);
            const primaryArgs =
              hasSelect && !selectHadId
                ? { ...typedArgs, select: { ...typedArgs.select, id: true } }
                : typedArgs;

            const primaryResult = await query(primaryArgs);

            if (secondaryDelegate) {
              try {
                const resultId =
                  primaryResult && typeof primaryResult === 'object'
                    ? (primaryResult as Record<string, unknown>).id
                    : undefined;
                const secondaryCreate =
                  resultId !== undefined &&
                  typedArgs.create &&
                  typedArgs.create.id === undefined
                    ? { ...typedArgs.create, id: resultId }
                    : typedArgs.create;

                await withTimeout(
                  secondaryDelegate.upsert({
                    where: typedArgs.where,
                    update: typedArgs.update,
                    create: secondaryCreate,
                  }),
                  timeoutMs,
                  `Secondary ${model}.upsert`
                );
              } catch (err) {
                logSecondaryWriteFailure(`${model}.upsert`, err);
              }
            }

            if (hasSelect && !selectHadId) {
              return stripIdField(primaryResult);
            }
            return primaryResult;
          }

          // update, updateMany, updateManyAndReturn, delete, deleteMany
          const primaryResult = await query(args);

          if (secondaryDelegate) {
            try {
              const { select: _select, include: _include, ...secondaryArgs } = typedArgs;
              await withTimeout(
                secondaryDelegate[operation](secondaryArgs),
                timeoutMs,
                `Secondary ${model}.${operation}`
              );
            } catch (err) {
              logSecondaryWriteFailure(`${model}.${operation}`, err);
            }
          }

          return primaryResult;
        },
      },
    },
  });

  return extended as unknown as ExtendedPrismaClient;
}

function createPrismaClient(): ExtendedPrismaClient {
  const primaryClient = createBasePrismaClient(process.env.DATABASE_URL, {
    maxPool: PRIMARY_POOL_MAX,
    connectionTimeoutMillis: PRIMARY_CONNECTION_TIMEOUT_MS,
    poolCacheKey: 'pool',
  });

  if (!isDoubleWriteEnabled(process.env)) {
    return primaryClient as ExtendedPrismaClient;
  }

  const secondaryClient =
    globalForPrisma.secondaryPrisma ??
    createBasePrismaClient(process.env.NEW_DB_URL, {
      maxPool: SECONDARY_POOL_MAX,
      connectionTimeoutMillis: SECONDARY_WRITE_TIMEOUT_MS,
      queryTimeoutMillis: SECONDARY_WRITE_TIMEOUT_MS,
      poolCacheKey: 'secondaryPool',
    });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.secondaryPrisma = secondaryClient;
  }

  return createDoubleWriteClient(primaryClient, secondaryClient, SECONDARY_WRITE_TIMEOUT_MS);
}

export const prisma: ExtendedPrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

