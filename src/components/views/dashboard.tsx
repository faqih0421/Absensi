'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, formatDate, formatTime } from '@/lib/api'
import { tanggalWIB } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Users, UserCog, School, BookOpen, UserCheck, UserX, Clock, AlertCircle, TrendingUp, Calendar, Eye, Search, Loader2 } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'

interface DashboardData {
  stats: {
    totalSiswa: number
    totalGuru: number
    totalKelas: number
    totalMapel: number
    totalAkun: number
    totalPelanggaran: number
    hadir: number
    terlambat: number
    izin: number
    sakit: number
    alpha: number
    guruHadir: number
    guruBelumAbsen: number
  }
  tren7Hari: { tanggal: string; hadir: number; terlambat: number; absen: number }[]
  distribusiKelas: { kelas: string; hadir: number; total: number }[]
  pelanggaranTerbaru: { id: string; siswaId: string; siswa: string; kelas: string; pelanggaran: string; poin: number; tanggal: string }[]
  belumAbsen: { id: string; nama: string; kelas: string }[]
  pengaturan: { key: string; value: string }[]
}

// Tipe data untuk dialog detail kartu statistik
type DetailType = 'siswa' | 'guru' | 'kelas' | 'mapel'

interface SiswaRow { id: string; nis: string; nama: string; jenisKelamin: string; foto?: string | null; kelasId?: string; kelas?: { namaKelas: string } | null }
interface GuruRow { id: string; nip: string; nama: string; jenisKelamin: string; role: string; telepon?: string | null; foto?: string | null }
interface KelasRow { id: string; namaKelas: string; tingkat: string; jurusan?: string | null; walikelas?: { nama: string } | null; jumlahSiswa?: number }
interface MapelRow { id: string; nama: string; jam?: string | null; guru?: { nama: string; nip: string } | null }

// Baris absensi siswa (GET /api/absensi)
interface AbsensiHariIniRow {
  id: string
  siswaId: string
  status: string
  waktu: string
  keterlambatan?: number
  jenis?: string
  siswa: { nama: string; nis: string; kelas?: { namaKelas: string } | null }
}

// Baris absensi guru (GET /api/absensi-guru)
interface GuruAbsenRow {
  id: string
  jenis: string
  status: string
  waktu: string
  guru: { id: string; nama: string; nip: string; role?: string }
}

// Baris riwayat pelanggaran (GET /api/pelanggaran)
interface PelanggaranDetailRow {
  id: string
  tanggal: string
  catatan?: string | null
  jenisPelanggaran: { nama: string; poin: number; kategori: string }
}

const DETAIL_META: Record<DetailType, { judul: string; deskripsi: string }> = {
  siswa: { judul: 'Daftar Siswa', deskripsi: 'Seluruh siswa aktif terdaftar' },
  guru: { judul: 'Daftar Guru', deskripsi: 'Seluruh guru & kepala sekolah' },
  kelas: { judul: 'Daftar Kelas', deskripsi: 'Rombongan belajar yang aktif' },
  mapel: { judul: 'Daftar Mata Pelajaran', deskripsi: 'Mata pelajaran & guru pengampu' },
}

const kategoriBadge: Record<string, string> = {
  ringan: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sedang: 'bg-amber-100 text-amber-700 border-amber-200',
  berat: 'bg-red-100 text-red-700 border-red-200',
}

const statusWarna: Record<string, string> = {
  hadir: 'text-emerald-700 border-emerald-300',
  terlambat: 'text-amber-700 border-amber-300',
  izin: 'text-cyan-700 border-cyan-300',
  sakit: 'text-purple-700 border-purple-300',
  alpha: 'text-red-700 border-red-300',
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadDashboard = useCallback(() => {
    setLoading(true)
    setError(false)
    api<DashboardData>('/api/dashboard')
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  // State dialog detail kartu statistik
  const [detail, setDetail] = useState<DetailType | null>(null)
  const [detailData, setDetailData] = useState<(SiswaRow | GuruRow | KelasRow | MapelRow)[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailCari, setDetailCari] = useState('')

  // State dialog status kehadiran (kotak Hadir/Terlambat/Izin/Sakit/Alpha diklik)
  const [statusDlg, setStatusDlg] = useState<{ status: string; label: string } | null>(null)
  const [statusRows, setStatusRows] = useState<AbsensiHariIniRow[]>([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [cariStatusDlg, setCariStatusDlg] = useState('')

  // State dialog guru check-in / belum absen (kartu ringkas diklik)
  const [guruDlg, setGuruDlg] = useState<'checkin' | 'belum' | null>(null)
  const [guruDlgRows, setGuruDlgRows] = useState<GuruAbsenRow[]>([])
  const [guruDlgLoading, setGuruDlgLoading] = useState(false)
  const [cariGuruDlg, setCariGuruDlg] = useState('')

  // State dialog detail siswa (baris "Siswa Belum Absen" diklik)
  const [siswaDlg, setSiswaDlg] = useState<{ id: string; nama: string; kelas?: string | null } | null>(null)
  const [siswaDlgData, setSiswaDlgData] = useState<{ profil?: SiswaRow; riwayat: AbsensiHariIniRow[]; pelanggaran: PelanggaranDetailRow[]; totalPoin: number } | null>(null)
  const [siswaDlgLoading, setSiswaDlgLoading] = useState(false)

  // State dialog riwayat pelanggaran siswa (baris "Pelanggaran Terbaru" diklik)
  const [pelDlg, setPelDlg] = useState<{ siswaId: string; nama: string } | null>(null)
  const [pelDlgRows, setPelDlgRows] = useState<PelanggaranDetailRow[]>([])
  const [pelDlgLoading, setPelDlgLoading] = useState(false)

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const bukaDetail = async (t: DetailType) => {
    setDetail(t)
    setDetailCari('')
    setDetailLoading(true)
    try {
      if (t === 'siswa') {
        setDetailData(await api<SiswaRow[]>('/api/siswa'))
      } else if (t === 'guru') {
        setDetailData(await api<GuruRow[]>('/api/guru'))
      } else if (t === 'kelas') {
        const [kelasData, siswaData] = await Promise.all([
          api<KelasRow[]>('/api/kelas'),
          api<SiswaRow[]>('/api/siswa'),
        ])
        const jumlah: Record<string, number> = {}
        siswaData.forEach(sw => { if (sw.kelasId) jumlah[sw.kelasId] = (jumlah[sw.kelasId] || 0) + 1 })
        setDetailData(kelasData.map(k => ({ ...k, jumlahSiswa: jumlah[k.id] || 0 })))
      } else {
        setDetailData(await api<MapelRow[]>('/api/mata-pelajaran'))
      }
    } catch {
      toast.error('Gagal memuat data detail')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  // Tanggal hari ini format YYYY-MM-DD zona WIB (konsisten dengan tab absensi lain)
  // (memakai tanggalWIB dari '@/lib/utils' — bukan toISOString yang UTC)

  // ==== Handler tabel interaktif dashboard ====

  // Kotak status kehadiran (Hadir/Terlambat/Izin/Sakit/Alpha) -> daftar siswa berstatus tsb hari ini
  const bukaStatusKehadiran = async (status: string, label: string) => {
    setStatusDlg({ status, label })
    setCariStatusDlg('')
    setStatusLoading(true)
    try {
      if (status === 'alpha') {
        // Alpha = siswa yang belum punya record absensi check-in hari ini
        const [semuaSiswa, absenHariIni] = await Promise.all([
          api<SiswaRow[]>('/api/siswa'),
          api<AbsensiHariIniRow[]>(`/api/absensi?tanggal=${tanggalWIB()}`),
        ])
        const sudahAbsen = new Set(absenHariIni.map(a => a.siswaId))
        setStatusRows(semuaSiswa.filter(sw => !sudahAbsen.has(sw.id)).map(sw => ({
          id: `alpha-${sw.id}`,
          siswaId: sw.id,
          status: 'alpha',
          waktu: '',
          siswa: { nama: sw.nama, nis: sw.nis, kelas: sw.kelas ? { namaKelas: sw.kelas.namaKelas } : null },
        })))
      } else {
        const absenHariIni = await api<AbsensiHariIniRow[]>(`/api/absensi?tanggal=${tanggalWIB()}`)
        setStatusRows(absenHariIni.filter(a => a.status === status))
      }
    } catch {
      toast.error('Gagal memuat data kehadiran')
      setStatusDlg(null)
    } finally {
      setStatusLoading(false)
    }
  }

  // Kartu guru check-in / belum absen -> daftar guru
  const bukaGuruDialog = async (tipe: 'checkin' | 'belum') => {
    setGuruDlg(tipe)
    setCariGuruDlg('')
    setGuruDlgLoading(true)
    try {
      const [absenGuru, semuaGuru] = await Promise.all([
        api<GuruAbsenRow[]>(`/api/absensi-guru?tanggal=${tanggalWIB()}`),
        api<GuruRow[]>('/api/guru'),
      ])
      const checkin = absenGuru.filter(a => a.jenis === 'checkin')
      if (tipe === 'checkin') {
        setGuruDlgRows(checkin)
      } else {
        const sudah = new Set(checkin.map(a => a.guru.id))
        setGuruDlgRows(semuaGuru.filter(g => !sudah.has(g.id)).map(g => ({
          id: `belum-${g.id}`,
          jenis: 'belum',
          status: 'belum',
          waktu: '',
          guru: { id: g.id, nama: g.nama, nip: g.nip, role: g.role },
        })))
      }
    } catch {
      toast.error('Gagal memuat data guru')
      setGuruDlg(null)
    } finally {
      setGuruDlgLoading(false)
    }
  }

  // Baris "Siswa Belum Absen" -> profil + riwayat absensi + pelanggaran siswa
  const bukaDetailSiswa = async (s: { id: string; nama: string; kelas?: string | null }) => {
    setSiswaDlg({ id: s.id, nama: s.nama, kelas: s.kelas })
    setSiswaDlgData(null)
    setSiswaDlgLoading(true)
    try {
      const [semuaSiswa, riwayat, pelanggaran] = await Promise.all([
        api<SiswaRow[]>('/api/siswa'),
        api<AbsensiHariIniRow[]>(`/api/absensi?siswaId=${s.id}`),
        api<PelanggaranDetailRow[]>(`/api/pelanggaran?siswaId=${s.id}`),
      ])
      const profil = semuaSiswa.find(sw => sw.id === s.id)
      const totalPoin = pelanggaran.reduce((t, p) => t + (p.jenisPelanggaran?.poin || 0), 0)
      setSiswaDlgData({ profil, riwayat: riwayat.slice(0, 10), pelanggaran, totalPoin })
    } catch {
      toast.error('Gagal memuat detail siswa')
      setSiswaDlg(null)
    } finally {
      setSiswaDlgLoading(false)
    }
  }

  // Baris "Pelanggaran Terbaru" -> riwayat seluruh pelanggaran siswa tsb
  const bukaRiwayatPelanggaran = async (siswaId: string, nama: string) => {
    setPelDlg({ siswaId, nama })
    setPelDlgRows([])
    setPelDlgLoading(true)
    try {
      setPelDlgRows(await api<PelanggaranDetailRow[]>(`/api/pelanggaran?siswaId=${siswaId}`))
    } catch {
      toast.error('Gagal memuat riwayat pelanggaran')
      setPelDlg(null)
    } finally {
      setPelDlgLoading(false)
    }
  }

  // Saring data dialog berdasarkan kata kunci pencarian
  const detailTerfilter = detailData.filter(item => {
    if (!detailCari.trim()) return true
    const q = detailCari.toLowerCase()
    if (detail === 'siswa') {
      const r = item as SiswaRow
      return r.nama?.toLowerCase().includes(q) || r.nis?.includes(q) || r.kelas?.namaKelas?.toLowerCase().includes(q)
    }
    if (detail === 'guru') {
      const r = item as GuruRow
      return r.nama?.toLowerCase().includes(q) || r.nip?.includes(q)
    }
    if (detail === 'kelas') {
      const r = item as KelasRow
      return r.namaKelas?.toLowerCase().includes(q) || r.walikelas?.nama?.toLowerCase().includes(q)
    }
    const r = item as MapelRow
    return r.nama?.toLowerCase().includes(q) || r.guru?.nama?.toLowerCase().includes(q)
  })

  // Saring baris dialog status kehadiran
  const statusTerfilter = statusRows.filter(r => {
    if (!cariStatusDlg.trim()) return true
    const q = cariStatusDlg.toLowerCase()
    return r.siswa?.nama?.toLowerCase().includes(q) || r.siswa?.nis?.includes(q) || r.siswa?.kelas?.namaKelas?.toLowerCase().includes(q)
  })

  // Saring baris dialog guru
  const guruDlgTerfilter = guruDlgRows.filter(r => {
    if (!cariGuruDlg.trim()) return true
    const q = cariGuruDlg.toLowerCase()
    return r.guru?.nama?.toLowerCase().includes(q) || r.guru?.nip?.includes(q)
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-14 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-12 h-12 text-red-500 opacity-70" />
            <div>
              <p className="font-semibold text-foreground">Gagal memuat data</p>
              <p className="text-sm text-muted-foreground mt-1">
                Data dashboard tidak dapat dimuat. Periksa koneksi lalu coba lagi.
              </p>
            </div>
            <Button onClick={loadDashboard} className="bg-blue-700 hover:bg-blue-800">
              <Loader2 className="w-4 h-4 mr-2" /> Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const s = data.stats
  const namaSekolah = data.pengaturan.find(p => p.key === 'nama_sekolah')?.value || 'Sekolah'
  const tahunAjaran = data.pengaturan.find(p => p.key === 'tahun_ajaran')?.value || ''
  const semester = data.pengaturan.find(p => p.key === 'semester')?.value || ''

  const pieData = [
    { name: 'Hadir', value: s.hadir, color: '#16a34a' },
    { name: 'Terlambat', value: s.terlambat, color: '#d97706' },
    { name: 'Izin', value: s.izin, color: '#0891b2' },
    { name: 'Sakit', value: s.sakit, color: '#7c3aed' },
    { name: 'Alpha', value: s.alpha, color: '#dc2626' },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <Card className="bg-gradient-to-br from-blue-700 via-blue-800 to-sky-900 text-white border-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-6 lg:p-8 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-blue-100 text-sm mb-1">Selamat datang kembali di</p>
              <h2 className="text-2xl lg:text-3xl font-bold mb-2">{namaSekolah}</h2>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge className="bg-sky-400 text-blue-900 hover:bg-sky-400">
                  Tahun Ajaran {tahunAjaran}
                </Badge>
                <Badge className="bg-white/20 text-white hover:bg-white/20 border-0">
                  Semester {semester}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-100 text-sm">Hari ini</p>
              <p className="text-xl font-semibold">{formatDate(new Date())}</p>
              <p className="text-blue-100 text-sm mt-1">{formatTime(new Date())}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Siswa"
          value={s.totalSiswa}
          icon={Users}
          color="from-blue-500 to-sky-600"
          desc="Aktif terdaftar"
          hint="text-blue-600"
          onClick={() => bukaDetail('siswa')}
        />
        <StatCard
          title="Total Guru"
          value={s.totalGuru}
          icon={UserCog}
          color="from-sky-500 to-cyan-600"
          desc="Pengajar aktif"
          hint="text-sky-600"
          onClick={() => bukaDetail('guru')}
        />
        <StatCard
          title="Total Kelas"
          value={s.totalKelas}
          icon={School}
          color="from-cyan-500 to-blue-600"
          desc="Rombongan belajar"
          hint="text-cyan-600"
          onClick={() => bukaDetail('kelas')}
        />
        <StatCard
          title="Mata Pelajaran"
          value={s.totalMapel}
          icon={BookOpen}
          color="from-purple-500 to-pink-600"
          desc="Mata pelajaran"
          hint="text-purple-600"
          onClick={() => bukaDetail('mapel')}
        />
      </div>

      {/* Dialog detail daftar data (muncul saat kartu statistik diklik) */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] flex flex-col gap-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {detail && DETAIL_META[detail].judul}
              {!detailLoading && (
                <Badge variant="secondary" className="text-xs">{detailTerfilter.length} data</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {detail && DETAIL_META[detail].deskripsi}
            </DialogDescription>
          </DialogHeader>

          {/* Pencarian */}
          <div className="relative flex-shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={detailCari}
              onChange={(e) => setDetailCari(e.target.value)}
              placeholder="Cari nama / NIS / NIP / kelas…"
              className="pl-9"
            />
          </div>

          {/* Daftar data */}
          <div className="overflow-y-auto max-h-96 -mx-1 px-1">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <p className="text-sm">Memuat data…</p>
              </div>
            ) : detailTerfilter.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {detailCari ? 'Tidak ada data yang cocok dengan pencarian.' : 'Belum ada data.'}
              </div>
            ) : (
              <div className="space-y-2">
                {detail === 'siswa' && (detailTerfilter as SiswaRow[]).map(sw => (
                  <div key={sw.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold overflow-hidden">
                      {sw.foto ? <img src={sw.foto} alt={`Foto ${sw.nama}`} className="w-full h-full object-cover" /> : sw.nama.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{sw.nama}</p>
                      <p className="text-xs text-muted-foreground font-mono">NIS {sw.nis}</p>
                    </div>
                    {sw.kelas?.namaKelas && <Badge variant="secondary" className="flex-shrink-0">{sw.kelas.namaKelas}</Badge>}
                    <Badge variant="outline" className="flex-shrink-0 text-xs">{sw.jenisKelamin === 'P' ? 'Perempuan' : 'Laki-laki'}</Badge>
                  </div>
                ))}
                {detail === 'guru' && (detailTerfilter as GuruRow[]).map(g => (
                  <div key={g.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold overflow-hidden">
                      {g.foto ? <img src={g.foto} alt={`Foto ${g.nama}`} className="w-full h-full object-cover" /> : g.nama.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{g.nama}</p>
                      <p className="text-xs text-muted-foreground font-mono">NIP {g.nip}</p>
                    </div>
                    <Badge variant="outline" className={`flex-shrink-0 text-xs ${g.role === 'kepala_sekolah' ? 'text-purple-700 border-purple-300' : 'text-amber-700 border-amber-300'}`}>
                      {g.role === 'kepala_sekolah' ? 'Kepala Sekolah' : 'Guru'}
                    </Badge>
                  </div>
                ))}
                {detail === 'kelas' && (detailTerfilter as KelasRow[]).map(k => (
                  <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center flex-shrink-0">
                      <School className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{k.namaKelas}</p>
                      <p className="text-xs text-muted-foreground truncate">Wali: {k.walikelas?.nama || 'Belum ada'}</p>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 text-xs">Tingkat {k.tingkat}</Badge>
                    <Badge variant="secondary" className="flex-shrink-0">{k.jumlahSiswa ?? 0} siswa</Badge>
                  </div>
                ))}
                {detail === 'mapel' && (detailTerfilter as MapelRow[]).map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{m.nama}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.guru?.nama || 'Belum ada pengampu'}</p>
                    </div>
                    {m.jam && <Badge variant="outline" className="flex-shrink-0 text-xs font-mono">{m.jam}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: daftar siswa per status kehadiran hari ini (kotak Hadir/Terlambat/Izin/Sakit/Alpha diklik) */}
      <Dialog open={!!statusDlg} onOpenChange={(o) => !o && setStatusDlg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Siswa {statusDlg?.label} Hari Ini</DialogTitle>
            <DialogDescription>
              {statusLoading ? 'Memuat data...' : `${statusRows.length} siswa · ${formatDate(new Date())}`}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cari nama/NIS/kelas..." value={cariStatusDlg} onChange={(e) => setCariStatusDlg(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {statusLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
            ) : statusTerfilter.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                {statusDlg?.status === 'alpha' ? 'Semua siswa sudah absen hari ini.' : 'Tidak ada siswa dengan status ini.'}
              </div>
            ) : (
              statusTerfilter.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                    statusDlg?.status === 'alpha' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {r.siswa?.nama?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{r.siswa?.nama}</p>
                    <p className="text-xs text-muted-foreground font-mono">NIS {r.siswa?.nis}</p>
                  </div>
                  {r.siswa?.kelas?.namaKelas && (
                    <Badge variant="secondary" className="flex-shrink-0 text-xs">{r.siswa.kelas.namaKelas}</Badge>
                  )}
                  <div className="text-right flex-shrink-0">
                    {r.waktu ? (
                      <>
                        <p className="text-xs font-medium">{formatTime(r.waktu)}</p>
                        {!!r.keterlambatan && r.keterlambatan > 0 && (
                          <p className="text-[11px] text-amber-700">+{r.keterlambatan} menit</p>
                        )}
                      </>
                    ) : (
                      <Badge variant="outline" className={statusWarna[r.status] || ''}>{r.status}</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: daftar guru check-in / belum absen hari ini */}
      <Dialog open={!!guruDlg} onOpenChange={(o) => !o && setGuruDlg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{guruDlg === 'checkin' ? 'Guru Sudah Check-in' : 'Guru Belum Absen'}</DialogTitle>
            <DialogDescription>
              {guruDlgLoading ? 'Memuat data...' : `${guruDlgRows.length} guru · ${formatDate(new Date())}`}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cari nama/NIP..." value={cariGuruDlg} onChange={(e) => setCariGuruDlg(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {guruDlgLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
            ) : guruDlgTerfilter.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                {guruDlg === 'checkin' ? 'Belum ada guru yang check-in hari ini.' : 'Semua guru sudah absen hari ini. 🎉'}
              </div>
            ) : (
              guruDlgTerfilter.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                    guruDlg === 'checkin' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {r.guru?.nama?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{r.guru?.nama}</p>
                    <p className="text-xs text-muted-foreground font-mono">NIP {r.guru?.nip}</p>
                  </div>
                  {r.waktu ? (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium">{formatTime(r.waktu)}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{r.status}</p>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-red-700 border-red-300 flex-shrink-0">Belum absen</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: detail siswa (baris "Siswa Belum Absen" diklik) */}
      <Dialog open={!!siswaDlg} onOpenChange={(o) => !o && setSiswaDlg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {siswaDlg?.nama}
              {siswaDlg?.kelas && <Badge variant="secondary">{siswaDlg.kelas}</Badge>}
            </DialogTitle>
            <DialogDescription>Detail siswa & riwayat terakhir</DialogDescription>
          </DialogHeader>
          {siswaDlgLoading || !siswaDlgData ? (
            <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
          ) : (
            <div className="space-y-4">
              {/* Profil ringkas */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-2.5">
                  <p className="text-[11px] text-muted-foreground">NIS</p>
                  <p className="text-sm font-semibold font-mono">{siswaDlgData.profil?.nis || '-'}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-[11px] text-muted-foreground">L/P</p>
                  <p className="text-sm font-semibold">{siswaDlgData.profil?.jenisKelamin || '-'}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-[11px] text-muted-foreground">Total Poin Pelanggaran</p>
                  <p className={`text-sm font-bold ${siswaDlgData.totalPoin > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {siswaDlgData.totalPoin}
                  </p>
                </div>
              </div>

              {/* Riwayat absensi terakhir */}
              <div>
                <p className="text-sm font-semibold mb-2">Riwayat Absensi Terakhir</p>
                {siswaDlgData.riwayat.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center border rounded-lg">Belum ada riwayat absensi.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {siswaDlgData.riwayat.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm">
                        <span className="text-xs text-muted-foreground">{formatDate(r.waktu)}</span>
                        <div className="flex items-center gap-2">
                          {!!r.keterlambatan && r.keterlambatan > 0 && (
                            <span className="text-[11px] text-amber-700">+{r.keterlambatan} mnt</span>
                          )}
                          <Badge variant="outline" className={`text-xs capitalize ${statusWarna[r.status] || ''}`}>{r.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Riwayat pelanggaran ringkas */}
              {siswaDlgData.pelanggaran.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Pelanggaran ({siswaDlgData.pelanggaran.length}x)</p>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {siswaDlgData.pelanggaran.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm">
                        <span className="text-xs truncate">{p.jenisPelanggaran?.nama}</span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">-{p.jenisPelanggaran?.poin} poin</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: riwayat pelanggaran siswa (baris "Pelanggaran Terbaru" diklik) */}
      <Dialog open={!!pelDlg} onOpenChange={(o) => !o && setPelDlg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Riwayat Pelanggaran</DialogTitle>
            <DialogDescription>
              {pelDlgLoading ? 'Memuat data...' : `${pelDlg?.nama} · ${pelDlgRows.length} pelanggaran tercatat`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {pelDlgLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
            ) : pelDlgRows.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Tidak ada pelanggaran tercatat.</div>
            ) : (
              pelDlgRows.map(p => (
                <div key={p.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{p.jenisPelanggaran?.nama}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge variant="outline" className={`text-xs capitalize ${kategoriBadge[p.jenisPelanggaran?.kategori] || ''}`}>
                        {p.jenisPelanggaran?.kategori}
                      </Badge>
                      <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">-{p.jenisPelanggaran?.poin} poin</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground">{formatDate(p.tanggal)}</span>
                    {p.catatan && <span className="text-xs text-muted-foreground truncate italic">"{p.catatan}"</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Today attendance summary */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Kehadiran Siswa Hari Ini
            </CardTitle>
            <CardDescription>Ringkasan status kehadiran {formatDate(new Date())}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <AttendanceStat label="Hadir" value={s.hadir} total={s.totalSiswa} color="bg-emerald-50 text-emerald-700 border-emerald-200" onClick={() => bukaStatusKehadiran('hadir', 'Hadir')} />
              <AttendanceStat label="Terlambat" value={s.terlambat} total={s.totalSiswa} color="bg-amber-50 text-amber-700 border-amber-200" onClick={() => bukaStatusKehadiran('terlambat', 'Terlambat')} />
              <AttendanceStat label="Izin" value={s.izin} total={s.totalSiswa} color="bg-cyan-50 text-cyan-700 border-cyan-200" onClick={() => bukaStatusKehadiran('izin', 'Izin')} />
              <AttendanceStat label="Sakit" value={s.sakit} total={s.totalSiswa} color="bg-purple-50 text-purple-700 border-purple-200" onClick={() => bukaStatusKehadiran('sakit', 'Sakit')} />
              <AttendanceStat label="Alpha" value={s.alpha} total={s.totalSiswa} color="bg-red-50 text-red-700 border-red-200" onClick={() => bukaStatusKehadiran('alpha', 'Alpha')} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t">
              <button
                type="button"
                onClick={() => bukaGuruDialog('checkin')}
                aria-label="Lihat daftar guru sudah check-in"
                className="flex items-center gap-3 rounded-lg p-2 -m-2 text-left cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.guruHadir}/{s.totalGuru}</p>
                  <p className="text-xs text-muted-foreground">Guru sudah check-in</p>
                  <p className="text-[11px] text-blue-600 font-medium mt-0.5 flex items-center gap-1"><Eye className="w-3 h-3" /> Klik untuk lihat</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => bukaGuruDialog('belum')}
                aria-label="Lihat daftar guru belum absen"
                className="flex items-center gap-3 rounded-lg p-2 -m-2 text-left cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <UserX className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.guruBelumAbsen}</p>
                  <p className="text-xs text-muted-foreground">Guru belum absen</p>
                  <p className="text-[11px] text-blue-600 font-medium mt-0.5 flex items-center gap-1"><Eye className="w-3 h-3" /> Klik untuk lihat</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Kehadiran</CardTitle>
            <CardDescription>Persentase kehadiran hari ini</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Trend 7 days */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Tren Kehadiran 7 Hari Terakhir
            </CardTitle>
            <CardDescription>Grafik kehadiran, keterlambatan, dan ketidakhadiran</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.tren7Hari} margin={{ left: -20, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="gHadir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gTerlambat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAbsen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="hadir" stroke="#16a34a" fill="url(#gHadir)" strokeWidth={2} name="Hadir" />
                <Area type="monotone" dataKey="terlambat" stroke="#d97706" fill="url(#gTerlambat)" strokeWidth={2} name="Terlambat" />
                <Area type="monotone" dataKey="absen" stroke="#dc2626" fill="url(#gAbsen)" strokeWidth={2} name="Tidak Hadir" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kehadiran per Kelas</CardTitle>
            <CardDescription>Jumlah siswa hadir hari ini per kelas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.distribusiKelas} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="kelas" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="hadir" fill="#16a34a" name="Hadir" radius={[6, 6, 0, 0]} />
                <Bar dataKey="total" fill="#e5e7eb" name="Total Siswa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Pelanggaran Terbaru
            </CardTitle>
            <CardDescription>5 pelanggaran siswa terakhir · klik baris untuk lihat riwayat</CardDescription>
          </CardHeader>
          <CardContent>
            {data.pelanggaranTerbaru.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Tidak ada pelanggaran tercatat.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {data.pelanggaranTerbaru.map(p => (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Lihat riwayat pelanggaran ${p.siswa}`}
                    onClick={() => bukaRiwayatPelanggaran(p.siswaId, p.siswa)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        bukaRiwayatPelanggaran(p.siswaId, p.siswa)
                      }
                    }}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{p.siswa}</p>
                        <Badge variant="outline" className="text-amber-700 border-amber-300 flex-shrink-0">
                          -{p.poin} poin
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{p.pelanggaran}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{p.kelas}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(p.tanggal)}</span>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-600" />
              Siswa Belum Absen Hari Ini
            </CardTitle>
            <CardDescription>Siswa yang belum melakukan check-in · klik baris untuk detail</CardDescription>
          </CardHeader>
          <CardContent>
            {data.belumAbsen.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Semua siswa sudah absen. 🎉
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {data.belumAbsen.map(s => (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Lihat detail ${s.nama}`}
                    onClick={() => bukaDetailSiswa(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        bukaDetailSiswa(s)
                      }
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                      {s.nama.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.nama}</p>
                      <p className="text-xs text-muted-foreground">{s.kelas}</p>
                    </div>
                    <Badge variant="outline" className="text-red-700 border-red-300">Belum</Badge>
                    <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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

function StatCard({ title, value, icon: Icon, color, desc, hint, onClick }: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  desc: string
  hint: string
  onClick: () => void
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Lihat daftar ${title}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            <p className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${hint}`}>
              <Eye className="w-3 h-3" />
              Klik untuk lihat data
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-md`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AttendanceStat({ label, value, total, color, onClick }: {
  label: string
  value: number
  total: number
  color: string
  onClick?: () => void
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const interaktif = !!onClick
  return (
    <div
      {...(interaktif ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': `Lihat daftar siswa ${label} hari ini`,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
          }
        },
      } : {})}
      className={`rounded-lg border p-3 ${color} ${interaktif ? 'cursor-pointer hover:shadow-sm hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600' : ''}`}
    >
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{pct}% dari {total}</p>
      {interaktif && (
        <p className="text-[11px] mt-1 font-medium opacity-90 flex items-center gap-1">
          <Eye className="w-3 h-3" /> Klik untuk lihat
        </p>
      )}
    </div>
  )
}
