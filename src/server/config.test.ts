// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveAuthConfig, sanitizeRedirectPath } from './config';
import { APP_ORIGIN, CONFIG } from './test-fixtures';

describe('sanitizeRedirectPath', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/a/b?tab=1#top', '/a/b?tab=1#top'],
    ['/../etc', '/etc'],
  ])('같은 출처 경로 %j는 %j로 둔다', (value, expected) => {
    expect(sanitizeRedirectPath(value, APP_ORIGIN)).toBe(expected);
  });

  it.each([
    null,
    '',
    'dashboard',
    'https://evil.example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    '/\t/evil.example.com',
    '/\n/evil.example.com',
    'javascript:alert(1)',
  ])('외부로 갈 수 있는 값 %j는 fallback으로 바꾼다', (value) => {
    expect(sanitizeRedirectPath(value, APP_ORIGIN)).toBe('/');
  });
});

describe('resolveAuthConfig', () => {
  it('기본값을 채운다', () => {
    expect(resolveAuthConfig(CONFIG)).toMatchObject({
      basePath: '/api/auth',
      sessionMaxAge: 604800,
      errorPath: '/',
      issuer: 'https://oauth.authorization.datagsm.kr',
      userInfoUrl: 'https://oauth.resource.datagsm.kr/userinfo',
      appOrigin: APP_ORIGIN,
      secure: true,
    });
  });

  it('필수 값이 빠지거나 잘못되면 알려 준다', () => {
    expect(() => resolveAuthConfig({ ...CONFIG, clientId: '' })).toThrow(/clientId/);
    expect(() => resolveAuthConfig({ ...CONFIG, sessionSecret: 'x'.repeat(31) })).toThrow(/32/);
    expect(() => resolveAuthConfig({ ...CONFIG, redirectUri: '/api/auth/callback' })).toThrow(
      /absolute URL/,
    );
    expect(() => resolveAuthConfig({ ...CONFIG, scope: ['a b'] })).toThrow(/whitespace/);
    expect(() => resolveAuthConfig({ ...CONFIG, sessionMaxAge: 0 })).toThrow(/sessionMaxAge/);
  });

  it('errorPath도 같은 출처 경로만 받는다', () => {
    expect(resolveAuthConfig({ ...CONFIG, errorPath: 'https://evil.example.com' }).errorPath).toBe(
      '/',
    );
  });
});
