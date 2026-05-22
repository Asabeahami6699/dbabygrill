-- Enable live order updates on delivery guy + company dashboards.
-- Run once in Supabase SQL Editor.

alter table public.orders replica identity full;

-- Delivery drivers can receive Realtime events for their company's orders
drop policy if exists "orders_delivery_guy_select" on public.orders;
create policy "orders_delivery_guy_select"
  on public.orders
  for select
  using (
    company_id in (
      select dg.company_id
      from public.delivery_guys dg
      where dg.user_id = auth.uid()
    )
  );

-- Skip if already in publication (duplicate errors are OK to ignore)
-- alter publication supabase_realtime add table public.orders;
