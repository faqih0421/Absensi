'use client'

import { useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserCircle, Mail, Phone, Shield, Calendar, Loader2, Save, KeyRound, LogIn, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/api'
import { fileToAvatarDataUrl } from '@/lib/image'

export function ProfilView() {
  const { user, setUser } = useAppStore()
  const [form, setForm] = useState({
    nama: user?.nama || '',
    email: user?.email || '',
    telepon: user?.telepon || '',
  })
  const [passwordForm, setPasswordForm] = useState({ passwordLama: '', password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await api(`/api/akun/${user.id}`, {
        method: 'PUT',
        headers: { 'x-user-id': user.id },
        body: JSON.stringify(form),
      })
      setUser({ ...user, ...form })
      toast.success('Profil diperbarui')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordForm.passwordLama) { toast.error('Password lama wajib diisi'); return }
    if (!passwordForm.password) { toast.error('Password baru wajib diisi'); return }
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error('Password baru dan konfirmasi tidak cocok')
      return
    }
    if (passwordForm.password.length < 6) {
      toast.error('Password baru minimal 6 karakter')
      return
    }
    setSavingPw(true)
    try {
      await api(`/api/akun/${user.id}`, {
        method: 'PUT',
        headers: { 'x-user-id': user.id },
        body: JSON.stringify({ password: passwordForm.password, passwordLama: passwordForm.passwordLama }),
      })
      toast.success('Password berhasil diubah')
      setPasswordForm({ passwordLama: '', password: '', confirm: '' })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingPw(false)
    }
  }

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (PNG, JPG, dll)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB')
      return
    }
    setUploadingFoto(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      const updated = await api<any>(`/api/akun/${user.id}`, {
        method: 'PUT',
        headers: { 'x-user-id': user.id },
        body: JSON.stringify({ foto: dataUrl }),
      })
      setUser({ ...user, foto: updated.foto || dataUrl })
      toast.success('Foto profil diperbarui')
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunggah foto')
    } finally {
      setUploadingFoto(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-blue-100">
                {user.foto ? <AvatarImage src={user.foto} alt={`Foto ${user.nama}`} /> : null}
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-sky-700 text-white text-3xl font-bold">
                  {user.nama.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFotoUpload}
                disabled={uploadingFoto}
              />
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                disabled={uploadingFoto}
                title="Ganti Foto Profil"
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-md hover:bg-blue-800 transition-colors disabled:opacity-60"
              >
                {uploadingFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold">{user.nama}</h2>
                <Badge variant="outline" className="text-blue-700 border-blue-300 capitalize">
                  <Shield className="w-3 h-3 mr-1" /> {user.role}
                </Badge>
              </div>
              <p className="text-muted-foreground">@{user.username}</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{user.email || 'Belum ada email'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{user.telepon || 'Belum ada telepon'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="profile" className="gap-2">
            <UserCircle className="w-4 h-4" /> Edit Profil
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <KeyRound className="w-4 h-4" /> Ubah Password
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit Informasi Profil</CardTitle>
              <CardDescription>Perbarui data diri Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nama Lengkap</Label>
                  <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telepon</Label>
                  <Input value={form.telepon} onChange={(e) => setForm({ ...form, telepon: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Simpan Perubahan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ubah Password</CardTitle>
              <CardDescription>Wajib memasukkan password lama. Password baru minimal 6 karakter.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Password Lama *</Label>
                <Input
                  type="password"
                  value={passwordForm.passwordLama}
                  onChange={(e) => setPasswordForm({ ...passwordForm, passwordLama: e.target.value })}
                  placeholder="Masukkan password saat ini"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Password Baru</Label>
                <Input
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Konfirmasi Password</Label>
                <Input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={savingPw} className="bg-blue-700 hover:bg-blue-800">
                  {savingPw ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  Ubah Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Akun</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <LogIn className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Login Terakhir</p>
                <p className="font-medium">{(user as any).lastLogin ? formatDate((user as any).lastLogin) : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Bergabung Sejak</p>
                <p className="font-medium">{(user as any).createdAt ? formatDate((user as any).createdAt) : '-'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
