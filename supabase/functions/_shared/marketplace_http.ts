/** Shared HTTP helpers for marketplace edge routes. */

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

export function parsePath(req: Request): { segments: string[]; search: URLSearchParams } {
  const u = new URL(req.url);
  // /functions/v1/marketplace/... → strip up to and including "marketplace"
  const parts = u.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "marketplace");
  const segments = idx >= 0 ? parts.slice(idx + 1) : parts;
  return { segments, search: u.searchParams };
}
