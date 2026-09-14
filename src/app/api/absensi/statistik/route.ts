import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { wibDateKey, wibDayRange } from '@/lib/wib'

// GET /api/absensi/statistik?kelasId=&siswaId=&bulan=YYYY-MM
// Mengembalikan rekap frekuensi per siswa untuk peringatan dini:
//  - terlambat : jumlah absensi harian (check-in) status 'terlambat' dalam bulan tsb
//  - alpha     : jumlah absensi mata pelajaran status 'alpha' dalam bulan tsb
// Dipakai UI untuk memberi peringatan bila melebihi batas (mis. lebih dari 3x).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const kelasId = searchParams.get('kelasId')
    const siswaId = searchParams.get('siswaId')
    const bulanParam = searchParams.get('bulan') // format YYYY-MM

    // Tentukan rentang bulan WIB (default: bulan berjalan WIB)
    let bulanKey = wibDateKey().slice(0, 7)
    if (bulanParam) {
      if (!/^\d{4}-\d{2}$/.test(bulanParam)) {
        return NextResponse.json({ error: 'Parameter bulan tidak valid' }, { status: 400 })
      }
      bulanKey = bulanParam
    }
    const [y, m] = bulanKey.split('-').map(Number)
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const mulai = wibDayRange(`${bulanKey}-01`).start
    const sampai = wibDayRange(`${bulanKey}-${String(lastDay).padStart(2, '0')}`).end

    // Daftar siswa yang relevan
    const siswaWhere: any = {}
    if (kelasId) siswaWhere.kelasId = kelasId
    if (siswaId) siswaWhere.id = siswaId

    const siswaList = await db.siswa.findMany({
      where: siswaWhere,
      include: { kelas: true },
      orderBy: { nama: 'asc' },
    })

    const ids = siswaList.map(s => s.id)
    const rentangTanggal = { gte: mulai, lte: sampai }

    type GroupRow = { siswaId: string; _count: { _all: number } }
    const emptyGroup: GroupRow[] = []
    const [terlambatGroup, alphaGroup] = await Promise.all([
      ids.length
        ? db.absensi.groupBy({
            by: ['siswaId'],
            where: { siswaId: { in: ids }, jenis: 'checkin', status: 'terlambat', tanggal: rentangTanggal },
            _count: { _all: true },
          })
        : Promise.resolve(emptyGroup),
      ids.length
        ? db.absensiMapel.groupBy({
            by: ['siswaId'],
            where: { siswaId: { in: ids }, status: 'alpha', tanggal: rentangTanggal },
            _count: { _all: true },
          })
        : Promise.resolve(emptyGroup),
    ])

    const terlambatMap = new Map(terlambatGroup.map(g => [g.siswaId, g._count._all]))
    const alphaMap = new Map(alphaGroup.map(g => [g.siswaId, g._count._all]))

    return NextResponse.json({
      bulan: bulanKey,
      batasPeringatan: 3,
      data: siswaList.map(s => ({
        siswaId: s.id,
        nama: s.nama,
        nis: s.nis,
        kelas: s.kelas?.namaKelas || null,
        terlambat: terlambatMap.get(s.id) || 0,
        alpha: alphaMap.get(s.id) || 0,
      })),
    })
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat statistik absensi' })
  }
}
