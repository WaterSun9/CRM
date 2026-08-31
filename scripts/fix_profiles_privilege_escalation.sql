-- ============================================================================
-- CRITICAL — privilege escalation via public.profiles
--
-- PROVEN 2026-08-31 by signing in as each of the 8 roles and writing user_type
-- back to itself: the write was PERMITTED for every one of them.
--
-- CAUSE: `profiles_update_scoped` begins with (id = auth.uid()). RLS is
-- ROW-level, not COLUMN-level - so once a user may update their own row, they
-- may change ANY column on it, including user_type.
--
-- IMPACT: any logged-in user - a Vendor, a Dealer, a Stamp maker - can run
--
--     supabase.from('profiles').update({ user_type: 'admin' }).eq('id', <their own id>)
--
-- from the browser console. get_my_user_type() then returns 'admin', and the
-- admin RLS clause grants them read/write over all ~3,800 customer records.
-- The anon key ships inside the JS bundle, so no special tooling is needed.
--
-- The UI is not the protection here: the role dropdown correctly offers a CPO
-- only Manager/Dealer, and the add_user edge function clamps CPO *creations* -
-- but role CHANGES are a direct client write that bypasses both.
--
-- FIX: keep the row policy as-is and add a trigger that guards the privileged
-- COLUMNS. Everything the app legitimately does still works.
-- ============================================================================

begin;

create or replace function public.enforce_profile_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller_type text;
    v_caller_cp   text;
    privileged_changed boolean;
begin
    privileged_changed :=
           (new.user_type       is distinct from old.user_type)
        or (new.role            is distinct from old.role)
        or (new.channel_partner is distinct from old.channel_partner)
        or (new.status          is distinct from old.status);

    -- Nothing privileged touched (e.g. a name or email edit): allow.
    if not privileged_changed then
        return new;
    end if;

    -- Server-side callers (service_role / the add_user edge function / SQL
    -- editor) have no auth.uid(). They are already trusted.
    if auth.uid() is null then
        return new;
    end if;

    v_caller_type := get_my_user_type();
    v_caller_cp   := lower(trim(coalesce(get_my_channel_partner(), '')));

    -- Admin may change anything.
    if v_caller_type = 'admin' then
        return new;
    end if;

    -- A Channel Partner Office may manage their OWN branch, and only to the two
    -- roles their UI offers. They may not move a user to another branch.
    if v_caller_type = 'channel_partner_office'
       and lower(trim(coalesce(old.channel_partner, ''))) = v_caller_cp
       and new.channel_partner is not distinct from old.channel_partner
       and (new.user_type is not distinct from old.user_type
            or new.user_type in ('office2', 'agent2'))
    then
        return new;
    end if;

    raise exception
        'Not permitted: role, branch and status can only be changed by an Admin (or by a Channel Partner Office within their own branch).'
        using errcode = '42501';
end;
$$;

drop trigger if exists trg_enforce_profile_privilege_changes on public.profiles;
create trigger trg_enforce_profile_privilege_changes
    before update on public.profiles
    for each row
    execute function public.enforce_profile_privilege_changes();

commit;


-- ── Verify ──────────────────────────────────────────────────────────────────
-- EXPECT 1 row.
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.profiles'::regclass and not tgisinternal;

-- Re-run scripts/test_profiles_escalation.mjs afterwards.
-- EXPECT: admin PERMITTED, every other role BLOCKED.
