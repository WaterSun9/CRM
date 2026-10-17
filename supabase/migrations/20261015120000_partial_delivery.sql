-- Partial deliveries.
-- A customer in a delivery batch can be ticked "Partly delivered". The rest of
-- their material can then go on a new batch: the customer shows up again in
-- the batch picker, and joining the new batch clears the tick. The first
-- batch keeps them in project_ids as history.
-- The owner applies this file in the Supabase SQL Editor after a backup.
-- One transaction: any failure rolls back the entire update.
set lock_timeout = '8s';

begin;

alter table public.admin add column if not exists delivery_partial boolean not null default false;

CREATE OR REPLACE FUNCTION public.save_delivery_batch_atomic(p_batch jsonb, p_selected_project_ids text[], p_removed_project_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_batch_id uuid;
    v_batch_no text;
    v_dispatch_date date;
    v_driver_name text;
    v_driver_phone numeric;
    v_vehicle_number text;
    v_vendor text;
    v_status text;
    v_rent_amount numeric;
    v_car_rent_paid text;
    v_car_rent_paid_by text;
    v_car_rent_paid_at text;
    v_notes text;
    v_created_at timestamptz;
    v_selected_project_ids uuid[];
    v_removed_project_ids uuid[];
    v_existing_batch_no text;
    v_existing_project_ids uuid[] := '{}'::uuid[];
    v_project_rows integer;
begin
    if auth.uid() is null or public.get_my_user_type() not in ('admin', 'sales') then
        raise exception 'Not authorized to change delivery batches' using errcode = '42501';
    end if;
    -- Extract batch fields from JSON
    v_batch_id := (p_batch->>'id')::uuid;
    v_batch_no := p_batch->>'batch_no';
    v_dispatch_date := nullif(p_batch->>'dispatch_date', '')::date;
    v_driver_name := p_batch->>'driver_name';
    v_driver_phone := nullif(regexp_replace(coalesce(p_batch->>'driver_phone', ''), '[^0-9]', '', 'g'), '')::numeric;
    v_vehicle_number := p_batch->>'vehicle_number';
    v_vendor := p_batch->>'vendor';
    v_status := coalesce(p_batch->>'status', 'IN_TRANSIT');
    v_rent_amount := nullif(regexp_replace(coalesce(p_batch->>'rent_amount', ''), '[^0-9.-]', '', 'g'), '')::numeric;
    v_car_rent_paid := p_batch->>'car_rent_paid';
    v_car_rent_paid_by := p_batch->>'car_rent_paid_by';
    v_car_rent_paid_at := p_batch->>'car_rent_paid_at';
    v_notes := p_batch->>'notes';
    v_created_at := coalesce((p_batch->>'created_at')::timestamptz, now());
    v_selected_project_ids := array(select id_text::uuid from unnest(coalesce(p_selected_project_ids, '{}'::text[])) as u(id_text));
    v_removed_project_ids := array(select id_text::uuid from unnest(coalesce(p_removed_project_ids, '{}'::text[])) as u(id_text));
    if v_status not in ('IN_TRANSIT', 'DELIVERED') then
        raise exception 'Invalid delivery status' using errcode = '22023';
    end if;
    if cardinality(v_selected_project_ids) <> (select count(distinct id) from unnest(v_selected_project_ids) as x(id))
       or cardinality(v_removed_project_ids) <> (select count(distinct id) from unnest(v_removed_project_ids) as x(id)) then
        raise exception 'Duplicate project IDs are not allowed' using errcode = '22023';
    end if;

    select batch_no, coalesce(project_ids, '{}'::uuid[])
      into v_existing_batch_no, v_existing_project_ids
      from public.delivery_batches where id = v_batch_id for update;
    if exists (select 1 from public.delivery_batches where batch_no = v_batch_no and id <> v_batch_id) then
        raise exception 'Batch number is already in use' using errcode = '23505';
    end if;
    if exists (select 1 from unnest(v_removed_project_ids) as x(id)
               where not (x.id = any(v_existing_project_ids)))
       or exists (select 1 from unnest(v_removed_project_ids) as x(id)
                  where x.id = any(v_selected_project_ids)) then
        raise exception 'Removed projects do not match this batch' using errcode = '22023';
    end if;
    if (select array_agg(id order by id) from unnest(v_removed_project_ids) as x(id))
       is distinct from (select array_agg(id order by id) from unnest(v_existing_project_ids) as x(id)
                         where not (x.id = any(v_selected_project_ids))) then
        raise exception 'Batch membership changed; refresh before saving' using errcode = '40001';
    end if;
    -- Lock the customer rows before checking links, so two batch saves cannot
    -- claim the same customer at the same time.
    perform 1 from public.admin where id = any(v_selected_project_ids) or id = any(v_removed_project_ids) for update;
    if (select count(*) from public.admin where id = any(v_selected_project_ids) and deleted_at is null
          and (delivery_batch_id is null
               or delivery_batch_id = coalesce(v_existing_batch_no, v_batch_no)
               -- Partly delivered: the rest can go on a new batch.
               or coalesce(delivery_partial, false)
               -- Already on this batch, since moved to a later batch for the rest.
               or id = any(v_existing_project_ids)))
       <> cardinality(v_selected_project_ids) then
        raise exception 'A selected customer is missing or belongs to another batch' using errcode = '22023';
    end if;
    if (select count(*) from public.admin where id = any(v_removed_project_ids) and deleted_at is null)
       <> cardinality(v_removed_project_ids) then
        raise exception 'A removed customer is no longer linked to this batch' using errcode = '22023';
    end if;

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
        car_rent_paid_by,
        car_rent_paid_at,
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
        v_car_rent_paid_by,
        v_car_rent_paid_at,
        v_vendor,
        v_notes,
        v_status,
        v_selected_project_ids,
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
        car_rent_paid_by = excluded.car_rent_paid_by,
        car_rent_paid_at = excluded.car_rent_paid_at,
        vendor = excluded.vendor,
        notes = excluded.notes,
        status = excluded.status,
        project_ids = excluded.project_ids,
        updated_at = now();

    -- Bulk update all newly/currently selected projects in public.admin
    if cardinality(v_selected_project_ids) > 0 then
        update public.admin
        set
            delivery_batch_id = v_batch_no,
            material_delivery_date = v_dispatch_date,
            driver_name = v_driver_name,
            driver_phone_number = v_driver_phone,
            vehicle_number = v_vehicle_number,
            vendor = coalesce(v_vendor, vendor),
            delivery_status = case 
                when v_status = 'DELIVERED' then 'DELIVERED'
                when delivery_status is null or delivery_status = 'PENDING' then v_status
                when coalesce(delivery_partial, false) and delivery_batch_id is distinct from coalesce(v_existing_batch_no, v_batch_no) then v_status
                else delivery_status
            end,
            delivery_partial = case
                when delivery_batch_id is distinct from coalesce(v_existing_batch_no, v_batch_no) then false
                else delivery_partial
            end,
            updated_at = now()
        where id = any(v_selected_project_ids)
          and deleted_at is null
          -- Members that moved on to a later batch keep that batch's details.
          and (delivery_batch_id is null
               or delivery_batch_id = coalesce(v_existing_batch_no, v_batch_no)
               or not (id = any(v_existing_project_ids)));
        get diagnostics v_project_rows = row_count;
        if v_project_rows <> (select count(*) from public.admin where id = any(v_selected_project_ids)
                               and deleted_at is null and delivery_batch_id = v_batch_no) then
            raise exception 'Some selected customers could not be updated' using errcode = 'P0001';
        end if;
    end if;

    -- Bulk clear any projects that were removed/unchecked from this batch
    if cardinality(v_removed_project_ids) > 0 then
        update public.admin
        set
            delivery_batch_id = null,
            delivery_status = 'PENDING',
            driver_name = null,
            driver_phone_number = null,
            vehicle_number = null,
            material_delivery_date = null,
            updated_at = now()
        where id = any(v_removed_project_ids)
          and deleted_at is null
          and delivery_batch_id = v_existing_batch_no;
        -- A removed customer that already moved to a later batch is left there.
    end if;

    return jsonb_build_object('success', true, 'batch_id', v_batch_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_delivery_batch_status_atomic(p_batch_id uuid, p_new_status text, p_project_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_batch_rows   int := 0;
    v_project_rows int := 0;
    v_expected     int := coalesce(array_length(p_project_ids, 1), 0);
    v_batch_project_ids uuid[];
    v_batch_no text;
begin
    if auth.uid() is null or public.get_my_user_type() not in ('admin', 'sales') then
        raise exception 'Not authorized to change delivery status' using errcode = '42501';
    end if;
    if p_new_status not in ('IN_TRANSIT', 'DELIVERED') then
        raise exception 'Invalid delivery status' using errcode = '22023';
    end if;
    select batch_no, coalesce(project_ids, '{}'::uuid[])
      into v_batch_no, v_batch_project_ids
      from public.delivery_batches where id = p_batch_id for update;
    if not found then
        raise exception 'Delivery batch not found' using errcode = 'P0002';
    end if;
    if (select array_agg(id order by id) from unnest(v_batch_project_ids) as x(id))
       is distinct from (select array_agg(id_text::uuid order by id_text::uuid)
                         from unnest(coalesce(p_project_ids, '{}'::text[])) as x(id_text)) then
        raise exception 'Batch membership changed; refresh before changing status' using errcode = '40001';
    end if;
    perform 1 from public.admin where id = any(v_batch_project_ids) for update;
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
        where id = any(v_batch_project_ids)
          and deleted_at is null
          and delivery_batch_id = v_batch_no;
        get diagnostics v_project_rows = row_count;
        -- Customers moved to a later batch for the rest of a partial delivery
        -- stay listed here as history but follow the later batch.
        v_expected := (select count(*) from public.admin where id = any(v_batch_project_ids)
                        and deleted_at is null and delivery_batch_id = v_batch_no);
        if v_project_rows <> v_expected then
            raise exception 'Some batch customers could not be updated' using errcode = 'P0001';
        end if;
    end if;

    -- A missing linked customer raises above and rolls back the whole update.
    return jsonb_build_object(
        'success',           true,
        'batch_id',          p_batch_id,
        'status',            p_new_status,
        'projects_expected', v_expected,
        'projects_updated',  v_project_rows,
        'projects_missing',  v_expected - v_project_rows
    );
end;
$function$
;

commit;

-- Verification after commit:
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'admin' and column_name = 'delivery_partial';
