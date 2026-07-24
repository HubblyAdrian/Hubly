import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const plugin = {
  name: "alias-identity",
  setup(build) {
    build.onResolve({ filter: /hubly_brain_identity_system\.ts$/ }, () => ({
      path: path.join(root, "scripts/lib/identity-system.mjs"),
      external: true,
    }));
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_personality.ts")],
  outfile: path.join(root, "scripts/lib/personality.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  plugins: [plugin],
  banner: {
    js: "/** Node mirror of hubly_brain_personality.ts — Milestone 2 Epic 0 (esbuild). */\n",
  },
});

console.log("personality.mjs built");
