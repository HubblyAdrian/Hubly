-- Free-text hours phrasing that does NOT fit weekday rows.
--
-- settings_business_hours is structured-only (weekday, open_time, close_time,
-- closed) and extraction had no field for anything else, so "weekends by
-- appointment", "24/7 emergency", "out from 7 til dark" were silently DROPPED at
-- extraction. For home-service businesses that phrasing is not an edge case — it
-- is one of the most common honest answers — and re-enabling the "Set your hours"
-- suggestion while discarding it recreates the exact ask-answer-nothing-happens
-- defect this build exists to fix, one level down.
--
-- It lives on businesses, NOT settings_business_hours: the structured hours are
-- per-weekday by nature; a note is a single per-business fact with no weekday.
-- Stored VERBATIM — the model must never normalize "by appointment" into invented
-- times. It coexists with structured rows ("Mon–Fri 7 AM – 6 PM" + "Weekends by
-- appointment" is one real business).
alter table public.businesses add column if not exists hours_note text;
comment on column public.businesses.hours_note is
  'Free-text hours phrasing that does not fit weekday rows (e.g. "weekends by appointment"). Stored verbatim; coexists with settings_business_hours. Never model-normalized into times.';
