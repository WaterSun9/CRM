-- ─── Fix CPO & Manager Metrics & RLS ──────────────────────────────────────────
-- 1. Ensure admin_select, admin_update, admin_insert on public.admin include
--    'channel_partner_office_manager' (alongside 'channel_partner_office' and 'office2').
-- 2. Ensure profiles_update_scoped and profiles_delete_scoped include
--    'channel_partner_office_manager'.
-- 3. Update get_dashboard_metrics function to correctly aggregate branch metrics
--    for CPO and Manager accounts.
-- ────────────────────────────────────────────────────────────────────────────

begin;

-- ============================================================================
-- 1. FIX ADMIN TABLE RLS FOR CPO & MANAGER
-- ============================================================================
drop policy if exists admin_select on public.admin;
create policy admin_select on public.admin
    for select to authenticated
    using (
        -- Head office sees everything
        get_my_user_type() in ('admin', 'sales')

        -- CPO and Manager: their branch
        or (get_my_user_type() in ('channel_partner_office', 'office2', 'channel_partner_office_manager')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), ''))))

        -- Agent and Sub-Agent: leads filed under their own name
        or (get_my_user_type() in ('agent', 'agent2')
            and lower(trim(coalesce(sub_channel_partner, ''))) = lower(trim(coalesce(get_my_name(), ''))))

        -- Vendor: jobs assigned to them
        or (get_my_user_type() = 'vendor'
            and lower(trim(coalesce(vendor, ''))) = lower(trim(coalesce(get_my_name(), '')))
            and deleted_at is null)

        -- Stamp maker: only records sent to stamp
        or (get_my_user_type() = 'stamp'
            and (discom_submission ->> 'sent_to_stamp_maker') = 'true')
    );

drop policy if exists admin_update on public.admin;
create policy admin_update on public.admin
    for update to authenticated
    using (
        get_my_user_type() in ('admin', 'sales')
        or (get_my_user_type() in ('channel_partner_office', 'office2', 'channel_partner_office_manager')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), ''))))
        or (get_my_user_type() in ('agent', 'agent2')
            and lower(trim(coalesce(sub_channel_partner, ''))) = lower(trim(coalesce(get_my_name(), ''))))
        or (get_my_user_type() = 'vendor'
            and lower(trim(coalesce(vendor, ''))) = lower(trim(coalesce(get_my_name(), ''))))
        or (get_my_user_type() = 'stamp'
            and (discom_submission ->> 'sent_to_stamp_maker') = 'true')
    );

drop policy if exists admin_insert on public.admin;
create policy admin_insert on public.admin
    for insert to authenticated
    with check (
        get_my_user_type() in
            ('admin', 'sales', 'agent', 'agent2', 'channel_partner_office', 'office2', 'channel_partner_office_manager')
    );


-- ============================================================================
-- 2. FIX PROFILES POLICIES FOR CPO & MANAGER
-- ============================================================================
drop policy if exists "profiles_update_scoped" on public.profiles;
create policy "profiles_update_scoped" on public.profiles
    for update to authenticated
    using (
        id = auth.uid()
        or get_my_user_type() = 'admin'
        or (
            get_my_user_type() in ('channel_partner_office', 'office2', 'channel_partner_office_manager')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), ''))))
    )
    with check (
        id = auth.uid()
        or get_my_user_type() = 'admin'
        or (
            get_my_user_type() in ('channel_partner_office', 'office2', 'channel_partner_office_manager')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), ''))))
    );

drop policy if exists "profiles_delete_scoped" on public.profiles;
create policy "profiles_delete_scoped" on public.profiles
    for delete to authenticated
    using (
        get_my_user_type() = 'admin'
        or (
            get_my_user_type() in ('channel_partner_office', 'office2', 'channel_partner_office_manager')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), ''))))
    );


-- ============================================================================
-- 3. ROBUST GET_DASHBOARD_METRICS RPC
-- ============================================================================
drop function if exists public.get_dashboard_metrics();
drop function if exists public.get_dashboard_metrics(text);

create or replace function public.get_dashboard_metrics(p_channel_partner text default null)
returns json language plpgsql security definer as $$
declare
    v_role text;
    v_user_branch text;
    v_effective_partner text;
    v_total int := 0;
    v_completed int := 0;
    v_live int := 0;
    v_loan int := 0;
    v_cash int := 0;
    v_installation_count int := 0;
    v_subsidy_count int := 0;
    v_stages json;
begin
    -- Look up caller's role and branch
    select user_type, coalesce(nullif(trim(channel_partner), ''), trim(name), '')
    into v_role, v_user_branch
    from public.profiles
    where id = auth.uid();

    -- For CPO and Manager, lock down to caller's branch
    if v_role in ('channel_partner_office', 'office2', 'channel_partner_office_manager') then
        v_effective_partner := v_user_branch;
    else
        v_effective_partner := nullif(trim(p_channel_partner), '');
    end if;

    -- Aggregate overview metrics
    select
        count(*),
        count(*) filter (where upper(trim(stage)) = 'COMPLETED'),
        count(*) filter (where upper(trim(stage)) not in ('COMPLETED', 'LOST PROJECT')),
        count(*) filter (where payment_type ilike '%loan%' or (loan_tag is not null and trim(loan_tag) != '')),
        count(*) filter (where payment_type ilike '%cash%'),
        count(*) filter (where installation_status is not null and trim(installation_status) != ''),
        count(*) filter (where subsidy_tag is not null and trim(subsidy_tag) != '')
    into v_total, v_completed, v_live, v_loan, v_cash, v_installation_count, v_subsidy_count
    from public.admin
    where deleted_at is null
      and (
          v_effective_partner is null
          or lower(trim(coalesce(channel_partner, ''))) = lower(trim(v_effective_partner))
          or channel_partner ilike ('%' || v_effective_partner || '%')
      );

    -- Aggregate per-stage counts
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
        'loanTagCount', v_loan,
        'stageCounts', coalesce(v_stages, '{}'::json)
    );
end;
$$;

commit;
