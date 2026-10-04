-- Record loading for each saved solar panel serial without changing the
-- existing admin.panel_serial_no format or deleting previous status rows.
create table if not exists public.panel_loading (
    customer_id uuid not null references public.admin(id) on delete cascade,
    serial_no text not null check (btrim(serial_no) <> ''),
    loaded boolean not null default false,
    loaded_at timestamptz,
    updated_at timestamptz not null default now(),
    updated_by uuid,
    primary key (customer_id, serial_no)
);
alter table public.panel_loading enable row level security;
revoke all on public.panel_loading from public, anon, authenticated;

-- An old Solar Panel line could only mean "all panels loaded". Carry that
-- state to its saved serials. If no historical loading day was recorded, keep
-- loaded_at null rather than inventing today's date for an old action.
insert into public.panel_loading (customer_id, serial_no, loaded, loaded_at)
select a.id, btrim(serials.serial_no), true,
       b.material_loaded_date::timestamp at time zone 'Asia/Kolkata'
from public.admin a
join public.bom b on b.admin_id = a.id
join public.bom_items item on item.bom_id = b.id
    and lower(btrim(item.product_name)) = 'solar panel'
    and item.loaded = true
cross join lateral (
    select value as serial_no
    from jsonb_array_elements_text(
        case when jsonb_typeof(a.panel_serial_no::jsonb) = 'array'
            then a.panel_serial_no::jsonb else '[]'::jsonb end
    ) as value
    union all
    select value as serial_no
    from regexp_split_to_table(
        case when jsonb_typeof(a.panel_serial_no::jsonb) = 'array'
            then '' else coalesce(a.panel_serial_no #>> '{}', '') end,
        E'[,\n]+'
    ) as value
) serials
where btrim(serials.serial_no) <> ''
on conflict (customer_id, serial_no) do nothing;

create or replace function public.stamp_panel_loading()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
    new.updated_at := now();
    new.updated_by := (select auth.uid());
    if new.loaded then
        if tg_op = 'UPDATE' then
            new.loaded_at := case when old.loaded then old.loaded_at else now() end;
        else
            -- SQL Editor backfills have no auth user and may have only a
            -- historical date (or no date). Normal signed-in taps get now().
            new.loaded_at := case when (select auth.uid()) is null
                then new.loaded_at else now() end;
        end if;
    else
        new.loaded_at := null;
    end if;
    return new;
end;
$$;

drop trigger if exists stamp_panel_loading on public.panel_loading;
create trigger stamp_panel_loading
before insert or update on public.panel_loading
for each row execute function public.stamp_panel_loading();

drop policy if exists panel_loading_select on public.panel_loading;
create policy panel_loading_select on public.panel_loading
for select to authenticated
using (exists (select 1 from public.admin a where a.id = panel_loading.customer_id));

drop policy if exists panel_loading_insert on public.panel_loading;
create policy panel_loading_insert on public.panel_loading
for insert to authenticated
with check (
    public.get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    and exists (select 1 from public.admin a where a.id = panel_loading.customer_id)
);

drop policy if exists panel_loading_update on public.panel_loading;
create policy panel_loading_update on public.panel_loading
for update to authenticated
using (
    public.get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    and exists (select 1 from public.admin a where a.id = panel_loading.customer_id)
)
with check (
    public.get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    and exists (select 1 from public.admin a where a.id = panel_loading.customer_id)
);

grant select on public.panel_loading to authenticated;
grant insert (customer_id, serial_no, loaded) on public.panel_loading to authenticated;
grant update (customer_id, serial_no, loaded) on public.panel_loading to authenticated;

-- Verification after applying: a permitted account should be able to select
-- its customer rows and upsert one saved serial. An unrelated account should
-- receive no rows and must not be able to write a row for that customer.
