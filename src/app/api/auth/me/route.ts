import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    // Identitas dari header x-auth-id (terverifikasi middleware)
    const userId = req.headers.get('x-auth-id')
    if (!userId) return NextResponse.json({ user: null })
    const akun = await db.akun.findUnique({ where: { id: userId } })
    if (!akun || !akun.aktif) return NextResponse.json({ user: null })
    const { password, ...safe } = akun
    return NextResponse.json({ user: safe })
  } catch (e) {
    console.error('Auth me error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
