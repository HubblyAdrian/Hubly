/**
 * EVERY SENTENCE AN OWNER READS VERBATIM LIVES HERE.
 *
 * hubly-conversation composes the reply as
 *   primaryReply = photoTruth || servicesTruth || contactHoursTruth || …
 * so those strings are not summaries a model reworks — they are handed to a person
 * word for word.
 *
 * WHY A MODULE AND NOT A LONGER PHRASE LIST. The first guard against model directives
 * leaking into that channel was a blocklist: "say that plainly", "do not claim", and so
 * on. It caught three live leaks and it will never catch "be honest that…", "avoid
 * claiming…", "make clear that…". That is enumerate-the-harmless-side — a list of the
 * forms we have already been burned by, which undercounts every single time.
 *
 * The structural version: ONE module owns the strings, and
 * scripts/check-no-directives-to-owners.mjs asserts that nothing outside it produces a
 * string reaching primaryReply. Then a future leak is not a phrase we failed to predict.
 * It is a string in the wrong file, which a check can see with certainty.
 *
 * THE RULE FOR EVERY SENTENCE IN THIS FILE:
 *   - it is spoken TO the owner, never ABOUT what the model should say
 *   - it claims the page only when the value was verified in the rendered bytes
 *     (Lesson 11), and claims the record otherwise
 *   - it offers no action that no capability can perform
 */

export type PhotoPlacementLike = {
  status?: string;
  where?: string;
  verified?: boolean;
};

/** The owner uploaded a photo of their own work. */
export function photoReply(p: PhotoPlacementLike): string {
  const landed = (p.status === "placed" || p.status === "swapped") && p.verified === true;
  if (landed) {
    return p.status === "swapped"
      ? `That's on your page now — in the ${p.where || "page"}, in place of the stock photo that was there. If you'd rather keep the old one, just say so.`
      : `That's on your page now, in the ${p.where || "work section"}.`;
  }
  if (p.status === "no_slot") {
    return `I've saved that photo. There's no open spot for it on the page as it's built, so it isn't showing yet — I can rebuild the page around it if you'd like.`;
  }
  if (p.status === "placed" || p.status === "swapped") {
    // The writer said it landed and the bytes disagree. Say the weaker, true thing.
    return `I've saved that photo, but it didn't make it onto the page — it isn't showing yet. I can try again, or rebuild the page around it.`;
  }
  return `I've saved that photo, but I couldn't place it on the page just now, so it isn't showing. I can try again, or rebuild the page around it.`;
}

/** A services list was added to a page that had none.
 *
 *  "SERVICES AREA" IS BANNED IN OWNER-FACING TEXT. The generated page uses that phrase for
 *  GEOGRAPHY — toms-gutters-more has a section headed "SERVICE AREA — Serving Murray" — so
 *  asking an owner whether to add gutter cleaning at $180 to his "services area" reads as
 *  asking about the towns he covers. He said so. The page's own vocabulary has taken the
 *  phrase; we use "a services list on your page" or "a section listing your services". */
export function servicesAreaAddedReply(url: string, names: string[]): string {
  const list = names.length === 1
    ? names[0]
    : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  // "Have a look" and nothing more: 93 of 96 pages take the cloned section correctly and
  // on 3 it is unreadable, with nothing in the HTML separating them. A human eye is the
  // only thing that reaches there. No offer to fix follows, because no path can.
  return `I've added a services list with ${list} in it — have a look at your page. It's live at ${url}.`;
}

/** The owner's site cannot be edited from here (no generated document). */
export function classicScopeReply(host: string): string {
  return host
    ? `I can't change the page text from here — that's edited in Edit details, and your live site is unchanged at ${host}.`
    : `I can't change the page text from here — that's edited in Edit details, and your live site is unchanged.`;
}

/** THE SERVICES READ-BACK. Moved here 2026-09-09: its output is servicesTruth, which is
 *  primaryReply, which the owner reads verbatim — and it is where three model directives
 *  were found leaking into that channel. It belongs with every other sentence an owner
 *  reads. */
export type ServicesPlacementLike = {
  status?: string;
  placed?: { name: string; price?: number }[];
  verifiedPlaced?: { name: string; price?: number }[];
  unverified?: { name: string; price?: number }[];
  missing?: string[];
  inserted?: string[];
  descNeeded?: string[];
  noSection?: boolean;
  lostEdits?: number;
  where?: string;
  paths?: { anchor: number; legacy: number; inserted: number };
  retroAnchored?: number;
  leakedAttrText?: number;
};

export function andList(items: string[], overflowAfter = 3): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length <= overflowAfter) return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  const more = items.length - overflowAfter;
  return items.slice(0, overflowAfter).join(", ") + ` and ${more} more`;
}
export function fmtSvcPrice(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}
export function composeServicesTruth(placement: ServicesPlacementLike, url: string): string {
  // READ THE VERIFIED LIST, NOT THE REPORTED ONE (Lesson 11). `placed` is what the
  // writers said; `verifiedPlaced` is what is in the bytes that were saved. The price
  // bug lived exactly here: a row with no price element took the name and dropped the
  // price, the writer still said ok, and this sentence would have quoted the price back.
  const truthful = placement.verifiedPlaced || placement.placed || [];
  const priced = truthful.filter((p) => typeof p.price === "number");
  const dropped = (placement.unverified || []).filter((p) => typeof p.price === "number");
  const wherePhrase = placement.where === "services section" ? "in the services section" : "on your page";
  const missing = placement.missing || [];
  const inserted = new Set(placement.inserted || []);

  if (placement.status === "failed") {
    return `I saved those to your record, but couldn't update the page just now — so don't take them as showing yet. Try again in a moment.`;
  }
  if (placement.status === "none_on_page") {
    // Nothing landed. The ONLY reason a service can't be added is that there is no
    // section to clone an entry into (noSection) — then, and only then, the rebuild
    // offer, with its cost named up front.
    // THE SPLICE, FIXED. This was `"...but " + rebuildLastResort(placement)` and
    // rebuildLastResort returns a sentence starting with a capital, so an owner read
    // "but Your page doesn't have..." — two independently-written fragments glued at an
    // interpolation, the third instance of assembled prose reaching a real person.
    //
    // AND THE ANSWER CHANGED. "The only way is to rebuild the whole page from scratch"
    // was an enormous response to "here are my prices", and on the signup path it read
    // as the product being broken. There is a small answer now: add the area.
    // NO PERMISSION QUESTION — RULED 2026-09-12. This used to read "Your page doesn't
    // have a section listing your services yet — want me to add one with X, Y and Z in
    // it?", and Adrian got it on his own walk (ridgeline-pressure-washing, seq 8). He
    // asked for three services on his page; whether a section has to be built first is
    // our problem. applyServicesToFreeform now builds and places in the same move, so
    // reaching this line means the page HAS no services area AND we could not add one.
    // That is a failure to state plainly, not an offer to make.
    if (placement.noSection) {
      return `I've saved those to your record, but I couldn't get a services area onto your page, so they aren't showing there yet.`;
    }
    // `what` belongs to the noSection branch above and is NOT in scope here — this is the
    // OTHER failure: the page has somewhere to put them and the placement still failed.
    // Naming them again would be a second list; the offer is the same either way.
    return `I've saved those to your record, but I couldn't get them onto the page, so they aren't showing yet.`;
  }
  if (placement.status === "no_prices") {
    // Names are on the page; no prices were given. Let the model ask for them —
    // don't override with a price read-back that has no prices to read.
    return "";
  }
  // placed / partial — at least one price landed. Read back what ACTUALLY happened:
  // both the prices updated in place and any newly ADDED entries (the "added" claim
  // comes from the placement result, never ahead of it).
  const readback = andList(priced.map((p) => `${p.name} ${fmtSvcPrice(p.price as number)}`));
  const addedNames = priced.map((p) => p.name).filter((n) => inserted.has(n));
  const addedClause = addedNames.length
    ? ` I added ${andList(addedNames)} as ${addedNames.length === 1 ? "a new entry" : "new entries"} in that section.`
    : "";
  // The where-clause is only additive when it names a specific place (the services
  // section). When it is the generic "on your page", appending it duplicates the
  // "on your page now" we just said ("…on your page now, on your page.") — so drop it.
  const whereClause = placement.where === "services section" ? `, ${wherePhrase}` : "";
  // Anything a writer claimed and the bytes did not confirm is SAID, not swallowed.
  const droppedClause = dropped.length
    ? ` ${andList(dropped.map((d) => d.name))} ${dropped.length === 1 ? "is" : "are"} saved to your record but ${dropped.length === 1 ? "isn't" : "aren't"} showing on the page — say that plainly.`
    : "";
  if (!priced.length && dropped.length) {
    return `I saved those to your record, but ${andList(dropped.map((d) => d.name))} ${dropped.length === 1 ? "is" : "are"} not showing on the page. Say that plainly — do not say the price is on the page.`;
  }
  const landedLine = `${readback} ${priced.length === 1 ? "is" : "are"} on your page now${whereClause}.${addedClause}${droppedClause}`;
  if (placement.status === "partial" && missing.length) {
    // A service the page has no cloneable entry for (rare). Say so honestly — no
    // rebuild bait (a rebuild wouldn't obviously help place one service, and it
    // would destroy the rest).
    const missWord = andList(missing);
    return `${landedLine} I couldn't add ${missWord} to the page as it's built, so ${missing.length === 1 ? "it isn't" : "they aren't"} showing yet.`;
  }
  // An entry was added into a section that carries a one-line blurb per item, but no
  // description was given — the page is telling us one belongs, so ASK for it (a
  // single question; the new card renders clean in the meantime, blurb hidden).
  const descNeeded = placement.descNeeded || [];
  if (descNeeded.length) {
    const ask = descNeeded.length === 1
      ? ` Your other items each have a one-line description — what should ${descNeeded[0]}'s be?`
      : ` Your other items each have a one-line description — want to add one for ${andList(descNeeded)}? Just tell me and I'll put them in.`;
    return `${landedLine}${ask}`;
  }
  return landedLine;
}