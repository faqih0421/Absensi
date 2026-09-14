'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api'
import { downloadCsvTemplate, normalizeHeader, parseCsv } from '@/lib/csv'
import { toast } from 'sonner'
import { CheckCircle2, Download, FileUp, Loader2, RotateCcw, Upload, XCircle } from 'lucide-react'

export interface ImportColumnDef {
  key: string
  header: string
  required?: boolean
  example: string
}

export interface ParsedRow {
  data: Record<string, string> // untuk tampilan preview (key = kolom CSV)
  send?: Record<string, unknown> // payload ke API (jika beda dari data)
  errors: string[]
}

interface ImportResult {
  imported: number
  skipped: { baris: number; identitas: string; alasan: string }[]
}

export function ImportCsvDialog({
  open,
  onOpenChange,
  title,
  description,
  templateName,
  endpoint,
  columns,
  templateRows,
  buildRows,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  templateName: string
  endpoint: string
  columns: ImportColumnDef[]
  templateRows: Record<string, string>[]
  buildRows: (rows: Record<string, string>[]) => ParsedRow[]
  onImported: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<'input' | 'preview' | 'result'>('input')
  const [source, setSource] = useState('')
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const reset = () => {
    setStage('input')
    setSource('')
    setParsed([])
    setResult(null)
    setPasteText('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const dlTemplate = () => {
    downloadCsvTemplate(
      templateName,
      columns.map((c) => c.header),
      templateRows.map((tr) => columns.map((c) => tr[c.key] ?? ''))
    )
  }

  const processText = (text: string, sourceName: string) => {
    const matrix = parseCsv(text)
    if (matrix.length < 2) {
      toast.error('Data CSV kosong atau hanya berisi header')
      return
    }
    const headers = matrix[0].map(normalizeHeader)
    const missing = columns.filter((c) => c.required && !headers.includes(c.key))
    if (missing.length > 0) {
      toast.error(`Kolom wajib tidak ditemukan: ${missing.map((m) => m.header).join(', ')}`)
      return
    }
    const rawRows = matrix.slice(1).map((r) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim()
      })
      return obj
    })
    setSource(sourceName)
    setParsed(buildRows(rawRows))
    setStage('preview')
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => processText(String(reader.result || ''), file.name)
    reader.onerror = () => toast.error('Gagal membaca file')
    reader.readAsText(file)
  }

  const validRows = parsed.filter((p) => p.errors.length === 0)
  const invalidRows = parsed.filter((p) => p.errors.length > 0)

  const doImport = async () => {
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const res = await api<ImportResult>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ rows: validRows.map((p) => p.send ?? p.data) }),
      })
      setResult(res)
      setStage('result')
      onImported()
      if (res.imported > 0) toast.success(`${res.imported} data berhasil diimport`)
    } catch (e: any) {
      toast.error(e.message || 'Import gagal')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {stage === 'input' && (
          <div className="space-y-4 py-1">
            {/* Daftar kolom */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Format kolom CSV (urutan bebas):</p>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((c) => (
                  <Badge key={c.key} variant={c.required ? 'default' : 'outline'} className="text-xs">
                    {c.header}
                    {c.required ? ' *' : ''}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tanda * = wajib diisi. Pemisah koma (,) atau titik koma (;) didukung.
              </p>
            </div>

            {/* Template + file */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={dlTemplate} className="flex-1">
                <Download className="w-4 h-4 mr-2" /> Download Template CSV
              </Button>
              <Button onClick={() => fileRef.current?.click()} className="flex-1 bg-blue-700 hover:bg-blue-800">
                <Upload className="w-4 h-4 mr-2" /> Pilih File CSV
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>

            {/* Paste manual */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Atau tempel data CSV di sini:</p>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`${columns.map((c) => c.header).join(',')}\n${columns.map((c) => c.example).join(',')}`}
                rows={4}
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!pasteText.trim()}
                onClick={() => processText(pasteText, 'tempelan teks')}
              >
                <FileUp className="w-4 h-4 mr-1" /> Proses Data Tempel
              </Button>
            </div>
          </div>
        )}

        {stage === 'preview' && (
          <div className="space-y-3 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="max-w-48 truncate">{source}</Badge>
              <Badge className="bg-emerald-600 text-white">
                <CheckCircle2 className="w-3 h-3 mr-1" /> {validRows.length} valid
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" /> {invalidRows.length} error
                </Badge>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-72 overflow-y-auto overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">Baris</TableHead>
                      {columns.map((c) => (
                        <TableHead key={c.key}>{c.header}</TableHead>
                      ))}
                      <TableHead className="w-56">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((p, i) => (
                      <TableRow key={i} className={p.errors.length > 0 ? 'bg-red-50/60' : ''}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        {columns.map((c) => (
                          <TableCell key={c.key} className="text-xs max-w-40 truncate" title={p.data[c.key] || ''}>
                            {p.data[c.key] || '-'}
                          </TableCell>
                        ))}
                        <TableCell>
                          {p.errors.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Siap import
                            </span>
                          ) : (
                            <span className="text-xs text-red-700 leading-tight block">{p.errors.join(' ')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Baris bererror dilewati, hanya baris valid yang akan diimport.
              </p>
            )}
          </div>
        )}

        {stage === 'result' && result && (
          <div className="space-y-3 py-1">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">{result.imported} data berhasil diimport.</span>{' '}
                {result.skipped.length > 0 && `${result.skipped.length} data dilewati.`}
              </p>
            </div>
            {result.skipped.length > 0 && (
              <div className="border rounded-lg">
                <p className="text-sm font-medium px-3 pt-2">Detail data yang dilewati:</p>
                <ScrollArea className="max-h-56">
                  <div className="px-3 pb-2 pt-1 space-y-1">
                    {result.skipped.map((s, i) => (
                      <div key={i} className="text-xs flex gap-2">
                        <Badge variant="outline" className="flex-shrink-0">Baris {s.baris}</Badge>
                        <span className="font-medium">{s.identitas}</span>
                        <span className="text-muted-foreground">— {s.alasan}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {stage === 'input' && <Button variant="outline" onClick={() => handleClose(false)}>Batal</Button>}
          {stage === 'preview' && (
            <>
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="w-4 h-4 mr-1" /> Kembali
              </Button>
              <Button onClick={doImport} disabled={validRows.length === 0 || importing} className="bg-blue-700 hover:bg-blue-800">
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Upload className="w-4 h-4 mr-2" />
                Import {validRows.length} Data
              </Button>
            </>
          )}
          {stage === 'result' && (
            <Button onClick={() => handleClose(false)} className="bg-blue-700 hover:bg-blue-800">Selesai</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
