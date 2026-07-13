-- Bug E: dashboard doesn't update on new bookings/jobs without a manual
-- refresh. Root cause confirmed live: RLS on both tables already scopes
-- correctly to the owner (owns_business(business_id)), but neither table
-- was ever added to the supabase_realtime publication, so no
-- postgres_changes events were being emitted to any subscriber regardless
-- of RLS. This is what actually lets postgres_changes subscriptions work.
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.booking_requests;
