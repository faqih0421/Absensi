import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { Prisma } from '@prisma/client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const kelas = await db.kelas.findUnique({
      where: { id },
      include: { walikelas: true, siswa: true },
    })
    if (!kelas) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    return NextResponse.json(kelas)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data kelas' })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await req.json()
    // Validasi field wajib
    if (!data.namaKelas || String(data.namaKelas).trim() === '') {
      return NextResponse.json({ error: 'Nama kelas wajib diisi' }, { status: 400 })
    }
    if (!data.tingkat || String(data.tingkat).trim() === '') {
      return NextResponse.json({ error: 'Tingkat wajib diisi' }, { status: 400 })
    }
    // Validasi guru wali kelas bila dikirim (P2003 guard: walikelasId tidak eksis)
    if (data.walikelasId) {
      const guru = await db.guru.findUnique({ where: { id: data.walikelasId } })
      if (!guru) {
        return NextResponse.json({ error: 'Guru wali kelas tidak ditemukan' }, { status: 400 })
      }
    }
    const kelas = await db.kelas.update({
      where: { id },
      data: {
        namaKelas: data.namaKelas,
        tingkat: data.tingkat,
        jurusan: data.jurusan,
        walikelasId: data.walikelasId || null,
      },
    })
    return NextResponse.json(kelas)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return NextResponse.json({ error: 'Guru wali kelas tidak ditemukan' }, { status: 400 })
    }
    return prismaErrorResponse(e, {
      duplicate: 'Nama kelas sudah ada',
      notFound: 'Kelas tidak ditemukan',
      fallback: 'Gagal memperbarui kelas',
    })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await db.kelas.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    // P2003: masih ada siswa di kelas ini (relasi Siswa.kelas tanpa cascade)
    return prismaErrorResponse(e, {
      relation: 'Kelas masih memiliki siswa. Pindahkan atau hapus siswa terlebih dahulu.',
      notFound: 'Data tidak ditemukan',
      fallback: 'Gagal menghapus data',
    })
  }
}
