// PERSIST WHAT A VISITOR SAYS ON A BUSINESS'S PUBLIC SITE.
//
// WHY THIS EXISTS (2026-09-08). The Website Concierge persisted NOTHING. Measured on a
// clone as an anonymous visitor: asked "can you detail a truck this Saturday", got a
// real and useful reply — and every candidate table held zero rows. A visitor who asks
// and drifts away leaves no trace, so the owner loses a customer he never knew he had.
// The `leads` slice reads booking_requests with status='abandoned', so an abandoned
// CHAT was never a lead at all.
//
// It writes to chatbot_conversations / chatbot_messages — the tables the legacy
// chatbot-message function already used (last written 2026-08-28) — rather than a
// second store for the same concept. Two stores for one thing is how a count comes to
// mean two things, which is the defect class this whole day was spent removing.
//
// BEST-EFFORT BY DESIGN: a failure here must never break the visitor's reply. A person
// asking about Saturday matters more than our record of it. Failures are logged, not
// thrown — and the caller is told, so silence is never mistaken for success.
//
// RETENTION: message bodies are deleted after 90 days by purge_old_visitor_messages()
// (pg_cron, daily). Conversation rows persist. See migration 20260908210000.

type Admin = { from: (t: string) => any };

export type VisitorTurn = {
  businessId: string;
  conversationId?: string | null;
  /** The full turn history as the client holds it: {role:'user'|'assistant', content}. */
  messages: Array<{ role?: string; content?: string }>;
  /** True once this conversation produced a real job/booking row. */
  resultedInBooking?: boolean;
  /** Contact details the visitor volunteered, if the turn established any. */
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
};

export type VisitorTurnResult = { ok: boolean; conversationId: string | null; wrote: number; error?: string };

/** chatbot_messages.role is CHECK (role in ('customer','assistant')) — map to it. */
function roleOf(m: { role?: string }): "customer" | "assistant" {
  return String(m?.role || "").toLowerCase() === "assistant" ? "assistant" : "customer";
}

export async function persistVisitorTurn(admin: Admin, t: VisitorTurn): Promise<VisitorTurnResult> {
  const businessId = String(t.businessId || "").trim();
  if (!businessId) return { ok: false, conversationId: null, wrote: 0, error: "no_business_id" };
  const msgs = Array.isArray(t.messages) ? t.messages.filter((m) => String(m?.content || "").trim()) : [];
  if (!msgs.length) return { ok: true, conversationId: t.conversationId || null, wrote: 0 };

  try {
    let convId = String(t.conversationId || "").trim() || null;

    if (convId) {
      // Only ever touch a conversation that belongs to THIS business — the id comes
      // from the client and a client can send any uuid.
      const { data: owned } = await admin.from("chatbot_conversations")
        .select("id").eq("id", convId).eq("business_id", businessId).maybeSingle();
      if (!owned) convId = null;
    }

    if (!convId) {
      const { data, error } = await admin.from("chatbot_conversations")
        .insert({
          business_id: businessId,
          started_at: new Date().toISOString(),
          customer_name: t.customerName ?? null,
          customer_phone: t.customerPhone ?? null,
          customer_email: t.customerEmail ?? null,
          resulted_in_booking: !!t.resultedInBooking,
        })
        .select("id").maybeSingle();
      if (error || !data?.id) return { ok: false, conversationId: null, wrote: 0, error: String(error?.message || "insert_failed") };
      convId = String(data.id);
    }

    // Append only what is not already stored. The client sends the whole history every
    // turn, so writing all of it would duplicate the conversation on every message.
    const { data: existing } = await admin.from("chatbot_messages")
      .select("id").eq("conversation_id", convId);
    const already = Array.isArray(existing) ? existing.length : 0;
    const fresh = msgs.slice(already);

    if (fresh.length) {
      const { error } = await admin.from("chatbot_messages").insert(
        fresh.map((m) => ({ conversation_id: convId, role: roleOf(m), content: String(m.content || "").slice(0, 4000) })),
      );
      if (error) return { ok: false, conversationId: convId, wrote: 0, error: String(error.message) };
    }

    // Contact details and the booking outcome are only ever ADDED, never cleared: a
    // later turn that happens not to mention a phone number must not erase one given
    // earlier. Same reasoning as never discarding a draft.
    const patch: Record<string, unknown> = {};
    if (t.customerName) patch.customer_name = t.customerName;
    if (t.customerPhone) patch.customer_phone = t.customerPhone;
    if (t.customerEmail) patch.customer_email = t.customerEmail;
    if (t.resultedInBooking) patch.resulted_in_booking = true;
    if (Object.keys(patch).length) {
      await admin.from("chatbot_conversations").update(patch).eq("id", convId);
    }

    return { ok: true, conversationId: convId, wrote: fresh.length };
  } catch (e) {
    return { ok: false, conversationId: t.conversationId || null, wrote: 0, error: String((e as Error)?.message || e) };
  }
}
