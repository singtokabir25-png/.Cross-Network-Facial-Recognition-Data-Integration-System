'use client'
import { useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault() 
    setLoading(true)
    
    // 1. ตรวจสอบ Email/Password กับระบบ Auth
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      alert('เข้าสู่ระบบไม่สำเร็จ: ' + authError.message)
      setLoading(false)
      return
    }

    if (data?.user) {
      // 2. ดึงข้อมูล Role จากตาราง profiles ที่เราสร้างไว้
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        console.error("Profile fetch error:", profileError)
        // ถ้าหาโปรไฟล์ไม่เจอ ให้เด้งไปหน้าพื้นฐานก่อน
        window.location.href = '/input'
        return
      }

      const role = profile?.role
      console.log("Login Success! Your role is:", role)

      // 3. แยกเส้นทางตามสิทธิ์ (Admin, Gold, Silver)
      if (role === 'admin') {
        window.location.href = '/admin' // Admin ไปหลังบ้าน
      } else if (role === 'gold') {
        window.location.href = '/dashboard' // Gold ไปดู Report
      } else {
        window.location.href = '/input' // Silver (หรือค่าเริ่มต้น) ไปหน้าคีย์ข้อมูล
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-emerald-400 tracking-tight">LIFT TRACKER</h1>
        <p className="text-slate-400 mt-2 italic">Weightlifting Data Management System</p>
      </div>

      <form onSubmit={handleLogin} className="w-full max-w-sm bg-[#1e293b] p-8 rounded-2xl shadow-2xl border border-slate-700">
        <h2 className="text-xl font-bold mb-6 text-center text-slate-200">Security Sign In</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Email Address</label>
            <input 
              type="email" 
              placeholder="name@company.com"
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-[#0f172a] font-black py-3 rounded-lg mt-6 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-[#0f172a]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                CHECKING AUTH...
              </span>
            ) : 'SIGN IN NOW'}
          </button>
        </div>
      </form>

      <div className="mt-8 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">● Admin</span>
        <span className="flex items-center gap-1">● Gold</span>
        <span className="flex items-center gap-1">● Silver</span>
      </div>
    </div>
  )
}