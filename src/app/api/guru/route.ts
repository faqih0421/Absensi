import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const where: any = {}
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nip: { contains: search } },
      ]
    }
    const guru = await db.guru.findMany({
      where,
      include: { kelasWali: true, _count: { select: { mataPelajaran: true } } },
      orderBy: { nama: 'asc' },
    })
    return NextResponse.json(guru)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data guru' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    // Validasi field wajib
    if (!data.nip || String(data.nip).trim() === '') {
      return NextResponse.json({ error: 'NIP wajib diisi' }, { status: 400 })
    }
    if (!data.nama || String(data.nama).trim() === '') {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    }
    const guru = await db.guru.create({
      data: {
        nip: data.nip,
        nama: data.nama,
        jenisKelamin: data.jenisKelamin || 'L',
        role: data.role || 'guru',
        telepon: data.telepon || null,
        alamat: data.alamat || null,
      },
    })
    return NextResponse.json(guru)
  } catch (e) {
    return prismaErrorResponse(e, { duplicate: 'NIP sudah dipakai guru lain', fallback: 'Gagal menambahkan guru' })
  }
}
