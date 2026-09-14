'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/lib/api'
import { useApiQuery } from '@/hooks/use-api-query'
import { escapeField } from '@/lib/csv'
import { tanggalWIB } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CalendarCheck, Loader2, FileDown, Printer } from 'lucide-react'
import { toast } from 'sonner'

interface Kelas { id: string; namaKelas: string }
interface RekapItem {
  siswa: { id: string; nis: string; nama: string; kelas: string }
  hadir: number
  terlambat: number
  izin: number
  sakit: number
  alpha: number
  totalHadir: number
  totalPelanggaran: number
  totalPoin: number
}

const BULAN = [
  { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' }, { value: '04', label: 'April' },
  { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
]

export function RekapBulananView() {
  const [bulan, setBulan] = useState(tanggalWIB().slice(0, 7))
  const [kelasId, setKelasId] = useState('all')
  const [printing, setPrinting] = useState(false)

  const bulanAman = bulan || tanggalWIB().slice(0, 7)

  // ✅ Master data — cached
  const { data: kelasListRaw } = useApiQuery<Kelas[]>('kelas', '/api/kelas')
  const { data: pengaturanRaw } = useApiQuery<Record<string, string>>('pengaturan', '/api/pengaturan')

  const kelasList = useMemo(() => kelasListRaw ?? [], [kelasListRaw])
  const pengaturan = useMemo(() => pengaturanRaw ?? {}, [pengaturanRaw])

  // ✅ Rekap per (bulan, kelas) — cached per kombinasi
  const {
    data: rekapRaw,
    isLoading,
    isFetching,
  } = useApiQuery<{ rekap: RekapItem[]; totalSiswa: number }>(
    ['rekap', { bulan: bulanAman, kelasId }],
    `/api/rekap?bulan=${bulanAman}${kelasId !== 'all' ? `&kelasId=${kelasId}` : ''}`
  )
  const rekap = useMemo(() => rekapRaw?.rekap ?? [], [rekapRaw])

  const handlePrint = () => {
    if (rekap.length === 0) { toast.error('Tidak ada data untuk dicetak'); return }
    setPrinting(true)
  }

  const handleExport = () => {
    const headers = ['NIS', 'Nama', 'Kelas', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpha', 'Pelanggaran', 'Poin']
    const rows = rekap.map(r => [
      r.siswa.nis, r.siswa.nama, r.siswa.kelas,
      r.hadir, r.terlambat, r.izin, r.sakit, r.alpha,
      r.totalPelanggaran, r.totalPoin,
    ])
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => escapeField(String(v))).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rekap-kehadiran-${bulanAman}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV berhasil diunduh')
  }

  const [year, month] = bulanAman.split('-')
  const bulanLabel = BULAN.find(b => b.value === month)?.label || '-'
  const kelasLabel = kelasId === 'all' ? 'Semua Kelas' : kelasList.find(k => k.id === kelasId)?.namaKelas || '-'

  const persenKehadiran = (r: RekapItem) => {
    const total = r.hadir + r.terlambat + r.izin + r.sakit + r.alpha
    if (total === 0) return '-'
    return `${(((r.hadir + r.terlambat) / total) * 100).toFixed(1)}%`
  }

  const totalHadir = rekap.reduce((s, r) => s + r.hadir, 0)
  const totalTerlambat = rekap.reduce((s, r) => s + r.terlambat, 0)
  const totalIzin = rekap.reduce((s, r) => s + r.izin, 0)
  const totalSakit = rekap.reduce((s, r) => s + r.sakit, 0)
  const totalAlpha = rekap.reduce((s, r) => s + r.alpha, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-blue-600" />
            Rekap Bulanan Kehadiran
            {isFetching && !isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </CardTitle>
          <CardDescription>Rekapitulasi kehadiran siswa per bulan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Bulan</Label>
              <Input
                type="month"
                value={bulan}
                onChange={(e) => { if (e.target.value) setBulan(e.target.value) }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Filter Kelas</Label>
              <Select value={kelasId} onValueChange={setKelasId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {kelasList.map(k => <SelectItem key={k.id} value={k.id}>{k.namaKelas}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={handleExport} className="flex-1">
                <FileDown className="w-4 h-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" onClick={handlePrint} className="flex-1">
                <Printer className="w-4 h-4 mr-2" /> Cetak
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox label="Hadir" value={totalHadir} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
        <StatBox label="Terlambat" value={totalTerlambat} color="bg-amber-50 text-amber-700 border-amber-200" />
        <StatBox label="Izin" value={totalIzin} color="bg-cyan-50 text-cyan-700 border-cyan-200" />
        <StatBox label="Sakit" value={totalSakit} color="bg-purple-50 text-purple-700 border-purple-200" />
        <StatBox label="Alpha" value={totalAlpha} color="bg-red-50 text-red-700 border-red-200" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail Rekap - {bulanLabel} {year}</CardTitle>
          <CardDescription>{rekap.length} siswa</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : rekap.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Tidak ada data pada periode ini.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="text-center">H</TableHead>
                    <TableHead className="text-center">T</TableHead>
                    <TableHead className="text-center">I</TableHead>
                    <TableHead className="text-center">S</TableHead>
                    <TableHead className="text-center">A</TableHead>
                    <TableHead className="text-center">Pelanggaran</TableHead>
                    <TableHead className="text-center">Poin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rekap.map((r, i) => (
                    <TableRow key={r.siswa.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{r.siswa.nis}</TableCell>
                      <TableCell className="font-medium">{r.siswa.nama}</TableCell>
                      <TableCell><Badge variant="outline">{r.siswa.kelas}</Badge></TableCell>
                      <TableCell className="text-center font-medium text-emerald-700">{r.hadir}</TableCell>
                      <TableCell className="text-center font-medium text-amber-700">{r.terlambat}</TableCell>
                      <TableCell className="text-center font-medium text-cyan-700">{r.izin}</TableCell>
                      <TableCell className="text-center font-medium text-purple-700">{r.sakit}</TableCell>
                      <TableCell className="text-center font-medium text-red-700">{r.alpha}</TableCell>
                      <TableCell className="text-center">{r.totalPelanggaran}</TableCell>
                      <TableCell className="text-center">
                        {r.totalPoin > 0 ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-300">{r.totalPoin}</Badge>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {printing && (
        <RekapPrintSheet
          rekap={rekap}
          periode={`${bulanLabel} ${year}`}
          kelasLabel={kelasLabel}
          pengaturan={pengaturan}
          persenKehadiran={persenKehadiran}
          onDone={() => setPrinting(false)}
        />
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

function RekapPrintSheet({ rekap, periode, kelasLabel, pengaturan, persenKehadiran, onDone }: {
  rekap: RekapItem[]
  periode: string
  kelasLabel: string
  pengaturan: Record<string, string>
  persenKehadiran: (r: RekapItem) => string
  onDone: () => void
}) {
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

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

  const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const namaSekolah = pengaturan.nama_sekolah || 'SEKOLAH'
  const alamatSekolah = pengaturan.alamat_sekolah || ''
  const logoSekolah = pengaturan.logo_sekolah || ''
  const kepalaSekolah = pengaturan.kepala_sekolah || ''

  return createPortal(
    <div id="print-area" className="hidden print:block" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, borderBottom: '3px double #000', paddingBottom: 8 }}>
        {logoSekolah && <img src={logoSekolah} alt="Logo sekolah" style={{ height: 56, width: 56, objectFit: 'contain' }} />}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.2 }}>{namaSekolah}</div>
          {alamatSekolah && <div style={{ fontSize: 10 }}>{alamatSekolah}</div>}
        </div>
      </div>

      <h2 style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, margin: '10px 0 2px', textDecoration: 'underline' }}>
        Rekap Bulanan Kehadiran
      </h2>
      <p style={{ textAlign: 'center', fontSize: 11, margin: 0 }}>
        Periode: {periode} &nbsp;&middot;&nbsp; Kelas: {kelasLabel}
      </p>

      <table className="print-table" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th style={{ width: 24 }}>No</th>
            <th>NIS</th>
            <th>Nama</th>
            <th>Kelas</th>
            <th>Hadir</th>
            <th>Terlambat</th>
            <th>Izin</th>
            <th>Sakit</th>
            <th>Alpha</th>
            <th>% Kehadiran</th>
          </tr>
        </thead>
        <tbody>
          {rekap.map((r, i) => (
            <tr key={r.siswa.id}>
              <td className="num">{i + 1}</td>
              <td>{r.siswa.nis}</td>
              <td>{r.siswa.nama}</td>
              <td className="ctr">{r.siswa.kelas || '-'}</td>
              <td className="num">{r.hadir}</td>
              <td className="num">{r.terlambat}</td>
              <td className="num">{r.izin}</td>
              <td className="num">{r.sakit}</td>
              <td className="num">{r.alpha}</td>
              <td className="num">{persenKehadiran(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, fontSize: 11, pageBreakInside: 'avoid' }}>
        <div style={{ textAlign: 'left' }}>
          <p style={{ margin: 0 }}>Mengetahui,</p>
          <p style={{ margin: 0 }}>Kepala Sekolah</p>
          <div style={{ height: 60 }} />
          <p style={{ margin: 0, fontWeight: 700, textDecoration: 'underline' }}>
            {kepalaSekolah || '_____________________'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0 }}>_______________, {tanggalCetak}</p>
          <div style={{ height: 74 }} />
          <p style={{ margin: 0 }}>( _____________________ )</p>
        </div>
      </div>
    </div>,
    document.body
  )
}