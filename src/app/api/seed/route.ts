import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { prismaErrorResponse } from '@/lib/api-error'
import { wibDateKey, wibDayRange } from '@/lib/wib'

function hashPassword(pw: string) {
  return crypto.createHash('sha256').update(pw).digest('hex')
}

// POST /api/seed - Buat data awal untuk demo
export async function POST() {
  try {
    // Idempotensi: bila sudah ada data, jangan seeding ulang
    const [akunCount, kelasCount, siswaCount] = await Promise.all([
      db.akun.count(),
      db.kelas.count(),
      db.siswa.count(),
    ])
    if (akunCount > 0 || kelasCount > 0 || siswaCount > 0) {
      return NextResponse.json({ message: 'Data sudah ada, skip seeding', skipped: true })
    }

    // Akun demo dibuat dengan upsert
    await db.akun.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        password: hashPassword('admin123'),
        nama: 'Administrator Sistem',
        role: 'admin',
        email: 'admin@mtsalukhtariyah.sch.id',
      },
    })

    const guru1 = await db.guru.create({
      data: { nip: '198501012010011001', nama: 'Budi Santoso, S.Pd', jenisKelamin: 'L', role: 'guru', telepon: '081234567801', alamat: 'Jl. Merdeka No. 1' },
    })
    const guru2 = await db.guru.create({
      data: { nip: '198703152011012002', nama: 'Siti Aminah, S.Pd', jenisKelamin: 'P', role: 'guru', telepon: '081234567802', alamat: 'Jl. Sudirman No. 2' },
    })
    const guru3 = await db.guru.create({
      data: { nip: '199001202015012003', nama: 'Ahmad Fauzi, M.Pd', jenisKelamin: 'L', role: 'kepala_sekolah', telepon: '081234567803', alamat: 'Jl. Diponegoro No. 3' },
    })
    const guru4 = await db.guru.create({
      data: { nip: '199206052017012004', nama: 'Dewi Lestari, S.Pd', jenisKelamin: 'P', role: 'guru', telepon: '081234567804', alamat: 'Jl. Kartini No. 4' },
    })

    // Akun untuk guru dan kepala sekolah
    await db.akun.upsert({
      where: { username: 'guru' },
      update: {},
      create: {
        username: 'guru',
        password: hashPassword('guru123'),
        nama: 'Budi Santoso, S.Pd',
        role: 'guru',
        email: 'budi@mtsalukhtariyah.sch.id',
      },
    })
    await db.akun.upsert({
      where: { username: 'kepsek' },
      update: {},
      create: {
        username: 'kepsek',
        password: hashPassword('kepsek123'),
        nama: 'Ahmad Fauzi, M.Pd',
        role: 'kepala_sekolah',
        email: 'kepsek@mtsalukhtariyah.sch.id',
      },
    })

    // Kelas MTs Al Mukhtariyah: 7A,7B,7C,8A,8B,8C,9A,9B,9C
    const kelasDefs = [
      { namaKelas: '7A', tingkat: '7', walikelasId: guru1.id },
      { namaKelas: '7B', tingkat: '7', walikelasId: guru2.id },
      { namaKelas: '7C', tingkat: '7', walikelasId: guru4.id },
      { namaKelas: '8A', tingkat: '8', walikelasId: null },
      { namaKelas: '8B', tingkat: '8', walikelasId: null },
      { namaKelas: '8C', tingkat: '8', walikelasId: null },
      { namaKelas: '9A', tingkat: '9', walikelasId: null },
      { namaKelas: '9B', tingkat: '9', walikelasId: null },
      { namaKelas: '9C', tingkat: '9', walikelasId: null },
    ]
    const kelasList: { id: string; tingkat: string }[] = []
    for (const k of kelasDefs) {
      kelasList.push(await db.kelas.create({ data: k }))
    }

    const namaDepan = ['Ahmad', 'Budi', 'Citra', 'Dian', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko']
    const namaBelakang = ['Pratama', 'Wijaya', 'Saputra', 'Lestari', 'Maulana', 'Anggraini', 'Kusuma', 'Hidayat', 'Permata', 'Nugroho']
    const jk = ['L', 'P']

    let nisCounter = 1001
    for (const kelas of kelasList) {
      for (let i = 0; i < 4; i++) {
        const idx = (nisCounter + i) % 10
        await db.siswa.create({
          data: {
            nis: `${nisCounter}`,
            nisn: `00${nisCounter}`,
            nama: `${namaDepan[idx]} ${namaBelakang[(i * 3 + 1) % 10]}`,
            jenisKelamin: jk[(nisCounter + i) % 2],
            kelasId: kelas.id,
            tempatLahir: 'Jakarta',
            tanggalLahir: new Date(Date.UTC(2010 + (Number(kelas.tingkat) % 3), i % 12, (i % 28) + 1)),
          },
        })
        nisCounter++
      }
    }

    await db.mataPelajaran.createMany({
      data: [
        { nama: 'Matematika', guruId: guru1.id, jam: '07:00-08:30', hari: 'Senin' },
        { nama: 'Bahasa Indonesia', guruId: guru2.id, jam: '08:30-10:00', hari: 'Selasa' },
        { nama: 'Ilmu Pengetahuan Alam', guruId: guru4.id, jam: '10:15-11:45', hari: 'Rabu' },
        { nama: 'Bahasa Inggris', guruId: guru2.id, jam: '12:45-14:15', hari: 'Kamis' },
        { nama: 'Pend. Agama Islam', guruId: guru1.id, jam: '14:15-15:30', hari: 'Jumat' },
      ],
    })

    await db.jenisPelanggaran.createMany({
      data: [
        { nama: 'Terlambat masuk sekolah', poin: 5, kategori: 'ringan' },
        { nama: 'Tidak memakai atribut lengkap', poin: 5, kategori: 'ringan' },
        { nama: 'Tidak mengerjakan tugas', poin: 10, kategori: 'sedang' },
        { nama: 'Membolos jam pelajaran', poin: 15, kategori: 'sedang' },
        { nama: 'Berkelahi di lingkungan sekolah', poin: 50, kategori: 'berat' },
        { nama: 'Merokok di area sekolah', poin: 50, kategori: 'berat' },
        { nama: 'Tidak sopan kepada guru', poin: 25, kategori: 'sedang' },
        { nama: 'Membawa HP saat ujian', poin: 20, kategori: 'sedang' },
      ],
    })

    await db.pengaturan.createMany({
      data: [
        { key: 'nama_sekolah', value: 'MTs Al Mukhtariyah' },
        { key: 'npsn', value: '20100123' },
        { key: 'alamat_sekolah', value: 'Jl. Pendidikan No. 1' },
        { key: 'telepon_sekolah', value: '021-12345678' },
        { key: 'email_sekolah', value: 'info@mtsalukhtariyah.sch.id' },
        { key: 'jam_masuk', value: '07:00' },
        { key: 'jam_terlambat', value: '07:15' },
        { key: 'jam_pulang', value: '15:30' },
        { key: 'kepala_sekolah', value: 'Ahmad Fauzi, M.Pd' },
        { key: 'tahun_ajaran', value: '2025/2026' },
        { key: 'semester', value: 'Ganjil' },
        { key: 'logo_sekolah', value: '' },
      ],
    })

    // Contoh absensi hari ini pukul 07:05 WIB
    const { start: hariMulai } = wibDayRange(wibDateKey())
    const today = new Date(hariMulai.getTime() + (7 * 60 + 5) * 60 * 1000)
    const siswaList = await db.siswa.findMany({ take: 20 })
    for (const s of siswaList) {
      await db.absensi.create({
        data: {
          siswaId: s.id,
          tanggal: today,
          jenis: 'checkin',
          waktu: today,
          status: Math.random() > 0.85 ? 'terlambat' : 'hadir',
          keterlambatan: Math.random() > 0.85 ? Math.floor(Math.random() * 30) : 0,
        },
      })
    }

    return NextResponse.json({
      message: 'Seed berhasil',
      akun: [
        { username: 'admin', password: 'admin123' },
        { username: 'guru', password: 'guru123' },
        { username: 'kepsek', password: 'kepsek123' },
      ],
      created: { guru: 4, kelas: 9, siswa: 36, mapel: 5, akun: 3 },
    })
  } catch (e) {
    return prismaErrorResponse(e, { duplicate: 'Data sudah ada, skip seeding', fallback: 'Gagal melakukan seeding' })
  }
}

export async function GET() {
  try {
    const count = await db.akun.count()
    return NextResponse.json({ seeded: count > 0, akunCount: count })
  } catch (e) {
    return prismaErrorResponse(e, { fallback: 'Gagal memeriksa status seeding' })
  }
}