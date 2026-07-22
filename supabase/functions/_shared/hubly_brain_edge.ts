/**
 * Shared Brain helpers for edge façades migrating off direct model calls.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function extractJsonObject(rawText: string): string {
  const cleaned = String(rawText || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return cleaned;
  return cleaned.slice(start, end + 1);
}

export async function loadBusinessMemoryDna(
  supabase: SupabaseClient,
  businessId: string,
): Promise<{ memory: unknown | null; dna: unknown | null }> {
  const id = String(businessId || "").trim();
  if (!id) return { memory: null, dna: null };
  const [{ data: memRow }, { data: dnaRow }] = await Promise.all([
    supabase.from("business_memories").select("memory").eq("business_id", id).maybeSingle(),
    supabase.from("business_dna").select("dna").eq("business_id", id).maybeSingle(),
  ]);
  return {
    memory: memRow?.memory || null,
    dna: dnaRow?.dna || null,
  };
}
