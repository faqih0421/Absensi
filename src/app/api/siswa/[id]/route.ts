import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const siswa = await db.siswa.findUnique({ where: { id }, include: { kelas: true } })
    if (!siswa) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    return NextResponse.json(siswa)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data siswa' })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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
    // tanggalLahir: JANGAN dipaksa null bila tidak dikirim — hanya set bila ada
    let tanggalLahir: Date | null | undefined = undefined
    if (data.tanggalLahir !== undefined) {
      if (data.tanggalLahir === null || data.tanggalLahir === '') {
        tanggalLahir = null
      } else {
        tanggalLahir = new Date(data.tanggalLahir)
        if (isNaN(tanggalLahir.getTime())) {
          return NextResponse.json({ error: 'Tanggal lahir tidak valid' }, { status: 400 })
        }
      }
    }
    const siswa = await db.siswa.update({
      where: { id },
      data: {
        nis: data.nis,
        // Normalisasi string kosong -> null
        nisn: data.nisn === '' ? null : data.nisn,
        nama: data.nama,
        jenisKelamin: data.jenisKelamin,
        kelasId: data.kelasId,
        telepon: data.telepon === '' ? null : data.telepon,
        alamat: data.alamat === '' ? null : data.alamat,
        tempatLahir: data.tempatLahir === '' ? null : data.tempatLahir,
        ...(tanggalLahir !== undefined ? { tanggalLahir } : {}),
      },
      include: { kelas: true },
    })
    return NextResponse.json(siswa)
  } catch (e) {
    return prismaErrorResponse(e, {
      duplicate: 'NIS sudah terdaftar',
      relation: 'Kelas tidak ditemukan',
      notFound: 'Siswa tidak ditemukan',
      fallback: 'Gagal memperbarui siswa',
    })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await db.siswa.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    // P2003: siswa masih direferensikan tabel lain; P2025: record tidak ada
    return prismaErrorResponse(e, {
      relation: 'Data masih terhubung dengan data lain',
      notFound: 'Data tidak ditemukan',
      fallback: 'Gagal menghapus data',
    })
  }
}
