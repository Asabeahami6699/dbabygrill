-- Policies + realtime for EXISTING public.delivery_locations table.
-- Do NOT run if you already applied equivalent RLS/realtime in the dashboard.
--
-- Expected schema (your table):
--   id uuid PK, delivery_guy_id uuid UNIQUE, order_id uuid nullable,
--   latitude/longitude numeric, accuracy/heading/speed numeric,
--   is_online boolean, updated_at timestamptz

alter table public.delivery_locations enable row level security;

drop policy if exists "delivery_locations_driver_all" on public.delivery_locations;
create policy "delivery_locations_driver_all"
  on public.delivery_locations
  for all
  using (
    delivery_guy_id in (
      select id from public.delivery_guys where user_id = auth.uid()
    )
  )
  with check (
    delivery_guy_id in (
      select id from public.delivery_guys where user_id = auth.uid()
    )
  );

drop policy if exists "delivery_locations_customer_read" on public.delivery_locations;
create policy "delivery_locations_customer_read"
  on public.delivery_locations
  for select
  using (
    delivery_guy_id in (
      select o.delivery_guy_id
      from public.orders o
      where o.user_id = auth.uid()
        and o.delivery_guy_id is not null
        and o.status = 'out_for_delivery'
    )
  );

-- Enable Supabase Realtime (skip if already added — duplicate errors are safe to ignore)
-- alter publication supabase_realtime add table public.delivery_locations;
