---
description: day-to-day operations workflow for voice order system
---
1. ก่อนเริ่มงานทุกวัน ให้ sync schema กับฐานข้อมูลด้วย `npm run db:migrate`
2. เปิดระบบด้วย `npm run dev`
3. ตรวจเส้นทางหลัก:
   - `/` สำหรับรับออเดอร์เสียง
   - `/orders` สำหรับดูออเดอร์ล่าสุด
4. เมื่อมีการเปลี่ยน `src/db/schema.ts`:
   - สร้างไฟล์ migration ใหม่: `npm run db:generate`
   - ตรวจ SQL ใน `drizzle/migrations`
   - รัน `npm run db:migrate` อีกครั้ง
5. หากบันทึกออเดอร์ไม่ได้ ให้ตรวจลำดับนี้:
   - `DATABASE_URL` ใน `.env.local`
   - `STAFF_API_KEY` และ header `x-staff-key`
   - ตาราง `_migrations` และตารางหลัก (`orders`, `order_items`, `menus`)
