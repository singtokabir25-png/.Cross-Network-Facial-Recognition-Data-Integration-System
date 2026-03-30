'use client'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'

export default function AccessDeniedPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-4 font-sans">
      <div className="text-center w-full max-w-xl bg-[#1e293b] p-12 rounded-3xl shadow-2xl border border-slate-700 relative overflow-hidden">
        
        {/* ไอคอนแม่กุญแจล็อกเท่ๆ */}
        <div className="absolute -top-10 -right-10 text-[200px] text-emerald-500/10 rotate-12">
          🔒
        </div>
        
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="text-9xl mb-4 text-emerald-400">403</div>
          
          <h1 className="text-4xl font-extrabold text-slate-100 tracking-tight">
            Oops! Access Denied
          </h1>
          
          <p className="text-lg text-slate-400 max-w-sm">
            ขออภัยครับ คุณไม่มีสิทธิ์เข้าถึงหน้านี้ โปรดติดต่อผู้ดูแลระบบหากคิดว่ามีข้อผิดพลาด
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-10 w-full justify-center">
            {/* ปุ่มกลับหน้า Dashboard/Input ตามสิทธิ์ */}
            <button 
              onClick={() => router.back()} // ให้ถอยกลับไปหน้าก่อนหน้า
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold text-slate-100 transition-all w-full sm:w-auto"
            >
              ← กลับไปหน้าก่อนหน้า
            </button>
            
            {/* ปุ่มออกจากระบบ เผื่อจะ Login ด้วย ID อื่นที่มีสิทธิ์ */}
            <button 
              onClick={handleLogout}
              className="px-8 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl font-semibold transition-all w-full sm:w-auto"
            >
              ออกจากระบบ (Sign Out)
            </button>
          </div>
          
          {/* ข้อความช่วยเหลือเล็กๆ */}
          <p className="mt-8 text-xs text-slate-600">
            Current User ID: {supabase.auth.getUser().then(({data}) => data.user?.id || 'Unknown')}
          </p>
        </div>
      </div>
    </div>
  )
}