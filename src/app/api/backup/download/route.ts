import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { requireAuth } from '@/lib/auth-server'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if (auth.error) return auth.error
  try {
    const { searchParams } = new URL(req.url)
    const file = searchParams.get('file')
    if (!file) return NextResponse.json({ error: 'File tidak disebutkan' }, { status: 400 })

    // Validasi nama file (prevent path traversal): hanya huruf, angka, titik, dash, underscore
    const safeName = path.basename(file)
    if (!/^[\w.-]+\.json$/.test(safeName)) {
      return NextResponse.json({ error: 'File tidak valid' }, { status: 400 })
    }

    const filePath = path.join(process.cwd(), 'download', safeName)
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })

    const content = fs.readFileSync(filePath)
    return new NextResponse(new Uint8Array(content), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    })
  } catch (e) {
    console.error('Download backup error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh backup' }, { status: 500 })
  }
}
