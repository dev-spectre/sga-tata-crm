export type LocationType = 'district' | 'city' | 'town' | 'taluk' | 'hub';

export interface LocationNode {
  id: string;
  name: string;
  district: string;
  type: LocationType;
  latitude: number;
  longitude: number;
  pincodes?: string[];
  aliases?: string[];
}

export type LocationMatchType =
  | 'pincode'
  | 'exact'
  | 'alias'
  | 'substring'
  | 'fuzzy'
  | 'none';

export interface LocationMatchResult {
  matched: boolean;
  query: string;
  canonicalName: string;
  district: string;
  latitude: number;
  longitude: number;
  pincode?: string;
  matchType: LocationMatchType;
  confidence: number; // 0.0 to 1.0
}

export interface MatcherOptions {
  minConfidence?: number;
  exactOnly?: boolean;
  preferredDistrict?: string;
}
