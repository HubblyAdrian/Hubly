/**
 * Hubly Connectors — HOW Hubly talks to external systems
 *
 * Capabilities = WHAT Hubly does.
 * Connectors = HOW Hubly connects.
 *
 * Runtime never embeds vendor-specific APIs.
 * Vendor implementations land only when we intentionally choose them for launch.
 *
 * User-facing: "Connection required" (Connections page mental model).
 * Internal status may still use connection_required codes.
 */

export type HublyConnectionStatus =
  | "connected"
  | "connection_required"
  | "misconfigured"
  | "error";

export type HublyConnectorResult<T> = {
  ok: boolean;
  status: HublyConnectionStatus;
  connector: string;
  /** Owner-facing — prefer “X connection required” */
  message: string;
  data?: T;
  error?: {
    code: string;
    detail?: string;
    retryable?: boolean;
  };
  meta?: Record<string, unknown>;
};

export type HublyConnectorKind =
  | "domain"
  | "payment"
  | "messaging"
  | "email"
  | "calendar"
  | "maps"
  | "advertising"
  | "accounting";

export function connectionRequired(
  connector: string,
  label: string,
  missing?: string[],
): HublyConnectorResult<never> {
  return {
    ok: false,
    status: "connection_required",
    connector,
    message: `${label} connection required`,
    error: {
      code: "CONNECTION_REQUIRED",
      detail: missing?.length ? missing.join(", ") : undefined,
      retryable: false,
    },
    meta: missing?.length ? { missing } : undefined,
  };
}

export function connectorError(
  connector: string,
  code: string,
  detail: string,
  opts?: { retryable?: boolean; meta?: Record<string, unknown> },
): HublyConnectorResult<never> {
  return {
    ok: false,
    status: "error",
    connector,
    message: detail,
    error: { code, detail, retryable: !!opts?.retryable },
    meta: opts?.meta,
  };
}

export function connectorOk<T>(
  connector: string,
  data: T,
  message: string,
  meta?: Record<string, unknown>,
): HublyConnectorResult<T> {
  return {
    ok: true,
    status: "connected",
    connector,
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

export const HublyConnectors = {
  connectionRequired,
  error: connectorError,
  ok: connectorOk,
  env: envTruthy,
};

export default HublyConnectors;
