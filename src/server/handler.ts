import type { JWTPayload } from 'jose';
import { buildAuthorizationUrl, resolveAuthorizationUrl } from '../authorize';
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  timingSafeEqual,
} from '../crypto';
import { exchangeAuthorizationCode, fetchUserInfo } from './api';
import { resolveAuthConfig, sanitizeRedirectPath, type ResolvedAuthConfig } from './config';
import { AUTHORIZE_COOKIE, AUTHORIZE_REQUEST_MAX_AGE, SESSION_COOKIE } from './constants';
import {
  clearChunkedCookie,
  expireCookie,
  serializeCookie,
  setChunkedCookie,
  toCookieMap,
} from './cookies';
import { DataGsmOAuthError } from './errors';
import { seal, unseal } from './seal';
import { readSessionFromCookies, sealSession } from './session';
import type { DataGsmAuthConfig } from './types';

interface AuthorizeRequestPayload extends JWTPayload {
  state: string;
  codeVerifier: string;
  returnTo: string;
}

type Action = 'login' | 'callback' | 'session' | 'logout';

const ACTION_METHODS = new Map<string, string>([
  ['login', 'GET'],
  ['callback', 'GET'],
  ['session', 'GET'],
  ['logout', 'POST'],
]);

function createHeaders(setCookies: string[] = []): Headers {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  for (const cookie of setCookies) headers.append('Set-Cookie', cookie);
  return headers;
}

function redirect(location: string, setCookies: string[] = []): Response {
  const headers = createHeaders(setCookies);
  headers.set('Location', location);
  return new Response(null, { status: 302, headers });
}

function json(body: unknown, status = 200, setCookies: string[] = []): Response {
  const headers = createHeaders(setCookies);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

// catch-all 라우트의 params는 Next 버전마다 형태가 달라서 요청 경로에서 직접 읽는다.
function matchAction(pathname: string, basePath: string): Action | null {
  const path = pathname.replace(/\/+$/, '');
  if (!path.startsWith(`${basePath}/`)) return null;
  const action = path.slice(basePath.length + 1);
  return ACTION_METHODS.has(action) ? (action as Action) : null;
}

async function login(url: URL, config: ResolvedAuthConfig): Promise<Response> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const returnTo = sanitizeRedirectPath(url.searchParams.get('returnTo'), config.appOrigin);

  const pending = await seal(
    { state, codeVerifier, returnTo },
    config.sessionSecret,
    'authorize',
    AUTHORIZE_REQUEST_MAX_AGE,
  );
  const location = buildAuthorizationUrl(resolveAuthorizationUrl({ issuer: config.issuer }), {
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
    codeChallenge,
    scope: config.scope,
  });

  return redirect(location, [
    serializeCookie(AUTHORIZE_COOKIE, pending, {
      maxAge: AUTHORIZE_REQUEST_MAX_AGE,
      secure: config.secure,
    }),
  ]);
}

async function callback(
  url: URL,
  cookies: Map<string, string>,
  config: ResolvedAuthConfig,
): Promise<Response> {
  // 로그인 요청 쿠키는 결과와 관계없이 한 번 쓰고 지운다.
  const cleanup = cookies.has(AUTHORIZE_COOKIE)
    ? [expireCookie(AUTHORIZE_COOKIE, config.secure)]
    : [];
  const fail = (error: string) => {
    const target = new URL(config.errorPath, config.appOrigin);
    target.searchParams.set('error', error);
    return redirect(target.href, cleanup);
  };

  const sealed = cookies.get(AUTHORIZE_COOKIE);
  const pending = sealed
    ? await unseal<AuthorizeRequestPayload>(sealed, config.sessionSecret, 'authorize')
    : null;
  const state = url.searchParams.get('state');
  if (!pending || typeof pending.state !== 'string' || !state) return fail('invalid_state');
  if (!timingSafeEqual(pending.state, state)) return fail('invalid_state');

  const error = url.searchParams.get('error');
  if (error) return fail(error);

  const code = url.searchParams.get('code');
  if (!code) return fail('missing_code');

  try {
    const token = await exchangeAuthorizationCode({
      issuer: config.issuer,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri: config.redirectUri,
      codeVerifier: pending.codeVerifier,
    });
    const user = await fetchUserInfo(token.accessToken, { userInfoUrl: config.userInfoUrl });
    const session = await sealSession(user, config.sessionSecret, config.sessionMaxAge);
    const returnTo = sanitizeRedirectPath(pending.returnTo, config.appOrigin);

    return redirect(new URL(returnTo, config.appOrigin).href, [
      ...cleanup,
      ...setChunkedCookie(cookies, SESSION_COOKIE, session, {
        maxAge: config.sessionMaxAge,
        secure: config.secure,
      }),
    ]);
  } catch (cause) {
    if (cause instanceof DataGsmOAuthError) {
      console.error(`[datagsm-oauth] login failed: ${cause.message}`);
      return fail(cause.error);
    }
    console.error('[datagsm-oauth] login failed:', cause);
    return fail('server_error');
  }
}

async function session(
  cookies: Map<string, string>,
  config: ResolvedAuthConfig,
): Promise<Response> {
  const user = await readSessionFromCookies(cookies, config.sessionSecret);
  // 쿠키가 있는데 열리지 않으면(만료, 변조, 비밀값 변경) 지워 둔다.
  const cleanup = user ? [] : clearChunkedCookie(cookies, SESSION_COOKIE, config.secure);
  return json({ user }, 200, cleanup);
}

function logout(
  request: Request,
  cookies: Map<string, string>,
  config: ResolvedAuthConfig,
): Response {
  // 다른 사이트가 폼으로 로그아웃시키지 못하게 Origin을 확인한다.
  if (request.headers.get('origin') !== config.appOrigin) {
    return json({ error: 'invalid_origin' }, 403);
  }
  return new Response(null, {
    status: 204,
    headers: createHeaders(clearChunkedCookie(cookies, SESSION_COOKIE, config.secure)),
  });
}

/**
 * `{basePath}/login`, `/callback`, `/session`, `/logout`을 처리하는 웹 표준 핸들러를 만듭니다.
 * 설정 검사는 첫 요청 때 합니다. `next build`처럼 환경 변수가 없는 시점에 불러와도 실패하지 않게 하기 위해서입니다.
 */
export function createAuthHandler(
  config: DataGsmAuthConfig,
): (request: Request) => Promise<Response> {
  let resolved: ResolvedAuthConfig | undefined;

  return async function handleAuthRequest(request: Request): Promise<Response> {
    resolved ??= resolveAuthConfig(config);

    const url = new URL(request.url);
    const action = matchAction(url.pathname, resolved.basePath);
    if (!action) return json({ error: 'not_found' }, 404);

    const method = ACTION_METHODS.get(action)!;
    if (request.method !== method) {
      const response = json({ error: 'method_not_allowed' }, 405);
      response.headers.set('Allow', method);
      return response;
    }

    const cookies = toCookieMap(request.headers.get('cookie'));
    switch (action) {
      case 'login':
        return login(url, resolved);
      case 'callback':
        return callback(url, cookies, resolved);
      case 'session':
        return session(cookies, resolved);
      case 'logout':
        return logout(request, cookies, resolved);
    }
  };
}
