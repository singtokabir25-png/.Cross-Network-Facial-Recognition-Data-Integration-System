'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function InputPage() {
  const [name, setName] = useState('')
  const [searchTerm, setSearchTerm] = useState('') 
  const [isOpen, setIsOpen] = useState(false) 
  const [material, setMaterial] = useState('')
  const [weight, setWeight] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [userRole, setUserRole] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  
  const employeeList = [
    "Employee A", "Employee B", "Employee C", 
    "John Doe", "Jane Smith", "Somsak", "Wichai"
  ]

  // กรองรายชื่อตามที่พิมพ์
  const filteredEmployees = employeeList.filter(emp =>
    emp.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()

      if (profile) {
        setIsAuthorized(true)
        setUserRole(profile.role || '')
      } else {
        router.push('/login')
      }
    }
    checkAccess()

    // ปิด Dropdown เมื่อคลิกข้างนอก
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !material || !weight) return alert('กรุณากรอกข้อมูลให้ครบถ้วน')

    setLoading(true)
    const { error } = await supabase
      .from('lift_weight')
      .insert([{ 
        name: name, 
        material_name: material, 
        weight: parseFloat(weight)
      }])

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      setMessage('✅ บันทึกสำเร็จ!')
      setWeight('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setTimeout(() => setMessage(''), 3000)
    }
    setLoading(false)
  }

  if (!isAuthorized) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-emerald-400 font-mono">Authenticating...</div>

  return (
    <div className="p-4 bg-[#0f172a] min-h-screen text-white flex flex-col items-center font-sans">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-emerald-400 tracking-tight uppercase">Data Entry</h1>
          <div className="flex justify-center gap-2 mt-2">
             <span className="px-3 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
              {userRole} Authorized
            </span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6 bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>

          {message && (
            <div className="bg-emerald-500 text-[#0f172a] p-4 rounded-2xl text-center font-black animate-bounce shadow-lg shadow-emerald-500/20">
              {message}
            </div>
          )}

          {/* 1. ช่องค้นหาชื่อพนักงาน (Combobox) */}
          <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-2">ชื่อพนักงาน</label>
            <div className="relative">
              <input
                type="text"
                placeholder="พิมพ์เพื่อค้นหาชื่อ..."
                className="w-full p-5 rounded-2xl bg-slate-900/50 border border-slate-700 text-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                value={isOpen ? searchTerm : name}
                onFocus={() => {
                  setIsOpen(true)
                  setSearchTerm('')
                }}
                onChange={(e) => setSearchTerm(e.target.value)}
                readOnly={!isOpen && name !== ''} // ล็อคไว้ถ้าเลือกแล้ว แต่กดอีกทีจะค้นหาได้
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                {isOpen ? '🔍' : '▼'}
              </div>
            </div>

            {/* Dropdown รายชื่อ */}
            {isOpen && (
              <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto overflow-hidden animate-in fade-in zoom-in duration-200">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => (
                    <div
                      key={emp}
                      className="p-4 hover:bg-emerald-500 hover:text-[#0f172a] cursor-pointer font-bold transition-colors border-b border-slate-700/50 last:border-none"
                      onClick={() => {
                        setName(emp)
                        setSearchTerm(emp)
                        setIsOpen(false)
                      }}
                    >
                      {emp}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-slate-500 italic text-center">ไม่พบรายชื่อนี้</div>
                )}
              </div>
            )}
          </div>

          {/* 2. ช่องเลือกวัสดุ */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-2">ประเภทวัสดุ (Material)</label>
            <select 
              className="w-full p-5 rounded-2xl bg-slate-900/50 border border-slate-700 text-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all appearance-none cursor-pointer"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              required
            >
              <option value="" className="text-slate-500">เลือกประเภทวัสดุ...</option>
              <option value="Steel">Steel (เหล็ก)</option>
              <option value="Cement">Cement (ปูน)</option>
              <option value="Wood">Wood (ไม้)</option>
              <option value="Scrap">Scrap (เศษเหล็ก)</option>
            </select>
          </div>

          {/* 3. ช่องกรอกน้ำหนัก */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-2">น้ำหนักสุทธิ (Kg.)</label>
            <div className="relative">
              <input 
                type="number" 
                step="0.01"
                placeholder="0.00"
                className="w-full p-6 rounded-2xl bg-slate-900/50 border border-slate-700 text-4xl text-center font-mono text-emerald-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
                inputMode="decimal" 
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 font-bold">KG</span>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-[#0f172a] font-black py-6 rounded-2xl text-xl transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-3"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลเข้าระบบ'}
          </button>
        </form>

        {/* Navigation Buttons */}
        <div className={`mt-8 ${userRole === 'admin' || userRole === 'gold' ? 'grid grid-cols-2 gap-4' : 'flex justify-center'}`}>
          {(userRole === 'admin' || userRole === 'gold') && (
            <button 
              onClick={() => router.push('/dashboard')}
              className="p-4 bg-slate-800/50 hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all text-sm font-bold border border-slate-800 w-full"
            >
              📊 ดู Dashboard
            </button>
          )}
          <button 
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="p-4 bg-red-500/5 hover:bg-red-500/10 rounded-2xl text-red-500 transition-all text-sm font-bold border border-red-500/10 w-full"
          >
            🚪 ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  )
}