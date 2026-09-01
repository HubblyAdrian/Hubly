-- One-time pass: bring every stored phone to house format 888-888-8888.
--
-- 71/73 were already house format (2026-08-31); this fixes the 2 bare-digit
-- offenders so we don't carry a "mostly clean" state we have to remember later.
-- Going forward, applyExtractedFacts normalizes on write (formatPhoneHouse), so
-- this backfill runs once. Mirrors phoneDigitsKey/formatPhoneHouse: strip
-- non-digits, drop a leading US 1 only when 11 digits, take the last 10, format.
-- Rows whose digit key is not exactly 10 are left untouched (never mangle junk).
with k as (
  select id, phone,
    case
      when length(regexp_replace(coalesce(phone,''),'\D','','g'))=11
        and left(regexp_replace(coalesce(phone,''),'\D','','g'),1)='1'
        then substr(regexp_replace(coalesce(phone,''),'\D','','g'),2)
      when length(regexp_replace(coalesce(phone,''),'\D','','g'))>10
        then right(regexp_replace(coalesce(phone,''),'\D','','g'),10)
      else regexp_replace(coalesce(phone,''),'\D','','g')
    end as key
  from public.businesses
  where coalesce(nullif(btrim(phone),''),'') <> ''
)
update public.businesses b
set phone = substr(k.key,1,3)||'-'||substr(k.key,4,3)||'-'||substr(k.key,7)
from k
where b.id = k.id
  and length(k.key) = 10
  and b.phone <> substr(k.key,1,3)||'-'||substr(k.key,4,3)||'-'||substr(k.key,7);
