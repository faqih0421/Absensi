import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await db.pelanggaran.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    // P2025: record tidak ditemukan
    return prismaErrorResponse(e, {
      notFound: 'Data tidak ditemukan',
      fallback: 'Gagal menghapus data',
    })
  }
}
