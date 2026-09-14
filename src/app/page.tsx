'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api'
import { LoginForm } from '@/components/auth/login-form'
import { AppShell } from '@/components/app-shell'
import { Toaster } from '@/components/ui/sonner'

export default function Home() {
  const { user } = useAppStore()
  const [bootstrapped, setBootstrapped] = useState(false)
  const [seeding, setSeeding] = useState(false)

  // Saat pertama load, cek status seed database
  useEffect(() => {
    ;(async () => {
      try {
        const status = await api<{ seeded: boolean }>('/api/seed')
        if (!status.seeded) {
          setSeeding(true)
          await api('/api/seed', { method: 'POST' })
          setSeeding(false)
        }
      } catch (e) {
        console.error('Seed check error:', e)
      } finally {
        setBootstrapped(true)
      }
    })()
  }, [])

  if (!bootstrapped || seeding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-blue-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-blue-800">
              {seeding ? 'Memuat data awal...' : 'Memuat aplikasi...'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              SistAbsen - Sistem Absensi QR
            </p>
          </div>
        </div>
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
