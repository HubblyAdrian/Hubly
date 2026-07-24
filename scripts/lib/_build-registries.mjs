import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_registries.ts")],
  outfile: path.join(root, "scripts/lib/registries.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  banner: {
    js: "/** Node mirror of hubly_brain_registries.ts — Section 11/15 (esbuild). */\n",
  },
});

console.log("registries.mjs built");
