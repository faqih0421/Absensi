// Helper untuk fetch API dengan credentials + token sesi
export async function api<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('sistabsen_token')
      : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  }
  if (token) headers['x-auth-token'] = token

  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({ error: 'Request gagal' }))

  // Sesi berakhir / token tidak valid -> bersihkan sesi & kembali ke halaman login
  if (res.status === 401 && !url.includes('/api/auth/login')) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sistabsen_token')
      localStorage.removeItem('sistabsen_user_id')
      localStorage.removeItem('sistabsen-store')
      window.location.reload()
    }
    throw new Error(data.error || 'Sesi berakhir, silakan login ulang')
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const formatDate = (d: string | Date) => {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const formatTime = (d: string | Date) => {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export const formatDateTime = (d: string | Date) => {
  return `${formatDate(d)} ${formatTime(d)}`
}
