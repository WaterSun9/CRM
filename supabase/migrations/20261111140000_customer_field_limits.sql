-- Customer field limits, 11 Nov 2026.
--
-- The admin (customer) table let partners, dealers, vendors and stamp makers
-- change ANY field on the customers they can see - the limits were only in the
-- screens. Someone using the API directly could mark a job COMPLETED, move the
-- installation date (which extends the warranty), change the phone number that
-- completion codes go to, or edit payments.
--
-- This adds a per-role list of fields each role may change, and a guard on
-- every customer update. It starts in WATCH mode: nothing is blocked, anything
-- outside the list is only written to admin_field_guard_log. After a week of
-- normal work, check the log (queries at the bottom), add any real field that
-- is missing, then switch to BLOCK mode.
--
-- Not limited: Admin and Office (sales), the database's own functions (move
-- stage and the like run as their owner), and server-side jobs with no login.
-- Nothing existing is changed. Safe to run more than once.

-- 1. Which fields each role may change -----------------------------------------
create table if not exists public.admin_field_rules (
    user_type text not null,
    field     text not null,
    note      text,
    primary key (user_type, field)
);
alter table public.admin_field_rules enable row level security;
drop policy if exists admin_field_rules_read on public.admin_field_rules;
create policy admin_field_rules_read on public.admin_field_rules for select to authenticated
    using ((select public.get_my_user_type()) = 'admin');
revoke all on public.admin_field_rules from anon, authenticated;
grant select on public.admin_field_rules to authenticated;

-- Seeded from what each role really changed in the last 180 days (the change
-- history the database already keeps). Review this list before blocking - a
-- field that was changed by misuse would be in it too.
insert into public.admin_field_rules (user_type, field, note)
select distinct p.user_type, k.field, 'seen in history'
from public.admin_history h
join public.profiles p on p.id = h.changed_by
cross join lateral jsonb_object_keys(h.changes) as k(field)
where h.action = 'UPDATE'
  and h.changed_at > now() - interval '180 days'
  and p.user_type in ('channel_partner_office', 'office2', 'agent', 'agent2', 'vendor', 'stamp', 'technician')
  and k.field not in ('updated_at', 'completed_at')
on conflict do nothing;

-- 2. Watch or block --------------------------------------------------------------
create table if not exists public.admin_field_guard_settings (
    id   boolean primary key default true check (id),
    mode text not null default 'watch' check (mode in ('watch', 'block'))
);
insert into public.admin_field_guard_settings (id, mode) values (true, 'watch') on conflict do nothing;
alter table public.admin_field_guard_settings enable row level security;
revoke all on public.admin_field_guard_settings from anon, authenticated;

-- 3. What was changed outside the list -------------------------------------------
create table if not exists public.admin_field_guard_log (
    id          bigint generated always as identity primary key,
    at          timestamptz not null default now(),
    user_id     uuid,
    user_type   text,
    customer_id uuid,
    fields      text[] not null,
    blocked     boolean not null
);
alter table public.admin_field_guard_log enable row level security;
drop policy if exists admin_field_guard_log_read on public.admin_field_guard_log;
create policy admin_field_guard_log_read on public.admin_field_guard_log for select to authenticated
    using ((select public.get_my_user_type()) = 'admin');
revoke all on public.admin_field_guard_log from anon, authenticated;
grant select on public.admin_field_guard_log to authenticated;

-- 4. The guard ---------------------------------------------------------------------
-- Two parts. The trigger runs as whoever made the change, so it can tell a direct
-- update by a logged-in user (current_user = 'authenticated') from one made inside
-- the database's own functions (move stage and the like run as their owner). The
-- checking and logging live in a private schema the API cannot reach.
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create or replace function app_private.admin_field_check(p_old jsonb, p_new jsonb, p_customer uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_type   text := public.get_my_user_type();
    v_mode   text;
    v_fields text[];
begin
    if auth.uid() is null or v_type in ('admin', 'sales') then
        return;
    end if;

    select array_agg(n.key order by n.key) into v_fields
    from jsonb_each(p_new) n
    where n.value is distinct from (p_old -> n.key)
      and n.key not in ('updated_at', 'completed_at')
      and not exists (select 1 from public.admin_field_rules r
                      where r.user_type = coalesce(v_type, '') and r.field = n.key);

    if v_fields is null then
        return;
    end if;

    select mode into v_mode from public.admin_field_guard_settings where id;
    v_mode := coalesce(v_mode, 'watch');
    insert into public.admin_field_guard_log (user_id, user_type, customer_id, fields, blocked)
    values (auth.uid(), v_type, p_customer, v_fields, v_mode = 'block');

    if v_mode = 'block' then
        raise exception 'Not permitted: your account cannot change % on a customer. Ask the office.',
            array_to_string(v_fields, ', ')
            using errcode = '42501';
    end if;
end;
$function$;
revoke all on function app_private.admin_field_check(jsonb, jsonb, uuid) from public, anon;
grant execute on function app_private.admin_field_check(jsonb, jsonb, uuid) to authenticated;

create or replace function public.admin_field_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
    if current_user = 'authenticated' then
        perform app_private.admin_field_check(to_jsonb(old), to_jsonb(new), old.id);
    end if;
    return new;
end;
$function$;

-- Named to run after the updated_at / completed_at triggers (they run in name order).
drop trigger if exists zz_admin_field_guard on public.admin;
create trigger zz_admin_field_guard
    before update on public.admin
    for each row execute function public.admin_field_guard();

-- ---------------------------------------------------------------------------------
-- RIGHT AFTER RUNNING: the seeded list, per role. Look for fields a role should
-- never change (stage for vendors, installation_date, phone_number, payment
-- fields, deleted_at...) and delete those rows.
--   select user_type, string_agg(field, ', ' order by field) from public.admin_field_rules
--   group by 1 order by 1;
--
-- AFTER A WEEK: what would have been blocked.
--   select user_type, unnest(fields) as field, count(*) as times, max(at) as last
--   from public.admin_field_guard_log group by 1, 2 order by 1, 3 desc;
-- A real field from a screen: allow it with
--   insert into public.admin_field_rules (user_type, field, note) values ('agent2', '<field>', 'screen');
--
-- THEN BLOCK:   update public.admin_field_guard_settings set mode = 'block';
-- UNDO BLOCK:   update public.admin_field_guard_settings set mode = 'watch';
-- REMOVE ALL:   drop trigger if exists zz_admin_field_guard on public.admin;
