'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

// --- Interfaces ---
interface LocationItem { 
  id: string; 
  name: string 
}

interface AssetItem { 
  id: string; 
  serial_number: string 
}

export default function FireExtinguisherForm() {
  // --- States ---
  const [serialNo, setSerialNo] = useState('')
  const [location, setLocation] = useState('')
  const [inspector, setInspector] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [userRole, setUserRole] = useState('')
  
  const [locationList, setLocationList] = useState<LocationItem[]>([])
  const [assetList, setAssetList] = useState<AssetItem[]>([]) 
  
  const router = useRouter()
  const supabase = createClient()

  // รายการตรวจสอบ (Checklist)
  const [checklist, setChecklist] = useState({
    pressure_gauge: false,
    safety_pin: false,
    hose_condition: false,
    tank_condition: false,
    expiry_check: false, 
  })

  // --- Initial Load ---
  useEffect(() => {
    const initData = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) {
        setIsAuthorized(true)
        setUserRole(profile.role || '')
        setInspector(user.email?.split('@')[0] || 'Staff')
        fetchLocations()
      } else {
        router.push('/login')
      }
    }
    initData()
  }, [])

  // --- Database Functions ---
  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true })
    if (!error && data) setLocationList(data)
  }

  const fetchAssetsByLocation = async (locId: string) => {
    const { data, error } = await supabase
      .from('master_assets')
      .select('id, serial_number')
      .eq('location_id', locId)
      .order('serial_number', { ascending: true })
    
    if (!error) setAssetList(data || [])
  }

  // --- Master Data Management (Add/Delete) ---
  
  const handleAddLocation = async () => {
    const newLocName = prompt('ระบุชื่อสถานที่ / อาคารใหม่:')
    if (!newLocName || newLocName.trim() === '') return
    const { error } = await supabase.from('locations').insert([{ name: newLocName.trim() }])
    if (error) alert('Error: ' + error.message)
    else fetchLocations()
  }

  const handleDeleteLocation = async () => {
    if (!location) return alert('กรุณาเลือกสถานที่ที่ต้องการลบ')
    const selectedLoc = locationList.find(l => l.name === location)
    if (!selectedLoc) return

    if (confirm(`⚠️ ยืนยันการลบสถานที่ "${location}"? \nการลบนี้จะลบข้อมูลเลขถังทั้งหมดที่ผูกกับที่นี่ด้วย!`)) {
      const { error } = await supabase.from('locations').delete().eq('id', selectedLoc.id)
      if (error) alert('ลบไม่สำเร็จ: ' + error.message)
      else {
        setLocation('')
        setAssetList([])
        fetchLocations()
      }
    }
  }

  const handleAddAsset = async () => {
    if (!location) return alert('กรุณาเลือกสถานที่ก่อนเพิ่มเลขถัง')
    const selectedLoc = locationList.find(l => l.name === location)
    if (!selectedLoc) return
    const newSerial = prompt(`ระบุเลขถังใหม่สำหรับจุด ${location}:`)
    if (!newSerial || newSerial.trim() === '') return
    const { error } = await supabase.from('master_assets').insert([{ 
      location_id: selectedLoc.id, 
      serial_number: newSerial.trim().toUpperCase() 
    }])
    if (error) alert('Error: ' + error.message)
    else fetchAssetsByLocation(selectedLoc.id)
  }

  const handleDeleteAsset = async () => {
    if (!serialNo) return alert('กรุณาเลือกเลขถังที่ต้องการลบ')
    
    // ค้นหาข้อมูลเต็มๆ ของ Asset ที่เลือกเพื่อเอา ID มาใช้ลบ (จะแม่นยำกว่าเลขถัง)
    const selectedAsset = assetList.find(a => a.serial_number === serialNo)
    if (!selectedAsset) return

    if (confirm(`⚠️ ยืนยันการลบเลขถัง "${serialNo}" ออกจากระบบ?`)) {
      // เปลี่ยนมาลบด้วย id แทน serial_number
      const { error } = await supabase
        .from('master_assets')
        .delete()
        .eq('id', selectedAsset.id) 

      if (error) {
        alert('ลบไม่สำเร็จ: ' + error.message)
      } else {
        // เมื่อลบสำเร็จ ต้องเคลียร์ค่าที่เลือกไว้ และโหลดรายการใหม่
        setSerialNo('') 
        const selectedLoc = locationList.find(l => l.name === location)
        if (selectedLoc) fetchAssetsByLocation(selectedLoc.id)
      }
    }
  }

  // --- Logic Functions ---
  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const overallStatus = Object.values(checklist).every(val => val === true) ? 'Ready' : 'Need Service'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!serialNo || !location) return alert('กรุณาเลือกสถานที่และเลขถังให้ครบถ้วน')
    setLoading(true)
    const { error } = await supabase.from('fire_extinguishers').insert([{ 
      serial_number: serialNo, 
      location: location, 
      status: overallStatus,
      inspector_name: inspector,
      check_details: checklist,
      is_expiry_checked: checklist.expiry_check,
      last_checked: new Date().toISOString()
    }])

    if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
    else {
      setMessage('✅ บันทึกข้อมูลเรียบร้อยแล้ว!')
      setSerialNo('')
      setChecklist({ 
        pressure_gauge: false, safety_pin: false, hose_condition: false, tank_condition: false, expiry_check: false 
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setTimeout(() => setMessage(''), 3000)
    }
    setLoading(false)
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-red-500 font-black animate-pulse uppercase tracking-[0.4em] text-xs">
          Loading Security Protocol...
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-[#0f172a] min-h-screen text-white flex flex-col items-center font-sans pb-24">
      <div className="w-full max-w-md">
        
        {/* Header Section */}
        <div className="text-center mb-8 mt-6">
          <h1 className="text-5xl font-black text-red-600 italic tracking-tighter uppercase leading-none drop-shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            Fire Audit <span className="text-slate-800">Pro</span>
          </h1>
          <p className="text-slate-500 text-[9px] font-black mt-3 tracking-[0.5em] uppercase">
            PFF PRODUCTFULLFILL • Safety System
          </p>
          <div className="mt-5 inline-flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 px-5 py-2 rounded-full shadow-xl">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
              Active Inspector: {inspector}
            </span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-7 bg-[#1e293b]/50 backdrop-blur-xl p-7 rounded-[3rem] border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600"></div>

          {message && (
            <div className="bg-emerald-500 text-[#0f172a] p-5 rounded-2xl text-center font-black animate-bounce shadow-xl border-2 border-emerald-300">
              {message}
            </div>
          )}

          {/* Step 01: Location */}
          <div className="space-y-3">
            <div className="flex justify-between items-end px-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                Step 01: Location / สถานที่
              </label>
              {(userRole === 'admin' || userRole === 'gold') && (
                <div className="flex gap-2">
                  <button type="button" onClick={handleAddLocation} className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-400 hover:text-white transition-all">+ เพิ่ม</button>
                  {location && <button type="button" onClick={handleDeleteLocation} className="text-[9px] font-black text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">ลบชื่อนี้</button>}
                </div>
              )}
            </div>
            <div className="relative">
              <select 
                className="w-full p-5 rounded-[1.5rem] bg-slate-950/80 border border-slate-700 text-lg outline-none focus:border-red-500 transition-all appearance-none cursor-pointer font-bold"
                value={location}
                onChange={(e) => {
                  const loc = locationList.find(l => l.name === e.target.value)
                  setLocation(e.target.value)
                  if (loc) fetchAssetsByLocation(loc.id)
                  setSerialNo('') 
                }}
                required
              >
                <option value="">-- กรุณาเลือกสถานที่ --</option>
                {locationList.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-red-600">▼</div>
            </div>
          </div>

          {/* Step 02: Unit ID */}
          <div className="space-y-3">
            <div className="flex justify-between items-end px-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                Step 02: Unit ID / รหัสถัง
              </label>
              {(userRole === 'admin' || userRole === 'gold') && location && (
                <div className="flex gap-2">
                  <button type="button" onClick={handleAddAsset} className="text-[9px] font-black text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20 hover:bg-orange-400 hover:text-white transition-all">+ เพิ่ม</button>
                  {serialNo && <button type="button" onClick={handleDeleteAsset} className="text-[9px] font-black text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">ลบเลขนี้</button>}
                </div>
              )}
            </div>
            <div className="relative">
              <select 
                className="w-full p-5 rounded-[1.5rem] bg-slate-950/80 border border-slate-700 text-lg outline-none focus:border-red-500 transition-all appearance-none cursor-pointer font-mono font-black disabled:opacity-20"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                disabled={!location}
                required
              >
                <option value="">-- เลือกเลขรหัสถัง --</option>
                {assetList.map(a => <option key={a.id} value={a.serial_number}>{a.serial_number}</option>)}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-red-600">▼</div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-2"></div>

          {/* Step 03: Checklist */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 ml-2 italic">
              Step 03: Inspection Checklist
            </label>
            {[
              { id: 'pressure_gauge', label: 'เกจวัดความดัน (เข็มอยู่ในช่องเขียว)', icon: '🧭' },
              { id: 'safety_pin', label: 'สลักนิรภัยและซีล (สภาพสมบูรณ์)', icon: '🔐' },
              { id: 'hose_condition', label: 'สายฉีดน้ำยา (ไม่แตก ไม่ตัน)', icon: '🐍' },
              { id: 'tank_condition', label: 'สภาพตัวถัง (ไม่บุบ ไม่ขึ้นสนิม)', icon: '🛡️' },
              { id: 'expiry_check', label: 'ตรวจสอบวันหมดอายุ (ยังไม่หมดอายุ)', icon: '📅' },
            ].map((item) => (
              <div 
                key={item.id}
                onClick={() => toggleCheck(item.id as keyof typeof checklist)}
                className={`group flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 active:scale-95 ${
                  checklist[item.id as keyof typeof checklist] ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/40'
                }`}
              >
                <div className="flex items-center gap-5">
                  <div className="text-2xl">{item.icon}</div>
                  <span className={`text-[11px] font-black uppercase ${checklist[item.id as keyof typeof checklist] ? 'text-emerald-400' : 'text-slate-500'}`}>{item.label}</span>
                </div>
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${checklist[item.id as keyof typeof checklist] ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700'}`}>
                  {checklist[item.id as keyof typeof checklist] && <span className="text-slate-950 text-xs font-black">✓</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Status Monitor */}
          <div className={`p-7 rounded-[2.5rem] border-4 text-center transition-all duration-700 relative overflow-hidden ${
            overallStatus === 'Ready' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-600/40 bg-red-600/5'
          }`}>
            <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-20 animate-scan"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-2 opacity-40">Inspection Summary</p>
            <span className={`text-4xl font-black italic ${overallStatus === 'Ready' ? 'text-emerald-500' : 'text-red-600 animate-pulse'}`}>
              {overallStatus === 'Ready' ? 'READY TO USE' : 'DO NOT USE'}
            </span>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-7 rounded-[2rem] text-2xl transition-all active:scale-95 disabled:opacity-50 shadow-2xl border-b-8 border-red-800 uppercase italic">
            {loading ? 'Uploading Data...' : 'Submit Report'}
          </button>
        </form>

        <div className="mt-10 flex gap-5 px-2">
          <button onClick={() => router.push('/dashboard')} className="flex-1 py-5 bg-slate-900 rounded-[1.5rem] text-slate-400 text-[11px] font-black uppercase border border-slate-800">📊 Analytics</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="flex-1 py-5 bg-red-950/20 rounded-[1.5rem] text-red-600 text-[11px] font-black uppercase border border-red-900/30">🚪 Logout</button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan { 0% { top: 0; opacity: 0; } 50% { opacity: 0.5; } 100% { top: 100%; opacity: 0; } }
        .animate-scan { position: absolute; animation: scan 3s linear infinite; }
      `}</style>
    </div>
  )
}