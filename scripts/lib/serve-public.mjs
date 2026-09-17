/**
 * PUBLIC/, SERVED OVER HTTP — because file:// measures a different program.
 *
 * hubly.html links its stylesheets ROOT-ABSOLUTELY (`/journey-os/operate-pixel.css`). Under
 * file:// that resolves to `file:///journey-os/...` and never loads, so every rule in those ten
 * sheets is absent and a check "measuring the page" is measuring an unstyled document. That is how
 * check-job-door-open first passed VACUOUSLY — the six rules that hid the button it was asserting
 * were never applied.
 *
 * The rig now refuses a page whose same-origin stylesheets did not load, which turns that silent
 * false green into a loud precondition failure. This is the other half: the server that makes the
 * precondition satisfiable. Shared, because it had already been written twice.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
               ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
               ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
               ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon" };

/** Serves <root>/public on a loopback port. Returns { url(file), close() }. */
export async function servePublic(root) {
  const server = createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent((req.url || "/").split("?")[0]);
      // THE REAL ROUTES, NOT JUST THE FILENAMES. api/router.js answers "/", "/home", "/platform" and
      // "/platform-home" with platform-home.html — none of which is a file on disk. A checker that
      // asked for "/platform-home" got a 404 BODY and then reported "no seam on the page", which is a
      // check failing to find a page and blaming the product. If the router grows a route, it grows
      // here too; the alternative is every check hardcoding a filename the product does not use.
      if (rel === "/" || rel === "/home" || rel === "/platform" || rel === "/platform-home") rel = "/platform-home.html";
      const buf = await readFile(join(root, "public", rel));
      res.writeHead(200, { "content-type": MIME[extname(rel)] || "application/octet-stream" });
      res.end(buf);
    } catch { res.writeHead(404); res.end("not found"); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, url: (f) => `${base}/${String(f).replace(/^\//, "")}`, close: () => server.close() };
}
