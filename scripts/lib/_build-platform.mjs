import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const plugin = {
  name: "external-platform-deps",
  setup(build) {
    const map = {
      "hubly_brain_expert_framework.ts": "./expert-framework.mjs",
      "hubly_brain_registries.ts": "./registries.mjs",
      "hubly_brain_dna_knowledge.ts": "./dna-knowledge.mjs",
      "hubly_brain_reliability.ts": "./reliability.mjs",
    };
    for (const [file, ext] of Object.entries(map)) {
      const re = new RegExp(file.replace(/\./g, "\\.") + "$");
      build.onResolve({ filter: re }, () => ({ path: ext, external: true }));
    }
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_platform.ts")],
  outfile: path.join(root, "scripts/lib/platform.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  plugins: [plugin],
  banner: {
    js: "/** Node mirror of hubly_brain_platform.ts — Section 15 (esbuild). */\n",
  },
});

console.log("platform.mjs built");
