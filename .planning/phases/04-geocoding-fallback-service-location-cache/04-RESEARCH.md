# Phase 4: Geocoding Fallback Service & Rate-Limited Location Cache - Research

**Analysis Date:** 2026-09-11
**Status:** Completed

<summary>
Investigated external geocoding providers (Google Maps Geocoding API vs. OpenStreetMap Nominatim), rate-limiting queue implementations in Node.js, and Prisma schema definitions for persistent coordinate caching with unique term deduplication.
</summary>

<provider_comparison>
## Provider Comparison

| Provider | Authentication | Rate Limit Policy | Cost | User-Agent Requirement |
|----------|---------------|-------------------|------|------------------------|
| **Google Geocoding** | API Key (`key=...`) | 50 QPS default (paid billing account) | $5.00 / 1000 requests | Optional |
| **OSM Nominatim** | None required | Strictly 1 request / second maximum | Free | **Mandatory** (`User-Agent` identifying application) |

### Dual Implementation Strategy
Support Google when `GOOGLE_GEOCODING_API_KEY` is present. When absent, default to Nominatim with a dedicated rate-limiter enforcing `minDelayMs = 1000` to respect open-source terms of service.
</provider_comparison>

<cache_architecture>
## Cache Architecture Pattern

### PostgreSQL Model:
```prisma
model LocationCache {
  id            Int      @id @default(autoincrement())
  searchTerm    String   @unique
  canonicalName String
  district      String   @default("")
  state         String   @default("")
  latitude      Float
  longitude     Float
  source        String   @default("geocoder")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([searchTerm])
  @@index([state])
}
```

### Rate Limiter Pattern (Serial Task Queue):
```typescript
class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastRunTime = 0;
  private minIntervalMs: number;

  constructor(minIntervalMs = 1000) {
    this.minIntervalMs = minIntervalMs;
  }

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const elapsed = now - this.lastRunTime;
          if (elapsed < this.minIntervalMs) {
            await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
          }
          this.lastRunTime = Date.now();
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) await task();
    }
    this.processing = false;
  }
}
```
</cache_architecture>
