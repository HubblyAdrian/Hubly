import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Hubly Create foundation', () => {
  it('ships Create module architecture files', () => {
    const files = [
      'modules/create/types/index.ts',
      'modules/create/state/createSession.ts',
      'modules/create/state/websiteState.ts',
      'modules/create/services/createEngine.ts',
      'modules/create/services/openaiCreateClient.ts',
      'modules/create/components/WebsiteCanvas.tsx',
      'modules/create/pages/CreatePage.tsx',
      'api/create-chat.js',
      'docs/CREATE_ENGINE.md',
      'public/create/index.html',
    ];
    files.forEach((f) => assert.ok(existsSync(join(root, f)), f));
  });

  it('routes /create and create-chat API', () => {
    const router = readFileSync(join(root, 'api/router.js'), 'utf8');
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8');
    assert.match(router, /urlPath === '\/create'/);
    assert.match(router, /public\/create\/index\.html/);
    assert.match(router, /urlPath\.startsWith\('\/create\/'\)/);
    assert.match(vercel, /\/api\/create-chat\$/);
  });

  it('CreateEngine owns logic; OpenAI Responses API is used', () => {
    const engine = readFileSync(join(root, 'modules/create/services/createEngine.ts'), 'utf8');
    const api = readFileSync(join(root, 'api/create-chat.js'), 'utf8');
    const client = readFileSync(join(root, 'modules/create/services/openaiCreateClient.ts'), 'utf8');
    assert.match(engine, /class CreateEngine/);
    assert.match(engine, /updateWebsiteState/);
    assert.match(api, /api\.openai\.com\/v1\/responses/);
    assert.match(api, /stream:\s*true/);
    assert.match(api, /not_configured/);
    assert.match(client, /\/api\/create-chat/);
    assert.doesNotMatch(client, /api\.openai\.com/);
  });

  it('WebsiteState and CreateSession shapes exist', () => {
    const types = readFileSync(join(root, 'modules/create/types/index.ts'), 'utf8');
    const session = readFileSync(join(root, 'modules/create/state/createSession.ts'), 'utf8');
    const website = readFileSync(join(root, 'modules/create/state/websiteState.ts'), 'utf8');
    assert.match(types, /export interface CreateSession/);
    assert.match(types, /export interface WebsiteState/);
    assert.match(types, /brand/);
    assert.match(types, /navigation/);
    assert.match(types, /products/);
    assert.match(types, /collections/);
    assert.match(session, /sessionId/);
    assert.match(session, /websiteState/);
    assert.match(website, /createEmptyWebsiteState/);
  });

  it('marketing Get Started / Build CTAs enter /create not Blueprint signup', () => {
    const home = readFileSync(join(root, 'public/platform-home.html'), 'utf8');
    assert.match(home, /ind-build-btn">Get Started/);
    assert.match(home, /href="\/create"/);
    assert.doesNotMatch(home, /ind-build" href="\/signup"/);
    const createHtml = readFileSync(join(root, 'public/create/index.html'), 'utf8');
    assert.match(createHtml, /Hubly · Create/);
    assert.doesNotMatch(createHtml, /blueprint/i);
  });

  it('WebsiteCanvas is a permanent component mounted from CreatePage', () => {
    const page = readFileSync(join(root, 'modules/create/pages/CreatePage.tsx'), 'utf8');
    const canvas = readFileSync(join(root, 'modules/create/components/WebsiteCanvas.tsx'), 'utf8');
    assert.match(page, /<WebsiteCanvas/);
    assert.match(canvas, /export function WebsiteCanvas/);
    assert.match(canvas, /websiteState/);
  });
});
