import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Ambil akun terautentikasi dari header x-auth-id (disisipkan middleware
// setelah verifikasi x-auth-token — tidak bisa dipalsukan client).
export async function getAuthUser(req: NextRequest) {
  const id = req.headers.get('x-auth-id')
  if (!id) return null
  const akun = await db.akun.findUnique({ where: { id } })
  if (!akun || !akun.aktif) return null
  return akun
}

// Guard: wajib login; opsi wajib role tertentu.
// Return NextResponse error ATAU null bila lolos.
export async function requireAuth(req: NextRequest, roles?: string[]) {
  const user = await getAuthUser(req)
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Tidak diizinkan. Silakan login ulang.' },
        { status: 401 }
      ),
    }
  }
  if (roles && !roles.includes(user.role)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Akses ditolak. Hanya admin yang dapat melakukan aksi ini.' },
        { status: 403 }
      ),
    }
  }
  return { user, error: null }
}
