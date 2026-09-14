import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'

// Urutan hari mengajar (Senin-Jumat) untuk pengurutan daftar mapel
export const HARI_URUTAN = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']

export async function GET() {
  try {
    const mapel = await db.mataPelajaran.findMany({
      include: { guru: true },
      orderBy: { nama: 'asc' },
    })
    // Urutkan berdasarkan hari (Senin->Jumat), lalu jam mulai, lalu nama
    mapel.sort((a, b) => {
      const ha = HARI_URUTAN.indexOf(a.hari)
      const hb = HARI_URUTAN.indexOf(b.hari)
      if (ha !== hb) return ha - hb
      return (a.jam || '').localeCompare(b.jam || '') || a.nama.localeCompare(b.nama)
    })
    return NextResponse.json(mapel)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data mata pelajaran' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    // Validasi field wajib
    if (!data.nama || String(data.nama).trim() === '') {
      return NextResponse.json({ error: 'Nama mata pelajaran wajib diisi' }, { status: 400 })
    }
    if (!data.guruId) {
      return NextResponse.json({ error: 'Guru wajib dipilih' }, { status: 400 })
    }
    // Whitelist hari mengajar
    const hari = data.hari || 'Senin'
    if (!HARI_URUTAN.includes(hari)) {
      return NextResponse.json({ error: 'Hari harus Senin, Selasa, Rabu, Kamis, atau Jumat' }, { status: 400 })
    }
    const mapel = await db.mataPelajaran.create({
      data: {
        nama: data.nama,
        guruId: data.guruId,
        jam: data.jam || '',
        hari,
      },
      include: { guru: true },
    })
    return NextResponse.json(mapel)
  } catch (e) {
    return prismaErrorResponse(e, {
      relation: 'Guru tidak ditemukan',
      fallback: 'Gagal menambahkan mata pelajaran',
    })
  }
}
