create extension if not exists pgcrypto;

create table if not exists public.quotations (
    id uuid primary key default gen_random_uuid(),

    -- Display as Quote-3255, Quote-3256, etc. in the frontend.
    quotation_no bigint generated always as identity unique,

    -- Creator and ownership.
    owner_id uuid not null default auth.uid()
        references public.profiles(id) on delete restrict,

    -- Snapshots preserve what appeared on the issued quotation.
    owner_name_snapshot text,
    owner_phone_snapshot text,

    -- Optional source when creating a quote from an existing CRM lead.
    source_lead_id uuid
        references public.admin(id) on delete set null,

    -- Filled after a quotation prospect is converted into a CRM lead.
    converted_lead_id uuid
        references public.admin(id) on delete set null,

    -- Searchable customer details.
    customer_name text not null,
    customer_phone text not null,
    customer_email text,
    full_address text,
    village text,
    taluka text,
    district text,
    pincode text,

    -- Main project details used by list views and reporting.
    quotation_date date not null default current_date,
    valid_until date,
    capacity_kw numeric(10, 2),
    project_type text,
    solar_panel_make text,
    solar_panel_qty integer,
    panel_wattage numeric(10, 2),
    inverter_option text,
    inverter_brand text,
    geb_geda_charge text,

    -- Minimum/selected financial summary for list views.
    starting_price numeric(14, 2),
    selected_option smallint,

    -- draft → issued → converted/lost
    status text not null default 'draft',

    lost_reason text,
    lost_remark text,

    -- Complete versioned quotation snapshot.
    quotation_data jsonb not null default '{}'::jsonb,
    schema_version integer not null default 1,

    -- Optional archived PDF path if PDF storage is added later.
    pdf_storage_path text,

    issued_at timestamptz,
    converted_at timestamptz,
    lost_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint quotations_customer_name_not_blank
        check (length(trim(customer_name)) > 0),

    constraint quotations_phone_not_blank
        check (length(trim(customer_phone)) > 0),

    constraint quotations_capacity_positive
        check (capacity_kw is null or capacity_kw > 0),

    constraint quotations_panel_qty_positive
        check (solar_panel_qty is null or solar_panel_qty > 0),

    constraint quotations_panel_wattage_positive
        check (panel_wattage is null or panel_wattage > 0),

    constraint quotations_status_valid
        check (status in ('draft', 'issued', 'converted', 'lost')),

    constraint quotations_project_type_valid
        check (
            project_type is null
            or project_type in ('Residential', 'Commercial')
        ),

    constraint quotations_geda_charge_valid
        check (
            geb_geda_charge is null
            or geb_geda_charge in ('Including', 'Excluding')
        ),

    constraint quotations_selected_option_valid
        check (
            selected_option is null
            or selected_option between 1 and 3
        ),

    constraint quotations_data_is_object
        check (jsonb_typeof(quotation_data) = 'object'),

    constraint quotations_converted_has_lead
        check (
            status <> 'converted'
            or converted_lead_id is not null
        ),

    constraint quotations_lost_has_reason
        check (
            status <> 'lost'
            or length(trim(coalesce(lost_reason, ''))) > 0
        )
);

create index if not exists quotations_owner_created_idx
    on public.quotations (owner_id, created_at desc);

create index if not exists quotations_owner_status_idx
    on public.quotations (owner_id, status, updated_at desc);

create index if not exists quotations_customer_name_idx
    on public.quotations (lower(customer_name));

create index if not exists quotations_customer_phone_idx
    on public.quotations (customer_phone);

create index if not exists quotations_source_lead_idx
    on public.quotations (source_lead_id)
    where source_lead_id is not null;

create index if not exists quotations_converted_lead_idx
    on public.quotations (converted_lead_id)
    where converted_lead_id is not null;


-- Keep updated_at accurate.
create or replace function public.set_quotation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists quotations_set_updated_at
on public.quotations;

create trigger quotations_set_updated_at
before update on public.quotations
for each row
execute function public.set_quotation_updated_at();


-- Protect the table through RLS.
alter table public.quotations enable row level security;

revoke all on table public.quotations from anon;
revoke all on table public.quotations from authenticated;

grant select, insert, update, delete
on table public.quotations
to authenticated;

grant usage, select
on sequence public.quotations_quotation_no_seq
to authenticated;


-- Agents and dealers see their own quotations.
-- Admin and Sales see all quotations.
drop policy if exists quotations_select on public.quotations;

create policy quotations_select
on public.quotations
for select
to authenticated
using (
    owner_id = (select auth.uid())
    or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.user_type in ('admin', 'sales')
    )
);


-- Only Agent, Dealer, Admin and Sales roles can create quotations.
-- A normal user can only create a quotation owned by themselves.
drop policy if exists quotations_insert on public.quotations;

create policy quotations_insert
on public.quotations
for insert
to authenticated
with check (
    (
        owner_id = (select auth.uid())
        and exists (
            select 1
            from public.profiles p
            where p.id = (select auth.uid())
              and p.user_type in ('agent', 'agent2')
        )
    )
    or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.user_type in ('admin', 'sales')
    )
);


-- Owners can update their own quotations.
-- Admin and Sales can update all quotations.
drop policy if exists quotations_update on public.quotations;

create policy quotations_update
on public.quotations
for update
to authenticated
using (
    owner_id = (select auth.uid())
    or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.user_type in ('admin', 'sales')
    )
)
with check (
    owner_id = (select auth.uid())
    or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.user_type in ('admin', 'sales')
    )
);


-- Owners may delete only drafts.
-- Admin and Sales may delete any quotation.
drop policy if exists quotations_delete on public.quotations;

create policy quotations_delete
on public.quotations
for delete
to authenticated
using (
    (
        owner_id = (select auth.uid())
        and status = 'draft'
    )
    or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.user_type in ('admin', 'sales')
    )
);
