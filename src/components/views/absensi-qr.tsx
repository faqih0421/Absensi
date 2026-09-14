'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, formatTime } from '@/lib/api'
import { useApiQuery } from '@/hooks/use-api-query'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QrCode, Camera, CameraOff, CheckCircle2, XCircle, Clock, UserCheck, UserX, Loader2, RefreshCw, ScanLine, CalendarDays, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { tanggalWIB } from '@/lib/utils'

interface ScanResult {
  success: boolean
  message: string
  data?: {
    siswa?: { id: string; nama: string; nis: string; kelas?: { namaKelas: string } }
    guru?: { id: string; nama: string; nip: string }
    absensi?: { waktu: string; status: string; keterlambatan?: number }
    peringatan?: { terlambatBulanIni: number; alphaBulanIni: number; batasPeringatan: number }
  }
}

interface HistoryItem {
  id: string
  jenis: string
  status: string
  waktu: string
  siswa?: { nama: string; nis: string; kelas?: { namaKelas: string } }
  guru?: { nama: string; nip: string }
}

interface Kelas { id: string; namaKelas: string }
interface Siswa { id: string; nis: string; nama: string; foto?: string | null; kelas?: { namaKelas: string } }
interface AbsensiRecord { id: string; siswaId: string; jenis: string; status: string; waktu: string }
interface StatSiswa { siswaId: string; nama: string; nis: string; kelas?: string | null; terlambat: number; alpha: number }

const BATAS_PERINGATAN_TERLAMBAT = 3

const STATUS_DAILY = [
  { value: 'hadir', label: 'Hadir', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', text: 'text-emerald-700' },
  { value: 'terlambat', label: 'Terlambat', color: 'bg-amber-100 text-amber-700 border-amber-200', text: 'text-amber-700' },
  { value: 'izin', label: 'Izin', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', text: 'text-cyan-700' },
  { value: 'sakit', label: 'Sakit', color: 'bg-purple-100 text-purple-700 border-purple-200', text: 'text-purple-700' },
  { value: 'alpha', label: 'Alpha', color: 'bg-red-100 text-red-700 border-red-200', text: 'text-red-700' },
]

export function AbsensiQrView() {
  const { currentView } = useAppStore()
  const mode = currentView === 'absensi-qr-checkout' ? 'checkout_guru' : 'checkin_siswa'
  const isCheckoutGuru = mode === 'checkout_guru'

  const [tab, setTab] = useState<'camera' | 'manual' | 'harian'>('camera')
  const [manualToken, setManualToken] = useState('')
  const [scanning, setScanning] = useState(false)
  const [startingScan, setStartingScan] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const html5QrRef = useRef<any>(null)
  const containerId = 'qr-reader-container'
  const processTokenRef = useRef<typeof processToken | null>(null)

  // State tab Absensi Harian
  const [harianKelas, setHarianKelas] = useState('')
  const [harianTanggal, setHarianTanggal] = useState(tanggalWIB())
  const [harianStatus, setHarianStatus] = useState<Record<string, string>>({})
  const [savingHarian, setSavingHarian] = useState(false)
  const [harianStat, setHarianStat] = useState<Record<string, { terlambat: number; alpha: number }>>({})

  const qc = useQueryClient()

  // ✅ History — cached per mode
  const historyKey = isCheckoutGuru ? 'absensi-guru' : 'absensi'
  const { data: historyRaw, isLoading: loadingHistory, refetch: refetchHistory } = useApiQuery<HistoryItem[]>(
    ['absensi-history', historyKey],
    `/api/${historyKey}`
  )
  const history = useMemo(() => (historyRaw ?? []).slice(0, 10), [historyRaw])

  // ✅ Kelas list — cached (shared dengan view lain)
  const { data: kelasListRaw } = useApiQuery<Kelas[]>('kelas', '/api/kelas')
  const kelasList = useMemo(() => kelasListRaw ?? [], [kelasListRaw])

  // ✅ Siswa per kelas — cached per kelas
  const { data: harianSiswaRaw } = useApiQuery<Siswa[]>(
    ['siswa', { kelasId: harianKelas }],
    harianKelas ? `/api/siswa?kelasId=${harianKelas}` : null
  )
  const harianSiswa = useMemo(() => harianSiswaRaw ?? [], [harianSiswaRaw])

  // ✅ Absensi tanggal tertentu — cached per tanggal
  const { data: absensiDataRaw } = useApiQuery<AbsensiRecord[]>(
    ['absensi-harian', { tanggal: harianTanggal }],
    harianTanggal ? `/api/absensi?tanggal=${harianTanggal}` : null
  )
  const absensiData = useMemo(() => absensiDataRaw ?? [], [absensiDataRaw])

  // ✅ Statistik per kelas — cached per kelas
  const { data: statDataRaw } = useApiQuery<{ data: StatSiswa[] }>(
    ['absensi-statistik', { kelasId: harianKelas }],
    harianKelas ? `/api/absensi/statistik?kelasId=${harianKelas}` : null
  )

  // Sync harianStatus & harianStat saat data berubah
  useEffect(() => {
    if (!absensiDataRaw && !harianSiswaRaw) return
    const bySiswa: Record<string, AbsensiRecord> = {}
    for (const rec of absensiData) {
      if (!bySiswa[rec.siswaId] || (rec.jenis === 'checkin' && bySiswa[rec.siswaId].jenis !== 'checkin')) {
        bySiswa[rec.siswaId] = rec
      }
    }
    const init: Record<string, string> = {}
    harianSiswa.forEach(s => { init[s.id] = bySiswa[s.id]?.status || 'hadir' })
    setHarianStatus(init)
  }, [absensiDataRaw, harianSiswaRaw])

  useEffect(() => {
    if (!statDataRaw) return
    const statMap: Record<string, { terlambat: number; alpha: number }> = {}
    statDataRaw.data.forEach(r => { statMap[r.siswaId] = { terlambat: r.terlambat, alpha: r.alpha } })
    setHarianStat(statMap)
  }, [statDataRaw])

  const handleSaveHarian = async () => {
    if (!harianKelas) { toast.error('Pilih kelas terlebih dahulu'); return }
    if (harianSiswa.length === 0) { toast.error('Tidak ada siswa pada kelas ini'); return }
    setSavingHarian(true)
    try {
      let sukses = 0
      let gagal = 0
      for (const s of harianSiswa) {
        try {
          await api('/api/absensi', {
            method: 'POST',
            body: JSON.stringify({ siswaId: s.id, status: harianStatus[s.id] || 'hadir', tanggal: harianTanggal }),
          })
          sukses++
        } catch { gagal++ }
      }
      const namaKelas = kelasList.find(k => k.id === harianKelas)?.namaKelas || 'kelas'
      if (gagal > 0) toast.error(`Absensi harian ${namaKelas}: ${sukses} berhasil, ${gagal} gagal`)
      else toast.success(`Absensi harian ${namaKelas} tersimpan (${sukses} siswa)`)

      // ✅ Invalidate cache → data otomatis refresh
      qc.invalidateQueries({ queryKey: ['absensi-harian'] })
      qc.invalidateQueries({ queryKey: ['absensi-statistik'] })
      qc.invalidateQueries({ queryKey: ['absensi-history'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan absensi harian')
    } finally {
      setSavingHarian(false)
    }
  }

  const processToken = async (token: string) => {
    if (!token.trim()) return
    try {
      const res = await api<ScanResult>('/api/scan-qr', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), mode: isCheckoutGuru ? 'checkout_guru' : 'checkin_siswa' }),
      })
      setLastResult(res)
      if (res.success) toast.success(res.message)
      else toast.warning(res.message)
      // ✅ Invalidate history & dashboard agar data terbaru muncul
      qc.invalidateQueries({ queryKey: ['absensi-history'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e: any) {
      toast.error(e.message || 'Gagal scan QR')
      setLastResult({ success: false, message: e.message })
    }
  }
  useEffect(() => { processTokenRef.current = processToken })

  const startScan = async () => {
    if (scanning || startingScan) return
    setStartingScan(true)
    setScanning(true)
    setLastResult(null)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const html5Qr = new Html5Qrcode(containerId)
      html5QrRef.current = html5Qr
      let handled = false
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          if (handled) return
          handled = true
          html5Qr.stop().then(() => {
            if (html5QrRef.current === html5Qr) html5QrRef.current = null
            setScanning(false)
            processTokenRef.current?.(decodedText)
          }).catch(() => {})
        },
        () => {}
      )
    } catch (e) {
      console.error(e)
      toast.error('Tidak dapat mengakses kamera. Gunakan input manual.')
      setScanning(false)
      setTab('manual')
    } finally {
      setStartingScan(false)
    }
  }

  const stopScan = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); await html5QrRef.current.clear() } catch {}
      html5QrRef.current = null
    }
    setScanning(false)
  }

  useEffect(() => { return () => { stopScan() } }, [])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            {isCheckoutGuru ? 'Absensi Check-out Guru' : 'Absensi Check-in QR'}
          </CardTitle>
          <CardDescription>
            {isCheckoutGuru ? 'Scan QR Code guru untuk mencatat check-out' : 'Scan QR Code siswa ATAU guru — keduanya otomatis tercatat sebagai check-in'}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={tab} onValueChange={(v) => { setTab(v as any); stopScan() }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="camera" className="gap-2"><Camera className="w-4 h-4" /> Kamera</TabsTrigger>
              <TabsTrigger value="manual" className="gap-2"><ScanLine className="w-4 h-4" /> Manual</TabsTrigger>
              <TabsTrigger value="harian" className="gap-2">
                <CalendarDays className="w-4 h-4" />
                <span className="hidden sm:inline">Absensi Harian</span>
                <span className="sm:hidden">Harian</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <div id={containerId} className="w-full max-w-md mx-auto aspect-square bg-muted/50 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-sky-300">
                    {!scanning && (
                      <div className="text-center p-8">
                        <Camera className="w-16 h-16 mx-auto mb-3 text-blue-600 opacity-50" />
                        <p className="text-sm text-muted-foreground mb-3">Klik "Mulai Scan" untuk mengaktifkan kamera</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex justify-center gap-2">
                    {!scanning ? (
                      <Button onClick={startScan} disabled={startingScan} className="bg-blue-700 hover:bg-blue-800">
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
                    Arahkan kamera ke QR Code pada kartu siswa/guru — QR guru juga otomatis tercatat check-in
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="text-center">
                      <ScanLine className="w-16 h-16 mx-auto mb-3 text-blue-600 opacity-50" />
                      <p className="text-sm text-muted-foreground">Masukkan NIS (siswa) atau NIP (guru) untuk absensi manual (tanpa kamera)</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>NIS / NIP</Label>
                      <Input
                        placeholder="Masukkan NIS atau NIP di sini..."
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && manualToken) {
                            processToken(manualToken)
                            setManualToken('')
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={() => { if (manualToken) { processToken(manualToken); setManualToken('') } }}
                      className="w-full bg-blue-700 hover:bg-blue-800"
                    >
                      <UserCheck className="w-4 h-4 mr-2" /> Proses Absensi
                    </Button>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                      <p className="font-semibold mb-1">Info:</p>
                      <p>
                        {isCheckoutGuru
                          ? 'Tulis NIP guru lalu tekan Enter untuk mencatat check-out.'
                          : 'Tulis NIS siswa atau NIP guru lalu tekan Enter untuk mencatat check-in.'}{' '}
                        Paste isi QR Code juga tetap bisa untuk simulasi scan.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="harian" className="mt-4">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs">Kelas</Label>
                      <Select value={harianKelas} onValueChange={setHarianKelas}>
                        <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                        <SelectContent>
                          {kelasList.map(k => <SelectItem key={k.id} value={k.id}>{k.namaKelas}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:w-44">
                      <Label className="text-xs">Tanggal</Label>
                      <Input type="date" value={harianTanggal} onChange={(e) => setHarianTanggal(e.target.value)} />
                    </div>
                  </div>

                  {!harianKelas ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      Pilih kelas untuk memuat daftar siswa.
                    </div>
                  ) : !harianSiswaRaw ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                  ) : harianSiswa.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">Tidak ada siswa pada kelas ini.</div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_DAILY.map(st => (
                          <Badge key={st.value} variant="outline" className={st.color}>
                            {st.label}: {harianSiswa.filter(s => (harianStatus[s.id] || 'hadir') === st.value).length}
                          </Badge>
                        ))}
                      </div>

                      {(() => {
                        const seringTelat = harianSiswa.filter(s => (harianStat[s.id]?.terlambat || 0) > BATAS_PERINGATAN_TERLAMBAT)
                        if (seringTelat.length === 0) return null
                        return (
                          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3" role="alert">
                            <p className="flex items-start gap-2 text-sm font-semibold text-amber-800">
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              Peringatan: {seringTelat.length} siswa terlambat lebih dari {BATAS_PERINGATAN_TERLAMBAT}x bulan ini
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {seringTelat.map(s => (
                                <Badge key={s.id} variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                                  {s.nama} ({harianStat[s.id].terlambat}x terlambat)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {harianSiswa.map(s => {
                          const status = harianStatus[s.id] || 'hadir'
                          const st = STATUS_DAILY.find(o => o.value === status)
                          return (
                            <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                              <Avatar className="w-9 h-9 flex-shrink-0">
                                {s.foto ? <AvatarImage src={s.foto} alt={`Foto ${s.nama}`} /> : null}
                                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">{s.nama.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate flex items-center gap-1.5 flex-wrap">
                                  {s.nama}
                                  {(harianStat[s.id]?.terlambat || 0) > BATAS_PERINGATAN_TERLAMBAT && (
                                    <Badge title={`Terlambat ${harianStat[s.id].terlambat}x bulan ini`} className="bg-amber-100 text-amber-800 border border-amber-300 gap-1 text-xs">
                                      <AlertTriangle className="w-3 h-3" /> Terlambat {harianStat[s.id].terlambat}x
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">NIS {s.nis}</p>
                              </div>
                              <Select value={status} onValueChange={(v) => setHarianStatus({ ...harianStatus, [s.id]: v })}>
                                <SelectTrigger className={`w-[118px] sm:w-32 flex-shrink-0 text-xs h-9 ${st?.text || ''}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_DAILY.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={handleSaveHarian} disabled={savingHarian} className="bg-blue-700 hover:bg-blue-800">
                          {savingHarian ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                          Simpan Absensi Harian ({harianSiswa.length} siswa)
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {lastResult && (
            <Card className={lastResult.success ? 'border-emerald-300' : 'border-amber-300'}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${lastResult.success ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {lastResult.success ? <CheckCircle2 className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{lastResult.message}</p>
                    {lastResult.data?.peringatan && (lastResult.data.peringatan.terlambatBulanIni || 0) > (lastResult.data.peringatan.batasPeringatan || 3) && (
                      <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 flex items-start gap-2" role="alert">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                          <span className="font-semibold">Peringatan:</span> siswa ini terlambat{' '}
                          <span className="font-semibold">{lastResult.data.peringatan.terlambatBulanIni}x bulan ini</span>{' '}
                          (lebih dari {lastResult.data.peringatan.batasPeringatan || 3}x). Perlu tindak lanjut.
                        </p>
                      </div>
                    )}
                    {lastResult.data && (
                      <div className="mt-2 text-sm space-y-1">
                        {lastResult.data.siswa && (
                          <>
                            <p>Siswa: <span className="font-medium">{lastResult.data.siswa.nama}</span></p>
                            <p>NIS: {lastResult.data.siswa.nis} · Kelas: {lastResult.data.siswa.kelas?.namaKelas}</p>
                          </>
                        )}
                        {lastResult.data.guru && (
                          <>
                            <p>Guru: <span className="font-medium">{lastResult.data.guru.nama}</span></p>
                            <p>NIP: {lastResult.data.guru.nip}</p>
                          </>
                        )}
                        {lastResult.data.absensi && (
                          <p>Waktu: {formatTime(lastResult.data.absensi.waktu)} · Status: {lastResult.data.absensi.status}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> Riwayat Terbaru
                </CardTitle>
                <CardDescription>10 absensi terakhir</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetchHistory()} disabled={loadingHistory}>
                <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistory && !historyRaw ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Belum ada riwayat absensi.</div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${h.jenis === 'checkin' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {h.jenis === 'checkin' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{h.siswa?.nama || h.guru?.nama}</p>
                      <p className="text-xs text-muted-foreground">{h.jenis} · {formatTime(h.waktu)}</p>
                    </div>
                    <Badge variant="outline" className={
                      h.status === 'hadir' ? 'text-emerald-700 border-emerald-300' :
                      h.status === 'terlambat' ? 'text-amber-700 border-amber-300' :
                      'text-red-700 border-red-300'
                    }>
                      {h.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}