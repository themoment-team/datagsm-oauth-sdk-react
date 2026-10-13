import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateRandomString,
  generateState,
  timingSafeEqual,
} from './crypto';

const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;

describe('crypto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('RFC 7636 부록 B 예시와 같은 S256 code_challenge를 만든다', async () => {
    const challenge = await generateCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');

    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('code_verifier와 state는 32바이트 난수를 base64url 43자로 인코딩한다', () => {
    expect(generateCodeVerifier()).toMatch(BASE64URL_43);
    expect(generateState()).toMatch(BASE64URL_43);
  });

  it('호출할 때마다 다른 값을 만든다', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateState()));

    expect(values.size).toBe(50);
  });

  it('crypto.getRandomValues로 난수를 만든다', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');

    generateRandomString(16);

    expect(spy).toHaveBeenCalledOnce();
    expect((spy.mock.calls[0][0] as Uint8Array).length).toBe(16);
  });

  it('Web Crypto가 없으면 에러를 던진다', async () => {
    vi.stubGlobal('crypto', undefined);

    expect(() => generateState()).toThrow('Web Crypto API is not available');
    await expect(generateCodeChallenge('v')).rejects.toThrow('Web Crypto API is not available');
  });

  it('timingSafeEqual은 같은 문자열만 true로 판단한다', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});
