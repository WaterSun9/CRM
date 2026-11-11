-- Review of the seeded customer field lists, 11 Nov 2026.
-- Run after 20261111140000_customer_field_limits.sql. Safe to run more than once.

-- Channel Partner Office: no screen changes these.
--   folder_no is given by the database when a customer is added.
--   vendor_give_up_approved is the Admin's approval ("Pending Admin Approval").
delete from public.admin_field_rules
where user_type = 'channel_partner_office' and field in ('folder_no', 'vendor_give_up_approved');

-- Dealers: 'agent' and 'agent2' use the same Dealer portal, so they get the same
-- fields. History only showed each the ones they happened to use.
insert into public.admin_field_rules (user_type, field, note) values
    ('agent',  'installation_date', 'dealer portal: meter installation date'),
    ('agent',  'pincode',           'dealer portal'),
    ('agent2', 'stage',             'dealer portal: stage move')
on conflict do nothing;
