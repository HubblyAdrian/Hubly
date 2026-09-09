/** Deno half: needs the registry's own inserter, so it cannot run under Node. */
import { addServicesBlock } from "../../supabase/functions/_shared/hubly_services_block.ts";
const D = Deno.args[0];                      // a json file of {slug, html}
const OUT = Deno.args[1];
const pages = JSON.parse(await Deno.readTextFile(D));
const SV = [{ name: "Full Detail", price: 180 }, { name: "Express Wash", price: 60, description: "A quick outside clean." }];
const out: unknown[] = [];
for (const p of pages) {
  if (/data-hubly-contact-block/i.test(p.html)) {
    out.push({ slug: p.slug, kind: "contact", mode: "existing", selector: "[data-hubly-contact-block]", html: p.html });
  }
  if (/data-hubly-service|data-hubly-section="services"/i.test(p.html)) continue;
  const r = addServicesBlock(p.html, SV, "#c2410c") as { changed: boolean; html: string; detail?: string };
  if (!r.changed) continue;
  out.push({ slug: p.slug, kind: "services", mode: r.detail ?? "?", selector: "[data-hubly-services-block]", html: r.html });
}
await Deno.writeTextFile(OUT, JSON.stringify(out));
console.log(`corpus: ${out.length} blocks`);
