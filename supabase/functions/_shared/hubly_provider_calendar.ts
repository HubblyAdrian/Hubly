/**
 * CalendarProvider — vendor-agnostic calendar boundary.
 * GoogleCalendarProvider uses real Google APIs when OAuth tokens exist.
 * Never fabricates events.
 */

import {
  envTruthy,
  providerError,
  providerNotConfigured,
  providerOk,
  type HublyProviderResult,
} from "./hubly_providers.ts";

export type CalendarEventInput = {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  timeZone?: string;
};

export type CalendarEvent = {
  id: string;
  htmlLink?: string | null;
  status?: string | null;
};

export interface CalendarProvider {
  readonly id: string;
  isConfigured(): boolean;
  missingEnv(): string[];
  listUpcoming(opts: {
    accessToken: string;
    calendarId?: string;
    maxResults?: number;
  }): Promise<HublyProviderResult<CalendarEvent[]>>;
  createEvent(opts: {
    accessToken: string;
    calendarId?: string;
    event: CalendarEventInput;
  }): Promise<HublyProviderResult<CalendarEvent>>;
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = "google_calendar";

  missingEnv(): string[] {
    const missing: string[] = [];
    if (!envTruthy("GOOGLE_CLIENT_ID")) missing.push("GOOGLE_CLIENT_ID");
    if (!envTruthy("GOOGLE_CLIENT_SECRET")) missing.push("GOOGLE_CLIENT_SECRET");
    return missing;
  }

  isConfigured(): boolean {
    return this.missingEnv().length === 0;
  }

  async listUpcoming(opts: {
    accessToken: string;
    calendarId?: string;
    maxResults?: number;
  }): Promise<HublyProviderResult<CalendarEvent[]>> {
    if (!this.isConfigured()) {
      return providerNotConfigured(this.id, this.missingEnv());
    }
    if (!opts.accessToken) {
      return providerError(this.id, "MISSING_ACCESS_TOKEN", "Google access token required", {
        retryable: false,
      });
    }
    const cal = encodeURIComponent(opts.calendarId || "primary");
    const params = new URLSearchParams({
      maxResults: String(opts.maxResults || 10),
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: new Date().toISOString(),
    });
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?${params}`,
        { headers: { Authorization: `Bearer ${opts.accessToken}` } },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return providerError(
          this.id,
          "GOOGLE_LIST_FAILED",
          json?.error?.message || `Google Calendar error (${res.status})`,
          { retryable: res.status >= 500 },
        );
      }
      const items = Array.isArray(json.items) ? json.items : [];
      const events: CalendarEvent[] = items.map((it: { id?: string; htmlLink?: string; status?: string }) => ({
        id: String(it.id || ""),
        htmlLink: it.htmlLink || null,
        status: it.status || null,
      }));
      return providerOk(this.id, events, `Loaded ${events.length} events`);
    } catch (e) {
      return providerError(
        this.id,
        "GOOGLE_REQUEST_FAILED",
        e instanceof Error ? e.message : "Google Calendar request failed",
        { retryable: true },
      );
    }
  }

  async createEvent(opts: {
    accessToken: string;
    calendarId?: string;
    event: CalendarEventInput;
  }): Promise<HublyProviderResult<CalendarEvent>> {
    if (!this.isConfigured()) {
      return providerNotConfigured(this.id, this.missingEnv());
    }
    if (!opts.accessToken) {
      return providerError(this.id, "MISSING_ACCESS_TOKEN", "Google access token required", {
        retryable: false,
      });
    }
    const cal = encodeURIComponent(opts.calendarId || "primary");
    const body = {
      summary: opts.event.summary,
      description: opts.event.description || "",
      start: {
        dateTime: opts.event.startIso,
        timeZone: opts.event.timeZone || "UTC",
      },
      end: {
        dateTime: opts.event.endIso,
        timeZone: opts.event.timeZone || "UTC",
      },
    };
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return providerError(
          this.id,
          "GOOGLE_CREATE_FAILED",
          json?.error?.message || `Google Calendar error (${res.status})`,
          { retryable: res.status >= 500 },
        );
      }
      return providerOk(this.id, {
        id: String(json.id || ""),
        htmlLink: json.htmlLink || null,
        status: json.status || null,
      }, "Event created");
    } catch (e) {
      return providerError(
        this.id,
        "GOOGLE_REQUEST_FAILED",
        e instanceof Error ? e.message : "Google Calendar request failed",
        { retryable: true },
      );
    }
  }
}

export function createGoogleCalendarProvider(): GoogleCalendarProvider {
  return new GoogleCalendarProvider();
}

export function getCalendarProvider(): CalendarProvider {
  return createGoogleCalendarProvider();
}

export default GoogleCalendarProvider;
