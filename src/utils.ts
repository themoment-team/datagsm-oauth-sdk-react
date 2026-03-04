import type { OAuthConfig } from './types';

function base64UrlEncode(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const CRYPTO_ERROR =
  'Web Crypto API is not available. Please ensure you are in a secure context (HTTPS) and using a supported browser.';

export function generateCodeVerifier(): string {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) throw new Error(CRYPTO_ERROR);
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle?.digest) throw new Error(CRYPTO_ERROR);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(hash));
}

export function buildOAuthUrl(
  baseUrl: string,
  config: OAuthConfig & { codeChallenge?: string },
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
  });

  if (config.codeChallenge) {
    params.append('code_challenge', config.codeChallenge);
    params.append('code_challenge_method', 'S256');
  }

  return `${baseUrl}?${params.toString()}`;
}

export function navigateToUrl(url: string): void {
  window.location.href = url;
}
