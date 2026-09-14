import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'

const KATEGORI_VALID = ['ringan', 'sedang', 'berat']

export async function GET() {
  try {
    const jp = await db.jenisPelanggaran.findMany({
      include: { _count: { select: { pelanggaran: true } } },
      orderBy: { kategori: 'asc' },
    })
    return NextResponse.json(jp)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data jenis pelanggaran' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    // Validasi field wajib
    if (!data.nama || String(data.nama).trim() === '') {
      return NextResponse.json({ error: 'Nama jenis pelanggaran wajib diisi' }, { status: 400 })
    }
    // Poin: number 0..1000 (coerce Number, NaN -> 400)
    const poin = data.poin === undefined || data.poin === null || data.poin === '' ? 0 : Number(data.poin)
    if (Number.isNaN(poin) || poin < 0 || poin > 1000) {
      return NextResponse.json({ error: 'Poin harus angka 0-1000' }, { status: 400 })
    }
    // Whitelist kategori
    const kategori = data.kategori || 'ringan'
    if (!KATEGORI_VALID.includes(kategori)) {
      return NextResponse.json({ error: 'Kategori harus ringan, sedang, atau berat' }, { status: 400 })
    }
    const jp = await db.jenisPelanggaran.create({
      data: {
        nama: data.nama,
        poin,
        kategori,
      },
    })
    return NextResponse.json(jp)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal menambahkan jenis pelanggaran' })
  }
}
