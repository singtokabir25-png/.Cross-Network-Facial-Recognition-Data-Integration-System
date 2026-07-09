'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie 
} from 'recharts'
import { Calendar, ChevronLeft, ArrowUpRight, ArrowDownRight, Package, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({ totalIn: 0, totalOut: 0, productCount: 0 })
  const [chartData, setChartData] = useState<any[]>([])
  const [topAdded, setTopAdded] = useState<any[]>([])
  const [topStock, setTopStock] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [filter, setFilter] = useState<'day' | 'week' | 'month' | 'year'>('month')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchDashboardData()
  }, [filter])

  async function fetchDashboardData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return; }

    // 1. เช็คสิทธิ์
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'silver') {
      alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้'); router.push('/inventory'); return;
    }

    // 2. ตั้งค่าช่วงเวลา (Time Range Filter)
    let dateLimit = new Date()
    if (filter === 'day') dateLimit.setDate(dateLimit.getDate() - 1)
    else if (filter === 'week') dateLimit.setDate(dateLimit.getDate() - 7)
    else if (filter === 'month') dateLimit.setMonth(dateLimit.getMonth() - 1)
    else if (filter === 'year') dateLimit.setFullYear(dateLimit.getFullYear() - 1)

    // 3. ดึงข้อมูล Logs
    const { data: logs } = await supabase
      .from('stock_logs')
      .select('*')
      .gte('created_at', dateLimit.toISOString())

    // 4. ดึงข้อมูล Products (สำหรับ Top 5)
    const { data: products } = await supabase.from('products').select('*')

    if (logs && products) {
      // คำนวณ สถิติรวม
      const tIn = logs.filter(l => l.action_type === 'ADD').reduce((sum, curr) => sum + Math.abs(Number(curr.change_amount)), 0)
      const tOut = logs.filter(l => ['SELL', 'USE'].includes(l.action_type)).reduce((sum, curr) => sum + Math.abs(Number(curr.change_amount)), 0)
      
      setStats({ totalIn: tIn, totalOut: tOut, productCount: products.length })

      // จัดการข้อมูลกราฟขาย (สรุปยอดออกรายวัน/ช่วงเวลา)
      const graphMap = new Map()
      logs.filter(l => ['SELL', 'USE'].includes(l.action_type)).forEach(log => {
        const date = new Date(log.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
        graphMap.set(date, (graphMap.get(date) || 0) + Math.abs(Number(log.change_amount)))
      })
      setChartData(Array.from(graphMap, ([name, value]) => ({ name, value })))

      // Top 5 เพิ่มเยอะที่สุด (จาก Logs)
      const addedMap = new Map()
      logs.filter(l => l.action_type === 'ADD').forEach(log => {
        addedMap.set(log.product_name, (addedMap.get(log.product_name) || 0) + Math.abs(Number(log.change_amount)))
      })
      const sortedAdded = Array.from(addedMap, ([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value).slice(0, 5)
      setTopAdded(sortedAdded)

      // Top 5 เหลือมากสุด / น้อยสุด
      const sortedProducts = [...products].sort((a, b) => b.stock_quantity - a.stock_quantity)
      setTopStock(sortedProducts.slice(0, 5))
      setLowStock([...products].sort((a, b) => a.stock_quantity - b.stock_quantity).slice(0, 5))
    }
    setLoading(false)
  }

  const FilterButton = ({ type, label }: { type: typeof filter, label: string }) => (
    <button 
      onClick={() => setFilter(type)}
      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === type ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-400 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  )

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-blue-600 animate-pulse">CSW SYSTEM LOADING...</div>

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <button onClick={() => router.push('/inventory')} className="flex items-center gap-2 text-slate-400 font-bold text-sm mb-2 hover:text-blue-600 transition">
              <ChevronLeft size={18} /> กลับหน้าคลังสินค้า
            </button>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Inventory <span className="text-blue-600">Analytics</span></h1>
          </div>

          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
            <FilterButton type="day" label="วันนี้" />
            <FilterButton type="week" label="สัปดาห์นี้" />
            <FilterButton type="month" label="เดือนนี้" />
            <FilterButton type="year" label="ปีนี้" />
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center"><ArrowUpRight size={28} /></div>
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Total Added</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.totalIn.toLocaleString()} <span className="text-sm font-medium">กก.</span></h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center"><ArrowDownRight size={28} /></div>
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Total Dispatched</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.totalOut.toLocaleString()} <span className="text-sm font-medium">กก.</span></h3>
            </div>
          </div>
          <div className="bg-blue-600 p-6 rounded-[32px] shadow-xl shadow-blue-100 flex items-center gap-5 text-white">
            <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center"><Package size={28} /></div>
            <div>
              <p className="opacity-70 text-xs font-black uppercase tracking-widest">Active Products</p>
              <h3 className="text-2xl font-black">{stats.productCount.toLocaleString()} <span className="text-sm font-medium">รายการ</span></h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* กราฟยอดขาย/จ่ายออก */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><TrendingUp className="text-blue-600" /> ยอดการจ่ายสินค้าออก (Weight Out)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* กราฟรายการที่เพิ่มเยอะที่สุด */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">🔥 สินค้าที่มีการเติมสูงสุด (Top 5 Added)</h3>
            <div className="space-y-4">
              {topAdded.map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">{index + 1}</div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-bold text-slate-700">{item.name}</span>
                      <span className="text-sm font-black text-blue-600">+{item.value.toLocaleString()} กก.</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(item.value / topAdded[0].value) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top 5 Stock Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* เหลือมากสุด */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">📦 สินค้าคงคลังมากที่สุด (Top 5 Max)</h3>
            <div className="divide-y divide-slate-50">
              {topStock.map((item, index) => (
                <div key={index} className="py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 text-xs font-black text-emerald-500 bg-emerald-50 rounded-lg flex items-center justify-center">{index + 1}</span>
                    <span className="font-bold text-slate-700">{item.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{item.stock_quantity.toLocaleString()} <span className="text-slate-400 text-xs font-medium">กก.</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* เหลือน้อยสุด */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">⚠️ สินค้าใกล้หมด (Top 5 Low Stock)</h3>
            <div className="divide-y divide-slate-50">
              {lowStock.map((item, index) => (
                <div key={index} className="py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 text-xs font-black text-red-500 bg-red-50 rounded-lg flex items-center justify-center">{index + 1}</span>
                    <span className="font-bold text-slate-700">{item.name}</span>
                  </div>
                  <span className="font-black text-red-600">{item.stock_quantity.toLocaleString()} <span className="text-slate-400 text-xs font-medium">กก.</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}