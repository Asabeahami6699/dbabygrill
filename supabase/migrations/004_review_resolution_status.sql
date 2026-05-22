-- Track whether a rating issue has been resolved by the owner.

alter table if exists order_reviews
  add column if not exists issue_resolved boolean not null default false,
  add column if not exists resolved_at timestamptz;
