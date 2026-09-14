'use client'

import Link from 'next/link'
import { useAppStore, ViewKey, canAccessView } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import { useEffect, useRef, useState } from 'react'
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
  const {
    currentView,
    setView,
    sidebarOpen,
    setSidebar,
    logout,
    user,
    openMenus,
    toggleMenu,
  } = useAppStore()

  const [logo, setLogo] = useState<string>('')
  const navRef = useRef<HTMLDivElement>(null)

  const MENU_VISIBLE: MenuItem[] = MENU.map((item) => {
    if (!item.children) {
      return canAccessView(user?.role, item.key!) ? [item] : []
    }
    const children = item.children.filter((c) => canAccessView(user?.role, c.key))
    return children.length > 0 ? [{ ...item, children }] : []
  }).flat()

  useEffect(() => {
    api<Record<string, string>>('/api/pengaturan')
      .then((p) => setLogo(p.logo_sekolah || ''))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      const activeEl = navRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
      if (activeEl && navRef.current) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [currentView, openMenus])

  // ✅ toggleMenu TIDAK didefinisikan lagi di sini — sudah dari store
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
      {/* Mobile overlay */}
      <div
        aria-hidden="true"
        onClick={() => setSidebar(false)}
        className={cn(
          'fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <aside
        data-sidebar="true"
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 h-screen w-72 flex flex-col',
          'bg-[#0f1e3d] text-slate-100',
          'border-r border-white/5',
          'shadow-2xl shadow-black/40 lg:shadow-none',
          'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand */}
        <div className="flex-shrink-0 px-5 py-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logo ? (
                <img src={logo} alt="Logo Sekolah" className="w-10 h-10 rounded-xl object-contain bg-white p-0.5" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                  <GraduationCap className="w-6 h-6" />
                </div>
              )}
              <div>
                <h1 className="font-bold text-base leading-tight text-white">SistAbsen</h1>
                <p className="text-xs text-slate-400">Absensi QR Sekolah</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={() => setSidebar(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Menu — scrollable */}
        <div
          ref={navRef}
          className="flex-1 overflow-y-auto sidebar-scroll py-3 min-h-0"
        >
          <nav className="px-3 space-y-1">
            {MENU_VISIBLE.map((item) => {
              if (item.key && !item.children) {
                const active = isActive(item.key)
                return (
                  <button
                    key={item.key}
                    data-active={active}
                    onClick={() => setView(item.key!)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                      'transition-colors duration-150',
                      active
                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              }

              const childActive = isChildActive(item)
              const isOpen = openMenus.includes(item.label)

              return (
                <div key={item.label}>
                  <button
                    data-active={childActive}
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                      'transition-colors duration-150',
                      childActive
                        ? 'text-white bg-white/5'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    <motion.span
                      className="inline-flex"
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
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
                        <div className="ml-4 mt-1 mb-1 space-y-0.5 border-l border-white/10 pl-3">
                          {item.children!.map(child => {
                            const active = isActive(child.key)
                            return (
                              <button
                                key={child.key}
                                data-active={active}
                                onClick={() => setView(child.key)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                                  'transition-colors duration-150',
                                  active
                                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 font-medium'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                )}
                              >
                                <child.icon className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{child.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </nav>
        </div>

        {/* Logout — fixed bottom */}
        <div className="flex-shrink-0 p-3 border-t border-white/5 bg-[#0f1e3d]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 transition-colors duration-150"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  )
}