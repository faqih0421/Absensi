'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, formatDate } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ShieldAlert, Plus, Trash2, Loader2, Search, ClipboardList, Gauge, Users, Trophy, X } from 'lucide-react'
import { toast } from 'sonner'
import { tanggalWIB } from '@/lib/utils'

interface Kelas { id: string; namaKelas: string }
interface Siswa { id: string; nis: string; nama: string; kelas?: Kelas | null }
interface JenisPelanggaran { id: string; nama: string; poin: number; kategori: string }
interface Pelanggaran {
  id: string
  siswaId: string
  jenisPelanggaranId: string
  tanggal: string
  catatan?: string | null
  siswa: { nama: string; nis: string; kelas: Kelas | null }
  jenisPelanggaran: { nama: string; poin: number; kategori: string }
}

const kategoriStyle: Record<string, string> = {
  'ringan': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'sedang': 'bg-amber-100 text-amber-700 border-amber-200',
  'berat': 'bg-red-100 text-red-700 border-red-200',
}

const scrollbarCls = '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30'

const ymd = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function PelanggaranView() {
  const user = useAppStore((s) => s.user)
  const role = user?.role || ''
  const canCreate = role === 'admin' || role === 'guru'
  const canDelete = role === 'admin'

  const [history, setHistory] = useState<Pelanggaran[]>([])
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [jenisList, setJenisList] = useState<JenisPelanggaran[]>([])
  const [loading, setLoading] = useState(true)

  const [openForm, setOpenForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Filter riwayat
  const [filterKelas, setFilterKelas] = useState<string>('all')
  const [filterCari, setFilterCari] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  const kelasList = useMemo(() => {
    const map = new Map<string, string>()
    siswaList.forEach((s) => { if (s.kelas) map.set(s.kelas.id, s.kelas.namaKelas) })
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }))
  }, [siswaList])

  const load = async () => {
    setLoading(true)
    try {
      const [pel, siswa, jenis] = await Promise.all([
        api<Pelanggaran[]>('/api/pelanggaran'),
        api<Siswa[]>('/api/siswa'),
        api<JenisPelanggaran[]>('/api/jenis-pelanggaran'),
      ])
      setHistory(pel)
      setSiswaList(siswa)
      setJenisList(jenis)
    } catch {
      toast.error('Gagal memuat data pelanggaran')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ===== Ringkasan bulan ini (client-side dari riwayat) =====
  const now = new Date()
  const bulanIni = history.filter((h) => {
    const d = new Date(h.tanggal)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const totalBulanIni = bulanIni.length
  const totalPoinBulanIni = bulanIni.reduce((a, h) => a + (h.jenisPelanggaran?.poin || 0), 0)
  const siswaTerlibat = new Set(bulanIni.map((h) => h.siswaId)).size
  const siswaTertinggi = useMemo(() => {
    const perSiswa: Record<string, { nama: string; poin: number }> = {}
    bulanIni.forEach((h) => {
      if (!perSiswa[h.siswaId]) perSiswa[h.siswaId] = { nama: h.siswa?.nama || '-', poin: 0 }
      perSiswa[h.siswaId].poin += h.jenisPelanggaran?.poin || 0
    })
    const sorted = Object.values(perSiswa).sort((a, b) => b.poin - a.poin)
    return sorted[0] || null
  }, [bulanIni])

  // ===== Riwayat terfilter (client-side) =====
  const filtered = useMemo(() => history.filter((h) => {
    if (filterKelas !== 'all' && h.siswa?.kelas?.id !== filterKelas) return false
    if (filterCari.trim()) {
      const q = filterCari.trim().toLowerCase()
      const nama = (h.siswa?.nama || '').toLowerCase()
      const nis = h.siswa?.nis || ''
      if (!nama.includes(q) && !nis.includes(q)) return false
    }
    if (filterStart && ymd(h.tanggal) < filterStart) return false
    if (filterEnd && ymd(h.tanggal) > filterEnd) return false
    return true
  }), [history, filterKelas, filterCari, filterStart, filterEnd])

  const resetFilter = () => {
    setFilterKelas('all')
    setFilterCari('')
    setFilterStart('')
    setFilterEnd('')
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api(`/api/pelanggaran/${deleteId}`, { method: 'DELETE' })
      toast.success('Catatan pelanggaran dihapus')
      setDeleteId(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Gagal menghapus')
    }
  }

  const stats = [
    {
      label: 'Pelanggaran Bulan Ini',
      value: String(totalBulanIni),
      icon: ClipboardList,
      iconCls: 'bg-amber-100 text-amber-700',
    },
    {
      label: 'Total Poin Bulan Ini',
      value: String(totalPoinBulanIni),
      icon: Gauge,
      iconCls: 'bg-red-100 text-red-700',
    },
    {
      label: 'Siswa Terlibat Bulan Ini',
      value: String(siswaTerlibat),
      icon: Users,
      iconCls: 'bg-blue-100 text-blue-700',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                Catatan Pelanggaran Siswa
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Catat dan pantau poin pelanggaran siswa sekolah
              </p>
            </div>
            {canCreate && (
              <Button onClick={() => setOpenForm(true)} className="bg-blue-700 hover:bg-blue-800">
                <Plus className="w-4 h-4 mr-1" /> Catat Pelanggaran
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconCls}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-700">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Siswa Poin Tertinggi (Bulan Ini)</p>
              {siswaTertinggi ? (
                <p className="font-bold truncate" title={siswaTertinggi.nama}>
                  {siswaTertinggi.nama} <span className="text-amber-600 font-semibold whitespace-nowrap">({siswaTertinggi.poin} poin)</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter riwayat */}
      <Card>
        <CardContent className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>Kelas</Label>
            <Select value={filterKelas} onValueChange={setFilterKelas}>
              <SelectTrigger><SelectValue placeholder="Semua kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {kelasList.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cari Nama / NIS</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="cth: Ahmad atau 1234"
                className="pl-9"
                value={filterCari}
                onChange={(e) => setFilterCari(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Dari Tanggal</Label>
            <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sampai Tanggal</Label>
            <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Tabel riwayat */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Riwayat Pelanggaran ({filtered.length})</CardTitle>
          <CardDescription>
            {filterKelas !== 'all' || filterCari || filterStart || filterEnd
              ? 'Menampilkan hasil filter — klik reset untuk melihat semua'
              : 'Seluruh catatan pelanggaran siswa, terbaru di atas'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Belum ada catatan pelanggaran.</p>
            </div>
          ) : (
            <div className={`border rounded-lg overflow-hidden max-h-96 overflow-y-auto ${scrollbarCls}`}>
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 z-10">
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Jenis Pelanggaran</TableHead>
                    <TableHead>Poin</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Catatan</TableHead>
                    {canDelete && <TableHead className="text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p, i) => (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(p.tanggal)}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{p.siswa?.nama}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.siswa?.nis}</p>
                      </TableCell>
                      <TableCell className="text-sm">{p.siswa?.kelas?.namaKelas || '-'}</TableCell>
                      <TableCell className="text-sm font-medium">{p.jenisPelanggaran?.nama}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 font-semibold">
                          {p.jenisPelanggaran?.poin ?? 0} poin
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={kategoriStyle[p.jenisPelanggaran?.kategori] || ''}>
                          {p.jenisPelanggaran?.kategori || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-40">
                        {p.catatan ? (
                          <span className="text-xs text-muted-foreground line-clamp-2" title={p.catatan}>{p.catatan}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {canDelete && (
                        <TableCell>
                          <div className="flex items-center justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" aria-label={`Hapus pelanggaran ${p.siswa?.nama}`} onClick={() => setDeleteId(p.id)}>
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

      {/* Dialog catat pelanggaran */}
      {canCreate && (
        <CatatPelanggaranDialog
          open={openForm}
          onOpenChange={setOpenForm}
          siswaList={siswaList}
          jenisList={jenisList}
          onSaved={load}
        />
      )}

      {/* Konfirmasi hapus */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus catatan pelanggaran ini? Poin siswa akan berkurang.
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

// ===== Form catat pelanggaran (dialog) =====
function CatatPelanggaranDialog({
  open,
  onOpenChange,
  siswaList,
  jenisList,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  siswaList: Siswa[]
  jenisList: JenisPelanggaran[]
  onSaved: () => void
}) {
  const [cariSiswa, setCariSiswa] = useState('')
  const [siswaId, setSiswaId] = useState('')
  const [jenisId, setJenisId] = useState('')
  const [tanggal, setTanggal] = useState(tanggalWIB())
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setCariSiswa('')
      setSiswaId('')
      setJenisId('')
      setTanggal(tanggalWIB())
      setCatatan('')
    }
  }, [open])

  const selectedSiswa = siswaList.find((s) => s.id === siswaId)
  const selectedJenis = jenisList.find((j) => j.id === jenisId)

  // Daftar siswa terfilter pencarian, dikelompokkan per kelas
  const grouped = useMemo(() => {
    const q = cariSiswa.trim().toLowerCase()
    const filteredSiswa = siswaList.filter((s) => {
      if (!q) return true
      return s.nama.toLowerCase().includes(q) || s.nis.includes(q)
    })
    const map = new Map<string, Siswa[]>()
    filteredSiswa.forEach((s) => {
      const key = s.kelas?.namaKelas || 'Tanpa Kelas'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [siswaList, cariSiswa])

  const submit = async () => {
    if (!siswaId) { toast.error('Pilih siswa terlebih dahulu'); return }
    if (!jenisId) { toast.error('Pilih jenis pelanggaran terlebih dahulu'); return }
    setSaving(true)
    try {
      await api('/api/pelanggaran', {
        method: 'POST',
        body: JSON.stringify({
          siswaId,
          jenisPelanggaranId: jenisId,
          // Kirim string 'YYYY-MM-DD' apa adanya — konversi toISOString() membuat tanggal mundur 1 hari
          tanggal,
          catatan: catatan.trim() || undefined,
        }),
      })
      toast.success(`Pelanggaran dicatat: ${selectedSiswa?.nama} - ${selectedJenis?.nama} (${selectedJenis?.poin} poin)`)
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan pelanggaran')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat Pelanggaran Siswa</DialogTitle>
          <DialogDescription>Pilih siswa dan jenis pelanggaran yang terjadi</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Pilih siswa */}
          <div className="space-y-1.5">
            <Label>Pilih Siswa *</Label>
            {selectedSiswa ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedSiswa.nama}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    NIS {selectedSiswa.nis} · {selectedSiswa.kelas?.namaKelas || 'Tanpa Kelas'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setSiswaId('')}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama atau NIS siswa…"
                    className="pl-9"
                    value={cariSiswa}
                    onChange={(e) => setCariSiswa(e.target.value)}
                  />
                </div>
                <div className={`border rounded-lg max-h-48 overflow-y-auto ${scrollbarCls}`}>
                  {grouped.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">Siswa tidak ditemukan.</p>
                  ) : (
                    grouped.map(([kelasNama, list]) => (
                      <div key={kelasNama}>
                        <p className="sticky top-0 bg-muted/80 backdrop-blur px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b">
                          Kelas {kelasNama}
                        </p>
                        {list.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors border-b last:border-b-0"
                            onClick={() => setSiswaId(s.id)}
                          >
                            <span className="font-medium truncate">{s.nama}</span>
                            <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{s.nis}</span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Jenis pelanggaran */}
          <div className="space-y-1.5">
            <Label>Jenis Pelanggaran *</Label>
            <Select value={jenisId} onValueChange={setJenisId}>
              <SelectTrigger><SelectValue placeholder="Pilih jenis pelanggaran" /></SelectTrigger>
              <SelectContent>
                {jenisList.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.nama} ({j.poin} poin)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tanggal */}
          <div className="space-y-1.5">
            <Label>Tanggal</Label>
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>

          {/* Catatan */}
          <div className="space-y-1.5">
            <Label>Catatan (opsional)</Label>
            <Textarea
              placeholder="cth: Terlambat 15 menit saat pelajaran pertama"
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
