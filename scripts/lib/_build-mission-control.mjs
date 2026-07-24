import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const plugin = {
  name: 'external-shared',
  setup(build) {
    const map = {
      'hubly_brain_registries.ts': './registries.mjs',
      'hubly_brain_expert_framework.ts': './expert-framework.mjs',
      'hubly_brain_reliability.ts': './reliability.mjs',
      'hubly_brain_platform.ts': './platform.mjs',
      'hubly_brain_dna_knowledge.ts': './dna-knowledge.mjs',
      'hubly_brain_quality.ts': './quality-core.mjs',
      'hubly_brain_docs.ts': './docs.mjs',
    };
    for (const [file, ext] of Object.entries(map)) {
      const re = new RegExp(file.replace(/\./g, '\\.') + '$');
      build.onResolve({ filter: re }, () => ({ path: ext, external: true }));
    }
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
    js: '/** Node mirror of hubly_brain_mission_control.ts — Sections 12/14/15/16/17 (esbuild). */\n',
  },
});

console.log('mission-control.mjs built');
