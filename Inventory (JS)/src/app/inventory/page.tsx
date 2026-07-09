'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [role, setRole] = useState<string>('silver')
  const [userName, setUserName] = useState<string>('')
  const [userId, setUserId] = useState<string>('') 
  const [loading, setLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // 🔥 เพิ่ม State สำหรับเปิด/ปิด Sidebar
  
  const [activeProduct, setActiveProduct] = useState<any>(null)
  const [actionType, setActionType] = useState<'add' | 'sell' | 'use' | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { router.push('/login'); return; }

      setUserId(user.id)
      setUserName(user.email || 'User')
      
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole(profile?.role || 'silver')

      await supabase.from('stock_logs').insert({
        user_id: user.id,
        action_type: 'LOGIN',
        details: `เข้าใช้งานระบบ Inventory (${user.email})`
      })
      fetchProducts()
    }
    loadData()
  }, [])

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('product_code')
    setProducts(data || [])
  }

  const getSafeUserId = async () => {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  }

  const handleUpdateBox = async (productId: string, currentBoxes: number, change: number) => {
    const currentId = await getSafeUserId()
    if (!currentId) return 
    const newBoxes = Math.max(0, currentBoxes + change)
    const product = products.find(p => p.id === productId)

    const { error } = await supabase.from('products').update({ boxes: newBoxes }).eq('id', productId)
    if (!error) {
      await supabase.from('stock_logs').insert({
        user_id: currentId, 
        action_type: 'UPDATE_BOX',
        product_name: product?.name || 'Unknown Product',
        change_amount: change, 
        details: `ปรับจำนวน Box จาก ${currentBoxes} เป็น ${newBoxes} เต๋า`
      })
      fetchProducts()
    }
  }

  const handleTransaction = async () => {
    const currentId = await getSafeUserId()
    if (!activeProduct || amount <= 0 || !currentId) return
    setLoading(true)

    let newQuantity = Number(activeProduct.stock_quantity)
    if (actionType === 'add') newQuantity += amount
    else newQuantity -= amount

    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: Math.max(0, newQuantity) })
      .eq('id', activeProduct.id)

    if (!error) {
      const logAmount = actionType === 'add' ? amount : -amount
      await supabase.from('stock_logs').insert({
        user_id: currentId, 
        action_type: actionType === 'add' ? 'ADD' : actionType === 'sell' ? 'SELL' : 'USE',
        product_name: activeProduct.name,
        change_amount: logAmount, 
        details: actionType === 'add' ? 'เติมสต็อกสินค้า' : actionType === 'sell' ? 'ขายสินค้าออก' : 'เบิกวัสดุไปใช้งาน'
      })
      fetchProducts()
      closeModal()
    }
    setLoading(false)
  }

  const closeModal = () => {
    setActiveProduct(null)
    setActionType(null)
    setAmount(0)
  }

  const handleLogout = async () => {
    const currentId = await getSafeUserId()
    if (currentId) {
      await supabase.from('stock_logs').insert({ user_id: currentId, action_type: 'LOGOUT', details: 'ออกจากระบบ' })
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  const totalWeight = products.reduce((sum, p) => sum + Number(p.stock_quantity), 0)
  const totalBoxes = products.reduce((sum, p) => sum + Number(p.boxes), 0)

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* 📱 Overlay สำหรับ Sidebar บนมือถือ */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Desktop: แสดงปกติ, Mobile: สไลด์เข้าออก) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 transform shadow-xl md:shadow-none ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="p-6 flex justify-between items-center">
          <h1 className="text-2xl font-black text-blue-600 tracking-tight italic">ERP <span className="text-slate-800">SYSTEM</span></h1>
          <button className="md:hidden text-slate-400" onClick={() => setIsSidebarOpen(false)}>✕</button>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <a href="/inventory" className="flex items-center gap-3 bg-blue-50 text-blue-600 px-4 py-3 rounded-xl font-bold">📦 สต็อกสินค้า</a>
          {(role === 'gold' || role === 'admin') && (
            <a href="/dashboard" className="flex items-center gap-3 text-slate-500 hover:bg-slate-50 px-4 py-3 rounded-xl transition">📊 Dashboard</a>
          )}
          {role === 'admin' && (
            <a href="/admin/users" className="flex items-center gap-3 text-slate-500 hover:bg-slate-50 px-4 py-3 rounded-xl transition font-medium">👥 จัดการพนักงาน</a>
          )}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2 text-slate-700 bg-slate-50 rounded-2xl">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              {userName ? userName[0].toUpperCase() : '?'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-bold truncate text-black">{userName}</p>
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">{role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-500 py-3 rounded-xl font-bold">🚪 ออกจากระบบ</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full md:ml-64 p-4 md:p-10 transition-all">
        {/* 🔥 Mobile Navbar Header */}
        <div className="md:hidden flex justify-between items-center mb-6">
          <button onClick={() => setIsSidebarOpen(true)} className="text-2xl p-2 bg-white rounded-xl shadow-sm border">☰</button>
          <span className="font-black text-blue-600">ERP SYSTEM</span>
          <div className="w-10"></div> {/* Spacer */}
        </div>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <p className="text-slate-400 font-medium italic underline decoration-blue-500 text-sm">CSW Inventory Management</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">คลังสินค้า</h2>
          </div>
          {(role === 'gold' || role === 'admin') && (
            <button onClick={() => router.push('/inventory/add')} className="w-full md:w-auto bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold shadow-lg">
              + เพิ่มสินค้าใหม่
            </button>
          )}
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase mb-1">Total Weight</p>
            <h3 className="text-2xl font-black text-slate-800">{totalWeight.toLocaleString()} <span className="text-sm font-medium">  ก.</span></h3>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase mb-1">Total Boxes</p>
            <h3 className="text-2xl font-black text-slate-800">{totalBoxes.toLocaleString()} <span className="text-sm font-medium text-blue-500">เต๋า</span></h3>
          </div>
          <div className="bg-blue-600 p-5 rounded-3xl shadow-lg text-white sm:col-span-2 lg:col-span-1">
            <p className="opacity-80 text-[10px] font-black uppercase mb-1">Items Count</p>
            <h3 className="text-2xl font-black">{products.length} <span className="text-sm font-medium">รายการ</span></h3>
          </div>
        </div>

        {/* 📱 Mobile List View / 💻 Desktop Table View */}
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
          {/* Desktop Table (Hidden on Mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50/30 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                  <th className="px-8 py-6">Product Details</th>
                  <th className="px-8 py-6 text-right">Stock (KG)</th>
                  <th className="px-8 py-6 text-center">Box Management</th>
                  <th className="px-8 py-6 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6 flex items-center gap-5">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden cursor-pointer" onClick={() => p.image_url && setSelectedImage(p.image_url)}>
                        {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-lg leading-tight">{p.name}</p>
                        <p className="text-[11px] font-mono text-blue-500 font-black uppercase tracking-wider">{p.product_code}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-2xl text-slate-900">{Number(p.stock_quantity).toLocaleString()}</td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex items-center bg-slate-100 rounded-2xl p-1 gap-3 border border-slate-200">
                        <button onClick={() => handleUpdateBox(p.id, p.boxes, -1)} className="w-8 h-8 bg-white rounded-xl shadow-sm font-black">-</button>
                        <span className="text-sm font-black w-10">{p.boxes}</span>
                        <button onClick={() => handleUpdateBox(p.id, p.boxes, 1)} className="w-8 h-8 bg-white rounded-xl shadow-sm font-black">+</button>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setActiveProduct(p); setActionType('add'); }} className="flex-1 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl text-[10px] font-black hover:bg-emerald-600 hover:text-white transition uppercase">เติมของ</button>
                          <button onClick={() => { setActiveProduct(p); setActionType('sell'); }} className="flex-1 bg-amber-50 text-amber-600 px-3 py-2 rounded-xl text-[10px] font-black hover:bg-amber-600 hover:text-white transition uppercase">ขายของ</button>
                        </div>
                        <button onClick={() => { setActiveProduct(p); setActionType('use'); }} className="w-full bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-[10px] font-black hover:bg-slate-800 hover:text-white transition uppercase italic">🛠️ นำออกไปใช้</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 🔥 Mobile Card View (Hidden on Desktop) */}
          <div className="md:hidden divide-y divide-slate-100">
            {products.map((p) => (
              <div key={p.id} className="p-5 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl border flex-shrink-0 overflow-hidden" onClick={() => p.image_url && setSelectedImage(p.image_url)}>
                    {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-slate-800 leading-tight">{p.name}</p>
                    <p className="text-[10px] font-mono text-blue-500 font-black uppercase">{p.product_code}</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{Number(p.stock_quantity).toLocaleString()} <span className="text-xs font-medium text-slate-400 tracking-normal">กก.</span></p>
                  </div>
                  <div className="flex flex-col items-center bg-slate-50 p-2 rounded-2xl border">
                    <button onClick={() => handleUpdateBox(p.id, p.boxes, 1)} className="p-1 font-bold text-blue-600">+</button>
                    <span className="text-xs font-black px-2">{p.boxes} เต๋า</span>
                    <button onClick={() => handleUpdateBox(p.id, p.boxes, -1)} className="p-1 font-bold text-red-500">-</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { setActiveProduct(p); setActionType('add'); }} className="bg-emerald-50 text-emerald-600 py-3 rounded-xl text-[10px] font-black uppercase">เติม</button>
                  <button onClick={() => { setActiveProduct(p); setActionType('sell'); }} className="bg-amber-50 text-amber-600 py-3 rounded-xl text-[10px] font-black uppercase">ขาย</button>
                  <button onClick={() => { setActiveProduct(p); setActionType('use'); }} className="bg-slate-100 text-slate-600 py-3 rounded-xl text-[10px] font-black uppercase">เบิกใช้</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modals (Fixed for Mobile) */}
        {selectedImage && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <img src={selectedImage} className="max-w-full max-h-[80vh] rounded-3xl shadow-2xl" />
          </div>
        )}

        {activeProduct && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl">
              <div className="text-center mb-6">
                <span className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase mb-2 ${actionType === 'add' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {actionType === 'add' ? 'RESTOCK' : actionType === 'sell' ? 'SALE' : 'INTERNAL USE'}
                </span>
                <h4 className="text-xl font-black text-slate-800">{activeProduct.name}</h4>
              </div>
              <input autoFocus type="number" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} className="w-full text-4xl font-black text-center bg-slate-50 border-none rounded-2xl py-6 mb-6" placeholder="0" />
              <div className="flex flex-col gap-2">
                <button onClick={handleTransaction} disabled={loading || amount <= 0} className="w-full py-4 rounded-xl font-black bg-slate-900 text-white active:scale-95 transition">
                  {loading ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
                </button>
                <button onClick={closeModal} className="w-full py-2 text-slate-400 font-bold">ยกเลิก</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}