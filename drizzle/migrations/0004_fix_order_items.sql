-- fix: drop menu_id NOT NULL constraint (legacy column from 0001)
ALTER TABLE order_items ALTER COLUMN menu_id DROP NOT NULL;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_menu_id_fkey;

-- make product_id NOT NULL (backfill first)
UPDATE order_items SET product_id = '00000000-0000-0000-0000-000000000000' WHERE product_id IS NULL;
ALTER TABLE order_items ALTER COLUMN product_id SET NOT NULL;

-- make product_name_snapshot NOT NULL (backfill first)
UPDATE order_items SET product_name_snapshot = coalesce(menu_name, 'unknown') WHERE product_name_snapshot IS NULL;
ALTER TABLE order_items ALTER COLUMN product_name_snapshot SET NOT NULL;

-- add order_no to orders (sequential per shop session)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_no integer;

-- seed วุ้นบุก / บุก product variants (same base price)
INSERT INTO products (name, price) VALUES
  ('วุ้นบุกน้ำผึ้ง', 20),
  ('วุ้นบุกคาราเมล', 20),
  ('วุ้นบุกสตรอเบอรี่', 20),
  ('บุกบราวน์ชูก้าร์', 20),
  ('บุกเฉาก๊วย', 20),
  ('วุ้นบุก', 20)
ON CONFLICT (name) DO UPDATE SET price = excluded.price;
