-- ============================================================================
-- Re-attach panel / inverter serials AFTER importing clean_admin_data.csv.
--
-- Folder numbers were RENUMBERED during cleaning, so this is built against the
-- folder numbers in clean_admin_data.csv, not the old ones. Verified 2026-09-01
-- against that exact file.
--
--   17 customers matched
--   5 customer(s) are not in the new file - their serials cannot be attached
--
-- Rows whose folder number is shared by another customer in the new file also
-- match on name, so panels cannot land on the wrong roof.
--
-- Every statement only FILLS A BLANK, so anything the import already carries wins.
-- ============================================================================

begin;

-- ARAJANBHAI SAVABHAI RABARI  (6 panels)   [was folder 1, now 4879]
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'WS08269075124102
WS08269075124351
WS08269075124110
WS08269075124358
WS08269075124277
WS08269075124256'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), null)
 where trim(folder_no::text) = '4879';

-- GHANCHI MAHMMADARIF IMAMBHAI  (6 panels, inverter)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'T-1065A1D
T-106585E
T-1065836
T-1065831
T-1065A91
T-1065861'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), 'GRID-TIED PP INVERTER,GW636260312-ODM,53000N3A263LC518,N3A3000-08-00P,GW3000-XS-30,1,pcs,WHITE,LAN&WIFI&BT&RS485,YES,NO')
 where trim(folder_no::text) = '3343';

-- MALEK AMIRKHAN RAGHJI  (6 panels, inverter)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'WS08269075551954
WS08269075570923
WS08269075551955
WS08269075570922
WS08269075570900
WS08269075551950'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), '119116126E02647')
 where trim(folder_no::text) = '3528';

-- SADHU JANAKBHAI SUKHDEVJI  (6 panels, inverter)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'T-10659D0
T-1065B34
T-1065D9B
T-1065AE6
T-1065AC8
T-1065B6E'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), '53000N3A263L8566')
 where trim(folder_no::text) = '4001';

-- NADODA AMARABHAI MULABHAI  (6 panels)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'GS1926075670041477
GS1926075670041675
GS1926075670041651
GS1926075670041672
GS1926075670041690
GS1926075670041472'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), null)
 where trim(folder_no::text) = '4266';

-- PATEL DIPTIBEN SURESHBHAI  (6 panels)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'WS08269075570904
WS08269075552188
WS08269075570918
WS08269075552277
WS08269075570981
WS08269075570984'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), null)
 where trim(folder_no::text) = '4469';

-- JAYSHREEBEN DILIPKUMAR THAKKAR  (6 panels, inverter)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'MS2606181C3129
MS2606181C5260
MS2606191B0483
MS2606181C5212
MS2606191B0749
MS2606181C5211'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), '119116126G01273')
 where trim(folder_no::text) = '4558';

-- VANKAR KANUBHAI NARANBHAI  (6 panels)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'MS2606181C5324
MS2606181C2691
MS2606181C2705
MS2606181C2742
MS2606191B0185
MS2606181C2744'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), null)
 where trim(folder_no::text) = '4677';

-- RATHOD JALAMSANG ADESANG  (5 panels)   [was folder 4680, now 4678]  [folder shared - name also matched]
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'WS08269075124372
WS08269075124371
WS08269075124370
WS08269075124369
WS08269075124363'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), null)
 where trim(folder_no::text) = '4678'
   and upper(regexp_replace(trim(customer_name), '\s+', ' ', 'g')) = 'RATHOD JALAMSANG ADESANG';

-- RAJA ALLARAKHA KASAM  (8 panels, inverter)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'GS1926075670041669
GS1926075670041532
GS1926075670041641
GS1926075670041632
GS1926075670041598
GS1926075670041647
GS1926075670041682
GS1926075670041349'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), 'AXUS146267VG775')
 where trim(folder_no::text) = '4704';

-- CHAUHAN PARBATBHAI SHAMJIBHAI  (0 panels, inverter)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), null),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), '53000N3A263LC581')
 where trim(folder_no::text) = '4813';

-- DABHI PARBATBHAI SHANKARBHAI  (7 panels, inverter)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'GS1926075670041426
GS1926075670041989
GS1926075670041836
GS1926075670041980
GS1926075670041979
GS1926075670041663
GS1926075670041852'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), '119116126G00688')
 where trim(folder_no::text) = '4830';

-- CHARAN HARISANG LAXAMANDAN  (9 panels, inverter)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'WS08269075570983
WS08269075570982
WS08269075570976
WS08269075570975
WS08269075570926
WS08269075570979
WS08269075570927
WS08269075570928
WS08269075570978'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), 'AXUS146267VG842')
 where trim(folder_no::text) = '4832';

-- CHETANABEN JAGDISHKUMAR TRIVEDI  (0 panels, inverter)   [was folder 4873, now 4874]
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), null),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), '130Q050030L9YF7')
 where trim(folder_no::text) = '4874';

-- HARIJAN SHAILESHBHAI KANJIBHAI  (0 panels, inverter)   [was folder 4874, now 4873]
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), null),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), '119116126G01026[')
 where trim(folder_no::text) = '4873';

-- PAVARA DEVABHAI SHIVABHAI  (7 panels)
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'MS2606181C5201
MS2606181C4611
MS2606191B1289
MS2606191B1285
MS2606181C5115
MS2606191B1361
MS2606191B1459'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), null)
 where trim(folder_no::text) = '4884';

-- DARJI SAVITABEN ASHOKBHAI  (6 panels)   [was folder 4892, now 4878]
update public.admin set
    panel_serial_no    = coalesce(nullif(panel_serial_no, ''), 'WS08269075570899
WS08269075570897
WS08269075570902
WS08269075552249
WS08269075552253
WS08269075570903'),
    inverter_serial_no = coalesce(nullif(inverter_serial_no, ''), null)
 where trim(folder_no::text) = '4878';

commit;

-- ── CANNOT BE ATTACHED ──────────────────────────────────────────────────────
-- "PATEL VIJAYKUMAR BHIKHABHAI" (was folder 4837) is not in clean_admin_data.csv.
--   6 panel serial(s) + inverter 119116126G01201 are preserved in
--   backups/serials_by_folder.csv if you add this customer back.
-- "ANISHABEN ALTAFBHAI MEMAN" (was folder 4872) is not in clean_admin_data.csv.
--   0 panel serial(s) + inverter AXUS146267VG794 are preserved in
--   backups/serials_by_folder.csv if you add this customer back.
-- "NAYANABEN BHARATKUMAR PATEL" (was folder 4890) is not in clean_admin_data.csv.
--   8 panel serial(s) + inverter AXUS146267VG840 are preserved in
--   backups/serials_by_folder.csv if you add this customer back.
-- "SAJANBHAI BHIKHABHAI BHARVAD" (was folder 4891) is not in clean_admin_data.csv.
--   6 panel serial(s) + inverter 119116126G01165 are preserved in
--   backups/serials_by_folder.csv if you add this customer back.
-- "PRAHALADBHAI DALCHHABHAI PRAJAPATI" (was folder 4893) is not in clean_admin_data.csv.
--   6 panel serial(s) are preserved in
--   backups/serials_by_folder.csv if you add this customer back.


-- ── Verify ──────────────────────────────────────────────────────────────────
select folder_no, customer_name, inverter_serial_no,
       array_length(string_to_array(nullif(panel_serial_no,''), E'\n'), 1) as panel_count
from public.admin
where trim(folder_no::text) in ('4879', '3343', '3528', '4001', '4266', '4469', '4558', '4677', '4678', '4704', '4813', '4830', '4832', '4874', '4873', '4884', '4878')
order by folder_no;
-- EXPECT 17 rows.
