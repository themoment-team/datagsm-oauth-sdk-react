const CRYPTO_ERROR =
  'Web Crypto API is not available. Please ensure you are in a secure context (HTTPS) and using a supported browser.';

const RANDOM_BYTE_LENGTH = 32;

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateRandomString(byteLength: number = RANDOM_BYTE_LENGTH): string {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) throw new Error(CRYPTO_ERROR);
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function generateCodeVerifier(): string {
  return generateRandomString();
}

export function generateState(): string {
  return generateRandomString();
}

export function generateNonce(): string {
  return generateRandomString();
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle?.digest) throw new Error(CRYPTO_ERROR);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(hash));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
