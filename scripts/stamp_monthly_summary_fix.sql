-- ============================================================================
-- FIX: stamp_monthly_summary() over-counted completed and approved stamps.
--
-- The first version counted any row carrying a stamp_completed_at /
-- stamp_approved_at timestamp. But sending a stamp back for rework sets
-- stamp_sent = false and stamp_approved = false WITHOUT clearing those
-- timestamps, so a rejected-and-returned stamp still counted as completed
-- and approved. That inflates the number monthly payment is based on.
--
-- This version counts CURRENT state, so it reconciles exactly with the
-- "My Record" tab in the Stamp Portal and with the per-stamp detail query.
-- A sent_back_count column makes the rework visible instead of it silently
-- disappearing from the totals.
-- ============================================================================

-- Adding the sent_back_count column changes the function's return type, and
-- Postgres refuses that via CREATE OR REPLACE. Drop first, then recreate.
drop function if exists public.stamp_monthly_summary();

create function public.stamp_monthly_summary()
returns table (
    month_key       text,
    month_label     text,
    sent_count      bigint,
    completed_count bigint,
    approved_count  bigint,
    sent_back_count bigint
)
language sql
security definer
set search_path = public
as $$
    with base as (
        select
            coalesce(discom_submission ->> 'stamp_sent', 'false')     as stamp_sent,
            coalesce(discom_submission ->> 'stamp_approved', 'false') as stamp_approved,
            nullif(discom_submission ->> 'sent_to_stamp_maker_at', '')::timestamptz as sent_at,
            nullif(discom_submission ->> 'stamp_completed_at', '')::timestamptz     as completed_at,
            nullif(discom_submission ->> 'stamp_approved_at', '')::timestamptz      as approved_at,
            nullif(discom_submission ->> 'stamp_sendback_at', '')::timestamptz      as sendback_at
        from public.admin
        where deleted_at is null
          and discom_submission ->> 'sent_to_stamp_maker' = 'true'
    ),
    months as (
        select distinct to_char(d, 'YYYY-MM') as month_key
        from (
            select sent_at      as d from base where sent_at      is not null
            union all select completed_at from base where completed_at is not null
            union all select approved_at  from base where approved_at  is not null
            union all select sendback_at  from base where sendback_at  is not null
        ) x
    )
    select
        m.month_key,
        to_char(to_date(m.month_key, 'YYYY-MM'), 'FMMonth YYYY') as month_label,
        (select count(*) from base b
          where to_char(b.sent_at, 'YYYY-MM') = m.month_key)                                  as sent_count,
        -- Only stamps that are CURRENTLY complete. A sent-back stamp drops out
        -- until the stamp maker finishes it again.
        (select count(*) from base b
          where b.stamp_sent = 'true'
            and to_char(b.completed_at, 'YYYY-MM') = m.month_key)                             as completed_count,
        (select count(*) from base b
          where b.stamp_approved = 'true'
            and to_char(b.approved_at, 'YYYY-MM') = m.month_key)                              as approved_count,
        (select count(*) from base b
          where to_char(b.sendback_at, 'YYYY-MM') = m.month_key)                              as sent_back_count
    from months m
    order by m.month_key desc;
$$;

grant execute on function public.stamp_monthly_summary() to authenticated, service_role;


-- ── Verify: completed_count must now equal the detail list's row count ──────
select * from public.stamp_monthly_summary();

-- The one that was sent back after being completed — this is the row that
-- caused the 6-vs-5 gap. EXPECT: 1 row.
select
    customer_name,
    consumer_no,
    (discom_submission ->> 'stamp_completed_at')::timestamptz as originally_completed,
    (discom_submission ->> 'stamp_sendback_at')::timestamptz  as sent_back_at,
    discom_submission ->> 'stamp_sendback_by'                 as sent_back_by,
    discom_submission ->> 'stamp_sendback_remark'             as reason
from public.admin
where deleted_at is null
  and coalesce(discom_submission ->> 'stamp_sent', 'false') <> 'true'
  and nullif(discom_submission ->> 'stamp_completed_at', '') is not null
order by sent_back_at desc nulls last;
