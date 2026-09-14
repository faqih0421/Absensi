import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaErrorResponse } from '@/lib/api-error'
import { wibDateKey, wibDayRange, parseDateOnlyWIB } from '@/lib/wib'

const STATUS_VALID = ['hadir', 'terlambat', 'izin', 'sakit', 'alpha']

// Normalisasi status (lowercase-trim) -> null bila tidak valid
function normalizeStatus(s: any): string | null {
  const v = String(s || 'hadir').toLowerCase().trim()
  return STATUS_VALID.includes(v) ? v : null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mapelId = searchParams.get('mapelId')
    const tanggal = searchParams.get('tanggal')
    // Tanpa mapelId: jangan ambil semua record — kembalikan kosong
    if (!mapelId) return NextResponse.json([])
    const where: any = { mataPelajaranId: mapelId }
    if (tanggal) {
      // 'YYYY-MM-DD' diparse sebagai rentang hari WIB
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        return NextResponse.json({ error: 'Parameter tanggal tidak valid' }, { status: 400 })
      }
      const { start, end } = wibDayRange(tanggal)
      where.tanggal = { gte: start, lte: end }
    }
    const absen = await db.absensiMapel.findMany({
      where,
      include: { siswa: { include: { kelas: true } }, mataPelajaran: true },
      orderBy: { tanggal: 'desc' },
    })
    return NextResponse.json(absen)
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memuat data absensi mapel' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    // data: { mapelId, tanggal, jamKe, records: [{ siswaId, status, catatan }] }

    // WAJIB mapelId
    if (!data.mapelId) {
      return NextResponse.json({ error: 'Mata pelajaran wajib dipilih' }, { status: 400 })
    }
    const mapel = await db.mataPelajaran.findUnique({ where: { id: data.mapelId } })
    if (!mapel) {
      return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan' }, { status: 400 })
    }

    // jamKe: bilangan bulat >= 1
    const jamKe = Math.max(1, Math.trunc(Number(data.jamKe)) || 1)

    // Batas hari WIB dari tanggal yang dikirim (untuk deteksi duplikat per hari)
    const base =
      data.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(String(data.tanggal))
        ? parseDateOnlyWIB(String(data.tanggal))
        : data.tanggal
          ? new Date(data.tanggal)
          : new Date()
    const { start, end } = wibDayRange(wibDateKey(base))

    // Upsert satu baris absensi: update jika siswa sudah diabsen pada
    // mapel + jam + tanggal (hari WIB) yang sama, create jika belum.
    const upsertRow = (tx: any, r: any) =>
      tx.absensiMapel.findFirst({
        where: {
          siswaId: r.siswaId,
          mataPelajaranId: data.mapelId,
          jamKe,
          tanggal: { gte: start, lte: end },
        },
      }).then((existing: any) => {
        if (existing) {
          return tx.absensiMapel.update({
            where: { id: existing.id },
            data: { status: normalizeStatus(r.status) || 'hadir', catatan: r.catatan || null },
          }).then(() => 'updated')
        }
        return tx.absensiMapel.create({
          data: {
            siswaId: r.siswaId,
            mataPelajaranId: data.mapelId,
            tanggal: base,
            jamKe,
            status: normalizeStatus(r.status) || 'hadir',
            catatan: r.catatan || null,
          },
        }).then(() => 'created')
      })

    if (data.records && Array.isArray(data.records)) {
      // Validasi semua baris SEBELUM menyimpan
      const ids: string[] = []
      for (let i = 0; i < data.records.length; i++) {
        const r = data.records[i]
        if (!r.siswaId) {
          return NextResponse.json(
            { error: `Baris ${i + 1}: siswaId wajib diisi (ada baris absensi tanpa siswa)` },
            { status: 400 }
          )
        }
        if (normalizeStatus(r.status) === null) {
          return NextResponse.json({ error: `Baris ${i + 1}: status tidak valid` }, { status: 400 })
        }
        ids.push(r.siswaId)
      }
      // Semua siswaId harus eksis di DB
      if (ids.length > 0) {
        const ditemukan = await db.siswa.findMany({ where: { id: { in: ids } }, select: { id: true } })
        const idSet = new Set(ditemukan.map(s => s.id))
        const hilang = ids.find((id) => !idSet.has(id))
        if (hilang) {
          return NextResponse.json({ error: 'Ada siswa yang tidak ditemukan di database' }, { status: 400 })
        }
      }
      let created = 0
      let updated = 0
      await db.$transaction(async (tx: any) => {
        for (const r of data.records) {
          const res = await upsertRow(tx, r)
          if (res === 'created') created++
          else updated++
        }
      })
      return NextResponse.json({ created, updated })
    }

    // Single record — wajib siswaId (tidak boleh where tanpa siswaId)
    if (!data.siswaId) {
      return NextResponse.json({ error: 'Siswa wajib dipilih (siswaId wajib diisi)' }, { status: 400 })
    }
    const status = normalizeStatus(data.status)
    if (status === null) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }
    const siswaAda = await db.siswa.findUnique({ where: { id: data.siswaId }, select: { id: true } })
    if (!siswaAda) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 400 })
    }
    const absen = await db.$transaction(async (tx: any) => {
      const existing = await tx.absensiMapel.findFirst({
        where: {
          siswaId: data.siswaId,
          mataPelajaranId: data.mapelId,
          jamKe,
          tanggal: { gte: start, lte: end },
        },
      })
      if (existing) {
        return tx.absensiMapel.update({
          where: { id: existing.id },
          data: { status, catatan: data.catatan || null },
        })
      }
      return tx.absensiMapel.create({
        data: {
          siswaId: data.siswaId,
          mataPelajaranId: data.mapelId,
          tanggal: base,
          jamKe,
          status,
          catatan: data.catatan || null,
        },
      })
    })
    return NextResponse.json(absen)
  } catch (e) {
    return prismaErrorResponse(e, {
      relation: 'Mata pelajaran tidak ditemukan',
      fallback: 'Gagal menyimpan absensi mapel',
    })
  }
}
