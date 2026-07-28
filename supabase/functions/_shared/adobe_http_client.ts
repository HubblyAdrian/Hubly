/**
 * AdobeHttpClient — authenticated HTTP for Adobe Creative Cloud partner APIs.
 *
 * Reusable across Lightroom, and later Express / Photoshop / Frame.io:
 *   Authorization: Bearer <access_token>
 *   X-API-Key: <ADOBE_CLIENT_ID>
 *
 * Lightroom JSON responses are prefixed with `while(1){}` — always strip before parse.
 * @see https://developer.adobe.com/lightroom/lightroom-api-docs/guides/calling-api/
 */

import { adobeClientId } from "./adobe_oauth.ts";

export const ADOBE_LR_API_BASE = "https://lr.adobe.io/v2";

const WHILE_ONE = /^while\s*\(\s*1\s*\)\s*\{\s*\}\s*/;

export type AdobeHttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "HEAD";

export type AdobeHttpResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  rawText: string;
  headers: Headers;
  error?: string;
};

export function stripAdobeWhileOne(text: string): string {
  return String(text || "").replace(WHILE_ONE, "");
}

export function parseAdobeJson(text: string): unknown {
  const cleaned = stripAdobeWhileOne(text).trim();
  if (!cleaned) return null;
  return JSON.parse(cleaned);
}

export class AdobeHttpClient {
  readonly accessToken: string;
  readonly apiKey: string;
  readonly baseUrl: string;

  constructor(opts: {
    accessToken: string;
    apiKey?: string | null;
    baseUrl?: string;
  }) {
    const key = (opts.apiKey || adobeClientId() || "").trim();
    if (!opts.accessToken) throw new Error("Adobe access token required");
    if (!key) throw new Error("ADOBE_CLIENT_ID required for Adobe API calls");
    this.accessToken = opts.accessToken;
    this.apiKey = key;
    this.baseUrl = (opts.baseUrl || ADOBE_LR_API_BASE).replace(/\/$/, "");
  }

  headers(extra?: Record<string, string>, jsonBody = false): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "X-API-Key": this.apiKey,
      Accept: "application/json",
      ...(extra || {}),
    };
    if (jsonBody) h["Content-Type"] = "application/json";
    return h;
  }

  async request<T = unknown>(
    method: AdobeHttpMethod,
    path: string,
    opts?: {
      query?: Record<string, string | number | boolean | undefined | null>;
      body?: unknown;
      rawBody?: BodyInit | null;
      headers?: Record<string, string>;
      /** When true, do not JSON-parse (e.g. binary renditions). */
      binary?: boolean;
    },
  ): Promise<AdobeHttpResult<T>> {
    const url = new URL(
      path.startsWith("http") ? path : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`,
    );
    if (opts?.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v === undefined || v === null || v === "") continue;
        url.searchParams.set(k, String(v));
      }
    }

    const hasJson = opts?.body !== undefined && opts?.rawBody === undefined;
    const res = await fetch(url.toString(), {
      method,
      headers: this.headers(opts?.headers, hasJson),
      body: opts?.rawBody !== undefined
        ? opts.rawBody
        : (hasJson ? JSON.stringify(opts!.body) : undefined),
    });

    if (opts?.binary) {
      if (!res.ok) {
        const rawText = await res.text().catch(() => "");
        let errMsg = `Adobe API ${res.status}`;
        try {
          const parsed = parseAdobeJson(rawText) as Record<string, unknown> | null;
          errMsg = String(parsed?.description || parsed?.error || errMsg);
        } catch { /* keep */ }
        return {
          ok: false,
          status: res.status,
          data: null,
          rawText,
          headers: res.headers,
          error: errMsg,
        };
      }
      const buf = await res.arrayBuffer();
      return {
        ok: true,
        status: res.status,
        data: buf as unknown as T,
        rawText: "",
        headers: res.headers,
      };
    }

    const rawText = await res.text().catch(() => "");
    let data: T | null = null;
    try {
      data = parseAdobeJson(rawText) as T;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const errObj = (data || {}) as Record<string, unknown>;
      return {
        ok: false,
        status: res.status,
        data,
        rawText,
        headers: res.headers,
        error: String(
          errObj.description || errObj.error_description || errObj.error ||
            `Adobe API ${res.status}`,
        ),
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
      rawText,
      headers: res.headers,
    };
  }

  get<T = unknown>(path: string, query?: AdobeHttpResult["data"] extends never ? never : Record<string, string | number | boolean | undefined | null>) {
    return this.request<T>("GET", path, { query });
  }

  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, { body: body ?? {} });
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, { body: body ?? {} });
  }

  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}

/** Health probe against Lightroom Services. Sends X-API-Key when available (Adobe may require it). */
export async function adobePublicHealth(
  baseUrl = ADOBE_LR_API_BASE,
): Promise<AdobeHttpResult<{ status?: string; code?: string; description?: string }>> {
  const url = `${baseUrl.replace(/\/$/, "")}/health`;
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = adobeClientId();
  if (key) headers["X-API-Key"] = key;
  const res = await fetch(url, { method: "GET", headers });
  const rawText = await res.text().catch(() => "");
  let data: { status?: string; code?: string; description?: string } | null = null;
  try {
    data = parseAdobeJson(rawText) as { status?: string; code?: string; description?: string };
  } catch {
    data = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    data,
    rawText,
    headers: res.headers,
    error: res.ok ? undefined : String(data?.description || `Adobe health ${res.status}`),
  };
}
