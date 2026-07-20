/**
 * Pure helpers for gallery album / portfolio hosting decisions.
 * Mirrored behavior lives in public/hubly.html (ensureGalleryAlbums orphan
 * balance, addUrlsToGalleryAlbum, hostPortfolioDataUrls).
 */

/** Assign new URLs only to the target album (no orphan rebalance). */
export function addUrlsToAlbum(albums, urls, albumId) {
  const list = (urls || []).filter(Boolean);
  const next = albums.map((a) => ({
    ...a,
    urls: Array.isArray(a.urls) ? a.urls.slice() : [],
  }));
  let alb = next.find((a) => a.id === albumId) || next[0];
  if (!alb) {
    alb = { id: 'recent-work', name: 'Recent work', urls: [] };
    next.push(alb);
  }
  list.forEach((u) => {
    if (!alb.urls.includes(u)) alb.urls.push(u);
  });
  if (list.length) alb.userCleared = false;
  return next;
}

/**
 * Bug reproduction: pushing orphans into flat list BEFORE addUrls, then
 * balancing across buckets, scatters a targeted upload.
 */
export function buggyScatterThenAdd(albums, urls, albumId) {
  const orphans = urls.slice();
  const scattered = albums.map((a) => ({ ...a, urls: (a.urls || []).slice() }));
  orphans.forEach((u) => {
    let best = scattered[0];
    for (let i = 1; i < scattered.length; i++) {
      if ((scattered[i].urls || []).length < (best.urls || []).length) best = scattered[i];
    }
    best.urls.push(u);
  });
  return addUrlsToAlbum(scattered, urls, albumId);
}

export function flattenAlbumUrls(albums) {
  const seen = new Set();
  const flat = [];
  (albums || []).forEach((a) => {
    (a.urls || []).forEach((u) => {
      if (!u || seen.has(u)) return;
      seen.add(u);
      flat.push(u);
    });
  });
  return flat;
}

/** Collect data: URLs that must be hosted before slim/save strips them. */
export function collectPortfolioDataUrls({ portfolioUrls, galleryAlbums, galleryPairs, bannerUrl }) {
  const seen = new Set();
  const out = [];
  const push = (u) => {
    const s = String(u || '');
    if (!s.startsWith('data:') || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  (portfolioUrls || []).forEach(push);
  (galleryAlbums || []).forEach((a) => (a.urls || []).forEach(push));
  (galleryPairs || []).forEach((p) => {
    push(p?.before);
    push(p?.after);
  });
  push(bannerUrl);
  return out;
}

export function remapPortfolioUrls(state, map) {
  const remap = (u) => (map.has(u) ? map.get(u) : u);
  return {
    portfolioUrls: (state.portfolioUrls || []).map(remap),
    galleryAlbums: (state.galleryAlbums || []).map((a) => ({
      ...a,
      urls: (a.urls || []).map(remap),
    })),
    bannerUrl: state.bannerUrl ? remap(state.bannerUrl) : state.bannerUrl,
  };
}

export function isLikelyImageFile(f) {
  if (!f) return false;
  const t = String(f.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i.test(String(f.name || ''));
}
