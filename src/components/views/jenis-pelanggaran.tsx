'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface JenisPelanggaran {
  id: string
  nama: string
  poin: number
  kategori: string
  _count?: { pelanggaran: number }
}

export function JenisPelanggaranView() {
  const [list, setList] = useState<JenisPelanggaran[]>([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<JenisPelanggaran | null>(null)
  // Simpan item yang akan dihapus (bukan hanya id) agar dialog bisa menampilkan nama & jumlah catatan
  const [deleteItem, setDeleteItem] = useState<JenisPelanggaran | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api<JenisPelanggaran[]>('/api/jenis-pelanggaran')
      setList(data)
    } catch (e) {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (form: any) => {
    try {
      if (editing) {
        await api(`/api/jenis-pelanggaran/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Jenis pelanggaran diperbarui')
      } else {
        await api('/api/jenis-pelanggaran', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Jenis pelanggaran ditambahkan')
      }
      setOpenForm(false); setEditing(null); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    try {
      await api(`/api/jenis-pelanggaran/${deleteItem.id}`, { method: 'DELETE' })
      toast.success('Jenis pelanggaran dihapus')
      setDeleteItem(null); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const kategoriStyle: Record<string, string> = {
    'ringan': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'sedang': 'bg-amber-100 text-amber-700 border-amber-200',
    'berat': 'bg-red-100 text-red-700 border-red-200',
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Jenis Pelanggaran
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Daftar jenis pelanggaran dan poinnya</p>
            </div>
            <Button onClick={() => { setEditing(null); setOpenForm(true) }} className="bg-blue-700 hover:bg-blue-800">
              <Plus className="w-4 h-4 mr-1" /> Tambah Jenis
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Nama Pelanggaran</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Poin</TableHead>
                    <TableHead>Pencatatan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((p, i) => (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{p.nama}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={kategoriStyle[p.kategori]}>
                          {p.kategori}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-amber-600">{p.poin}</span> poin
                      </TableCell>
                      <TableCell>{p._count?.pelanggaran || 0}x</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(p); setOpenForm(true) }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteItem(p)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <JpForm open={openForm} onOpenChange={setOpenForm} editing={editing} onSave={handleSave} />

      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const jumlah = deleteItem?._count?.pelanggaran || 0
                if (!deleteItem) return ''
                if (jumlah > 0) {
                  return `Yakin ingin menghapus "${deleteItem.nama}"? Sebanyak ${jumlah} catatan pelanggaran siswa yang memakai jenis ini akan ikut terhapus.`
                }
                return `Yakin ingin menghapus "${deleteItem.nama}"?`
              })()}
            </AlertDialogDescription>
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

function JpForm({ open, onOpenChange, editing, onSave }: any) {
  const [form, setForm] = useState<any>({ kategori: 'ringan', poin: 5 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({ nama: editing.nama, poin: editing.poin, kategori: editing.kategori })
    } else {
      setForm({ kategori: 'ringan', poin: 5 })
    }
  }, [editing, open])

  const submit = async () => {
    if (!form.nama) { toast.error('Nama pelanggaran wajib diisi'); return }
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Jenis Pelanggaran' : 'Tambah Jenis Pelanggaran'}</DialogTitle>
          <DialogDescription>Lengkapi data jenis pelanggaran</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nama Pelanggaran *</Label>
            <Input placeholder="cth: Terlambat masuk sekolah" value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ringan">Ringan</SelectItem>
                  <SelectItem value="sedang">Sedang</SelectItem>
                  <SelectItem value="berat">Berat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Poin</Label>
              <Input type="number" min="0" max="100" value={form.poin || 0} onChange={(e) => setForm({ ...form, poin: Number(e.target.value) })} />
            </div>
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
