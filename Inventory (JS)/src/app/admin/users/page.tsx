'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function checkAdminAndFetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        alert('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่เข้าถึงหน้านี้ได้')
        router.push('/inventory')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')
      
      setUsers(data || [])
      setLoading(false)
    }
    checkAdminAndFetch()
  }, [router, supabase])

  const updateRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสิทธิ์')
    } else {
      alert('อัปเดตสิทธิ์พนักงานเรียบร้อย!')
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    }
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F1F5F9]">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-bold text-slate-400 italic">Checking ERP Security Terminal...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F1F5F9] p-4 md:p-12">
      <div className="max-w-6xl mx-auto">
        
        {/* Navigation Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              ERP <span className="text-blue-600">Permissions</span>
            </h1>
            <p className="text-slate-500 font-medium mt-1">จัดการระดับการเข้าถึงและตรวจสอบประวัติพนักงาน</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => router.push('/inventory')}
              className="bg-white text-slate-600 px-5 py-2.5 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 shadow-sm transition flex items-center gap-2"
            >
              📦 ดูสินค้า
            </button>
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-white text-slate-600 px-5 py-2.5 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 shadow-sm transition flex items-center gap-2"
            >
              📊 Dashboard
            </button>
          </div>
        </div>

        {/* --- Quick Access Logs Menu (แก้ไข Path เพื่อป้องกัน 404) --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={() => router.push('/admin/logs')} 
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-300 transition group text-left"
          >
            <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🔑</div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">ประวัติการใช้งาน</p>
            <p className="text-sm font-bold text-slate-700">Login / Logout</p>
          </button>
          
          <button 
            onClick={() => router.push('/admin/logs')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-300 transition group text-left"
          >
            <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📈</div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">ประวัติสต็อกเข้า</p>
            <p className="text-sm font-bold text-slate-700">เพิ่มสินค้าใหม่</p>
          </button>

          <button 
            onClick={() => router.push('/admin/logs')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-amber-300 transition group text-left"
          >
            <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📉</div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">ประวัติสต็อกออก</p>
            <p className="text-sm font-bold text-slate-700">ขาย / เบิกออก</p>
          </button>

          <button 
            onClick={() => router.push('/admin/logs')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-300 transition group text-left"
          >
            <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🛠️</div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">ประวัติการใช้</p>
            <p className="text-sm font-bold text-slate-700">นำวัสดุไปใช้งาน</p>
          </button>
        </div>

        {/* User Table Card */}
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-lg">รายชื่อพนักงานทั้งหมด ({users.length})</h3>
            <span className="text-xs font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase">CSW Staff Only</span>
          </div>

          <div className="divide-y divide-slate-50">
            {users.map((u) => (
              <div key={u.id} className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-slate-50/30 transition">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                    u.role === 'admin' ? 'bg-red-50 text-red-600' : 
                    u.role === 'gold' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {u.role === 'admin' ? '👑' : u.role === 'gold' ? '⭐' : '👤'}
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-xl leading-tight">{u.full_name || 'ไม่ระบุชื่อ'}</p>
                    <p className="text-sm text-slate-400 font-medium">{u.email || 'ไม่มีข้อมูลอีเมล'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* ปุ่มดูประวัติรายบุคคล - ชี้ไปที่หน้า Logs รวม */}
                  <button 
                    onClick={() => router.push('/admin/logs')}
                    className="flex-1 md:flex-none bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition"
                  >
                    🔍 ดูประวัติรวม
                  </button>

                  {/* ตัวเลือกเปลี่ยน Role */}
                  <div className="flex items-center gap-4 bg-slate-50 p-2 pl-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Permission:</span>
                    <select
                      className="bg-white border-none text-slate-700 font-bold py-2 px-4 rounded-xl shadow-sm focus:ring-4 focus:ring-blue-100 outline-none transition cursor-pointer text-sm"
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      value={u.role}
                    >
                      <option value="silver">🥈 SILVER (เบิก/เติม)</option>
                      <option value="gold">🥇 GOLD (ดูสถิติ)</option>
                      <option value="admin">💎 ADMIN (สูงสุด)</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {users.length === 0 && (
            <div className="p-20 text-center text-slate-400 font-bold italic">ไม่พบข้อมูลพนักงานในระบบ CSW</div>
          )}
        </div>

        <footer className="mt-8 flex justify-between items-center px-4">
          <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase italic">
            CSW Security Terminal • 2026
          </p>
          <p className="text-[10px] text-slate-300 font-medium">
            Authorized Personnel Only
          </p>
        </footer>
      </div>
    </div>
  )
}