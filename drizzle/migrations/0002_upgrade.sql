-- products table
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null default 20,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_name_idx on products (name);

-- staffs table
create table if not exists staffs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- users table (auth)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null default 'staff',
  staff_id uuid references staffs(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists users_username_idx on users (username);

-- shop_sessions table
create table if not exists shop_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid not null references staffs(id),
  closed_by uuid references staffs(id),
  total_sales_snapshot numeric(10,2)
);

-- upgrade orders: add new columns
alter table orders add column if not exists staff_id uuid references staffs(id);
alter table orders add column if not exists total_amount numeric(10,2) not null default 0;
alter table orders add column if not exists total_qty int not null default 0;
alter table orders add column if not exists status text not null default 'open';
create index if not exists orders_status_idx on orders (status);

-- upgrade order_items: add new columns, rename old ones
alter table order_items add column if not exists product_id uuid;
alter table order_items add column if not exists product_name_snapshot text;
alter table order_items add column if not exists price_snapshot numeric(10,2) not null default 0;
alter table order_items add column if not exists subtotal numeric(10,2) not null default 0;

-- backfill product_name_snapshot from menu_name if exists
update order_items set product_name_snapshot = menu_name where product_name_snapshot is null and menu_name is not null;

-- seed: create default admin staff + admin user (password: admin123)
-- password_hash = sha256 of 'admin123' (simple demo, not bcrypt)
insert into staffs (name, role) values ('Admin', 'admin') on conflict do nothing;

insert into users (username, password_hash, role, staff_id)
select 'admin',
       '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
       'admin',
       s.id
from staffs s where s.name = 'Admin' and s.role = 'admin'
on conflict (username) do nothing;
