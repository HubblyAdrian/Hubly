-- ============================================================================
-- VERIFY the business_type default fix took. All read-only. Run after applying
-- apply_business_type_default_fix.sql.
-- ============================================================================

-- CHECK 1 — the column itself.
-- EXPECT: is_nullable = YES, column_default = NULL (empty cell).
-- If column_default still shows 'detailing'::text, the ALTER did not run.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'businesses'
  and column_name = 'business_type';

-- CHECK 2 — same thing from pg_catalog, which cannot be fooled by a view.
-- EXPECT: not_null = false, default_expr = NULL.
select
  a.attname,
  a.attnotnull                              as not_null,
  pg_get_expr(d.adbin, d.adrelid)           as default_expr
from pg_attribute a
left join pg_attrdef d
  on d.adrelid = a.attrelid and d.adnum = a.attnum
where a.attrelid = 'public.businesses'::regclass
  and a.attname = 'business_type';

-- CHECK 3 — no existing row was harmed.
-- EXPECT: exactly the distribution you had before — detailing 13, photography 4,
-- windows 1, landscaping 1, and (null) 0. If (null) is suddenly non-zero,
-- something ran more than the two ALTERs above.
select
  coalesce(business_type, '(null)') as business_type,
  count(*)                          as businesses
from public.businesses
group by 1
order by 2 desc, 1;

-- CHECK 4 — the comment landed, so the next person reading the schema is told why.
-- EXPECT: a description beginning "Trade/industry id...".
select col_description('public.businesses'::regclass, a.attnum) as business_type_comment
from pg_attribute a
where a.attrelid = 'public.businesses'::regclass
  and a.attname = 'business_type';
