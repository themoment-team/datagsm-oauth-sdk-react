import { describe, expect, it } from 'vitest';
import { generateCodeChallenge, generateCodeVerifier } from './utils';

describe('PKCE', () => {
  it('RFC 7636 부록 B 예시와 같은 S256 code_challenge를 만든다', async () => {
    const challenge = await generateCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');

    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('code_verifier는 base64url 43자다', () => {
    const verifier = generateCodeVerifier();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
