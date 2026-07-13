-- Phase 1 item B: temporary seed helper for live-testing the activity
-- timeline merge. chatbot_conversations/chatbot_messages have no public
-- insert policy by design (AI-mediated writes only, service role) -- this
-- bypasses that for test data only, dropped after the test.
create or replace function _debug_seed_chatbot_test(
  p_business_id uuid, p_phone text, p_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
begin
  insert into chatbot_conversations(business_id, customer_phone, customer_email, consented_to_followup, resulted_in_booking, topics, started_at)
  values (p_business_id, p_phone, p_email, true, false, '["pricing","availability"]'::jsonb, now() - interval '2 days')
  returning id into v_conv_id;

  insert into chatbot_messages(conversation_id, role, content, created_at)
  values
    (v_conv_id, 'customer', 'Hi, how much for a full detail on a sedan?', now() - interval '2 days'),
    (v_conv_id, 'assistant', 'A full detail on a sedan runs $150 and takes about 2 hours. Want me to check availability?', now() - interval '2 days' + interval '1 minute'),
    (v_conv_id, 'customer', 'Yeah what do you have this week?', now() - interval '2 days' + interval '2 minutes');

  return v_conv_id;
end;
$$;

grant execute on function _debug_seed_chatbot_test(uuid,text,text) to authenticated;
revoke all on function _debug_seed_chatbot_test(uuid,text,text) from public, anon;
