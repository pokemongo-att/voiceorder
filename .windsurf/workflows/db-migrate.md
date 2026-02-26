---
description: run database migration for Neon + Drizzle
---
1. ตรวจสอบว่ามีไฟล์ `.env.local` และกำหนด `DATABASE_URL` ถูกต้อง
2. ติดตั้งแพ็กเกจ (ถ้ายังไม่ติดตั้ง): `npm install`
3. สร้าง migration SQL จาก schema (ถ้ามีการเปลี่ยน schema): `npm run db:generate`
4. รัน migration: `npm run db:migrate`
5. ตรวจสอบผลว่าตารางถูกสร้างแล้ว โดยเปิดหน้า `/orders` หรือเรียก API ที่ใช้งานฐานข้อมูล
