'use client'

import { useEffect, useState } from 'react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Pencil, Trash2, QrCode, UserCog, Loader2, Download, Upload } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { toast } from 'sonner'
import { QrPrintSheet } from '@/components/qr-print-sheet'
import { ImportCsvDialog, ParsedRow } from '@/components/import-csv-dialog'
import { normalizeJk, normalizeRole } from '@/lib/csv'

interface Guru {
  id: string
  nip: string
  nama: string
  jenisKelamin: string
  role: string
  telepon?: string | null
  alamat?: string | null
  qrToken: string
  kelasWali?: { id: string; namaKelas: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  guru: 'Guru',
  kepala_sekolah: 'Kepala Sekolah',
  admin: 'Admin',
}

export function GuruView() {
  // ✅ Search dengan debounce
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // ✅ Query dengan key depend pada search → cache terpisah per kata kunci
  const {
    data: list = [],
    isLoading,
    isFetching,
  } = useApiQuery<Guru[]>(
    ['guru', { search: debouncedSearch }],
    `/api/guru${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ''}`
  )

  const qc = useQueryClient()

  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Guru | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [qrGuru, setQrGuru] = useState<Guru | null>(null)
  const [showQrDownload, setShowQrDownload] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [openImport, setOpenImport] = useState(false)

  // ✅ Invalidate cache guru & dashboard setelah mutasi
  const invalidateGuru = () => {
    qc.invalidateQueries({ queryKey: ['guru'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const handleSave = async (form: any) => {
    try {
      if (editing) {
        await api(`/api/guru/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Data guru diperbarui')
      } else {
        await api('/api/guru', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Guru baru ditambahkan')
      }
      setOpenForm(false)
      setEditing(null)
      invalidateGuru()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api(`/api/guru/${deleteId}`, { method: 'DELETE' })
      toast.success('Guru dihapus')
      setDeleteId(null)
      invalidateGuru()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-blue-600" />
                Daftar Guru
                {isFetching && !isLoading && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Total {list.length} guru terdaftar</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Cari nama/NIP..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full sm:w-48" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShowQrDownload(true)} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Download className="w-4 h-4 mr-1" /> Download QR
                </Button>
                <Button variant="outline" onClick={() => setOpenImport(true)} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Upload className="w-4 h-4 mr-1" /> Import CSV
                </Button>
                <Button onClick={() => { setEditing(null); setOpenForm(true) }} className="bg-blue-700 hover:bg-blue-800">
                  <Plus className="w-4 h-4 mr-1" /> Tambah Guru
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCog className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Belum ada guru terdaftar.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">No</TableHead>
                    <TableHead className="hidden md:table-cell">NIP</TableHead>
                    <TableHead>Nama Guru</TableHead>
                    <TableHead>L/P</TableHead>
                    <TableHead className="hidden md:table-cell">Wali Kelas</TableHead>
                    <TableHead className="hidden lg:table-cell">Role</TableHead>
                    <TableHead className="hidden lg:table-cell">Telepon</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((g, i) => (
                    <TableRow key={g.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs hidden md:table-cell">{g.nip}</TableCell>
                      <TableCell className="font-medium max-w-[128px] md:max-w-none">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {g.nama.charAt(0)}
                          </div>
                          <span className="truncate" title={g.nama}>{g.nama}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={g.jenisKelamin === 'L' ? 'default' : 'secondary'}>{g.jenisKelamin}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {g.kelasWali ? <Badge variant="outline">{g.kelasWali.namaKelas}</Badge> : '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge
                          variant="outline"
                          className={g.role === 'kepala_sekolah'
                            ? 'bg-purple-100 text-purple-700 border-purple-200'
                            : 'bg-blue-100 text-blue-700 border-blue-200'}
                        >
                          {ROLE_LABELS[g.role] || g.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">{g.telepon || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQrGuru(g)} title="Lihat QR Code">
                            <QrCode className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(g); setOpenForm(true) }} title="Edit">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setDeleteId(g.id)} title="Hapus">
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

      {/* Dialog download semua QR guru */}
      <Dialog open={showQrDownload} onOpenChange={setShowQrDownload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Download Semua QR Code Guru</DialogTitle>
            <DialogDescription>
              Semua QR Code guru ({list.length} guru). Klik "Cetak Semua QR" untuk mencetak atau menyimpan sebagai PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1">
            {list.map((g) => (
              <div key={g.id} className="flex flex-col items-center gap-1 p-3 bg-white border rounded-lg">
                <div className="p-1 bg-white">
                  <QRCodeCanvas value={g.qrToken} size={90} level="H" />
                </div>
                <p className="text-xs font-semibold text-center leading-tight">{g.nama}</p>
                <p className="text-[10px] text-muted-foreground">NIP: {g.nip}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQrDownload(false)}>Tutup</Button>
            <Button
              className="bg-blue-700 hover:bg-blue-800"
              disabled={list.length === 0 || printing}
              onClick={() => {
                setShowQrDownload(false)
                setPrinting(true)
              }}
            >
              <Download className="w-4 h-4 mr-2" /> Cetak Semua QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printing && (
        <QrPrintSheet
          items={list.map((g) => ({
            nama: g.nama,
            info1: `NIP: ${g.nip}`,
            info2: `Role: ${ROLE_LABELS[g.role] || g.role}`,
            token: g.qrToken,
          }))}
          sheetTitle="QR Code Guru"
          onDone={() => setPrinting(false)}
        />
      )}

      <ImportCsvDialog
        open={openImport}
        onOpenChange={setOpenImport}
        title="Import Data Guru dari CSV"
        description="Unggah file CSV berisi banyak guru sekaligus. Unduh template untuk melihat format yang benar."
        templateName="template-import-guru.csv"
        endpoint="/api/guru/import"
        columns={[
          { key: 'nip', header: 'nip', required: true, example: '198501012010011001' },
          { key: 'nama', header: 'nama', required: true, example: 'Budi Santoso, S.Pd' },
          { key: 'jenis_kelamin', header: 'jenis_kelamin', example: 'L' },
          { key: 'role', header: 'role', example: 'guru' },
          { key: 'telepon', header: 'telepon', example: '081234567801' },
          { key: 'alamat', header: 'alamat', example: 'Jl. Merdeka No. 1' },
        ]}
        templateRows={[
          { nip: '198501012010011001', nama: 'Budi Santoso, S.Pd', jenis_kelamin: 'L', role: 'guru', telepon: '081234567801', alamat: 'Jl. Merdeka No. 1' },
          { nip: '199001202015012003', nama: 'Ahmad Fauzi, M.Pd', jenis_kelamin: 'L', role: 'kepala_sekolah', telepon: '081234567803', alamat: 'Jl. Diponegoro No. 3' },
        ]}
        buildRows={(rawRows) => {
          const seenNip = new Set<string>()
          const out: ParsedRow[] = []
          for (const r of rawRows) {
            const data = {
              nip: r.nip || '',
              nama: r.nama || '',
              jenis_kelamin: r.jenis_kelamin || '',
              role: r.role || '',
              telepon: r.telepon || '',
              alamat: r.alamat || '',
            }
            const errors: string[] = []
            if (!data.nip) errors.push('NIP kosong.')
            if (!data.nama) errors.push('Nama kosong.')
            if (data.jenis_kelamin && !normalizeJk(data.jenis_kelamin)) errors.push('Jenis kelamin tidak dikenal (gunakan L/P).')
            if (data.role && !normalizeRole(data.role)) errors.push('Role tidak dikenal (gunakan guru / kepala_sekolah / admin).')
            if (data.nip && seenNip.has(data.nip)) errors.push('NIP duplikat di file.')
            if (data.nip) seenNip.add(data.nip)
            const send = {
              nip: data.nip,
              nama: data.nama,
              jenisKelamin: data.jenis_kelamin,
              role: data.role,
              telepon: data.telepon,
              alamat: data.alamat,
            }
            out.push({ data, send, errors })
          }
          return out
        }}
        onImported={invalidateGuru}
      />

      <GuruForm open={openForm} onOpenChange={setOpenForm} editing={editing} onSave={handleSave} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>Yakin ingin menghapus guru ini?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!qrGuru} onOpenChange={(o) => !o && setQrGuru(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code Guru</DialogTitle>
            <DialogDescription>Gunakan QR ini untuk check-in/out guru</DialogDescription>
          </DialogHeader>
          {qrGuru && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="p-4 bg-white rounded-xl border-2">
                <QRCodeCanvas value={qrGuru.qrToken} size={200} level="H" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">{qrGuru.nama}</p>
                <p className="text-sm text-muted-foreground">NIP: {qrGuru.nip}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GuruForm({ open, onOpenChange, editing, onSave }: any) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        nip: editing.nip,
        nama: editing.nama,
        jenisKelamin: editing.jenisKelamin,
        role: editing.role || 'guru',
        telepon: editing.telepon || '',
        alamat: editing.alamat || '',
      })
    } else {
      setForm({ jenisKelamin: 'L', role: 'guru' })
    }
  }, [editing, open])

  const submit = async () => {
    if (!form.nip || !form.nama) {
      toast.error('NIP dan Nama wajib diisi')
      return
    }
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Guru' : 'Tambah Guru Baru'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>NIP *</Label>
            <Input value={form.nip || ''} onChange={(e) => setForm({ ...form, nip: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Jenis Kelamin</Label>
            <Select value={form.jenisKelamin} onValueChange={(v) => setForm({ ...form, jenisKelamin: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="guru">Guru</SelectItem>
                <SelectItem value="kepala_sekolah">Kepala Sekolah</SelectItem>
                {form.role === 'admin' && <SelectItem value="admin">Admin</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Nama Lengkap *</Label>
            <Input value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Telepon</Label>
            <Input value={form.telepon || ''} onChange={(e) => setForm({ ...form, telepon: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Alamat</Label>
            <Input value={form.alamat || ''} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
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