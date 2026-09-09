/**
 * PIXEL CONTRAST — measure what renders, not what the CSS says.
 *
 * The CSS-reading version of this was wrong in BOTH directions on the same night: it
 * reported 14.3:1 for a block that was unreadable (it read `backgroundColor` and walked
 * straight past a radial-gradient) and 1.33:1 for a contact block that looks perfect
 * (it read a transparent background as black). A number that errs both ways cannot even
 * be trusted as a conservative bound.
 *
 * So: screenshot the region and read the pixels. Everything upstream of the pixels —
 * backgroundColor, gradients, opacity, blend modes, an image nobody thought about — is a
 * form. The pixels are the fact.
 *
 * METHOD. Take the darkest and lightest 5% of pixels in the region and compute the WCAG
 * contrast ratio between them. Text is the extreme against its ground, so this is the
 * contrast a reader actually gets. A region with no text (a solid block) reports a low
 * ratio and is excluded by the caller, not silently passed.
 */
import zlib from "node:zlib";

/** Minimal PNG reader: IHDR + IDAT, 8-bit RGB/RGBA, unfiltered to raw pixels. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let pos = 8, width = 0, height = 0, depth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`unsupported png depth=${depth} color=${colorType}`);
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride); rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= channels) ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

const srgb = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const luminance = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);

/** The contrast a reader actually gets, from a region TIGHT AROUND SOME TEXT.
 *
 *  Percentiles over a whole section do not work: a cloned section carries the page's own
 *  generous padding, so text is under 5% of the pixels and the 5th percentile is still
 *  background — which reported 1.25:1 for a block that is plainly readable. So the
 *  caller clips to a text element plus a few pixels, and this takes the true extremes.
 *  In a box that is mostly one glyph run, min and max ARE the ink and the ground. */
export function regionContrast(png) {
  const { width, height, channels, data } = png;
  let lo = 1, hi = 0, n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width * channels + x * channels;
      if (channels === 4 && data[i + 3] < 250) continue;   // never measure a transparent pixel
      const L = luminance(data[i], data[i + 1], data[i + 2]);
      if (L < lo) lo = L;
      if (L > hi) hi = L;
      n++;
    }
  }
  if (!n) return { ratio: 0, dark: 0, light: 0, n: 0 };
  return { ratio: (hi + 0.05) / (lo + 0.05), dark: lo, light: hi, n };
}
