-- Align the Dashboard sidebar tag totals with the totals shown inside each
-- tag-tracking page. This replaces only the existing read-only metrics RPC.
-- It does not insert, update, or delete customer data.

begin;

create or replace function public.get_dashboard_metrics_scoped(
    p_channel_partner text default null,
    p_dealer text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text;
    v_user_branch text;
    v_effective_partner text;
    v_effective_dealer text;
    v_total int := 0;
    v_completed int := 0;
    v_live int := 0;
    v_loan int := 0;
    v_cash int := 0;
    v_installation_count int := 0;
    v_subsidy_count int := 0;
    v_loan_tag_count int := 0;
    v_stages json;
begin
    select user_type, coalesce(nullif(trim(channel_partner), ''), trim(name), '')
    into v_role, v_user_branch
    from public.profiles
    where id = auth.uid();

    if v_role in ('channel_partner_office', 'office2', 'channel_partner_office_manager') then
        v_effective_partner := v_user_branch;
    else
        v_effective_partner := nullif(trim(p_channel_partner), '');
    end if;
    v_effective_dealer := nullif(trim(p_dealer), '');

    select
        count(*),
        count(*) filter (where upper(trim(stage)) = 'COMPLETED'),
        count(*) filter (where upper(trim(stage)) not in ('COMPLETED', 'LOST PROJECT')),
        count(*) filter (where payment_type ilike '%loan%' or (loan_tag is not null and trim(loan_tag) != '')),
        count(*) filter (where payment_type ilike '%cash%'),
        count(*) filter (
            where upper(trim(coalesce(stage, ''))) != 'COMPLETED'
              and installation_status is not null and trim(installation_status) != ''
        ),
        count(*) filter (
            where subsidy_tag is not null and trim(subsidy_tag) != ''
        ),
        count(*) filter (
            where upper(trim(coalesce(stage, ''))) != 'COMPLETED'
              and (
                  upper(trim(coalesce(stage, ''))) = 'LOAN'
                  or (loan_tag is not null and trim(loan_tag) != '')
              )
        )
    into v_total, v_completed, v_live, v_loan, v_cash,
         v_installation_count, v_subsidy_count, v_loan_tag_count
    from public.admin
    where deleted_at is null
      and (
          v_effective_partner is null
          or lower(trim(coalesce(channel_partner, ''))) = lower(trim(v_effective_partner))
          or channel_partner ilike ('%' || v_effective_partner || '%')
      )
      and (
          v_effective_dealer is null
          or lower(trim(coalesce(sub_channel_partner, ''))) = lower(v_effective_dealer)
      );

    select json_object_agg(stage_upper, count)
    into v_stages
    from (
        select upper(trim(stage)) as stage_upper, count(*) as count
        from public.admin
        where deleted_at is null
          and (
              v_effective_partner is null
              or lower(trim(coalesce(channel_partner, ''))) = lower(trim(v_effective_partner))
              or channel_partner ilike ('%' || v_effective_partner || '%')
          )
          and (
              v_effective_dealer is null
              or lower(trim(coalesce(sub_channel_partner, ''))) = lower(v_effective_dealer)
          )
        group by upper(trim(stage))
    ) s;

    return json_build_object(
        'totalProjects', v_total,
        'completedCount', v_completed,
        'liveProjects', v_live,
        'loanCount', v_loan,
        'cashCount', v_cash,
        'installationTagCount', v_installation_count,
        'subsidyTagCount', v_subsidy_count,
        'loanTagCount', v_loan_tag_count,
        'stageCounts', coalesce(v_stages, '{}'::json)
    );
end;
$$;

grant execute on function public.get_dashboard_metrics_scoped(text, text) to authenticated;

commit;

-- Verification: these three pairs must match.
select
    (public.get_dashboard_metrics_scoped(null, null)->>'installationTagCount')::int as sidebar_installation,
    count(*) filter (
        where upper(trim(coalesce(stage, ''))) != 'COMPLETED'
          and installation_status is not null and trim(installation_status) != ''
    ) as inside_installation,
    (public.get_dashboard_metrics_scoped(null, null)->>'subsidyTagCount')::int as sidebar_subsidy,
    count(*) filter (
        where subsidy_tag is not null and trim(subsidy_tag) != ''
    ) as inside_subsidy,
    (public.get_dashboard_metrics_scoped(null, null)->>'loanTagCount')::int as sidebar_loan,
    count(*) filter (
        where upper(trim(coalesce(stage, ''))) != 'COMPLETED'
          and (
              upper(trim(coalesce(stage, ''))) = 'LOAN'
              or (loan_tag is not null and trim(loan_tag) != '')
          )
    ) as inside_loan
from public.admin
where deleted_at is null;
