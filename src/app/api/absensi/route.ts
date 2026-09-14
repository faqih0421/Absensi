import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { wibDateKey, wibDayRange, parseDateOnlyWIB } from '@/lib/wib'

const STATUS_VALID = ['hadir', 'terlambat', 'izin', 'sakit', 'alpha']
const JENIS_VALID = ['checkin', 'checkout']

// GET /api/absensi?tanggal=&siswaId=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tanggal = searchParams.get('tanggal')
    const siswaId = searchParams.get('siswaId')
    const where: any = {}
    if (siswaId) where.siswaId = siswaId
    if (tanggal) {
      // 'YYYY-MM-DD' diparse sebagai rentang hari WIB (bukan new Date(string) yang UTC)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        return NextResponse.json({ error: 'Parameter tanggal tidak valid' }, { status: 400 })
      }
      const { start, end } = wibDayRange(tanggal)
      where.tanggal = { gte: start, lte: end }
    }
    const absen = await db.absensi.findMany({
      where,
      include: { siswa: { include: { kelas: true } } },
      orderBy: { waktu: 'desc' },
    })
    return NextResponse.json(absen)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data absensi' })
  }
}

// POST /api/absensi - input absensi harian manual
export async function POST(req: NextRequest) {
  try {
    const data = await req.json()

    // WAJIB siswaId (undefined di where Prisma bisa menyebabkan update record siswa lain!)
    if (!data.siswaId) {
      return NextResponse.json({ error: 'Siswa wajib dipilih' }, { status: 400 })
    }

    // Whitelist jenis & status (normalisasi lowercase-trim)
    const jenis = data.jenis || 'checkin'
    if (!JENIS_VALID.includes(jenis)) {
      return NextResponse.json({ error: 'Jenis absensi tidak valid' }, { status: 400 })
    }
    const status = String(data.status || 'hadir').toLowerCase().trim()
    if (!STATUS_VALID.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    // Tanggal: 'YYYY-MM-DD' diparse sebagai WIB; kosong -> sekarang
    let base: Date
    if (data.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(String(data.tanggal))) {
      base = parseDateOnlyWIB(String(data.tanggal))
    } else if (data.tanggal) {
      base = new Date(data.tanggal)
    } else {
      base = new Date()
    }
    // Rentang hari WIB untuk deteksi duplikat
    const { start, end } = wibDayRange(wibDateKey(base))
    const keterlambatan = Number(data.keterlambatan) || 0

    // Upsert dalam transaksi (cegah race duplikat): jika sudah ada record
    // siswa + jenis + hari WIB yang sama, update; jika belum, create
    const absen = await db.$transaction(async (tx) => {
      const existing = await tx.absensi.findFirst({
        where: {
          siswaId: data.siswaId,
          jenis,
          tanggal: { gte: start, lte: end },
        },
      })
      if (existing) {
        return tx.absensi.update({
          where: { id: existing.id },
          data: {
            status,
            waktu: new Date(),
            keterlambatan,
            catatan: data.catatan || null,
          },
          include: { siswa: { include: { kelas: true } } },
        })
      }
      return tx.absensi.create({
        data: {
          siswaId: data.siswaId,
          jenis,
          status,
          tanggal: base,
          waktu: new Date(),
          keterlambatan,
          catatan: data.catatan || null,
        },
        include: { siswa: { include: { kelas: true } } },
      })
    })

    return NextResponse.json(absen)
  } catch (e) {
    return prismaErrorResponse(e, {
      relation: 'Siswa tidak ditemukan',
      fallback: 'Gagal menyimpan absensi',
    })
  }
}
