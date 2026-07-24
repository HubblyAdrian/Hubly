import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const plugin = {
  name: "external-deployment-deps",
  setup(build) {
    for (const [re, ext] of [
      [/hubly_brain_change_plan\.ts$/, "./change-plan.mjs"],
      [/hubly_brain_collaboration\.ts$/, "./collaboration.mjs"],
      [/hubly_brain_preview_engine\.ts$/, "./preview-engine.mjs"],
      [/hubly_brain_version_engine\.ts$/, "./version-engine.mjs"],
      [/hubly_brain_builder_intent\.ts$/, "./builder-intent.mjs"],
    ]) {
      build.onResolve({ filter: re }, () => ({ path: ext, external: true }));
    }
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_business_deployment.ts")],
  outfile: path.join(root, "scripts/lib/business-deployment.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  plugins: [plugin],
  banner: {
    js: "/** Node mirror of hubly_brain_business_deployment.ts — Milestone 1.5 Epic 12 (esbuild). */\n",
  },
});

console.log("business-deployment.mjs built");
