import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const plugin = {
  name: "external-change-plan-deps",
  setup(build) {
    build.onResolve({ filter: /hubly_brain_builder_intent\.ts$/ }, () => ({
      path: "./builder-intent.mjs",
      external: true,
    }));
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_change_plan.ts")],
  outfile: path.join(root, "scripts/lib/change-plan.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  plugins: [plugin],
  banner: {
    js: "/** Node mirror of hubly_brain_change_plan.ts — Milestone 1.5 Epic 2 (esbuild). */\n",
  },
});

console.log("change-plan.mjs built");
