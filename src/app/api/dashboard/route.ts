import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { wibDateKey, wibDayRange, parseDateOnlyWIB } from '@/lib/wib'

export async function GET() {
  try {
    const [totalSiswa, totalGuru, totalKelas, totalMapel, totalAkun, totalPelanggaran] = await Promise.all([
      db.siswa.count(),
      db.guru.count(),
      db.kelas.count(),
      db.mataPelajaran.count(),
      db.akun.count(),
      db.pelanggaran.count(),
    ])

    // "Hari ini" = rentang hari WIB berjalan (bukan setHours yang tergantung TZ server)
    const { start: startOfDay, end: endOfDay } = wibDayRange(wibDateKey())

    const absensiHariIni = await db.absensi.findMany({
      where: { tanggal: { gte: startOfDay, lte: endOfDay }, jenis: 'checkin' },
      include: { siswa: { include: { kelas: true } } },
    })

    const hadir = absensiHariIni.filter(a => a.status === 'hadir').length
    const terlambat = absensiHariIni.filter(a => a.status === 'terlambat').length
    const izin = absensiHariIni.filter(a => a.status === 'izin').length
    const sakit = absensiHariIni.filter(a => a.status === 'sakit').length
    const alpha = totalSiswa - absensiHariIni.length

    // Absensi guru hari ini
    const absensiGuruHariIni = await db.absensiGuru.findMany({
      where: { tanggal: { gte: startOfDay, lte: endOfDay }, jenis: 'checkin' },
    })
    const guruHadir = absensiGuruHariIni.length
    const guruBelumAbsen = totalGuru - guruHadir

    // Tren 7 hari terakhir WIB (termasuk hari ini) — 1 query, kelompokkan di JS
    const keys7: string[] = []
    for (let i = 6; i >= 0; i--) {
      keys7.push(wibDateKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000)))
    }
    const start7 = wibDayRange(keys7[0]).start
    const end7 = wibDayRange(keys7[keys7.length - 1]).end
    const trenAbsen = await db.absensi.findMany({
      where: { tanggal: { gte: start7, lte: end7 }, jenis: 'checkin' },
      select: { tanggal: true, status: true },
    })
    const perDay = new Map<string, { hadir: number; terlambat: number; total: number }>()
    for (const a of trenAbsen) {
      const key = wibDateKey(new Date(a.tanggal))
      const c = perDay.get(key) || { hadir: 0, terlambat: 0, total: 0 }
      c.total++
      if (a.status === 'hadir') c.hadir++
      else if (a.status === 'terlambat') c.terlambat++
      perDay.set(key, c)
    }
    const last7Days = keys7.map((key) => {
      const c = perDay.get(key) || { hadir: 0, terlambat: 0, total: 0 }
      const d = parseDateOnlyWIB(key)
      return {
        tanggal: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
        hadir: c.hadir,
        terlambat: c.terlambat,
        absen: Math.max(0, totalSiswa - c.total),
      }
    })

    // Distribusi per kelas — hitung dari absensiHariIni + jumlah siswa per kelas (tanpa N+1)
    const kelasList = await db.kelas.findMany({ include: { _count: { select: { siswa: true } } } })
    const distribusiKelas = kelasList.map((k) => ({
      kelas: k.namaKelas,
      hadir: absensiHariIni.filter(a => a.siswa.kelasId === k.id).length,
      total: k._count.siswa,
    }))

    // Pelanggaran terbaru
    const pelanggaranTerbaru = await db.pelanggaran.findMany({
      take: 5,
      orderBy: { tanggal: 'desc' },
      include: { siswa: { include: { kelas: true } }, jenisPelanggaran: true },
    })

    // Siswa yang belum absen hari ini (tidak punya record Absensi jenis checkin hari ini)
    const belumAbsenSiswa = await db.siswa.findMany({
      where: {
        absensi: {
          none: {
            tanggal: { gte: startOfDay, lte: endOfDay },
            jenis: 'checkin',
          },
        },
      },
      include: { kelas: true },
      orderBy: { nama: 'asc' },
      take: 10,
    })
    const belumAbsen = belumAbsenSiswa

    return NextResponse.json({
      stats: {
        totalSiswa, totalGuru, totalKelas, totalMapel, totalAkun, totalPelanggaran,
        hadir, terlambat, izin, sakit, alpha,
        guruHadir, guruBelumAbsen,
      },
      tren7Hari: last7Days,
      distribusiKelas,
      pelanggaranTerbaru: pelanggaranTerbaru.map(p => ({
        id: p.id,
        siswaId: p.siswaId,
        siswa: p.siswa.nama,
        kelas: p.siswa.kelas?.namaKelas,
        pelanggaran: p.jenisPelanggaran.nama,
        poin: p.jenisPelanggaran.poin,
        tanggal: p.tanggal,
      })),
      belumAbsen: belumAbsen.map(s => ({ id: s.id, nama: s.nama, kelas: s.kelas?.namaKelas })),
      pengaturan: await db.pengaturan.findMany(),
    })
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data dashboard' })
  }
}
