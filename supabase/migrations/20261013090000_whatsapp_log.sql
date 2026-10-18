-- WhatsApp log: every template message the CRM sends, replies from customers, and
-- numbers Meta says are not on WhatsApp (NOT YET RUN - needs the owner's go-ahead).
-- Run AFTER 20261012190000_service_jobs_v2.sql. Background: docs/TECHNICIAN_PLAN.md.
--
--   * whatsapp_messages: one row per template message (completion code, "work
--     completed", lead to vendor, quotation PDF). Written by the edge functions
--     (supabase/functions/_shared/whatsapp.ts) BEFORE the message goes to Meta, then
--     marked sent / failed; the whatsapp-webhook function moves it on to delivered /
--     read. Template values (the code, names, phones in the text) are never stored.
--     The per-hour limits count these rows.
--   * whatsapp_inbound: what customers write back (incl. "Yes, solved" / "Not solved"),
--     linked to the complaint or quotation they replied to.
--   * whatsapp_contacts: numbers Meta reported as not on WhatsApp (error 131026), and
--     when the one-a-day auto-reply last went out.
--   * Only the edge functions (service role) write. Admin and office (sales) can read
--     everything; anyone else can read only the messages they sent themselves.
--
-- Safe to run more than once. After running, regenerate supabase/schema.sql.
set lock_timeout = '8s';
begin;

-- 1. Sent messages ---------------------------------------------------------------

create table if not exists public.whatsapp_messages (
    id uuid primary key default gen_random_uuid(),
    wamid text unique,
    kind text not null,
    template text not null,
    to_phone text not null,
    intended_phone text not null,
    test_mode boolean not null default false,
    issue_id uuid references public.service_issues(id) on delete set null,
    customer_id uuid references public.admin(id) on delete set null,
    quotation_id uuid references public.quotations(id) on delete set null,
    vendor_id uuid references public.vendors(id) on delete set null,
    -- Set null when a login is deleted, so old sends never block removing a user.
    sent_by uuid references auth.users(id) on delete set null,
    status text not null default 'sending',
    error_code integer,
    error_text text,
    status_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_kind_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_kind_check
    check (kind in ('completion_code', 'completion_notice', 'vendor_lead', 'quotation'));
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_status_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_status_check
    check (status in ('sending', 'sent', 'delivered', 'read', 'failed'));
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_template_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_template_check
    check (template ~ '^[a-z0-9_]+$' and length(template) <= 512);
-- The number it went to (WA_TEST_TO while testing) and the customer / vendor it was for
-- ('' when a test send had no real number).
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_to_phone_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_to_phone_check
    check (to_phone ~ '^[6-9][0-9]{9}$');
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_intended_phone_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_intended_phone_check
    check (intended_phone = '' or intended_phone ~ '^[6-9][0-9]{9}$');
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_error_text_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_error_text_check
    check (length(error_text) <= 500);
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_wamid_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_wamid_check
    check (length(wamid) between 1 and 200);

create index if not exists whatsapp_messages_issue_idx on public.whatsapp_messages (issue_id) where issue_id is not null;
create index if not exists whatsapp_messages_quotation_idx on public.whatsapp_messages (quotation_id) where quotation_id is not null;
create index if not exists whatsapp_messages_customer_idx on public.whatsapp_messages (customer_id) where customer_id is not null;
create index if not exists whatsapp_messages_created_idx on public.whatsapp_messages (created_at desc);
-- Per-hour limit per sender (quotations) and the "own rows" read rule.
create index if not exists whatsapp_messages_sent_by_idx on public.whatsapp_messages (sent_by, created_at desc) where sent_by is not null;
-- The webhook links a typed reply to the last message sent to that number.
create index if not exists whatsapp_messages_to_phone_idx on public.whatsapp_messages (to_phone, created_at desc);

-- 2. Replies from customers -------------------------------------------------------

create table if not exists public.whatsapp_inbound (
    id uuid primary key default gen_random_uuid(),
    wamid text not null unique,
    from_phone text not null,
    message_type text not null,
    body text,
    button_text text,
    context_wamid text,
    reply_to_message_id uuid references public.whatsapp_messages(id) on delete set null,
    issue_id uuid references public.service_issues(id) on delete set null,
    quotation_id uuid references public.quotations(id) on delete set null,
    received_at timestamptz not null,
    created_at timestamptz not null default now()
);

alter table public.whatsapp_inbound drop constraint if exists whatsapp_inbound_body_check;
alter table public.whatsapp_inbound add constraint whatsapp_inbound_body_check check (length(body) <= 4000);
alter table public.whatsapp_inbound drop constraint if exists whatsapp_inbound_button_text_check;
alter table public.whatsapp_inbound add constraint whatsapp_inbound_button_text_check check (length(button_text) <= 500);
-- 10-digit Indian mobile, or the full international number for anyone else.
alter table public.whatsapp_inbound drop constraint if exists whatsapp_inbound_from_phone_check;
alter table public.whatsapp_inbound add constraint whatsapp_inbound_from_phone_check check (from_phone ~ '^[0-9]{5,20}$');
alter table public.whatsapp_inbound drop constraint if exists whatsapp_inbound_message_type_check;
alter table public.whatsapp_inbound add constraint whatsapp_inbound_message_type_check check (length(message_type) between 1 and 40);
alter table public.whatsapp_inbound drop constraint if exists whatsapp_inbound_wamid_check;
alter table public.whatsapp_inbound add constraint whatsapp_inbound_wamid_check check (length(wamid) between 1 and 200);
alter table public.whatsapp_inbound drop constraint if exists whatsapp_inbound_context_wamid_check;
alter table public.whatsapp_inbound add constraint whatsapp_inbound_context_wamid_check check (length(context_wamid) <= 200);

create index if not exists whatsapp_inbound_issue_idx on public.whatsapp_inbound (issue_id, received_at desc) where issue_id is not null;
create index if not exists whatsapp_inbound_quotation_idx on public.whatsapp_inbound (quotation_id, received_at desc) where quotation_id is not null;
create index if not exists whatsapp_inbound_from_idx on public.whatsapp_inbound (from_phone, received_at desc);
create index if not exists whatsapp_inbound_received_idx on public.whatsapp_inbound (received_at desc);

-- 3. Numbers ----------------------------------------------------------------------

create table if not exists public.whatsapp_contacts (
    phone text primary key,
    not_on_whatsapp_at timestamptz,
    last_error_code integer,
    auto_reply_at timestamptz,
    updated_at timestamptz not null default now()
);
alter table public.whatsapp_contacts drop constraint if exists whatsapp_contacts_phone_check;
alter table public.whatsapp_contacts add constraint whatsapp_contacts_phone_check check (phone ~ '^[6-9][0-9]{9}$');

-- 4. Access rules -------------------------------------------------------------------
-- No insert / update / delete for the app at all: only the edge functions write.

alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_inbound enable row level security;
alter table public.whatsapp_contacts enable row level security;

revoke all on public.whatsapp_messages from public, anon, authenticated;
revoke all on public.whatsapp_inbound from public, anon, authenticated;
revoke all on public.whatsapp_contacts from public, anon, authenticated;
grant all on public.whatsapp_messages to service_role;
grant all on public.whatsapp_inbound to service_role;
grant all on public.whatsapp_contacts to service_role;
grant select on public.whatsapp_messages to authenticated;
grant select on public.whatsapp_inbound to authenticated;
grant select on public.whatsapp_contacts to authenticated;

drop policy if exists whatsapp_messages_office_read on public.whatsapp_messages;
create policy whatsapp_messages_office_read on public.whatsapp_messages
for select to authenticated using ((select public.get_my_user_type()) in ('admin', 'sales'));
-- Lets a partner see whether the quotation they sent was delivered or read.
drop policy if exists whatsapp_messages_own_read on public.whatsapp_messages;
create policy whatsapp_messages_own_read on public.whatsapp_messages
for select to authenticated using (sent_by = (select auth.uid()));

drop policy if exists whatsapp_inbound_office_read on public.whatsapp_inbound;
create policy whatsapp_inbound_office_read on public.whatsapp_inbound
for select to authenticated using ((select public.get_my_user_type()) in ('admin', 'sales'));

drop policy if exists whatsapp_contacts_office_read on public.whatsapp_contacts;
create policy whatsapp_contacts_office_read on public.whatsapp_contacts
for select to authenticated using ((select public.get_my_user_type()) in ('admin', 'sales'));

commit;

-- Check (expect 3 tables with RLS on, the 4 read policies, and no insert/update/delete
-- rights for anon or authenticated):
-- select relname, relrowsecurity from pg_class
--  where oid in ('public.whatsapp_messages'::regclass, 'public.whatsapp_inbound'::regclass, 'public.whatsapp_contacts'::regclass);
-- select tablename, policyname, cmd from pg_policies where tablename like 'whatsapp\_%' order by 1, 2;
-- select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) from information_schema.role_table_grants
--  where table_name like 'whatsapp\_%' and grantee in ('anon', 'authenticated') group by 1, 2 order by 1, 2;
