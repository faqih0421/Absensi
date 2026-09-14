import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { parseDateOnlyWIB } from '@/lib/wib'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const siswaId = searchParams.get('siswaId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const where: any = {}
    if (siswaId) where.siswaId = siswaId
    if (start && end) {
      where.tanggal = { gte: new Date(start), lte: new Date(end) }
    }
    const pel = await db.pelanggaran.findMany({
      where,
      include: { siswa: { include: { kelas: true } }, jenisPelanggaran: true },
      orderBy: { tanggal: 'desc' },
    })
    return NextResponse.json(pel)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data pelanggaran' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    // Validasi field wajib + keberadaan data terkait
    if (!data.siswaId) {
      return NextResponse.json({ error: 'Siswa wajib dipilih' }, { status: 400 })
    }
    if (!data.jenisPelanggaranId) {
      return NextResponse.json({ error: 'Jenis pelanggaran wajib dipilih' }, { status: 400 })
    }
    const siswa = await db.siswa.findFirst({ where: { id: data.siswaId } })
    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 400 })
    }
    const jenis = await db.jenisPelanggaran.findFirst({ where: { id: data.jenisPelanggaranId } })
    if (!jenis) {
      return NextResponse.json({ error: 'Jenis pelanggaran tidak ditemukan' }, { status: 400 })
    }
    // Tanggal: 'YYYY-MM-DD' diparse sebagai WIB (bukan UTC)
    let tanggal: Date
    if (data.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(String(data.tanggal))) {
      tanggal = parseDateOnlyWIB(String(data.tanggal))
    } else if (data.tanggal) {
      tanggal = new Date(data.tanggal)
    } else {
      tanggal = new Date()
    }
    const pel = await db.pelanggaran.create({
      data: {
        siswaId: data.siswaId,
        jenisPelanggaranId: data.jenisPelanggaranId,
        tanggal,
        catatan: data.catatan || null,
      },
      include: { siswa: { include: { kelas: true } }, jenisPelanggaran: true },
    })
    return NextResponse.json(pel)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal mencatat pelanggaran' })
  }
}
