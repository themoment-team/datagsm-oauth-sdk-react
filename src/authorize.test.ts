import { describe, expect, it } from 'vitest';
import { buildAuthorizationUrl, includesOpenIdScope, serializeScope } from './authorize';

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

describe('serializeScope', () => {
  it('서버 형식에 맞춰 공백 하나로 이어 붙인다', () => {
    expect(serializeScope(['app:account_read', 'app:club_read', 'openid'])).toBe(
      'app:account_read app:club_read openid',
    );
  });

  it('앞뒤 공백, 빈 값, 중복을 걸러낸다', () => {
    expect(serializeScope([' app:account_read ', '', 'app:account_read', '  '])).toBe(
      'app:account_read',
    );
  });

  it('지정하지 않거나 남는 값이 없으면 undefined를 돌려준다', () => {
    expect(serializeScope(undefined)).toBeUndefined();
    expect(serializeScope([])).toBeUndefined();
    expect(serializeScope(['', ' '])).toBeUndefined();
  });

  it('값 안에 공백이 있으면 에러를 던진다', () => {
    expect(() => serializeScope(['app:account_read app:club_read'])).toThrow(
      'must not contain whitespace',
    );
  });
});

describe('buildAuthorizationUrl scope', () => {
  it('scope를 공백 구분 문자열 하나로 보낸다', () => {
    const url = new URL(
      buildAuthorizationUrl(BASE_URL, {
        clientId: 'c',
        redirectUri: 'https://a/cb',
        state: 's',
        scope: ['app:account_read', 'app:student_read'],
      }),
    );

    expect(url.searchParams.getAll('scope')).toEqual(['app:account_read app:student_read']);
  });

  it('scope가 없으면 파라미터를 보내지 않아 서버 기본값을 쓴다', () => {
    const url = new URL(
      buildAuthorizationUrl(BASE_URL, {
        clientId: 'c',
        redirectUri: 'https://a/cb',
        state: 's',
        scope: [],
      }),
    );

    expect(url.searchParams.has('scope')).toBe(false);
  });
});

describe('nonce', () => {
  it('nonce가 있으면 authorize 요청에 싣는다', () => {
    const url = new URL(
      buildAuthorizationUrl(BASE_URL, {
        clientId: 'c',
        redirectUri: 'https://a/cb',
        state: 's',
        scope: ['openid'],
        nonce: 'nonce-value',
      }),
    );

    expect(url.searchParams.get('nonce')).toBe('nonce-value');
  });

  it('includesOpenIdScope는 openid scope가 있는지 판단한다', () => {
    expect(includesOpenIdScope(['app:account_read', ' openid '])).toBe(true);
    expect(includesOpenIdScope(['app:openid'])).toBe(false);
    expect(includesOpenIdScope(undefined)).toBe(false);
  });
});
