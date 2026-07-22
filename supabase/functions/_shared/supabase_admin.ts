/**
 * Resolve Supabase admin (service) credentials for Edge Functions.
 *
 * Supports both eras:
 * - Legacy: SUPABASE_SERVICE_ROLE_KEY = JWT string (eyJ…)
 * - New API keys: SUPABASE_SECRET_KEYS = JSON object {"default":"sb_secret_…"}
 *
 * New secret keys must be sent on the `apikey` header only — NOT as
 * `Authorization: Bearer …` (platform rejects non-JWT secrets with Invalid JWT).
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ResolvedSecretKey = {
  key: string;
  format: "legacy_jwt" | "secret";
  source: "SUPABASE_SECRET_KEYS" | "SUPABASE_SERVICE_ROLE_KEY";
};

function looksLikeJwt(v: string): boolean {
  return v.startsWith("eyJ") && v.split(".").length >= 3;
}

function looksLikeSecretKey(v: string): boolean {
  return v.startsWith("sb_secret_");
}

function parseSecretKeysJson(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      for (const name of ["default", "service_role", "service-role", "admin"]) {
        const v = String(obj[name] || "").trim();
        if (v) return v;
      }
      for (const v of Object.values(obj)) {
        const s = String(v || "").trim();
        if (s) return s;
      }
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const s = String(item || "").trim();
        if (s) return s;
      }
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** Resolve the best available service/secret key for admin DB access. */
export function resolveSupabaseSecretKey(): ResolvedSecretKey | null {
  const secretKeysRaw = (Deno.env.get("SUPABASE_SECRET_KEYS") || "").trim();
  if (secretKeysRaw) {
    const fromJson = parseSecretKeysJson(secretKeysRaw);
    if (fromJson) {
      return {
        key: fromJson,
        format: looksLikeJwt(fromJson) ? "legacy_jwt" : "secret",
        source: "SUPABASE_SECRET_KEYS",
      };
    }
    if (looksLikeJwt(secretKeysRaw) || looksLikeSecretKey(secretKeysRaw)) {
      return {
        key: secretKeysRaw,
        format: looksLikeJwt(secretKeysRaw) ? "legacy_jwt" : "secret",
        source: "SUPABASE_SECRET_KEYS",
      };
    }
  }

  const legacy = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (legacy) {
    // Never treat a JSON blob as the key string.
    if (legacy.startsWith("{") || legacy.startsWith("[")) return null;
    return {
      key: legacy,
      format: looksLikeJwt(legacy) ? "legacy_jwt" : "secret",
      source: "SUPABASE_SERVICE_ROLE_KEY",
    };
  }

  return null;
}

/** Redacted meta for ops/diagnose responses — never includes the key. */
export function secretKeyMeta(resolved: ResolvedSecretKey | null): Record<string, unknown> {
  if (!resolved) return { present: false };
  return {
    present: true,
    source: resolved.source,
    format: resolved.format,
    prefix: resolved.key.slice(0, 10),
    length: resolved.key.length,
  };
}

/**
 * Admin Supabase client that bypasses RLS.
 * Handles new `sb_secret_` keys (apikey-only) and legacy service_role JWTs.
 */
export function createAdminClient(): SupabaseClient {
  const url = (Deno.env.get("SUPABASE_URL") || "").trim();
  if (!url) throw new Error("SUPABASE_URL is not configured");

  const resolved = resolveSupabaseSecretKey();
  if (!resolved) {
    throw new Error(
      "Supabase secret key missing — set SUPABASE_SECRET_KEYS.default or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const { key, format } = resolved;

  if (format === "secret") {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init = {}) => {
          const headers = new Headers(init.headers || {});
          headers.set("apikey", key);
          // New secret keys are not JWTs — Bearer breaks PostgREST with Invalid JWT.
          headers.delete("Authorization");
          return fetch(input, { ...init, headers });
        },
      },
    });
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
