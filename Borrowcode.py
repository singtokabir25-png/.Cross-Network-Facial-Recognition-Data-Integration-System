import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import sqlite3
from datetime import datetime
import threading
import cv2
from pyzbar import pyzbar
from barcode import Code128
from barcode.writer import ImageWriter
from PIL import Image, ImageTk
from tkcalendar import DateEntry
import winsound  # Windows-only beep; ถ้าไม่ใช้ Windows ให้เปลี่ยนเป็น playsound
import os
import tempfile
import sys
 
# reportlab for PDF generation (ใช้ barcode vector ของ reportlab เพื่อให้สแกนได้แน่นอน)
from reportlab.lib.pagesizes import A4 
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.barcode import code128  # ใช้วาดบาร์โค้ดเป็นกราฟิกโดยตรง

# ---------------------------
# Database Setup
# ---------------------------
DB_FILE = "tools.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL  UNIQUE,
            total_qty INTEGER NOT NULL,
            available_qty INTEGER NOT NULL,
            image TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            user TEXT NOT NULL,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(tool_id) REFERENCES tools(id)
        )
    """)
    conn.commit()
    conn.close()

def add_tool(name, code, qty, image_path=None):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO tools (name, code, total_qty, available_qty, image) VALUES (?, ?, ?, ?, ?)",
                (name, code, qty, qty, image_path))
    conn.commit()
    conn.close()

def delete_tool(tool_id):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("DELETE FROM tools WHERE id=?", (tool_id,))
    conn.commit()
    conn.close()

def get_tool_by_code(code):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT * FROM tools WHERE code=?", (code,))
    row = cur.fetchone()
    conn.close()
    return row

def update_qty(tool_id, change):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    # ดึงค่าปัจจุบัน
    cur.execute("SELECT total_qty, available_qty FROM tools WHERE id=?", (tool_id,))
    res = cur.fetchone()
    if not res:
        conn.close()
        return
    total_qty, avail = res
    new_avail = avail + change

    # ตรวจสอบไม่ให้ต่ำกว่า 0 และไม่เกินจำนวนทั้งหมด
    if new_avail < 0:
        new_avail = 0
    elif new_avail > total_qty:
        new_avail = total_qty

    cur.execute("UPDATE tools SET available_qty=? WHERE id=?", (new_avail, tool_id))
    conn.commit()
    conn.close()

def insert_transaction(tool_id, action, user):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("INSERT INTO transactions (tool_id, action, user, date) VALUES (?, ?, ?, ?)",
                (tool_id, action, user, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    conn.close()

def fetch_tools():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT id, name, code, total_qty, available_qty, image FROM tools")
    rows = cur.fetchall()
    conn.close()
    return rows

def fetch_transactions():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        SELECT tr.id, tl.name, tr.action, tr.user, tr.date
        FROM transactions tr
        JOIN tools tl ON tr.tool_id = tl.id
        ORDER BY tr.id DESC
    """)
    rows = cur.fetchall()
    conn.close()
    return rows

# ---------------------------
# Actions (Borrow / Return)
# ---------------------------
def borrow_tool(code, user):
    tool = get_tool_by_code(code)
    if not tool:
        messagebox.showerror("Error", f"ไม่พบเครื่องมือที่มีรหัส {code}")
        return
    if tool[4] <= 0:  # available_qty at index 4
        messagebox.showerror("Error", f"{tool[1]} ไม่มีเหลือให้ยืม")
        return
    update_qty(tool[0], -1)
    insert_transaction(tool[0], "ยืม", user)
    refresh_tables()

def return_tool(code, user):
    tool = get_tool_by_code(code)
    if not tool:
        messagebox.showerror("Error", f"ไม่พบเครื่องมือที่มีรหัส {code}")
        return
    total_qty = tool[3]       # index 3 = total_qty
    available_qty = tool[4]   # index 4 = available_qty
    if available_qty >= total_qty:
        messagebox.showerror("Error", f"{tool[1]} มีจำนวนครบแล้ว ไม่สามารถคืนเกินได้")
        return
    update_qty(tool[0], 1)
    insert_transaction(tool[0], "คืน", user)
    refresh_tables()

# ---------------------------
# UI Refresh helpers
# ---------------------------
tool_images = {}  # {tool_id: image_path}

def refresh_tools_table_main():
    # Refresh tools (main tree)
    for i in tree_tools.get_children():
        tree_tools.delete(i)
    for row in fetch_tools():
        tool_id, name, code, total, avail, image_path = row
        tool_images[tool_id] = image_path
        tree_tools.insert("", tk.END, values=(tool_id, name, code, total, avail))

def refresh_transactions_all():
    for i in tree_trans.get_children():
        tree_trans.delete(i)
    for row in fetch_transactions():
        tree_trans.insert("", tk.END, values=row)

def refresh_tables():
    refresh_tools_table_main()
    refresh_transactions_all()

# ---------------------------
# Barcode Scanner (Threaded) + Sound
# ---------------------------
scanning = False
_scanner_thread = None
scanned_codes = set()
last_scan_time = {}

def _scanner_loop(user):
    global scanning
    cap = cv2.VideoCapture(0)
    while scanning:
        ret, frame = cap.read()
        if not ret:
            break
        barcodes = pyzbar.decode(frame)
        for barcode in barcodes:
            code = barcode.data.decode("utf-8")
            # check timeout 2 วินาที
            import time
            now = time.time()
            if code not in last_scan_time or now - last_scan_time[code] > 2:
                last_scan_time[code] = now
                root.after(0, lambda c=code, u=user: handle_scanned_code(c, u))
                try:
                    winsound.Beep(1000, 120)
                except: pass
        cv2.imshow("Scanner", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    cap.release()
    cv2.destroyAllWindows()
    scanning = False
    root.after(0, update_scan_button_state)


def handle_scanned_code(code, user):
    # ฟังก์ชันนี้รันบน main thread (เพราะเรียกผ่าน root.after)
    if mode_var.get() == "borrow":
        borrow_tool(code, user)
    else:
        return_tool(code, user)

def start_camera_scan():
    global scanning, _scanner_thread
    if scanning:
        return
    user = entry_user.get().strip()
    if not user:
        messagebox.showerror("Error", "กรุณากรอกชื่อผู้ใช้ก่อนสแกน")
        return
    scanning = True
    update_scan_button_state()
    # start thread
    _scanner_thread = threading.Thread(target=_scanner_loop, args=(user,), daemon=True)
    _scanner_thread.start()

def stop_camera_scan():
    global scanning
    scanning = False
    # thread จะสิ้นสุดเองเมื่อ loop ตรวจพบ scanning == False
    update_scan_button_state()

def toggle_scan():
    if scanning:
        stop_camera_scan()
    else:
        start_camera_scan()

def update_scan_button_state():
    # เปลี่ยนข้อความของปุ่มตามสถานะ
    if scanning:
        btn_scan.config(text="Stop Scan", style="Gold.TButton")
    else:
        btn_scan.config(text="Start Scan (กล้อง)", style="Gold.TButton")

# ---------------------------
# Generate Barcode (single)
# ---------------------------
def generate_barcode():
    selected = tree_tools.selection()
    if not selected:
        messagebox.showerror("Error", "กรุณาเลือกเครื่องมือจากรายการก่อน")
        return
    item = tree_tools.item(selected[0])['values']
    code = item[2]
    filepath = filedialog.asksaveasfilename(defaultextension=".png",
                                            filetypes=[("PNG files", "*.png")],
                                            initialfile=f"{code}.png")
    if not filepath:
        return
    barcode_obj = Code128(code, writer=ImageWriter())
    barcode_obj.save(filepath)
    messagebox.showinfo("สำเร็จ", f"บาร์โค้ด {code} ถูกบันทึกที่\n{filepath}")

# ---------------------------
# Print all barcodes -> PDF (ใช้ reportlab.graphics.barcode)
# ---------------------------
def _register_th_font_prefer_paths():
    """
    พยายามลงทะเบียน TH Sarabun New จากตำแหน่งต่างๆ หากมีไฟล์ .ttf
    คืนค่า font_name ที่ใช้งานได้ (หรือ 'Helvetica' ถ้าไม่พบ)
    """
    font_name = "THSarabunNew"
    possible_paths = [
        "THSarabunNew.ttf",  # ในโฟลเดอร์โปรเจค
        os.path.join(os.getcwd(), "THSarabunNew.ttf"),
        r"C:\Windows\Fonts\THSarabunNew.ttf",
        r"C:\Windows\Fonts\THSarabun.ttf",
        "/usr/share/fonts/truetype/THSarabunNew.ttf",
        "/usr/share/fonts/truetype/sarabun/THSarabunNew.ttf",
        "/Library/Fonts/THSarabunNew.ttf",
    ]
    for p in possible_paths:
        try:
            if os.path.exists(p):
                pdfmetrics.registerFont(TTFont(font_name, p))
                return font_name
        except Exception:
            continue
    # ถ้าไม่พบไฟล์ ให้ลองค้นหา .ttf ที่มีคำว่า 'Sarabun' ในโฟลเดอร์ fonts
    try:
        # ค้นหาใน /usr/share/fonts และ Windows fonts
        search_dirs = ["/usr/share/fonts", "/Library/Fonts", r"C:\Windows\Fonts"]
        for sd in search_dirs:
            if os.path.exists(sd):
                for rootf, dirsf, filesf in os.walk(sd):
                    for ff in filesf:
                        if "sarabun" in ff.lower():
                            candidate = os.path.join(rootf, ff)
                            try:
                                pdfmetrics.registerFont(TTFont(font_name, candidate))
                                return font_name
                            except Exception:
                                continue
    except Exception:
        pass
    # fallback
    return "Helvetica"

def print_all_barcodes_centered_code():
    tools = fetch_tools()
    if not tools:
        messagebox.showinfo("ไม่มีข้อมูล", "ไม่พบรายการเครื่องมือในฐานข้อมูล")
        return

    pdf_path = filedialog.asksaveasfilename(
        defaultextension=".pdf",
        filetypes=[("PDF files", "*.pdf")],
        title="บันทึกไฟล์บาร์โค้ดทั้งหมดเป็น PDF",
        initialfile="barcodes_centered_code.pdf"
    )
    if not pdf_path:
        return

    font_name = _register_th_font_prefer_paths()  # ฟังก์ชันหา/ลงทะเบียนฟอนต์เดิมของคุณ

    c = canvas.Canvas(pdf_path, pagesize=A4)
    width, height = A4

    # header (ถ้าต้องการ)
    c.setFont(font_name, 14)
    c.drawCentredString(width/2, height - 20*mm, "Barcode (Store)")
    y = height - 36*mm

    margin_left = 18 * mm
    x_start = margin_left
    x = x_start
    per_row = 2
    col_width = (width - 2 * margin_left) / per_row

    # ตั้งค่าบาร์โค้ด / ขนาดตัวหนังสือ
    barcode_height = 18 * mm
    default_barcode_width = 60 * mm    # ถ้า br.width ไม่มี จะใช้ค่านี้
    label_gap = 3 * mm
    label_font_size = 10
    row_height = barcode_height + 10 * mm + (label_font_size * 0.35 * mm)  # เผื่อพื้นที่

    count = 0

    for row in tools:
        tool_id, name, code, total, avail, image_path = row

        # สร้าง barcode object (vector) — ปรับ barWidth ถ้าต้องการเส้นหนาหรือบาง
        try:
            br = code128.Code128(str(code), barHeight=barcode_height, barWidth=1)
        except Exception:
            br = None

        col_x_center = x + col_width / 2

        # หาความกว้างจริงของบาร์โค้ด (object width อยู่เป็นหน่วย points ถ้ามี)
        if br is not None and hasattr(br, "width"):
            actual_w = br.width
        else:
            actual_w = default_barcode_width

        # ตำแหน่งมุมซ้ายล่างของบาร์โค้ด เพื่อให้กึ่งกลางตรง col_x_center
        barcode_x = col_x_center - (actual_w / 2)
        barcode_y = y - barcode_height - 6*mm

        # วาดบาร์โค้ด (ถ้ามี)
        if br:
            try:
                br.drawOn(c, barcode_x, barcode_y)
            except Exception:
                # ถ้าวาดไม่ได้ ให้แสดงตัวเลขแทน
                c.setFont(font_name, label_font_size)
                c.drawCentredString(col_x_center, barcode_y + (barcode_height/2), str(code))
        else:
            c.setFont(font_name, label_font_size)
            c.drawCentredString(col_x_center, barcode_y + (barcode_height/2), str(code))

        # วาดรหัสใต้บาร์โค้ด (centered)
        label_y = barcode_y - label_gap
        c.setFont(font_name, label_font_size)
        c.drawCentredString(col_x_center, label_y, str(code))

        count += 1
        x += col_width

        if count % per_row == 0:
            x = x_start
            y -= row_height

        if y - row_height < 20 * mm:
            c.showPage()
            # วาด header หน้าต่อ
            c.setFont(font_name, 14)
            c.drawCentredString(width/2, height - 20*mm, "Barcode (Store)")
            y = height - 36*mm
            x = x_start

    c.save()
    messagebox.showinfo("สำเร็จ", f"สร้าง PDF เรียบร้อย: {pdf_path}")

# ---------------------------
# Manage Tools Window
# ---------------------------
def open_manage_tools():
    win = tk.Toplevel(root)
    win.title("จัดการเครื่องมือ")
    win.geometry("900x520")
    win.configure(bg="#0D1B2A")

    frame_form = ttk.LabelFrame(win, text="เพิ่มเครื่องมือ", padding=10)
    frame_form.pack(fill="x", padx=10, pady=10)

    ttk.Label(frame_form, text="ชื่อเครื่องมือ:").grid(row=0, column=0, padx=5, pady=5)
    entry_name = ttk.Entry(frame_form, width=20)
    entry_name.grid(row=0, column=1, padx=5, pady=5)

    ttk.Label(frame_form, text="รหัส:").grid(row=0, column=2, padx=5, pady=5)
    entry_code = ttk.Entry(frame_form, width=15)
    entry_code.grid(row=0, column=3, padx=5, pady=5)

    ttk.Label(frame_form, text="จำนวน:").grid(row=0, column=4, padx=5, pady=5)
    entry_qty = ttk.Entry(frame_form, width=10)
    entry_qty.grid(row=0, column=5, padx=5, pady=5)

    ttk.Label(frame_form, text="รูป:").grid(row=1, column=0, padx=5, pady=5)
    entry_img = ttk.Entry(frame_form, width=40)
    entry_img.grid(row=1, column=1, columnspan=3, padx=5, pady=5)

    def browse_image():
        path = filedialog.askopenfilename(filetypes=[("Image files", "*.png;*.jpg;*.jpeg")])
        if path:
            entry_img.delete(0, tk.END)
            entry_img.insert(0, path)
    ttk.Button(frame_form, text="เลือกไฟล์", command=browse_image, style="Gold.TButton").grid(row=1, column=4, padx=5)

    def add_tool_from_form():
        name = entry_name.get().strip()
        code = entry_code.get().strip()
        qty = entry_qty.get().strip()
        image_path = entry_img.get().strip()
        if not name or not code or not qty.isdigit():
            messagebox.showerror("Error", "กรอกข้อมูลไม่ถูกต้อง")
            return
        add_tool(name, code, int(qty), image_path)
        # update preview storage and tables
        refresh_tools_table_in_manage()
        refresh_tables()
        entry_name.delete(0, tk.END)
        entry_code.delete(0, tk.END)
        entry_qty.delete(0, tk.END)
        entry_img.delete(0, tk.END)
    ttk.Button(frame_form, text="เพิ่ม", command=add_tool_from_form, style="Gold.TButton").grid(row=0, column=6, padx=5)

    frame_list = ttk.LabelFrame(win, text="รายการเครื่องมือ", padding=10)
    frame_list.pack(fill="both", expand=True, padx=10, pady=10)

    cols = ("ID", "ชื่อเครื่องมือ", "รหัส", "จำนวนทั้งหมด", "จำนวนคงเหลือ", "รูป")
    tree_manage = ttk.Treeview(frame_list, columns=cols, show="headings")
    for col in cols:
        tree_manage.heading(col, text=col)
        tree_manage.column(col, width=140, anchor="center")
    tree_manage.pack(fill="both", expand=True)

    def refresh_tools_table_in_manage():
        for i in tree_manage.get_children():
            tree_manage.delete(i)
        for row in fetch_tools():
            tree_manage.insert("", tk.END, values=row)
    refresh_tools_table_in_manage()

    def delete_selected():
        selected = tree_manage.selection()
        if not selected:
            messagebox.showerror("Error", "กรุณาเลือกเครื่องมือที่จะลบ")
            return
        item = tree_manage.item(selected[0])['values']
        tool_id = item[0]
        confirm = messagebox.askyesno("ยืนยัน", f"ต้องการลบ {item[1]} ใช่หรือไม่?")
        if confirm:
            delete_tool(tool_id)
            refresh_tools_table_in_manage()
            refresh_tables()

    def increase_selected():
        selected = tree_manage.selection()
        if not selected:
            messagebox.showerror("Error", "กรุณาเลือกเครื่องมือที่จะเพิ่มจำนวน")
            return
        item = tree_manage.item(selected[0])['values']
        tool_id = item[0]
        name = item[1]

        # กล่องถามจำนวนที่จะเพิ่ม
        qty_win = tk.Toplevel(win)
        qty_win.title("เพิ่มจำนวน")
        qty_win.geometry("320x160")
        qty_win.configure(bg="#0D1B2A")

        ttk.Label(qty_win, text=f"เพิ่มจำนวนให้ {name}", font=("TH Sarabun New", 13),
                  background="#0D1B2A", foreground="white").pack(pady=10)

        entry_add = ttk.Entry(qty_win, width=12, font=("TH Sarabun New", 12))
        entry_add.pack(pady=5)

        def confirm_add():
            val = entry_add.get().strip()
            if not val.isdigit() or int(val) <= 0:
                messagebox.showerror("Error", "กรุณากรอกจำนวนที่ถูกต้อง (ตัวเลข > 0)")
                return
            add_val = int(val)

            conn = sqlite3.connect(DB_FILE)
            cur = conn.cursor()
            cur.execute("SELECT total_qty, available_qty FROM tools WHERE id=?", (tool_id,))
            res = cur.fetchone()
            if not res:
                conn.close()
                messagebox.showerror("Error", "ไม่พบข้อมูลเครื่องมือนี้")
                qty_win.destroy()
                return
            total_qty, avail_qty = res

            new_total = total_qty + add_val
            new_avail = avail_qty + add_val
            # guard (new_avail ไม่ควรเกิน new_total แต่ตรงนี้เท่ากับเพิ่มทั้งสองเท่ากัน)
            if new_avail > new_total:
                new_avail = new_total

            cur.execute("UPDATE tools SET total_qty=?, available_qty=? WHERE id=?",
                        (new_total, new_avail, tool_id))
            conn.commit()
            conn.close()

            refresh_tools_table_in_manage()
            refresh_tables()
            qty_win.destroy()

        ttk.Button(qty_win, text="ยืนยัน", command=confirm_add, style="Gold.TButton").pack(pady=10)

    def decrease_selected():
        selected = tree_manage.selection()
        if not selected:
            messagebox.showerror("Error", "กรุณาเลือกเครื่องมือที่จะลดจำนวน")
            return
        item = tree_manage.item(selected[0])['values']
        tool_id = item[0]
        name = item[1]

        # กล่องถามจำนวนที่จะลด
        qty_win = tk.Toplevel(win)
        qty_win.title("ลดจำนวน")
        qty_win.geometry("320x180")
        qty_win.configure(bg="#0D1B2A")

        ttk.Label(qty_win, text=f"ลดจำนวนให้ {name}", font=("TH Sarabun New", 13),
                  background="#0D1B2A", foreground="white").pack(pady=8)

        ttk.Label(qty_win, text="ใส่จำนวนที่ต้องการลด (ตัวเลข > 0)", font=("TH Sarabun New", 11),
                  background="#0D1B2A", foreground="white").pack()

        entry_dec = ttk.Entry(qty_win, width=12, font=("TH Sarabun New", 12))
        entry_dec.pack(pady=6)

        def confirm_dec():
            val = entry_dec.get().strip()
            if not val.isdigit() or int(val) <= 0:
                messagebox.showerror("Error", "กรุณากรอกจำนวนที่ถูกต้อง (ตัวเลข > 0)")
                return
            dec_val = int(val)

            conn = sqlite3.connect(DB_FILE)
            cur = conn.cursor()
            cur.execute("SELECT total_qty, available_qty FROM tools WHERE id=?", (tool_id,))
            res = cur.fetchone()
            if not res:
                conn.close()
                messagebox.showerror("Error", "ไม่พบข้อมูลเครื่องมือนี้")
                qty_win.destroy()
                return
            total_qty, avail_qty = res

            # จำนวนที่ถูกยืมอยู่ = total_qty - available_qty
            borrowed = total_qty - avail_qty

            # ห้ามลดจนต่ำกว่าจำนวนที่ยืมออกไป
            if dec_val > avail_qty:
                conn.close()
                messagebox.showerror("Error", f"ไม่สามารถลดได้มากกว่า {avail_qty} (จำนวนที่มีอยู่ในคลังตอนนี้)\nจำนวนที่ยืมอยู่: {borrowed}")
                return

            new_total = total_qty - dec_val
            new_avail = avail_qty - dec_val

            if new_total < 0:
                conn.close()
                messagebox.showerror("Error", "การลดจะทำให้จำนวนทั้งหมดติดลบนะ (ตรวจสอบค่าอีกครั้ง)")
                return

            cur.execute("UPDATE tools SET total_qty=?, available_qty=? WHERE id=?",
                        (new_total, new_avail, tool_id))
            conn.commit()
            conn.close()

            refresh_tools_table_in_manage()
            refresh_tables()
            qty_win.destroy()

        ttk.Button(qty_win, text="ยืนยัน", command=confirm_dec, style="Gold.TButton").pack(pady=10)

    # ปุ่มจัดการ (ลบ / เพิ่มจำนวน / ลดจำนวน)
    btn_frame = ttk.Frame(win)
    btn_frame.pack(pady=5)
    ttk.Button(btn_frame, text="ลบเครื่องมือที่เลือก", command=delete_selected, style="Gold.TButton").pack(side="left", padx=5)
    ttk.Button(btn_frame, text="เพิ่มจำนวน (บวก)", command=increase_selected, style="Gold.TButton").pack(side="left", padx=5)
    ttk.Button(btn_frame, text="ลดจำนวน (ลบ)", command=decrease_selected, style="Gold.TButton").pack(side="left", padx=5)

# ---------------------------
# Main UI
# ---------------------------
root = tk.Tk()
root.title("ระบบยืมคืนเครื่องมือ (Barcode + Camera)")
root.geometry("1150x780")
root.configure(bg="#0D1B2A")

# Style
style = ttk.Style()
style.theme_use("clam")
style.configure("Gold.TButton",
                font=("TH Sarabun New", 13, "bold"),
                background="#1B263B",
                foreground="white",
                padding=8,
                borderwidth=0)
style.map("Gold.TButton",
          background=[("active", "#FFD700")],
          foreground=[("active", "#0D1B2A")])
style.configure("TLabelframe",
                background="#0D1B2A",
                foreground="#FFD700")
style.configure("TLabelframe.Label",
                font=("TH Sarabun New", 14, "bold"),
                background="#0D1B2A",
                foreground="#FFD700")
style.configure("Treeview",
                font=("TH Sarabun New", 12),
                rowheight=28,
                background="#1B263B",
                fieldbackground="#1B263B",
                foreground="white")
style.map("Treeview",
          background=[("selected", "#FFD700")],
          foreground=[("selected", "#0D1B2A")])
style.configure("Treeview.Heading",
                font=("TH Sarabun New", 13, "bold"),
                background="#FFD700",
                foreground="#0D1B2A")

# Top controls
frame_top = ttk.Frame(root, padding=10)
frame_top.pack(fill="x")

ttk.Label(frame_top, text="ชื่อผู้ใช้:", font=("TH Sarabun New", 12),
          foreground="white", background="#0D1B2A").grid(row=0, column=0, padx=5, pady=5)
entry_user = ttk.Entry(frame_top, width=20, font=("TH Sarabun New", 12))
entry_user.grid(row=0, column=1, padx=5, pady=5)

mode_var = tk.StringVar(value="borrow")
ttk.Radiobutton(frame_top, text="โหมด ยืม", variable=mode_var, value="borrow").grid(row=0, column=2, padx=5)
ttk.Radiobutton(frame_top, text="โหมด คืน", variable=mode_var, value="return").grid(row=0, column=3, padx=5)

btn_scan = ttk.Button(frame_top, text="Start Scan (กล้อง)", command=toggle_scan, style="Gold.TButton")
btn_scan.grid(row=0, column=4, padx=20)
ttk.Button(frame_top, text="สร้างบาร์โค้ด", command=generate_barcode, style="Gold.TButton").grid(row=0, column=5, padx=10)
ttk.Button(frame_top, text="จัดการเครื่องมือ", command=open_manage_tools, style="Gold.TButton").grid(row=0, column=6, padx=10)
ttk.Button(frame_top, text="พิมพ์บาร์โค้ดทั้งหมด (PDF)", command=print_all_barcodes_centered_code, style="Gold.TButton").grid(row=0, column=7, padx=10)

# Tools Treeview + Preview
frame_tools = ttk.LabelFrame(root, text="รายการเครื่องมือ", padding=10)
frame_tools.pack(fill="both", expand=True, padx=10, pady=5)

frame_left = ttk.Frame(frame_tools)
frame_left.pack(side="left", fill="both", expand=True)
frame_right = ttk.Frame(frame_tools, width=240)
frame_right.pack(side="right", fill="y", padx=10)

cols_tools = ("ID", "ชื่อเครื่องมือ", "รหัส", "จำนวนทั้งหมด", "จำนวนคงเหลือ")
tree_tools = ttk.Treeview(frame_left, columns=cols_tools, show="headings")
for col in cols_tools:
    tree_tools.heading(col, text=col)
    tree_tools.column(col, width=140, anchor="center")
tree_tools.pack(fill="both", expand=True)

preview_label = ttk.Label(frame_right, text="Preview", anchor="center",
                          font=("TH Sarabun New", 12, "bold"),
                          foreground="#FFD700", background="#0D1B2A")
preview_label.pack(pady=10)
preview_canvas = tk.Label(frame_right, text="ไม่มีรูป", width=200, height=200,
                          relief="ridge", bg="#1B263B", fg="white")
preview_canvas.pack(pady=(0,10))

def show_preview(event):
    selected = tree_tools.selection()
    if not selected:
        preview_canvas.config(text="ไม่มีรูป", image="")
        return
    item = tree_tools.item(selected[0])['values']
    tool_id = item[0]
    path = tool_images.get(tool_id)
    if path:
        try:
            img = Image.open(path).resize((200, 200))
            img_tk = ImageTk.PhotoImage(img)
            preview_canvas.image = img_tk
            preview_canvas.config(image=img_tk, text="")
        except Exception:
            preview_canvas.config(text="โหลดรูปไม่สำเร็จ", image="")
    else:
        preview_canvas.config(text="ไม่มีรูป", image="")

tree_tools.bind("<<TreeviewSelect>>", show_preview)

# Transactions + Filter
frame_trans = ttk.LabelFrame(root, text="ประวัติการยืมคืน", padding=10)
frame_trans.pack(fill="both", expand=True, padx=10, pady=5)

# Filter Bar
frame_filter = ttk.Frame(frame_trans)
frame_filter.pack(fill="x", pady=5)

ttk.Label(frame_filter, text="ผู้ใช้:", font=("TH Sarabun New", 12),
          background="#0D1B2A", foreground="white").grid(row=0, column=0, padx=5)
filter_user = ttk.Entry(frame_filter, width=15, font=("TH Sarabun New", 12))
filter_user.grid(row=0, column=1, padx=5)

ttk.Label(frame_filter, text="การทำรายการ:", font=("TH Sarabun New", 12),
          background="#0D1B2A", foreground="white").grid(row=0, column=2, padx=5)
filter_action = ttk.Combobox(frame_filter, values=["ทั้งหมด", "ยืม", "คืน"],
                             state="readonly", font=("TH Sarabun New", 12), width=10)
filter_action.current(0)
filter_action.grid(row=0, column=3, padx=5)

ttk.Label(frame_filter, text="วันที่เริ่ม:", font=("TH Sarabun New", 12),
          background="#0D1B2A", foreground="white").grid(row=0, column=4, padx=5)
filter_start = DateEntry(frame_filter, width=12, background="darkblue", foreground="white",
                         borderwidth=2, date_pattern="yyyy-mm-dd", font=("TH Sarabun New", 12))
filter_start.grid(row=0, column=5, padx=5)

ttk.Label(frame_filter, text="วันที่สิ้นสุด:", font=("TH Sarabun New", 12),
          background="#0D1B2A", foreground="white").grid(row=0, column=6, padx=5)
filter_end = DateEntry(frame_filter, width=12, background="darkblue", foreground="white",
                       borderwidth=2, date_pattern="yyyy-mm-dd", font=("TH Sarabun New", 12))
filter_end.grid(row=0, column=7, padx=5)

def apply_filter():
    user_val = filter_user.get().strip()
    action_val = filter_action.get()
    start_val = filter_start.get_date()
    end_val = filter_end.get_date()

    # validate
    if start_val and end_val and start_val > end_val:
        messagebox.showerror("Error", "วันที่เริ่มไม่ควรมากกว่าวันที่สิ้นสุด")
        return

    # clear tree
    for i in tree_trans.get_children():
        tree_trans.delete(i)

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    query = """
        SELECT tr.id, tl.name, tr.action, tr.user, tr.date
        FROM transactions tr
        JOIN tools tl ON tr.tool_id = tl.id
        WHERE 1=1
    """
    params = []
    if user_val:
        query += " AND tr.user LIKE ?"
        params.append(f"%{user_val}%")
    if action_val != "ทั้งหมด":
        query += " AND tr.action=?"
        params.append(action_val)
    if start_val and end_val:
        query += " AND DATE(tr.date) BETWEEN ? AND ?"
        params.append(start_val.strftime("%Y-%m-%d"))
        params.append(end_val.strftime("%Y-%m-%d"))

    query += " ORDER BY tr.id DESC"
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    for row in rows:
        tree_trans.insert("", tk.END, values=row)

def reset_filter():
    filter_user.delete(0, tk.END)
    filter_action.current(0)
    today = datetime.now().date()
    filter_start.set_date(today)
    filter_end.set_date(today)
    refresh_transactions_all()

ttk.Button(frame_filter, text="กรอง", command=apply_filter, style="Gold.TButton").grid(row=0, column=8, padx=10)
ttk.Button(frame_filter, text="รีเซ็ต", command=reset_filter, style="Gold.TButton").grid(row=0, column=9, padx=5)

# Transactions Treeview
cols_trans = ("ID", "ชื่อเครื่องมือ", "การทำรายการ", "ผู้ใช้", "วันที่")
tree_trans = ttk.Treeview(frame_trans, columns=cols_trans, show="headings", height=8)
for col in cols_trans:
    tree_trans.heading(col, text=col)
    tree_trans.column(col, width=170, anchor="center")
tree_trans.pack(fill="both", expand=True, padx=5, pady=(5,10))

# ---------------------------
# Initialize DB and Tables
# ---------------------------
init_db()
filter_start.set_date(datetime.now().date())
filter_end.set_date(datetime.now().date())
refresh_tables()
update_scan_button_state()

# Ensure scanning stops cleanly on exit
def on_closing():
    global scanning
    if scanning:
        scanning = False
    root.after(200, root.destroy)

root.protocol("WM_DELETE_WINDOW", on_closing)
root.mainloop()
