'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function AddProductPage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [weight, setWeight] = useState('')
  const [boxes, setBoxes] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()

  // ดึงข้อมูล User ปัจจุบันเบื้องต้น
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUser()
  }, [])

  // ฟังก์ชันช่วยเช็ค ID แบบชัวร์ๆ ก่อนบันทึก เพื่อป้องกันค่า NULL ใน Logs
  const getSafeUserId = async () => {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 0. เช็ค ID ผู้ใช้ก่อนเริ่มงาน
      const currentId = await getSafeUserId()
      if (!currentId) {
        alert('ไม่พบ Session ผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง')
        return
      }

      let imageUrl = null

      // 1. อัปโหลดรูปภาพไปยัง Bucket 'products'
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('products') 
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('products')
          .getPublicUrl(uploadData.path)
        
        imageUrl = publicUrl
      }

      // 2. บันทึกข้อมูลลงตาราง 'products'
      const { data: newProduct, error: insertError } = await supabase.from('products').insert([
        { 
          name: name, 
          product_code: code.toUpperCase(), 
          stock_quantity: parseFloat(weight) || 0, 
          boxes: parseInt(boxes) || 0,
          image_url: imageUrl
        }
      ]).select().single()

      if (insertError) throw insertError

      // 🔥 3. บันทึก Log การเพิ่มสินค้าใหม่ (ใช้ currentId ที่ดึงมาสดๆ)
      if (newProduct) {
        await supabase.from('stock_logs').insert({
          user_id: currentId,
          action_type: 'ADD', 
          product_name: name,
          change_amount: parseFloat(weight) || 0, 
          details: `เพิ่มสินค้าใหม่รหัส ${code.toUpperCase()} (เริ่มสต็อกที่ ${weight} กก. / ${boxes} เต๋า)`
        })
      }

      alert('บันทึกสินค้าและประวัติเข้าคลังเรียบร้อย!')
      router.push('/inventory')
      router.refresh()

    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-4 md:p-12">
      <div className="max-w-2xl mx-auto bg-white rounded-[40px] shadow-xl border border-slate-100 p-8 md:p-12">
        <header className="mb-10">
          <button 
            onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-600 mb-2 flex items-center gap-2 font-bold text-sm transition"
          >
            ← ย้อนกลับ
          </button>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">📦 เพิ่มสินค้าใหม่</h1>
          <p className="text-slate-400 font-medium italic underline decoration-blue-500">สร้างรายการวัสดุใหม่เข้าสู่คลัง CSW</p>
        </header>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50 hover:bg-slate-100 transition-colors group relative overflow-hidden">
            {previewUrl ? (
              <div className="relative w-full h-48">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-2xl" />
                <button 
                  type="button" 
                  onClick={() => { setPreviewUrl(null); setImageFile(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-transform active:scale-90"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer w-full py-4">
                <span className="text-4xl mb-2">📸</span>
                <span className="text-sm font-bold text-slate-500">คลิกเพื่อเพิ่มรูปภาพสินค้า</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">ชื่อสินค้า</label>
              <input 
                type="text" 
                required 
                className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-black focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-300" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="เช่น เหล็กเส้น, อะไหล่ A" 
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">รหัสสินค้า (Product Code)</label>
              <input 
                type="text" 
                required 
                className="w-full p-4 bg-slate-50 border-none rounded-2xl font-mono font-bold text-blue-600 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-300" 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                placeholder="CSW-001" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">น้ำหนักเริ่มต้น (กก.)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-black focus:ring-4 focus:ring-blue-100 transition-all" 
                  value={weight} 
                  onChange={(e) => setWeight(e.target.value)} 
                  placeholder="0.00" 
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">จำนวน BOX (เต๋า)</label>
                <input 
                  type="number" 
                  required 
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-black focus:ring-4 focus:ring-blue-100 transition-all" 
                  value={boxes} 
                  onChange={(e) => setBoxes(e.target.value)} 
                  placeholder="0" 
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button 
              type="button" 
              onClick={() => router.back()} 
              className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึกข้อมูล...' : 'บันทึกเข้าสต็อกทันที'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}