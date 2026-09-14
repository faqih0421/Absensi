'use client'

import { useState } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Rocket, Server, Copy, CheckCircle2, Globe, ShieldCheck,
  AlertTriangle, Terminal, Cloud, Wifi, Database, RefreshCw,
  Info, ListChecks,
} from 'lucide-react'
import { toast } from 'sonner'

// Blok perintah dengan tombol salin sekali klik
function BlokKode({ kode }: { kode: string }) {
  const [tersalin, setTersalin] = useState(false)

  const salin = async () => {
    try {
      // Clipboard API butuh konteks aman (HTTPS/localhost). Fallback execCommand
      // agar tombol salin tetap bekerja saat server diakses via http://IP sebelum SSL dipasang.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(kode)
      } else {
        const ta = document.createElement('textarea')
        ta.value = kode
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        ta.remove()
        if (!ok) throw new Error('execCommand gagal')
      }
      setTersalin(true)
      toast.success('Perintah disalin ke clipboard')
      setTimeout(() => setTersalin(false), 2000)
    } catch {
      toast.error('Gagal menyalin — silakan salin manual')
    }
  }

  return (
    <div className="relative group mt-2">
      <pre className="bg-slate-900 text-slate-100 text-xs sm:text-[13px] leading-relaxed rounded-lg p-3 pr-12 overflow-x-auto font-mono">
        {kode}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        onClick={salin}
        className="absolute top-1.5 right-1.5 h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800"
        aria-label="Salin perintah"
      >
        {tersalin ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  )
}

interface Langkah {
  judul: string
  deskripsi: string
  kode?: string
  kode2?: string
  catatan?: string
}

const LANGKAH_VPS: Langkah[] = [
  {
    judul: 'Unduh kode sumber dari aplikasi ini',
    deskripsi:
      'Buka menu "Backup Database" di aplikasi, lalu klik "Download Kode Sumber (ZIP)". ' +
      'ZIP ini berisi seluruh kode, database bersih (db/custom.db), dan panduan lengkap ' +
      '(PANDUAN-DEPLOYMENT.md). Sekalian buat 1 file Backup JSON sebagai cadangan data.',
  },
  {
    judul: 'Siapkan server VPS',
    deskripsi:
      'Sewa VPS Ubuntu 22.04/24.04 (DigitalOcean, Vultr, Hostinger, Niagahoster, Rumahweb, AWS Lightsail). ' +
      'Spesifikasi cukup: 1 CPU, 1 GB RAM, 10 GB SSD. Pilih lokasi terdekat (Jakarta/Singapura). ' +
      'Catat IP publik & kata sandi root. Jika punya domain (mis. absensi.sekolah.sch.id), arahkan record A domain ke IP server.',
    kode:
      'sudo apt update && sudo apt upgrade -y\ncurl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\nsudo apt install -y nodejs nginx unzip\nsudo npm install -g pm2',
    catatan: 'Perintah di atas menginstall Node.js 20 LTS, Nginx (web server), dan PM2 (penjaga proses).',
  },
  {
    judul: 'Unggah & ekstrak kode ke server',
    deskripsi:
      'Unggah ZIP dari komputer Anda ke server (perintah scp, atau aplikasi SFTP seperti FileZilla — cukup drag & drop). Lalu ekstrak:',
    kode:
      '# dari komputer Anda (ganti IP_SERVER dengan IP VPS)\nscp sistabsen-source-*.zip root@IP_SERVER:/opt/\n\n# masuk ke server, lalu ekstrak\nssh root@IP_SERVER\ncd /opt && unzip -o sistabsen-source-*.zip -d sistabsen && cd sistabsen',
  },
  {
    judul: 'Install dependencies & siapkan database',
    deskripsi:
      'Database SQLite (db/custom.db) sudah termasuk di dalam ZIP — tidak perlu setup tambahan. ' +
      'Opsional namun disarankan: tambahkan kunci rahasia sendiri untuk keamanan token login:',
    kode:
      'npm install\nnpx prisma generate\n\necho "SISTABSEN_SECRET=$(openssl rand -hex 32)" >> .env',
  },
  {
    judul: 'Build versi produksi',
    deskripsi: 'Kompilasi aplikasi menjadi versi produksi yang cepat dan efisien:',
    kode: 'npm run build',
    catatan: 'Perintah build memakai cp (perintah Linux). Di VPS Ubuntu aman; di Windows gunakan WSL/Git Bash atau build langsung di server.',
  },
  {
    judul: 'Jalankan aplikasi dengan PM2',
    deskripsi:
      'PM2 membuat aplikasi selalu hidup (auto-restart bila crash) dan otomatis menyala saat server reboot:',
    kode:
      'pm2 start "NODE_ENV=production node .next/standalone/server.js" --name sistabsen\npm2 save && pm2 startup\npm2 logs sistabsen   # lihat log bila perlu',
    catatan: 'Aplikasi kini berjalan di port 3000. Uji: curl http://localhost:3000 dari server.',
  },
  {
    judul: 'Pasang Nginx (penghubung domain ke aplikasi)',
    deskripsi:
      'Buat file konfigurasi /etc/nginx/sites-available/sistabsen (ganti absensi.sekolah.sch.id dengan domain Anda; jika belum punya domain, isi dengan IP_SERVER):',
    kode:
      'server {\n  listen 80;\n  server_name absensi.sekolah.sch.id;\n  client_max_body_size 20M;\n\n  location / {\n    proxy_pass http://127.0.0.1:3000;\n    proxy_http_version 1.1;\n    proxy_set_header Upgrade $http_upgrade;\n    proxy_set_header Connection "upgrade";\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_set_header X-Forwarded-Proto $scheme;\n  }\n}',
    kode2:
      'sudo ln -s /etc/nginx/sites-available/sistabsen /etc/nginx/sites-enabled/\nsudo rm -f /etc/nginx/sites-enabled/default\nsudo nginx -t && sudo systemctl reload nginx',
  },
  {
    judul: 'Aktifkan HTTPS gratis (Let\u2019s Encrypt)',
    deskripsi:
      'Wajib sebelum dipakai guru & siswa agar login terenkripsi. Pastikan domain sudah mengarah ke IP server, lalu jalankan:',
    kode:
      'sudo apt install -y certbot python3-certbot-nginx\nsudo certbot --nginx -d absensi.sekolah.sch.id',
    catatan: 'Certbot otomatis memperbarui sertifikat. Selesai — buka https://absensi.sekolah.sch.id',
  },
]

export function PanduanHostingView() {
  const [langkahAktif, setLangkahAktif] = useState<number>(0)

  return (
    <div className="space-y-4">
      {/* Peta jalan singkat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-600" />
            Panduan Deployment ke Hosting
          </CardTitle>
          <CardDescription>
            Empat langkah menuju aplikasi online: unduh kode → sewa VPS → pasang di server → aktifkan domain & HTTPS.
            Ikuti panduan lengkap di bawah — semua perintah tinggal klik tombol salin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { ikon: Database, judul: '1. Unduh Kode', ket: 'Menu Backup Database' },
              { ikon: Server, judul: '2. Sewa VPS', ket: 'Ubuntu 1GB RAM cukup' },
              { ikon: Terminal, judul: '3. Pasang App', ket: 'npm install → build → PM2' },
              { ikon: Globe, judul: '4. Domain+SSL', ket: 'Nginx + Let\u2019s Encrypt' },
            ].map((s) => (
              <div key={s.judul} className="rounded-lg border bg-muted/40 p-3 flex items-start gap-3">
                <s.ikon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{s.judul}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.ket}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-900">
              <p className="font-semibold">Kenapa VPS, bukan Vercel/Netlify?</p>
              <p className="mt-0.5">
                Aplikasi ini memakai database SQLite berupa file (db/custom.db). Hosting serverless seperti
                Vercel/Netlify tidak menyimpan file secara permanen — data akan hilang. Gunakan VPS, cPanel
                Node.js, atau platform berdisk persisten (Railway/Render).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="vps" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="vps" className="gap-1.5 py-2">
            <Server className="w-4 h-4" />
            <span className="hidden sm:inline">VPS Ubuntu</span>
            <span className="sm:hidden">VPS</span>
            <Badge className="bg-blue-700 text-[10px] px-1.5">Rekomendasi</Badge>
          </TabsTrigger>
          <TabsTrigger value="lain" className="gap-1.5 py-2">
            <Cloud className="w-4 h-4" />
            <span className="hidden sm:inline">Hosting Lain</span>
            <span className="sm:hidden">Lain</span>
          </TabsTrigger>
          <TabsTrigger value="golive" className="gap-1.5 py-2">
            <ListChecks className="w-4 h-4" />
            <span className="hidden sm:inline">Go-Live &amp; Tips</span>
            <span className="sm:hidden">Tips</span>
          </TabsTrigger>
        </TabsList>

        {/* ============ TAB VPS ============ */}
        <TabsContent value="vps" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Langkah demi Langkah — VPS Ubuntu</CardTitle>
              <CardDescription>
                Total waktu ± 30 menit. Klik nomor langkah untuk membuka detailnya.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {LANGKAH_VPS.map((l, i) => {
                const buka = langkahAktif === i
                return (
                  <div key={l.judul} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setLangkahAktif(buka ? -1 : i)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                      aria-expanded={buka}
                    >
                      <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${buka ? 'bg-blue-700 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium flex-1 min-w-0">{l.judul}</span>
                      <span className={`text-xs text-muted-foreground transition-transform flex-shrink-0 ${buka ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {buka && (
                      <div className="px-3 pb-3 space-y-2 border-t bg-muted/20">
                        <p className="text-sm text-muted-foreground pt-3">{l.deskripsi}</p>
                        {l.kode && <BlokKode kode={l.kode} />}
                        {l.kode2 && <BlokKode kode={l.kode2} />}
                        {l.catatan && (
                          <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-2">
                            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{l.catatan}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                Memperbarui Aplikasi di Server (Nanti)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-red-900">
                  <span className="font-semibold">PENTING:</span> ZIP kode sumber berisi file database
                  (db/custom.db). Saat memperbarui aplikasi, <span className="font-semibold">JANGAN menimpa folder db</span> di
                  server — data absensi bisa hilang. Selalu buat Backup JSON dulu.
                </p>
              </div>
              <BlokKode
                kode={
                  '# di server: cadangkan data dulu, lalu pasang versi baru\ncp -r db /opt/backup-db-$(date +%F)\ncd /opt && unzip -o sistabsen-source-baru.zip -d sistabsen-baru\n# salin data lama ke versi baru\ncp -r /opt/backup-db-*/custom.db /opt/sistabsen-baru/db/\ncd /opt/sistabsen-baru && npm install && npx prisma generate && npm run build\npm2 delete sistabsen && pm2 start "NODE_ENV=production node .next/standalone/server.js" --name sistabsen && pm2 save'
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB HOSTING LAIN ============ */}
        <TabsContent value="lain" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                cPanel dengan Node.js App
              </CardTitle>
              <CardDescription>
                Untuk hosting share cPanel yang punya fitur <em>Setup Node.js App</em> (tanyakan ke penyedia hosting).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5">
                <li>Unggah ZIP via File Manager cPanel, lalu Extract di home direktori.</li>
                <li>Buka <em>Setup Node.js App</em> → buat aplikasi (Node 20, Application Root = folder proyek).</li>
                <li>Buka Terminal cPanel di folder proyek, jalankan: npm install, npx prisma generate, npm run build.</li>
                <li>Nyalakan aplikasi &amp; uji akses lewat domain yang terkait.</li>
              </ol>
              <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Hasil paling stabil tetap VPS. Passenger cPanel kadang tidak cocok dengan output standalone Next.js —
                  gunakan opsi ini hanya jika sudah terbiasa dengan cPanel.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-600" />
                Railway / Render (PaaS, disk persisten)
              </CardTitle>
              <CardDescription>
                Paling mudah diklik-klik, tanpa perintah Linux — tapi berlangganan (mulai ± $5/bulan) dan wajib
                memakai Persistent Volume untuk menyimpan file database.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5">
                <li>Buat akun Railway/Render, lalu Deploy dari ZIP/Git repository.</li>
                <li>Build Command: <code className="text-xs bg-muted px-1 rounded">npm install &amp;&amp; npm run build</code></li>
                <li>Start Command: <code className="text-xs bg-muted px-1 rounded">node .next/standalone/server.js</code> (env NODE_ENV=production)</li>
                <li>Tambahkan Volume/Disk yang terpasang di folder proyek agar db/custom.db tidak hilang saat restart.</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="w-5 h-5 text-blue-600" />
                Komputer Sekolah + Cloudflare Tunnel
              </CardTitle>
              <CardDescription>
                Tanpa sewa server: aplikasi berjalan di satu komputer sekolah yang menyala terus, lalu dibuka
                ke internet dengan tunnel gratis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5">
                <li>Pasang Node.js di komputer sekolah, ekstrak ZIP, jalankan sama seperti langkah VPS (npm install → build → PM2).</li>
                <li>Pasang <code className="text-xs bg-muted px-1 rounded">cloudflared</code> dan buat tunnel ke localhost:3000.</li>
                <li>Cloudflare memberi alamat publik (bisa pakai domain sendiri) dengan HTTPS otomatis.</li>
              </ol>
              <p className="text-xs text-muted-foreground">
                Cocok bila komputer sekolah menyala setiap hari sekolah. Data tetap fisik di sekolah.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB GO-LIVE ============ */}
        <TabsContent value="golive" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Checklist Sebelum Dipakai Resmi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {[
                  ['Ganti kata sandi admin', 'Menu Manajemen Akun — jangan pernah pakai admin123 di server asli. WAJIB.'],
                  ['Lengkapi Pengaturan sekolah', 'NPSN, alamat, telepon, email, nama kepala sekolah, unggah logo.'],
                  ['Isi data master asli', 'Kelas, siswa (+foto), guru, mata pelajaran, jenis pelanggaran.'],
                  ['Uji alur lengkap', 'Login → Scan QR absensi → cek Rekap Bulanan & Rekap Nilai.'],
                  ['Pastikan HTTPS aktif', 'Alamat browser berawalan https:// dengan ikon gembok.'],
                  ['Backup pertama', 'Menu Backup Database → unduh JSON, simpan di luar server (Google Drive/flashdisk).'],
                ].map(([judul, ket]) => (
                  <li key={judul} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <span className="font-medium">{judul}</span>
                      <span className="text-muted-foreground"> — {ket}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Perawatan Rutin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>• <span className="font-medium text-foreground">Backup JSON seminggu sekali</span> (atau copy file db/custom.db) dan simpan di luar server.</li>
                <li>• <span className="font-medium text-foreground">Perbarui server bulanan:</span> <code className="text-xs bg-muted px-1 rounded">sudo apt update &amp;&amp; sudo apt upgrade -y</code></li>
                <li>• Cek kondisi aplikasi: <code className="text-xs bg-muted px-1 rounded">pm2 list</code> (status online) &amp; <code className="text-xs bg-muted px-1 rounded">pm2 logs sistabsen</code></li>
                <li>• Reboot server: aplikasi menyala otomatis berkat PM2 (<code className="text-xs bg-muted px-1 rounded">pm2 save</code> sudah dijalankan).</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Masalah Umum &amp; Solusinya
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  ['Halaman 502 Bad Gateway',
                    'Aplikasi mati. SSH ke server, cek pm2 list → pm2 logs sistabsen → pm2 restart sistabsen.'],
                  ['Port 3000 sudah dipakai',
                    'Jalankan dengan PORT=3001 node .next/standalone/server.js, lalu sesuaikan proxy_pass di Nginx.'],
                  ['npm run build gagal di Windows',
                    'Script build memakai cp (Linux). Gunakan WSL/Git Bash, atau build langsung di server VPS.'],
                  ['Data/foto hilang setelah update',
                    'Folder db atau public tertimpa saat ekstrak ZIP. Pulihkan dari backup JSON / folder backup db.'],
                  ['Lupa kata sandi admin',
                    'Terakhir resort: jalankan bun scripts/reset-data.ts --ya di server — MENGHAPUS SEMUA DATA dan kembali ke admin/admin123.'],
                ].map(([q, a]) => (
                  <div key={q} className="border rounded-lg p-3">
                    <p className="text-sm font-medium">{q}</p>
                    <p className="text-sm text-muted-foreground mt-1">{a}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Panduan ini ikut terunduh di ZIP</p>
                  <p className="text-xs">
                    Versi lengkap tersimpan sebagai file PANDUAN-DEPLOYMENT.md di dalam ZIP "Download Kode Sumber" —
                    jadi panduan tetap ada di tangan Anda walau aplikasi sedang mati.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
