import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { wibDateKey, wibDayRange } from '@/lib/wib'

const STATUS_VALID = ['hadir', 'terlambat', 'izin', 'sakit', 'alpha']
const JENIS_VALID = ['checkin', 'checkout']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tanggal = searchParams.get('tanggal')
    const guruId = searchParams.get('guruId')
    const where: any = {}
    if (guruId) where.guruId = guruId
    if (tanggal) {
      // 'YYYY-MM-DD' diparse sebagai rentang hari WIB
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        return NextResponse.json({ error: 'Parameter tanggal tidak valid' }, { status: 400 })
      }
      const { start, end } = wibDayRange(tanggal)
      where.tanggal = { gte: start, lte: end }
    }
    const absen = await db.absensiGuru.findMany({
      where,
      include: { guru: true },
      orderBy: { waktu: 'desc' },
    })
    return NextResponse.json(absen)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data absensi guru' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()

    // WAJIB guruId
    if (!data.guruId) {
      return NextResponse.json({ error: 'Guru wajib dipilih' }, { status: 400 })
    }
    const jenis = data.jenis || 'checkin'
    if (!JENIS_VALID.includes(jenis)) {
      return NextResponse.json({ error: 'Jenis absensi tidak valid' }, { status: 400 })
    }
    const status = String(data.status || 'hadir').toLowerCase().trim()
    if (!STATUS_VALID.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const now = new Date()
    // Rentang hari WIB berjalan (bukan setHours yang tergantung TZ server)
    const { start, end } = wibDayRange(wibDateKey(now))

    // Cek duplikat + create dalam transaksi (cegah race):
    // satu 'checkin' per guru per hari WIB & satu 'checkout' per guru per hari WIB
    let sudahAda = false
    const absen = await db.$transaction(async (tx) => {
      const existing = await tx.absensiGuru.findFirst({
        where: {
          guruId: data.guruId,
          jenis,
          tanggal: { gte: start, lte: end },
        },
      })
      if (existing) {
        sudahAda = true
        return null
      }
      return tx.absensiGuru.create({
        data: {
          guruId: data.guruId,
          jenis,
          status,
          tanggal: now,
          waktu: now,
          catatan: data.catatan || null,
        },
        include: { guru: true },
      })
    })

    if (sudahAda) {
      const pesan = jenis === 'checkin' ? 'Guru sudah check-in hari ini' : 'Guru sudah check-out hari ini'
      return NextResponse.json({ error: pesan }, { status: 409 })
    }

    return NextResponse.json(absen)
  } catch (e) {
    return prismaErrorResponse(e, {
      relation: 'Guru tidak ditemukan',
      fallback: 'Gagal menyimpan absensi guru',
    })
  }
}
