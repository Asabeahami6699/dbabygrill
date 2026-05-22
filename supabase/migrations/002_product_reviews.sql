-- Add product-based ratings support.
-- This lets each delivered order rate each product independently.

alter table if exists order_reviews
  add column if not exists product_id uuid references products(id) on delete cascade;

create index if not exists idx_order_reviews_product_id
  on order_reviews(product_id);

-- Prevent duplicate rating for same product in same order.
create unique index if not exists ux_order_reviews_order_product
  on order_reviews(order_id, product_id);
