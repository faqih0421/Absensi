'use client'

import Link from 'next/link'
import { useAppStore, ViewKey, canAccessView } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  UserCog,
  School,
  BookOpen,
  AlertTriangle,
  QrCode,
  CalendarCheck,
  ClipboardList,
  BarChart3,
  Database,
  UserPlus,
  Settings,
  LogOut,
  UserCircle,
  BookUser,
  ClipboardCheck,
  ShieldAlert,
  ChevronDown,
  X,
  Rocket,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface MenuItem {
  key?: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  children?: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }[]
}

const MENU: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Data Master',
    icon: Database,
    children: [
      { key: 'siswa', label: 'Siswa', icon: Users },
      { key: 'guru', label: 'Guru', icon: UserCog },
      { key: 'kelas', label: 'Kelas', icon: School },
      { key: 'jenis-pelanggaran', label: 'Jenis Pelanggaran', icon: AlertTriangle },
      { key: 'mata-pelajaran', label: 'Mata Pelajaran', icon: BookOpen },
    ],
  },
  {
    label: 'Absensi QR',
    icon: QrCode,
    children: [
      { key: 'absensi-mapel', label: 'Absensi Mapel', icon: BookUser },
      { key: 'absensi-qr-checkin', label: 'Scan QR Check-in', icon: ClipboardCheck },
      { key: 'absensi-qr-checkout', label: 'Scan QR Check-out Guru', icon: ClipboardCheck },
    ],
  },
  { key: 'pelanggaran', label: 'Catatan Pelanggaran', icon: ShieldAlert },
  {
    label: 'Rekap',
    icon: BarChart3,
    children: [
      { key: 'rekap-bulanan', label: 'Rekap Bulanan Kehadiran', icon: CalendarCheck },
      { key: 'rekap-nilai', label: 'Rekap Nilai', icon: ClipboardList },
    ],
  },
  { key: 'backup', label: 'Backup Database', icon: Database },
  { key: 'panduan-hosting', label: 'Panduan Hosting', icon: Rocket },
  { key: 'manajemen-akun', label: 'Manajemen Akun', icon: UserPlus },
  { key: 'pengaturan', label: 'Pengaturan', icon: Settings },
  { key: 'profil', label: 'Profil Akun', icon: UserCircle },
]

export function Sidebar() {
  const { currentView, setView, sidebarOpen, setSidebar, logout, user } = useAppStore()
  const [logo, setLogo] = useState<string>('')

  // Saring menu berdasarkan hak akses role:
  // - admin: semua menu tampil
  // - guru / kepala_sekolah: hanya Absensi QR dan Rekap
  const MENU_VISIBLE: MenuItem[] = MENU.map((item) => {
    if (!item.children) {
      return canAccessView(user?.role, item.key!) ? [item] : []
    }
    const children = item.children.filter((c) => canAccessView(user?.role, c.key))
    return children.length > 0 ? [{ ...item, children }] : []
  }).flat()

  const [openMenus, setOpenMenus] = useState<string[]>(() => {
    // Buka menu yang berisi view aktif
    for (const item of MENU_VISIBLE) {
      if (item.children?.some(c => c.key === currentView)) return [item.label]
    }
    return ['Data Master']
  })

  useEffect(() => {
    api<Record<string, string>>('/api/pengaturan')
      .then((p) => setLogo(p.logo_sekolah || ''))
      .catch(() => {})
  }, [])

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])
  }

  const isActive = (key?: ViewKey) => key === currentView
  const isChildActive = (item: MenuItem) => item.children?.some(c => c.key === currentView)

  const handleLogout = () => {
    logout()
    localStorage.removeItem('sistabsen_token')
    localStorage.removeItem('sistabsen_user_id')
    toast.success('Anda telah keluar dari sistem')
  }

  return (
    <>
      {/* Mobile overlay — selalu terpasang agar fade in/out berjalan halus */}
      <div
        aria-hidden="true"
        onClick={() => setSidebar(false)}
        className={cn(
          'fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden transition-opacity duration-300 ease-out motion-reduce:transition-none',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-sidebar text-sidebar-foreground flex flex-col shadow-2xl shadow-black/40 lg:shadow-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="Logo Sekolah" className="w-10 h-10 rounded-xl object-contain bg-white p-0.5" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center text-blue-900">
                <GraduationCap className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-lg leading-tight">SistAbsen</h1>
              <p className="text-xs text-sidebar-foreground/70">Absensi QR Sekolah</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200 hover:rotate-90 active:scale-90"
            onClick={() => setSidebar(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Menu */}
        <ScrollArea className="flex-1 py-3">
          <nav className="px-3 space-y-1">
            {MENU_VISIBLE.map((item) => {
              if (item.key && !item.children) {
                return (
                  <button
                    key={item.key}
                    onClick={() => setView(item.key!)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
                      isActive(item.key)
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              }
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
                      isChildActive(item)
                        ? 'text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    <motion.span
                      className="inline-flex"
                      animate={{ rotate: openMenus.includes(item.label) ? 180 : 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.span>
                  </button>
                  {/* Sub-menu dengan animasi spring halus (framer-motion) */}
                  <AnimatePresence initial={false}>
                    {openMenus.includes(item.label) && (
                      <motion.div
                        key="submenu"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          height: { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 },
                          opacity: { duration: 0.22, ease: 'easeOut' },
                        }}
                        className="overflow-hidden"
                      >
                        <motion.div
                          initial="tertutup"
                          animate="terbuka"
                          variants={{
                            terbuka: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
                          }}
                          className="ml-3 mt-1 mb-1 space-y-1 border-l border-sidebar-border pl-3"
                        >
                          {item.children!.map(child => (
                            <motion.div
                              key={child.key}
                              variants={{
                                tertutup: { opacity: 0, x: -8 },
                                terbuka: { opacity: 1, x: 0 },
                              }}
                              transition={{ duration: 0.22, ease: 'easeOut' }}
                            >
                              <button
                                onClick={() => setView(child.key)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
                                  isActive(child.key)
                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow'
                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                )}
                              >
                                <child.icon className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{child.label}</span>
                              </button>
                            </motion.div>
                          ))}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Logout */}
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/20 transition-all duration-200 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  )
}
