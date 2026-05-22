-- Product rating feedback + reminder tracking.

alter table if exists order_reviews
  add column if not exists owner_response text,
  add column if not exists owner_responded_at timestamptz;

create table if not exists rating_reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  order_id uuid not null,
  product_id uuid not null,
  reminder_count int not null default 0,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_rating_reminders_user_order_product
  on rating_reminders(user_id, order_id, product_id);

create index if not exists idx_rating_reminders_user_id
  on rating_reminders(user_id);
