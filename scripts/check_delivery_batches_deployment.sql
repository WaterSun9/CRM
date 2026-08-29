-- ============================================================================
-- Delivery batches — deployment pre-flight check.  READ ONLY.
-- Run in the Supabase SQL editor.  Nothing here writes or changes anything.
-- Run each numbered block and compare against "EXPECT".
-- ============================================================================


-- ── 1. Are the three atomic functions deployed, and deployed correctly? ──────
-- EXPECT: exactly 3 rows, security = 'SECURITY DEFINER',
--         config = 'search_path=public'.
-- 0 rows  -> never deployed; every status change is using the buggy fallback.
-- 'security invoker (WRONG)' or '(no search_path set)' -> deployed from an
--         older version of the script; re-run scripts/atomic_delivery_batches.sql.
select
    p.proname                                        as function_name,
    pg_get_function_identity_arguments(p.oid)        as arguments,
    case p.prosecdef
        when true then 'SECURITY DEFINER'
        else 'security invoker (WRONG)'
    end                                              as security,
    coalesce(array_to_string(p.proconfig, ', '), '(no search_path set)') as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
        'save_delivery_batch_atomic',
        'delete_delivery_batch_atomic',
        'update_delivery_batch_status_atomic'
  )
order by p.proname;


-- ── 2. Can the app actually call them? ───────────────────────────────────────
-- EXPECT: each of the 3 functions listed with grantee 'authenticated'.
-- A function missing here exists but throws a permission error at runtime,
-- which lands you in the same buggy fallback path.
select
    r.routine_name,
    r.grantee,
    r.privilege_type
from information_schema.routine_privileges r
where r.routine_schema = 'public'
  and r.routine_name in (
        'save_delivery_batch_atomic',
        'delete_delivery_batch_atomic',
        'update_delivery_batch_status_atomic'
  )
  and r.grantee in ('authenticated', 'service_role')
order by r.routine_name, r.grantee;


-- ── 3. RLS state on delivery_batches ─────────────────────────────────────────
-- EXPECT: rls_enabled = true, and 4 policies named delivery_batches_*_scoped.
-- A leftover blanket policy (qual = 'true') beside them means RLS is not
-- actually restricting anything, because Postgres OR's permissive policies.
select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.delivery_batches'::regclass;

select
    policyname,
    cmd,
    roles::text,
    coalesce(qual, '(none)')       as using_expr,
    coalesce(with_check, '(none)') as with_check_expr
from pg_policies
where schemaname = 'public'
  and tablename  = 'delivery_batches'
order by policyname;


-- ── 4. Do the columns the app writes actually exist? ─────────────────────────
-- The current working tree saves rent_amount / car_rent_paid /
-- car_rent_paid_by / car_rent_paid_at on every batch save.
-- EXPECT: 4 rows.  Anything missing = every batch save fails.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'delivery_batches'
  and column_name in ('rent_amount', 'car_rent_paid', 'car_rent_paid_by', 'car_rent_paid_at')
order by column_name;


-- ── 5. THE REAL ANSWER: is anything out of sync right now? ───────────────────
-- Compares every batch's status against the delivery_status of the customers
-- it links to.  EXPECT: 0 rows.  Any row = live desync.
select
    b.batch_no,
    b.status                                    as batch_status,
    count(pid)                                  as linked_projects,
    count(a.id)                                 as rows_found,
    count(pid) - count(a.id)                    as missing_or_deleted,
    count(*) filter (
        where a.id is not null
          and a.delivery_status is distinct from b.status
    )                                           as out_of_sync
from public.delivery_batches b
left join lateral unnest(b.project_ids) as pid on true
left join public.admin a
       on a.id::text = pid::text
      and a.deleted_at is null
group by b.id, b.batch_no, b.status
having count(*) filter (
           where a.id is not null
             and a.delivery_status is distinct from b.status
       ) > 0
    or count(pid) <> count(a.id)
order by out_of_sync desc, b.batch_no;


-- ── 6. Which specific customers are out of sync (detail for block 5) ─────────
select
    b.batch_no,
    b.status            as batch_says,
    a.customer_name,
    a.delivery_status   as customer_says,
    a.delivery_batch_id,
    a.updated_at
from public.delivery_batches b
join lateral unnest(b.project_ids) as pid on true
join public.admin a
      on a.id::text = pid::text
     and a.deleted_at is null
where a.delivery_status is distinct from b.status
order by b.batch_no, a.customer_name;


-- ── 7. Stranded customers: point at a batch that no longer lists them ────────
-- EXPECT: 0 rows.  These are invisible to the customer picker AND to the
-- batch view — the original "delivery batches" bug class.
select
    a.customer_name,
    a.delivery_batch_id,
    a.delivery_status,
    case when b.id is null then 'batch row is gone'
         else 'batch exists but does not list this customer' end as problem
from public.admin a
left join public.delivery_batches b
       on b.batch_no = a.delivery_batch_id
       or b.id::text = a.delivery_batch_id
where a.deleted_at is null
  and a.delivery_batch_id is not null
  and (
        b.id is null
     or not (a.id::text = any(select pid::text from unnest(b.project_ids) as pid))
  )
order by a.customer_name;


-- ── 8. Is the driver-info sync trigger still in place? ───────────────────────
-- EXPECT: 1 row (sync_driver_info_to_admin on delivery_batches).
select
    t.tgname     as trigger_name,
    c.relname    as on_table,
    p.proname    as runs_function,
    case when t.tgenabled = 'D' then 'DISABLED' else 'enabled' end as state
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc  p on p.oid = t.tgfoid
where not t.tgisinternal
  and c.relname = 'delivery_batches'
order by t.tgname;
