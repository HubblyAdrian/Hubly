/**
 * Shared security / tenancy helpers for Google Calendar edge functions.
 * Stripe-style: verify before work, never trust client-supplied identity alone.
 */

export function randomSecret(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare for webhook secrets. */
export function timingSafeEqual(a: string, b: string): boolean {
  const aa = String(a || "");
  const bb = String(b || "");
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) {
    out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return out === 0;
}

const DEFAULT_APP = "https://myhubly.app";

/** Hosts allowed for OAuth return_to redirects. */
export function isAllowedReturnHost(hostname: string): boolean {
  const host = String(hostname || "").toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host === "myhubly.app" || host.endsWith(".myhubly.app")) return true;
  // Hubly Vercel previews / production aliases
  if (host === "hubly-ten.vercel.app" || host.endsWith(".vercel.app")) {
    return host.includes("hubly") || host.startsWith("hubly");
  }
  return false;
}

export function sanitizeReturnTo(raw: string | null | undefined, fallback?: string): string {
  const appUrl = (fallback || Deno.env.get("HUBLY_APP_URL") || DEFAULT_APP).replace(/\/$/, "");
  const input = String(raw || "").trim();
  if (!input) return appUrl;
  try {
    const u = new URL(input);
    if (!/^https?:$/i.test(u.protocol)) return appUrl;
    if (!isAllowedReturnHost(u.hostname)) return appUrl;
    return u.toString();
  } catch {
    return appUrl;
  }
}

export function appBaseUrl(): string {
  return (Deno.env.get("HUBLY_APP_URL") || DEFAULT_APP).replace(/\/$/, "");
}

/** Parse comma/newline-separated email allowlist. */
export function parseEmailAllowlist(raw: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const part of String(raw || "").split(/[\s,;]+/)) {
    const e = part.trim().toLowerCase();
    if (e && e.includes("@")) out.add(e);
  }
  return out;
}

/**
 * Google OAuth is in Testing until verification completes.
 * - ACCESS_MODE=open → anyone can connect
 * - otherwise (default) → only GOOGLE_CALENDAR_TEST_USERS may start OAuth
 */
export function googleCalendarAccessForEmail(email: string | null | undefined): {
  mode: "testing" | "open";
  allowed: boolean;
} {
  const modeRaw = (Deno.env.get("GOOGLE_CALENDAR_ACCESS_MODE") || "testing").trim().toLowerCase();
  if (modeRaw === "open" || modeRaw === "public" || modeRaw === "production") {
    return { mode: "open", allowed: true };
  }
  const allow = parseEmailAllowlist(Deno.env.get("GOOGLE_CALENDAR_TEST_USERS"));
  const e = String(email || "").trim().toLowerCase();
  return { mode: "testing", allowed: !!e && allow.has(e) };
}
