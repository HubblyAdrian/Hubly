import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const plugin = {
  name: "external-builder-expert-deps",
  setup(build) {
    const map = {
      "hubly_brain_expert_framework.ts": "./expert-framework.mjs",
      "hubly_brain_builder_intent.ts": "./builder-intent.mjs",
      "hubly_brain_registries.ts": "./registries.mjs",
    };
    for (const [file, ext] of Object.entries(map)) {
      const re = new RegExp(file.replace(/\./g, "\\.") + "$");
      build.onResolve({ filter: re }, () => ({ path: ext, external: true }));
    }
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_builder_expert.ts")],
  outfile: path.join(root, "scripts/lib/builder-expert.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  plugins: [plugin],
  banner: {
    js: "/** Node mirror of hubly_brain_builder_expert.ts — Milestone 1.5 Epic 1 (esbuild). */\n",
  },
});

console.log("builder-expert.mjs built");
