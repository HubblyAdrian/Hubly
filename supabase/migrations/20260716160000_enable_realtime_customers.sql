-- Enable realtime for customers so Completing a job / new CRM rows
-- refresh Customers + Dashboard KPIs without a manual page reload.
-- Safe if already published: ignore duplicate-add errors by using a DO block.
do $$
begin
  alter publication supabase_realtime add table public.customers;
exception
  when duplicate_object then null;
  when others then
    -- publication may already include the table under a different error shape
    null;
end $$;
