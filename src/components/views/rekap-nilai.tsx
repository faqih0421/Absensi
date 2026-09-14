'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClipboardList, Loader2, Plus, Save, FileDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { escapeField } from '@/lib/csv'
import { tanggalWIB } from '@/lib/utils'

interface Mapel { id: string; nama: string; jam: string }
interface Kelas { id: string; namaKelas: string }
interface Siswa { id: string; nis: string; nama: string; kelas?: { namaKelas: string } }
interface Nilai {
  id: string
  siswa: { id: string; nis: string; nama: string; kelas?: { namaKelas: string } }
  mataPelajaran: { nama: string }
  jenisNilai: string
  nilai: number
  tanggal: string
}

const KKM_DEFAULT = 75

// Hitung nilai akhir berbobot HANYA dari komponen yang tersedia.
// Bobot: harian 0.2, tugas 0.3, uts 0.2, uas 0.3.
// Komponen yang belum ada (null/undefined) TIDAK dihitung sebagai 0 —
// rata-rata diambil hanya dari komponen yang ada, dibagi total bobotnya.
function hitungNilaiAkhir(komponen: {
  rataHarian?: number | null
  rataTugas?: number | null
  uts?: number | null
  uas?: number | null
}): number | null {
  const parts: Array<[number, number]> = []
  if (komponen.rataHarian != null) parts.push([komponen.rataHarian, 0.2])
  if (komponen.rataTugas != null) parts.push([komponen.rataTugas, 0.3])
  if (komponen.uts != null) parts.push([komponen.uts, 0.2])
  if (komponen.uas != null) parts.push([komponen.uas, 0.3])
  const totalBobot = parts.reduce((s, [, w]) => s + w, 0)
  return totalBobot > 0 ? parts.reduce((s, [v, w]) => s + v * w, 0) / totalBobot : null
}

// Predikat dari nilai akhir; null bila nilai akhir belum bisa dihitung
function predikatDari(akhir: number | null): string | null {
  if (akhir == null) return null
  return akhir >= 90 ? 'A' : akhir >= 80 ? 'B' : akhir >= 70 ? 'C' : 'D'
}

const JENIS_NILAI = [
  { value: 'harian', label: 'Harian' },
  { value: 'tugas', label: 'Tugas' },
  { value: 'uts', label: 'UTS' },
  { value: 'uas', label: 'UAS' },
]

export function RekapNilaiView() {
  const [tab, setTab] = useState<'list' | 'input'>('list')
  const [mapelList, setMapelList] = useState<Mapel[]>([])
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [selectedMapel, setSelectedMapel] = useState('')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [nilaiList, setNilaiList] = useState<Nilai[]>([])
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [loading, setLoading] = useState(false)
  const [openInput, setOpenInput] = useState(false)
  const [inputForm, setInputForm] = useState<{ jenisNilai: string; tanggal: string; nilaiMap: Record<string, string> }>({
    jenisNilai: 'harian',
    tanggal: tanggalWIB(),
    nilaiMap: {},
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<Mapel[]>('/api/mata-pelajaran').then(data => {
      setMapelList(data)
      if (data[0]) setSelectedMapel(data[0].id)
    }).catch(() => toast.error('Gagal memuat data mata pelajaran'))
    api<Kelas[]>('/api/kelas').then(setKelasList).catch(() => {})
  }, [])

  // Muat ulang daftar nilai saat mapel berubah
  useEffect(() => {
    if (!selectedMapel) return
    setLoading(true)
    api<Nilai[]>(`/api/nilai?mapelId=${selectedMapel}`)
      .then(setNilaiList)
      .catch(() => setNilaiList([]))
      .finally(() => setLoading(false))
  }, [selectedMapel])

  // Load siswa untuk kelas yang dipilih
  useEffect(() => {
    if (!selectedKelas) {
      setSiswaList([])
      return
    }
    api<Siswa[]>(`/api/siswa?kelasId=${selectedKelas}`)
      .then(setSiswaList)
      .catch(() => toast.error('Gagal memuat data siswa'))
  }, [selectedKelas])

  const handleOpenInput = () => {
    const init: Record<string, string> = {}
    siswaList.forEach(s => { init[s.id] = '' })
    setInputForm({
      jenisNilai: 'harian',
      tanggal: tanggalWIB(),
      nilaiMap: init,
    })
    setOpenInput(true)
  }

  const handleSaveNilai = async () => {
    // Validasi: nilai harus angka dalam rentang 0-100
    for (const s of siswaList) {
      const v = inputForm.nilaiMap[s.id]
      if (v === undefined || v === '') continue
      const num = Number(v)
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        toast.error('Nilai harus antara 0 dan 100')
        return
      }
    }
    const records = siswaList
      .filter(s => inputForm.nilaiMap[s.id] !== '')
      .map(s => ({
        siswaId: s.id,
        jenisNilai: inputForm.jenisNilai,
        nilai: Number(inputForm.nilaiMap[s.id]),
      }))
    if (records.length === 0) {
      toast.error('Isi minimal satu nilai')
      return
    }
    setSaving(true)
    try {
      await api('/api/nilai', {
        method: 'POST',
        body: JSON.stringify({
          mapelId: selectedMapel,
          tanggal: inputForm.tanggal,
          records,
        }),
      })
      toast.success(`Berhasil menyimpan ${records.length} nilai`)
      setOpenInput(false)
      // Refresh
      const refreshed = await api<Nilai[]>(`/api/nilai?mapelId=${selectedMapel}`)
      setNilaiList(refreshed)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    // Group by siswa
    const bySiswa: Record<string, { siswa: any; nilaiByJenis: Record<string, number[]> }> = {}
    for (const n of nilaiList) {
      const key = n.siswa.id
      if (!bySiswa[key]) {
        bySiswa[key] = { siswa: n.siswa, nilaiByJenis: { harian: [], tugas: [], uts: [], uas: [] } }
      }
      bySiswa[key].nilaiByJenis[n.jenisNilai].push(n.nilai)
    }
    const avg = (arr: number[]) => arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : null
    const rows = Object.values(bySiswa).map(({ siswa, nilaiByJenis }) => {
      const rataHarian = avg(nilaiByJenis.harian)
      const rataTugas = avg(nilaiByJenis.tugas)
      const uts = nilaiByJenis.uts.length ? nilaiByJenis.uts[0] : null
      const uas = nilaiByJenis.uas.length ? nilaiByJenis.uas[0] : null
      // Rumus sama dengan tabel: berbobot hanya dari komponen yang tersedia
      const akhir = hitungNilaiAkhir({ rataHarian, rataTugas, uts, uas })
      return [
        siswa.nis,
        siswa.nama,
        siswa.kelas?.namaKelas || '',
        rataHarian != null ? rataHarian.toFixed(1) : '',
        rataTugas != null ? rataTugas.toFixed(1) : '',
        uts != null ? uts : '',
        uas != null ? uas : '',
        akhir != null ? akhir.toFixed(1) : '',
      ]
    })
    const headers = ['NIS', 'Nama', 'Kelas', 'Rata Harian', 'Rata Tugas', 'UTS', 'UAS', 'Nilai Akhir']
    // BOM + CRLF agar aman dibuka di Excel
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(f => escapeField(String(f))).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Nama file pakai NAMA mapel (bukan id), karakter aneh disanitasi
    const namaMapel = (mapelList.find(m => m.id === selectedMapel)?.nama || 'rekap-nilai')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
    a.download = `rekap-nilai-${namaMapel}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV berhasil diunduh')
  }

  // Hitung rekap per siswa untuk ditampilkan
  const rekapBySiswa: Record<string, { siswa: any; nilai: { jenis: string; nilai: number; tanggal: string }[] }> = {}
  for (const n of nilaiList) {
    if (!rekapBySiswa[n.siswa.id]) rekapBySiswa[n.siswa.id] = { siswa: n.siswa, nilai: [] }
    rekapBySiswa[n.siswa.id].nilai.push({ jenis: n.jenisNilai, nilai: n.nilai, tanggal: n.tanggal })
  }

  const selectedMapelObj = mapelList.find(m => m.id === selectedMapel)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Rekap Nilai Siswa
          </CardTitle>
          <CardDescription>Kelola dan rekap nilai siswa per mata pelajaran</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Mata Pelajaran</Label>
              <Select value={selectedMapel} onValueChange={setSelectedMapel}>
                <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                <SelectContent>
                  {mapelList.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nama}{m.jam ? ` (${m.jam})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kelas (untuk input nilai)</Label>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                <SelectContent>
                  {kelasList.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.namaKelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="list" className="gap-2"><ClipboardList className="w-4 h-4" /> Daftar Nilai</TabsTrigger>
          <TabsTrigger value="input" className="gap-2"><Plus className="w-4 h-4" /> Input Nilai</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Rekap Nilai - {selectedMapelObj?.nama}</CardTitle>
                  <CardDescription>KKM: {KKM_DEFAULT} · {Object.keys(rekapBySiswa).length} siswa</CardDescription>
                </div>
                <Button variant="outline" onClick={handleExport}>
                  <FileDown className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
              ) : Object.keys(rekapBySiswa).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Belum ada nilai untuk mata pelajaran ini.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>NIS</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead className="text-center">Harian</TableHead>
                        <TableHead className="text-center">Tugas</TableHead>
                        <TableHead className="text-center">UTS</TableHead>
                        <TableHead className="text-center">UAS</TableHead>
                        <TableHead className="text-center">Akhir</TableHead>
                        <TableHead className="text-center">Predikat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(rekapBySiswa).map((r, i) => {
                        const harian = r.nilai.filter(n => n.jenis === 'harian')
                        const tugas = r.nilai.filter(n => n.jenis === 'tugas')
                        const uts = r.nilai.find(n => n.jenis === 'uts')?.nilai
                        const uas = r.nilai.find(n => n.jenis === 'uas')?.nilai
                        const rataHarian = harian.length ? harian.reduce((s, n) => s + n.nilai, 0) / harian.length : null
                        const rataTugas = tugas.length ? tugas.reduce((s, n) => s + n.nilai, 0) / tugas.length : null
                        // Nilai akhir berbobot hanya dari komponen yang tersedia (bukan 0)
                        const akhir = hitungNilaiAkhir({ rataHarian, rataTugas, uts, uas })
                        const kkm = KKM_DEFAULT
                        const lulus = akhir != null && akhir >= kkm
                        const predikat = predikatDari(akhir)
                        return (
                          <TableRow key={r.siswa.id} className="hover:bg-muted/30">
                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-mono text-xs">{r.siswa.nis}</TableCell>
                            <TableCell className="font-medium">{r.siswa.nama}</TableCell>
                            <TableCell><Badge variant="outline">{r.siswa.kelas?.namaKelas}</Badge></TableCell>
                            <TableCell className="text-center">{rataHarian != null ? rataHarian.toFixed(1) : '—'}</TableCell>
                            <TableCell className="text-center">{rataTugas != null ? rataTugas.toFixed(1) : '—'}</TableCell>
                            <TableCell className="text-center">{uts ?? '—'}</TableCell>
                            <TableCell className="text-center">{uas ?? '—'}</TableCell>
                            <TableCell className="text-center font-semibold">{akhir != null ? akhir.toFixed(1) : '—'}</TableCell>
                            <TableCell className="text-center">
                              {predikat == null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <Badge variant="outline" className={lulus ? 'text-emerald-700 border-emerald-300' : 'text-red-700 border-red-300'}>
                                  {predikat} {lulus ? '✓' : '✗'}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="input" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Input Nilai - {selectedMapelObj?.nama}</CardTitle>
              <CardDescription>Masukkan nilai untuk {siswaList.length} siswa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Jenis Nilai</Label>
                  <Select value={inputForm.jenisNilai} onValueChange={(v) => setInputForm({ ...inputForm, jenisNilai: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {JENIS_NILAI.map(j => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tanggal</Label>
                  <Input type="date" value={inputForm.tanggal} onChange={(e) => setInputForm({ ...inputForm, tanggal: e.target.value })} />
                </div>
              </div>

              {siswaList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Pilih kelas untuk memuat daftar siswa.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>NIS</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead className="w-32">Nilai (0-100)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {siswaList.map((s, i) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{s.nis}</TableCell>
                          <TableCell className="font-medium">{s.nama}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0" max="100"
                              value={inputForm.nilaiMap[s.id] || ''}
                              onChange={(e) => setInputForm({
                                ...inputForm,
                                nilaiMap: { ...inputForm.nilaiMap, [s.id]: e.target.value },
                              })}
                              className="h-8"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleSaveNilai} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Simpan Nilai
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
