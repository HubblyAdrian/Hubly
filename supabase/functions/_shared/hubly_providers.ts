/**
 * Hubly Providers — production-first vendor boundary
 *
 * Runtime never knows which vendor is used.
 * Providers contain all vendor-specific code.
 *
 * Production-First:
 * - Real interfaces, real error handling, real logging hooks
 * - If credentials are missing → report "Provider not configured"
 * - NEVER simulate success
 */

export type HublyProviderStatus =
  | "ready"
  | "not_configured"
  | "misconfigured"
  | "error";

export type HublyProviderResult<T> = {
  ok: boolean;
  status: HublyProviderStatus;
  provider: string;
  /** Human-readable — safe for progress / owner UI */
  message: string;
  data?: T;
  error?: {
    code: string;
    detail?: string;
    retryable?: boolean;
  };
  /** Structured log fields — never secrets */
  meta?: Record<string, unknown>;
};

export function providerNotConfigured(
  provider: string,
  missing: string[],
): HublyProviderResult<never> {
  return {
    ok: false,
    status: "not_configured",
    provider,
    message: `Provider not configured. Add: ${missing.join(", ")}`,
    error: {
      code: "PROVIDER_NOT_CONFIGURED",
      detail: missing.join(", "),
      retryable: false,
    },
    meta: { missing },
  };
}

export function providerError(
  provider: string,
  code: string,
  detail: string,
  opts?: { retryable?: boolean; meta?: Record<string, unknown> },
): HublyProviderResult<never> {
  return {
    ok: false,
    status: "error",
    provider,
    message: detail,
    error: {
      code,
      detail,
      retryable: !!opts?.retryable,
    },
    meta: opts?.meta,
  };
}

export function providerOk<T>(
  provider: string,
  data: T,
  message: string,
  meta?: Record<string, unknown>,
): HublyProviderResult<T> {
  return {
    ok: true,
    status: "ready",
    provider,
    message,
    data,
    meta,
  };
}

export function envTruthy(name: string): string | null {
  const v = (typeof Deno !== "undefined" ? Deno.env.get(name) : undefined) || null;
  const s = String(v || "").trim();
  return s || null;
}

export type HublyProviderInfo = {
  id: string;
  kind: string;
  configured: boolean;
  missing: string[];
};

export const HublyProviders = {
  notConfigured: providerNotConfigured,
  error: providerError,
  ok: providerOk,
  env: envTruthy,
};

export default HublyProviders;
