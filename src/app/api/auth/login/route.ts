import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken } from '@/lib/auth'
import crypto from 'crypto'

function hashPassword(pw: string) {
  return crypto.createHash('sha256').update(pw).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
    }
    const akun = await db.akun.findUnique({ where: { username } })
    if (!akun || akun.password !== hashPassword(password)) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }
    if (!akun.aktif) {
      return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 })
    }
    await db.akun.update({ where: { id: akun.id }, data: { lastLogin: new Date() } })
    const { password: _, ...safeAkun } = akun
    return NextResponse.json({ user: safeAkun, token: await signToken(akun.id) })
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
