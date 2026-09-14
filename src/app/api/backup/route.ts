import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import { prismaErrorResponse } from '@/lib/api-error'
import { requireAuth } from '@/lib/auth-server'

// GET /api/backup - download backup SQL/JSON (hanya admin)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if (auth.error) return auth.error
  try {
    const [siswa, guru, kelas, mapel, absensi, absensiMapel, absensiGuru, nilai, pelanggaran, jenisPelanggaran, akun, pengaturan] = await Promise.all([
      db.siswa.findMany({ include: { kelas: true } }),
      db.guru.findMany(),
      db.kelas.findMany({ include: { walikelas: true } }),
      db.mataPelajaran.findMany({ include: { guru: true } }),
      db.absensi.findMany({ include: { siswa: true } }),
      db.absensiMapel.findMany({ include: { siswa: true, mataPelajaran: true } }),
      db.absensiGuru.findMany({ include: { guru: true } }),
      db.nilai.findMany({ include: { siswa: true, mataPelajaran: true } }),
      db.pelanggaran.findMany({ include: { siswa: true, jenisPelanggaran: true } }),
      db.jenisPelanggaran.findMany(),
      db.akun.findMany(),
      db.pengaturan.findMany(),
    ])

    const backup = {
      metadata: {
        exportedAt: new Date().toISOString(),
        aplikasi: 'Aplikasi Absensi QR - SistAbsen',
        versi: '1.0.0',
      },
      data: {
        siswa, guru, kelas, mataPelajaran: mapel, absensi, absensiMapel, absensiGuru, nilai, pelanggaran, jenisPelanggaran,
        akun: akun.map(a => ({ ...a, password: '***' })),
        pengaturan,
      },
    }

    // Mask field sensitif di seluruh kedalaman struktur (termasuk relasi bersarang):
    // hilangkan qrToken siswa & guru
    const json = JSON.stringify(backup, (key, value) => (key === 'qrToken' ? undefined : value), 2)
    const dateStr = new Date().toISOString().split('T')[0]
    const fileName = `backup-absensi-${dateStr}.json`

    // Simpan ke file secara atomik: tulis ke .tmp lalu rename
    const backupDir = path.join(process.cwd(), 'download')
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
    const filePath = path.join(backupDir, fileName)
    const tmpPath = `${filePath}.tmp`
    fs.writeFileSync(tmpPath, json)
    fs.renameSync(tmpPath, filePath)

    // Return JSON untuk ditampilkan di UI
    return NextResponse.json({
      success: true,
      fileName,
      size: (json.length / 1024).toFixed(2) + ' KB',
      tables: {
        siswa: siswa.length, guru: guru.length, kelas: kelas.length,
        mataPelajaran: mapel.length, absensi: absensi.length, absensiMapel: absensiMapel.length,
        absensiGuru: absensiGuru.length, nilai: nilai.length, pelanggaran: pelanggaran.length,
        jenisPelanggaran: jenisPelanggaran.length, akun: akun.length, pengaturan: pengaturan.length,
      },
      downloadUrl: `/api/backup/download?file=${encodeURIComponent(fileName)}`,
    })
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal membuat backup' })
  }
}
