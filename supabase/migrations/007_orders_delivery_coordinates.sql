-- Precise map pin for customer delivery (GPS at checkout)
alter table public.orders
  add column if not exists delivery_latitude numeric,
  add column if not exists delivery_longitude numeric;
