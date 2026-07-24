import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_identity_system.ts")],
  outfile: path.join(root, "scripts/lib/identity-system.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  banner: {
    js: "/** Node mirror of hubly_brain_identity_system.ts — Section 13 (esbuild). */\n",
  },
});

console.log("identity-system.mjs built");
