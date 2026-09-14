'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { Plus, Search, Pencil, Trash2, QrCode, Users, Loader2, Download, Upload } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { QrPrintSheet } from '@/components/qr-print-sheet'
import { ImportCsvDialog, ParsedRow } from '@/components/import-csv-dialog'
import { normalizeJk, normalizeTanggal } from '@/lib/csv'

interface Siswa {
  id: string
  nis: string
  nisn?: string | null
  nama: string
  jenisKelamin: string
  kelasId: string
  kelas?: { id: string; namaKelas: string }
  alamat?: string | null
  tempatLahir?: string | null
  tanggalLahir?: string | null
  qrToken: string
}

interface Kelas { id: string; namaKelas: string; tingkat: string; jurusan?: string | null }

export function SiswaView() {
  // ✅ Debounce search terpisah
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterKelas, setFilterKelas] = useState('all')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // ✅ Query key otomatis berubah → cache terpisah per kombinasi filter
  const queryParams = new URLSearchParams()
  if (filterKelas !== 'all') queryParams.set('kelasId', filterKelas)
  if (debouncedSearch) queryParams.set('search', debouncedSearch)
  const queryString = queryParams.toString()

  const {
    data: list = [],
    isLoading,
    isFetching,
  } = useApiQuery<Siswa[]>(
    ['siswa', { kelasId: filterKelas, search: debouncedSearch }],
    `/api/siswa${queryString ? `?${queryString}` : ''}`
  )

  // ✅ Kelas list — cached sekali, tidak refetch
  const { data: kelasList = [] } = useApiQuery<Kelas[]>('kelas', '/api/kelas')

  // ✅ Pengaturan — cached sekali
  const { data: pengaturanData } = useApiQuery<Record<string, string>>('pengaturan', '/api/pengaturan')
  const pengaturan = pengaturanData ?? {}

  const qc = useQueryClient()
  const { setView } = useAppStore()

  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Siswa | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [qrSiswa, setQrSiswa] = useState<Siswa | null>(null)
  const [showQrDownload, setShowQrDownload] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [printingQr, setPrintingQr] = useState(false)
  const [openImport, setOpenImport] = useState(false)

  // ✅ Invalidate cache setelah mutasi — data otomatis revalidate
  const invalidateSiswa = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['siswa'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }, [qc])

  const handleSave = async (form: any) => {
    try {
      if (editing) {
        await api(`/api/siswa/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Data siswa diperbarui')
      } else {
        await api('/api/siswa', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Siswa baru ditambahkan')
      }
      setOpenForm(false)
      setEditing(null)
      invalidateSiswa()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api(`/api/siswa/${deleteId}`, { method: 'DELETE' })
      toast.success('Siswa dihapus')
      setDeleteId(null)
      invalidateSiswa()
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
                <Users className="w-5 h-5 text-blue-600" />
                Daftar Siswa
                {isFetching && !isLoading && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Total {list.length} siswa terdaftar</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama/NIS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-48"
                />
              </div>
              <Select value={filterKelas} onValueChange={setFilterKelas}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {kelasList.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.namaKelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setShowQrDownload(true)} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                <Download className="w-4 h-4 mr-1" /> Download QR
              </Button>
              <Button variant="outline" onClick={() => setOpenImport(true)} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                <Upload className="w-4 h-4 mr-1" /> Import CSV
              </Button>
              <Button onClick={() => { setEditing(null); setOpenForm(true) }} className="bg-blue-700 hover:bg-blue-800">
                <Plus className="w-4 h-4 mr-1" /> Tambah Siswa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Tidak ada siswa. Klik "Tambah Siswa" untuk menambahkan.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>L/P</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((s, i) => (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{s.nis}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                            {s.nama.charAt(0)}
                          </div>
                          {s.nama}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.jenisKelamin === 'L' ? 'default' : 'secondary'}>
                          {s.jenisKelamin}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.kelas?.namaKelas || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQrSiswa(s)} title="Lihat QR Code">
                            <QrCode className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(s); setOpenForm(true) }} title="Edit">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteId(s.id)} title="Hapus">
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

      {/* Dialog download semua QR siswa */}
      <Dialog open={showQrDownload} onOpenChange={setShowQrDownload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Download Semua QR Code Siswa</DialogTitle>
            <DialogDescription>
              Semua QR Code siswa ({list.length} siswa). Klik "Cetak Semua QR" untuk mencetak atau menyimpan sebagai PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1">
            {list.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1 p-3 bg-white border rounded-lg">
                <div className="p-1 bg-white">
                  <QRCodeCanvas value={s.qrToken} size={90} level="H" />
                </div>
                <p className="text-xs font-semibold text-center leading-tight">{s.nama}</p>
                <p className="text-[10px] text-muted-foreground">NIS: {s.nis} · {s.kelas?.namaKelas || '-'}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQrDownload(false)}>Tutup</Button>
            <Button
              className="bg-blue-700 hover:bg-blue-800"
              disabled={list.length === 0 || printing || printingQr}
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
          items={list.map((s) => ({
            nama: s.nama,
            info1: `NIS: ${s.nis}`,
            info2: `Kelas: ${s.kelas?.namaKelas || '-'}`,
            token: s.qrToken,
          }))}
          sheetTitle="QR Code Siswa"
          onDone={() => setPrinting(false)}
        />
      )}

      <ImportCsvDialog
        open={openImport}
        onOpenChange={setOpenImport}
        title="Import Data Siswa dari CSV"
        description="Unggah file CSV berisi banyak siswa sekaligus. Unduh template untuk melihat format yang benar."
        templateName="template-import-siswa.csv"
        endpoint="/api/siswa/import"
        columns={[
          { key: 'nis', header: 'nis', required: true, example: '2024001' },
          { key: 'nama', header: 'nama', required: true, example: 'Ahmad Ilham' },
          { key: 'kelas', header: 'kelas', required: true, example: kelasList[0]?.namaKelas || '7A' },
          { key: 'jenis_kelamin', header: 'jenis_kelamin', example: 'L' },
          { key: 'nisn', header: 'nisn', example: '0091234567' },
          { key: 'tempat_lahir', header: 'tempat_lahir', example: 'Pamekasan' },
          { key: 'tanggal_lahir', header: 'tanggal_lahir', example: '2012-05-17' },
          { key: 'alamat', header: 'alamat', example: 'Jl. Raya No. 10' },
        ]}
        templateRows={[
          { nis: '2024001', nama: 'Ahmad Ilham', kelas: kelasList[0]?.namaKelas || '7A', jenis_kelamin: 'L', nisn: '0091234567', tempat_lahir: 'Pamekasan', tanggal_lahir: '2012-05-17', alamat: 'Jl. Raya No. 10' },
          { nis: '2024002', nama: 'Siti Rohmah', kelas: kelasList[0]?.namaKelas || '7A', jenis_kelamin: 'P', nisn: '0091234568', tempat_lahir: 'Sampang', tanggal_lahir: '17/05/2012', alamat: 'Jl. Merdeka No. 5' },
        ]}
        buildRows={(rawRows) => {
          const kelasMap = new Map(kelasList.map((k) => [k.namaKelas.toLowerCase(), k.namaKelas]))
          const seenNis = new Set<string>()
          const out: ParsedRow[] = []
          for (const r of rawRows) {
            const data = {
              nis: r.nis || '',
              nama: r.nama || '',
              kelas: r.kelas || '',
              jenis_kelamin: r.jenis_kelamin || '',
              nisn: r.nisn || '',
              tempat_lahir: r.tempat_lahir || '',
              tanggal_lahir: r.tanggal_lahir || '',
              alamat: r.alamat || '',
            }
            const errors: string[] = []
            if (!data.nis) errors.push('NIS kosong.')
            if (!data.nama) errors.push('Nama kosong.')
            if (!data.kelas) errors.push('Kelas kosong.')
            else if (!kelasMap.has(data.kelas.toLowerCase())) errors.push(`Kelas "${data.kelas}" tidak ditemukan.`)
            if (data.jenis_kelamin && !normalizeJk(data.jenis_kelamin)) errors.push('Jenis kelamin tidak dikenal (gunakan L/P).')
            if (data.tanggal_lahir && !normalizeTanggal(data.tanggal_lahir)) errors.push('Tanggal lahir tidak valid (YYYY-MM-DD atau DD/MM/YYYY).')
            if (data.nis && seenNis.has(data.nis)) errors.push('NIS duplikat di file.')
            if (data.nis) seenNis.add(data.nis)
            const send = {
              nis: data.nis,
              nama: data.nama,
              kelas: data.kelas,
              jenisKelamin: data.jenis_kelamin,
              nisn: data.nisn,
              tempatLahir: data.tempat_lahir,
              tanggalLahir: data.tanggal_lahir,
              alamat: data.alamat,
            }
            out.push({ data, send, errors })
          }
          return out
        }}
        onImported={invalidateSiswa}
      />

      <SiswaForm
        open={openForm}
        onOpenChange={setOpenForm}
        editing={editing}
        kelasList={kelasList}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus siswa ini? Tindakan ini tidak dapat dibatalkan, dan semua data terkait (absensi, nilai, pelanggaran) juga akan terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!qrSiswa} onOpenChange={(o) => !o && setQrSiswa(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code Siswa</DialogTitle>
            <DialogDescription>Gunakan QR ini untuk absensi check-in</DialogDescription>
          </DialogHeader>
          {qrSiswa && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="p-4 bg-white rounded-xl border-2">
                <QRCodeCanvas value={qrSiswa.qrToken} size={200} level="H" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">{qrSiswa.nama}</p>
                <p className="text-sm text-muted-foreground">NIS: {qrSiswa.nis}</p>
                <p className="text-sm text-muted-foreground">Kelas: {qrSiswa.kelas?.namaKelas}</p>
              </div>
              <Button className="w-full" variant="outline" disabled={printingQr} onClick={() => setPrintingQr(true)}>
                Cetak QR
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {printingQr && qrSiswa && (
        <QrSiswaPrintSheet
          nama={qrSiswa.nama}
          nis={qrSiswa.nis}
          kelas={qrSiswa.kelas?.namaKelas || '-'}
          token={qrSiswa.qrToken}
          namaSekolah={pengaturan.nama_sekolah || 'SistAbsen'}
          onDone={() => setPrintingQr(false)}
        />
      )}
    </div>
  )
}
function SiswaForm({ open, onOpenChange, editing, kelasList, onSave }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Siswa | null
  kelasList: Kelas[]
  onSave: (form: any) => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        nis: editing.nis,
        nisn: editing.nisn || '',
        nama: editing.nama,
        jenisKelamin: editing.jenisKelamin,
        kelasId: editing.kelasId,
        alamat: editing.alamat || '',
        tempatLahir: editing.tempatLahir || '',
        tanggalLahir: editing.tanggalLahir ? editing.tanggalLahir.split('T')[0] : '',
      })
    } else {
      setForm({ jenisKelamin: 'L', kelasId: kelasList[0]?.id || '' })
    }
  }, [editing, open])

  const submit = async () => {
    if (!form.nis || !form.nama || !form.kelasId) {
      toast.error('NIS, Nama, dan Kelas wajib diisi')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Siswa' : 'Tambah Siswa Baru'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Perbarui data siswa' : 'Isi data siswa baru dengan lengkap'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>NIS *</Label>
            <Input value={form.nis || ''} onChange={(e) => setForm({ ...form, nis: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>NISN</Label>
            <Input value={form.nisn || ''} onChange={(e) => setForm({ ...form, nisn: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Nama Lengkap *</Label>
            <Input value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
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
            <Label>Kelas *</Label>
            <Select value={form.kelasId} onValueChange={(v) => setForm({ ...form, kelasId: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
              <SelectContent>
                {kelasList.map(k => <SelectItem key={k.id} value={k.id}>{k.namaKelas}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tempat Lahir</Label>
            <Input value={form.tempatLahir || ''} onChange={(e) => setForm({ ...form, tempatLahir: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal Lahir</Label>
            <Input type="date" value={form.tanggalLahir || ''} onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })} />
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

function QrSiswaPrintSheet({ nama, nis, kelas, token, namaSekolah, onDone }: {
  nama: string
  nis: string
  kelas: string
  token: string
  namaSekolah: string
  onDone: () => void
}) {
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      onDoneRef.current()
    }
    window.addEventListener('afterprint', finish)
    const t = setTimeout(() => {
      window.print()
      finish()
    }, 400)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', finish)
    }
  }, [])

  return createPortal(
    <div id="print-area" className="hidden print:block" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="qr-print-card" style={{ maxWidth: 320, margin: '0 auto' }}>
        <p style={{ fontSize: 12, margin: '0 0 6px' }}>{namaSekolah}</p>
        <QRCodeCanvas value={token} size={200} level="H" />
        <p style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 2px' }}>{nama}</p>
        <p style={{ fontSize: 11, margin: 0 }}>NIS: {nis}</p>
        <p style={{ fontSize: 11, margin: 0 }}>Kelas: {kelas}</p>
      </div>
    </div>,
    document.body
  )
}

// ... SiswaForm & QrSiswaPrintSheet — copy persis dari file lama