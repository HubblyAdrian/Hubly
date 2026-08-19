/**
 * Intrinsic pixel dimensions of an uploaded image, read from its own header
 * bytes.
 *
 * WHY THIS EXISTS
 *
 * The page header needs to know what SHAPE a logo is. A circular mark and a
 * wide wordmark are different design problems — one wants air around it and a
 * centred position, the other wants to sit on the baseline and replace the
 * business name entirely — and today both are squeezed into the same 2rem
 * square box, which is why every generated header looks the same however good
 * the logo is.
 *
 * There is no image-processing library in this stack and there does not need to
 * be: every format we accept states its own dimensions in the first few dozen
 * bytes. This reads those bytes and nothing else. It never decodes pixels,
 * never re-encodes, and never rewrites the asset.
 *
 * Returns null rather than guessing. A null aspect ratio means "treat it as the
 * default shape", which is exactly the behaviour every site has today, so an
 * unreadable header costs nothing.
 */

export type ImageDims = { width: number; height: number };

/** PNG: 8-byte signature, then an IHDR chunk whose first 8 payload bytes are
 *  width and height as big-endian uint32. */
function pngDims(b: Uint8Array): ImageDims | null {
  if (b.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (b[i] !== sig[i]) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // Bytes 12-15 are the chunk type; it must be IHDR for 16..23 to mean this.
  if (String.fromCharCode(b[12], b[13], b[14], b[15]) !== "IHDR") return null;
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

/** GIF: "GIF87a"/"GIF89a" then width and height as little-endian uint16. */
function gifDims(b: Uint8Array): ImageDims | null {
  if (b.length < 10) return null;
  const magic = String.fromCharCode(b[0], b[1], b[2]);
  if (magic !== "GIF") return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
}

/** JPEG: walk the marker segments to the SOFn frame header, which carries the
 *  real dimensions. Deliberately skips SOF4/SOF8/SOF12 (DHT/JPG/DAC), which are
 *  tables rather than frames and would give nonsense if read as one. */
function jpegDims(b: Uint8Array): ImageDims | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }           // resync past padding
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return null; // end of header data
    const len = dv.getUint16(i + 2);
    if (len < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (i + 9 >= b.length) return null;
      return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

/** WebP: RIFF container, then one of three chunk layouts. All three are handled
 *  because encoders pick between them by content and we do not control which. */
function webpDims(b: Uint8Array): ImageDims | null {
  if (b.length < 30) return null;
  const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WEBP") return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunk = tag(12);
  if (chunk === "VP8X") {
    // 24-bit little-endian, stored as (value - 1).
    const w = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const h = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return { width: w, height: h };
  }
  if (chunk === "VP8L") {
    const bits = dv.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 ") {
    // Lossy: 3-byte frame tag, 3-byte start code, then 14-bit w/h.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
  }
  return null;
}

/**
 * SVG: no pixel dimensions at all, only a coordinate system. viewBox is
 * preferred over width/height because it is the one that survives an author
 * setting `width="100%"`, which is common in exported marks and would otherwise
 * read as a 100x100 square.
 */
function svgDims(bytes: Uint8Array): ImageDims | null {
  // Only the opening tag is needed and SVGs can be large; 2KB is generous.
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 2048));
  if (!/<svg[\s>]/i.test(head)) return null;
  const vb = /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([\d.eE]+)[\s,]+([\d.eE]+)/i.exec(head);
  if (vb) {
    const w = parseFloat(vb[3]);
    const h = parseFloat(vb[4]);
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  const wm = /\bwidth\s*=\s*["']\s*([\d.]+)\s*(px)?["']/i.exec(head);
  const hm = /\bheight\s*=\s*["']\s*([\d.]+)\s*(px)?["']/i.exec(head);
  if (wm && hm) {
    const w = parseFloat(wm[1]);
    const h = parseFloat(hm[1]);
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  return null;
}

/** Best-effort dimensions for any image this product accepts. Null when the
 *  bytes cannot be read — never a guess. */
export function imageDimensions(bytes: Uint8Array): ImageDims | null {
  const d = pngDims(bytes) || gifDims(bytes) || webpDims(bytes) || jpegDims(bytes) || svgDims(bytes);
  if (!d || !(d.width > 0) || !(d.height > 0)) return null;
  return d;
}

/**
 * The shape buckets the header actually treats differently. Named for what they
 * mean to a designer, not for the numbers, because the numbers are an
 * implementation detail and the layouts are not.
 *
 * The boundaries are where the DESIGN changes, not round numbers:
 *  - 2.2 is where a mark stops reading as "a logo next to a name" and starts
 *    reading as the name itself, so the header must stop printing the name too.
 *  - 1.25/0.8 bracket square-ish marks, which is most uploaded logos.
 *  - Below 0.8 a mark is taller than it is wide, which no horizontal header
 *    bar accommodates without either shrinking it to nothing or growing the
 *    bar, so it gets a row of its own.
 */
export type LogoShape = "wordmark" | "wide" | "square" | "tall";

export function logoShapeFor(aspect: number | null | undefined): LogoShape | null {
  if (typeof aspect !== "number" || !isFinite(aspect) || aspect <= 0) return null;
  if (aspect >= 2.2) return "wordmark";
  if (aspect >= 1.25) return "wide";
  if (aspect >= 0.8) return "square";
  return "tall";
}
