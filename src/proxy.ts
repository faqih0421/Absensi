import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Endpoint yang boleh diakses TANPA login:
// - health check, login, seed (bootstrap data awal)
const PUBLIC_PATHS = new Set(['/api', '/api/', '/api/auth/login', '/api/seed'])

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const method = req.method

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  // Pengaturan dibaca halaman login sebelum user masuk
  // (nama sekolah, logo, background login)
  if (pathname === '/api/pengaturan' && method === 'GET') {
    return NextResponse.next()
  }

  // Semua endpoint API lainnya wajib membawa token sesi yang valid
  const auth = await verifyToken(req.headers.get('x-auth-token'))
  if (!auth) {
    return NextResponse.json(
      {
        error: 'Sesi berakhir atau tidak valid. Silakan login ulang.',
        code: 'UNAUTHORIZED',
      },
      { status: 401 }
    )
  }

  // Teruskan identitas terverifikasi ke route handler (tidak bisa dipalsukan client)
  const headers = new Headers(req.headers)
  headers.set('x-auth-id', auth.id)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/api/:path*'],
}
