import { createBrowserClient } from '@supabase/ssr'

// สร้างตัวแปรที่ชื่อ supabase และ export ออกไป
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// (ฟังก์ชันเดิมจะเก็บไว้ก็ได้ครับ ไม่เสียหาย)
export function createClient() {
  return supabase
}