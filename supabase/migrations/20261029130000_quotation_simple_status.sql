-- Simple quotation status (NOT YET RUN). Asked for by the owner on 29 Oct 2026:
-- make quotation -> download/share -> come back -> mark Won or Lost. Users see
-- Open / Won / Lost; the stored status values (draft, issued, converted, lost) do
-- not change. The reason for Lost is now optional, so the check that required a
-- lost_reason is dropped. Old rows are not touched.
--
-- Safe to run more than once.
set lock_timeout = '8s';
begin;

alter table public.quotations drop constraint if exists quotations_lost_has_reason;

commit;

-- Check (expect constraint_left_0):
select count(*) as constraint_left_0 from pg_constraint
    where conname = 'quotations_lost_has_reason' and conrelid = 'public.quotations'::regclass;
