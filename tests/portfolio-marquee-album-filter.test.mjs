import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hubly = readFileSync(join(root, "public/hubly.html"), "utf8");

test("portfolio marquee chips are clickable album filters", () => {
  assert.match(hubly, /function selectWsGalMarqueeAlbum\(/);
  assert.match(hubly, /S\._wsGalMarqueeAlbum/);
  assert.match(hubly, /onclick="selectWsGalMarqueeAlbum\('/);
  assert.match(hubly, /ws-gal-marquee-chip\$\{[^}]*is-on/);
  assert.match(hubly, /selectWsGalMarqueeAlbum\('',event\)">All</);
});

test("album filter keeps the slow marquee track", () => {
  const fn = hubly.slice(
    hubly.indexOf("function renderWebsiteGallery"),
    hubly.indexOf("function moveGalleryPair")
  );
  assert.match(fn, /ws-gal-marquee-track/);
  assert.match(fn, /ws-gal-marquee-chip/);
  assert.match(fn, /_wsGalMarqueeAlbum/);
  // Still duplicates cards for continuous side-to-side loop
  assert.match(fn, /loop=stripUrls\.length>=2\?cards\+cards:cards\+cards|cards\$\{cards\}|\$\{loop\}/);
  assert.match(hubly, /animation:wsGalMarquee 42s linear infinite/);
});

test("marquee chips are buttons with an active style", () => {
  assert.match(hubly, /\.ws-gal-marquee-chip\.is-on\{/);
  assert.match(hubly, /\.ws-gal-marquee-chip\{[\s\S]*?cursor:pointer/);
  assert.doesNotMatch(
    hubly,
    /ws-gal-marquee-labels">\$\{albums\.filter[\s\S]*?<span class="ws-gal-marquee-chip">/
  );
});
