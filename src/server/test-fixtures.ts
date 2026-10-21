import { vi } from 'vitest';
import type { DataGsmAuthConfig, DataGsmUser } from './types';

/** 전역 fetch를 목으로 바꿉니다. respond가 던지면 fetch도 그 오류로 실패합니다. */
export function mockFetch(respond: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      return Promise.resolve(respond(url, init));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const APP_ORIGIN = 'https://app.example.com';
export const ISSUER = 'https://oauth.authorization.datagsm.kr';
export const TOKEN_URL = `${ISSUER}/v1/oauth/token`;
export const USERINFO_URL = 'https://oauth.resource.datagsm.kr/userinfo';
export const SESSION_SECRET = 'test-session-secret-0123456789abcdef';

export const CONFIG: DataGsmAuthConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: `${APP_ORIGIN}/api/auth/callback`,
  sessionSecret: SESSION_SECRET,
};

export const USER: DataGsmUser = {
  id: 1,
  email: 's25000@gsm.hs.kr',
  role: 'USER',
  status: 'ACTIVE',
  objectType: 'STUDENT',
  isStudent: true,
  student: {
    id: 10,
    name: '홍길동',
    sex: 'MAN',
    email: 's25000@gsm.hs.kr',
    grade: 1,
    classNum: 2,
    number: 3,
    studentNumber: 1203,
    major: 'SW_DEVELOPMENT',
    specialty: null,
    role: 'GENERAL_STUDENT',
    dormitoryFloor: null,
    dormitoryRoom: null,
    majorClub: null,
    autonomousClub: null,
    githubId: null,
    githubUrl: null,
  },
  teacher: null,
};

export const TOKEN_RESPONSE = {
  access_token: 'access-token',
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: 'refresh-token',
  scope: 'datagsm:self_read',
};

/** Set-Cookie 목록을 다음 요청의 Cookie 헤더로 바꿉니다. 지우는(Max-Age=0) 쿠키는 뺍니다. */
export function toCookieHeader(setCookies: string[], previous = ''): string {
  const jar = new Map<string, string>();
  for (const part of previous.split(';')) {
    const index = part.indexOf('=');
    if (index > 0) jar.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  for (const cookie of setCookies) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    const name = pair.slice(0, index);
    if (/Max-Age=0(;|$)/.test(cookie)) jar.delete(name);
    else jar.set(name, pair.slice(index + 1));
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}
