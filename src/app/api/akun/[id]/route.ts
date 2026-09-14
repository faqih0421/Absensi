import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { getAuthUser } from '@/lib/auth-server'

const ROLE_VALID = ['admin', 'guru', 'kepala_sekolah', 'operator']

function hashPassword(pw: string) {
  return crypto.createHash('sha256').update(pw).digest('hex')
}

// Kembalikan pesan error dalam bentuk JSON ramah (field `message` + `error`
// agar kompatibel dengan helper api() di sisi client)
function jsonError(message: string, status: number) {
  return NextResponse.json({ message, error: message }, { status })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const data = await req.json()
    const akunLama = await db.akun.findUnique({ where: { id } })
    if (!akunLama) return jsonError('Akun tidak ditemukan', 404)

    // Identitas user aktif dari header x-auth-id (terverifikasi middleware,
    // TIDAK bisa dipalsukan client — bukan x-user-id)
    const user = await getAuthUser(req)
    if (!user) {
      return jsonError('Tidak diizinkan. Silakan login ulang.', 401)
    }
    const isSelf = user.id === id
    // Aksi pada akun ORANG LAIN hanya boleh admin
    if (!isSelf && user.role !== 'admin') {
      return jsonError('Akses ditolak. Hanya admin yang dapat melakukan aksi ini.', 403)
    }

    const updateData: any = {}

    // Data profil dasar: boleh diubah sendiri maupun oleh admin
    if (data.nama !== undefined) updateData.nama = data.nama
    if (data.email !== undefined) updateData.email = data.email
    if (data.telepon !== undefined) updateData.telepon = data.telepon
    if (data.foto !== undefined) updateData.foto = data.foto

    if (!isSelf) {
      // Role & status aktif hanya bisa diubah admin pada akun orang lain
      if (data.role !== undefined && data.role !== null) {
        if (!ROLE_VALID.includes(data.role)) {
          return jsonError('Role tidak valid', 400)
        }
        updateData.role = data.role
      }
      if (data.aktif !== undefined) updateData.aktif = Boolean(data.aktif)
    }

    if (data.password) {
      if (String(data.password).length < 6) {
        return jsonError('Password minimal 6 karakter', 400)
      }
      if (isSelf) {
        // Perubahan password akun sendiri (halaman profil): wajib verifikasi password lama
        if (!data.passwordLama || String(data.passwordLama) === '') {
          return jsonError('Password lama wajib diisi', 400)
        }
        if (hashPassword(String(data.passwordLama)) !== akunLama.password) {
          return jsonError('Password lama salah', 400)
        }
      } else if (data.passwordLama) {
        // Kalau password lama ikut dikirim untuk akun orang lain, verifikasi juga
        if (hashPassword(String(data.passwordLama)) !== akunLama.password) {
          return jsonError('Password lama salah', 400)
        }
      }
      // Tanpa passwordLama & bukan akun sendiri -> reset password oleh admin (boleh)
      updateData.password = hashPassword(String(data.password))
    }

    // Guard: admin aktif terakhir tidak boleh dinonaktifkan/diturunkan role-nya
    if (
      akunLama.role === 'admin' &&
      akunLama.aktif &&
      (data.aktif === false || (data.role && data.role !== 'admin'))
    ) {
      const adminLainAktif = await db.akun.count({
        where: { role: 'admin', aktif: true, NOT: { id } },
      })
      if (adminLainAktif < 1) {
        return jsonError('Minimal harus ada satu admin aktif', 409)
      }
    }

    const akun = await db.akun.update({ where: { id }, data: updateData })
    return NextResponse.json({ ...akun, password: undefined })
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return jsonError('Akun tidak ditemukan', 404)
    }
    console.error('Update akun error:', e)
    return jsonError('Gagal memperbarui akun', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    // Hanya admin yang boleh menghapus akun
    const user = await getAuthUser(req)
    if (!user) {
      return jsonError('Tidak diizinkan. Silakan login ulang.', 401)
    }
    if (user.role !== 'admin') {
      return jsonError('Akses ditolak. Hanya admin yang dapat melakukan aksi ini.', 403)
    }

    // Tolak jika akun yang dihapus adalah akun yang sedang login
    // (identitas dari x-auth-id terverifikasi, bukan x-user-id)
    if (user.id === id) {
      return jsonError('Tidak dapat menghapus akun yang sedang Anda gunakan', 409)
    }

    const akun = await db.akun.findUnique({ where: { id } })
    if (!akun) return jsonError('Akun tidak ditemukan', 404)

    // Guard: jangan biarkan tidak ada admin tersisa
    if (akun.role === 'admin' && akun.aktif) {
      const adminLainAktif = await db.akun.count({
        where: { role: 'admin', aktif: true, NOT: { id } },
      })
      if (adminLainAktif < 1) {
        return jsonError('Minimal harus ada satu admin aktif', 409)
      }
    }

    await db.akun.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return jsonError('Akun tidak ditemukan', 404)
    }
    console.error('Delete akun error:', e)
    return jsonError('Gagal menghapus akun', 500)
  }
}
