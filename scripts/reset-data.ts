// Reset data aplikasi SistAbsen ke kondisi awal (instalasi bersih, siap dipublikasikan).
//
// Yang DIHAPUS  : seluruh siswa, guru, kelas, mata pelajaran, jenis pelanggaran,
//                 catatan pelanggaran, absensi (siswa/guru/per mapel), nilai,
//                 semua akun (termasuk akun demo), foto, logo & background uji.
// Yang DIBUAT ULANG : 1 akun admin bersih (admin / admin123) dan pengaturan
//                 dasar sekolah (nama sekolah, jam masuk/terlambat/pulang,
//                 tahun ajaran & semester).
//
// Pemakaian (wajib flag --ya agar tidak terjalankan secara tidak sengaja):
//   bun scripts/reset-data.ts --ya
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()
const hash = (pw: string) => crypto.createHash('sha256').update(pw).digest('hex')

async function main() {
  if (!process.argv.includes('--ya')) {
    console.log('RESET DIBATALKAN: skrip ini menghapus SEMUA data operasional.')
    console.log('Untuk benar-benar mereset, jalankan: bun scripts/reset-data.ts --ya')
    return
  }

  // 1) Hapus seluruh data operasional (urutan tabel anak -> induk agar aman FK)
  await db.$transaction([
    db.pelanggaran.deleteMany(),
    db.nilai.deleteMany(),
    db.absensiMapel.deleteMany(),
    db.absensi.deleteMany(),
    db.absensiGuru.deleteMany(),
    db.siswa.deleteMany(),
    db.mataPelajaran.deleteMany(),
    db.kelas.deleteMany(),
    db.jenisPelanggaran.deleteMany(),
    db.guru.deleteMany(),
    db.akun.deleteMany(),
  ])
  console.log('Semua data operasional terhapus.')

  // 2) Buat ulang satu akun admin yang bersih (tanpa foto)
  await db.akun.create({
    data: {
      username: 'admin',
      password: hash('admin123'),
      nama: 'Administrator Sistem',
      role: 'admin',
    },
  })
  console.log('Akun admin dibuat ulang (admin / admin123).')

  // 3) Pengaturan awal sekolah (isi bebas dikosongkan agar diisi data asli)
  const pengaturanAwal: Record<string, string> = {
    nama_sekolah: 'MTs Al Mukhtariyah',
    npsn: '',
    alamat_sekolah: '',
    telepon_sekolah: '',
    email_sekolah: '',
    jam_masuk: '07:00',
    jam_terlambat: '07:15',
    jam_pulang: '15:30',
    kepala_sekolah: '',
    tahun_ajaran: '2025/2026',
    semester: 'Ganjil',
    logo_sekolah: '',
    bg_login: '',
  }
  for (const [key, value] of Object.entries(pengaturanAwal)) {
    await db.pengaturan.upsert({ where: { key }, update: { value }, create: { key, value } })
  }
  console.log('Pengaturan dikembalikan ke nilai awal.')

  // 4) Ringkasan kondisi akhir
  const sisa = {
    akun: await db.akun.count(),
    siswa: await db.siswa.count(),
    guru: await db.guru.count(),
    kelas: await db.kelas.count(),
    mataPelajaran: await db.mataPelajaran.count(),
    jenisPelanggaran: await db.jenisPelanggaran.count(),
    absensi: await db.absensi.count(),
    absensiMapel: await db.absensiMapel.count(),
    absensiGuru: await db.absensiGuru.count(),
    nilai: await db.nilai.count(),
    pelanggaran: await db.pelanggaran.count(),
  }
  console.log('Kondisi data sekarang:', JSON.stringify(sisa))

  // 5) Rapatkan file database SQLite setelah penghapusan besar
  await db.$executeRawUnsafe('VACUUM')
  console.log('Database dirapikan (VACUUM). Selesai — aplikasi siap dipublikasikan.')
}

main()
  .catch((e) => {
    console.error('Reset gagal:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
