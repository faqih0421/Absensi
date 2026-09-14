import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { requireAuth } from '@/lib/auth-server'

// Key pengaturan yang boleh disimpan (whitelist) — selaras dengan yang
// dipakai UI Pengaturan, Login, dan Dashboard
const KEY_DIIZINKAN = new Set([
  'nama_sekolah',
  'npsn',
  'alamat_sekolah',
  'telepon_sekolah',
  'email_sekolah',
  'kepala_sekolah',
  'jam_masuk',
  'jam_terlambat',
  'jam_pulang',
  'tahun_ajaran',
  'semester',
  'kkm',
  'logo_sekolah',
  'bg_login',
])

export async function GET() {
  try {
    const pengaturan = await db.pengaturan.findMany()
    // Convert to object
    const obj: Record<string, string> = {}
    for (const p of pengaturan) obj[p.key] = p.value
    return NextResponse.json(obj)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat pengaturan' })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if (auth.error) return auth.error
  try {
    const data = await req.json()
    // Harus object (bukan null/array)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json({ error: 'Data pengaturan tidak valid' }, { status: 400 })
    }
    // Hanya key yang dikenal yang di-upsert
    const entries = Object.entries(data).filter(([key]) => KEY_DIIZINKAN.has(key))
    // Validasi format jam (key berawalan 'jam_')
    for (const [key, value] of entries) {
      if (key.startsWith('jam_') && !/^\d{1,2}:\d{2}$/.test(String(value ?? ''))) {
        return NextResponse.json({ error: 'Format jam harus HH:mm' }, { status: 400 })
      }
    }
    // Nilai harus string — konversi bila bukan string
    const updates = await Promise.all(
      entries.map(([key, value]) => {
        const val = typeof value === 'string' ? value : String(value ?? '')
        return db.pengaturan.upsert({
          where: { key },
          update: { value: val },
          create: { key, value: val },
        })
      })
    )
    return NextResponse.json({ updated: updates.length })
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal menyimpan pengaturan' })
  }
}
