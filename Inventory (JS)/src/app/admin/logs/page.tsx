'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase 
        .from('stock_logs')
        .select(`
          *,
          profiles!stock_logs_user_id_fkey ( 
            email
          )
        `) // ระบุชื่อ Foreign Key ให้ชัดเจนเพื่อแก้ปัญหาความสัมพันธ์ซ้ำซ้อน
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase Error:', error.message)
        // ถ้ายังขึ้น Error เดิม ให้ลองเปลี่ยนเป็น profiles!user_id (email)
      } else {
        // เนื่องจากใช้เครื่องหมาย ! ผลลัพธ์อาจมาเป็น Array หรือ Object
        // ปรับการดึงข้อมูลให้รองรับทั้งสองแบบ
        const formattedData = data?.map(log => ({
          ...log,
          profiles: Array.isArray(log.profiles) ? log.profiles[0] : log.profiles
        }))
        setLogs(formattedData || [])
      }
    } catch (err) {
      console.error('Fetch Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const getActionBadge = (type: string) => {
    const base = "px-3 py-1 rounded-full text-[10px] font-black uppercase "
    const action = type?.toUpperCase() || ''
    switch (action) {
      case 'ADD': return base + "bg-emerald-100 text-emerald-600"
      case 'SELL': return base + "bg-amber-100 text-amber-600"
      case 'USE': return base + "bg-slate-100 text-slate-600"
      case 'LOGIN': return base + "bg-blue-100 text-blue-600"
      case 'LOGOUT': return base + "bg-red-100 text-red-600"
      case 'UPDATE_BOX': return base + "bg-purple-100 text-purple-600"
      default: return base + "bg-slate-100 text-slate-400"
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600 mb-2 flex items-center gap-2 font-bold text-sm transition">
              ← ย้อนกลับ
            </button>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">📜 ประวัติการใช้งานระบบ</h1>
            <p className="text-slate-400 text-xs font-medium mt-1">ตรวจสอบกิจกรรมล่าสุดในคลังสินค้า</p>
          </div>
          <button onClick={fetchLogs} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition shadow-sm font-bold text-sm text-slate-600 flex items-center gap-2">
            🔄 รีเฟรชข้อมูล
          </button>
        </header>

        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-20 text-center text-slate-400 font-bold animate-pulse">กำลังโหลดข้อมูล...</div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center text-slate-400 font-bold">ไม่พบประวัติการใช้งานในขณะนี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    <th className="px-8 py-5">วัน-เวลา</th>
                    <th className="px-8 py-5">ผู้ดำเนินการ</th>
                    <th className="px-8 py-5">กิจกรรม</th>
                    <th className="px-8 py-5">สินค้า</th>
                    <th className="px-8 py-5 text-right">จำนวน</th>
                    <th className="px-8 py-5">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-5 text-xs font-bold text-slate-400 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black uppercase">
                            {log.profiles?.email ? log.profiles.email[0] : '?'}
                          </div>
                          <span className="text-sm font-bold text-slate-700">
                            {log.profiles?.email || 'Unknown System'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={getActionBadge(log.action_type)}>
                          {log.action_type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm font-black text-slate-800">
                        {log.product_name || '-'}
                      </td>
                      <td className={`px-8 py-5 text-right font-mono font-bold ${log.change_amount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {log.change_amount !== undefined ? (log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount) : '-'}
                      </td>
                      <td className="px-8 py-5 text-xs text-slate-400 font-medium">
                        {log.details || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}