import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guru = await db.guru.findUnique({ where: { id }, include: { kelasWali: true, mataPelajaran: true } })
    if (!guru) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    return NextResponse.json(guru)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data guru' })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await req.json()
    // Validasi field wajib
    if (!data.nip || String(data.nip).trim() === '') {
      return NextResponse.json({ error: 'NIP wajib diisi' }, { status: 400 })
    }
    if (!data.nama || String(data.nama).trim() === '') {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    }
    const guru = await db.guru.update({
      where: { id },
      data: {
        nip: data.nip,
        nama: data.nama,
        jenisKelamin: data.jenisKelamin,
        role: data.role,
        telepon: data.telepon,
        alamat: data.alamat,
      },
    })
    return NextResponse.json(guru)
  } catch (e) {
    return prismaErrorResponse(e, {
      duplicate: 'NIP sudah dipakai guru lain',
      notFound: 'Guru tidak ditemukan',
      fallback: 'Gagal memperbarui guru',
    })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await db.guru.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    // P2003: guru masih mengampu mata pelajaran (relasi MataPelajaran.guru tanpa cascade)
    return prismaErrorResponse(e, {
      relation: 'Guru masih mengampu mata pelajaran. Pindahkan mapel ke guru lain atau hapus mapel terlebih dahulu.',
      notFound: 'Data tidak ditemukan',
      fallback: 'Gagal menghapus data',
    })
  }
}
