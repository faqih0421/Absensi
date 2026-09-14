import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth-server'

const ROLE_VALID = ['admin', 'guru', 'kepala_sekolah', 'operator']

function hashPassword(pw: string) {
  return crypto.createHash('sha256').update(pw).digest('hex')
}

// Kembalikan pesan error dalam bentuk JSON ramah (field `message` + `error`
// agar kompatibel dengan helper api() di sisi client)
function jsonError(message: string, status: number) {
  return NextResponse.json({ message, error: message }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if (auth.error) return auth.error
  try {
    const akun = await db.akun.findMany({ orderBy: { createdAt: 'desc' } })
    // strip passwords
    return NextResponse.json(akun.map(a => ({ ...a, password: undefined })))
  } catch (e) {
    console.error('List akun error:', e)
    return jsonError('Gagal memuat data akun', 500)
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if (auth.error) return auth.error
  try {
    const data = await req.json()
    // Validasi field wajib
    if (!data.username || String(data.username).trim() === '') {
      return jsonError('Username wajib diisi', 400)
    }
    if (String(data.username).trim().length < 3) {
      return jsonError('Username minimal 3 karakter', 400)
    }
    // Password kosong tidak lagi diam-diam diganti default
    if (!data.password || String(data.password).trim() === '') {
      return jsonError('Password wajib diisi untuk akun baru', 400)
    }
    if (String(data.password).length < 6) {
      return jsonError('Password minimal 6 karakter', 400)
    }
    if (!data.nama || String(data.nama).trim() === '') {
      return jsonError('Nama wajib diisi', 400)
    }
    // Whitelist role (sama dengan opsi di UI Manajemen Akun)
    const role = data.role || 'operator'
    if (!ROLE_VALID.includes(role)) {
      return jsonError('Role tidak valid', 400)
    }
    const akun = await db.akun.create({
      data: {
        username: data.username,
        password: hashPassword(data.password),
        nama: data.nama,
        role,
        email: data.email || null,
        telepon: data.telepon || null,
        aktif: data.aktif === undefined ? true : Boolean(data.aktif),
      },
    })
    return NextResponse.json({ ...akun, password: undefined })
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return jsonError('Username sudah dipakai', 409)
    }
    console.error('Create akun error:', e)
    return jsonError('Gagal menambahkan akun', 500)
  }
}
