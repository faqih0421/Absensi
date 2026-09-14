import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tanggal hari ini dalam zona WIB (Asia/Jakarta), format 'YYYY-MM-DD'.
// JANGAN pakai new Date().toISOString() — itu tanggal UTC, salah untuk
// pengguna WIB sebelum jam 07:00 pagi.
export function tanggalWIB(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
