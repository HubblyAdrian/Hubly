// Marketplace Local Discovery: the one real ZIP -> coordinates conversion
// path, used identically for both customer ZIPs and provider locations
// (see marketplace/index.ts handleSettings / handleLiteProfileSave and
// marketplace_match.ts). Static lookup table (zip_centroids), no runtime
// geocoding API. Coordinates are an approximation (a ZIP's centroid, not
// an exact address) -- adequate for "which providers are reasonably
// close", not claimed as precise distance-to-the-door.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ZipCentroid = {
  zip: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

function normalizeZip(zip: string | null | undefined): string | null {
  const digits = String(zip || "").trim().match(/^\d{5}/);
  return digits ? digits[0] : null;
}

/** Look up a ZIP's approximate centroid. Returns null for an unknown/invalid ZIP -- never guessed. */
export async function resolveZipCentroid(
  admin: SupabaseClient,
  zipIn: string | null | undefined,
): Promise<ZipCentroid | null> {
  const zip = normalizeZip(zipIn);
  if (!zip) return null;
  const { data, error } = await admin
    .from("zip_centroids")
    .select("zip,city,state,latitude,longitude")
    .eq("zip", zip)
    .maybeSingle();
  if (error || !data) return null;
  return {
    zip: data.zip,
    city: data.city,
    state: data.state,
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
  };
}

/** Real great-circle distance in miles between two coordinates. */
export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.7613; // Earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
