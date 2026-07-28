/**
 * Adobe Lightroom OAuth — production wiring smoke tests.
 * Asserts env-only credentials, Edge Functions, migration, client redirect flow.
 * Never asserts hardcoded secrets.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Adobe Lightroom OAuth', () => {
  it('ships token vault + oauth state migration (RLS on, no client policies)', () => {
    const mig = join(root, 'supabase/migrations/20260728080000_adobe_lightroom_oauth.sql');
    assert.equal(existsSync(mig), true);
    const sql = read('supabase/migrations/20260728080000_adobe_lightroom_oauth.sql');
    assert.match(sql, /adobe_lightroom_connections/);
    assert.match(sql, /adobe_oauth_states/);
    assert.match(sql, /refresh_token/);
    assert.match(sql, /access_token/);
    assert.match(sql, /enable row level security/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.match(sql, /Never expose/i);
  });

  it('reads Adobe credentials only from Deno.env', () => {
    const oauth = read('supabase/functions/_shared/adobe_oauth.ts');
    assert.match(oauth, /Deno\.env\.get\("ADOBE_CLIENT_ID"\)/);
    assert.match(oauth, /Deno\.env\.get\("ADOBE_CLIENT_SECRET"\)/);
    assert.match(oauth, /adobeAuthorizeUrl/);
    assert.match(oauth, /exchangeAdobeAuthCode/);
    assert.match(oauth, /refreshAdobeAccessToken/);
    assert.match(oauth, /ims-na1\.adobelogin\.com/);
    assert.match(oauth, /offline_access/);
    // No hardcoded client secrets / API keys
    assert.doesNotMatch(oauth, /client_secret\s*[:=]\s*["'][A-Za-z0-9]{8,}/);
    assert.doesNotMatch(oauth, /ADOBE_CLIENT_SECRET\s*=\s*["'][^"']+["']/);
  });

  it('ships start / callback / disconnect / refresh Edge Functions', () => {
    const start = join(root, 'supabase/functions/adobe-oauth-start/index.ts');
    const cb = join(root, 'supabase/functions/adobe-oauth-callback/index.ts');
    const disc = join(root, 'supabase/functions/adobe-oauth-disconnect/index.ts');
    const refresh = join(root, 'supabase/functions/adobe-oauth-refresh/index.ts');
    assert.equal(existsSync(start), true);
    assert.equal(existsSync(cb), true);
    assert.equal(existsSync(disc), true);
    assert.equal(existsSync(refresh), true);

    const startSrc = read('supabase/functions/adobe-oauth-start/index.ts');
    assert.match(startSrc, /adobe_oauth_states/);
    assert.match(startSrc, /PROVIDER_NOT_CONFIGURED/);
    assert.match(startSrc, /hubly_app_connections/);

    const cbSrc = read('supabase/functions/adobe-oauth-callback/index.ts');
    assert.match(cbSrc, /adobe_oauth:\s*"connected"/);
    assert.match(cbSrc, /adobe_lightroom_connections/);
    assert.match(cbSrc, /exchangeAdobeAuthCode/);
    assert.doesNotMatch(cbSrc, /access_token.*searchParams|searchParams.*access_token/);

    const discSrc = read('supabase/functions/adobe-oauth-disconnect/index.ts');
    assert.match(discSrc, /action === "status"/);
    assert.match(discSrc, /Never return tokens/);
    assert.match(discSrc, /revokeAdobeToken/);
  });

  it('disables JWT verify on adobe-oauth-callback (Adobe redirect)', () => {
    const cfg = read('supabase/config.toml');
    assert.match(cfg, /\[functions\.adobe-oauth-callback\]/);
    assert.match(cfg, /adobe-oauth-callback\][\s\S]*?verify_jwt\s*=\s*false/);
  });

  it('provider no longer reports ADOBE_OAUTH_NOT_IMPLEMENTED for connect', () => {
    const adobe = read('supabase/functions/_shared/hubly_provider_lightroom.ts');
    assert.doesNotMatch(adobe, /ADOBE_OAUTH_NOT_IMPLEMENTED/);
    assert.match(adobe, /adobe-oauth-start/);
    assert.match(adobe, /ADOBE_CLIENT_ID/);
    assert.match(adobe, /ADOBE_CLIENT_SECRET/);
  });

  it('client navigates to authorize URL and never embeds secrets', () => {
    const client = read('public/journey-os/adobe-lightroom-service.js');
    assert.match(client, /adobe-oauth-start/);
    assert.match(client, /adobe-oauth-disconnect/);
    assert.match(client, /adobe-oauth-refresh/);
    assert.match(client, /authorizeUrl/);
    assert.match(client, /connectAndRedirect/);
    assert.match(client, /location\.href/);
    assert.doesNotMatch(client, /ADOBE_CLIENT_SECRET\s*[:=]\s*["']/);
    assert.doesNotMatch(client, /client_secret\s*[:=]\s*["']/i);

    const projects = read('public/journey-os/photography-projects.js');
    assert.match(projects, /adobe-connect/);
    assert.match(projects, /connectAndRedirect|authorizeUrl/);
    assert.doesNotMatch(projects, /Adobe workspace will unlink when OAuth is wired/);
  });

  it('hubly.html consumes adobe_oauth return query params', () => {
    const html = read('public/hubly.html');
    assert.match(html, /function consumeAdobeOauthReturn/);
    assert.match(html, /consumeAdobeOauthReturn\(\)/);
    assert.match(html, /adobe_oauth/);
    assert.match(html, /adobe_msg/);
    assert.match(html, /adobe-lightroom-service\.js/);
  });

  it('Edge Function sources do not hardcode Adobe credentials', () => {
    const dirs = [
      'supabase/functions/adobe-oauth-start',
      'supabase/functions/adobe-oauth-callback',
      'supabase/functions/adobe-oauth-disconnect',
      'supabase/functions/adobe-oauth-refresh',
      'supabase/functions/_shared',
    ];
    for (const dir of dirs) {
      const full = join(root, dir);
      if (!existsSync(full)) continue;
      for (const name of readdirSync(full)) {
        if (!name.endsWith('.ts') && !name.endsWith('.js')) continue;
        if (!name.includes('adobe') && dir !== 'supabase/functions/_shared') continue;
        if (dir === 'supabase/functions/_shared' && !name.includes('adobe') && name !== 'hubly_provider_lightroom.ts') {
          continue;
        }
        const src = readFileSync(join(full, name), 'utf8');
        assert.doesNotMatch(
          src,
          /ADOBE_CLIENT_(ID|SECRET)\s*=\s*["'][^"']{6,}["']/,
          `${dir}/${name} must not hardcode Adobe credentials`,
        );
      }
    }
  });
});
