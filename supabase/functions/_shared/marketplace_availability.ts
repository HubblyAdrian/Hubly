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

    // Prefer local wall-clock fields — slots are stored as UTC-labelled wall times.
    const localDate = (e.local_date || "").slice(0, 10);
    const localStart = parseHm(e.local_start_time);
    if (localDate && localStart != null) {
      if (localDate !== dateStr) continue;
      const durH = Number(e.duration_hours);
      const durMin = Number.isFinite(durH) && durH > 0
        ? Math.round(durH * 60)
        : (e.end_at && e.start_at
          ? Math.max(15, Math.round((Date.parse(String(e.end_at)) - Date.parse(String(e.start_at))) / 60000))
          : 60);
      if (e.all_day) {
        out.push({
          start: atLocalMinutes(dateStr, 0),
          end: atLocalMinutes(dateStr, 24 * 60 - 1),
          source: "google",
          label: e.summary || "Google Calendar",
        });
      } else {
        out.push({
          start: atLocalMinutes(dateStr, localStart),
          end: atLocalMinutes(dateStr, localStart + durMin),
          source: "google",
          label: e.summary || "Google Calendar",
        });
      }
      continue;
    }

    if (e.all_day || (localDate && !e.start_at)) {
      const ld = localDate;
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
    // Fallback: treat ISO instant as wall-clock on the UTC-labelled day of the event.
    // Prefer local_* fields above — this path is only when local times were not synced.
    const start = new Date(e.start_at);
    const end = e.end_at
      ? new Date(e.end_at)
      : new Date(start.getTime() + (Number(e.duration_hours) || 1) * 3600_000);
    const startDay = toDateStr(start);
    const endDay = toDateStr(end);
    if (endDay < dateStr || startDay > dateStr) continue;
    const sMin = startDay === dateStr
      ? start.getUTCHours() * 60 + start.getUTCMinutes()
      : 0;
    const eMin = endDay === dateStr
      ? end.getUTCHours() * 60 + end.getUTCMinutes()
      : 24 * 60;
    out.push({
      start: atLocalMinutes(dateStr, sMin),
      end: atLocalMinutes(dateStr, Math.max(sMin + 15, eMin)),
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

export type AppointmentSlot = {
  starts_at: string;
  ends_at: string;
  label: string;
  date: string;
};

/** List bookable appointment starts for the next N days (provider-agnostic). */
export function listAppointmentSlots(
  input: AvailabilityInput & {
    days?: number;
    slotStepMinutes?: number;
    bufferMinutes?: number;
  },
): AppointmentSlot[] {
  const days = Math.min(21, Math.max(1, Number(input.days) || 14));
  const duration = Math.max(15, Number(input.durationMinutes) || 120);
  const step = Math.max(15, Number(input.slotStepMinutes) || 30);
  const buffer = Math.max(0, Number(input.bufferMinutes) || 0);
  const weekendJobs = input.weekendJobs !== false;
  if (input.acceptingNewJobs === false) return [];

  const base = (input.date || toDateStr(new Date())).slice(0, 10);
  const slots: AppointmentSlot[] = [];
  const now = Date.now();

  for (let i = 0; i < days; i++) {
    const d = new Date(base + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + i);
    const ds = toDateStr(d);
    const dayKey = dayKeyFromDateStr(ds);
    if (!weekendJobs && (dayKey === "Sat" || dayKey === "Sun")) continue;

    const day = hoursForDay(input.hours || null, ds);
    if (day?.closed) continue;
    const open = parseHm(day?.open) ?? 8 * 60;
    const close = parseHm(day?.close) ?? 17 * 60;
    if (close - open < duration) continue;

    const dayBlocks = mergeBlocks([
      ...blocksOutsideHours(ds, input.hours || null),
      ...jobBlocks(input.jobs || [], ds),
      ...(input.googleConnected ? googleBlocks(input.googleEvents || [], ds) : []),
      ...(input.outlookConnected ? outlookBlocks(ds) : []),
    ]);

    const busy = dayBlocks
      .map((b) => {
        const s = new Date(b.start);
        const e = new Date(b.end);
        const sDay = toDateStr(s);
        const eDay = toDateStr(e);
        let sMin = 0;
        let eMin = 24 * 60;
        if (sDay === ds) sMin = s.getUTCHours() * 60 + s.getUTCMinutes();
        if (eDay === ds) eMin = e.getUTCHours() * 60 + e.getUTCMinutes();
        if (sDay < ds) sMin = 0;
        if (eDay > ds) eMin = 24 * 60;
        return { sMin: Math.max(0, sMin - buffer), eMin: Math.min(24 * 60, eMin + buffer) };
      })
      .filter((b) => b.eMin > open && b.sMin < close)
      .sort((a, b) => a.sMin - b.sMin);

    for (let cursor = open; cursor + duration <= close; cursor += step) {
      const end = cursor + duration;
      const overlaps = busy.some((b) => cursor < b.eMin && end > b.sMin);
      if (overlaps) continue;
      const starts_at = atLocalMinutes(ds, cursor);
      if (Date.parse(starts_at) < now) continue;
      const ends_at = atLocalMinutes(ds, end);
      const h = Math.floor(cursor / 60);
      const m = cursor % 60;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      slots.push({
        starts_at,
        ends_at,
        date: ds,
        label: `${h12}:${pad2(m)} ${ampm}`,
      });
    }
  }

  return slots;
}
