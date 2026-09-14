// Helper autentikasi token sesi (HMAC-SHA256) — kompatibel Edge & Node runtime.
// Format token: "<akunId>.<timestamp>.<hmac_hex>"
// Token ditandatangani server (tidak bisa dipalsukan client) dan berlaku 30 hari.

const SECRET =
  process.env.SISTABSEN_SECRET || 'sistabsen-rahasia-2026-mts-al-mukhtariyah'
const TOKEN_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 hari

async function hmacHex(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function signToken(userId: string): Promise<string> {
  const ts = Date.now().toString()
  const sig = await hmacHex(`${userId}.${ts}`)
  return `${userId}.${ts}.${sig}`
}

export async function verifyToken(
  token: string | null | undefined
): Promise<{ id: string } | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [id, ts, sig] = parts
  if (!id || !/^\d+$/.test(ts) || !sig) return null
  const expected = await hmacHex(`${id}.${ts}`)
  if (sig.length !== expected.length || sig !== expected) return null
  const age = Date.now() - Number(ts)
  if (age > TOKEN_AGE_MS || age < -60_000) return null
  return { id }
}
