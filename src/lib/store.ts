'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewKey =
  | 'dashboard' | 'siswa' | 'guru' | 'kelas' | 'mata-pelajaran'
  | 'jenis-pelanggaran' | 'pelanggaran' | 'absensi-mapel'
  | 'absensi-qr-checkin' | 'absensi-qr-checkout'
  | 'rekap-bulanan' | 'rekap-nilai' | 'backup' | 'panduan-hosting'
  | 'manajemen-akun' | 'pengaturan' | 'profil'

interface User {
  id: string; username: string; nama: string; role: string
  email?: string | null; telepon?: string | null; foto?: string | null
}

export const LIMITED_ACCESS_VIEWS: ViewKey[] = [
  'dashboard', 'profil', 'mata-pelajaran', 'absensi-mapel',
  'absensi-qr-checkin', 'absensi-qr-checkout',
  'pelanggaran', 'rekap-bulanan', 'rekap-nilai',
]

export const canAccessView = (role: string | null | undefined, view: ViewKey): boolean => {
  if (role === 'admin') return true
  return LIMITED_ACCESS_VIEWS.includes(view)
}

interface AppState {
  user: User | null
  currentView: ViewKey
  sidebarOpen: boolean
  openMenus: string[]
  setUser: (u: User | null) => void
  setView: (v: ViewKey) => void
  setSidebar: (open: boolean) => void
  setOpenMenus: (menus: string[]) => void
  toggleMenu: (label: string) => void
  logout: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      currentView: 'dashboard',
      sidebarOpen: false,
      openMenus: ['Data Master'],
      setUser: (u) => set({ user: u }),
      setView: (v) => set({ currentView: v, sidebarOpen: false }),
      setSidebar: (open) => set({ sidebarOpen: open }),
      setOpenMenus: (menus) => set({ openMenus: menus }),
      toggleMenu: (label) => set((s) => ({
        openMenus: s.openMenus.includes(label)
          ? s.openMenus.filter(l => l !== label)
          : [...s.openMenus, label],
      })),
      logout: () => set({
        user: null,
        currentView: 'dashboard',
        openMenus: ['Data Master'],
      }),
    }),
    {
      name: 'sistabsen-store',
      partialize: (state) => ({
        user: state.user,
        currentView: state.currentView,
        openMenus: state.openMenus,
      }),
    }
  )
)