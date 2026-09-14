'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewKey =
  | 'dashboard'
  | 'siswa'
  | 'guru'
  | 'kelas'
  | 'mata-pelajaran'
  | 'jenis-pelanggaran'
  | 'pelanggaran'
  | 'absensi-mapel'
  | 'absensi-qr-checkin'
  | 'absensi-qr-checkout'
  | 'rekap-bulanan'
  | 'rekap-nilai'
  | 'backup'
  | 'panduan-hosting'
  | 'manajemen-akun'
  | 'pengaturan'
  | 'profil'

interface User {
  id: string
  username: string
  nama: string
  role: string
  email?: string | null
  telepon?: string | null
  foto?: string | null
}

// View yang bisa diakses user terbatas (Guru & Kepala Sekolah):
// dashboard, profil sendiri, scan absensi, catat pelanggaran, rekap,
// dan mata pelajaran (lihat saja, tanpa edit)
export const LIMITED_ACCESS_VIEWS: ViewKey[] = [
  'dashboard',
  'profil',
  'mata-pelajaran',
  'absensi-mapel',
  'absensi-qr-checkin',
  'absensi-qr-checkout',
  'pelanggaran',
  'rekap-bulanan',
  'rekap-nilai',
]

// Cek hak akses view berdasarkan role:
// - admin: akses penuh (tambah, hapus, edit data, atur akun user lain)
// - guru / kepala_sekolah: scan absensi, rekap, dan lihat mata pelajaran (read-only)
export const canAccessView = (
  role: string | null | undefined,
  view: ViewKey
): boolean => {
  if (role === 'admin') return true
  return LIMITED_ACCESS_VIEWS.includes(view)
}

interface AppState {
  user: User | null
  currentView: ViewKey
  sidebarOpen: boolean
  setUser: (u: User | null) => void
  setView: (v: ViewKey) => void
  setSidebar: (open: boolean) => void
  logout: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      currentView: 'dashboard',
      sidebarOpen: false,
      setUser: (u) => set({ user: u }),
      setView: (v) => set({ currentView: v, sidebarOpen: false }),
      setSidebar: (open) => set({ sidebarOpen: open }),
      logout: () => set({ user: null, currentView: 'dashboard' }),
    }),
    { name: 'sistabsen-store' }
  )
)
