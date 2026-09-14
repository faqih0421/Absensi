'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Menu, CalendarDays } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useEffect, useState } from 'react'

// Format tanggal Indonesia: "Senin, 17 Feb 2026" (panjang) dan "17 Feb" (ringkas)
const fmtPanjang = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const fmtRingkas = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
})

export function Topbar({ title }: { title: string }) {
  const { setSidebar, user } = useAppStore()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b px-4 lg:px-6 py-3 flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setSidebar(true)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      <div className="flex-1 min-w-0">
        <h2 className="text-lg lg:text-xl font-bold text-foreground truncate">{title}</h2>
        <p className="text-xs text-muted-foreground hidden sm:block">
          {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {now.toLocaleTimeString('id-ID')}
        </p>
      </div>

      {/* Tanggal hari ini (menggantikan pencarian & notifikasi yang non-fungsional) */}
      <div
        className="hidden sm:flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground flex-shrink-0"
        title={fmtPanjang.format(now)}
      >
        <CalendarDays className="w-4 h-4 text-blue-600" aria-hidden="true" />
        <span>{fmtPanjang.format(now)}</span>
      </div>
      <div className="sm:hidden flex items-center gap-1 flex-shrink-0 text-xs font-medium text-muted-foreground">
        <CalendarDays className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
        <span>{fmtRingkas.format(now)}</span>
      </div>

      <div className="flex items-center gap-2 pl-2 border-l">
        <Avatar className="w-9 h-9">
          {user?.foto ? <AvatarImage src={user.foto} alt={`Foto ${user?.nama || 'pengguna'}`} /> : null}
          <AvatarFallback className="bg-gradient-to-br from-blue-600 to-sky-700 text-white text-sm font-semibold">
            {user?.nama?.charAt(0) || 'A'}
          </AvatarFallback>
        </Avatar>
        <div className="hidden lg:block">
          <p className="text-sm font-semibold leading-tight">{user?.nama}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
        </div>
      </div>
    </header>
  )
}
