# Fix Supabase Auth Redirect URLs

## ปัญหา
URL ยัง redirect กลับ localhost อยู่

## วิธีแก้

### 1. เปิด Supabase Dashboard
ไปที่ **https://supabase.com/dashboard** → เลือก project ของคุณ

### 2. ไปที่ Authentication → URL Configuration

### 3. แก้ Redirect URLs
ลบ `http://localhost:3000` ออก แล้วใส่:

```
https://your-vercel-domain.vercel.app
```

**สำคัญ:** ใส่ทั้งสองแบบ:
- `https://your-vercel-domain.vercel.app`
- `https://your-vercel-domain.vercel.app/**`

(ถ้ามี custom domain ก็ใส่ด้วย)

### 4. Site URL
เปลี่ยน Site URL จาก `http://localhost:3000` เป็น:
```
https://your-vercel-domain.vercel.app
```

### 5. กด Save

## หลังแก้แล้ว
- Login/Signup จะ redirect กลับ domain ที่ถูกต้อง
- Email confirmation link จะชี้ไปที่ domain ที่ถูกต้อง
