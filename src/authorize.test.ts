import { describe, expect, it } from 'vitest';
import { buildAuthorizationUrl } from './authorize';

const BASE_URL = 'https://oauth.authorization.datagsm.kr/v1/oauth/authorize';

describe('buildAuthorizationUrl', () => {
  it('서버가 요구하는 client_id, redirect_uri, response_type과 state를 넣는다', () => {
    const url = new URL(
      buildAuthorizationUrl(BASE_URL, {
        clientId: 'client',
        redirectUri: 'https://app.example.com/callback',
        state: 'state-value',
      }),
    );

    expect(url.origin + url.pathname).toBe(BASE_URL);
    expect(url.searchParams.get('client_id')).toBe('client');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.searchParams.has('code_challenge_method')).toBe(false);
  });

  it('code_challenge가 있으면 S256 메서드와 함께 넣는다', () => {
    const url = new URL(
      buildAuthorizationUrl(BASE_URL, {
        clientId: 'client',
        redirectUri: 'https://app.example.com/callback',
        state: 's',
        codeChallenge: 'challenge',
      }),
    );

    expect(url.searchParams.get('code_challenge')).toBe('challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('특수문자가 든 state도 인코딩해 그대로 돌려받을 수 있다', () => {
    const state = 'a&b=c d+e';
    const url = new URL(
      buildAuthorizationUrl(BASE_URL, { clientId: 'c', redirectUri: 'https://a/cb', state }),
    );

    expect(url.searchParams.get('state')).toBe(state);
  });

  it('기본 URL에 이미 쿼리가 있어도 깨지지 않는다', () => {
    const url = new URL(
      buildAuthorizationUrl(`${BASE_URL}?foo=bar`, {
        clientId: 'c',
        redirectUri: 'https://a/cb',
        state: 's',
      }),
    );

    expect(url.searchParams.get('foo')).toBe('bar');
    expect(url.searchParams.get('client_id')).toBe('c');
  });
});
