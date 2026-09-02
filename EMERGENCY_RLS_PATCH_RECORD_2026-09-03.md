# Emergency RLS Patch Record — 2026-09-03

## Status

Applied to the production Supabase project and verified on the live CRM.

This was a **SELECT/read-visibility policy change only**. It did not update,
delete, rename, or insert any lead, profile, branch, metadata, or sub-agent data.

Applied SQL copy:
`scripts/emergency_read_only_rls_patch_APPLIED_2026-09-03.sql`

## What changed

Only the `admin_select` RLS policy on `public.admin` was replaced.

- Admin and Office continue to read all rows.
- CPO and CPO Manager read leads whose `channel_partner` matches the branch in
  their profile.
- An independent CP reads leads whose `channel_partner` matches their profile
  name. The `sub_channel_partner` value is ignored for CP access.
- A Dealer reads a lead only when both conditions match:
  - `sub_channel_partner` matches the Dealer's profile name; and
  - `channel_partner` matches the Dealer's registered CPO branch.
- Vendor and Stamp read rules were preserved.

## What did not change

- No `admin` lead rows changed.
- No `profiles` rows changed.
- No `metadata` rows changed.
- No branch names changed.
- No Channel Partner, CPO, or Dealer names changed.
- No `sub_channel_partner` values were cleared or deleted.
- No customer was reassigned.
- No INSERT, UPDATE, or DELETE RLS policy changed.
- No frontend deployment was required or performed for the live repair.

## DEBOARDED behavior

Sub-agent/Dealer text on DEBOARDED leads was **not deleted**. It remains in the
database for history and audit purposes.

It is ignored for Dealer access because a Dealer now needs both their name and
their registered CPO branch to match. `DEBOARDED` does not match a Dealer's
registered branch, so the Dealer cannot read those rows.

## Live verification

After applying the policy:

- CHIRAG MAMA (`agent`, independent CP): **253** customers — expected 253.
- GANDHIDHAM BHARAT (`channel_partner_office`): **18** customers — expected 18.
- PANKAJ JOSHI (`agent2`, Dealer under BHAVESH SOLAR): **17** customers —
  expected 17. Before the patch the Dealer saw 19; the two wrong-CPO rows are
  now hidden from this Dealer but remain with their named CPOs.
- Browser console warnings/errors during these checks: none.

## Known limitations left for the weekend

- Authorization still relies on normalized text names rather than immutable
  profile UUIDs.
- Existing wrong or historical `sub_channel_partner` values remain stored.
- The exception audit found 204 CPO leads with invalid/unknown Dealer pairing,
  116 leads whose Channel Partner does not resolve to an active CP/CPO, and 195
  Dealer assignments whose name has no login account.
- `MANOJ` exists as both a CPO name and a Dealer name. The role-specific policy
  separates their views today, but UUID ownership is still the durable fix.
- This patch changes reading only. It does not repair CP update permissions.

## Weekend remediation guardrails

1. Back up all affected rows and current RLS definitions.
2. Import future client sheets into staging, never directly into `public.admin`.
3. Classify each row as independent CP, CPO-only, valid CPO+Dealer, DEBOARDED,
   or unresolved.
4. Preserve original imported names in audit fields.
5. Introduce `cp_id`, `cpo_id`, and `dealer_id` UUID ownership fields.
6. Do not delete historical sub-agent values until every affected row has been
   reviewed and a restorable backup exists.

