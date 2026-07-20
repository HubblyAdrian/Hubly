import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  mapImportedPackageToDraft,
  ownerHasNamedPackages,
  promotePkgDraftToServices,
  resolveBuildPackages,
  shouldKeepOwnerPackages,
  shouldSeedServices,
} from '../scripts/lib/owner-packages-keep.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hublySrc = readFileSync(join(root, 'public/hubly.html'), 'utf8');

describe('ownerHasNamedPackages', () => {
  it('detects services, editorSvcs, and pkgDraft', () => {
    assert.equal(ownerHasNamedPackages({ services: [], editorSvcs: [], _is: { pkgDraft: [] } }), false);
    assert.equal(ownerHasNamedPackages({ services: [{ name: 'Interior' }] }), true);
    assert.equal(ownerHasNamedPackages({ editorSvcs: [{ name: 'Ceramic' }] }), true);
    assert.equal(ownerHasNamedPackages({ _is: { pkgDraft: [{ name: 'Full Detail' }] } }), true);
    assert.equal(ownerHasNamedPackages({ services: [{ name: '  ' }] }), false);
  });
});

describe('shouldKeepOwnerPackages / shouldSeedServices', () => {
  it('keeps named packages regardless of servicesMode', () => {
    const S = { services: [{ name: 'Mobile Wash' }], _is: { servicesMode: '' } };
    assert.equal(shouldKeepOwnerPackages(S), true);
    assert.equal(shouldSeedServices({ seedServices: !true, keepOwner: true }), false);
  });

  it('seeds when empty', () => {
    const S = { services: [], editorSvcs: [], _is: { pkgDraft: [], servicesMode: 'later' } };
    assert.equal(shouldKeepOwnerPackages(S), false);
    assert.equal(shouldSeedServices({ seedServices: undefined, keepOwner: false }), true);
  });

  it('honors explicit seedServices false even if empty', () => {
    assert.equal(shouldSeedServices({ seedServices: false, keepOwner: false }), false);
  });
});

describe('promotePkgDraftToServices', () => {
  it('promotes imported pkgDraft into services', () => {
    const { promoted, S } = promotePkgDraftToServices({
      services: [],
      _is: {
        servicesMode: 'import',
        pkgDraft: [
          { name: 'Express Interior', price: '149', dur: '1.5', desc: 'Vacuum + wipe' },
          { name: 'Full Detail', price: '299', dur: '4', includes: 'Wash\nWax' },
        ],
      },
    });
    assert.equal(promoted, true);
    assert.equal(S.services.length, 2);
    assert.equal(S.services[0].name, 'Express Interior');
    assert.equal(S.services[0].price, 149);
    assert.equal(S.services[1].includesList.length, 2);
    assert.equal(S._is.servicesMode, 'now');
  });

  it('does not overwrite existing services', () => {
    const { promoted, S } = promotePkgDraftToServices({
      services: [{ name: 'Keep Me', price: 1 }],
      _is: { pkgDraft: [{ name: 'Ignore', price: '99' }] },
    });
    assert.equal(promoted, true);
    assert.equal(S.services[0].name, 'Keep Me');
  });
});

describe('resolveBuildPackages (import → build regression)', () => {
  it('keeps imported packages instead of blueprint starters', () => {
    const result = resolveBuildPackages({
      services: [],
      editorSvcs: [],
      _is: {
        servicesMode: 'import',
        pkgDraft: [
          { name: 'Stage 1 Polish', price: '450' },
          { name: 'Maintenance Detail', price: '220' },
        ],
      },
    });
    assert.equal(result.keep, true);
    assert.equal(result.seed, false);
    assert.equal(result.promoted, true);
    assert.deepEqual(
      result.services.map((s) => s.name),
      ['Stage 1 Polish', 'Maintenance Detail']
    );
  });

  it('seeds starters when owner chose later with no packages', () => {
    const result = resolveBuildPackages({
      services: [],
      editorSvcs: [],
      _is: { servicesMode: 'later', pkgDraft: [] },
    });
    assert.equal(result.keep, false);
    assert.equal(result.seed, true);
    assert.equal(result.services[0].name, 'Starter Wash');
  });
});

describe('mapImportedPackageToDraft', () => {
  it('maps flat and vehicle pricing', () => {
    const flat = mapImportedPackageToDraft({ name: 'Hand Wash', price: 89, dur: 2 }, 0);
    assert.equal(flat.name, 'Hand Wash');
    assert.equal(flat.pricingType, 'flat');
    assert.equal(flat.popular, true);

    const vehicle = mapImportedPackageToDraft(
      {
        name: 'Interior',
        pricingType: 'vehicle',
        varPrices: { sedan: 120, suv: 160 },
        includes: ['Vacuum', 'Wipe'],
      },
      1
    );
    assert.equal(vehicle.pricingType, 'variable');
    assert.equal(vehicle.price, '120');
    assert.match(vehicle.includes, /Vacuum/);
    assert.equal(vehicle.popular, false);
  });
});

describe('hubly.html wiring', () => {
  it('keeps owner packages during Instant Site build', () => {
    assert.match(hublySrc, /function shouldKeepOwnerPackages\s*\(/);
    assert.match(hublySrc, /function promotePkgDraftToServicesIfNeeded\s*\(/);
    assert.match(hublySrc, /promotePkgDraftToServicesIfNeeded\(\)/);
    assert.match(hublySrc, /seedServices:!keepOwnerPkgs/);
    assert.match(hublySrc, /Keeping your packages/);
  });

  it('awaits FileReader before extract and supports post-setup Import', () => {
    assert.match(hublySrc, /importOffersState\.filesReady/);
    assert.match(hublySrc, /await importOffersState\.filesReady/);
    assert.match(hublySrc, /openImportOffersModal\('pkg-hub'\)/);
    assert.match(hublySrc, /openImportOffersModal\('svc-editor'\)/);
    assert.match(hublySrc, /src==='pkg-hub'\|\|src==='svc-editor'/);
  });

  it('sets Instant Site servicesMode to import on apply', () => {
    assert.match(hublySrc, /S\._is\.servicesMode='import'/);
  });
});
