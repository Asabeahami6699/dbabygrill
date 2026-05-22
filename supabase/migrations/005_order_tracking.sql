-- Track each order status transition for customer timeline updates.

create table if not exists public.order_tracking (
  id uuid not null default gen_random_uuid(),
  order_id uuid null,
  status text not null,
  message text null,
  created_at timestamp with time zone null default now(),
  constraint order_tracking_pkey primary key (id),
  constraint order_tracking_order_id_fkey foreign key (order_id) references orders (id) on delete cascade
) tablespace pg_default;

create index if not exists idx_order_tracking_order_id
on public.order_tracking using btree (order_id) tablespace pg_default;
