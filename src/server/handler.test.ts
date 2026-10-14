// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCodeChallenge } from '../crypto';
import { COOKIE_CHUNK_SIZE } from './cookies';
import { createAuthHandler } from './handler';
import {
  APP_ORIGIN,
  CONFIG,
  TOKEN_RESPONSE,
  TOKEN_URL,
  USER,
  USERINFO_URL,
  mockFetch,
  toCookieHeader,
} from './test-fixtures';
import type { DataGsmAuthConfig, DataGsmUser } from './types';

function mockDataGsm(user: DataGsmUser = USER) {
  return mockFetch((url) => {
    if (url === TOKEN_URL) return Response.json(TOKEN_RESPONSE);
    if (url === USERINFO_URL) return Response.json(user);
    throw new Error(`unexpected request: ${url}`);
  });
}

function get(path: string, cookie = ''): Request {
  return new Request(`${APP_ORIGIN}${path}`, { headers: cookie ? { cookie } : {} });
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

async function startLogin(config: DataGsmAuthConfig = CONFIG, returnTo = '/dashboard') {
  const handler = createAuthHandler(config);
  const response = await handler(get(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`));
  const authorizeUrl = new URL(response.headers.get('location')!);
  return {
    handler,
    response,
    authorizeUrl,
    state: authorizeUrl.searchParams.get('state')!,
    cookie: toCookieHeader(setCookies(response)),
  };
}

async function completeLogin(user: DataGsmUser = USER, returnTo = '/dashboard') {
  const fetchMock = mockDataGsm(user);
  const { handler, state, cookie } = await startLogin(CONFIG, returnTo);
  const response = await handler(get(`/api/auth/callback?code=auth-code&state=${state}`, cookie));
  return { handler, response, fetchMock, cookie: toCookieHeader(setCookies(response), cookie) };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /login', () => {
  it('state와 PKCE challenge를 담아 DataGSM authorize로 보낸다', async () => {
    const { response, authorizeUrl } = await startLogin();

    expect(response.status).toBe(302);
    expect(`${authorizeUrl.origin}${authorizeUrl.pathname}`).toBe(
      'https://oauth.authorization.datagsm.kr/v1/oauth/authorize',
    );
    const params = authorizeUrl.searchParams;
    expect(params.get('client_id')).toBe('client-id');
    expect(params.get('redirect_uri')).toBe(`${APP_ORIGIN}/api/auth/callback`);
    expect(params.get('response_type')).toBe('code');
    expect(params.get('state')).toMatch(/^[\w-]{43}$/);
    expect(params.get('code_challenge')).toMatch(/^[\w-]{43}$/);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.has('scope')).toBe(false);
  });

  it('로그인 요청 정보를 10분짜리 HttpOnly·Lax·Secure 쿠키에 담는다', async () => {
    const { response } = await startLogin();

    const [cookie] = setCookies(response);
    expect(cookie).toMatch(/^datagsm_oauth_authorize=[\w-]+\.[\w-]*\.[\w-]+\.[\w-]+\.[\w-]+;/);
    expect(cookie).toContain('Max-Age=600');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Path=/');
  });

  it('http 주소로 설정하면 Secure를 붙이지 않는다', async () => {
    const { response } = await startLogin({
      ...CONFIG,
      redirectUri: 'http://localhost:3000/api/auth/callback',
    });

    expect(setCookies(response)[0]).not.toContain('Secure');
  });

  it('설정한 scope를 공백으로 이어 보낸다', async () => {
    const { authorizeUrl } = await startLogin({ ...CONFIG, scope: ['datagsm:self_read'] });

    expect(authorizeUrl.searchParams.get('scope')).toBe('datagsm:self_read');
  });
});

describe('GET /callback', () => {
  it('토큰을 교환하고 사용자 정보로 세션을 만든 뒤 returnTo로 보낸다', async () => {
    const { response, fetchMock } = await completeLogin();

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/dashboard`);

    const cookies = setCookies(response);
    expect(
      cookies.some((c) => c.startsWith('datagsm_oauth_authorize=;') && c.includes('Max-Age=0')),
    ).toBe(true);
    const session = cookies.find((c) => c.startsWith('datagsm_oauth_session='));
    expect(session).toContain(`Max-Age=${60 * 60 * 24 * 7}`);
    expect(session).toContain('HttpOnly');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('토큰 요청은 snake_case JSON이고 scope를 보내지 않으며 login 때의 verifier를 쓴다', async () => {
    const fetchMock = mockDataGsm();
    const { handler, state, cookie, authorizeUrl } = await startLogin();

    await handler(get(`/api/auth/callback?code=auth-code&state=${state}`, cookie));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(TOKEN_URL);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');

    const body = JSON.parse(init?.body as string) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(
      ['client_id', 'client_secret', 'code', 'code_verifier', 'grant_type', 'redirect_uri'].sort(),
    );
    expect(body).toMatchObject({
      grant_type: 'authorization_code',
      client_id: 'client-id',
      client_secret: 'client-secret',
      code: 'auth-code',
      redirect_uri: `${APP_ORIGIN}/api/auth/callback`,
    });
    expect(await generateCodeChallenge(body.code_verifier)).toBe(
      authorizeUrl.searchParams.get('code_challenge'),
    );
  });

  it('clientSecret이 없으면 client_secret을 보내지 않는다', async () => {
    const fetchMock = mockDataGsm();
    const { handler, state, cookie } = await startLogin({ ...CONFIG, clientSecret: undefined });

    await handler(get(`/api/auth/callback?code=auth-code&state=${state}`, cookie));

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as object;
    expect(body).not.toHaveProperty('client_secret');
  });

  it('사용자 정보는 액세스 토큰을 Bearer로 실어 조회한다', async () => {
    const { fetchMock } = await completeLogin();

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(USERINFO_URL);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer access-token');
  });

  it('state가 다르면 토큰을 교환하지 않고 실패한다', async () => {
    const fetchMock = mockDataGsm();
    const { handler, cookie } = await startLogin();

    const response = await handler(get('/api/auth/callback?code=auth-code&state=forged', cookie));

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/?error=invalid_state`);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setCookies(response).some((c) => c.startsWith('datagsm_oauth_session='))).toBe(false);
  });

  it('state가 없거나 로그인 요청 쿠키가 없으면 토큰을 교환하지 않고 실패한다', async () => {
    const fetchMock = mockDataGsm();
    const { handler, state, cookie } = await startLogin();

    const noState = await handler(get('/api/auth/callback?code=auth-code', cookie));
    const noCookie = await handler(get(`/api/auth/callback?code=auth-code&state=${state}`));

    expect(noState.headers.get('location')).toBe(`${APP_ORIGIN}/?error=invalid_state`);
    expect(noCookie.headers.get('location')).toBe(`${APP_ORIGIN}/?error=invalid_state`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('로그인 요청 쿠키가 만료되면(10분) 토큰을 교환하지 않고 실패한다', async () => {
    const fetchMock = mockDataGsm();
    const { handler, state, cookie } = await startLogin();

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    try {
      const response = await handler(
        get(`/api/auth/callback?code=auth-code&state=${state}`, cookie),
      );
      expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/?error=invalid_state`);
    } finally {
      vi.useRealTimers();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('로그인 요청 쿠키는 한 번 쓰면 지운다', async () => {
    const { response } = await completeLogin();

    expect(toCookieHeader(setCookies(response))).not.toContain('datagsm_oauth_authorize');
  });

  it('사용자가 동의를 거부하면 서버가 준 error로 실패한다', async () => {
    const fetchMock = mockDataGsm();
    const { handler, state, cookie } = await startLogin();

    const response = await handler(
      get(`/api/auth/callback?error=access_denied&state=${state}`, cookie),
    );

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/?error=access_denied`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('code가 없으면 missing_code로 실패한다', async () => {
    mockDataGsm();
    const { handler, state, cookie } = await startLogin();

    const response = await handler(get(`/api/auth/callback?state=${state}`, cookie));

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/?error=missing_code`);
  });

  it('토큰 교환이 실패하면 서버의 OAuth 오류 코드로 실패하고 세션을 만들지 않는다', async () => {
    mockFetch(() =>
      Response.json(
        { error: 'invalid_grant', error_description: '만료된 코드입니다.' },
        { status: 400 },
      ),
    );
    const { handler, state, cookie } = await startLogin();

    const response = await handler(get(`/api/auth/callback?code=old&state=${state}`, cookie));

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/?error=invalid_grant`);
    expect(setCookies(response).some((c) => c.startsWith('datagsm_oauth_session='))).toBe(false);
  });

  it('네트워크 오류는 server_error로 실패한다', async () => {
    mockFetch(() => {
      throw new TypeError('fetch failed');
    });
    const { handler, state, cookie } = await startLogin();

    const response = await handler(get(`/api/auth/callback?code=c&state=${state}`, cookie));

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/?error=server_error`);
  });

  it('errorPath를 설정하면 그 경로로 실패를 알린다', async () => {
    mockDataGsm();
    const { handler, cookie } = await startLogin({ ...CONFIG, errorPath: '/login?from=oauth' });

    const response = await handler(get('/api/auth/callback?code=c&state=forged', cookie));

    expect(response.headers.get('location')).toBe(
      `${APP_ORIGIN}/login?from=oauth&error=invalid_state`,
    );
  });

  it.each([
    'https://evil.example.com/x',
    '//evil.example.com',
    '/\\evil.example.com',
    '/\t/evil.example.com',
  ])('returnTo가 외부 주소(%j)면 /로 보낸다', async (returnTo) => {
    const { response } = await completeLogin(USER, returnTo);

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/`);
  });
});

describe('GET /session', () => {
  it('세션 쿠키가 있으면 사용자를 돌려준다', async () => {
    const { handler, cookie } = await completeLogin();

    const response = await handler(get('/api/auth/session', cookie));

    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ user: USER });
  });

  it('세션 쿠키가 없으면 user가 null이다', async () => {
    const handler = createAuthHandler(CONFIG);

    const response = await handler(get('/api/auth/session'));

    expect(await response.json()).toEqual({ user: null });
  });

  it('변조된 세션 쿠키는 로그인 안 된 상태로 처리하고 지운다', async () => {
    const { handler, cookie } = await completeLogin();
    // JWE의 네 번째 조각(암호문) 가운데 글자 하나를 바꾼다.
    const tampered = cookie.replace(/datagsm_oauth_session=([^;]*)/, (_, value: string) => {
      const parts = value.split('.');
      const i = Math.floor(parts[3].length / 2);
      parts[3] = `${parts[3].slice(0, i)}${parts[3][i] === 'A' ? 'B' : 'A'}${parts[3].slice(i + 1)}`;
      return `datagsm_oauth_session=${parts.join('.')}`;
    });
    expect(tampered).not.toBe(cookie);

    const response = await handler(get('/api/auth/session', tampered));

    expect(await response.json()).toEqual({ user: null });
    expect(setCookies(response)).toEqual([
      expect.stringMatching(/^datagsm_oauth_session=;.*Max-Age=0/),
    ]);
  });

  it('다른 sessionSecret으로 만든 쿠키는 열지 않는다', async () => {
    const { cookie } = await completeLogin();
    const other = createAuthHandler({
      ...CONFIG,
      sessionSecret: 'another-session-secret-0123456789',
    });

    const response = await other(get('/api/auth/session', cookie));

    expect(await response.json()).toEqual({ user: null });
  });

  it('로그인 요청 쿠키를 세션 쿠키 자리에 넣어도 열리지 않는다', async () => {
    const { handler, response } = await startLogin();
    const authorizeValue = setCookies(response)[0].split(';')[0].split('=')[1];

    const session = await handler(
      get('/api/auth/session', `datagsm_oauth_session=${authorizeValue}`),
    );

    expect(await session.json()).toEqual({ user: null });
  });

  it('4KB를 넘는 세션은 여러 쿠키로 나눠 담고 다시 이어 읽는다', async () => {
    const bigUser: DataGsmUser = {
      ...USER,
      projects: Array.from({ length: 80 }, (_, i) => ({
        id: i,
        name: `프로젝트 ${i} - ${'설명'.repeat(10)}`,
        status: 'ACTIVE',
        club: { id: i, name: `동아리 ${i}`, type: 'MAJOR_CLUB' },
      })),
    };
    const { handler, response, cookie } = await completeLogin(bigUser);

    const chunks = setCookies(response).filter((c) => c.startsWith('datagsm_oauth_session.'));
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.split(';')[0].length).toBeLessThanOrEqual(COOKIE_CHUNK_SIZE + 30);
    }

    const session = await handler(get('/api/auth/session', cookie));
    expect(await session.json()).toEqual({ user: bigUser });
  });

  it('나눠 담았던 세션을 작은 세션으로 바꾸면 남은 조각을 지운다', async () => {
    const bigUser: DataGsmUser = {
      ...USER,
      clubs: Array.from({ length: 300 }, (_, i) => ({
        id: i,
        name: `동아리 ${i}`,
        type: 'MAJOR_CLUB',
      })),
    };
    const first = await completeLogin(bigUser);

    mockDataGsm(USER);
    const { response: login } = await startLogin();
    const state = new URL(login.headers.get('location')!).searchParams.get('state')!;
    const cookie = toCookieHeader(setCookies(login), first.cookie);
    const response = await first.handler(get(`/api/auth/callback?code=c&state=${state}`, cookie));

    const next = toCookieHeader(setCookies(response), cookie);
    expect(next).not.toMatch(/datagsm_oauth_session\.\d+=/);
    expect(await (await first.handler(get('/api/auth/session', next))).json()).toEqual({
      user: USER,
    });
  });
});

describe('POST /logout', () => {
  function post(path: string, cookie: string, origin: string | null) {
    const headers: Record<string, string> = { cookie };
    if (origin) headers.origin = origin;
    return new Request(`${APP_ORIGIN}${path}`, { method: 'POST', headers });
  }

  it('같은 출처의 요청이면 세션 쿠키를 지운다', async () => {
    const { handler, cookie } = await completeLogin();

    const response = await handler(post('/api/auth/logout', cookie, APP_ORIGIN));

    expect(response.status).toBe(204);
    expect(toCookieHeader(setCookies(response), cookie)).not.toContain('datagsm_oauth_session');
  });

  it('Origin이 다르거나 없으면 403이고 쿠키를 건드리지 않는다', async () => {
    const { handler, cookie } = await completeLogin();

    const crossSite = await handler(post('/api/auth/logout', cookie, 'https://evil.example.com'));
    const noOrigin = await handler(post('/api/auth/logout', cookie, null));

    expect(crossSite.status).toBe(403);
    expect(noOrigin.status).toBe(403);
    expect(setCookies(crossSite)).toEqual([]);
  });

  it('GET으로는 로그아웃할 수 없다', async () => {
    const handler = createAuthHandler(CONFIG);

    const response = await handler(get('/api/auth/logout'));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});

describe('routing and config', () => {
  it('모르는 경로는 404다', async () => {
    const handler = createAuthHandler(CONFIG);

    expect((await handler(get('/api/auth/unknown'))).status).toBe(404);
    expect((await handler(get('/api/auth/toString'))).status).toBe(404);
    expect((await handler(get('/elsewhere/login'))).status).toBe(404);
  });

  it('basePath를 바꿀 수 있다', async () => {
    const handler = createAuthHandler({
      ...CONFIG,
      basePath: '/auth/datagsm/',
      redirectUri: `${APP_ORIGIN}/auth/datagsm/callback`,
    });

    expect((await handler(get('/auth/datagsm/session'))).status).toBe(200);
  });

  it('설정 오류는 모듈을 불러올 때가 아니라 첫 요청 때 알린다', async () => {
    const handler = createAuthHandler({ ...CONFIG, sessionSecret: 'short' });

    await expect(handler(get('/api/auth/session'))).rejects.toThrow(/at least 32 characters/);
  });

  it('redirectUri 경로가 basePath/callback이 아니면 알려 준다', async () => {
    const handler = createAuthHandler({ ...CONFIG, redirectUri: `${APP_ORIGIN}/oauth/callback` });

    await expect(handler(get('/api/auth/session'))).rejects.toThrow(/\/api\/auth\/callback/);
  });
});

afterEach(() => {
  vi.useRealTimers();
});
