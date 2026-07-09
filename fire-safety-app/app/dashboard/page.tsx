'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts'
import { 
  Search, FileText, AlertTriangle, CheckCircle, 
  ChevronRight, Download, Plus, LayoutDashboard, LogOut,
  ShieldCheck, Users, Settings, Bell
} from 'lucide-react'
import * as XLSX from 'xlsx'

// --- Types ---
interface CheckDetails {
  pressure_gauge: boolean
  safety_pin: boolean
  hose_condition: boolean
  tank_condition: boolean
  expiry_check: boolean
}

interface FireExtinguisher {
  id: string
  serial_number: string
  location: string
  status: 'Ready' | 'Need Service'
  check_details: CheckDetails
  last_checked: string
  inspector_name: string
}

export default function DashboardPage() {
  // --- States ---
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [rawData, setRawData] = useState<FireExtinguisher[]>([])
  const [timeFilter, setTimeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // --- Auth & Access Control ---
  const checkAccess = async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setUserProfile(profile)
    
    // สิทธิ์การเข้าถึง Dashboard (เฉพาะ Admin หรือ Gold)
    const isAdminUser = user.email === 'singtokabir25@gmail.com' || profile?.role === 'admin' || profile?.role === 'gold'
    
    if (isAdminUser) {
      setIsAuthorized(true)
    } else {
      router.push('/access-denied')
    }
  }

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true)
    let query = supabase
      .from('fire_extinguishers')
      .select('*')
      .order('last_checked', { ascending: false })

    const now = new Date()
    if (timeFilter === 'day') {
      query = query.gte('last_checked', new Date(now.setHours(0, 0, 0, 0)).toISOString())
    } else if (timeFilter === 'month') {
      query = query.gte('last_checked', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
    }

    const { data, error } = await query
    if (!error && data) {
      setRawData(data as FireExtinguisher[])
    }
    setLoading(false)
  }

  useEffect(() => { checkAccess() }, [])
  useEffect(() => { if (isAuthorized) fetchData() }, [isAuthorized, timeFilter])

  // --- Logic Calculations ---
  const locationStats = useMemo(() => {
    const stats: any = {}
    rawData.forEach(item => {
      const loc = item.location || 'Unknown'
      if (!stats[loc]) stats[loc] = { name: loc, ready: 0, issue: 0, total: 0 }
      stats[loc].total++
      if (item.status === 'Ready') stats[loc].ready++
      else stats[loc].issue++
    })
    return Object.values(stats)
  }, [rawData])

  const filteredInventory = useMemo(() => {
    return rawData.filter(item => {
      const matchesSearch = item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.location.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesLocation = selectedLocation ? item.location === selectedLocation : true
      return matchesSearch && matchesLocation
    })
  }, [rawData, searchTerm, selectedLocation])

  const issueBreakdown = useMemo(() => {
    const counts = { gauge: 0, pin: 0, hose: 0, tank: 0, expiry: 0 }
    rawData.forEach(item => {
      if (item.status !== 'Ready') {
        const d = item.check_details
        if (d?.pressure_gauge === false) counts.gauge++
        if (d?.safety_pin === false) counts.pin++
        if (d?.hose_condition === false) counts.hose++
        if (d?.tank_condition === false) counts.tank++
        if (d?.expiry_check === false) counts.expiry++
      }
    })
    return [
      { name: 'Pressure Gauge', value: counts.gauge, color: '#ef4444' },
      { name: 'Safety Pin', value: counts.pin, color: '#f97316' },
      { name: 'Hose', value: counts.hose, color: '#facc15' },
      { name: 'Tank', value: counts.tank, color: '#a855f7' },
      { name: 'Expiry', value: counts.expiry, color: '#ec4899' },
    ].filter(i => i.value > 0)
  }, [rawData])

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(rawData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Full_Report")
    XLSX.writeFile(wb, `Fire_Safety_Report_${new Date().toLocaleDateString()}.xlsx`)
  }

  if (!isAuthorized) return (
    <div className="h-screen bg-[#020617] flex items-center justify-center font-black text-red-600 tracking-[0.5em] animate-pulse">
      SECURING ACCESS...
    </div>
  )

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-red-500/30">
      
      {/* --- Sidebar (Desktop) --- */}
      <aside className="fixed left-0 top-0 h-full w-20 hidden lg:flex flex-col items-center py-8 bg-slate-900/50 border-r border-slate-800/50 backdrop-blur-xl z-50">
        <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center mb-10 shadow-lg shadow-red-600/20 cursor-pointer" onClick={() => router.push('/dashboard')}>
          <LayoutDashboard size={24} className="text-white" />
        </div>
        <nav className="flex flex-col gap-8 flex-1">
          <button onClick={() => router.push('/input')} className="text-slate-500 hover:text-white transition-colors" title="New Audit"><Plus size={20} /></button>
          
          {/* Admin Sidebar Button */}
          {(userProfile?.role === 'admin' || userProfile?.role === 'gold') && (
            <button onClick={() => router.push('/admin')} className="text-slate-500 hover:text-orange-500 transition-colors" title="Admin Management">
              <ShieldCheck size={20} />
            </button>
          )}
          
          <button className="text-slate-500 hover:text-white transition-colors"><Search size={20} /></button>
          <button className="text-slate-500 hover:text-white transition-colors"><FileText size={20} /></button>
          <button className="text-slate-500 hover:text-white transition-colors"><Bell size={20} /></button>
        </nav>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="text-slate-600 hover:text-red-500 transition-colors mt-auto">
          <LogOut size={20} />
        </button>
      </aside>

      <main className="lg:ml-20 p-4 md:p-10 pb-20">
        <div className="max-w-[1600px] mx-auto">
          
          {/* --- Header --- */}
          <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-12 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="bg-red-600 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Live</span>
                <h1 className="text-4xl font-black tracking-tighter uppercase italic">Safety <span className="text-red-600">Analytics</span></h1>
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">Industrial Resource Compliance</p>
            </div>

            <div className="flex flex-wrap gap-3 w-full xl:w-auto">
              {/* Admin Console Button (Header) */}
              {(userProfile?.role === 'admin' || userProfile?.role === 'gold') && (
                <button 
                  onClick={() => router.push('/admin')} 
                  className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-500/10 hover:bg-orange-600 text-orange-500 hover:text-white rounded-xl border border-orange-500/20 font-black text-[11px] uppercase transition-all"
                >
                  <Users size={14} /> Admin Console
                </button>
              )}

              <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
                {['day', 'month', 'all'].map(f => (
                  <button 
                    key={f}
                    onClick={() => setTimeFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${timeFilter === f ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button onClick={handleExport} className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-xl border border-emerald-600/20 font-black text-[11px] uppercase transition-all">
                <Download size={14} /> Export
              </button>
              <button onClick={() => router.push('/input')} className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-slate-950 hover:bg-red-600 hover:text-white rounded-xl font-black text-[11px] uppercase transition-all">
                <Plus size={14} /> New Audit
              </button>
            </div>
          </header>

          {/* --- Statistics --- */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { label: 'Total Assets', val: rawData.length, color: 'text-white' },
              { label: 'Operational', val: rawData.filter(i => i.status === 'Ready').length, color: 'text-emerald-500' },
              { label: 'Critical Issues', val: rawData.filter(i => i.status !== 'Ready').length, color: 'text-red-500' },
              { label: 'Active Zones', val: locationStats.length, color: 'text-blue-500' }
            ].map((stat, idx) => (
              <div key={idx} className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] hover:bg-slate-900/60 transition-all">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{stat.label}</p>
                <div className={`text-4xl font-black ${stat.color}`}>{stat.val}</div>
              </div>
            ))}
          </section>

          {/* --- Charts --- */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800 p-8 rounded-[2.5rem]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-black uppercase italic">Location Analysis</h3>
                {selectedLocation && (
                  <button onClick={() => setSelectedLocation(null)} className="text-[10px] font-black text-red-500 underline uppercase">Reset Filter</button>
                )}
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={locationStats} onClick={(d) => d && setSelectedLocation(d.activeLabel ? String(d.activeLabel) : null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} stroke="#475569" />
                    <YAxis fontSize={10} stroke="#475569" />
                    <Tooltip cursor={{fill: '#1e293b', opacity: 0.4}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
                    <Bar dataKey="ready" fill="#10b981" stackId="a" barSize={35} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="issue" fill="#ef4444" stackId="a" barSize={35} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col">
              <h3 className="text-lg font-black uppercase italic mb-6">Issue Types</h3>
              <div className="flex-1 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={issueBreakdown} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                      {issueBreakdown.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {issueBreakdown.map((i, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[9px] font-bold uppercase">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: i.color}}></div>
                    <span className="text-slate-400">{i.name}:</span> {i.value}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* --- Inventory Table (The "Who has problems" solution) --- */}
          <section className="bg-slate-900/30 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-950/20">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Inventory Details</h2>
                {selectedLocation && <span className="bg-red-600/10 text-red-500 text-[10px] font-black px-3 py-1 rounded-full border border-red-500/20 uppercase tracking-widest">{selectedLocation}</span>}
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Search Serial / Location..." 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-xs focus:outline-none focus:border-red-600 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-950/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800">
                    <th className="px-8 py-5">Asset Serial</th>
                    <th className="px-8 py-5">Zone</th>
                    <th className="px-8 py-5 text-center">Health</th>
                    <th className="px-8 py-5">Last Inspection</th>
                    <th className="px-8 py-5">Issues Found</th>
                    <th className="px-8 py-5 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-800/30 transition-all">
                      <td className="px-8 py-6 font-black text-white group-hover:text-red-500 transition-colors uppercase italic">{item.serial_number}</td>
                      <td className="px-8 py-6 text-xs font-bold text-slate-500 uppercase">{item.location}</td>
                      <td className="px-8 py-6 text-center">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${item.status === 'Ready' ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' : 'bg-red-500/5 text-red-500 border-red-500/20 animate-pulse'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-[10px] font-medium text-slate-500">
                        {new Date(item.last_checked).toLocaleDateString()}
                        <div className="text-[8px] text-slate-700 font-black">BY {item.inspector_name}</div>
                      </td>
                      <td className="px-8 py-6">
                        {item.status !== 'Ready' ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(item.check_details).map(([k, v]) => !v && <span key={k} className="text-[7px] bg-red-600/10 text-red-400 px-1.5 py-0.5 rounded border border-red-600/10 font-black uppercase">{k.split('_')[0]}</span>)}
                          </div>
                        ) : (
                          <CheckCircle size={12} className="text-emerald-500/20" />
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button onClick={() => router.push(`/input?edit=${item.serial_number}`)} className="p-2 bg-slate-800 rounded-lg hover:bg-red-600 transition-all group/btn">
                          <ChevronRight size={14} className="text-slate-500 group-hover/btn:text-white" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="mt-12 flex justify-between items-center text-[9px] font-black uppercase text-slate-600 tracking-widest border-t border-slate-900 pt-8">
            <div className="flex gap-6">
               <span>CSW SAFETY OS v2.0</span>
               <span className="text-slate-800">|</span>
               <span>SYSTEM STATUS: STABLE</span>
            </div>
            <div className="flex gap-4">
               <Settings size={12} className="hover:text-slate-400 cursor-pointer" />
               <Bell size={12} className="hover:text-slate-400 cursor-pointer" />
            </div>
          </footer>

        </div>
      </main>
    </div>
  )
}
