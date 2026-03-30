'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import * as XLSX from 'xlsx' // เพิ่มการ Import ตัวจัดการ Excel

export default function DashboardPage() {
  const [data, setData] = useState<any[]>([])
  const [materials, setMaterials] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [timeFilter, setTimeFilter] = useState('all') // 'day', 'month', 'year', 'all'
  const router = useRouter()

  const colorPalette = ['#21be8a', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

  // --- ฟังก์ชันสำหรับ Export ข้อมูลเป็น Excel ---
  const handleExportExcel = () => {
    if (data.length === 0) return alert('ไม่มีข้อมูลสำหรับ Export')

    // 1. เตรียมรูปแบบข้อมูลที่จะลงใน Excel (ปรับหัวข้อให้เป็นภาษาไทยอ่านง่าย)
    const excelData = data.map(worker => {
      const row: any = {
        'ชื่อพนักงาน': worker.name,
      }
      // ใส่ยอดของแต่ละวัสดุที่มีในหน้าจอ
      materials.forEach(mat => {
        row[mat] = worker[mat] || 0
      })
      row['รวมทั้งหมด (Kg)'] = worker.total
      return row
    })

    // 2. สร้างไฟล์ Excel
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Performance_Summary")

    // 3. กำหนดชื่อไฟล์ตาม Filter และวันที่ปัจจุบัน
    const fileName = `Report_${timeFilter}_${new Date().toLocaleDateString('th-TH')}.xlsx`

    // 4. สั่งดาวน์โหลด
    XLSX.writeFile(workbook, fileName)
  }

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    if (profile?.role === 'silver') {
      router.push('/access-denied')
    } else {
      setIsAuthorized(true)
      setUserRole(profile?.role || '')
    }
  }

  const fetchData = async () => {
    setLoading(true)
    let query = supabase.from('lift_weight').select('name, material_name, weight, created_at')

    const now = new Date()
    if (timeFilter === 'day') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString()
      query = query.gte('created_at', startOfDay)
    } else if (timeFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      query = query.gte('created_at', startOfMonth)
    } else if (timeFilter === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()
      query = query.gte('created_at', startOfYear)
    }

    const { data: weights, error } = await query

    if (!error && weights) {
      const allMaterials = Array.from(new Set(weights.map(w => w.material_name || 'ทั่วไป')))
      setMaterials(allMaterials)

      const grouped = weights.reduce((acc: any, curr: any) => {
        const name = curr.name
        const mat = curr.material_name || 'ทั่วไป'
        if (!acc[name]) acc[name] = { name, total: 0 }
        acc[name][mat] = (acc[name][mat] || 0) + curr.weight
        acc[name].total += curr.weight
        return acc
      }, {})

      const chartData = Object.values(grouped)
      chartData.sort((a: any, b: any) => b.total - a.total)
      setData(chartData)
    } else {
      setData([])
    }
    setLoading(false)
  }

  useEffect(() => {
    checkAccess()
  }, [])

  useEffect(() => {
    if (isAuthorized) {
      fetchData()
      const channel = supabase.channel('realtime-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lift_weight' }, () => fetchData())
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [isAuthorized, timeFilter])

  if (!isAuthorized) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-emerald-400 font-mono">Authenticating...</div>

  return (
    <div className="p-4 md:p-8 bg-[#0f172a] min-h-screen text-white font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-black text-emerald-400 tracking-tight uppercase">Performance Tracking</h1>
            <p className="text-slate-400 mt-1">สรุปยอดรายบุคคลแยกตามประเภทวัสดุ ({timeFilter.toUpperCase()})</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* ปุ่ม Export Excel เพิ่มมาใหม่ */}
            <button 
              onClick={handleExportExcel}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
            >
              📥 Export Excel
            </button>

            <button onClick={() => router.push('/input')} className="bg-emerald-500 hover:bg-emerald-600 text-[#0f172a] px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2">
              <span>➕</span> บันทึกข้อมูล
            </button>

            {userRole === 'admin' && (
              <button onClick={() => router.push('/admin')} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl border border-slate-700 font-bold">
                ⚙️ Admin
              </button>
            )}
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 mb-6 bg-slate-900/50 p-1.5 rounded-2xl w-fit border border-slate-800">
          {[
            { id: 'day', label: 'วันนี้' },
            { id: 'month', label: 'เดือนนี้' },
            { id: 'year', label: 'ปีนี้' },
            { id: 'all', label: 'ทั้งหมด' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTimeFilter(item.id)}
              className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                timeFilter === item.id 
                ? 'bg-emerald-500 text-[#0f172a] shadow-lg shadow-emerald-500/20' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* กราฟแบบ Stacked Bar */}
        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] shadow-2xl border border-slate-800 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/50 to-transparent"></div>
          <div className="h-[450px] w-full">
            {loading ? (
               <div className="h-full flex items-center justify-center text-emerald-500/50 animate-pulse font-mono tracking-widest">LOADING_DATA...</div>
            ) : data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#2dd4bf05'}}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  {materials.map((mat, index) => (
                    <Bar 
                      key={mat} 
                      dataKey={mat} 
                      stackId="a" 
                      fill={colorPalette[index % colorPalette.length]} 
                      radius={index === materials.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} 
                      barSize={40}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">
                <span className="text-4xl mb-2">📊</span>
                <p>ไม่มีข้อมูลในช่วงเวลานี้</p>
              </div>
            )}
          </div>
        </div>

        {/* ตารางสรุปรายบุคคล (Performance Cards) */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex justify-between items-center ml-2">
            <h2 className="text-xl font-bold text-slate-300 uppercase tracking-wider text-sm">Individual Breakdown</h2>
            <span className="text-[10px] text-slate-500 font-mono">COUNT: {data.length}</span>
          </div>
          
          {data.map((worker) => (
            <div key={worker.name} className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-emerald-500/30 transition-colors group">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-emerald-500/5 rounded-2xl flex items-center justify-center text-emerald-500 font-black text-2xl border border-emerald-500/10 group-hover:bg-emerald-500 group-hover:text-[#0f172a] transition-all">
                  {worker.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{worker.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {materials.map(mat => worker[mat] ? (
                      <span key={mat} className="text-[10px] bg-slate-900 text-slate-400 px-3 py-1 rounded-lg border border-slate-800">
                        {mat}: <span className="text-white font-bold">{worker[mat].toLocaleString()}</span>
                      </span>
                    ) : null)}
                  </div>
                </div>
              </div>
              <div className="text-right w-full md:w-auto border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em]">Total Performance</span>
                <p className="text-4xl font-black text-emerald-400 tabular-nums">
                  {worker.total.toLocaleString()} <span className="text-sm font-medium text-slate-600">Kg</span>
                </p>
              </div>
            </div>
          ))}

          {data.length === 0 && !loading && (
             <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                <p className="text-slate-600 font-medium">ยังไม่มีข้อมูลการทำงานในช่วงเวลาที่เลือก</p>
             </div>
          )}
        </div>

      </div>
    </div>
  )
}