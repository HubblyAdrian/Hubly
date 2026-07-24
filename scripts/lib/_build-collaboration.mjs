import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const plugin = {
  name: "external-collaboration-deps",
  setup(build) {
    build.onResolve({ filter: /hubly_brain_preview_engine\.ts$/ }, () => ({
      path: "./preview-engine.mjs",
      external: true,
    }));
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
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_collaboration.ts")],
  outfile: path.join(root, "scripts/lib/collaboration.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  plugins: [plugin],
  banner: {
    js: "/** Node mirror of hubly_brain_collaboration.ts — Milestone 1.5 Epic 4 (esbuild). */\n",
  },
});

console.log("collaboration.mjs built");
