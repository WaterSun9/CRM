-- Keep the activity log when a customer is permanently deleted, 11 Nov 2026.
--
-- activity_log pointed at the customer with ON DELETE CASCADE, so emptying the
-- trash also deleted every log entry about that customer. Now the entries stay;
-- only their link to the (gone) customer is cleared. Their text keeps the name.
-- (admin_history, the full change history, has no such link and already keeps
-- a complete copy of a deleted customer.)
--
-- Changes no existing row. Safe to run more than once.
-- To undo:
--   alter table public.activity_log drop constraint fk_activity_log_customer;
--   alter table public.activity_log add constraint fk_activity_log_customer
--       foreign key (customer_id) references public.admin(id) on delete cascade;

alter table public.activity_log drop constraint if exists fk_activity_log_customer;
alter table public.activity_log add constraint fk_activity_log_customer
    foreign key (customer_id) references public.admin(id) on delete set null;

-- Check (should say SET NULL):
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'fk_activity_log_customer';
