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

/**
 * THE KEY, OR AN EXCEPTION. Never an empty string.
 *
 * THIS IS THE MOST IMPORTANT FUNCTION IN THIS FILE.
 *
 * Nine call sites resolved the service key as
 *
 *   (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim()
 *
 * and then carried on with "". An empty key does not fail loudly: it produces a
 * 401 from PostgREST, which the callers log and continue past, because this
 * codebase's oldest habit is treating a response as evidence of an outcome.
 * Seven of those nine were in the document build path -- storage uploads, the
 * build dispatch, every draft write. Disabling the legacy keys would have
 * turned all of them off at once, silently, and the first symptom would have
 * been pages quietly not being built.
 *
 * So: resolve, or throw. A thrown error is a 500 someone can see. An empty
 * string is a product that looks like it is working.
 *
 * This is instance nine of the swallow-failure pattern in KNOWN_ISSUES, and it
 * is deliberately fixed BEFORE any key is created -- it converts every
 * remaining key problem in the migration from silent to loud, which is what
 * makes the rest of it safe to attempt at all.
 */
export function requireSecretKey(): ResolvedSecretKey {
  const resolved = resolveSupabaseSecretKey();
  if (!resolved || !resolved.key) {
    throw new Error(
      "Supabase secret key missing. Set SUPABASE_SECRET_KEYS (JSON, e.g. " +
        '{"default":"sb_secret_..."}) or SUPABASE_SERVICE_ROLE_KEY. Refusing to ' +
        "continue with an empty key: it would 401 and be logged rather than noticed.",
    );
  }
  return resolved;
}

/**
 * Headers for a RAW fetch against PostgREST / Storage with admin rights.
 *
 * The Bearer header is the trap. Every hand-rolled call site in this repo sends
 *
 *   { apikey: key, authorization: `Bearer ${key}` }
 *
 * which is correct for a legacy service_role JWT and BREAKS for a new
 * sb_secret_ key: those are not JWTs, and PostgREST rejects them with
 * "Invalid JWT" when they arrive as a Bearer token. The failure is a 401,
 * which is exactly the failure the empty-key case produces, so the two are
 * indistinguishable in a log.
 *
 * Send `apikey` always; send `Authorization` only when the key really is a JWT.
 */
export function adminHeaders(extra?: Record<string, string>): Record<string, string> {
  const { key, format } = requireSecretKey();
  const headers: Record<string, string> = { apikey: key, ...(extra || {}) };
  if (format === "legacy_jwt") headers.authorization = `Bearer ${key}`;
  return headers;
}

/**
 * The PUBLIC key, for the anon-rights calls a function makes on a caller's
 * behalf.
 *
 * SUPABASE_PUBLISHABLE_KEY (singular) is read in five places in this repo and
 * is set NOWHERE: the platform injects SUPABASE_PUBLISHABLE_KEYS, plural, as a
 * JSON object. Every one of those five fallbacks was dead code that resolved to
 * undefined, and would have stayed dead through the whole key migration while
 * looking like it had been handled.
 */
export function resolvePublishableKey(): string | null {
  const plural = (Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "").trim();
  if (plural) {
    const fromJson = parseSecretKeysJson(plural);
    if (fromJson) return fromJson;
    if (plural.startsWith("sb_publishable_") || looksLikeJwt(plural)) return plural;
  }
  const singular = (Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "").trim();
  if (singular) return singular;
  const anon = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  return anon || null;
}

/** Same contract as requireSecretKey, for the public key. */
export function requirePublishableKey(): string {
  const key = resolvePublishableKey();
  if (!key) {
    throw new Error(
      "Supabase publishable/anon key missing. Set SUPABASE_PUBLISHABLE_KEYS or " +
        "SUPABASE_ANON_KEY. Refusing to continue with an empty key.",
    );
  }
  return key;
}

/** Headers for a raw fetch with ANON rights (a caller's own token, if given). */
export function publicHeaders(userJwt?: string | null, extra?: Record<string, string>): Record<string, string> {
  const key = requirePublishableKey();
  return {
    apikey: key,
    // A caller's JWT is a real JWT and belongs in Authorization. Without one,
    // fall back to the publishable key ONLY when it is itself a JWT (legacy
    // anon); an sb_publishable_ value must not be sent as a Bearer token.
    ...(userJwt ? { authorization: `Bearer ${userJwt}` } : looksLikeJwt(key) ? { authorization: `Bearer ${key}` } : {}),
    ...(extra || {}),
  };
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
 * A client acting as the CALLER, with their own rights, not ours.
 *
 * Same publishable-key trap as everywhere else: the anon/publishable value is
 * an `apikey`, and only a legacy anon JWT may also travel as a Bearer token.
 * Here the Bearer slot belongs to the CALLER's Authorization header anyway —
 * that is whose identity is being resolved — so the only real change is that
 * the apikey is now resolved through resolvePublishableKey() rather than an
 * env var that is set nowhere.
 *
 * Throws rather than returning a half-configured client: a user client built
 * with an empty key does not fail, it just says nobody is signed in, which is
 * a wrong answer rather than an error.
 */
export function createUserClient(authHeader: string | null | undefined): SupabaseClient {
  const url = (Deno.env.get("SUPABASE_URL") || "").trim();
  if (!url) throw new Error("SUPABASE_URL is not configured");
  const key = requirePublishableKey();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authHeader || "" } },
  });
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
