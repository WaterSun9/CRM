-- 2026-11-16 (client meeting 2026-11-14): OEM past data.
-- The office types in the past visits of completed customers from the paper files. One row
-- = one past visit: the date if the paper has one, the site readings (volts), a replacement
-- if there was one (part: None by default, Inverter, Panel or Other) with old / new number,
-- OEM and ticket no., and comments. An inverter or panel replacement also updates the
-- customer's numbers on the card (done by the app, logged as a field change).
-- Nobody knows how many papers there are, so there is no per-customer "done": when the
-- office has typed in everything it presses "All done" once, so the developer knows the page
-- can be removed. The rows stay and show on the warranty customer, complaints and customer card.
-- Office = admin and sales. One transaction; safe to run twice.

begin;
set lock_timeout = '8s';

create table if not exists public.oem_past_records (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.admin(id) on delete cascade,
    -- The replacement on this visit: None (default), Inverter, Panel or Other (another part).
    part text not null default 'None' check (part in ('None', 'Inverter', 'Panel', 'Other')),
    claim_date date,
    -- Site readings as typed from the paper: ac_pn, ac_pe, ac_ne, dc_pm, dc_pe, dc_me (volts,
    -- text), floating (true / false). Any of them may be missing; null = no readings.
    readings jsonb check (readings is null or jsonb_typeof(readings) = 'object'),
    oem text check (oem is null or length(oem) <= 80),
    ticket_no text check (ticket_no is null or length(ticket_no) <= 80),
    old_serial text check (old_serial is null or length(old_serial) <= 120),
    new_serial text check (new_serial is null or length(new_serial) <= 120),
    notes text check (notes is null or length(notes) <= 500),
    created_by uuid default auth.uid(),
    created_by_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists oem_past_records_customer_idx on public.oem_past_records (customer_id, claim_date desc);

-- One row: the "All done" request.
create table if not exists public.oem_past_finish (
    id boolean primary key default true check (id),
    requested_at timestamptz not null default now(),
    requested_by uuid default auth.uid(),
    requested_by_name text,
    customers integer,
    records integer
);

-- Who did it: the name from the profile, set by the database. A visit without a replacement
-- keeps no numbers, OEM or ticket.
create or replace function public.oem_past_stamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    who text := (select coalesce(nullif(btrim(p.name), ''), p.email) from public.profiles p where p.id = auth.uid());
begin
    if tg_table_name = 'oem_past_records' then
        new.oem := nullif(btrim(coalesce(new.oem, '')), '');
        new.ticket_no := nullif(btrim(coalesce(new.ticket_no, '')), '');
        new.old_serial := nullif(btrim(coalesce(new.old_serial, '')), '');
        new.new_serial := nullif(btrim(coalesce(new.new_serial, '')), '');
        new.notes := nullif(btrim(coalesce(new.notes, '')), '');
        if new.part = 'None' then
            new.oem := null; new.ticket_no := null; new.old_serial := null; new.new_serial := null;
        end if;
        if new.readings = '{}'::jsonb then
            new.readings := null;
        end if;
        if new.claim_date is null and new.readings is null and new.notes is null and new.part = 'None' then
            raise exception 'Fill in at least one thing: a date, a reading, a replacement or a comment.';
        end if;
        new.updated_at := now();
        if tg_op = 'INSERT' then
            new.created_by := auth.uid(); new.created_by_name := who; new.created_at := now();
        else
            new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
            new.customer_id := old.customer_id;
        end if;
    else
        new.requested_at := now(); new.requested_by := auth.uid(); new.requested_by_name := who;
        select count(distinct r.customer_id), count(*) into new.customers, new.records from public.oem_past_records r;
    end if;
    return new;
end;
$$;
drop trigger if exists oem_past_records_stamp on public.oem_past_records;
create trigger oem_past_records_stamp before insert or update on public.oem_past_records
for each row execute function public.oem_past_stamp();
drop trigger if exists oem_past_finish_stamp on public.oem_past_finish;
create trigger oem_past_finish_stamp before insert or update on public.oem_past_finish
for each row execute function public.oem_past_stamp();

alter table public.oem_past_records enable row level security;
alter table public.oem_past_finish enable row level security;

drop policy if exists oem_past_records_office on public.oem_past_records;
create policy oem_past_records_office on public.oem_past_records for all to authenticated
using ((select public.get_my_user_type()) in ('admin', 'sales'))
with check ((select public.get_my_user_type()) in ('admin', 'sales'));
drop policy if exists oem_past_finish_office on public.oem_past_finish;
create policy oem_past_finish_office on public.oem_past_finish for all to authenticated
using ((select public.get_my_user_type()) in ('admin', 'sales'))
with check ((select public.get_my_user_type()) in ('admin', 'sales'));

grant select, insert, update, delete on public.oem_past_records, public.oem_past_finish to authenticated;
revoke all on public.oem_past_records, public.oem_past_finish from anon;

-- Past visits of a complaint's customer, for whoever can see that complaint
-- (office, the technician on it, the partner): shown with the earlier complaints.
drop function if exists public.service_customer_oem_past(uuid);
create function public.service_customer_oem_past(p_issue_id uuid)
returns table(id uuid, part text, claim_date date, readings jsonb, oem text, ticket_no text, old_serial text, new_serial text, notes text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.service_job_visible(p_issue_id) then
        return;
    end if;
    return query
    select r.id, r.part, r.claim_date, r.readings, r.oem, r.ticket_no, r.old_serial, r.new_serial, r.notes
    from public.service_issues issue
    join public.oem_past_records r on r.customer_id = issue.customer_id
    where issue.id = p_issue_id and issue.customer_id is not null
    order by r.claim_date desc nulls last, r.created_at desc
    limit 50;
end;
$$;
revoke all on function public.service_customer_oem_past(uuid) from public, anon;
grant execute on function public.service_customer_oem_past(uuid) to authenticated;
revoke all on function public.oem_past_stamp() from public, anon;

commit;

-- Check: expect 2 tables with RLS on.
select relname, relrowsecurity from pg_class
where oid in ('public.oem_past_records'::regclass, 'public.oem_past_finish'::regclass);
