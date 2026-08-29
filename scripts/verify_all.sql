-- ============================================================================
-- ONE-SHOT VERIFICATION - everything from this session, single result grid.
-- READ ONLY. Nothing here writes or changes anything.
-- Paste the whole thing and Run. Every row should say PASS.
-- ============================================================================

with
drivers_table as (
    select count(*) n from information_schema.tables
    where table_schema='public' and table_name='drivers'
),
drivers_policies as (
    select count(*) n from pg_policies
    where schemaname='public' and tablename='drivers'
),
drivers_rows as (
    select count(*) n from public.drivers
),
rpcs as (
    select
        count(*) filter (where p.prosecdef
                           and 'search_path=public' = any(coalesce(p.proconfig,'{}'))) n
    from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public' and p.proname in (
        'save_delivery_batch_atomic','delete_delivery_batch_atomic',
        'update_delivery_batch_status_atomic')
),
rpc_rowcount_fix as (
    select count(*) n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public' and p.proname='update_delivery_batch_status_atomic'
      and pg_get_functiondef(p.oid) like '%projects_missing%'
),
rpc_grants as (
    select count(*) n from information_schema.routine_privileges
    where routine_schema='public' and grantee='authenticated'
      and routine_name in ('save_delivery_batch_atomic','delete_delivery_batch_atomic',
                           'update_delivery_batch_status_atomic')
),
batch_rls as (
    select count(*) n from pg_policies
    where schemaname='public' and tablename='delivery_batches'
),
feasibility_cols as (
    select count(*) n from information_schema.columns
    where table_schema='public' and table_name='admin'
      and column_name in ('vendor_feasibility','site_feasibility')
),
phantom_cols as (
    select count(*) n from information_schema.columns
    where table_schema='public' and table_name='admin'
      and column_name in ('file_status','crn','installed_by','location',
                          'google_docs','location_link','company_branch',
                          'project_type','vendor_status','bank_name','remarks')
),
desync as (
    select count(*) n from (
        select b.id
        from public.delivery_batches b
        left join lateral unnest(b.project_ids) as pid on true
        left join public.admin a on a.id::text=pid::text and a.deleted_at is null
        group by b.id, b.status
        having count(*) filter (where a.id is not null
                                  and a.delivery_status is distinct from b.status) > 0
    ) x
),
fake_vendor as (
    select (select count(*) from public.admin
             where deleted_at is null and vendor ilike '%test vendor%')
         + (select count(*) from public.delivery_batches
             where vendor ilike '%test vendor%') n
),
installed_tag as (
    select count(*) n from public.admin
    where deleted_at is null and installation_status ilike '%installed%'
)
select * from (
    select 1 ord, 'drivers table exists' chk,
           case when n=1 then 'PASS' else 'FAIL - run add_drivers_table.sql' end res,
           n::text val from drivers_table
union all select 2, 'drivers RLS policies (expect 4)',
           case when n=4 then 'PASS' else 'CHECK' end, n::text from drivers_policies
union all select 3, 'drivers rows present',
           case when n>0 then 'PASS' else 'INFO - directory empty' end, n::text from drivers_rows
union all select 4, 'batch RPCs deployed w/ search_path (expect 3)',
           case when n=3 then 'PASS' else 'FAIL - run atomic_delivery_batches.sql' end,
           n::text from rpcs
union all select 5, 'status RPC has row-count fix',
           case when n=1 then 'PASS' else 'FAIL - re-run the update_delivery_batch_status_atomic block' end,
           n::text from rpc_rowcount_fix
union all select 6, 'RPC grants to authenticated (expect 3)',
           case when n=3 then 'PASS' else 'FAIL' end, n::text from rpc_grants
union all select 7, 'delivery_batches policies (expect 4)',
           case when n=4 then 'PASS' else 'CHECK' end, n::text from batch_rls
union all select 8, 'admin.vendor_feasibility + site_feasibility (expect 2)',
           case when n=2 then 'PASS' else 'FAIL' end, n::text from feasibility_cols
union all select 9, 'no phantom columns re-added (expect 0)',
           case when n=0 then 'PASS' else 'INFO - app ignores these' end,
           n::text from phantom_cols
union all select 10,'delivery batch <-> customer desync (expect 0)',
           case when n=0 then 'PASS' else 'FAIL - investigate' end, n::text from desync
union all select 11,'fake "Test Vendor" rows (expect 0)',
           case when n=0 then 'PASS' else 'RUN cleanup_fake_vendor.sql' end,
           n::text from fake_vendor
union all select 12,'customers tagged Installed (payouts ledger source)',
           case when n>0 then 'PASS' else 'INFO - none yet' end, n::text from installed_tag
) t order by ord;
