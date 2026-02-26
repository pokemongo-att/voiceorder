---
description: start app and run quick smoke test for order flow
---
1. ตรวจสอบ env ที่จำเป็นใน `.env.local` (`DATABASE_URL`, และ `STAFF_API_KEY` ถ้าเปิดใช้งาน)
2. รัน migration ก่อนเริ่มระบบ: `npm run db:migrate`
3. เปิด dev server: `npm run dev`
4. ทดสอบ parse API (PowerShell):
   `Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/parse -ContentType 'application/json' -Body '{"text":"ชานม 2 แก้ว โกโก้ 1 แก้ว"}'`
5. ทดสอบบันทึกออเดอร์ (PowerShell):
   `Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/orders -ContentType 'application/json' -Headers @{ 'x-staff-key'='change-me' } -Body '{"rawText":"ชานม 2 แก้ว โกโก้ 1 แก้ว","createdBy":"staff","items":[{"menuName":"ชานม","qty":2},{"menuName":"โกโก้","qty":1}]}'`
6. เปิด `http://localhost:3000/orders` เพื่อตรวจว่าข้อมูลถูกบันทึกเรียบร้อย
