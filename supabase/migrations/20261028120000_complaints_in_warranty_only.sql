-- Complaints only for customers in warranty (NOT YET RUN). Decided by the owner on
-- 28 Oct 2026: a complaint can be raised only while the customer is in warranty (green on
-- Warranty customers). Out of warranty, or no warranty date at all, is refused.
-- This replaces the 12 Oct rule that allowed out-of-warranty complaints (tagged "Out of
-- warranty"). Complaints already raised are not touched.
--
--   * Runs after fill_service_issue_from_customer (triggers run in name order), which has
--     already worked out the warranty from the customer card (public.customer_warranty).
--   * A complaint not linked to a customer card has no warranty, so it is refused too.
--   * The service role and the SQL editor (no signed-in user) are not limited.
--
-- Safe to run more than once.
set lock_timeout = '8s';
begin;

create or replace function public.require_service_issue_warranty()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if auth.uid() is null then
        return new;
    end if;
    if new.customer_id is null then
        raise exception 'Raise a complaint from the customer on Warranty customers.';
    end if;
    if new.warranty_status = 'out_of_warranty' then
        raise exception 'This customer is out of warranty (ended %). A complaint cannot be raised.', to_char(new.warranty_end, 'DD Mon YYYY');
    end if;
    if new.warranty_status is distinct from 'in_warranty' then
        raise exception 'This customer has no warranty date. Add the installation date on the customer card first.';
    end if;
    return new;
end;
$$;
create or replace trigger service_issue_warranty_required before insert on public.service_issues
for each row execute function public.require_service_issue_warranty();

revoke all on function public.require_service_issue_warranty() from public, anon;
grant execute on function public.require_service_issue_warranty() to authenticated, service_role;

commit;

-- Check (expect warranty_trigger_1):
select count(*) as warranty_trigger_1 from pg_trigger
where tgname = 'service_issue_warranty_required' and tgrelid = 'public.service_issues'::regclass and not tgisinternal;
