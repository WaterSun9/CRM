-- ============================================================================
-- Does the `admin` table have every column the app writes?   READ ONLY.
--
-- AgentPortal.jsx:248 sets editData to a full copy of the customer row, and
-- several save paths write that whole object straight back. One key that is
-- not a real column makes Postgres reject the ENTIRE update - which is what a
-- "<column> cannot be found / does not exist, cannot save" error looks like.
--
-- EXPECT: 0 rows from the first query.
-- ============================================================================
with app_columns(col) as (values
    ('ac_cable'),
    ('adhaar_card_back'),
    ('adhaar_card_front'),
    ('bank_details'),
    ('bank_name'),
    ('cash_details'),
    ('channel_partner'),
    ('consumer_no'),
    ('crn'),
    ('customer_name'),
    ('dc_cable'),
    ('dcr_certificate'),
    ('delivery_batch_id'),
    ('delivery_status'),
    ('digital_certificate'),
    ('discom_inspection'),
    ('discom_submission'),
    ('driver_name'),
    ('driver_phone_number'),
    ('email_address'),
    ('extra_docs'),
    ('feasibilty_document'),
    ('folder_no'),
    ('geo_tag_image'),
    ('geo_tag_status'),
    ('google_docs'),
    ('hold_procurement'),
    ('house_geo_tag_photo'),
    ('index_2'),
    ('installation_date'),
    ('installation_note'),
    ('installation_status'),
    ('inverter_make'),
    ('inverter_serial_no'),
    ('invoice_no'),
    ('invoice_value'),
    ('light_bill'),
    ('loan_history'),
    ('loan_tag'),
    ('location_link'),
    ('material_delivery_date'),
    ('material_order_notes'),
    ('meter_installation'),
    ('meter_installation_photo'),
    ('module_brand'),
    ('module_wp'),
    ('no_of_modules'),
    ('pan_card'),
    ('panel_serial_no'),
    ('payment_type'),
    ('phone_number'),
    ('pm_surya_ghar_stamp'),
    ('registration_by'),
    ('registration_date'),
    ('registration_no'),
    ('remarks'),
    ('roof_shed'),
    ('signature_pic'),
    ('site_feasibility'),
    ('stage'),
    ('stages_remarks'),
    ('stamp'),
    ('structure_front_leg_height'),
    ('structure_rear_leg_height'),
    ('sub_channel_partner'),
    ('sub_divisions'),
    ('subsidy_history'),
    ('subsidy_tag'),
    ('subsidy_token_photo'),
    ('system_capacity_kwp'),
    ('title'),
    ('type'),
    ('vehicle_number'),
    ('vendor'),
    ('vendor_feasibility'),
    ('vendor_give_up_approved'),
    ('vendor_note'),
    ('vendor_paid_by'),
    ('vendor_paid_date'),
    ('vendor_payment_status'),
    ('vendor_quote'),
    ('vendor_status'),
    ('villages')
)
select a.col as missing_from_admin_table
from app_columns a
left join information_schema.columns c
       on c.table_schema = 'public'
      and c.table_name   = 'admin'
      and c.column_name  = a.col
where c.column_name is null
order by a.col;


-- Reverse view: columns that exist in the DB but the app never touches.
-- Informational only - a legacy column here (e.g. file_status) is harmless,
-- it just means nothing reads or writes it any more.
with app_columns(col) as (values
    ('ac_cable'),
    ('adhaar_card_back'),
    ('adhaar_card_front'),
    ('bank_details'),
    ('bank_name'),
    ('cash_details'),
    ('channel_partner'),
    ('consumer_no'),
    ('crn'),
    ('customer_name'),
    ('dc_cable'),
    ('dcr_certificate'),
    ('delivery_batch_id'),
    ('delivery_status'),
    ('digital_certificate'),
    ('discom_inspection'),
    ('discom_submission'),
    ('driver_name'),
    ('driver_phone_number'),
    ('email_address'),
    ('extra_docs'),
    ('feasibilty_document'),
    ('folder_no'),
    ('geo_tag_image'),
    ('geo_tag_status'),
    ('google_docs'),
    ('hold_procurement'),
    ('house_geo_tag_photo'),
    ('index_2'),
    ('installation_date'),
    ('installation_note'),
    ('installation_status'),
    ('inverter_make'),
    ('inverter_serial_no'),
    ('invoice_no'),
    ('invoice_value'),
    ('light_bill'),
    ('loan_history'),
    ('loan_tag'),
    ('location_link'),
    ('material_delivery_date'),
    ('material_order_notes'),
    ('meter_installation'),
    ('meter_installation_photo'),
    ('module_brand'),
    ('module_wp'),
    ('no_of_modules'),
    ('pan_card'),
    ('panel_serial_no'),
    ('payment_type'),
    ('phone_number'),
    ('pm_surya_ghar_stamp'),
    ('registration_by'),
    ('registration_date'),
    ('registration_no'),
    ('remarks'),
    ('roof_shed'),
    ('signature_pic'),
    ('site_feasibility'),
    ('stage'),
    ('stages_remarks'),
    ('stamp'),
    ('structure_front_leg_height'),
    ('structure_rear_leg_height'),
    ('sub_channel_partner'),
    ('sub_divisions'),
    ('subsidy_history'),
    ('subsidy_tag'),
    ('subsidy_token_photo'),
    ('system_capacity_kwp'),
    ('title'),
    ('type'),
    ('vehicle_number'),
    ('vendor'),
    ('vendor_feasibility'),
    ('vendor_give_up_approved'),
    ('vendor_note'),
    ('vendor_paid_by'),
    ('vendor_paid_date'),
    ('vendor_payment_status'),
    ('vendor_quote'),
    ('vendor_status'),
    ('villages')
)
select c.column_name as in_db_but_unused_by_app, c.data_type
from information_schema.columns c
left join app_columns a on a.col = c.column_name
where c.table_schema = 'public'
  and c.table_name   = 'admin'
  and a.col is null
order by c.column_name;


-- ── Targeted check: the two columns that REPLACED file_status ───────────────
-- An uncommitted change swapped `file_status` for `vendor_feasibility` +
-- `site_feasibility` in models.jsx and constants.js. If the DB columns were
-- never added, EVERY save that writes the whole record fails - and PostgREST
-- names the missing column, which reads as "file status cannot be found".
-- EXPECT: 2 rows.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'admin'
  and column_name in ('file_status', 'vendor_feasibility', 'site_feasibility')
order by column_name;


-- ── FIX (only run if the two columns are missing above) ─────────────────────
-- alter table public.admin add column if not exists vendor_feasibility boolean default false;
-- alter table public.admin add column if not exists site_feasibility   boolean default false;
--
-- Carry over any values from the old single flag, if it still exists:
-- update public.admin
--    set vendor_feasibility = coalesce(vendor_feasibility, file_status),
--        site_feasibility   = coalesce(site_feasibility,   file_status)
--  where file_status is not null;
--
-- PostgREST caches the schema - without this the app keeps reporting the
-- column as missing even after you add it:
-- notify pgrst, 'reload schema';
