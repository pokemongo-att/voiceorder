# Voice Order (Next.js + Neon + Drizzle)

ระบบรับออเดอร์ด้วยเสียงสำหรับร้านขายน้ำ (Android เป็นหลัก)

## 1) Setup

```bash
pnpm i   # หรือ npm i / yarn
cp .env.example .env.local
# แก้ DATABASE_URL ให้เป็นของ Neon
# ถ้าจะเปิด STAFF_API_KEY ให้ตั้ง NEXT_PUBLIC_STAFF_API_KEY ให้ตรงกัน
```

## 2) สร้างตาราง (ครั้งแรก)

```bash
pnpm db:migrate
```

> สคริปต์ `db:migrate` จะรันไฟล์ SQL ใน `drizzle/migrations` ตามลำดับ

## 3) Run

```bash
pnpm dev
```

เปิด:
- `/` หน้า Voice Order
- `/orders` ดูรายการออเดอร์ล่าสุด

## Notes
- Android/Chrome: ใช้ Web Speech API (SpeechRecognition)
- iOS Safari: อาจไม่รองรับ (โครงการนี้โฟกัส Android ตามโจทย์)
