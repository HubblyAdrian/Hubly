import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const plugin = {
  name: "external-chat-os-deps",
  setup(build) {
    for (const [re, ext] of [
      [/hubly_brain_change_plan\.ts$/, "./change-plan.mjs"],
      [/hubly_brain_builder_intent\.ts$/, "./builder-intent.mjs"],
      [/hubly_brain_personality\.ts$/, "./personality.mjs"],
      [/hubly_brain_identity_system\.ts$/, "./identity-system.mjs"],
    ]) {
      build.onResolve({ filter: re }, () => ({ path: ext, external: true }));
    }
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "supabase/functions/_shared/hubly_brain_chat_os.ts")],
  outfile: path.join(root, "scripts/lib/chat-os.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  plugins: [plugin],
  banner: {
    js: "/** Node mirror of hubly_brain_chat_os.ts — Milestone 1.5 Epic 11 (esbuild). */\n",
  },
});

console.log("chat-os.mjs built");
