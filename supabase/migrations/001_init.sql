create extension if not exists "uuid-ossp";

create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp default now()
);

alter table companies enable row level security;
