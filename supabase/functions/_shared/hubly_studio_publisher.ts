/**
 * Studio Publisher interface — multi-provider ready.
 * V1 implements Email (Resend) only.
 */

export type StudioPublishInput = {
  business_id: string;
  project_id?: string | null;
  title: string;
  to_email: string;
  to_name?: string | null;
  subject: string;
  body: string;
  business_name?: string | null;
};

export type StudioPublishResult =
  | { ok: true; provider: string; external_id?: string | null; raw?: unknown }
  | { ok: false; provider: string; error: string; code?: string };

export interface StudioPublisher {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  publish(input: StudioPublishInput): Promise<StudioPublishResult>;
}

export class EmailStudioPublisher implements StudioPublisher {
  readonly id = "email";
  readonly label = "Email";

  isConfigured(): boolean {
    return !!Deno.env.get("RESEND_API_KEY");
  }

  async publish(input: StudioPublishInput): Promise<StudioPublishResult> {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return {
        ok: false,
        provider: this.id,
        error: "Provider not configured",
        code: "not_configured",
      };
    }
    if (!input.to_email || !input.body) {
      return {
        ok: false,
        provider: this.id,
        error: "to_email and body are required",
        code: "invalid_input",
      };
    }
    const from =
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "notifications@notifications.myhubly.app";
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: input.to_email,
          subject: input.subject || `A message from ${input.business_name || "us"}`,
          text: input.body,
        }),
      });
      const raw = await r.json().catch(() => ({}));
      if (!r.ok) {
        return {
          ok: false,
          provider: this.id,
          error: "Failed to send email",
          code: "send_failed",
          // @ts-ignore raw debug
          raw,
        };
      }
      return {
        ok: true,
        provider: this.id,
        external_id: (raw as { id?: string }).id || null,
        raw,
      };
    } catch (e) {
      return {
        ok: false,
        provider: this.id,
        error: (e as Error).message || "send_failed",
        code: "send_failed",
      };
    }
  }
}

/** Future: InstagramPublisher, FacebookPublisher, GoogleBusinessPublisher, … */
export function getV1Publisher(): StudioPublisher {
  return new EmailStudioPublisher();
}

export function listPublisherSlots(): { id: string; label: string; v1: boolean }[] {
  return [
    { id: "email", label: "Email", v1: true },
    { id: "instagram", label: "Instagram", v1: false },
    { id: "facebook", label: "Facebook", v1: false },
    { id: "google_business", label: "Google Business", v1: false },
    { id: "linkedin", label: "LinkedIn", v1: false },
    { id: "sms", label: "SMS", v1: false },
  ];
}
