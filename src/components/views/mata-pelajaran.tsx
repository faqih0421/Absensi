'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, BookOpen, Loader2, Clock, Eye, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'

interface Guru { id: string; nama: string; nip: string }
interface Mapel {
  id: string
  nama: string
  guruId: string
  jam: string
  hari: string
  guru?: Guru
}

// Daftar hari mengajar (Senin-Jumat)
const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']

export function MataPelajaranView() {
  const user = useAppStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const [list, setList] = useState<Mapel[]>([])
  const [guruList, setGuruList] = useState<Guru[]>([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Mapel | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [data, guru] = await Promise.all([
        api<Mapel[]>('/api/mata-pelajaran'),
        api<Guru[]>('/api/guru'),
      ])
      setList(data); setGuruList(guru)
    } catch (e) {
      toast.error('Gagal memuat data mata pelajaran')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (form: any) => {
    try {
      if (editing) {
        await api(`/api/mata-pelajaran/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Mata pelajaran diperbarui')
      } else {
        await api('/api/mata-pelajaran', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Mata pelajaran ditambahkan')
      }
      setOpenForm(false); setEditing(null); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api(`/api/mata-pelajaran/${deleteId}`, { method: 'DELETE' })
      toast.success('Mata pelajaran dihapus')
      setDeleteId(null); load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Mata Pelajaran
                {!isAdmin && (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <Eye className="w-3 h-3" /> Hanya Lihat
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Total {list.length} mata pelajaran</p>
            </div>
            {isAdmin && (
              <Button onClick={() => { setEditing(null); setOpenForm(true) }} className="bg-blue-700 hover:bg-blue-800">
                <Plus className="w-4 h-4 mr-1" /> Tambah Mapel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Belum ada mata pelajaran terdaftar.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Mata Pelajaran</TableHead>
                    <TableHead>Guru Pengampu</TableHead>
                    <TableHead>Hari</TableHead>
                    <TableHead>Jam</TableHead>
                    {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((m, i) => (
                    <TableRow key={m.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{m.nama}</TableCell>
                      <TableCell>{m.guru?.nama || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
                          <CalendarDays className="w-3 h-3" /> {m.hari || 'Senin'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.jam ? (
                          <Badge variant="secondary" className="gap-1 font-mono">
                            <Clock className="w-3 h-3" /> {m.jam}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(m); setOpenForm(true) }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteId(m.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <MapelForm open={openForm} onOpenChange={setOpenForm} editing={editing} guruList={guruList} onSave={handleSave} />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>Yakin ingin menghapus mata pelajaran ini?</AlertDialogDescription>
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

function MapelForm({ open, onOpenChange, editing, guruList, onSave }: any) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      // jam tersimpan dalam format "HH:MM-HH:MM", pecah menjadi mulai & selesai
      const [mulai = '', selesai = ''] = (editing.jam || '').split('-')
      setForm({
        nama: editing.nama,
        guruId: editing.guruId,
        hari: editing.hari || 'Senin',
        jamMulai: mulai,
        jamSelesai: selesai,
      })
    } else {
      setForm({ hari: 'Senin', jamMulai: '', jamSelesai: '', guruId: guruList[0]?.id || '' })
    }
  }, [editing, open])

  const submit = async () => {
    if (!form.nama || !form.guruId) {
      toast.error('Nama dan Guru wajib diisi')
      return
    }
    if (!form.jamMulai || !form.jamSelesai) {
      toast.error('Jam mulai dan jam selesai wajib diisi')
      return
    }
    setSaving(true)
    try {
      await onSave({
        nama: form.nama,
        guruId: form.guruId,
        hari: form.hari || 'Senin',
        jam: `${form.jamMulai}-${form.jamSelesai}`,
      })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}</DialogTitle>
          <DialogDescription>Lengkapi data mata pelajaran</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Nama *</Label>
            <Input placeholder="cth: Matematika" value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Guru Pengampu *</Label>
            <Select value={form.guruId} onValueChange={(v) => setForm({ ...form, guruId: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih guru" /></SelectTrigger>
              <SelectContent>
                {guruList.map((g: Guru) => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Hari *</Label>
            <Select value={form.hari || 'Senin'} onValueChange={(v) => setForm({ ...form, hari: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih hari" /></SelectTrigger>
              <SelectContent>
                {HARI_LIST.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Jam Mulai *</Label>
            <Input type="time" value={form.jamMulai || ''} onChange={(e) => setForm({ ...form, jamMulai: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Jam Selesai *</Label>
            <Input type="time" value={form.jamSelesai || ''} onChange={(e) => setForm({ ...form, jamSelesai: e.target.value })} />
          </div>
          {form.jamMulai && form.jamSelesai && (
            <div className="col-span-2 rounded-lg bg-muted/50 border p-3 text-sm flex items-center gap-2 flex-wrap">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              <span>Jadwal: <strong>{form.hari || 'Senin'}</strong></span>
              <Clock className="w-4 h-4 text-blue-600 ml-2" />
              <span>Jam pelajaran: <strong className="font-mono">{form.jamMulai}-{form.jamSelesai}</strong></span>
            </div>
          )}
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
