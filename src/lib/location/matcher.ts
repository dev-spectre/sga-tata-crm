import { LocationMatchResult, LocationNode, MatcherOptions } from './types';
import {
  TN_LOCATIONS,
  PINCODE_INDEX,
  EXACT_INDEX,
  ALIAS_INDEX,
  normalizeKey,
} from './tn-locations';

// Noise words stripped during string tokenization
const NOISE_WORDS = new Set([
  'district',
  'dist',
  'city',
  'town',
  'post',
  'po',
  'dt',
  'taluk',
  'tk',
  'near',
  'opp',
  'opposite',
  'road',
  'rd',
  'street',
  'st',
  'area',
  'nagar',
  'junction',
  'bus',
  'stand',
  'stop',
]);

/**
 * Normalizes an incoming location/city string:
 * lowercases, removes punctuation, strips common noise words.
 */
export function normalizeString(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // replace punctuation with spaces
    .split(/\s+/)
    .filter((token) => token.length > 0 && !NOISE_WORDS.has(token))
    .join(' ')
    .trim();
}

/**
 * Extracts a 6-digit Tamil Nadu postal code (600xxx to 643xxx) if present.
 */
export function extractPincode(input: string): string | null {
  if (!input) return null;
  const match = input.match(/\b(6[0-4]\d{4})\b/);
  return match ? match[1] : null;
}

/**
 * Fast Damerau-Levenshtein distance with transposition support.
 * Computes the minimum number of insertions, deletions, substitutions,
 * or transpositions of two adjacent characters.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;

  if (la === 0) return lb;
  if (lb === 0) return la;

  // 2D distance matrix (optimized for short word lengths)
  const d: number[][] = Array.from({ length: la + 1 }, () =>
    new Array(lb + 1).fill(0)
  );

  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[la][lb];
}

/**
 * Calculates similarity ratio (0.0 to 1.0) based on edit distance.
 */
export function calculateSimilarity(
  a: string,
  b: string,
  distance: number
): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return Math.max(0, 1.0 - distance / maxLen);
}

/**
 * Pre-compiled list of candidate targets for fuzzy scanning
 */
interface FuzzyCandidate {
  key: string;
  node: LocationNode;
}

const FUZZY_CANDIDATES: FuzzyCandidate[] = [];
for (const loc of TN_LOCATIONS) {
  FUZZY_CANDIDATES.push({ key: normalizeKey(loc.name), node: loc });
  if (loc.aliases) {
    for (const alias of loc.aliases) {
      const k = normalizeKey(alias);
      if (k && k.length >= 3) {
        FUZZY_CANDIDATES.push({ key: k, node: loc });
      }
    }
  }
}

/**
 * Resolves an arbitrary location or city query string to a canonical Tamil Nadu location.
 * Evaluates through a 4-tier cascade:
 *   1. 6-digit Pincode matching
 *   2. Exact Canonical & Alias O(1) hash lookup
 *   3. Token/Substring matching
 *   4. Typo-tolerant Damerau-Levenshtein edit-distance
 */
export function resolveLocation(
  rawQuery: string,
  options?: MatcherOptions
): LocationMatchResult {
  if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
    return {
      matched: false,
      query: rawQuery || '',
      canonicalName: '',
      district: '',
      latitude: 0,
      longitude: 0,
      matchType: 'none',
      confidence: 0,
    };
  }

  const query = rawQuery.trim();
  const minConfidence = options?.minConfidence ?? 0.75;

  // ----------------------------------------------------
  // Stage 1: Pincode Resolution (O(1))
  // ----------------------------------------------------
  const pincode = extractPincode(query);
  if (pincode) {
    const node = PINCODE_INDEX.get(pincode);
    if (node) {
      return {
        matched: true,
        query,
        canonicalName: node.name,
        district: node.district,
        latitude: node.latitude,
        longitude: node.longitude,
        pincode,
        matchType: 'pincode',
        confidence: 1.0,
      };
    }
  }

  // ----------------------------------------------------
  // Stage 2: Exact Canonical & Curated Alias Lookup (O(1))
  // ----------------------------------------------------
  const normKey = normalizeKey(query);
  if (normKey) {
    // Check exact name
    const exactNode = EXACT_INDEX.get(normKey);
    if (exactNode) {
      return {
        matched: true,
        query,
        canonicalName: exactNode.name,
        district: exactNode.district,
        latitude: exactNode.latitude,
        longitude: exactNode.longitude,
        matchType: 'exact',
        confidence: 1.0,
      };
    }

    // Check curated aliases (e.g. cbe, kovai, trichy, mdu, ooty, mtp)
    const aliasNode = ALIAS_INDEX.get(normKey);
    if (aliasNode) {
      return {
        matched: true,
        query,
        canonicalName: aliasNode.name,
        district: aliasNode.district,
        latitude: aliasNode.latitude,
        longitude: aliasNode.longitude,
        matchType: 'alias',
        confidence: 0.98,
      };
    }
  }

  // ----------------------------------------------------
  // Stage 3: Substring & Word Token Extraction
  // ----------------------------------------------------
  const cleaned = normalizeString(query);
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);

  // Score candidate tokens: prioritize exact names over aliases,
  // district/city authority over local hubs, and later tokens (which in Indian addresses denote city/district)
  let bestTokenMatch: {
    node: LocationNode;
    score: number;
  } | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenKey = normalizeKey(token);
    if (!tokenKey) continue;

    const posBoost = tokens.length > 1 ? (i / (tokens.length - 1)) * 0.02 : 0;
    const lenBoost = Math.min(0.05, (token.length / 12) * 0.05);

    const exactMatch = EXACT_INDEX.get(tokenKey);
    if (exactMatch) {
      const typeBoost =
        exactMatch.type === 'district' ? 0.04 : exactMatch.type === 'city' ? 0.03 : 0.02;
      const score = 0.92 + typeBoost + posBoost + lenBoost;
      if (!bestTokenMatch || score > bestTokenMatch.score) {
        bestTokenMatch = { node: exactMatch, score };
      }
    }

    const aliasMatch = ALIAS_INDEX.get(tokenKey);
    if (aliasMatch) {
      const typeBoost =
        aliasMatch.type === 'district' ? 0.04 : aliasMatch.type === 'city' ? 0.03 : 0;
      const score = 0.86 + typeBoost + posBoost + lenBoost;
      if (!bestTokenMatch || score > bestTokenMatch.score) {
        bestTokenMatch = { node: aliasMatch, score };
      }
    }
  }

  if (bestTokenMatch) {
    return {
      matched: true,
      query,
      canonicalName: bestTokenMatch.node.name,
      district: bestTokenMatch.node.district,
      latitude: bestTokenMatch.node.latitude,
      longitude: bestTokenMatch.node.longitude,
      matchType: 'substring',
      confidence: Math.min(0.95, Number(bestTokenMatch.score.toFixed(3))),
    };
  }

  // If client only requested exact matches, exit early
  if (options?.exactOnly) {
    return {
      matched: false,
      query,
      canonicalName: '',
      district: '',
      latitude: 0,
      longitude: 0,
      matchType: 'none',
      confidence: 0,
    };
  }

  // ----------------------------------------------------
  // Stage 4: Typo-Tolerant Fuzzy Edit Distance
  // ----------------------------------------------------
  // Target string to scan: prefer single cleaned word if available, else primary token
  const targetWords = tokens.length > 0 ? tokens : [normKey];
  let bestCandidate: LocationNode | null = null;
  let bestScore = 0;

  for (const word of targetWords) {
    if (word.length < 3) continue;

    for (const cand of FUZZY_CANDIDATES) {
      // Length pre-filter: difference greater than 3 means distance is at least 4
      const lenDiff = Math.abs(word.length - cand.key.length);
      if (lenDiff > 3) continue;

      const dist = damerauLevenshtein(word, cand.key);

      // Allow distance up to 2 (or 3 for long words >= 8 characters)
      const maxAllowedDist = word.length >= 8 ? 3 : 2;
      if (dist <= maxAllowedDist) {
        const sim = calculateSimilarity(word, cand.key, dist);
        if (sim >= minConfidence && sim > bestScore) {
          bestScore = sim;
          bestCandidate = cand.node;
        }
      }
    }
  }

  if (bestCandidate && bestScore >= minConfidence) {
    return {
      matched: true,
      query,
      canonicalName: bestCandidate.name,
      district: bestCandidate.district,
      latitude: bestCandidate.latitude,
      longitude: bestCandidate.longitude,
      matchType: 'fuzzy',
      confidence: Number(bestScore.toFixed(3)),
    };
  }

  // ----------------------------------------------------
  // Stage 5: No Match Found (Out-of-State or Unknown)
  // ----------------------------------------------------
  return {
    matched: false,
    query,
    canonicalName: '',
    district: '',
    latitude: 0,
    longitude: 0,
    matchType: 'none',
    confidence: 0,
  };
}
