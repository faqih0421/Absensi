// Helper untuk membaca file gambar dan mengompresnya menjadi data URL (base64)
export async function fileToCompressedDataUrl(file: File, maxSize = 256, quality = 0.85): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Format gambar tidak valid'))
    image.src = dataUrl
  })

  // Hitung ukuran target dengan mempertahankan rasio aspek
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, width, height)

  // Gunakan PNG agar logo dengan background transparan tetap bagus
  const isPng = file.type === 'image/png'
  return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality)
}

// Helper khusus foto profil: otomatis rapi tanpa perlu mengedit foto dulu.
// - Potong otomatis ke bentuk PERSEGI (tanpa distorsi rasio):
//   horizontal ambil tengah, vertikal digeser sedikit ke atas (35%) karena
//   wajah umumnya berada di bagian atas foto, sehingga wajah tidak terpotong.
// - Rotasi EXIF foto HP (potret/landscape) diterapkan otomatis oleh browser.
// - Hasil akhir persegi `size` x `size` (default 512px) — pas di lingkaran avatar.
export async function fileToAvatarDataUrl(file: File, size = 512, quality = 0.85): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Format gambar tidak valid'))
    image.src = dataUrl
  })

  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return dataUrl

  // Crop persegi otomatis: sisi = dimensi terkecil
  const side = Math.min(w, h)
  const sx = (w - side) / 2
  const sy = (h - side) * 0.35

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)

  // PNG dipertahankan PNG (transparan), selain itu JPEG agar ringan
  const isPng = file.type === 'image/png'
  return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality)
}
