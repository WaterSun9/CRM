-- ─── Atomic Delivery Batch Operations (ACID Transactions) ────────────────────
-- Wraps delivery batch creation, editing, status changes, and deletion into
-- atomic PostgreSQL functions. Guarantees that batch records and customer
-- metadata updates either succeed together or roll back completely.
-- ────────────────────────────────────────────────────────────────────────────

-- Ensure delivery_batches table has RLS policies configured properly

drop policy if exists "Allow all for authenticated users" on public.delivery_batches;
drop policy if exists "Authenticated users can write delivery_batches" on public.delivery_batches;
drop policy if exists "Authenticated users can read delivery_batches" on public.delivery_batches;
drop policy if exists "delivery_batches_all" on public.delivery_batches;
drop policy if exists "delivery_batches_select_scoped" on public.delivery_batches;
drop policy if exists "delivery_batches_insert_scoped" on public.delivery_batches;
drop policy if exists "delivery_batches_update_scoped" on public.delivery_batches;
drop policy if exists "delivery_batches_delete_scoped" on public.delivery_batches;

create policy "delivery_batches_select_scoped" on public.delivery_batches
    for select to authenticated
    using (
        get_my_user_type() in ('admin', 'sales')
    );

create policy "delivery_batches_insert_scoped" on public.delivery_batches
    for insert to authenticated
    with check (
        get_my_user_type() in ('admin', 'sales')
    );

create policy "delivery_batches_update_scoped" on public.delivery_batches
    for update to authenticated
    using (
        get_my_user_type() in ('admin', 'sales')
    )
    with check (
        get_my_user_type() in ('admin', 'sales')
    );

create policy "delivery_batches_delete_scoped" on public.delivery_batches
    for delete to authenticated
    using (
        get_my_user_type() in ('admin', 'sales')
    );

-- 1. Atomic Save Batch (Create or Update)
create or replace function public.save_delivery_batch_atomic(
    p_batch jsonb,
    p_selected_project_ids text[],
    p_removed_project_ids text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_batch_id uuid;
    v_batch_no text;
    v_dispatch_date text;
    v_driver_name text;
    v_driver_phone bigint;
    v_vehicle_number text;
    v_vendor text;
    v_status text;
    v_rent_amount text;
    v_car_rent_paid text;
    v_notes text;
    v_created_at timestamptz;
begin
    -- Extract batch fields from JSON
    v_batch_id := (p_batch->>'id')::uuid;
    v_batch_no := p_batch->>'batch_no';
    v_dispatch_date := p_batch->>'dispatch_date';
    v_driver_name := p_batch->>'driver_name';
    v_driver_phone := nullif(regexp_replace(coalesce(p_batch->>'driver_phone', ''), '\D', '', 'g'), '')::bigint;
    v_vehicle_number := p_batch->>'vehicle_number';
    v_vendor := p_batch->>'vendor';
    v_status := coalesce(p_batch->>'status', 'IN_TRANSIT');
    v_rent_amount := p_batch->>'rent_amount';
    v_car_rent_paid := p_batch->>'car_rent_paid';
    v_notes := p_batch->>'notes';
    v_created_at := coalesce((p_batch->>'created_at')::timestamptz, now());

    -- Upsert the delivery batch row
    insert into public.delivery_batches (
        id,
        batch_no,
        dispatch_date,
        driver_name,
        driver_phone,
        vehicle_number,
        rent_amount,
        car_rent_paid,
        vendor,
        notes,
        status,
        project_ids,
        created_at,
        updated_at
    )
    values (
        v_batch_id,
        v_batch_no,
        v_dispatch_date,
        v_driver_name,
        v_driver_phone,
        v_vehicle_number,
        v_rent_amount,
        v_car_rent_paid,
        v_vendor,
        v_notes,
        v_status,
        p_selected_project_ids,
        v_created_at,
        now()
    )
    on conflict (id) do update set
        batch_no = excluded.batch_no,
        dispatch_date = excluded.dispatch_date,
        driver_name = excluded.driver_name,
        driver_phone = excluded.driver_phone,
        vehicle_number = excluded.vehicle_number,
        rent_amount = excluded.rent_amount,
        car_rent_paid = excluded.car_rent_paid,
        vendor = excluded.vendor,
        notes = excluded.notes,
        status = excluded.status,
        project_ids = excluded.project_ids,
        updated_at = now();

    -- Bulk update all newly/currently selected projects in public.admin
    if array_length(p_selected_project_ids, 1) > 0 then
        update public.admin
        set
            delivery_batch_id = v_batch_no,
            material_delivery_date = v_dispatch_date,
            driver_name = v_driver_name,
            driver_phone_number = v_driver_phone,
            vehicle_number = v_vehicle_number,
            vendor = coalesce(v_vendor, vendor),
            delivery_status = case 
                when delivery_status is null or delivery_status = 'PENDING' then 'IN_TRANSIT'
                else delivery_status
            end,
            updated_at = now()
        where id::text = any(p_selected_project_ids)
          and deleted_at is null;
    end if;

    -- Bulk clear any projects that were removed/unchecked from this batch
    if array_length(p_removed_project_ids, 1) > 0 then
        update public.admin
        set
            delivery_batch_id = null,
            delivery_status = 'PENDING',
            driver_name = null,
            driver_phone_number = null,
            vehicle_number = null,
            material_delivery_date = null,
            updated_at = now()
        where id::text = any(p_removed_project_ids)
          and deleted_at is null;
    end if;

    return jsonb_build_object('success', true, 'batch_id', v_batch_id);
end;
$$;


-- 2. Atomic Delete / Disband Batch
create or replace function public.delete_delivery_batch_atomic(
    p_batch_id uuid,
    p_project_ids text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Delete the batch record
    delete from public.delivery_batches
    where id = p_batch_id;

    -- Clear delivery details from all associated projects
    if array_length(p_project_ids, 1) > 0 then
        update public.admin
        set
            delivery_batch_id = null,
            delivery_status = 'PENDING',
            driver_name = null,
            driver_phone_number = null,
            vehicle_number = null,
            material_delivery_date = null,
            updated_at = now()
        where id::text = any(p_project_ids)
          and deleted_at is null;
    end if;

    return jsonb_build_object('success', true, 'deleted_batch_id', p_batch_id);
end;
$$;


-- 3. Atomic Batch Status Update (e.g. mark as DELIVERED)
create or replace function public.update_delivery_batch_status_atomic(
    p_batch_id uuid,
    p_new_status text,
    p_project_ids text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_batch_rows   int := 0;
    v_project_rows int := 0;
    v_expected     int := coalesce(array_length(p_project_ids, 1), 0);
begin
    -- Update batch table
    update public.delivery_batches
    set
        status = p_new_status,
        updated_at = now()
    where id = p_batch_id;
    get diagnostics v_batch_rows = row_count;

    -- No batch matched the id. Previously this still returned success:true,
    -- so a no-op was indistinguishable from a real write. Report the failure
    -- instead and let the caller surface it.
    if v_batch_rows = 0 then
        return jsonb_build_object(
            'success',  false,
            'error',    'batch_not_found',
            'batch_id', p_batch_id
        );
    end if;

    -- Update linked admin customer rows if status is DELIVERED or IN_TRANSIT
    if v_expected > 0 then
        update public.admin
        set
            delivery_status = p_new_status,
            updated_at = now()
        where id::text = any(p_project_ids)
          and deleted_at is null;
        get diagnostics v_project_rows = row_count;
    end if;

    -- projects_missing > 0 means the batch lists ids that are soft-deleted or
    -- gone. Not fatal, so success stays true, but the caller can now see it
    -- instead of assuming every linked customer was synced.
    return jsonb_build_object(
        'success',           true,
        'batch_id',          p_batch_id,
        'status',            p_new_status,
        'projects_expected', v_expected,
        'projects_updated',  v_project_rows,
        'projects_missing',  v_expected - v_project_rows
    );
end;
$$;

-- Grant execution permissions
grant execute on function public.save_delivery_batch_atomic(jsonb, text[], text[]) to authenticated, service_role;
grant execute on function public.delete_delivery_batch_atomic(uuid, text[]) to authenticated, service_role;
grant execute on function public.update_delivery_batch_status_atomic(uuid, text, text[]) to authenticated, service_role;
