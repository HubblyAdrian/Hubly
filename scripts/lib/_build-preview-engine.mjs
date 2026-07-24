import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const plugin = {
  name: "external-preview-engine-deps",
  setup(build) {
    build.onResolve({ filter: /hubly_brain_change_plan\.ts$/ }, () => ({
      path: "./change-plan.mjs",
      external: true,
    }));
    build.onResolve({ filter: /hubly_brain_builder_intent\.ts$/ }, () => ({
      path: "./builder-intent.mjs",
      external: true,
    }));
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_preview_engine.ts")],
  outfile: path.join(root, "scripts/lib/preview-engine.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  plugins: [plugin],
  banner: {
    js: "/** Node mirror of hubly_brain_preview_engine.ts — Milestone 1.5 Epic 3 (esbuild). */\n",
  },
});

console.log("preview-engine.mjs built");
