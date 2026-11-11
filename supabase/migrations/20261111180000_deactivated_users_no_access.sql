-- Deactivated users lose all access, 11 Nov 2026.
--
-- Deactivating a user only set profiles.status = 'inactive'. The app refused
-- them at login, but their Supabase login still worked and every access rule
-- looks only at user_type, so a former employee could still read and change
-- customers through the API (or an old open tab).
--
-- 1. get_my_user_type() returns nothing for an inactive user, so every access
--    rule that checks the type refuses them.
-- 2. Setting a profile to inactive bans its login; setting it back to active
--    lifts the ban. Works for the Users screen and the add_user function alike.
-- 3. Users already inactive are banned now.
--
-- Active users are not touched. Safe to run more than once.
--
-- To undo:
--   create or replace function public.get_my_user_type() returns text
--     language sql stable security definer set search_path to 'public'
--     as $f$ select user_type from profiles where id = auth.uid() $f$;
--   drop trigger if exists trg_profile_status_login on public.profiles;
--   update auth.users set banned_until = null
--   where id in (select id from public.profiles where status = 'inactive');

-- 1 ------------------------------------------------------------------------------
create or replace function public.get_my_user_type()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select user_type from profiles
  where id = auth.uid() and coalesce(status, 'active') <> 'inactive'
$function$;

-- 2 ------------------------------------------------------------------------------
create or replace function public.sync_profile_status_login()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    if new.status is distinct from old.status then
        if new.status = 'inactive' then
            update auth.users set banned_until = 'infinity' where id = new.id;
        elsif old.status = 'inactive' then
            update auth.users set banned_until = null where id = new.id;
        end if;
    end if;
    return new;
end;
$function$;
revoke all on function public.sync_profile_status_login() from public, anon, authenticated;

drop trigger if exists trg_profile_status_login on public.profiles;
create trigger trg_profile_status_login
    after update of status on public.profiles
    for each row execute function public.sync_profile_status_login();

-- 3 ------------------------------------------------------------------------------
update auth.users u set banned_until = 'infinity'
from public.profiles p
where p.id = u.id and p.status = 'inactive'
  and (u.banned_until is null or u.banned_until < now());

-- Check: inactive users and whether their login is banned (all should say true).
--   select p.name, p.email, u.banned_until is not null and u.banned_until > now() as banned
--   from public.profiles p join auth.users u on u.id = p.id where p.status = 'inactive';
