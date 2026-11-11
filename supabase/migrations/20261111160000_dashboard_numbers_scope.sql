-- Company-wide dashboard numbers, 11 Nov 2026.
--
-- get_dashboard_metrics and get_dashboard_metrics_scoped pin a Channel Partner
-- Office / Manager to its own branch, but every other login (dealer, vendor,
-- stamp maker, technician) could ask for any branch, or none, and get the whole
-- company's totals. Only Admin, Office and the partner offices use the main
-- Dashboard; the other roles have their own portals that never call these.
--
-- Now: Admin and Office - unchanged. Partner offices / managers - unchanged
-- (always their own branch). Everyone else - refused.
--
-- This edits the LIVE functions in place, changing only the lines that pick the
-- branch, so nothing else about the numbers changes. If those lines are not
-- found, the function is left exactly as it is and a notice says so.
--
-- BEFORE RUNNING, save the live versions so they can be put back:
--   select pg_get_functiondef('public.get_dashboard_metrics(text)'::regprocedure)
--   union all
--   select pg_get_functiondef('public.get_dashboard_metrics_scoped(text, text)'::regprocedure);
-- To undo: paste the saved text into the SQL editor and run it, then
--   grant execute on function public.stamp_monthly_summary() to authenticated;

do $$
declare
    v_fn   regprocedure;
    v_def  text;
    v_old  text := $old$    if v_role in ('channel_partner_office', 'office2', 'channel_partner_office_manager') then
        v_effective_partner := v_user_branch;
    else
        v_effective_partner := nullif(trim(p_channel_partner), '');
    end if;$old$;
    v_new  text := $new$    if v_role in ('channel_partner_office', 'office2', 'channel_partner_office_manager') then
        v_effective_partner := v_user_branch;
    elsif v_role in ('admin', 'sales') then
        v_effective_partner := nullif(trim(p_channel_partner), '');
    else
        raise exception 'Not permitted: dashboard numbers are for Admin, Office and partner offices.'
            using errcode = '42501';
    end if;$new$;
begin
    foreach v_fn in array array['public.get_dashboard_metrics(text)'::regprocedure,
                                'public.get_dashboard_metrics_scoped(text, text)'::regprocedure]
    loop
        v_def := pg_get_functiondef(v_fn);
        if position(v_new in v_def) > 0 then
            raise notice '% already done - left as it is.', v_fn;
        elsif position(v_old in v_def) > 0 then
            execute replace(v_def, v_old, v_new);
            raise notice '% updated.', v_fn;
        else
            raise notice '% NOT changed: its branch lines differ from what was expected. Send me its text.', v_fn;
        end if;
    end loop;
end $$;

-- Stamp paper counts for the whole company. No screen calls this; it stays
-- available in the SQL editor.
revoke execute on function public.stamp_monthly_summary() from public, anon, authenticated;

-- Check: both lines should say true.
--   select proname, prosrc like '%dashboard numbers are for Admin%' as limited
--   from pg_proc where proname in ('get_dashboard_metrics', 'get_dashboard_metrics_scoped');
