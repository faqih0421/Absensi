'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api'
import { LoginForm } from '@/components/auth/login-form'
import { AppShell } from '@/components/app-shell'
import { Toaster } from '@/components/ui/sonner'

export default function Home() {
  const { user } = useAppStore()
  const [mounted, setMounted] = useState(false)

  // Hydration guard — jangan render sebelum store selesai hydrate
  useEffect(() => {
    setMounted(true)
  }, [])

  // Seed check di BACKGROUND — tidak blocking render
  useEffect(() => {
    if (!mounted) return
    ;(async () => {
      try {
        const status = await api<{ seeded: boolean }>('/api/seed')
        if (!status.seeded) {
          await api('/api/seed', { method: 'POST' })
        }
      } catch {
        // Silent — app tetap jalan
      }
    })()
  }, [mounted])

  // Render UI langsung — tidak tunggu seed check
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-blue-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {user ? <AppShell /> : <LoginForm />}
      <Toaster richColors position="top-right" />
    </>
  )
}