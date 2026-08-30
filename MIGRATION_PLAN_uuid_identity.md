# Migration Plan — map people by UUID instead of by name

**Status:** planned, not started. Nothing here has been run.
**Written:** 2026-08-30. Deliberately deferred until after launch.

---

## Why

`admin` stores people as **text names**, and RLS matches on those names:

```sql
-- admin_select / admin_update, current
(get_my_user_type() = ANY (ARRAY['agent','agent2'])
   AND lower(trim(coalesce(sub_channel_partner,''))) = lower(trim(coalesce(get_my_name(),''))))
OR (get_my_user_type() = 'vendor'
   AND lower(trim(coalesce(vendor,''))) = lower(trim(coalesce(get_my_name(),''))))
```

Consequences today:

1. **Renaming a person can orphan them.** Change `profiles.name` alone and that
   Dealer or Vendor sees *zero* records — no error, just an empty portal.
   Worked around in `UserManagementView.handleUpdateName`, which cascades the
   rename into `admin.sub_channel_partner` / `admin.vendor` / `vendors.name`.
   That workaround is a large multi-row write on every rename.
2. **Two people with the same name share data.** Nothing prevents it.
3. **Whitespace and case drift silently break access.** Hence the
   `lower(trim(coalesce(...)))` on both sides of every comparison.

`profiles.id` is **already a uuid** (it is the `auth.users` id). The identifier
exists — `admin` just does not reference it.

---

## Target state

| Column | Purpose after migration |
|---|---|
| `admin.sub_channel_partner_id` (uuid) | the real link, used by RLS |
| `admin.sub_channel_partner` (text) | display label only |
| `admin.vendor_id` (uuid) | the real link, used by RLS |
| `admin.vendor` (text) | display label only |

Renaming then becomes a single `profiles.name` update. Nothing else moves and a
rename cannot orphan anyone.

---

## Risk

This changes **RLS**, which gates all data access for every role. The dangerous
step is the backfill: any row whose name does not resolve to a profile gets a
NULL id, and after the RLS cut-over that row becomes **invisible to the person
who owns it**.

So the backfill is verified *before* RLS changes, and the RLS change is the last
step, not the first.

Do this in a quiet window with time to log in as each role afterwards.

---

## Phase 1 — Add the columns (safe, reversible, no behaviour change)

```sql
alter table public.admin add column if not exists sub_channel_partner_id uuid references public.profiles(id);
alter table public.admin add column if not exists vendor_id uuid references public.profiles(id);

create index if not exists idx_admin_sub_channel_partner_id on public.admin (sub_channel_partner_id);
create index if not exists idx_admin_vendor_id on public.admin (vendor_id);
```

Nothing reads these yet. Safe to leave in place indefinitely.

---

## Phase 2 — Backfill, and reconcile what does not match

**2a. See what will and will not resolve, before writing anything:**

```sql
-- Dealers: how many leads resolve to a profile?
select
    count(*)                                   as total_with_name,
    count(p.id)                                as will_resolve,
    count(*) - count(p.id)                     as will_be_null
from public.admin a
left join public.profiles p
       on lower(trim(p.name)) = lower(trim(a.sub_channel_partner))
      and p.user_type in ('agent','agent2')
where a.deleted_at is null
  and coalesce(trim(a.sub_channel_partner),'') <> '';

-- The names that will NOT resolve - these are the ones to fix by hand.
select distinct a.sub_channel_partner, count(*) as leads
from public.admin a
left join public.profiles p
       on lower(trim(p.name)) = lower(trim(a.sub_channel_partner))
      and p.user_type in ('agent','agent2')
where a.deleted_at is null
  and coalesce(trim(a.sub_channel_partner),'') <> ''
  and p.id is null
group by a.sub_channel_partner
order by leads desc;
```

Repeat both for `vendor` against `p.user_type = 'vendor'`.

**GATE: do not continue until `will_be_null` is 0, or every remaining name is
one you have consciously decided to leave unlinked.** Expect leavers, typos and
people who were never given a login. Each needs a decision: create the profile,
correct the name, or accept it stays unlinked.

Watch for a name matching **more than one** profile — that must be resolved by
hand, not by picking one:

```sql
select lower(trim(name)) as nm, count(*), array_agg(id)
from public.profiles
where user_type in ('agent','agent2','vendor')
group by 1 having count(*) > 1;
```

**2b. Write the ids:**

```sql
update public.admin a
   set sub_channel_partner_id = p.id
  from public.profiles p
 where lower(trim(p.name)) = lower(trim(a.sub_channel_partner))
   and p.user_type in ('agent','agent2')
   and a.sub_channel_partner_id is null;

update public.admin a
   set vendor_id = p.id
  from public.profiles p
 where lower(trim(p.name)) = lower(trim(a.vendor))
   and p.user_type = 'vendor'
   and a.vendor_id is null;
```

Still no behaviour change — nothing reads these columns yet.

---

## Phase 3 — Write the id alongside the name (app change, deploy, soak)

Every place that sets a person on a record must set both columns. Known sites:

| File | What it writes |
|---|---|
| `AddLeadModal.jsx` → `handleSave` | `sub_channel_partner` on create |
| `Dashboard.jsx` → `handleAddLead` | insert path |
| `AgentPortal.jsx` → `handleSubmitLead` | insert path (Dealer-created leads) |
| `InstallationStatusTab.jsx` / `MaterialDeliveryTab.jsx` | vendor allotment dropdown |
| `DeliveryBatchesView.jsx` | `vendor` on batch save |
| `UserManagementView.jsx` → `handleUpdateName` | the cascade — becomes unnecessary at Phase 5 |

Deploy this and **let it run for a few days**. Then re-run the Phase 2a checks:
any row created in that window with a NULL id means a write path was missed.

**GATE: zero new NULL ids before continuing.**

---

## Phase 4 — Cut RLS over to the id

```sql
-- Replace ONLY the two person-scoped clauses. Leave admin/sales/CPO/stamp as they are.
--   agent/agent2:  sub_channel_partner_id = auth.uid()
--   vendor:        vendor_id = auth.uid()
```

Export the current policy definitions first — they are the rollback:

```sql
select policyname, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename='admin';
```

**Verify immediately after, before anyone else logs in:** sign in as one Dealer
and one Vendor and confirm the record counts match what they saw before.

**Rollback:** re-apply the saved policy text. The name columns are untouched and
still correct, so reverting is instant and lossless.

---

## Phase 5 — Simplify (only once Phase 4 has run clean for a week)

- Reduce `handleUpdateName` to a single `profiles.name` update; delete the cascade.
- Treat `admin.sub_channel_partner` / `admin.vendor` as display-only. Optionally
  refresh them from `profiles.name` on read so a rename shows everywhere at once.
- Consider `not null` on the id columns once every row is linked.

---

## Rollback summary

| Phase | Reverting means |
|---|---|
| 1 | drop the two columns |
| 2 | set the ids back to null |
| 3 | redeploy the previous build |
| 4 | re-apply the saved policy text |
| 5 | restore the cascade in `handleUpdateName` |

Phases 1–3 are invisible to users. Only Phase 4 changes behaviour, and it is the
one with a one-statement rollback.

---

## Until this is done — renaming is OFF

The inline name editor in User Management is **built but disabled**:
`ALLOW_NAME_EDIT = false` in `UserManagementView.jsx`. The cascade it performs
(`profiles.name` -> `admin.sub_channel_partner` / `admin.vendor` /
`vendors.name`) is written and error-checked, but it is a large multi-row write
on live data and a half-applied rename would silently hide records from that
user. Not a risk worth carrying into launch.

**So today, a Dealer or Vendor cannot be renamed at all — by design.**

If a rename is genuinely required before this migration lands, do it as a single
transaction and verify immediately afterwards that the person still sees their
records:

```sql
begin;
update public.profiles set name = 'New Name' where id = '<profile-uuid>';

-- Dealer (user_type agent / agent2):
update public.admin set sub_channel_partner = 'New Name'
 where lower(trim(sub_channel_partner)) = lower(trim('Old Name'));

-- Vendor:
-- update public.admin set vendor = 'New Name'
--  where lower(trim(vendor)) = lower(trim('Old Name'));
-- update public.vendors set name = 'New Name'
--  where lower(trim(name)) = lower(trim('Old Name'));

-- Check the count looks right BEFORE committing.
commit;
```

Never run `update profiles set name = ...` on its own. It will silently empty
that person's portal.

Once Phase 4 is live, flip `ALLOW_NAME_EDIT` to `true` and delete the cascade
from `handleUpdateName` (Phase 5).
