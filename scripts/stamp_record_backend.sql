-- ============================================================================
-- Stamp completion record — backend support
--
-- No new columns are needed. The data already exists inside admin.discom_submission:
--   sent_to_stamp_maker      / sent_to_stamp_maker_at   (we sent it)
--   stamp_sent               / stamp_completed_at       (they finished it)
--   stamp_approved           / stamp_approved_at        (we approved it)
--
-- This adds (1) indexes so the lookups stay fast, (2) RLS so the stamp maker
-- can still SEE their finished work, and (3) one RPC giving the monthly totals
-- both sides reconcile against.
-- ============================================================================

begin;

-- ── 1. Indexes ──────────────────────────────────────────────────────────────
-- discom_submission is `json` (not jsonb), so index the extracted text.
-- Without these, every portal load and every monthly report scans all 3,800+ rows.
create index if not exists idx_admin_sent_to_stamp_maker
    on public.admin ((discom_submission ->> 'sent_to_stamp_maker'))
    where deleted_at is null;

create index if not exists idx_admin_stamp_sent
    on public.admin ((discom_submission ->> 'stamp_sent'))
    where deleted_at is null;


-- ── 2. RLS: the stamp maker must keep seeing what they finished ─────────────
-- IMPORTANT: if the existing stamp policy is scoped to "not yet stamped", the
-- My Record tab will come back empty. This policy covers everything ever sent
-- to the stamp maker, finished or not. Inspect what you have first:
--
--   select policyname, cmd, qual from pg_policies
--   where schemaname='public' and tablename='admin';
--
-- Then, only if the stamp role cannot read completed rows, apply:
--
-- drop policy if exists "admin_select_stamp_scoped" on public.admin;
-- create policy "admin_select_stamp_scoped" on public.admin
--     for select to authenticated
--     using (
--         get_my_user_type() = 'stamp'
--         and deleted_at is null
--         and discom_submission ->> 'sent_to_stamp_maker' = 'true'
--     );


-- ── 3. Monthly totals, for both sides to reconcile ──────────────────────────
-- Returns one row per month: how many we SENT, how many they COMPLETED, and
-- how many we then APPROVED. security definer so the stamp role gets its own
-- totals without needing broader read access.
create or replace function public.stamp_monthly_summary()
returns table (
    month_key       text,
    month_label     text,
    sent_count      bigint,
    completed_count bigint,
    approved_count  bigint
)
language sql
security definer
set search_path = public
as $$
    with base as (
        select
            nullif(discom_submission ->> 'sent_to_stamp_maker_at', '')::timestamptz as sent_at,
            nullif(discom_submission ->> 'stamp_completed_at', '')::timestamptz     as completed_at,
            nullif(discom_submission ->> 'stamp_approved_at', '')::timestamptz      as approved_at
        from public.admin
        where deleted_at is null
          and discom_submission ->> 'sent_to_stamp_maker' = 'true'
    ),
    months as (
        select distinct to_char(d, 'YYYY-MM') as month_key
        from (
            select sent_at as d from base where sent_at is not null
            union all
            select completed_at from base where completed_at is not null
            union all
            select approved_at from base where approved_at is not null
        ) x
    )
    select
        m.month_key,
        to_char(to_date(m.month_key, 'YYYY-MM'), 'FMMonth YYYY') as month_label,
        (select count(*) from base b where to_char(b.sent_at,      'YYYY-MM') = m.month_key) as sent_count,
        (select count(*) from base b where to_char(b.completed_at, 'YYYY-MM') = m.month_key) as completed_count,
        (select count(*) from base b where to_char(b.approved_at,  'YYYY-MM') = m.month_key) as approved_count
    from months m
    order by m.month_key desc;
$$;

grant execute on function public.stamp_monthly_summary() to authenticated, service_role;

commit;


-- ── 4. Verify (read only) ───────────────────────────────────────────────────
-- Monthly reconciliation. sent_count vs completed_count is the cross-check.
select * from public.stamp_monthly_summary();

-- Every completed stamp with its date - the payment backup.
select
    customer_name,
    consumer_no,
    (discom_submission ->> 'stamp_completed_at')::timestamptz as completed_at,
    discom_submission ->> 'stamp_completed_by'                as completed_by,
    coalesce(discom_submission ->> 'stamp_approved', 'false') as approved
from public.admin
where deleted_at is null
  and discom_submission ->> 'stamp_sent' = 'true'
order by completed_at desc nulls last;
