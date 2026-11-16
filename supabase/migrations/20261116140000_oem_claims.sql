-- 2026-11-16 (client meeting 2026-11-14, D-033): OEM replacement claims, all OEMs except Tata.
-- When the technician finds a part faulty (e.g. the inverter), the office starts an OEM claim on
-- the complaint: OEM, part, faulty serial no. It downloads the OEM data PDF (customer, site,
-- readings, photos) and sends it to the OEM, then enters the OEM ticket no. (the technician on
-- the job can enter it too). When the new part arrives the office marks "Part received" and the
-- technician fixes it on the second visit. Tata (CSN / CRN, Rs 800 per site) comes later, once
-- Sandeep sends Tata's form.
-- Office (admin, sales) does everything; the technician on the job and anyone who can see the
-- complaint can read it. Each step goes into the complaint history.
-- One transaction; safe to run twice.

begin;
set lock_timeout = '8s';

create table if not exists public.service_oem_claims (
    id uuid primary key default gen_random_uuid(),
    issue_id uuid not null references public.service_issues(id) on delete cascade,
    oem text not null check (length(btrim(oem)) between 1 and 80),
    part text not null default 'Inverter' check (part in ('Inverter', 'Panel', 'Other')),
    faulty_serial text check (faulty_serial is null or length(faulty_serial) <= 120),
    notes text check (notes is null or length(notes) <= 500),
    pdf_sent_at timestamptz,
    ticket_no text check (ticket_no is null or length(ticket_no) <= 80),
    ticket_at timestamptz,
    part_received_at timestamptz,
    created_by uuid default auth.uid(),
    created_by_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists service_oem_claims_issue_idx on public.service_oem_claims (issue_id, created_at);

-- Complaint history: the claim steps.
alter table public.service_issue_events drop constraint if exists service_issue_events_event_check;
alter table public.service_issue_events add constraint service_issue_events_event_check check (event in (
    'raised', 'assigned', 'claimed', 'visited', 'second_visit', 'code_sent', 'completed', 'cancelled',
    'reopened', 'gave_up', 'returned',
    'trip_started', 'reached', 'readings', 'fixed', 'revisit', 'inverter_added', 'inverter_replaced',
    'oem_claim', 'oem_pdf_sent', 'oem_ticket', 'oem_part_received'));

-- Clean values, who started it, and one history line per step.
create or replace function public.service_oem_claim_stamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    what text;
begin
    new.oem := btrim(new.oem);
    new.faulty_serial := nullif(btrim(coalesce(new.faulty_serial, '')), '');
    new.notes := nullif(btrim(coalesce(new.notes, '')), '');
    new.ticket_no := nullif(btrim(coalesce(new.ticket_no, '')), '');
    new.updated_at := now();
    if tg_op = 'INSERT' then
        new.created_by := auth.uid();
        new.created_by_name := (select p.name from public.profiles p where p.id = auth.uid());
        new.created_at := now();
        new.pdf_sent_at := null; new.ticket_at := null; new.part_received_at := null;
        if new.ticket_no is not null then new.ticket_at := now(); end if;
    else
        new.issue_id := old.issue_id; new.created_by := old.created_by;
        new.created_by_name := old.created_by_name; new.created_at := old.created_at;
        if new.ticket_no is distinct from old.ticket_no then
            new.ticket_at := case when new.ticket_no is null then null else now() end;
        end if;
    end if;
    what := new.part || ' · ' || new.oem || coalesce(' · faulty ' || new.faulty_serial, '');
    if tg_op = 'INSERT' then
        perform public.add_service_event(new.issue_id, 'oem_claim', what);
        if new.ticket_no is not null then
            perform public.add_service_event(new.issue_id, 'oem_ticket', new.oem || ' ticket ' || new.ticket_no);
        end if;
    else
        if new.pdf_sent_at is not null and old.pdf_sent_at is null then
            perform public.add_service_event(new.issue_id, 'oem_pdf_sent', what);
        end if;
        if new.ticket_no is not null and new.ticket_no is distinct from old.ticket_no then
            perform public.add_service_event(new.issue_id, 'oem_ticket', new.oem || ' ticket ' || new.ticket_no);
        end if;
        if new.part_received_at is not null and old.part_received_at is null then
            perform public.add_service_event(new.issue_id, 'oem_part_received', what);
        end if;
    end if;
    return new;
end;
$$;
drop trigger if exists service_oem_claims_stamp on public.service_oem_claims;
create trigger service_oem_claims_stamp before insert or update on public.service_oem_claims
for each row execute function public.service_oem_claim_stamp();

alter table public.service_oem_claims enable row level security;

drop policy if exists service_oem_claims_read on public.service_oem_claims;
create policy service_oem_claims_read on public.service_oem_claims for select to authenticated
using ((select public.get_my_user_type()) in ('admin', 'sales') or public.service_job_visible(issue_id));
drop policy if exists service_oem_claims_office on public.service_oem_claims;
create policy service_oem_claims_office on public.service_oem_claims for all to authenticated
using ((select public.get_my_user_type()) in ('admin', 'sales'))
with check ((select public.get_my_user_type()) in ('admin', 'sales'));

grant select, insert, update, delete on public.service_oem_claims to authenticated;
revoke all on public.service_oem_claims from anon;

-- The technician on the job enters the OEM ticket no. (only that field).
create or replace function public.service_oem_ticket(p_claim_id uuid, p_ticket text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    claim record;
    ticket text := nullif(btrim(coalesce(p_ticket, '')), '');
begin
    select c.id, c.issue_id into claim from public.service_oem_claims c where c.id = p_claim_id;
    if not found then
        raise exception 'OEM claim not found. Refresh the page.';
    end if;
    perform public.require_my_open_job(claim.issue_id);
    if ticket is null or length(ticket) > 80 then
        raise exception 'Type the OEM ticket number (up to 80 characters).';
    end if;
    update public.service_oem_claims set ticket_no = ticket where id = claim.id;
    return true;
end;
$$;
revoke all on function public.service_oem_ticket(uuid, text) from public, anon;
grant execute on function public.service_oem_ticket(uuid, text) to authenticated;
revoke all on function public.service_oem_claim_stamp() from public, anon;

commit;

-- Check: expect claims_table = 1, rls = true, events_ok = true.
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'service_oem_claims') as claims_table,
  (select relrowsecurity from pg_class where oid = 'public.service_oem_claims'::regclass) as rls,
  (select pg_get_constraintdef(oid) like '%oem_part_received%' from pg_constraint where conname = 'service_issue_events_event_check') as events_ok;
