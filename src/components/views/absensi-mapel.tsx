'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, formatDate, formatTime } from '@/lib/api'
import { useApiQuery } from '@/hooks/use-api-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookUser, Loader2, Save, History, Camera, CameraOff, ScanLine, QrCode, CheckCircle2, XCircle, UserCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { tanggalWIB } from '@/lib/utils'

interface Mapel { id: string; nama: string; jam: string; hari?: string; guru?: { nama: string } }
interface Kelas { id: string; namaKelas: string }
interface Siswa { id: string; nis: string; nama: string; kelas?: { namaKelas: string } }
interface AbsensiMapel {
  id: string
  siswa: { id: string; nama: string; nis: string; kelas?: { namaKelas: string } }
  mataPelajaran: { nama: string }
  tanggal: string
  jamKe: number
  status: string
  catatan?: string
}
interface ScanSessionItem {
  id: string
  nama: string
  nis: string
  kelas?: string
  waktu: string
  success: boolean
  message: string
  peringatan?: string
}

interface StatSiswa { siswaId: string; nama: string; nis: string; kelas?: string | null; terlambat: number; alpha: number }

const BATAS_PERINGATAN = 3

const buildPeringatan = (p?: { terlambatBulanIni?: number; alphaBulanIni?: number } | null, nama?: string): string | undefined => {
  if (!p) return undefined
  const parts: string[] = []
  if ((p.alphaBulanIni || 0) > BATAS_PERINGATAN) parts.push(`alpha ${p.alphaBulanIni}x bulan ini`)
  if ((p.terlambatBulanIni || 0) > BATAS_PERINGATAN) parts.push(`terlambat ${p.terlambatBulanIni}x bulan ini`)
  if (parts.length === 0) return undefined
  return `Peringatan: ${nama ? nama + ' ' : ''}sudah ${parts.join(' dan ')} (lebih dari ${BATAS_PERINGATAN}x)`
}

const STATUS_OPTIONS = [
  { value: 'hadir', label: 'Hadir', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'izin', label: 'Izin', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'sakit', label: 'Sakit', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'alpha', label: 'Alpha', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'terlambat', label: 'Terlambat', color: 'bg-amber-100 text-amber-700 border-amber-200' },
]

export function AbsensiMapelView() {
  const [selectedMapel, setSelectedMapel] = useState<string>('')
  const [selectedKelas, setSelectedKelas] = useState<string>('')
  const [tanggal, setTanggal] = useState(tanggalWIB())
  const [jamKe, setJamKe] = useState(1)
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // State scan QR
  const [scanTab, setScanTab] = useState<'camera' | 'manual'>('camera')
  const [scanning, setScanning] = useState(false)
  const [startingScan, setStartingScan] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [sessionResults, setSessionResults] = useState<ScanSessionItem[]>([])
  const [processing, setProcessing] = useState(false)
  const html5QrRef = useRef<any>(null)
  const lastScanRef = useRef<{ token: string; time: number }>({ token: '', time: 0 })
  const processingRef = useRef(false)
  const processScanTokenRef = useRef<typeof processScanToken | null>(null)
  const containerId = 'qr-mapel-reader-container'

  // Refs untuk nilai terkini
  const selectedMapelRef = useRef(selectedMapel)
  useEffect(() => { selectedMapelRef.current = selectedMapel }, [selectedMapel])
  const jamKeRef = useRef(jamKe)
  useEffect(() => { jamKeRef.current = jamKe }, [jamKe])

  const qc = useQueryClient()

  // ✅ Master data — cached
  const { data: mapelListRaw } = useApiQuery<Mapel[]>('mata-pelajaran', '/api/mata-pelajaran')
  const { data: kelasListRaw } = useApiQuery<Kelas[]>('kelas', '/api/kelas')

  // ✅ Siswa per kelas — cached per kelas
  const { data: siswaListRaw, isLoading: loadingSiswa } = useApiQuery<Siswa[]>(
    ['siswa', { kelasId: selectedKelas }],
    selectedKelas ? `/api/siswa?kelasId=${selectedKelas}` : null
  )

  // ✅ Statistik per kelas — cached per kelas
  const { data: statDataRaw } = useApiQuery<{ data: StatSiswa[] }>(
    ['absensi-statistik', { kelasId: selectedKelas }],
    selectedKelas ? `/api/absensi/statistik?kelasId=${selectedKelas}` : null
  )

  // ✅ History per mapel — cached per mapel
  const { data: historyRaw } = useApiQuery<AbsensiMapel[]>(
    ['absensi-mapel', { mapelId: selectedMapel }],
    selectedMapel ? `/api/absensi-mapel?mapelId=${selectedMapel}` : null
  )

  // ✅ useMemo untuk referensi stabil
  const mapelList = useMemo(() => mapelListRaw ?? [], [mapelListRaw])
  const kelasList = useMemo(() => kelasListRaw ?? [], [kelasListRaw])
  const siswaList = useMemo(() => siswaListRaw ?? [], [siswaListRaw])
  const history = useMemo(() => historyRaw ?? [], [historyRaw])

  // Auto-select mapel pertama saat data datang
  useEffect(() => {
    if (!selectedMapel && mapelList.length > 0) setSelectedMapel(mapelList[0].id)
  }, [mapelList, selectedMapel])

  // Sync statusMap saat siswa berubah — dependency siswaListRaw (referensi stabil)
  useEffect(() => {
    if (!siswaListRaw) return
    const init: Record<string, string> = {}
    siswaListRaw.forEach(s => { init[s.id] = 'hadir' })
    setStatusMap(init)
  }, [siswaListRaw])

  // Statistik per siswa (memo)
  const statMap = useMemo(() => {
    const m: Record<string, { terlambat: number; alpha: number }> = {}
    if (statDataRaw) statDataRaw.data.forEach(r => { m[r.siswaId] = { terlambat: r.terlambat, alpha: r.alpha } })
    return m
  }, [statDataRaw])

  const selectedMapelData = mapelList.find(m => m.id === selectedMapel)

  const handleSave = async () => {
    if (!selectedMapel) { toast.error('Pilih mata pelajaran dulu'); return }
    setSaving(true)
    try {
      const records = siswaList.map(s => ({ siswaId: s.id, status: statusMap[s.id] || 'hadir' }))
      await api('/api/absensi-mapel', {
        method: 'POST',
        body: JSON.stringify({ mapelId: selectedMapel, tanggal, jamKe, records }),
      })
      toast.success(`Berhasil menyimpan absensi ${records.length} siswa`)
      qc.invalidateQueries({ queryKey: ['absensi-mapel'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const setStatus = (siswaId: string, status: string) => {
    setStatusMap(prev => ({ ...prev, [siswaId]: status }))
  }

  const setAll = (status: string) => {
    const m: Record<string, string> = {}
    siswaList.forEach(s => { m[s.id] = status })
    setStatusMap(m)
  }

  const processScanToken = async (token: string) => {
    if (!token.trim()) return
    if (processingRef.current) return
    const now = Date.now()
    if (lastScanRef.current.token === token && now - lastScanRef.current.time < 3000) return
    lastScanRef.current = { token, time: now }

    const mapelId = selectedMapelRef.current
    if (!mapelId) { toast.error('Pilih mata pelajaran dan jam pelajaran dulu'); return }

    processingRef.current = true
    setProcessing(true)
    try {
      const res = await api<any>('/api/scan-qr', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), mode: 'absensi_mapel', mapelId, jamKe: jamKeRef.current }),
      })
      setSessionResults(prev => [{
        id: `${Date.now()}-${Math.random()}`,
        nama: res?.data?.siswa?.nama || 'Tidak dikenal',
        nis: res?.data?.siswa?.nis || '-',
        kelas: res?.data?.siswa?.kelas?.namaKelas,
        waktu: new Date().toISOString(),
        success: !!res?.success,
        message: res?.message || (res?.error) || 'Hasil tidak diketahui',
        peringatan: buildPeringatan(res?.data?.peringatan, res?.data?.siswa?.nama),
      }, ...prev])
      if (res?.success) {
        toast.success(res.message)
        if ((res?.data?.peringatan?.alphaBulanIni || 0) > BATAS_PERINGATAN) {
          toast.warning(`Peringatan: ${res.data.siswa.nama} sudah alpha ${res.data.peringatan.alphaBulanIni}x bulan ini (lebih dari ${BATAS_PERINGATAN}x)`, { duration: 6000 })
        }
        // ✅ Invalidate history & dashboard
        qc.invalidateQueries({ queryKey: ['absensi-mapel'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      } else {
        toast.warning(res?.message || res?.error || 'Gagal memproses QR')
      }
    } catch (e: any) {
      setSessionResults(prev => [{
        id: `${Date.now()}-${Math.random()}`,
        nama: 'Tidak dikenal',
        nis: '-',
        waktu: new Date().toISOString(),
        success: false,
        message: e.message || 'Gagal scan QR',
      }, ...prev])
      toast.error(e.message || 'Gagal scan QR')
    } finally {
      processingRef.current = false
      setProcessing(false)
    }
  }
  useEffect(() => { processScanTokenRef.current = processScanToken })

  const startScan = async () => {
    if (!selectedMapel) { toast.error('Pilih mata pelajaran dan jam pelajaran dulu'); return }
    if (scanning || startingScan) return
    setStartingScan(true)
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const html5Qr = new Html5Qrcode(containerId)
      html5QrRef.current = html5Qr
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => { processScanTokenRef.current?.(decodedText) },
        () => {}
      )
    } catch (e) {
      console.error(e)
      toast.error('Tidak dapat mengakses kamera. Gunakan input manual.')
      setScanning(false)
      setScanTab('manual')
    } finally {
      setStartingScan(false)
    }
  }

  const stopScan = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); await html5QrRef.current.clear() } catch {}
    }
    html5QrRef.current = null
    setScanning(false)
  }

  useEffect(() => { return () => { stopScan() } }, [])

  const successCount = sessionResults.filter(r => r.success).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookUser className="w-5 h-5 text-blue-600" />
            Absensi Mata Pelajaran
          </CardTitle>
          <CardDescription>Catat kehadiran siswa per mata pelajaran dan jam pelajaran</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>Mata Pelajaran</Label>
            <Select value={selectedMapel} onValueChange={setSelectedMapel}>
              <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
              <SelectContent>
                {mapelList.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nama}{m.hari ? ` — ${m.hari}` : ''}{m.jam ? ` (${m.jam})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kelas</Label>
            <Select value={selectedKelas} onValueChange={setSelectedKelas}>
              <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
              <SelectContent>
                {kelasList.map(k => <SelectItem key={k.id} value={k.id}>{k.namaKelas}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal</Label>
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Jam Ke</Label>
            <Input type="number" min="1" max="12" value={jamKe} onChange={(e) => setJamKe(Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="input">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="input" className="gap-2"><BookUser className="w-4 h-4" /> Input Manual</TabsTrigger>
          <TabsTrigger value="scan" className="gap-2"><QrCode className="w-4 h-4" /> Scan QR</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /> Riwayat</TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="mt-4 space-y-4">
          {loadingSiswa ? (
            <Card>
              <CardContent className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </CardContent>
            </Card>
          ) : siswaList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BookUser className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Pilih kelas untuk melihat daftar siswa.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Daftar Siswa ({siswaList.length})</CardTitle>
                    <CardDescription>Tandai status kehadiran setiap siswa</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setAll('hadir')}>Semua Hadir</Button>
                    <Button size="sm" variant="outline" onClick={() => setAll('alpha')}>Semua Alpha</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const melebihi = siswaList.filter(s => (statMap[s.id]?.alpha || 0) > BATAS_PERINGATAN)
                  if (melebihi.length === 0) return null
                  return (
                    <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3" role="alert">
                      <p className="flex items-start gap-2 text-sm font-semibold text-red-800">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        Peringatan: {melebihi.length} siswa alpha lebih dari {BATAS_PERINGATAN}x bulan ini
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {melebihi.map(s => (
                          <Badge key={s.id} variant="outline" className="bg-red-100 text-red-700 border-red-300">
                            {s.nama} ({statMap[s.id].alpha}x alpha)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>NIS</TableHead>
                        <TableHead>Nama Siswa</TableHead>
                        <TableHead>Status Kehadiran</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {siswaList.map((s, i) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{s.nis}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                              {s.nama}
                              {(statMap[s.id]?.alpha || 0) > BATAS_PERINGATAN && (
                                <Badge title={`Alpha ${statMap[s.id].alpha}x bulan ini`} className="bg-red-100 text-red-700 border border-red-300 gap-1 text-xs">
                                  <AlertTriangle className="w-3 h-3" /> Alpha {statMap[s.id].alpha}x
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={statusMap[s.id] || 'hadir'} onValueChange={(v) => setStatus(s.id, v)}>
                              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Simpan Absensi
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scan" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-blue-600" /> Scan QR Siswa
                </CardTitle>
                <CardDescription>
                  {selectedMapelData
                    ? <>Absensi untuk <strong>{selectedMapelData.nama}</strong>{selectedMapelData.hari ? ` — ${selectedMapelData.hari}` : ''}{selectedMapelData.jam ? ` (${selectedMapelData.jam})` : ''} · <strong>Jam {jamKe}</strong></>
                    : 'Pilih mata pelajaran terlebih dahulu'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={scanTab} onValueChange={(v) => { setScanTab(v as any); stopScan() }}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="camera" className="gap-2"><Camera className="w-4 h-4" /> Kamera</TabsTrigger>
                    <TabsTrigger value="manual" className="gap-2"><ScanLine className="w-4 h-4" /> Manual</TabsTrigger>
                  </TabsList>

                  <TabsContent value="camera" className="mt-4">
                    <div id={containerId} className="w-full max-w-sm mx-auto aspect-square bg-muted/50 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-sky-300">
                      {!scanning && (
                        <div className="text-center p-8">
                          <Camera className="w-14 h-14 mx-auto mb-3 text-blue-600 opacity-50" />
                          <p className="text-sm text-muted-foreground mb-3">Klik "Mulai Scan" lalu arahkan kamera ke QR Code siswa</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex justify-center gap-2">
                      {!scanning ? (
                        <Button onClick={startScan} disabled={!selectedMapel || startingScan} className="bg-blue-700 hover:bg-blue-800">
                          {startingScan ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                          {startingScan ? 'Menyiapkan Kamera...' : 'Mulai Scan'}
                        </Button>
                      ) : (
                        <Button onClick={stopScan} variant="destructive">
                          <CameraOff className="w-4 h-4 mr-2" /> Stop Scan
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      Scan berjalan otomatis (berkelanjutan) sesuai mapel dan jam pelajaran yang dipilih
                    </p>
                  </TabsContent>

                  <TabsContent value="manual" className="mt-4">
                    <div className="max-w-sm mx-auto space-y-4">
                      <div className="text-center">
                        <ScanLine className="w-14 h-14 mx-auto mb-3 text-blue-600 opacity-50" />
                        <p className="text-sm text-muted-foreground">Masukkan NIS siswa untuk absensi manual (tanpa kamera)</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>NIS Siswa</Label>
                        <Input
                          placeholder="Masukkan NIS siswa di sini..."
                          value={manualToken}
                          onChange={(e) => setManualToken(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && manualToken) {
                              processScanToken(manualToken)
                              setManualToken('')
                            }
                          }}
                        />
                      </div>
                      <Button
                        onClick={() => { if (manualToken) { processScanToken(manualToken); setManualToken('') } }}
                        disabled={!selectedMapel || processing}
                        className="w-full bg-blue-700 hover:bg-blue-800"
                      >
                        {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
                        Proses Absensi
                      </Button>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                        <p className="font-semibold mb-1">Info:</p>
                        <p>NIS tercantum pada halaman Data Siswa. Tulis NIS lalu tekan Enter untuk mencatat kehadiran pada mapel &amp; jam yang dipilih.</p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Hasil Scan ({successCount} hadir)</CardTitle>
                    <CardDescription>
                      {selectedMapelData
                        ? <>{selectedMapelData.nama} · Jam {jamKe} · {formatDate(tanggal)}</>
                        : 'Sesi scan saat ini'}
                    </CardDescription>
                  </div>
                  {sessionResults.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSessionResults([])}>Bersihkan</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {sessionResults.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    Belum ada siswa yang discan pada sesi ini.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {sessionResults.map(r => (
                      <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${r.success ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{r.nama} <span className="font-mono text-xs text-muted-foreground">({r.nis})</span></p>
                          <p className="text-xs text-muted-foreground">{r.message}</p>
                          {r.peringatan && (
                            <p className="text-xs font-semibold text-red-700 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {r.peringatan}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(r.waktu)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Absensi Mapel Terpilih</CardTitle>
              <CardDescription>Riwayat absensi terakhir untuk mata pelajaran ini</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Belum ada riwayat absensi.</div>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/50">
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Jam</TableHead>
                        <TableHead>Siswa</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.slice(0, 50).map(h => (
                        <TableRow key={h.id}>
                          <TableCell className="text-xs">{formatDate(h.tanggal)}</TableCell>
                          <TableCell>Jam {h.jamKe}</TableCell>
                          <TableCell className="font-medium text-sm">{h.siswa.nama}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_OPTIONS.find(o => o.value === h.status)?.color}>
                              {h.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}