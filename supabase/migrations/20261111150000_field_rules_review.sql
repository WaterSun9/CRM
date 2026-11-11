-- Review of the seeded customer field lists, 11 Nov 2026.
-- Run after 20261111140000_customer_field_limits.sql. Safe to run more than once.
--
-- The Channel Partner Office list stays as seeded: its customer card edits File No
-- (Registration tab) and resets the give-up approval when the installation status
-- changes, so both are real.

-- Dealers: 'agent' and 'agent2' use the same Dealer portal, so they get the same
-- fields. History only showed each the ones they happened to use.
insert into public.admin_field_rules (user_type, field, note) values
    ('agent',  'installation_date', 'dealer portal: meter installation date'),
    ('agent',  'pincode',           'dealer portal'),
    ('agent2', 'stage',             'dealer portal: stage move')
on conflict do nothing;
