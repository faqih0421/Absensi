import { NextRequest, NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-server'

// GET /api/download-code (hanya admin)
// Mengemas seluruh kode sumber aplikasi (tanpa node_modules/.next) menjadi file ZIP
// dan mengirimkannya sebagai unduhan, sehingga bisa dibuka di Visual Studio Code.
// File .env dibuat ulang dengan DATABASE_URL relatif agar proyek bisa langsung
// dijalankan di komputer lain tanpa mengubah konfigurasi (tanpa rahasia lain).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if (auth.error) return auth.error

  const projectRoot = process.cwd()
  const tmpZip = path.join(os.tmpdir(), `sistabsen-source-${Date.now()}.zip`)
  let tmpDir: string | null = null
  let dbSnapDir: string | null = null

  try {
    // Daftar file/folder yang dikemas: kode sumber + skema database + konfigurasi
    // (folder db/ dikemas terpisah dari snapshot database yang konsisten)
    const items = [
      'src',
      'prisma',
      'public',
      'scripts',
      'package.json',
      'bun.lock',
      'tsconfig.json',
      'next.config.ts',
      'postcss.config.mjs',
      'eslint.config.mjs',
      'tailwind.config.ts',
      'components.json',
      'next-env.d.ts',
      'PANDUAN-DEPLOYMENT.md',
    ].filter((item) => fs.existsSync(path.join(projectRoot, item)))

    // Folder sementara berisi file tambahan yang ikut dikemas di root ZIP
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sistabsen-src-'))

    // .env dengan path database relatif (valid di komputer mana pun;
    // Prisma mengresolve path relatif terhadap lokasi prisma/schema.prisma).
    // HANYA DATABASE_URL — rahasia lain (mis. SISTABSEN_SECRET) tidak ikut.
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      'DATABASE_URL=file:../db/custom.db\n'
    )

    // Petunjuk singkat menjalankan proyek di komputer lokal
    fs.writeFileSync(
      path.join(tmpDir, 'CARA-MENJALANKAN.txt'),
      [
        'SISTABSEN - MTs Al Mukhtariyah',
        '==============================',
        '',
        'Cara menjalankan kode sumber ini di komputer Anda:',
        '',
        '1. Install prasyarat:',
        '   - Node.js LTS (https://nodejs.org) atau Bun (https://bun.sh)',
        '   - Visual Studio Code (https://code.visualstudio.com)',
        '',
        '2. Ekstrak file ZIP ini, lalu buka foldernya di VS Code:',
        '   File > Open Folder',
        '',
        '3. Buka terminal di VS Code (Terminal > New Terminal), lalu jalankan:',
        '   - bun install        (atau: npm install)',
        '   - npx prisma generate',
        '   - bun run dev        (atau: npm run dev)',
        '',
        '4. Buka http://localhost:3000 di browser.',
        '',
        'Akun:',
        '- admin / admin123  (satu-satunya akun, akses penuh — database bersih)',
        '',
        'PENTING sebelum dipublikasikan:',
        '- Ganti kata sandi admin via menu Manajemen Akun',
        '- Isi data sekolah di menu Pengaturan (NPSN, alamat, logo, dll)',
        '',
        'Untuk membawa aplikasi ini ONLINE ke internet (deployment ke hosting),',
        'baca file PANDUAN-DEPLOYMENT.md atau menu "Panduan Hosting" di aplikasi.',
        '',
        'Catatan Windows: jika "npm run dev" error pada perintah "tee",',
        'jalankan langsung: npx next dev -p 3000',
        '',
        'Database sudah termasuk (folder db) dalam keadaan bersih siap diisi',
        'data asli sekolah.',
        '',
      ].join('\n')
    )

    // Snapshot database yang konsisten: VACUUM INTO file sementara
    // (bila gagal, fallback ke copy file db biasa)
    dbSnapDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sistabsen-dbsnap-'))
    const dbOutDir = path.join(dbSnapDir, 'db')
    fs.mkdirSync(dbOutDir, { recursive: true })
    const snapPath = path.join(dbOutDir, 'custom.db')
    let snapOk = false
    try {
      const safePath = snapPath.replace(/'/g, "''")
      await db.$queryRawUnsafe(`VACUUM INTO '${safePath}'`)
      snapOk = fs.existsSync(snapPath)
    } catch (e) {
      console.error('VACUUM INTO gagal, fallback copy database:', e)
    }
    if (!snapOk) {
      const dbPath = path.join(projectRoot, 'db', 'custom.db')
      if (!fs.existsSync(dbPath)) {
        return NextResponse.json({ error: 'File database tidak ditemukan' }, { status: 500 })
      }
      fs.copyFileSync(dbPath, snapPath)
    }

    // Buat ZIP menggunakan perintah `zip` (tersedia di sistem)
    execFileSync('zip', ['-r', '-q', tmpZip, ...items], {
      cwd: projectRoot,
      timeout: 30_000,
    })
    // Masukkan snapshot database sebagai db/custom.db
    execFileSync('zip', ['-r', '-q', tmpZip, 'db'], {
      cwd: dbSnapDir,
      timeout: 15_000,
    })
    execFileSync('zip', ['-r', '-q', tmpZip, '.env', 'CARA-MENJALANKAN.txt'], {
      cwd: tmpDir,
      timeout: 10_000,
    })

    const content = fs.readFileSync(tmpZip)
    const dateStr = new Date().toISOString().split('T')[0]

    return new NextResponse(new Uint8Array(content), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="sistabsen-source-${dateStr}.zip"`,
        'Content-Length': String(content.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('Download source code error:', e)
    return NextResponse.json({ error: 'Gagal membuat arsip kode sumber' }, { status: 500 })
  } finally {
    // Bersihkan file sementara
    try { fs.unlinkSync(tmpZip) } catch {}
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    }
    if (dbSnapDir) {
      try { fs.rmSync(dbSnapDir, { recursive: true, force: true }) } catch {}
    }
  }
}
