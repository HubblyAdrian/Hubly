import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_dna_knowledge.ts")],
  outfile: path.join(root, "scripts/lib/dna-knowledge.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  banner: {
    js: "/** Node mirror of hubly_brain_dna_knowledge.ts — Section 7/15 (esbuild). */\n",
  },
});

console.log("dna-knowledge.mjs built");
