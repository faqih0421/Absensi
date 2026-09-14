// Helper tanggal untuk zona WIB (Asia/Jakarta) — sisi SERVER.
// Tidak bergantung pada timezone mesin server (bisa UTC maupun lainnya).

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

// Kunci tanggal 'YYYY-MM-DD' zona WIB dari sebuah Date
export function wibDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

// Menit sejak tengah malam WIB (0..1439) dari sebuah Date
export function wibTimeMinutes(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const h = Number(parts.find((p) => p.type === 'hour')?.value || '0')
  const m = Number(parts.find((p) => p.type === 'minute')?.value || '0')
  return h * 60 + m
}

// Batas awal & akhir hari WIB (Objek Date UTC) untuk kunci 'YYYY-MM-DD'
export function wibDayRange(dateKey: string): { start: Date; end: Date } {
  const [y, m, d] = dateKey.split('-').map(Number)
  const startMs =
    Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0) - WIB_OFFSET_MS
  return {
    start: new Date(startMs),
    end: new Date(startMs + 24 * 60 * 60 * 1000 - 1),
  }
}

// Parse string 'YYYY-MM-DD' sebagai tanggal WIB (tengah hari, aman untuk filter)
export function parseDateOnlyWIB(s: string): Date {
  const { start, end } = wibDayRange(s)
  return new Date((start.getTime() + end.getTime()) / 2)
}

// Validasi & normalisasi jam 'HH:mm' -> menit; null bila tidak valid
export function parseJamToMinutes(s: string | undefined | null): number | null {
  if (!s || !/^\d{1,2}:\d{2}$/.test(s.trim())) return null
  const [h, m] = s.trim().split(':').map(Number)
  if (h > 23 || m > 59) return null
  return h * 60 + m
}
