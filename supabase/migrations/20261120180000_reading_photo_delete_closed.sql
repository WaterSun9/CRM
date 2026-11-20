-- 20 Nov 2026 (independent SQL review of reading photos): a technician could delete a reading
-- photo after the visit was closed (Fixed / Revisit), and the add rule then blocked putting it
-- back, so a closed visit could be left with fewer than 6 photos.
-- Same delete rule as 20261023120000_complaint_photos_comments.sql, plus: a technician's reading
-- photo can only be deleted while its visit is still open. Office (admin, sales) unchanged.
-- One transaction; safe to run twice. Changes no data.

begin;
set lock_timeout = '8s';

drop policy if exists service_issue_files_remove on public.service_issue_files;
create policy service_issue_files_remove on public.service_issue_files
for delete to authenticated
using (
    (select public.get_my_user_type()) in ('admin', 'sales')
    or (uploaded_by = (select auth.uid())
        and (select public.is_active_technician())
        and exists (select 1 from public.service_issues issue
                    where issue.id = service_issue_files.issue_id
                      and issue.assigned_to = (select auth.uid())
                      and issue.status in ('assigned', 'completion_pending'))
        and (kind <> 'reading'
             or exists (select 1 from public.service_trips trip
                        where trip.id = service_issue_files.trip_id
                          and trip.outcome is null)))
);

commit;

-- Check: expect one row, closed_visit_rule = true.
select polname, pg_get_expr(polqual, polrelid) ilike '%outcome is null%' as closed_visit_rule
from pg_policy
where polname = 'service_issue_files_remove' and polrelid = 'public.service_issue_files'::regclass;
