import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

// Pemetaan error Prisma menjadi respons JSON ramah (Bahasa Indonesia).
// Dipakai semua route API agar pesan error konsisten & tidak membocorkan
// detail internal server ke client.
export function prismaErrorResponse(
  e: unknown,
  opts: {
    duplicate?: string
    relation?: string
    notFound?: string
    fallback?: string
  } = {}
) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      return NextResponse.json(
        { error: opts.duplicate || 'Data sudah ada (duplikat)' },
        { status: 409 }
      )
    }
    if (e.code === 'P2003') {
      return NextResponse.json(
        { error: opts.relation || 'Data terkait tidak valid / masih dipakai' },
        { status: 409 }
      )
    }
    if (e.code === 'P2025') {
      return NextResponse.json(
        { error: opts.notFound || 'Data tidak ditemukan' },
        { status: 404 }
      )
    }
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      { error: 'Data yang dikirim tidak lengkap atau tidak valid' },
      { status: 400 }
    )
  }
  console.error('API error:', e)
  return NextResponse.json(
    { error: opts.fallback || 'Terjadi kesalahan server' },
    { status: 500 }
  )
}
