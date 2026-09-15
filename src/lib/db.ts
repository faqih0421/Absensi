import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

// Batasi pool max = 1 agar tidak boros koneksi di Vercel serverless
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,                    // ← max 1 koneksi per instance
  idleTimeoutMillis: 10000,  // tutup koneksi idle setelah 10 detik
  connectionTimeoutMillis: 10000,
})

const adapter = new PrismaPg(pool)

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db