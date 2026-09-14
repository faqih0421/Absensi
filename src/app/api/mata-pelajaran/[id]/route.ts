import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'

const HARI_URUTAN = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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
    const mapel = await db.mataPelajaran.update({
      where: { id },
      data: {
        nama: data.nama,
        guruId: data.guruId,
        jam: data.jam || '',
        hari,
      },
    })
    return NextResponse.json(mapel)
  } catch (e) {
    return prismaErrorResponse(e, {
      relation: 'Guru tidak ditemukan',
      notFound: 'Mata pelajaran tidak ditemukan',
      fallback: 'Gagal memperbarui mata pelajaran',
    })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await db.mataPelajaran.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    // P2003: data masih direferensikan tabel lain (jaga-jaga)
    return prismaErrorResponse(e, {
      relation: 'Data masih terhubung dengan data lain',
      notFound: 'Data tidak ditemukan',
      fallback: 'Gagal menghapus data',
    })
  }
}
