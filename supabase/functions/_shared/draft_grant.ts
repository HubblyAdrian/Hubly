/**
 * Draft grants — a short-lived, signed, business-scoped credential that can
 * safely cross the browser, so the raw draft_token never has to.
 *
 * WHY THIS EXISTS
 *
 * start_business_in_progress() creates a live site for someone with no account
 * and hands back a `draft_token` (a uuid on the businesses row). That token is a
 * PERMANENT bearer credential: anyone holding it can call
 * patch_business_in_progress and rewrite the site, for as long as the business
 * stays unclaimed.
 *
 * hubly-conversation:591 already refuses to leak capability `raw` to the client
 * for exactly this class of reason, and draft_token is the strongest argument
 * for that rule rather than an exception to it. So the browser never receives
 * it. It receives a GRANT instead:
 *
 *     - 10 minutes, not forever
 *     - scoped to one business_id
 *     - single-use in practice: it is exchanged immediately for an httpOnly
 *       cookie and then worthless
 *     - proves nothing except "the bearer was present when this draft was made"
 *
 * A stolen grant is a ten-minute window on one unclaimed shell. A stolen
 * draft_token is that site, permanently.
 *
 * SIGNING is copied from _shared/portal_access.ts (issuePortalSession /
 * verifyPortalSession) rather than reinvented: HMAC-SHA256 over a base64url
 * payload, hex signature, timing-safe compare, identity taken ONLY from the
 * verified signature and never from anything the caller asserts alongside it.
 *
 * The same secret must be readable by the Vercel /api route that exchanges the
 * grant for a cookie, because a cookie usable by myhubly.app cannot be set from
 * *.supabase.co — it would be a third-party cookie and SameSite=Lax would never
 * send it. Hence HUBLY_DRAFT_SECRET in both environments.
 */

const GRANT_TTL_SECONDS = 10 * 60;

export type DraftGrantPayload = {
  /** The unclaimed business this grant is for. */
  businessId: string;
  /** Unix seconds. */
  exp: number;
  /** Makes every grant distinct even for the same business in the same second. */
  nonce: string;
};

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare — never leak signature bytes through timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Mint a grant for a freshly created draft.
 *
 * Returns null when HUBLY_DRAFT_SECRET is unset. Callers must treat that as
 * "no grant" and carry on — a missing secret must never fall back to shipping
 * the raw draft_token, and must never produce an unsigned grant that the
 * exchange endpoint might accept. Fail closed: signup stops working, loudly,
 * rather than working insecurely.
 */
export async function issueDraftGrant(businessId: string): Promise<string | null> {
  const secret = Deno.env.get("HUBLY_DRAFT_SECRET");
  if (!secret || !businessId) return null;
  const payload: DraftGrantPayload = {
    businessId: String(businessId),
    exp: Math.floor(Date.now() / 1000) + GRANT_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(payloadB64),
  );
  return `${payloadB64}.${toHex(mac)}`;
}

/**
 * Verify a grant. Returns null on anything malformed, unsigned, tampered or
 * expired — the business id comes exclusively from the verified payload.
 */
export async function verifyDraftGrant(token: string): Promise<DraftGrantPayload | null> {
  const secret = Deno.env.get("HUBLY_DRAFT_SECRET");
  if (!secret || !token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigHex] = parts;
  try {
    const mac = await crypto.subtle.sign(
      "HMAC",
      await hmacKey(secret),
      new TextEncoder().encode(payloadB64),
    );
    if (!timingSafeEqual(toHex(mac), sigHex)) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadB64)),
    ) as DraftGrantPayload;
    if (!payload.businessId || !Number.isFinite(payload.exp)) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_e) {
    return null;
  }
}
