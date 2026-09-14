'use client'

import { useEffect, useState } from 'react'
import { useAppStore, canAccessView } from '@/lib/store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GraduationCap, Lock, User as UserIcon, Check } from 'lucide-react'
import { toast } from 'sonner'

// Daftar layanan yang tersedia di SistAbsen (kartu putih di halaman login)
const LAYANAN_LIST = [
  'Informasi Absensi QR Check-in & Check-out Siswa dan Guru.',
  'Informasi Data Siswa, Guru, dan Kelas.',
  'Informasi Jadwal & Absensi Mata Pelajaran.',
  'Informasi Absensi Harian (Hadir, Terlambat, Izin, Sakit, Alpha).',
  'Informasi Rekapitulasi Kehadiran Harian & Bulanan.',
  'Informasi Rekapitulasi Nilai Siswa.',
  'Catatan Pelanggaran Tata Tertib Siswa.',
  'Cetak & Unduh Laporan (PDF dan CSV).',
  'Manajemen Akun Pengguna & Backup Data.',
]

export function LoginForm() {
  const { setUser, currentView, setView } = useAppStore()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [logo, setLogo] = useState<string>('')
  const [namaSekolah, setNamaSekolah] = useState<string>('')
  const [bgLogin, setBgLogin] = useState<string>('')

  useEffect(() => {
    api<Record<string, string>>('/api/pengaturan')
      .then((p) => {
        setLogo(p.logo_sekolah || '')
        setNamaSekolah(p.nama_sekolah || 'MTs Al Mukhtariyah')
        setBgLogin(p.bg_login || '')
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Username dan password wajib diisi')
      return
    }
    setLoading(true)
    try {
      const res = await api<{ user: any; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      localStorage.setItem('sistabsen_token', res.token)
      localStorage.setItem('sistabsen_user_id', res.user.id)
      setUser(res.user)
      // Hak akses: user terbatas (guru/kepala_sekolah) diarahkan ke
      // Scan QR Check-in jika view tersimpan tidak diizinkan
      if (!canAccessView(res.user.role, currentView)) {
        setView('absensi-qr-checkin')
      }
      toast.success(`Selamat datang, ${res.user.nama}!`)
    } catch (err: any) {
      toast.error(err.message || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-500 via-blue-700 to-blue-900 relative overflow-hidden">
      {/* Foto background dari menu Pengaturan (bg_login) */}
      {bgLogin && (
        <>
          <img
            src={bgLogin}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Lapisan biru transparan agar teks putih tetap terbaca */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-blue-900/75 via-blue-800/60 to-blue-900/80"
            aria-hidden="true"
          />
        </>
      )}

      {/* Dekorasi blur latar (gradasi biru estetik) */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-24 w-[28rem] h-[28rem] bg-cyan-300/10 rounded-full blur-3xl" />
      </div>

      {/* Bar header biru: teks sambutan kiri, logo kanan */}
      <header className="relative z-10 bg-white/10 backdrop-blur border-b border-white/15">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sky-100 text-sm">Selamat datang di</p>
            <h1 className="text-white text-lg sm:text-xl font-bold leading-tight">
              SistAbsen Web {namaSekolah}
            </h1>
          </div>
          <div className="flex items-center gap-2.5 sm:flex-col sm:items-end sm:gap-1 lg:flex-row lg:items-center lg:gap-2.5">
            {logo ? (
              <img
                src={logo}
                alt={`Logo ${namaSekolah}`}
                className="w-11 h-11 rounded-lg object-contain bg-white p-1 shadow-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-cyan-400 text-blue-900 flex items-center justify-center shadow-md">
                <GraduationCap className="w-6 h-6" />
              </div>
            )}
            <span className="text-white text-2xl font-extrabold tracking-tight drop-shadow-sm">
              Sist<span className="text-sky-300">Absen</span>
            </span>
          </div>
        </div>
      </header>

      {/* Konten utama: kartu layanan (kiri) + form login (kanan) */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 grid lg:grid-cols-5 gap-6 lg:gap-10 items-start">
        {/* Kartu putih daftar layanan */}
        <section
          className="lg:col-span-3 bg-white rounded-xl shadow-2xl p-5 sm:p-7 w-full"
          aria-label="Daftar layanan SistAbsen"
        >
          <p className="font-semibold text-gray-800 mb-4">
            Berikut layanan SistAbsen yang tersedia :
          </p>
          <ul className="space-y-3">
            {LAYANAN_LIST.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-blue-700" strokeWidth={3} aria-hidden="true" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Form login langsung di atas latar biru */}
        <section className="lg:col-span-2 w-full max-w-md lg:justify-self-end" aria-label="Formulir masuk">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-white font-medium">
                Username
              </Label>
              <div className="relative">
                <UserIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukan username anda disini"
                  className="pl-9 h-11 bg-white border-0 text-gray-800 placeholder:text-gray-400"
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukan password anda disini"
                  className="pl-9 h-11 bg-white border-0 text-gray-800 placeholder:text-gray-400"
                  autoComplete="current-password"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-sky-500 hover:bg-sky-400 text-white font-bold text-base shadow-lg shadow-blue-900/30"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
        </section>
      </main>

      {/* Footer kecil menempel di bawah */}
      <footer className="relative z-10 mt-auto">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 border-t border-white/10">
          <p className="text-center text-sky-100/80 text-xs">
            © 2025 SistAbsen · Sistem Absensi QR {namaSekolah}
          </p>
        </div>
      </footer>
    </div>
  )
}
