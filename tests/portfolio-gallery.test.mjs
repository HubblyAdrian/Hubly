import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  addUrlsToAlbum,
  buggyScatterThenAdd,
  collectPortfolioDataUrls,
  flattenAlbumUrls,
  isLikelyImageFile,
  mergePriorHttpsGallery,
  remapPortfolioUrls,
  shouldForceBizHero,
  shouldSkipAiCopyRegen,
} from '../scripts/lib/portfolio-gallery-keep.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hublySrc = readFileSync(join(root, 'public/hubly.html'), 'utf8');

const buckets = () => [
  { id: 'interior', name: 'Interior', urls: [] },
  { id: 'exterior', name: 'Exterior', urls: [] },
  { id: 'wax-sealant', name: 'Wax & Sealant', urls: [] },
];

describe('addUrlsToAlbum (targeted bucket)', () => {
  it('puts all 7 photos in Wax & Sealant only', () => {
    const urls = Array.from({ length: 7 }, (_, i) => `data:image/jpeg;base64,PHOTO${i}`);
    const next = addUrlsToAlbum(buckets(), urls, 'wax-sealant');
    const wax = next.find((a) => a.id === 'wax-sealant');
    assert.equal(wax.urls.length, 7);
    assert.equal(next.find((a) => a.id === 'interior').urls.length, 0);
    assert.equal(flattenAlbumUrls(next).length, 7);
  });

  it('legacy scatter-then-add wrongly fills other buckets', () => {
    const urls = Array.from({ length: 7 }, (_, i) => `https://cdn.example/${i}.jpg`);
    const scattered = buggyScatterThenAdd(buckets(), urls, 'wax-sealant');
    const otherFilled = scattered
      .filter((a) => a.id !== 'wax-sealant')
      .some((a) => (a.urls || []).length > 0);
    assert.equal(otherFilled, true);
    // Fix path does not scatter:
    const fixed = addUrlsToAlbum(buckets(), urls, 'wax-sealant');
    assert.equal(
      fixed.filter((a) => a.id !== 'wax-sealant').every((a) => !(a.urls || []).length),
      true
    );
  });
});

describe('host portfolio data URLs', () => {
  it('collects data URLs from albums and flat list', () => {
    const collected = collectPortfolioDataUrls({
      portfolioUrls: ['data:image/jpeg;base64,A', 'https://cdn.example/ok.jpg'],
      galleryAlbums: [{ id: 'wax', urls: ['data:image/jpeg;base64,B', 'data:image/jpeg;base64,A'] }],
      galleryPairs: [],
      bannerUrl: 'data:image/jpeg;base64,C',
    });
    assert.deepEqual(collected.sort(), [
      'data:image/jpeg;base64,A',
      'data:image/jpeg;base64,B',
      'data:image/jpeg;base64,C',
    ]);
  });

  it('remaps albums after hosting', () => {
    const map = new Map([
      ['data:image/jpeg;base64,A', 'https://cdn.example/a.jpg'],
      ['data:image/jpeg;base64,B', 'https://cdn.example/b.jpg'],
    ]);
    const next = remapPortfolioUrls(
      {
        portfolioUrls: ['data:image/jpeg;base64,A'],
        galleryAlbums: [{ id: 'wax', urls: ['data:image/jpeg;base64,A', 'data:image/jpeg;base64,B'] }],
        bannerUrl: 'data:image/jpeg;base64,A',
      },
      map
    );
    assert.equal(next.portfolioUrls[0], 'https://cdn.example/a.jpg');
    assert.deepEqual(next.galleryAlbums[0].urls, [
      'https://cdn.example/a.jpg',
      'https://cdn.example/b.jpg',
    ]);
    assert.equal(next.bannerUrl, 'https://cdn.example/a.jpg');
  });
});

describe('isLikelyImageFile', () => {
  it('accepts HEIC / missing MIME by extension', () => {
    assert.equal(isLikelyImageFile({ type: '', name: 'IMG_1234.HEIC' }), true);
    assert.equal(isLikelyImageFile({ type: 'image/jpeg', name: 'a.jpg' }), true);
    assert.equal(isLikelyImageFile({ type: '', name: 'notes.pdf' }), false);
  });
});

describe('persist across refresh', () => {
  it('restores prior https gallery when slim emptied current', () => {
    const prior = {
      ownerUploadedMedia: true,
      portfolioUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
      website: {
        galleryAlbums: [{ id: 'wax', name: 'Wax', urls: ['https://cdn.example/a.jpg'] }],
        heroHeadline: 'Showroom clean',
        customHeroHeadline: true,
      },
    };
    const emptied = {
      portfolioUrls: [],
      website: { galleryAlbums: [{ id: 'wax', name: 'Wax', urls: [] }], heroHeadline: 'Showroom clean', customHeroHeadline: true },
    };
    const merged = mergePriorHttpsGallery(emptied, prior, true);
    assert.equal(merged.portfolioUrls.length, 2);
    assert.equal(merged.website.galleryAlbums[0].urls[0], 'https://cdn.example/a.jpg');
    assert.equal(merged.ownerUploadedMedia, true);
  });

  it('skips AI regen when owner writing exists', () => {
    assert.equal(shouldSkipAiCopyRegen({ customHeroHeadline: true, heroHeadline: 'Hi' }), true);
    assert.equal(shouldSkipAiCopyRegen({ ownerBio: 'We detail cars in Bakersfield.' }), true);
    assert.equal(shouldSkipAiCopyRegen({}), false);
  });

  it('does not force biz hero over custom copy', () => {
    assert.equal(shouldForceBizHero({ force: true, isCustom: true, bizOk: true }), false);
    assert.equal(shouldForceBizHero({ force: true, isCustom: false, bizOk: true }), true);
  });
});

describe('hubly.html wiring', () => {
  it('hosts portfolio before save/onboard slim', () => {
    assert.match(hublySrc, /async function hostPortfolioDataUrls\s*\(/);
    assert.match(hublySrc, /await hostPortfolioDataUrls\(\)/);
    assert.match(hublySrc, /saveStorefront host portfolio/);
    assert.match(hublySrc, /completeOnboard host portfolio/);
  });

  it('editor upload targets album without orphan scatter + uses isLikelyImageFile', () => {
    assert.match(hublySrc, /async function handleEdPortfolio\s*\(/);
    assert.match(hublySrc, /isLikelyImageFile/);
    assert.match(
      hublySrc,
      /do NOT push orphans into portfolioUrls[\s\S]{0,80}addUrlsToGalleryAlbum\(urls,albumId\)/
    );
  });

  it('editor preview can scroll past profile sheet / Portfolio', () => {
    assert.match(hublySrc, /min-height:0!important;height:100%;max-height:100%/);
    assert.match(hublySrc, /overflow-y:auto!important/);
    assert.match(
      hublySrc,
      /\.ed-shell\.ed-canvas-mode:not\(\.ed-sheet-open\)[\s\S]{0,120}overflow:visible!important/
    );
  });

  it('Save & publish shows busy state and cannot hang forever on mobile', () => {
    assert.match(hublySrc, /S\._saveStorefrontBusy/);
    assert.match(hublySrc, /Publishing…/);
    assert.match(hublySrc, /Uploading photos/);
    assert.match(hublySrc, /timeoutMs/);
    assert.match(hublySrc, /Never POST megabyte data:image/);
    assert.match(hublySrc, /\.btn-save-main\{[^}]*touch-action:manipulation/);
    assert.match(hublySrc, /\.ed-top-actions \.btn-save-main\{[^}]*flex:1 1 100%/);
  });

  it('keeps writing + portfolio across Save/refresh', () => {
    assert.match(hublySrc, /ownerUploadedMedia/);
    assert.match(hublySrc, /mergePriorHttpsGalleryIntoMeta/);
    assert.match(hublySrc, /Never clobber owner-custom headlines/);
    assert.match(hublySrc, /hasOwnerCopy/);
    assert.match(hublySrc, /updates\.gen_hero_headline=S\.website\.heroHeadline/);
    assert.match(hublySrc, /Pull Writing-sheet fields/);
  });
});
