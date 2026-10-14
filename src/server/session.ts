import type { JWTPayload } from 'jose';
import { assertSessionSecret } from './config';
import { SESSION_COOKIE } from './constants';
import { readChunkedCookie, toCookieMap, type CookieSource } from './cookies';
import { seal, unseal } from './seal';
import type { DataGsmUser } from './types';

interface SessionPayload extends JWTPayload {
  user: DataGsmUser;
}

export function sealSession(user: DataGsmUser, secret: string, maxAge: number): Promise<string> {
  return seal({ user }, secret, 'session', maxAge);
}

export async function unsealSession(token: string, secret: string): Promise<DataGsmUser | null> {
  const payload = await unseal<SessionPayload>(token, secret, 'session');
  return payload?.user ?? null;
}

export function readSessionFromCookies(
  cookies: Map<string, string>,
  secret: string,
): Promise<DataGsmUser | null> {
  const token = readChunkedCookie(cookies, SESSION_COOKIE);
  return token ? unsealSession(token, secret) : Promise.resolve(null);
}

/**
 * 요청의 쿠키에서 로그인한 사용자를 읽습니다. 쿠키가 없거나 변조됐거나 만료됐으면 null입니다.
 * 세션에는 로그인 시점의 사용자 정보가 담겨 있으므로 DataGSM에 요청을 보내지 않습니다.
 */
export function readSession(
  cookies: CookieSource,
  config: { sessionSecret: string },
): Promise<DataGsmUser | null> {
  assertSessionSecret(config.sessionSecret);
  return readSessionFromCookies(toCookieMap(cookies), config.sessionSecret);
}
