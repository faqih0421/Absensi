import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { Prisma } from '@prisma/client'

export async function GET() {
  try {
    const kelas = await db.kelas.findMany({
      include: {
        walikelas: true,
        _count: { select: { siswa: true } },
      },
      orderBy: { namaKelas: 'asc' },
    })
    return NextResponse.json(kelas)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data kelas' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    // Validasi field wajib
    if (!data.namaKelas || String(data.namaKelas).trim() === '') {
      return NextResponse.json({ error: 'Nama kelas wajib diisi' }, { status: 400 })
    }
    if (!data.tingkat || String(data.tingkat).trim() === '') {
      return NextResponse.json({ error: 'Tingkat wajib diisi' }, { status: 400 })
    }
    // Validasi guru wali kelas bila dikirim
    if (data.walikelasId) {
      const guru = await db.guru.findUnique({ where: { id: data.walikelasId } })
      if (!guru) {
        return NextResponse.json({ error: 'Guru wali kelas tidak ditemukan' }, { status: 400 })
      }
    }
    const kelas = await db.kelas.create({
      data: {
        namaKelas: data.namaKelas,
        tingkat: data.tingkat,
        jurusan: data.jurusan || null,
        walikelasId: data.walikelasId || null,
      },
      include: { walikelas: true },
    })
    return NextResponse.json(kelas)
  } catch (e) {
    // P2002: namaKelas unik ATAU walikelasId unik (satu guru hanya satu wali kelas)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = (e.meta?.target as string[] | string | undefined) || []
      const cols = Array.isArray(target) ? target : [String(target)]
      if (cols.some((c) => c.includes('walikelas'))) {
        return NextResponse.json({ error: 'Guru tersebut sudah menjadi wali kelas lain' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Nama kelas sudah ada' }, { status: 409 })
    }
    return prismaErrorResponse(e, {
      duplicate: 'Nama kelas sudah ada',
      relation: 'Guru wali kelas tidak ditemukan',
      fallback: 'Gagal menambahkan kelas',
    })
  }
}
