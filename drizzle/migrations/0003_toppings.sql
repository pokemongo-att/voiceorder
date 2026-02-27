-- toppings table
create table if not exists toppings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists toppings_name_idx on toppings (name);

-- upgrade order_items: add topping/sweetness columns
alter table order_items add column if not exists toppings_snapshot jsonb default '[]';
alter table order_items add column if not exists sweetness text;
alter table order_items add column if not exists topping_total numeric(10,2) not null default 0;

-- seed toppings
insert into toppings (name, price) values
  ('บุก', 10),
  ('มุกป๊อป', 10),
  ('ครีมชีส', 15)
on conflict (name) do update set price = excluded.price;

-- seed products
insert into products (name, price) values
  ('ชาเขียว', 29),
  ('ชาไทย', 29),
  ('ชานมไต้หวัน', 29),
  ('นมสดบราวน์ชูก้า', 29),
  ('ชาเขียวบราวน์ชูก้า', 29),
  ('โกโก้', 34),
  ('โอวัลติน', 29),
  ('ชาไทยปั่น', 45),
  ('ชาเขียวปั่น', 45),
  ('ชานมไต้หวันปั่น', 45),
  ('สตรอเบอรี่นมสดปั่น', 45),
  ('นมชมพู', 20),
  ('อเมริกาโน่', 25),
  ('อเมริกาโน่น้ำผึ้งมะนาว', 25),
  ('มะพร้าวน้ำหอมอเมริกาโน่', 29),
  ('มะพร้าวน้ำหอมนมชาไทย', 35),
  ('มะพร้าวน้ำหอมนมชาเขียว', 35),
  ('ชาเย็น', 20),
  ('กาแฟ', 25),
  ('ชานม', 25)
on conflict (name) do update set price = excluded.price;
