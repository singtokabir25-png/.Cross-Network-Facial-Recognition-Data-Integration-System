'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client' // เปลี่ยนมาใช้ SSR Client
import { useEffect, useState } from 'react'

export default function AccessDeniedPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('Initializing...')
  
  const supabase = createClient()

  useEffect(() => {
    const getUserId = async () => {
      // ดึงข้อมูล User ด้วยวิธีใหม่
      const { data } = await supabase.auth.getUser()
      setUserId(data.user?.id || 'Unknown Identity')
    }
    getUserId()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-4 font-sans selection:bg-red-500/30">
      <div className="text-center w-full max-w-xl bg-[#1e293b] p-12 rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-800 relative overflow-hidden group">
        
        {/* กราฟิกพื้นหลังเพิ่มมิติ */}
        <div className="absolute -top-16 -right-16 text-[240px] text-red-600/5 rotate-12 pointer-events-none group-hover:text-red-600/10 transition-colors duration-700">
          🔒
        </div>
        
        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* สถานะ 403 แบบ Cyber Security Style */}
          <div className="relative">
            <div className="text-9xl font-black text-red-600 tracking-tighter drop-shadow-[0_0_15px_rgba(220,38,38,0.4)] animate-pulse">
              403
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-[10px] px-3 py-1 rounded-full font-black tracking-[0.2em] uppercase shadow-lg shadow-red-900/40">
              Access Denied
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <h1 className="text-4xl font-black text-slate-100 tracking-tighter uppercase italic italic">
              Restricted Area
            </h1>
            <div className="h-1 w-20 bg-red-600 mx-auto rounded-full"></div>
          </div>
          
          <p className="text-base text-slate-400 max-w-sm font-medium leading-relaxed">
            ขออภัย พื้นที่ส่วนนี้ถูกจำกัดสิทธิ์เฉพาะระดับ <span className="text-red-400 font-bold">Admin</span> หรือ <span className="text-orange-400 font-bold">Manager</span> เท่านั้น โปรดติดต่อผู้ดูแลระบบหากคุณคิดว่านี่คือข้อผิดพลาด
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full justify-center">
            {/* ปุ่มกลับหน้าก่อนหน้า */}
            <button 
              onClick={() => router.back()}
              className="px-8 py-4 bg-slate-800/50 hover:bg-slate-700/80 rounded-2xl font-black text-slate-300 border border-slate-700/50 transition-all w-full sm:w-auto active:scale-95 flex items-center justify-center gap-2"
            >
              <span>←</span> กลับไปก่อนหน้า
            </button>
            
            {/* ปุ่มออกจากระบบ */}
            <button 
              onClick={handleLogout}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black transition-all w-full sm:w-auto shadow-xl shadow-red-900/30 active:scale-95 uppercase tracking-tight"
            >
              ลงชื่อออก (Sign Out)
            </button>
          </div>
          
          {/* Security Log Footer */}
          <div className="mt-10 pt-8 border-t border-slate-800/50 w-full flex flex-col gap-2 items-center">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
                  Security Reference ID
                </p>
              </div>
              <p className="text-[10px] text-slate-600 font-mono break-all px-6 py-2 bg-[#0f172a]/50 rounded-xl border border-slate-800/50">
                {userId}
              </p>
          </div>
        </div>
      </div>
      
      {/* ลายน้ำระบบ */}
      <div className="mt-8 flex flex-col items-center gap-1 opacity-40 group hover:opacity-100 transition-opacity">
        <p className="text-xs text-slate-600 font-black uppercase tracking-[0.4em]">
          Fire Safety Management System
        </p>
        <div className="text-[8px] text-slate-700 font-mono tracking-widest uppercase">
          Authorized Personnel Only • v2.0-SSR
        </div>
      </div>
    </div>
  )
}