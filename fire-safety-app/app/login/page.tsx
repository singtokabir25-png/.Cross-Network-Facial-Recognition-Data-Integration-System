'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client' // เปลี่ยนมาใช้ createClient
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  
  // เรียกใช้งาน Client
  const supabase = createClient()

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
      // 2. ดึงข้อมูล Role จากตาราง profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        console.error("Profile fetch error:", profileError)
        // ถ้าหาโปรไฟล์ไม่เจอ ให้ไปหน้าบันทึกข้อมูลก่อนเป็นค่าเริ่มต้น
        router.push('/input')
        return
      }

      const role = profile?.role
      console.log("Login Success! Access Level:", role)

      // 3. แยกเส้นทางตามสิทธิ์การเข้าถึง
      if (role === 'admin') {
        router.push('/admin')     // Admin ไปหน้าจัดการระบบ
      } else if (role === 'gold') {
        router.push('/dashboard') // Gold ไปดูสรุปผล Dashboard
      } else {
        router.push('/input')     // Silver ไปหน้าบันทึกการตรวจเช็ค
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white font-sans p-4">
      <div className="mb-8 text-center">
        {/* ไอคอนความปลอดภัย */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-2xl mb-4 border border-red-500/20">
            <span className="text-3xl">🧯</span>
        </div>
        <h1 className="text-4xl font-black text-red-500 tracking-tighter uppercase">Fire Safety</h1>
        <p className="text-slate-400 mt-2 font-medium">Extinguisher Monitoring System</p>
      </div>

      <form onSubmit={handleLogin} className="w-full max-w-sm bg-[#1e293b] p-8 rounded-[2.5rem] shadow-2xl border border-slate-800 relative overflow-hidden">
        {/* เส้นตกแต่งด้านบน */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600"></div>
        
        <h2 className="text-xl font-bold mb-8 text-center text-slate-200 uppercase tracking-widest">Security Access</h2>
        
        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1 tracking-widest">Corporate Email</label>
            <input 
              type="email" 
              placeholder="your.name@company.com"
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all font-medium text-slate-200"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1 tracking-widest">Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all font-medium text-slate-200"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl mt-6 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-900/40 uppercase tracking-widest text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            ) : 'Authenticate'}
          </button>
        </div>
      </form>

      {/* Footer Info */}
      <div className="mt-12 flex flex-col items-center gap-4">
        <div className="flex gap-6 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> System Admin</span>
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> Manager</span>
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div> Inspector</span>
        </div>
        <p className="text-[10px] text-slate-700 font-mono mt-2">SECURE END-TO-END ENCRYPTION ACTIVE</p>
      </div>
    </div>
  )
}