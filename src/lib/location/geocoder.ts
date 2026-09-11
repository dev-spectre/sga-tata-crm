import { prisma } from '../prisma';
import { resolveLocation } from './matcher';
import { normalizeKey } from './tn-locations';

export interface TieredLocationResult {
  matched: boolean;
  query: string;
  canonicalName: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  pincode?: string;
  source: 'dictionary' | 'cache' | 'google' | 'nominatim' | 'none';
  confidence: number;
  isTamilNadu: boolean;
}

export interface GeocoderOptions {
  skipCache?: boolean;
  skipExternal?: boolean;
  googleApiKey?: string;
}

/**
 * Serial Rate Limiter Queue
 * Enforces a guaranteed minimum delay between consecutive network calls
 * to respect OSM Nominatim rate limits (max 1 req/sec) and throttle Google API calls.
 */
export class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private lastCallTimestamp = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs = 1000) {
    this.minIntervalMs = minIntervalMs;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const timeSinceLast = now - this.lastCallTimestamp;
          if (timeSinceLast < this.minIntervalMs) {
            const waitTime = this.minIntervalMs - timeSinceLast;
            await new Promise((r) => setTimeout(r, waitTime));
          }
          this.lastCallTimestamp = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }

    this.isProcessing = false;
  }
}

// Global rate limiter singleton (1000ms delay between external geocoder requests)
export const globalRateLimiter = new RateLimiter(1000);

interface ExternalGeocodeResponse {
  canonicalName: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  source: 'google' | 'nominatim';
}

/**
 * Queries OpenStreetMap Nominatim with strict application User-Agent.
 */
export async function queryNominatim(query: string): Promise<ExternalGeocodeResponse | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&addressdetails=1&countrycodes=in&limit=1`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SGA-Tata-CRM/1.0 (dealership-lead-routing)',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim error: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const first = data[0];
  const address = first.address || {};
  const state = address.state || address.region || '';
  const district = address.state_district || address.county || address.city || '';
  const canonicalName =
    address.city || address.town || address.village || address.suburb || first.name || query;

  return {
    canonicalName,
    district,
    state,
    latitude: parseFloat(first.lat),
    longitude: parseFloat(first.lon),
    source: 'nominatim',
  };
}

/**
 * Queries Google Maps Geocoding API if key is available.
 */
export async function queryGoogleGeocode(
  query: string,
  apiKey: string
): Promise<ExternalGeocodeResponse | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    query
  )}&region=in&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google geocode error: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
    return null;
  }

  const first = data.results[0];
  const loc = first.geometry?.location;
  if (!loc) return null;

  let state = '';
  let district = '';
  let canonicalName = '';

  for (const comp of first.address_components || []) {
    const types: string[] = comp.types || [];
    if (types.includes('administrative_area_level_1')) {
      state = comp.long_name;
    } else if (types.includes('administrative_area_level_2') || types.includes('administrative_area_level_3')) {
      district = comp.long_name;
    } else if (types.includes('locality') || types.includes('postal_town')) {
      canonicalName = comp.long_name;
    }
  }

  return {
    canonicalName: canonicalName || first.formatted_address || query,
    district,
    state,
    latitude: loc.lat,
    longitude: loc.lng,
    source: 'google',
  };
}

/**
 * Helper to test if a state name belongs to Tamil Nadu or adjacent Puducherry
 */
export function isTamilNaduState(stateName: string): boolean {
  if (!stateName) return false;
  const s = stateName.toLowerCase();
  return (
    s.includes('tamil nadu') ||
    s.includes('tamilnadu') ||
    s.includes('puducherry') ||
    s.includes('pondicherry')
  );
}

/**
 * Tiered Location Resolution Pipeline:
 * 1. Local Tamil Nadu Dictionary & Fuzzy Matcher (Phase 3) (< 0.1ms)
 * 2. PostgreSQL LocationCache Table lookup (< 5ms)
 * 3. Rate-limited External Geocoding API (Google / Nominatim) + immediate DB persistence
 */
export async function resolveLocationTiered(
  rawQuery: string,
  options?: GeocoderOptions
): Promise<TieredLocationResult> {
  if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
    return {
      matched: false,
      query: rawQuery || '',
      canonicalName: '',
      district: '',
      state: '',
      latitude: 0,
      longitude: 0,
      source: 'none',
      confidence: 0,
      isTamilNadu: false,
    };
  }

  const query = rawQuery.trim();
  const searchKey = normalizeKey(query);

  // ----------------------------------------------------
  // Tier 1: Local Tamil Nadu Dictionary & Fuzzy Matcher
  // ----------------------------------------------------
  const dictResult = resolveLocation(query);
  if (dictResult.matched) {
    return {
      matched: true,
      query,
      canonicalName: dictResult.canonicalName,
      district: dictResult.district,
      state: 'Tamil Nadu',
      latitude: dictResult.latitude,
      longitude: dictResult.longitude,
      pincode: dictResult.pincode,
      source: 'dictionary',
      confidence: dictResult.confidence,
      isTamilNadu: true,
    };
  }

  // ----------------------------------------------------
  // Tier 2: PostgreSQL LocationCache Lookup
  // ----------------------------------------------------
  if (!options?.skipCache && searchKey) {
    try {
      const cached = await prisma.locationCache.findUnique({
        where: { searchTerm: searchKey },
      });

      if (cached) {
        const isTN = isTamilNaduState(cached.state);
        return {
          matched: true,
          query,
          canonicalName: cached.canonicalName,
          district: cached.district,
          state: cached.state,
          latitude: cached.latitude,
          longitude: cached.longitude,
          source: 'cache',
          confidence: 0.95,
          isTamilNadu: isTN,
        };
      }
    } catch (err) {
      console.warn('LocationCache lookup warning:', err);
    }
  }

  // If external network lookup skipped, exit early
  if (options?.skipExternal) {
    return {
      matched: false,
      query,
      canonicalName: '',
      district: '',
      state: '',
      latitude: 0,
      longitude: 0,
      source: 'none',
      confidence: 0,
      isTamilNadu: false,
    };
  }

  // ----------------------------------------------------
  // Tier 3: Rate-Limited External Geocoding + DB Persistence
  // ----------------------------------------------------
  const googleApiKey = options?.googleApiKey || process.env.GOOGLE_GEOCODING_API_KEY;

  try {
    const geoResponse = await globalRateLimiter.enqueue(async () => {
      if (googleApiKey) {
        return queryGoogleGeocode(query, googleApiKey);
      }
      return queryNominatim(query);
    });

    if (geoResponse) {
      const isTN = isTamilNaduState(geoResponse.state);

      // Persist into LocationCache asynchronously to prevent repeat queries
      if (searchKey) {
        try {
          await prisma.locationCache.upsert({
            where: { searchTerm: searchKey },
            update: {
              canonicalName: geoResponse.canonicalName,
              district: geoResponse.district,
              state: geoResponse.state,
              latitude: geoResponse.latitude,
              longitude: geoResponse.longitude,
              source: geoResponse.source,
            },
            create: {
              searchTerm: searchKey,
              canonicalName: geoResponse.canonicalName,
              district: geoResponse.district,
              state: geoResponse.state,
              latitude: geoResponse.latitude,
              longitude: geoResponse.longitude,
              source: geoResponse.source,
            },
          });
        } catch (cacheErr) {
          console.warn('LocationCache upsert warning:', cacheErr);
        }
      }

      return {
        matched: true,
        query,
        canonicalName: geoResponse.canonicalName,
        district: geoResponse.district,
        state: geoResponse.state,
        latitude: geoResponse.latitude,
        longitude: geoResponse.longitude,
        source: geoResponse.source,
        confidence: 0.9,
        isTamilNadu: isTN,
      };
    }
  } catch (err) {
    console.error('External geocoding error:', err);
  }

  // ----------------------------------------------------
  // Tier 4: Unknown / Unresolvable Location
  // ----------------------------------------------------
  return {
    matched: false,
    query,
    canonicalName: '',
    district: '',
    state: '',
    latitude: 0,
    longitude: 0,
    source: 'none',
    confidence: 0,
    isTamilNadu: false,
  };
}
