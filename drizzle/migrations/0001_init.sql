create extension if not exists "pgcrypto";

create table if not exists menus (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists menus_name_idx on menus (name);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null default '',
  created_by text not null default 'staff',
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on orders (created_at);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_id uuid not null references menus(id),
  menu_name text not null,
  qty int not null default 1
);

create index if not exists order_items_order_id_idx on order_items (order_id);
