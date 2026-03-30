'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()

  const checkAdminStatus = async () => {
    try {
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
        router.push('/access-denied')
      } else {
        setIsAuthorized(true)
        fetchLogs()
      }
    } catch (err) {
      router.push('/login')
    }
  }

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('lift_weight')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error("Fetch Error:", error.message)
      } else {
        setLogs(data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('⚠️ ยืนยันว่าจะลบข้อมูลแถวนี้ใช่หรือไม่? การลบจะส่งผลต่อยอดรวมใน Dashboard ทันที')) return

    const { error } = await supabase
      .from('lift_weight')
      .delete()
      .eq('id', id)

    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message)
    } else {
      fetchLogs()
    }
  }

  useEffect(() => {
    checkAdminStatus()

    const channel = supabase
      .channel('admin-db-changes')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'lift_weight' }, 
        () => {
          fetchLogs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (!isAuthorized) {
    return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-emerald-400 font-mono">Security Checking...</div>
  }

  return (
    <div className="p-4 bg-[#0f172a] min-h-screen text-white font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500 w-2 h-8 rounded-full animate-pulse"></span>
              <h1 className="text-3xl font-black text-emerald-400 tracking-tight uppercase">Management Console</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1 ml-4 uppercase tracking-widest">Database Administrator Access</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2 hover:text-white font-bold text-sm"
            >
              📊 View Dashboard
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-[#1e293b] rounded-[2rem] overflow-hidden border border-slate-800 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500"></div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800/80 text-slate-400 text-[10px] uppercase tracking-[0.2em]">
                <tr>
                  <th className="p-6 font-bold border-b border-slate-700">Timestamp</th>
                  <th className="p-6 font-bold border-b border-slate-700">Staff Name</th>
                  <th className="p-6 font-bold border-b border-slate-700">Material</th>
                  <th className="p-6 font-bold text-right border-b border-slate-700">Net Weight (Kg)</th>
                  <th className="p-6 font-bold text-center border-b border-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center text-slate-500">
                      <div className="flex justify-center mb-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                      </div>
                      Synchronizing Real-time Database...
                    </td>
                  </tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className="hover:bg-emerald-500/5 transition-colors group">
                    <td className="p-6 text-xs font-mono text-slate-500">
                      {log.created_at ? new Date(log.created_at).toLocaleString('th-TH', { 
                        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' 
                      }) : '-'}
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-emerald-400 border border-slate-600">
                          {log.name.charAt(0)}
                        </div>
                        <span className="text-slate-200 font-bold">{log.name}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold">
                        {log.material_name || 'General'}
                      </span>
                    </td>
                    <td className="p-6 text-right font-mono text-xl text-emerald-400 font-black">
                      {log.weight.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-6 text-center">
                      <button 
                        onClick={() => handleDelete(log.id)}
                        className="bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider border border-red-500/10"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {logs.length === 0 && !loading && (
            <div className="p-20 text-center text-slate-600">
              <div className="text-4xl mb-2">∅</div>
              <p className="font-bold text-slate-400">NO RECORDS FOUND</p>
              <p className="text-xs uppercase tracking-widest mt-1">ยังไม่มีข้อมูลในระบบ</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 grid grid-cols-2 gap-4 px-4">
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50 flex items-center justify-between">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Database Load</span>
            <span className="text-emerald-500 font-mono text-xs">{logs.length} Entries</span>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50 flex items-center justify-between">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Network Status</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="text-emerald-500 font-mono text-xs">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}