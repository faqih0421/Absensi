'use client'

import { useEffect } from 'react'
import { useAppStore, canAccessView, ViewKey } from '@/lib/store'
import { api } from '@/lib/api'
import { Dashboard } from '@/components/views/dashboard'
import { SiswaView } from '@/components/views/siswa'
import { GuruView } from '@/components/views/guru'
import { KelasView } from '@/components/views/kelas'
import { MataPelajaranView } from '@/components/views/mata-pelajaran'
import { JenisPelanggaranView } from '@/components/views/jenis-pelanggaran'
import { PelanggaranView } from '@/components/views/pelanggaran'
import { AbsensiMapelView } from '@/components/views/absensi-mapel'
import { AbsensiQrView } from '@/components/views/absensi-qr'
import { RekapBulananView } from '@/components/views/rekap-bulanan'
import { RekapNilaiView } from '@/components/views/rekap-nilai'
import { BackupView } from '@/components/views/backup'
import { PanduanHostingView } from '@/components/views/panduan-hosting'
import { ManajemenAkunView } from '@/components/views/manajemen-akun'
import { PengaturanView } from '@/components/views/pengaturan'
import { ProfilView } from '@/components/views/profil'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'

const VIEW_COMPONENTS: Record<ViewKey, React.ComponentType> = {
  'dashboard': Dashboard, 'siswa': SiswaView, 'guru': GuruView,
  'kelas': KelasView, 'mata-pelajaran': MataPelajaranView,
  'jenis-pelanggaran': JenisPelanggaranView, 'pelanggaran': PelanggaranView,
  'absensi-mapel': AbsensiMapelView, 'absensi-qr-checkin': AbsensiQrView,
  'absensi-qr-checkout': AbsensiQrView, 'rekap-bulanan': RekapBulananView,
  'rekap-nilai': RekapNilaiView, 'backup': BackupView,
  'panduan-hosting': PanduanHostingView, 'manajemen-akun': ManajemenAkunView,
  'pengaturan': PengaturanView, 'profil': ProfilView,
}

const VIEW_TITLES: Record<ViewKey, string> = {
  'dashboard': 'Dashboard', 'siswa': 'Data Siswa', 'guru': 'Data Guru',
  'kelas': 'Data Kelas', 'mata-pelajaran': 'Mata Pelajaran',
  'jenis-pelanggaran': 'Jenis Pelanggaran',
  'pelanggaran': 'Catatan Pelanggaran Siswa',
  'absensi-mapel': 'Absensi Mata Pelajaran',
  'absensi-qr-checkin': 'Absensi Scan QR - Check In',
  'absensi-qr-checkout': 'Absensi Scan QR - Check Out Guru',
  'rekap-bulanan': 'Rekap Bulanan Kehadiran',
  'rekap-nilai': 'Rekap Nilai Siswa', 'backup': 'Backup Database',
  'panduan-hosting': 'Panduan Deployment ke Hosting',
  'manajemen-akun': 'Manajemen Akun', 'pengaturan': 'Pengaturan',
  'profil': 'Profil Akun',
}

export function AppShell() {
  const { currentView, setView, user, logout } = useAppStore()
  const CurrentView = VIEW_COMPONENTS[currentView] || Dashboard
  const title = VIEW_TITLES[currentView]

  // Revalidasi sesi — hanya sekali per mount AppShell
  useEffect(() => {
    if (!user) return
    let cancelled = false
    api<{ user: { id: string } | null }>('/api/auth/me')
      .then(res => { if (!cancelled && !res?.user) logout() })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, logout])

  const diizinkan = user ? canAccessView(user.role, currentView) : false

  useEffect(() => {
    if (user && !diizinkan) setView('absensi-qr-checkin')
  }, [user, diizinkan, setView])

  if (user && !diizinkan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-6">
        <div className="max-w-sm w-full bg-white border rounded-xl shadow-sm p-6 text-center">
          <h2 className="text-lg font-bold text-foreground">Akses Ditolak</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Akun Anda hanya dapat mengakses fitur Scan Absensi dan Rekap.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* TANPA key — komponen TIDAK remount saat ganti view.
                React Query akan return cached data secara instan.
                Skeleton hanya muncul kalau belum ada cache. */}
            <CurrentView />
          </div>
        </main>
      </div>
    </div>
  )
}