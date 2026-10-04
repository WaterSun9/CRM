-- WaterSun CRM — LIVE DATABASE SNAPSHOT (READ-ONLY)
-- Project: cjskyhxameobcqlfiuav. Paste into the SQL Editor and run.
-- Every statement is a SELECT. Nothing is created, changed or deleted.
-- Run it as ONE query: the result is a single table (section | name | detail).
-- Export the result as CSV (or copy all rows) and send it back.

with
-- 1. Row-level-security policies on every public table
pol as (
  select '1_policy'::text as section,
         tablename || ' . ' || policyname as name,
         cmd || ' | roles=' || array_to_string(roles, ',') ||
         ' | USING: ' || coalesce(qual, '-') ||
         ' | CHECK: ' || coalesce(with_check, '-') as detail
  from pg_policies where schemaname in ('public', 'storage')
),
-- 2. Is RLS switched on, per table
rls as (
  select '2_rls', c.relname,
         'rls=' || c.relrowsecurity || ' forced=' || c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
-- 3. Every public function: definer rights, who can execute, full body
fn as (
  select '3_function',
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'definer=' || p.prosecdef ||
         ' | anon_exec=' || has_function_privilege('anon', p.oid, 'execute') ||
         ' | auth_exec=' || has_function_privilege('authenticated', p.oid, 'execute') ||
         E'\n' || pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
),
-- 4. Triggers on public tables
trg as (
  select '4_trigger', c.relname || ' . ' || t.tgname, pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
),
-- 5. Columns of the main tables (types matter: phone_number, project_ids)
col as (
  select '5_column', table_name || ' . ' || column_name,
         data_type || ' / ' || udt_name || ' | null=' || is_nullable ||
         ' | default=' || coalesce(column_default, '-')
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('admin', 'profiles', 'delivery_batches', 'bom', 'bom_items',
                       'documents', 'activity_log', 'vendors', 'drivers', 'quotations')
),
-- 6. Constraints (unique / check / FK) on public tables
con as (
  select '6_constraint', conrelid::regclass::text || ' . ' || conname,
         pg_get_constraintdef(oid)
  from pg_constraint
  where connamespace = 'public'::regnamespace
),
-- 7. Do the tables the new code needs exist?
need as (
  select '7_needed_table', t,
         coalesce(to_regclass('public.' || t)::text, 'MISSING')
  from unnest(array['crm_chat_messages', 'crm_availability', 'service_issues',
                    'service_visits', 'service_issue_files',
                    'customer_payment_review_flags', 'restore_backup_2026_10_01',
                    'delivery_batches', 'drivers', 'quotations']) as t
),
-- 8. Storage buckets
bkt as (
  select '8_bucket', id, 'public=' || public || ' | limit=' || coalesce(file_size_limit::text, '-')
  from storage.buckets
),
-- 9. Audit spot checks (counts only, no personal data)
chk as (
  select '9_check', 'logins_without_profile (S2)',
         (select count(*)::text from auth.users u left join public.profiles p on p.id = u.id where p.id is null)
  union all
  select '9_check', 'branch_office_with_blank_branch (S7)',
         (select count(*)::text from public.profiles
          where user_type in ('channel_partner_office', 'office2')
            and coalesce(trim(channel_partner), '') = '')
  union all
  select '9_check', 'profiles_by_user_type',
         (select string_agg(user_type || '=' || n, ', ') from
           (select coalesce(user_type, 'NULL') as user_type, count(*) n
            from public.profiles group by 1 order by 1) s)
  union all
  select '9_check', 'customers_with_more_than_one_bom_parent',
         (select count(*)::text from (select admin_id from public.bom
                                      group by admin_id having count(*) > 1) d)
  union all
  select '9_check', 'admin_rows_total / not_deleted',
         (select count(*) || ' / ' || count(*) filter (where deleted_at is null) from public.admin)
)
select * from pol union all select * from rls union all select * from fn
union all select * from trg union all select * from col union all select * from con
union all select * from need union all select * from bkt union all select * from chk
order by 1, 2;
