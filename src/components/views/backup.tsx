'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Database, Download, Loader2, FileJson, AlertCircle, CheckCircle2, RefreshCw, Archive, FolderDown, Code2 } from 'lucide-react'
import { toast } from 'sonner'
import { tanggalWIB } from '@/lib/utils'

interface BackupResult {
  success: boolean
  fileName: string
  size: string
  tables: Record<string, number>
  downloadUrl: string
}

export function BackupView() {
  const [backup, setBackup] = useState<BackupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloadingCode, setDownloadingCode] = useState(false)
  const [downloadingBackup, setDownloadingBackup] = useState(false)

  const handleBackup = async () => {
    setLoading(true)
    try {
      const res = await api<BackupResult>('/api/backup', { method: 'GET' })
      setBackup(res)
      toast.success('Backup berhasil dibuat')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Unduh file via fetch + header token (server menolak request tanpa token).
  // Hasil respons diubah menjadi blob lalu di-trigger unduh via <a> sementara.
  const downloadWithAuth = async (url: string, filename: string) => {
    const token = localStorage.getItem('sistabsen_token')
    const res = await fetch(url, { headers: token ? { 'x-auth-token': token } : {} })
    if (!res.ok) throw new Error('Gagal mengunduh file')
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  }

  const handleDownloadCode = async () => {
    setDownloadingCode(true)
    try {
      await downloadWithAuth('/api/download-code', `sistabsen-source-${tanggalWIB()}.zip`)
      toast.success('Kode sumber (ZIP) berhasil diunduh')
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunduh kode sumber')
    } finally {
      setDownloadingCode(false)
    }
  }

  const handleDownloadBackup = async () => {
    if (!backup) return
    setDownloadingBackup(true)
    try {
      await downloadWithAuth(backup.downloadUrl, backup.fileName)
      toast.success('File backup diunduh')
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengunduh file backup')
    } finally {
      setDownloadingBackup(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Backup Database
          </CardTitle>
          <CardDescription>
            Cadangkan seluruh data aplikasi ke file JSON. Lakukan secara berkala untuk keamanan data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Archive className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-900 mb-1">Informasi Backup</p>
                    <ul className="text-blue-800 space-y-1 text-xs">
                      <li>• Format file: JSON (dapat dibaca dengan editor teks)</li>
                      <li>• Mencakup seluruh data: siswa, guru, kelas, mapel, absensi, nilai, pelanggaran</li>
                      <li>• Disarankan backup minimal seminggu sekali</li>
                      <li>• Simpan file backup di tempat aman (cloud storage / external drive)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button onClick={handleBackup} disabled={loading} className="bg-blue-700 hover:bg-blue-800">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Buat Backup Sekarang
              </Button>
            </div>

            <div className="flex-1">
              {backup ? (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <p className="font-semibold">Backup Berhasil Dibuat</p>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">File:</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{backup.fileName}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ukuran:</span>
                      <span className="font-medium">{backup.size}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleDownloadBackup}
                    disabled={downloadingBackup}
                  >
                    {downloadingBackup ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileJson className="w-4 h-4 mr-2" />}
                    Unduh File Backup
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center">
                  <Database className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Belum ada backup yang dibuat. Klik tombol di samping untuk memulai.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {backup && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detail Data yang Dicadangkan</CardTitle>
            <CardDescription>Jumlah record per tabel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Tabel</TableHead>
                    <TableHead className="text-right">Jumlah Record</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(backup.tables).map(([key, val]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{val} record</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-1">Tips Restore</p>
              <p className="text-xs">
                Untuk restore, hubungi administrator sistem. File backup berisi data lengkap dalam format JSON
                yang dapat diimpor kembali ke database jika diperlukan.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderDown className="w-5 h-5 text-blue-600" />
            Download Kode Sumber (ZIP)
          </CardTitle>
          <CardDescription>
            Unduh seluruh kode aplikasi untuk dibuka dan dijalankan di komputer Anda dengan Visual Studio Code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Code2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900 mb-1">Isi ZIP &amp; Cara Pakai</p>
                <ul className="text-blue-800 space-y-1 text-xs">
                  <li>• Berisi: kode sumber (src), prisma, database, dan konfigurasi proyek (tanpa node_modules)</li>
                  <li>• Ekstrak file ZIP, lalu buka foldernya di VS Code: File &gt; Open Folder</li>
                  <li>• Di terminal VS Code jalankan: bun install → npx prisma generate → bun run dev</li>
                  <li>• Buka http://localhost:3000 di browser (petunjuk lengkap ada di file CARA-MENJALANKAN.txt)</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={handleDownloadCode}
            disabled={downloadingCode}
            variant="outline"
            className="border-blue-700 text-blue-700 hover:bg-blue-50"
          >
            {downloadingCode ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderDown className="w-4 h-4 mr-2" />}
            Download Kode Sumber (ZIP)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
