/**
 * Security helper for generating and verifying cryptographically signed session tokens.
 * Uses standard Web Crypto API (supported in Node.js and Next.js Edge Middleware).
 */

const getSecret = () => process.env.DASHBOARD_PASSWORD || 'admin123';

/**
 * Timing-safe string comparison using Web Crypto SHA-256 pre-hashing.
 * Prevents timing side-channel attacks on password and token verification.
 */
export async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const hashA = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(a)));
  const hashB = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(b)));

  if (hashA.length !== hashB.length) return false;

  let mismatch = 0;
  for (let i = 0; i < hashA.length; i++) {
    mismatch |= hashA[i] ^ hashB[i];
  }
  return mismatch === 0;
}

export async function createSessionToken(expiresAt: number): Promise<string> {
  const secret = getSecret();
  const data = `dash_session:${expiresAt}:${secret}`;
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${expiresAt}.${hashHex}`;
}

export async function verifySessionToken(tokenValue: string | undefined | null): Promise<boolean> {
  if (!tokenValue) return false;
  const parts = tokenValue.split('.');
  if (parts.length !== 2) return false;

  const [expiresAtStr, hashHex] = parts;
  const expiresAt = Number(expiresAtStr);

  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedToken = await createSessionToken(expiresAt);
  const expectedHash = expectedToken.split('.')[1];

  return timingSafeCompare(hashHex, expectedHash);
}
