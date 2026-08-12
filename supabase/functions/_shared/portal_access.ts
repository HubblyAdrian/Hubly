// #189: Customer Portal magic-link tokens + signed portal sessions.
// Token verification is always an exact hash comparison, never an
// existence check — see the migration for why that distinction matters.
// HMAC signing mirrors stripe.ts's own webhook-signature verification
// (crypto.subtle HMAC-SHA256 + timing-safe hex compare) — same
// primitive, same convention, not a new pattern.
import type { AdminClient } from "./marketplace_provider.ts";

const TOKEN_BYTES = 32; // 256-bit raw token
const TOKEN_EXPIRY_DAYS = 30;
const SESSION_EXPIRY_SECONDS = 24 * 60 * 60;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(digest);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Best-effort — returns null on any failure (missing config, DB error),
 *  never throws. Callers must treat a null return as "no portal link this
 *  time," not as a reason to fail the booking or the confirmation email. */
export async function issuePortalAccessToken(
  admin: AdminClient,
  businessId: string,
  customerId: string,
): Promise<string | null> {
  try {
    const rawBytes = new Uint8Array(TOKEN_BYTES);
    crypto.getRandomValues(rawBytes);
    const rawToken = base64url(rawBytes);
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 86400000).toISOString();
    const { error } = await admin.from("portal_access_tokens").insert({
      business_id: businessId,
      customer_id: customerId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (error) return null;
    return rawToken;
  } catch (_e) {
    return null;
  }
}

export function buildPortalUrl(slug: string, rawToken: string): string {
  return `https://${slug}.myhubly.app/portal?t=${encodeURIComponent(rawToken)}`;
}

export type PortalTokenLookup =
  | { ok: true; businessId: string; customerId: string }
  | { ok: false };

/** Exact-hash verification only — never "does any row have a token."
 *  Reusable until expires_at (not single-use, see migration comment);
 *  last_used_at is just a courtesy timestamp, not a consumption marker. */
export async function verifyPortalAccessToken(
  admin: AdminClient,
  rawToken: string,
): Promise<PortalTokenLookup> {
  if (!rawToken) return { ok: false };
  const tokenHash = await sha256Hex(rawToken);
  const { data } = await admin
    .from("portal_access_tokens")
    .select("id, business_id, customer_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false };
  if (new Date(data.expires_at as string).getTime() < Date.now()) return { ok: false };
  admin.from("portal_access_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id as string)
    .then(() => {}, () => {});
  return { ok: true, businessId: String(data.business_id), customerId: String(data.customer_id) };
}

export type PortalSessionPayload = { businessId: string; customerId: string; exp: number };

/** Returns null if PORTAL_SESSION_SECRET isn't configured — callers must
 *  treat that as a hard failure for the verify action (no session without
 *  a real signature), not a silent bypass. */
export async function issuePortalSession(businessId: string, customerId: string): Promise<string | null> {
  const secret = Deno.env.get("PORTAL_SESSION_SECRET");
  if (!secret) return null;
  const payload: PortalSessionPayload = {
    businessId,
    customerId,
    exp: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS,
  };
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${toHex(mac)}`;
}

/** Session identity comes exclusively from a verified signature — never
 *  from anything a client claims alongside it. Returns null on any
 *  malformed/unsigned/expired/tampered token. */
export async function verifyPortalSession(token: string): Promise<PortalSessionPayload | null> {
  const secret = Deno.env.get("PORTAL_SESSION_SECRET");
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigHex] = parts;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
    const expectedHex = toHex(mac);
    if (!timingSafeEqual(expectedHex, sigHex)) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as PortalSessionPayload;
    if (!payload.businessId || !payload.customerId || !Number.isFinite(payload.exp)) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_e) {
    return null;
  }
}
