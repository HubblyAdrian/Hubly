import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const plugin = {
  name: 'alias-shared',
  setup(build) {
    build.onResolve({ filter: /hubly_brain_registries\.ts$/ }, () => ({
      path: path.join(root, 'scripts/lib/registries.mjs'),
    }));
    build.onResolve({ filter: /hubly_brain_expert_framework\.ts$/ }, () => ({
      path: path.join(root, 'scripts/lib/expert-framework.mjs'),
    }));
    build.onResolve({ filter: /hubly_brain_reliability\.ts$/ }, () => ({
      path: path.join(root, 'scripts/lib/reliability.mjs'),
    }));
  },
};

await esbuild.build({
  entryPoints: [path.join(root, 'supabase/functions/_shared/hubly_brain_mission_control.ts')],
  outfile: path.join(root, 'scripts/lib/mission-control.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  plugins: [plugin],
  banner: {
    js: '/** Node mirror of hubly_brain_mission_control.ts — Section 12 + 14 (esbuild). */\n',
  },
});

console.log('mission-control.mjs built');
