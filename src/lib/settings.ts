import { prisma } from '@/lib/prisma';
import type { Settings } from '@prisma/client';

interface CachedSettingsEntry {
  data: Settings | null;
  timestamp: number;
}

let cachedSettings: CachedSettingsEntry | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Returns cached settings from memory if valid, otherwise queries DB and caches result.
 * Eliminates tens of thousands of duplicate SELECT * FROM Settings queries.
 */
export async function getCachedSettings(): Promise<Settings | null> {
  const now = Date.now();
  if (cachedSettings && (now - cachedSettings.timestamp < CACHE_TTL_MS)) {
    return cachedSettings.data;
  }

  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    cachedSettings = {
      data: settings,
      timestamp: now,
    };
    return settings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    // If DB fails but we have slightly older cache, fallback to it
    if (cachedSettings) return cachedSettings.data;
    return null;
  }
}

/**
 * Invalidates the cached settings in memory.
 * Call this immediately whenever settings are updated in the database.
 */
export function invalidateSettingsCache(): void {
  cachedSettings = null;
}

/**
 * Updates the in-memory cache directly with new settings.
 */
export function setCachedSettings(settings: Settings | null): void {
  cachedSettings = {
    data: settings,
    timestamp: Date.now(),
  };
}
