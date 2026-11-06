-- Complaints only for customers in warranty, with an admin exception (NOT YET RUN).
-- Decided by the owner on 28 Oct 2026: a complaint (and so a technician visit) can be raised
-- only while the customer is in warranty (green on Warranty customers). Out of warranty, or
-- no warranty date at all, is refused - unless an admin raises it as an exception and writes
-- why (service_issues.warranty_exception_reason).
-- This replaces the 12 Oct rule that allowed out-of-warranty complaints (tagged "Out of
-- warranty"). Complaints already raised are not touched.
--
--   * Runs after fill_service_issue_from_customer (triggers run in name order), which has
--     already worked out the warranty from the customer card (public.customer_warranty).
--   * A complaint not linked to a customer card has no warranty: refused, except by admin.
--   * Only an admin can set the exception reason, and only when raising. It shows on the
--     complaint and goes into its history.
--   * The service role and the SQL editor (no signed-in user) are not limited.
--
-- Safe to run more than once.
set lock_timeout = '8s';
begin;

alter table public.service_issues add column if not exists warranty_exception_reason text;
alter table public.service_issues drop constraint if exists service_issues_warranty_exception_reason_check;
alter table public.service_issues add constraint service_issues_warranty_exception_reason_check
    check (warranty_exception_reason is null or length(warranty_exception_reason) between 1 and 500);

create or replace function public.require_service_issue_warranty()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    reason text := nullif(btrim(coalesce(new.warranty_exception_reason, '')), '');
begin
    if auth.uid() is null then
        return new;
    end if;
    if new.warranty_status = 'in_warranty' and new.customer_id is not null then
        -- In warranty: no exception needed, so none is kept.
        new.warranty_exception_reason := null;
        return new;
    end if;
    if public.get_my_user_type() = 'admin' then
        if reason is null then
            raise exception 'This customer is not in warranty. Write why this complaint is an exception.';
        end if;
        new.warranty_exception_reason := left(reason, 500);
        return new;
    end if;
    if new.customer_id is null then
        raise exception 'Raise a complaint from the customer on Warranty customers.';
    end if;
    if new.warranty_status = 'out_of_warranty' then
        raise exception 'This customer is out of warranty (ended %). Only an admin can raise a complaint as an exception.', to_char(new.warranty_end, 'DD Mon YYYY');
    end if;
    raise exception 'This customer has no warranty date. Add the installation date on the customer card, or ask an admin.';
end;
$$;
create or replace trigger service_issue_warranty_required before insert on public.service_issues
for each row execute function public.require_service_issue_warranty();

-- The exception reason is set only when raising: nobody changes it afterwards.
create or replace function public.keep_service_issue_warranty_exception()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if auth.uid() is not null and new.warranty_exception_reason is distinct from old.warranty_exception_reason then
        raise exception 'The warranty exception reason cannot be changed.';
    end if;
    return new;
end;
$$;
create or replace trigger service_issue_warranty_exception_keep before update on public.service_issues
for each row execute function public.keep_service_issue_warranty_exception();

revoke all on function public.require_service_issue_warranty() from public, anon;
revoke all on function public.keep_service_issue_warranty_exception() from public, anon;
grant execute on function public.require_service_issue_warranty() to authenticated, service_role;
grant execute on function public.keep_service_issue_warranty_exception() to authenticated, service_role;

commit;

-- Check (expect warranty_triggers_2 and exception_column_1):
select
  (select count(*) from pg_trigger where tgrelid = 'public.service_issues'::regclass and not tgisinternal
    and tgname in ('service_issue_warranty_required', 'service_issue_warranty_exception_keep')) as warranty_triggers_2,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'service_issues'
    and column_name = 'warranty_exception_reason') as exception_column_1;
