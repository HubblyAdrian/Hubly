/**
 * Unified availability engine for Hubly.
 * Sources: Hubly Calendar (jobs), Google Calendar events, Outlook (stub),
 * manual business hours from businesses.meta.hours.
 */

export type BlockedTime = {
  start: string;
  end: string;
  source: "hubly" | "google" | "outlook" | "hours";
  label?: string;
};

export type AvailabilityResult = {
  available: boolean;
  nextAvailable: string | null;
  blockedTimes: BlockedTime[];
  sources: {
    hubly: boolean;
    google: boolean;
    outlook: boolean;
    business_hours: boolean;
  };
};

export type DayHours = {
  open?: string;
  close?: string;
  closed?: boolean;
};

type JobRow = {
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  duration_hours?: number | null;
  status?: string | null;
  service_name?: string | null;
};

type GcalRow = {
  start_at?: string | null;
  end_at?: string | null;
  all_day?: boolean | null;
  local_date?: string | null;
  local_start_time?: string | null;
  duration_hours?: number | null;
  summary?: string | null;
  status?: string | null;
};

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseHm(hm: string | undefined | null): number | null {
  if (!hm || typeof hm !== "string") return null;
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function atLocalMinutes(dateStr: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  // Treat business-local wall time as UTC-labeled ISO for API consumers;
  // owners' timezone handling can refine later without changing the interface.
  return `${dateStr}T${pad2(h)}:${pad2(m)}:00.000Z`;
}

function dayKeyFromDateStr(dateStr: string): (typeof DAY_KEYS)[number] {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return DAY_KEYS[dt.getUTCDay()];
}

function hoursForDay(
  hours: Record<string, DayHours> | null | undefined,
  dateStr: string,
): DayHours | null {
  if (!hours || typeof hours !== "object") return null;
  const key = dayKeyFromDateStr(dateStr);
  return hours[key] || null;
}

function blocksOutsideHours(
  dateStr: string,
  hours: Record<string, DayHours> | null | undefined,
): BlockedTime[] {
  const day = hoursForDay(hours, dateStr);
  if (!day) return [];
  if (day.closed) {
    return [{
      start: atLocalMinutes(dateStr, 0),
      end: atLocalMinutes(dateStr, 24 * 60 - 1),
      source: "hours",
      label: "Closed",
    }];
  }
  const open = parseHm(day.open) ?? 8 * 60;
  const close = parseHm(day.close) ?? 17 * 60;
  const out: BlockedTime[] = [];
  if (open > 0) {
    out.push({
      start: atLocalMinutes(dateStr, 0),
      end: atLocalMinutes(dateStr, open),
      source: "hours",
      label: "Before open",
    });
  }
  if (close < 24 * 60) {
    out.push({
      start: atLocalMinutes(dateStr, close),
      end: atLocalMinutes(dateStr, 24 * 60 - 1),
      source: "hours",
      label: "After close",
    });
  }
  return out;
}

function jobBlocks(jobs: JobRow[], dateStr: string): BlockedTime[] {
  const out: BlockedTime[] = [];
  for (const j of jobs || []) {
    if (!j.scheduled_date || String(j.scheduled_date).slice(0, 10) !== dateStr) continue;
    if (j.status === "cancelled" || j.status === "canceled") continue;
    const startMin = parseHm(j.scheduled_time) ?? 9 * 60;
    const durH = Number(j.duration_hours);
    const durMin = Number.isFinite(durH) && durH > 0 ? Math.round(durH * 60) : 120;
    out.push({
      start: atLocalMinutes(dateStr, startMin),
      end: atLocalMinutes(dateStr, startMin + durMin),
      source: "hubly",
      label: j.service_name || "Hubly job",
    });
  }
  return out;
}

function googleBlocks(events: GcalRow[], dateStr: string): BlockedTime[] {
  const out: BlockedTime[] = [];
  for (const e of events || []) {
    if (e.status === "cancelled") continue;
    if (e.all_day || (e.local_date && !e.start_at)) {
      const ld = (e.local_date || "").slice(0, 10);
      if (ld !== dateStr) continue;
      out.push({
        start: atLocalMinutes(dateStr, 0),
        end: atLocalMinutes(dateStr, 24 * 60 - 1),
        source: "google",
        label: e.summary || "Google Calendar",
      });
      continue;
    }
    if (!e.start_at) continue;
    const start = new Date(e.start_at);
    const end = e.end_at
      ? new Date(e.end_at)
      : new Date(start.getTime() + (Number(e.duration_hours) || 1) * 3600_000);
    const startDay = toDateStr(start);
    const endDay = toDateStr(end);
    // Include if overlaps the requested UTC calendar day
    if (endDay < dateStr || startDay > dateStr) continue;
    out.push({
      start: start.toISOString(),
      end: end.toISOString(),
      source: "google",
      label: e.summary || "Google Calendar",
    });
  }
  return out;
}

/** Outlook placeholder — wiring lands when Outlook Connect ships. */
function outlookBlocks(_dateStr: string): BlockedTime[] {
  return [];
}

function mergeBlocks(blocks: BlockedTime[]): BlockedTime[] {
  return [...blocks].sort((a, b) => a.start.localeCompare(b.start));
}

function findOpenSlot(
  dateStr: string,
  hours: Record<string, DayHours> | null | undefined,
  blocked: BlockedTime[],
  durationMinutes: number,
  weekendJobs: boolean,
): string | null {
  const dayKey = dayKeyFromDateStr(dateStr);
  if (!weekendJobs && (dayKey === "Sat" || dayKey === "Sun")) return null;

  const day = hoursForDay(hours, dateStr);
  if (day?.closed) return null;
  const open = parseHm(day?.open) ?? 8 * 60;
  const close = parseHm(day?.close) ?? 17 * 60;
  if (close - open < durationMinutes) return null;

  const busy = blocked
    .map((b) => {
      const s = new Date(b.start);
      const e = new Date(b.end);
      // Map to minutes on this date when possible
      const sDay = toDateStr(s);
      const eDay = toDateStr(e);
      let sMin = 0;
      let eMin = 24 * 60;
      if (sDay === dateStr) sMin = s.getUTCHours() * 60 + s.getUTCMinutes();
      if (eDay === dateStr) eMin = e.getUTCHours() * 60 + e.getUTCMinutes();
      if (sDay < dateStr) sMin = 0;
      if (eDay > dateStr) eMin = 24 * 60;
      return { sMin, eMin };
    })
    .filter((b) => b.eMin > open && b.sMin < close)
    .sort((a, b) => a.sMin - b.sMin);

  let cursor = open;
  for (const b of busy) {
    if (b.sMin - cursor >= durationMinutes) {
      return atLocalMinutes(dateStr, cursor);
    }
    cursor = Math.max(cursor, b.eMin);
  }
  if (close - cursor >= durationMinutes) {
    return atLocalMinutes(dateStr, cursor);
  }
  return null;
}

export type AvailabilityInput = {
  date?: string | null;
  durationMinutes?: number;
  weekendJobs?: boolean;
  hours?: Record<string, DayHours> | null;
  jobs?: JobRow[];
  googleEvents?: GcalRow[];
  googleConnected?: boolean;
  outlookConnected?: boolean;
  acceptingNewJobs?: boolean;
};

/**
 * Single availability interface used by marketplace + future Hubly surfaces.
 */
export function getAvailability(input: AvailabilityInput): AvailabilityResult {
  const now = new Date();
  const dateStr = (input.date || toDateStr(now)).slice(0, 10);
  const duration = Math.max(15, Number(input.durationMinutes) || 120);
  const weekendJobs = input.weekendJobs !== false;
  const accepting = input.acceptingNewJobs !== false;

  const hoursBlocks = blocksOutsideHours(dateStr, input.hours || null);
  const hubly = jobBlocks(input.jobs || [], dateStr);
  const google = input.googleConnected ? googleBlocks(input.googleEvents || [], dateStr) : [];
  const outlook = input.outlookConnected ? outlookBlocks(dateStr) : [];

  const blockedTimes = mergeBlocks([...hoursBlocks, ...hubly, ...google, ...outlook]);

  let nextAvailable: string | null = null;
  if (accepting) {
    // Search today + next 14 days
    for (let i = 0; i < 15; i++) {
      const d = new Date(dateStr + "T00:00:00.000Z");
      d.setUTCDate(d.getUTCDate() + i);
      const ds = toDateStr(d);
      const dayBlocks = mergeBlocks([
        ...blocksOutsideHours(ds, input.hours || null),
        ...jobBlocks(input.jobs || [], ds),
        ...(input.googleConnected ? googleBlocks(input.googleEvents || [], ds) : []),
        ...(input.outlookConnected ? outlookBlocks(ds) : []),
      ]);
      const slot = findOpenSlot(ds, input.hours || null, dayBlocks, duration, weekendJobs);
      if (slot) {
        nextAvailable = slot;
        break;
      }
    }
  }

  return {
    available: accepting && !!findOpenSlot(
      dateStr,
      input.hours || null,
      blockedTimes,
      duration,
      weekendJobs,
    ),
    nextAvailable,
    blockedTimes,
    sources: {
      hubly: true,
      google: !!input.googleConnected,
      outlook: !!input.outlookConnected,
      business_hours: !!(input.hours && typeof input.hours === "object"),
    },
  };
}
