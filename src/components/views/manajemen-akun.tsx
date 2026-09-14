'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, UserPlus, Loader2, ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/api'
import { useAppStore } from '@/lib/store'

interface Akun {
  id: string
  username: string
  nama: string
  role: string
  email?: string | null
  telepon?: string | null
  aktif: boolean
  lastLogin?: string | null
  createdAt: string
}

export function ManajemenAkunView() {
  const { user } = useAppStore()
  const [list, setList] = useState<Akun[]>([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Akun | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api<Akun[]>('/api/akun')
      setList(data)
    } catch (e) {
      toast.error('Gagal memuat data akun')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (form: any) => {
    try {
      if (editing) {
        await api(`/api/akun/${editing.id}`, { method: 'PUT', headers: { 'x-user-id': user?.id || '' }, body: JSON.stringify(form) })
        toast.success('Akun diperbarui')
      } else {
        await api('/api/akun', { method: 'POST', headers: { 'x-user-id': user?.id || '' }, body: JSON.stringify(form) })
        toast.success('Akun baru ditambahkan')
      }
      setOpenForm(false); setEditing(null); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api(`/api/akun/${deleteId}`, { method: 'DELETE', headers: { 'x-user-id': user?.id || '' } })
      toast.success('Akun dihapus')
      setDeleteId(null); load()
    } catch (e: any) { toast.error(e.message) }
  }

  const roleColor: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 border-red-200',
    guru: 'bg-blue-100 text-blue-700 border-blue-200',
    kepala_sekolah: 'bg-purple-100 text-purple-700 border-purple-200',
    operator: 'bg-amber-100 text-amber-700 border-amber-200',
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Manajemen Akun
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Kelola akun pengguna sistem</p>
            </div>
            <Button onClick={() => { setEditing(null); setOpenForm(true) }} className="bg-blue-700 hover:bg-blue-800">
              <Plus className="w-4 h-4 mr-1" /> Tambah Akun
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
                    <TableHead>Username</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Login Terakhir</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((a, i) => (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-0.5 rounded text-xs">{a.username}</code>
                          {a.id === user?.id && (
                            <Badge variant="outline" className="text-xs">Anda</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{a.nama}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleColor[a.role]}>
                          {a.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{a.email || '-'}</TableCell>
                      <TableCell>
                        {a.aktif ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300 gap-1">
                            <ShieldCheck className="w-3 h-3" /> Aktif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-700 border-red-300 gap-1">
                            <ShieldAlert className="w-3 h-3" /> Nonaktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.lastLogin ? formatDate(a.lastLogin) : 'Belum pernah'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(a); setOpenForm(true) }} disabled={a.id === user?.id}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteId(a.id)} disabled={a.id === user?.id}>
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

      <AkunForm open={openForm} onOpenChange={setOpenForm} editing={editing} onSave={handleSave} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Akun</AlertDialogTitle>
            <AlertDialogDescription>Yakin ingin menghapus akun ini? Pengguna tidak akan dapat login lagi.</AlertDialogDescription>
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

function AkunForm({ open, onOpenChange, editing, onSave }: any) {
  const [form, setForm] = useState<any>({ role: 'operator', aktif: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        nama: editing.nama,
        role: editing.role,
        email: editing.email || '',
        telepon: editing.telepon || '',
        aktif: editing.aktif,
        password: '',
      })
    } else {
      setForm({ role: 'operator', aktif: true, email: '', telepon: '' })
    }
  }, [editing, open])

  const submit = async () => {
    if (!form.nama) { toast.error('Nama wajib diisi'); return }
    if (!editing && !form.username) { toast.error('Username wajib diisi'); return }
    // Validasi password baru (form tambah & edit): minimal 6 karakter
    if (!editing) {
      if (!form.password) { toast.error('Password wajib diisi'); return }
      if (form.password.length < 6) { toast.error('Password minimal 6 karakter'); return }
    } else if (form.password && form.password.length < 6) {
      toast.error('Password minimal 6 karakter')
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...form,
        username: form.username || editing?.username,
      })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Akun' : 'Tambah Akun Baru'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Perbarui data akun pengguna' : 'Buat akun baru untuk pengguna sistem'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Username {!editing && '*'}</Label>
            <Input
              placeholder="username login"
              value={form.username || editing?.username || ''}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              disabled={!!editing}
            />
            {editing && <p className="text-xs text-muted-foreground">Username tidak dapat diubah</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Nama Lengkap *</Label>
            <Input value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="guru">Guru</SelectItem>
                  <SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
                <Switch checked={form.aktif} onCheckedChange={(v) => setForm({ ...form, aktif: v })} />
                <span className="text-sm">{form.aktif ? 'Aktif' : 'Nonaktif'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Telepon</Label>
              <Input value={form.telepon || ''} onChange={(e) => setForm({ ...form, telepon: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <KeyRound className="w-3 h-3" />
              {editing ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}
            </Label>
            <Input
              type="password"
              placeholder={editing ? '••••••••' : 'Min. 6 karakter'}
              value={form.password || ''}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
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
