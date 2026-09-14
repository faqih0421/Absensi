import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { parseDateOnlyWIB } from '@/lib/wib'

const JENIS_NILAI_VALID = ['harian', 'tugas', 'uts', 'uas']

// Nilai harus angka 0..100; return number atau null bila tidak valid
function parseNilai(v: any): number | null {
  const n = Number(v)
  if (Number.isNaN(n) || n < 0 || n > 100) return null
  return n
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mapelId = searchParams.get('mapelId')
    const siswaId = searchParams.get('siswaId')
    const where: any = {}
    if (mapelId) where.mataPelajaranId = mapelId
    if (siswaId) where.siswaId = siswaId
    const nilai = await db.nilai.findMany({
      where,
      include: { siswa: { include: { kelas: true } }, mataPelajaran: true },
      orderBy: { tanggal: 'desc' },
    })
    return NextResponse.json(nilai)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data nilai' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    if (data.records && Array.isArray(data.records)) {
      // Mode batch: mapelId wajib + setiap baris wajib siswaId & nilai valid
      if (!data.mapelId) {
        return NextResponse.json({ error: 'Mata pelajaran wajib dipilih' }, { status: 400 })
      }
      const rows: { siswaId: string; jenisNilai: string; nilai: number }[] = []
      for (let i = 0; i < data.records.length; i++) {
        const r = data.records[i]
        if (!r.siswaId) {
          return NextResponse.json({ error: `Baris ${i + 1}: siswaId wajib diisi` }, { status: 400 })
        }
        const jenis = r.jenisNilai || data.jenisNilai || 'harian'
        if (!JENIS_NILAI_VALID.includes(jenis)) {
          return NextResponse.json({ error: `Baris ${i + 1}: jenis nilai tidak valid` }, { status: 400 })
        }
        const n = parseNilai(r.nilai)
        if (n === null) {
          return NextResponse.json({ error: `Baris ${i + 1}: nilai harus angka 0-100` }, { status: 400 })
        }
        rows.push({ siswaId: r.siswaId, jenisNilai: jenis, nilai: n })
      }
      // Tanggal 'YYYY-MM-DD' diparse sebagai WIB
      const tanggalBatch = data.tanggal
        ? /^\d{4}-\d{2}-\d{2}$/.test(String(data.tanggal))
          ? parseDateOnlyWIB(String(data.tanggal))
          : new Date(data.tanggal)
        : new Date()
      const created = await db.$transaction(
        rows.map((r) =>
          db.nilai.create({
            data: {
              siswaId: r.siswaId,
              mataPelajaranId: data.mapelId,
              jenisNilai: r.jenisNilai,
              nilai: r.nilai,
              tanggal: tanggalBatch,
            },
          })
        )
      )
      return NextResponse.json({ created: created.length })
    }

    // Mode single
    if (!data.siswaId) {
      return NextResponse.json({ error: 'Siswa wajib dipilih' }, { status: 400 })
    }
    if (!data.mapelId) {
      return NextResponse.json({ error: 'Mata pelajaran wajib dipilih' }, { status: 400 })
    }
    const jenisNilai = data.jenisNilai || 'harian'
    if (!JENIS_NILAI_VALID.includes(jenisNilai)) {
      return NextResponse.json({ error: 'Jenis nilai tidak valid' }, { status: 400 })
    }
    const nilaiNum = parseNilai(data.nilai)
    if (nilaiNum === null) {
      return NextResponse.json({ error: 'Nilai harus angka 0-100' }, { status: 400 })
    }
    const tanggal =
      data.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(String(data.tanggal))
        ? parseDateOnlyWIB(String(data.tanggal))
        : data.tanggal
          ? new Date(data.tanggal)
          : new Date()
    const nilai = await db.nilai.create({
      data: {
        siswaId: data.siswaId,
        mataPelajaranId: data.mapelId,
        jenisNilai,
        nilai: nilaiNum,
        tanggal,
      },
    })
    return NextResponse.json(nilai)
  } catch (e) {
    return prismaErrorResponse(e, {
      relation: 'Siswa atau mata pelajaran tidak ditemukan',
      fallback: 'Gagal menyimpan nilai',
    })
  }
}
