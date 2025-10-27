# -*- mode: python ; coding: utf-8 -*-
block_cipher = None

a = Analysis(
    ['BorrowMate.py'],
    pathex=['C:\\Users\\User\\Speedfacem2'],  # โฟลเดอร์โปรเจกต์
    binaries=[
        ('C:\\Users\\User\\Speedfacem2\\myenv_new\\Lib\\site-packages\\pyzbar\\libiconv.dll', 'pyzbar'),
        ('C:\\Users\\User\\Speedfacem2\\myenv_new\\Lib\\site-packages\\pyzbar\\libzbar-64.dll', 'pyzbar'),
    ],
    datas=[],
    hiddenimports=[
        'reportlab.graphics.barcode.code93',
        'reportlab.graphics.barcode.code128',
        'reportlab.graphics.barcode.code39',
        'reportlab.graphics.barcode.usps',
        'reportlab.graphics.barcode.usps4s',
        'reportlab.graphics.barcode.ecc200datamatrix',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='BorrowMate',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,  # หรือใส่ path เช่น 'C:\\Users\\User\\Speedfacem2\\tmp'
    console=False,
    icon='C:\\Users\\User\\Speedfacem2\\icon.ico',
)
