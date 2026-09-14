'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useApiQuery } from '@/hooks/use-api-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, School, Loader2, Users, UserCog } from 'lucide-react'
import { toast } from 'sonner'

interface Guru { id: string; nip: string; nama: string }
interface Kelas {
  id: string
  namaKelas: string
  tingkat: string
  jurusan?: string | null
  walikelasId?: string | null
  walikelas?: Guru | null
  _count?: { siswa: number }
}

export function KelasView() {
  // ✅ Kelas list — cached
  const {
    data: list = [],
    isLoading,
    isFetching,
  } = useApiQuery<Kelas[]>('kelas', '/api/kelas')

  // ✅ Guru list (untuk dropdown wali kelas) — cached terpisah
  const { data: guruList = [] } = useApiQuery<Guru[]>('guru', '/api/guru')

  const qc = useQueryClient()

  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Kelas | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const invalidateKelas = () => {
    qc.invalidateQueries({ queryKey: ['kelas'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['guru'] }) // Wali kelas di guru ikut berubah
  }

  const handleSave = async (form: any) => {
    try {
      if (editing) {
        await api(`/api/kelas/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Data kelas diperbarui')
      } else {
        await api('/api/kelas', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Kelas baru ditambahkan')
      }
      setOpenForm(false)
      setEditing(null)
      invalidateKelas()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api(`/api/kelas/${deleteId}`, { method: 'DELETE' })
      toast.success('Kelas dihapus')
      setDeleteId(null)
      invalidateKelas()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const tingkatColor: Record<string, string> = {
    '7': 'bg-sky-100 text-sky-700 border-sky-200',
    '8': 'bg-amber-100 text-amber-700 border-amber-200',
    '9': 'bg-purple-100 text-purple-700 border-purple-200',
  }

  const waliTerpakai = useMemo(() => {
    const m: Record<string, string> = {}
    list.forEach((k) => {
      if (k.walikelasId) m[k.walikelasId] = k.namaKelas
    })
    return m
  }, [list])

  const waliTerpakaiForm = useMemo(() => {
    if (!editing?.walikelasId) return waliTerpakai
    const m = { ...waliTerpakai }
    delete m[editing.walikelasId]
    return m
  }, [waliTerpakai, editing])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <School className="w-5 h-5 text-blue-600" />
                Daftar Kelas
                {isFetching && !isLoading && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Total {list.length} kelas aktif</p>
            </div>
            <Button onClick={() => { setEditing(null); setOpenForm(true) }} className="bg-blue-700 hover:bg-blue-800">
              <Plus className="w-4 h-4 mr-1" /> Tambah Kelas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <School className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Belum ada kelas terdaftar.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((k) => (
                <Card key={k.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="p-4 border-b bg-gradient-to-br from-sky-50 to-blue-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={tingkatColor[k.tingkat]}>Tingkat {k.tingkat}</Badge>
                            <h3 className="font-bold text-lg">{k.namaKelas}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{k.jurusan || '-'}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(k); setOpenForm(true) }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteId(k.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <UserCog className="w-4 h-4" /> Wali Kelas
                        </span>
                        <span className="font-medium truncate max-w-32">{k.walikelas?.nama || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Users className="w-4 h-4" /> Siswa
                        </span>
                        <Badge variant="secondary">{k._count?.siswa || 0} siswa</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <KelasForm open={openForm} onOpenChange={setOpenForm} editing={editing} guruList={guruList} waliTerpakai={waliTerpakaiForm} onSave={handleSave} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>Yakin ingin menghapus kelas ini?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function KelasForm({ open, onOpenChange, editing, guruList, waliTerpakai = {}, onSave }: any) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        namaKelas: editing.namaKelas,
        tingkat: editing.tingkat,
        jurusan: editing.jurusan || '',
        walikelasId: editing.walikelasId || 'none',
      })
    } else {
      setForm({ tingkat: '7', walikelasId: 'none' })
    }
  }, [editing, open])

  const submit = async () => {
    if (!form.namaKelas) {
      toast.error('Nama kelas wajib diisi')
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...form,
        walikelasId: form.walikelasId === 'none' ? null : form.walikelasId,
      })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Kelas' : 'Tambah Kelas Baru'}</DialogTitle>
          <DialogDescription>Isi data kelas dengan lengkap</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Nama Kelas *</Label>
            <Input placeholder="cth: 7A" value={form.namaKelas || ''} onChange={(e) => setForm({ ...form, namaKelas: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tingkat</Label>
            <Select value={form.tingkat} onValueChange={(v) => setForm({ ...form, tingkat: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 (Tujuh)</SelectItem>
                <SelectItem value="8">8 (Delapan)</SelectItem>
                <SelectItem value="9">9 (Sembilan)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Jurusan</Label>
            <Input placeholder="cth: Rekayasa Perangkat Lunak" value={form.jurusan || ''} onChange={(e) => setForm({ ...form, jurusan: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Wali Kelas</Label>
            <Select value={form.walikelasId} onValueChange={(v) => setForm({ ...form, walikelasId: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih wali kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
                {guruList.map((g: Guru) => {
                  const kelasWali: string | undefined = waliTerpakai[g.id]
                  return (
                    <SelectItem key={g.id} value={g.id} disabled={!!kelasWali}>
                      {g.nama}{kelasWali ? ` — sudah wali kelas ${kelasWali}` : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editing ? 'Perbarui' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}