import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeJk, normalizeRole } from '@/lib/csv'
import { prismaErrorResponse } from '@/lib/api-error'

interface ImportRow {
  nip?: string
  nama?: string
  jenisKelamin?: string
  role?: string
  telepon?: string
  alamat?: string
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = (await req.json()) as { rows: ImportRow[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data untuk diimport' }, { status: 400 })
    }

    // NIP yang sudah terdaftar
    const existing = await db.guru.findMany({ select: { nip: true } })
    const existingNip = new Set(existing.map((g) => g.nip))

    const skipped: { baris: number; identitas: string; alasan: string }[] = []
    let imported = 0

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const nip = (r.nip || '').trim()
      const nama = (r.nama || '').trim()
      const identitas = `${nip || '(kosong)'} - ${nama || '(kosong)'}`

      if (!nip || !nama) {
        skipped.push({ baris: i + 1, identitas, alasan: 'Data tidak lengkap (NIP atau Nama kosong)' })
        continue
      }
      const jk = normalizeJk(r.jenisKelamin || 'L') || 'L'
      if (r.jenisKelamin && r.jenisKelamin.trim() && !normalizeJk(r.jenisKelamin)) {
        skipped.push({ baris: i + 1, identitas, alasan: `Jenis kelamin tidak dikenal: "${r.jenisKelamin}"` })
        continue
      }
      let role = 'guru'
      if (r.role && r.role.trim()) {
        const nr = normalizeRole(r.role)
        if (!nr) {
          skipped.push({ baris: i + 1, identitas, alasan: `Role tidak dikenal: "${r.role}" (gunakan guru / kepala_sekolah / admin)` })
          continue
        }
        role = nr
      }
      if (existingNip.has(nip)) {
        skipped.push({ baris: i + 1, identitas, alasan: 'NIP sudah terdaftar' })
        continue
      }

      try {
        await db.guru.create({
          data: {
            nip,
            nama,
            jenisKelamin: jk,
            role,
            telepon: r.telepon?.trim() || null,
            alamat: r.alamat?.trim() || null,
          },
        })
        existingNip.add(nip)
        imported++
      } catch {
        skipped.push({ baris: i + 1, identitas, alasan: 'Gagal menyimpan ke database' })
      }
    }

    return NextResponse.json({ imported, skipped })
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal mengimport data guru' })
  }
}
