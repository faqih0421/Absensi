import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const kelasId = searchParams.get('kelasId')
    const search = searchParams.get('search')
    const where: any = {}
    if (kelasId) where.kelasId = kelasId
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nis: { contains: search } },
        { nisn: { contains: search } },
      ]
    }
    const siswa = await db.siswa.findMany({
      where,
      include: { kelas: true },
      orderBy: { nama: 'asc' },
    })
    return NextResponse.json(siswa)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data siswa' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    // Validasi field wajib
    if (!data.nis || String(data.nis).trim() === '') {
      return NextResponse.json({ error: 'NIS wajib diisi' }, { status: 400 })
    }
    if (!data.nama || String(data.nama).trim() === '') {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    }
    if (!data.kelasId) {
      return NextResponse.json({ error: 'Kelas wajib dipilih' }, { status: 400 })
    }
    // Validasi tanggal lahir bila dikirim
    let tanggalLahir: Date | null = null
    if (data.tanggalLahir) {
      tanggalLahir = new Date(data.tanggalLahir)
      if (isNaN(tanggalLahir.getTime())) {
        return NextResponse.json({ error: 'Tanggal lahir tidak valid' }, { status: 400 })
      }
    }
    const siswa = await db.siswa.create({
      data: {
        nis: data.nis,
        nisn: data.nisn || null,
        nama: data.nama,
        jenisKelamin: data.jenisKelamin || 'L',
        kelasId: data.kelasId,
        telepon: data.telepon || null,
        alamat: data.alamat || null,
        tempatLahir: data.tempatLahir || null,
        tanggalLahir,
      },
      include: { kelas: true },
    })
    return NextResponse.json(siswa)
  } catch (e) {
    return prismaErrorResponse(e, {
      duplicate: 'NIS sudah terdaftar',
      relation: 'Kelas tidak ditemukan',
      fallback: 'Gagal menambahkan siswa',
    })
  }
}
