-- ============================================================================
-- Channel Partner (agent) scoping.   Diagnosed 2026-09-02.
--
-- ROOT CAUSE
-- `agent` and `agent2` share ONE clause in admin_select / admin_update that
-- matches only `sub_channel_partner`. That is correct for a Dealer (agent2),
-- whose leads carry them in that column. It is wrong for a Channel Partner
-- (agent), whose OWN book is filed under `channel_partner = their name`.
--
-- `agent` was the original dealer role. When `agent2` was added for dealers,
-- `agent` was repurposed to mean Channel Partner - but the RLS clause was never
-- split, so it kept matching the dealer column.
--
-- MEASURED IMPACT (2026-09-02): 1,066 leads invisible to the partners who own
-- them - CHIRAG MAMA 253, BHARAT UNJA 180, SANDIP CP 148, VISHVASH 120,
-- RAGNATHBHAI 106, MALAYBHAI CP 97, VIPUL KHODA 72, VISHAL 29, KISHORBHAI 27,
-- NILESH 20, JAYESHBHAI 14.
--
-- WHY THIS CANNOT LEAK: the new clause matches `channel_partner = get_my_name()`
-- - the partner's OWN name, never a branch. Checked against every agent login:
-- BHAGVAN PERSIONAL (branch BHAGVAN THAKOR) gains 0 rows, not that branch's 765.
-- RANA BHAI MAKVANA (branch Er Manoj Solar) gains 0, not 397.
--
-- agent2 is UNCHANGED. Dealers are correctly scoped today - verified: every
-- agent2 has own_book_hidden = 0 and sees only their own leads.
-- ============================================================================


-- ── 1. LOOK FIRST. Read-only. What each agent gains ─────────────────────────
select p.name, p.user_type, coalesce(p.channel_partner,'(none)') as branch,
       (select count(*) from public.admin a
         where lower(trim(coalesce(a.sub_channel_partner,''))) = lower(trim(p.name))) as sees_today,
       (select count(*) from public.admin a
         where lower(trim(coalesce(a.channel_partner,''))) = lower(trim(p.name)))     as will_also_see
from public.profiles p
where p.user_type = 'agent'
order by will_also_see desc;


-- ── 2. SPLIT THE CLAUSE ─────────────────────────────────────────────────────
-- Every other role's clause is copied verbatim from the live policy.
begin;

drop policy if exists "admin_select" on public.admin;

create policy "admin_select" on public.admin
    for select to authenticated
    using (
        (get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text]))
        OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text]))
            AND (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_channel_partner(), ''::text)))))
        -- CHANGED: agent (Channel Partner) is universal. Their own book is filed
        -- under channel_partner = their name; they may also be named as the sub
        -- partner on someone else's lead.
        OR ((get_my_user_type() = 'agent'::text)
            AND (
                 (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text)))     = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text))))
              OR (lower(TRIM(BOTH FROM COALESCE(sub_channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text))))
            ))
        -- UNCHANGED: agent2 (Dealer) sees only what is assigned to them.
        OR ((get_my_user_type() = 'agent2'::text)
            AND (lower(TRIM(BOTH FROM COALESCE(sub_channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
        OR ((get_my_user_type() = 'vendor'::text)
            AND (lower(TRIM(BOTH FROM COALESCE(vendor, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text))))
            AND (deleted_at IS NULL))
        OR ((get_my_user_type() = 'stamp'::text)
            AND (deleted_at IS NULL)
            AND ((discom_submission ->> 'sent_to_stamp_maker'::text) = 'true'::text)
            AND (COALESCE(discom_submission ->> 'assigned_stamp_maker'::text, ''::text) <> ''::text)
            AND (lower(TRIM(BOTH FROM COALESCE(discom_submission ->> 'assigned_stamp_maker'::text, ''::text)))
                 = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
    );

drop policy if exists "admin_update" on public.admin;

create policy "admin_update" on public.admin
    for update to authenticated
    using (
        (get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text]))
        OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text]))
            AND (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_channel_partner(), ''::text)))))
        OR ((get_my_user_type() = 'agent'::text)
            AND (
                 (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text)))     = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text))))
              OR (lower(TRIM(BOTH FROM COALESCE(sub_channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text))))
            ))
        OR ((get_my_user_type() = 'agent2'::text)
            AND (lower(TRIM(BOTH FROM COALESCE(sub_channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
        OR ((get_my_user_type() = 'vendor'::text)
            AND (lower(TRIM(BOTH FROM COALESCE(vendor, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
        OR ((get_my_user_type() = 'stamp'::text)
            AND (deleted_at IS NULL)
            AND ((discom_submission ->> 'sent_to_stamp_maker'::text) = 'true'::text)
            AND (COALESCE(discom_submission ->> 'assigned_stamp_maker'::text, ''::text) <> ''::text)
            AND (lower(TRIM(BOTH FROM COALESCE(discom_submission ->> 'assigned_stamp_maker'::text, ''::text)))
                 = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
    );

commit;


-- ── 3. Channel Partners are universal - clear their branch ─────────────────
-- 13 agent profiles carry a branch they should never have had. 10 of them point
-- at "Sandip Trivedi", which NO CPO owns - which is also why the UI could not
-- clear it (the value was not in the dropdown, so the select showed "None"
-- while still holding the old value).
--
-- CONSEQUENCE, INTENTIONAL: a CPO's User Management list is filtered by branch,
-- so once these have no branch only an Admin can manage them. That follows from
-- "Channel Partners are universal".
update public.profiles
   set channel_partner = null
 where user_type = 'agent'
   and coalesce(trim(channel_partner), '') <> '';


-- ── 4. PREVENT IT COMING BACK ───────────────────────────────────────────────
-- The rule is now enforced by the database, not by remembering it.
create or replace function public.enforce_agent_has_no_branch()
returns trigger language plpgsql as $$
begin
    if new.user_type = 'agent' and coalesce(trim(new.channel_partner), '') <> '' then
        new.channel_partner := null;   -- silently correct rather than reject
    end if;
    return new;
end;
$$;

drop trigger if exists trg_agent_has_no_branch on public.profiles;
create trigger trg_agent_has_no_branch
    before insert or update on public.profiles
    for each row execute function public.enforce_agent_has_no_branch();


-- ── 5. VERIFY ───────────────────────────────────────────────────────────────
select p.name, p.user_type, coalesce(p.channel_partner,'(none)') as branch,
       (select count(*) from public.admin a
         where lower(trim(coalesce(a.channel_partner,'')))     = lower(trim(p.name))
            or lower(trim(coalesce(a.sub_channel_partner,''))) = lower(trim(p.name))) as now_sees
from public.profiles p
where p.user_type in ('agent','agent2')
order by now_sees desc;
-- EXPECT: every agent branch reads (none); CHIRAG MAMA 253, BHARAT UNJA ~182,
-- SANDIP CP 148, VISHVASH ~121 ... and every agent2 unchanged from before.
