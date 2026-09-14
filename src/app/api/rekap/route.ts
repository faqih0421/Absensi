import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { wibDateKey, wibDayRange } from '@/lib/wib'

// Rentang 1 bulan WIB dari kunci 'YYYY-MM'
function rentangBulanWIB(bulan: string) {
  const [y, m] = bulan.split('-').map(Number)
  const start = wibDayRange(`${bulan}-01`).start
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = wibDayRange(`${bulan}-${String(lastDay).padStart(2, '0')}`).end
  return { start, end }
}

// GET /api/rekap?bulan=YYYY-MM&kelasId=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const bulan = searchParams.get('bulan') // YYYY-MM
    const kelasId = searchParams.get('kelasId')

    if (!bulan) return NextResponse.json({ error: 'Parameter bulan wajib' }, { status: 400 })
    if (!/^\d{4}-\d{2}$/.test(bulan)) {
      return NextResponse.json({ error: 'Parameter bulan tidak valid' }, { status: 400 })
    }

    const { start, end } = rentangBulanWIB(bulan)

    const siswaWhere: any = {}
    if (kelasId) siswaWhere.kelasId = kelasId

    const siswaList = await db.siswa.findMany({
      where: siswaWhere,
      include: { kelas: true },
      orderBy: { nama: 'asc' },
    })

    const ids = siswaList.map(s => s.id)

    // Tanpa N+1: ambil SEMUA absensi & pelanggaran sebulan sekaligus, agregasi di JS
    const [absenList, pelanggaranList] = ids.length
      ? await Promise.all([
          db.absensi.findMany({
            where: {
              siswaId: { in: ids },
              jenis: 'checkin',
              tanggal: { gte: start, lte: end },
            },
          }),
          db.pelanggaran.findMany({
            where: { siswaId: { in: ids }, tanggal: { gte: start, lte: end } },
            include: { jenisPelanggaran: true },
          }),
        ])
      : [[], []]

    // Hari sekolah = jumlah tanggal unik (WIB) yang memiliki record absensi
    // checkin milik siswa mana pun pada bulan itu (selaras dengan dashboard)
    const hariSekolahSet = new Set<string>()
    for (const a of absenList) {
      hariSekolahSet.add(wibDateKey(new Date(a.tanggal)))
    }
    const hariSekolah = hariSekolahSet.size

    // Agregasi absensi per siswa
    const absenPerSiswa = new Map<string, { hadir: number; terlambat: number; izin: number; sakit: number }>()
    for (const a of absenList) {
      const c = absenPerSiswa.get(a.siswaId) || { hadir: 0, terlambat: 0, izin: 0, sakit: 0 }
      if (a.status === 'hadir') c.hadir++
      else if (a.status === 'terlambat') c.terlambat++
      else if (a.status === 'izin') c.izin++
      else if (a.status === 'sakit') c.sakit++
      absenPerSiswa.set(a.siswaId, c)
    }

    // Agregasi pelanggaran per siswa
    const pelPerSiswa = new Map<string, { count: number; poin: number }>()
    for (const p of pelanggaranList) {
      const c = pelPerSiswa.get(p.siswaId) || { count: 0, poin: 0 }
      c.count++
      c.poin += p.jenisPelanggaran?.poin || 0
      pelPerSiswa.set(p.siswaId, c)
    }

    const rekap = siswaList.map((s) => {
      const c = absenPerSiswa.get(s.id) || { hadir: 0, terlambat: 0, izin: 0, sakit: 0 }
      // Alpha = hari sekolah berjalan dikurangi yang tercatat izin/sakit/hadir/terlambat
      const alpha = Math.max(0, hariSekolah - (c.hadir + c.terlambat + c.izin + c.sakit))
      const pl = pelPerSiswa.get(s.id) || { count: 0, poin: 0 }
      return {
        siswa: { id: s.id, nis: s.nis, nama: s.nama, kelas: s.kelas?.namaKelas },
        hadir: c.hadir,
        terlambat: c.terlambat,
        izin: c.izin,
        sakit: c.sakit,
        alpha,
        totalHadir: c.hadir + c.terlambat,
        totalPelanggaran: pl.count,
        totalPoin: pl.poin,
      }
    })

    return NextResponse.json({
      bulan,
      totalSiswa: siswaList.length,
      rekap,
    })
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat rekap bulanan' })
  }
}
