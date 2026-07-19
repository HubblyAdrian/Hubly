/**
 * Live "Your Booking" / "Building Your Booking" state for concierge UI.
 * Structured memory that updates as intake progresses.
 */

import { preferenceLabels, timingLabel } from "./marketplace_industry_knowledge.ts";
import type { JobUnderstanding } from "./marketplace_job.ts";

export type BookingField = {
  key: string;
  label: string;
  value: string | null;
  done: boolean;
};

export type BookingState = {
  title: string;
  fields: BookingField[];
  checklist: Array<{ label: string; done: boolean }>;
};

export type BookingSummaryCard = {
  title: string;
  rows: Array<{ label: string; value: string }>;
  pending: Array<{ label: string; value: string }>;
  actions: Array<"Looks good" | "Edit" | "Add another service" | "Continue">;
};

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inferScope(job: JobUnderstanding): string | null {
  if (job.service && /Interior \+ Exterior|Interior and Exterior/i.test(job.service)) {
    return "Interior + Exterior";
  }
  if (job.priority && /interior over exterior/i.test(job.priority)) return "Interior";
  if (job.priority && /exterior over interior/i.test(job.priority)) return "Exterior";
  if (job.service && /interior/i.test(job.service) && !/exterior/i.test(job.service)) {
    return "Interior";
  }
  if (job.service && /exterior/i.test(job.service) && !/interior/i.test(job.service)) {
    return "Exterior";
  }
  return null;
}

/** Build live booking memory from current job + conversation text. */
export function buildBookingState(
  job: JobUnderstanding,
  opts?: {
    when?: string | null;
    city?: string | null;
    rawText?: string;
    confirmed?: boolean;
  },
): BookingState {
  const raw = opts?.rawText || "";
  const timing = timingLabel(opts?.when, raw);
  const scope = inferScope(job);
  const fields: BookingField[] = [];

  if (job.vehicle_type) {
    fields.push({
      key: "vehicle",
      label: "Vehicle",
      value: capitalize(job.vehicle_type),
      done: true,
    });
  }

  fields.push({
    key: "service",
    label: "Service",
    value: job.service,
    done: !!job.service,
  });

  if (job.property_type) {
    fields.push({
      key: "property",
      label: "Property",
      value: capitalize(job.property_type),
      done: true,
    });
  }

  if (scope) {
    fields.push({ key: "scope", label: "Scope", value: scope, done: true });
  }

  for (const a of job.add_ons) {
    fields.push({
      key: `addon_${a}`,
      label: "Recommended add-on",
      value: a,
      done: true,
    });
  }

  if (job.preferences.mobile_only) {
    fields.push({
      key: "mobile",
      label: "Service style",
      value: "Mobile service",
      done: true,
    });
  }

  fields.push({
    key: "timing",
    label: "Preferred time",
    value: timing
      ? timing.replace(/^Service needed /i, "").replace(/^Service on /i, "")
      : null,
    done: !!timing,
  });

  if (opts?.city) {
    fields.push({ key: "city", label: "Location", value: opts.city, done: true });
  }

  fields.push({ key: "appointment", label: "Appointment", value: null, done: false });
  fields.push({ key: "provider", label: "Provider", value: null, done: false });

  const compact: BookingState["checklist"] = [];
  if (job.category === "windows") compact.push({ label: "Window Cleaning", done: true });
  else if (job.service) compact.push({ label: job.service, done: true });

  if (job.property_type === "residential") compact.push({ label: "Residential", done: true });
  if (job.property_type === "commercial") compact.push({ label: "Commercial", done: true });
  if (scope === "Exterior") compact.push({ label: "Exterior", done: true });
  if (scope === "Interior") compact.push({ label: "Interior", done: true });
  if (scope === "Interior + Exterior") compact.push({ label: "Interior + Exterior", done: true });

  for (const a of job.add_ons) compact.push({ label: a, done: true });
  if (job.vehicle_type) compact.push({ label: capitalize(job.vehicle_type), done: true });
  if (job.preferences.mobile_only) compact.push({ label: "Mobile Service", done: true });
  if (timing) {
    compact.push({
      label: capitalize(timing.replace(/^Service needed /i, "").replace(/^Service on /i, "")),
      done: true,
    });
  }
  compact.push({ label: "Appointment Time", done: false });
  compact.push({ label: "Provider", done: false });

  const seen = new Set<string>();
  const checklist = compact.filter((c) => {
    const k = c.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    title: opts?.confirmed ? "Your Booking" : "Building Your Booking",
    fields,
    checklist,
  };
}

/** Confirmation card: Your Booking with labeled rows. */
export function buildBookingSummaryCard(
  job: JobUnderstanding,
  opts?: { when?: string | null; city?: string | null; rawText?: string },
): BookingSummaryCard {
  const raw = opts?.rawText || "";
  const timing = timingLabel(opts?.when, raw);
  const rows: BookingSummaryCard["rows"] = [];

  if (job.vehicle_type) rows.push({ label: "Vehicle", value: capitalize(job.vehicle_type) });
  if (job.service) rows.push({ label: "Service", value: job.service });
  for (const a of job.add_ons) {
    rows.push({ label: "Recommended add-on", value: a });
  }
  if (job.property_type) rows.push({ label: "Property", value: capitalize(job.property_type) });
  if (job.preferences.mobile_only) {
    rows.push({ label: "Service style", value: "Mobile service" });
  }
  for (const p of preferenceLabels(job.preferences)) {
    if (p === "Mobile service" || p === "Soonest availability" || p === "Weekend preferred") {
      continue;
    }
    rows.push({ label: "Preference", value: p });
  }
  if (timing) {
    rows.push({
      label: "Preferred time",
      value: timing.replace(/^Service needed /i, "").replace(/^Service on /i, ""),
    });
  }
  if (opts?.city) rows.push({ label: "Location", value: opts.city });

  return {
    title: "Your Booking",
    rows,
    pending: [
      { label: "Appointment", value: "To be selected" },
      { label: "Provider", value: "To be selected" },
    ],
    actions: ["Looks good", "Edit", "Add another service", "Continue"],
  };
}
