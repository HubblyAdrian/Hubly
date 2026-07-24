import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const plugin = {
  name: "external-experience-layer-deps",
  setup(build) {
    for (const [re, ext] of [
      [/hubly_brain_identity_system\.ts$/, "./identity-system.mjs"],
      [/hubly_brain_personality\.ts$/, "./personality.mjs"],
    ]) {
      build.onResolve({ filter: re }, () => ({ path: ext, external: true }));
    }
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_experience_layer.ts")],
  outfile: path.join(root, "scripts/lib/experience-layer.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  plugins: [plugin],
  banner: {
    js: "/** Node mirror of hubly_brain_experience_layer.ts — Milestone 2 Epic 0 (esbuild). */\n",
  },
});

console.log("experience-layer.mjs built");
