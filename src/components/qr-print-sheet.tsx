'use client'

import { useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

export interface QrPrintItem {
  nama: string
  info1?: string
  info2?: string
  token: string
}

// Sheet berisi semua QR Code yang siap dicetak / disimpan sebagai PDF.
// Hanya tampil saat print (display:none di layar, visible di @media print).
export function QrPrintSheet({ items, sheetTitle, onDone }: {
  items: QrPrintItem[]
  sheetTitle: string
  onDone?: () => void
}) {
  // Simpan onDone di ref agar effect print tidak dibatalkan saat parent
  // me-render ulang dengan prop onDone inline yang berubah setiap render.
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone })

  const printedRef = useRef(false)

  useEffect(() => {
    if (printedRef.current) return
    printedRef.current = true
    // Tunggu canvas QR selesai digambar sebelum mencetak
    const t = setTimeout(() => {
      window.print()
      onDoneRef.current?.()
    }, 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div id="qr-print-sheet" className="hidden print:block">
      <h1 className="text-xl font-bold text-center mb-1">{sheetTitle}</h1>
      <p className="text-xs text-center mb-4">SistAbsen · Sistem Absensi QR Sekolah</p>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div key={`${item.token}-${i}`} className="qr-print-card">
            <QRCodeCanvas value={item.token} size={110} level="H" />
            <p className="font-semibold text-sm mt-1 leading-tight">{item.nama}</p>
            {item.info1 && <p className="text-xs">{item.info1}</p>}
            {item.info2 && <p className="text-xs">{item.info2}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
