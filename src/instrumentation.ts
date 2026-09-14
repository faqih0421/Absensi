// Terapkan timezone WIB (Asia/Jakarta) untuk seluruh proses server
// agar logika tanggal & jam absensi (setHours, batas terlambat, dsb.)
// mengikuti waktu Indonesia Barat, bukan timezone mesin server.
export async function register() {
  process.env.TZ = 'Asia/Jakarta'
}
