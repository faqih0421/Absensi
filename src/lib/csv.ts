// Utilitas CSV: parsing, normalisasi, dan download template
// Mendukung pemisah koma (,) dan titik koma (;), kutip ganda, dan BOM Excel

/** Parse teks CSV menjadi array baris (array kolom) */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '') // hapus BOM Excel

  // Deteksi pemisah dari baris pertama yang tidak kosong
  const firstLine = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== '') || ''
  const delimiter =
    (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ','

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  row.push(field)
  rows.push(row)

  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Normalisasi header CSV: lowercase, trim, spasi -> underscore */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_')
}

/** Normalisasi jenis kelamin: terima L / P / Laki-laki / Perempuan dll */
export function normalizeJk(v: string): 'L' | 'P' | null {
  const s = (v || '').trim().toUpperCase()
  if (['L', 'LK', 'LAKI-LAKI', 'LAKI LAKI', 'LAKI', 'M', 'MALE', 'PRIA'].includes(s)) return 'L'
  if (['P', 'PR', 'PEREMPUAN', 'F', 'FEMALE', 'WANITA'].includes(s)) return 'P'
  return null
}

/** Normalisasi role guru: guru | kepala_sekolah | admin */
export function normalizeRole(v: string): string | null {
  const s = (v || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (!s) return null
  if (['guru', 'kepala_sekolah', 'admin'].includes(s)) return s
  return null
}

/** Normalisasi tanggal: terima YYYY-MM-DD atau DD/MM/YYYY (dan pemisah . -) */
export function normalizeTanggal(v: string): string | null {
  const s = (v || '').trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/** Escape satu field CSV (bungkus dengan kutip ganda jika berisi koma/titik koma/quote/baris baru) */
export function escapeField(v: string): string {
  return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Unduh file CSV template (dengan BOM agar aman dibuka Excel) */
export function downloadCsvTemplate(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows].map((r) => r.map(escapeField).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
