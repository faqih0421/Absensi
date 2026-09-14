'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, School, Clock, Save, Loader2, GraduationCap, ImagePlus, Trash2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { fileToCompressedDataUrl } from '@/lib/image'

export function PengaturanView() {
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  // loaded = true hanya bila data pengaturan BERHASIL diambil dari server.
  // Tanpa ini, form kosong bisa ter-render saat fetch gagal dan menimpa pengaturan saat disimpan.
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingBg, setUploadingBg] = useState(false)
  const bgInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<Record<string, string>>('/api/pengaturan')
      .then((data) => {
        setForm(data)
        setLoaded(true)
      })
      .catch(() => toast.error('Gagal memuat pengaturan'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api('/api/pengaturan', { method: 'PUT', body: JSON.stringify(form) })
      toast.success('Pengaturan disimpan')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (PNG, JPG, SVG, dll)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB')
      return
    }
    setUploadingLogo(true)
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 256)
      setForm((prev) => ({ ...prev, logo_sekolah: dataUrl }))
      toast.success('Logo siap disimpan. Klik "Simpan Pengaturan" untuk menerapkan.')
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses logo')
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (PNG, JPG, dll)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB')
      return
    }
    setUploadingBg(true)
    try {
      // Kompres sisi terpanjang ke 1600px (kualitas 0.72) agar ringan namun tetap tajam sebagai latar
      const dataUrl = await fileToCompressedDataUrl(file, 1600, 0.72)
      setForm((prev) => ({ ...prev, bg_login: dataUrl }))
      toast.success('Background siap disimpan. Klik "Simpan Pengaturan" untuk menerapkan.')
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses foto')
    } finally {
      setUploadingBg(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
  }

  // Jangan render form bila data belum berhasil dimuat (hindari simpan form kosong)
  if (!loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <p className="text-sm text-muted-foreground text-center">Pengaturan belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Pengaturan Sistem
          </CardTitle>
          <CardDescription>Konfigurasi aplikasi absensi sekolah</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="sekolah">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="sekolah" className="gap-2"><School className="w-4 h-4" /> Sekolah</TabsTrigger>
          <TabsTrigger value="absensi" className="gap-2"><Clock className="w-4 h-4" /> Absensi</TabsTrigger>
          <TabsTrigger value="akademik" className="gap-2"><GraduationCap className="w-4 h-4" /> Akademik</TabsTrigger>
        </TabsList>

        <TabsContent value="sekolah" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identitas Sekolah</CardTitle>
              <CardDescription>Informasi yang akan tampil di laporan dan dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Sekolah */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-24 h-24 rounded-xl bg-white border-2 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {form.logo_sekolah ? (
                      <img src={form.logo_sekolah} alt="Logo Sekolah" className="w-full h-full object-contain" />
                    ) : (
                      <GraduationCap className="w-10 h-10 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">Logo Sekolah</p>
                    <p className="text-xs text-muted-foreground">
                      Logo akan tampil di sidebar dan halaman login. Format PNG/JPG/SVG, maksimal 2MB.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        disabled={uploadingLogo}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {uploadingLogo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1" />}
                        Upload Logo
                      </Button>
                      {form.logo_sekolah && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setForm((prev) => ({ ...prev, logo_sekolah: '' }))}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Hapus
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Background Halaman Login */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-40 h-24 rounded-xl border-2 overflow-hidden flex-shrink-0">
                    {form.bg_login ? (
                      <img src={form.bg_login} alt="Background Halaman Login" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 via-blue-700 to-blue-900 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-white/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">Background Halaman Login</p>
                    <p className="text-xs text-muted-foreground">
                      Foto akan tampil sebagai latar halaman login dengan lapisan biru transparan agar teks tetap terbaca.
                      Format PNG/JPG, maksimal 5MB.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <input
                        ref={bgInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleBgUpload}
                        disabled={uploadingBg}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        disabled={uploadingBg}
                        onClick={() => bgInputRef.current?.click()}
                      >
                        {uploadingBg ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1" />}
                        Upload Foto
                      </Button>
                      {form.bg_login && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setForm((prev) => ({ ...prev, bg_login: '' }))}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Hapus
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nama Sekolah</Label>
                  <Input value={form.nama_sekolah || ''} onChange={(e) => setForm({ ...form, nama_sekolah: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>NPSN</Label>
                  <Input value={form.npsn || ''} onChange={(e) => setForm({ ...form, npsn: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telepon</Label>
                  <Input value={form.telepon_sekolah || ''} onChange={(e) => setForm({ ...form, telepon_sekolah: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email_sekolah || ''} onChange={(e) => setForm({ ...form, email_sekolah: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Alamat</Label>
                  <Input value={form.alamat_sekolah || ''} onChange={(e) => setForm({ ...form, alamat_sekolah: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Kepala Sekolah</Label>
                  <Input value={form.kepala_sekolah || ''} onChange={(e) => setForm({ ...form, kepala_sekolah: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="absensi" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pengaturan Waktu Absensi</CardTitle>
              <CardDescription>Batas waktu check-in dan check-out</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Jam Masuk</Label>
                  <Input type="time" value={form.jam_masuk || '07:00'} onChange={(e) => setForm({ ...form, jam_masuk: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Waktu mulai sekolah</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Batas Terlambat</Label>
                  <Input type="time" value={form.jam_terlambat || '07:15'} onChange={(e) => setForm({ ...form, jam_terlambat: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Setelah jam ini = terlambat</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Jam Pulang</Label>
                  <Input type="time" value={form.jam_pulang || '15:30'} onChange={(e) => setForm({ ...form, jam_pulang: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Waktu check-out guru</p>
                </div>
              </div>
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <p>Siswa yang check-in setelah <strong>{form.jam_terlambat || '07:15'}</strong> akan otomatis ditandai sebagai
                <strong> Terlambat</strong> dan menit keterlambatan akan dicatat.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="akademik" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tahun Akademik</CardTitle>
              <CardDescription>Periode tahun ajaran aktif</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tahun Ajaran</Label>
                  <Input placeholder="cth: 2025/2026" value={form.tahun_ajaran || ''} onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Semester</Label>
                  <Input placeholder="Ganjil / Genap" value={form.semester || ''} onChange={(e) => setForm({ ...form, semester: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Simpan Pengaturan
        </Button>
      </div>
    </div>
  )
}
