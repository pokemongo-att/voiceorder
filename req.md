พัฒนา Web Application

รับออเดอร์ด้วยเสียง

แยกรายการจากคำว่า “แก้ว” หรือ “ตัวเลข”

ระบบสินค้า + ราคา

ระบบพนักงาน

ระบบ role (admin / staff)

รายงานยอดขาย

ระบบปิดร้าน

ดึงราคาสินค้าอัตโนมัติ

default price fallback (20 บาท)
1️⃣ ระบบแปลงเสียง (Parser Upgrade)
Requirement:

เมื่อพบคำว่า:

“แก้ว”

หรือ ตัวเลข (1,2,3,4…)

ให้ถือว่าเป็น “จบ 1 รายการ”

ตัวอย่าง input:

ชาเย็น2แก้วกาแฟ3แก้ว

ต้อง parse เป็น:

ชาเย็น 2

กาแฟ 3

Parsing Rules:

แยก token แบบไม่ต้องเว้นวรรคก็ได้

Regex จับ pattern:
(ชื่อสินค้า)(จำนวน)(แก้ว optional)

Example Regex logic:

(\D+?)(\d+)(?:แก้ว)?

ถ้าไม่มีจำนวน → qty = 1

Trim whitespace

Remove filler words: เอา ขอ ครับ ค่ะ หน่อย

Return format:

{
items: [
{ name: "ชาเย็น", qty: 2 },
{ name: "กาแฟ", qty: 3 }
]
}

2️⃣ ระบบสินค้า (Products)
Table: products

id (uuid)

name (text unique)

price (numeric)

is_active (boolean)

created_at

Requirement:

Admin สามารถ:

เพิ่มสินค้า

แก้ไขราคา

ลบสินค้า (soft delete)

Staff ดูได้อย่างเดียว

3️⃣ ระบบดึงราคาอัตโนมัติ

เมื่อกดบันทึก order:

Lookup product by name

ถ้าพบ → ใช้ price จาก DB

ถ้าไม่พบ:

ใช้ DEFAULT_PRICE = 20

และ auto create product ใหม่ด้วย price = 20

4️⃣ ระบบพนักงาน
Table: staffs

id

name

role (admin | staff)

is_active

created_at

Admin สามารถ:

สร้าง staff

แก้ไข

ปิดการใช้งาน

5️⃣ ระบบ Role & Auth

Simple Auth Model:

Table: users

id

username

password_hash

role (admin | staff)

staff_id (nullable)

is_active

Middleware:

/admin/* → admin only

/orders → staff or admin

6️⃣ ระบบ Order (Upgrade)
orders

id

staff_id

total_amount

total_qty

status (open | closed)

created_at

order_items

id

order_id

product_id

product_name_snapshot

price_snapshot

qty

subtotal

7️⃣ ระบบรายงาน
Daily Sales Report

Endpoint:

GET /api/reports/daily?date=YYYY-MM-DD

Return:

{
totalSales: 3500,
totalOrders: 52,
totalCups: 87,
topProducts: [
{ name: "ชาเย็น", qty: 30 }
]
}

Query:

SELECT
SUM(total_amount),
COUNT(id),
SUM(total_qty)
FROM orders
WHERE date(created_at) = ?

8️⃣ ระบบปิดร้าน

Table: shop_sessions

id

opened_at

closed_at

opened_by

closed_by

total_sales_snapshot

Flow:

Admin กด “ปิดร้าน”

ระบบ:

สรุปยอดวันนั้น

set orders status = closed

create shop_session record

ไม่อนุญาตให้สร้าง order ใหม่จนกว่าจะ “เปิดร้าน”

9️⃣ UI Requirements

Mobile First

Main screen:

เลือกพนักงาน

ปุ่มไมค์ (pulse animation)

แสดงรายการ

แสดงราคาต่อแก้ว

แสดง subtotal ต่อ item

แสดง total ด้านล่าง

Sticky confirm button

Admin screen:

จัดการสินค้า

จัดการ staff

ดูรายงาน

ปิดร้าน

🔟 Animation Requirements

เมื่อ listening = true:

ปุ่มไมค์มี pulse animation

ใช้ CSS:

@keyframes pulse {
0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
70% { box-shadow: 0 0 0 20px rgba(34,197,94,0); }
100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}

11️⃣ Business Logic Flow (สำคัญมาก)

Voice → parse

Preview

Confirm

For each item:

find product

assign price

calculate subtotal

Calculate total_amount

Save order

Return orderId

12️⃣ Default Price Logic

ENV:

DEFAULT_PRICE=20

If product not found:

create product with default price

use that price