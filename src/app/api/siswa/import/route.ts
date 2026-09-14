import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeJk, normalizeTanggal } from '@/lib/csv'
import { prismaErrorResponse } from '@/lib/api-error'

interface ImportRow {
  nis?: string
  nisn?: string
  nama?: string
  jenisKelamin?: string
  kelas?: string
  tempatLahir?: string
  tanggalLahir?: string
  alamat?: string
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = (await req.json()) as { rows: ImportRow[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diimport' }, { status: 400 })
    }

    // Mapping nama kelas -> id (case-insensitive)
    const kelasList = await db.kelas.findMany()
    const kelasMap = new Map(kelasList.map((k) => [k.namaKelas.toLowerCase(), k]))
    // NIS yang sudah terdaftar
    const existing = await db.siswa.findMany({ select: { nis: true } })
    const existingNis = new Set(existing.map((s) => s.nis))

    const skipped: { baris: number; identitas: string; alasan: string }[] = []
    let imported = 0

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const nis = (r.nis || '').trim()
      const nama = (r.nama || '').trim()
      const kelasNama = (r.kelas || '').trim()
      const identitas = `${nis || '(kosong)'} - ${nama || '(kosong)'}`

      if (!nis || !nama || !kelasNama) {
        skipped.push({ baris: i + 1, identitas, alasan: 'Data tidak lengkap (NIS, Nama, atau Kelas kosong)' })
        continue
      }
      const jk = normalizeJk(r.jenisKelamin || 'L') || 'L'
      if (r.jenisKelamin && r.jenisKelamin.trim() && !normalizeJk(r.jenisKelamin)) {
        skipped.push({ baris: i + 1, identitas, alasan: `Jenis kelamin tidak dikenal: "${r.jenisKelamin}"` })
        continue
      }
      const kelas = kelasMap.get(kelasNama.toLowerCase())
      if (!kelas) {
        skipped.push({ baris: i + 1, identitas, alasan: `Kelas "${kelasNama}" tidak ditemukan (buat kelas dulu di menu Kelas)` })
        continue
      }
      if (existingNis.has(nis)) {
        skipped.push({ baris: i + 1, identitas, alasan: 'NIS sudah terdaftar' })
        continue
      }
      let tanggalLahir: Date | null = null
      if (r.tanggalLahir && r.tanggalLahir.trim()) {
        const tgl = normalizeTanggal(r.tanggalLahir)
        if (!tgl) {
          skipped.push({ baris: i + 1, identitas, alasan: `Tanggal lahir tidak valid: "${r.tanggalLahir}" (gunakan YYYY-MM-DD atau DD/MM/YYYY)` })
          continue
        }
        tanggalLahir = new Date(tgl)
      }

      try {
        await db.siswa.create({
          data: {
            nis,
            nisn: r.nisn?.trim() || null,
            nama,
            jenisKelamin: jk,
            kelasId: kelas.id,
            tempatLahir: r.tempatLahir?.trim() || null,
            tanggalLahir,
            alamat: r.alamat?.trim() || null,
          },
        })
        existingNis.add(nis)
        imported++
      } catch {
        skipped.push({ baris: i + 1, identitas, alasan: 'Gagal menyimpan ke database' })
      }
    }

    return NextResponse.json({ imported, skipped })
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal mengimport data siswa' })
  }
}
