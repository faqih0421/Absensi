import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { wibDateKey, wibDayRange, wibTimeMinutes, parseJamToMinutes } from '@/lib/wib'

const MODE_VALID = ['checkin_siswa', 'checkout_guru', 'checkin_guru', 'absensi_mapel']

// Rentang bulan berjalan (WIB) — untuk peringatan dini frekuensi
function rentangBulanWIB() {
  const bulanKey = wibDateKey().slice(0, 7) // 'YYYY-MM'
  const [y, m] = bulanKey.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const start = wibDayRange(`${bulanKey}-01`).start
  const end = wibDayRange(`${bulanKey}-${String(lastDay).padStart(2, '0')}`).end
  return { start, end }
}

// Peringatan dini frekuensi untuk satu siswa (bulan berjalan WIB):
// dipakai UI untuk memberi tahu bila siswa terlambat/alpha melebihi batas (mis. lebih dari 3x)
async function peringatanSiswa(siswaId: string) {
  const { start, end } = rentangBulanWIB()
  const [terlambatBulanIni, alphaBulanIni] = await Promise.all([
    db.absensi.count({
      where: { siswaId, jenis: 'checkin', status: 'terlambat', tanggal: { gte: start, lte: end } },
    }),
    db.absensiMapel.count({
      where: { siswaId, status: 'alpha', tanggal: { gte: start, lte: end } },
    }),
  ])
  return { terlambatBulanIni, alphaBulanIni, batasPeringatan: 3 }
}

// POST /api/scan-qr
// body: { token, mode: 'checkin_siswa' | 'checkout_guru' | 'checkin_guru' | 'absensi_mapel', mapelId?, jamKe? }
// `token` menerima isi QR Code (qrToken) ATAU NIS siswa / NIP guru (untuk absensi manual)
export async function POST(req: NextRequest) {
  try {
    const { token, mode: modeRaw, mapelId, jamKe: jamKeRaw } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token QR / NIS / NIP tidak boleh kosong' }, { status: 400 })

    // Whitelist mode (tanpa mode dianggap check-in siswa, perilaku lama)
    const mode = modeRaw || 'checkin_siswa'
    if (!MODE_VALID.includes(mode)) {
      return NextResponse.json({ error: 'Mode tidak valid' }, { status: 400 })
    }

    // Cek apakah token milik siswa atau guru.
    // Absensi manual: bila bukan token QR, cari berdasarkan NIS (siswa) atau NIP (guru)
    const siswa = await db.siswa.findFirst({
      where: { OR: [{ qrToken: token }, { nis: token }] },
      include: { kelas: true },
    })
    const guru = siswa
      ? null
      : await db.guru.findFirst({ where: { OR: [{ qrToken: token }, { nip: token }] } })

    if (!siswa && !guru) {
      return NextResponse.json({ error: 'Token QR / NIS / NIP tidak dikenali' }, { status: 404 })
    }

    const now = new Date()
    // Kunci hari WIB (bukan setHours yang tergantung TZ server)
    const { start: dayStart, end: dayEnd } = wibDayRange(wibDateKey(now))

    // Pengaturan jam (WIB) — fallback default bila pengaturan rusak/kosong
    const pengaturan = await db.pengaturan.findMany()
    const getSetting = (key: string) => pengaturan.find(p => p.key === key)?.value
    const batasTelatMin = parseJamToMinutes(getSetting('jam_terlambat')) ?? 7 * 60 + 15 // 07:15 WIB
    const nowMin = wibTimeMinutes(now)

    // Siswa check-in
    if (siswa && mode === 'checkin_siswa') {
      let existing: any = null
      let absen: any = null
      let status = 'hadir'
      let keterlambatan = 0
      // Cegah duplikasi race: cek + create dalam satu transaksi
      await db.$transaction(async (tx) => {
        existing = await tx.absensi.findFirst({
          where: {
            siswaId: siswa.id,
            jenis: 'checkin',
            tanggal: { gte: dayStart, lte: dayEnd },
          },
        })
        if (existing) return
        if (nowMin > batasTelatMin) {
          status = 'terlambat'
          keterlambatan = Math.max(0, nowMin - batasTelatMin)
        }
        absen = await tx.absensi.create({
          data: {
            siswaId: siswa.id,
            jenis: 'checkin',
            status,
            keterlambatan,
            tanggal: now,
            waktu: now,
          },
        })
      })
      if (existing) {
        return NextResponse.json({
          success: false,
          tipe: 'siswa',
          message: `${siswa.nama} sudah check-in sebelumnya`,
          data: { siswa, absensi: existing, peringatan: await peringatanSiswa(siswa.id) },
        })
      }
      return NextResponse.json({
        success: true,
        tipe: 'siswa',
        message: `Check-in ${siswa.nama} berhasil - ${status}${keterlambatan > 0 ? ` (${keterlambatan} menit)` : ''}`,
        data: { siswa, absensi: absen, peringatan: await peringatanSiswa(siswa.id) },
      })
    }

    // Guru check-in
    // Catatan: mode 'checkin_siswa' juga diterima agar QR guru yang discan
    // dari UI check-in siswa tetap tercatat (auto-detect guru).
    if (guru && (mode === 'checkin_guru' || mode === 'checkin_siswa')) {
      let existing: any = null
      let absen: any = null
      let status = 'hadir'
      if (nowMin > batasTelatMin) status = 'terlambat'
      // Cegah duplikasi race: cek + create dalam satu transaksi
      await db.$transaction(async (tx) => {
        existing = await tx.absensiGuru.findFirst({
          where: {
            guruId: guru.id,
            jenis: 'checkin',
            tanggal: { gte: dayStart, lte: dayEnd },
          },
        })
        if (existing) return
        absen = await tx.absensiGuru.create({
          data: {
            guruId: guru.id,
            jenis: 'checkin',
            status,
            tanggal: now,
            waktu: now,
          },
        })
      })
      if (existing) {
        return NextResponse.json({
          success: false,
          tipe: 'guru',
          message: `${guru.nama} sudah check-in sebelumnya`,
          data: { guru, absensi: existing },
        })
      }
      return NextResponse.json({
        success: true,
        tipe: 'guru',
        message: `Check-in guru ${guru.nama} berhasil - ${status}`,
        data: { guru, absensi: absen },
      })
    }

    // Guru check-out
    if (guru && mode === 'checkout_guru') {
      let existing: any = null
      let absen: any = null
      // Cegah duplikasi race: cek + create dalam satu transaksi
      await db.$transaction(async (tx) => {
        existing = await tx.absensiGuru.findFirst({
          where: {
            guruId: guru.id,
            jenis: 'checkout',
            tanggal: { gte: dayStart, lte: dayEnd },
          },
        })
        if (existing) return
        absen = await tx.absensiGuru.create({
          data: {
            guruId: guru.id,
            jenis: 'checkout',
            status: 'hadir',
            tanggal: now,
            waktu: now,
          },
        })
      })
      if (existing) {
        return NextResponse.json({
          success: false,
          message: `${guru.nama} sudah check-out sebelumnya`,
          data: { guru, absensi: existing },
        })
      }
      return NextResponse.json({
        success: true,
        message: `Check-out guru ${guru.nama} berhasil`,
        data: { guru, absensi: absen },
      })
    }

    // Absensi per mata pelajaran & jam pelajaran via scan QR siswa
    if (mode === 'absensi_mapel') {
      if (!siswa) {
        return NextResponse.json({ error: 'NIS/QR ini bukan milik siswa' }, { status: 404 })
      }
      if (!mapelId) {
        return NextResponse.json({ error: 'Mata pelajaran belum dipilih' }, { status: 400 })
      }
      const mapel = await db.mataPelajaran.findUnique({ where: { id: mapelId } })
      if (!mapel) {
        return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan' }, { status: 404 })
      }
      // jamKe: bilangan bulat >= 1
      const jam = Math.max(1, Math.trunc(Number(jamKeRaw)) || 1)
      let existing: any = null
      let absen: any = null
      // Cegah duplikasi race: cek + create dalam satu transaksi
      await db.$transaction(async (tx) => {
        existing = await tx.absensiMapel.findFirst({
          where: {
            siswaId: siswa.id,
            mataPelajaranId: mapel.id,
            jamKe: jam,
            tanggal: { gte: dayStart, lte: dayEnd },
          },
        })
        if (existing) return
        absen = await tx.absensiMapel.create({
          data: {
            siswaId: siswa.id,
            mataPelajaranId: mapel.id,
            tanggal: now,
            jamKe: jam,
            status: 'hadir',
          },
        })
      })
      if (existing) {
        return NextResponse.json({
          success: false,
          message: `${siswa.nama} sudah diabsen mapel ${mapel.nama} jam ${jam} sebelumnya`,
          data: { siswa, absensiMapel: existing },
        })
      }
      return NextResponse.json({
        success: true,
        message: `${siswa.nama} hadir - ${mapel.nama} jam ${jam}`,
        data: {
          siswa: { id: siswa.id, nama: siswa.nama, nis: siswa.nis, kelas: { namaKelas: siswa.kelas?.namaKelas } },
          mataPelajaran: { id: mapel.id, nama: mapel.nama, jam: mapel.jam },
          absensiMapel: absen,
          peringatan: await peringatanSiswa(siswa.id),
        },
      })
    }

    return NextResponse.json({ error: 'Mode tidak valid' }, { status: 400 })
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memproses absensi' })
  }
}
