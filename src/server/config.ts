import { DATAGSM_OAUTH_ISSUER } from '../constants';
import { serializeScope } from '../authorize';
import {
  DATAGSM_USERINFO_URL,
  DEFAULT_BASE_PATH,
  DEFAULT_SESSION_MAX_AGE,
  MIN_SESSION_SECRET_LENGTH,
} from './constants';
import type { DataGsmAuthConfig } from './types';

export interface ResolvedAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  sessionSecret: string;
  scope?: readonly string[];
  basePath: string;
  sessionMaxAge: number;
  errorPath: string;
  issuer: string;
  userInfoUrl: string;
  /** redirectUri의 origin입니다. 리다이렉트와 Origin 검사의 기준입니다. */
  appOrigin: string;
  /** https면 쿠키에 Secure를 붙입니다. */
  secure: boolean;
}

export function assertSessionSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `[datagsm-oauth] sessionSecret must be at least ${MIN_SESSION_SECRET_LENGTH} characters.`,
    );
  }
}

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * 같은 출처의 경로만 허용합니다. 외부 주소, `//host`, `/\host`처럼 브라우저가 다른 출처로 해석하는 값은
 * fallback으로 바꿉니다. 탭·개행 같은 문자도 URL 파서가 브라우저와 같게 정규화하므로 origin 비교로 걸러진다.
 */
export function sanitizeRedirectPath(
  value: string | null | undefined,
  appOrigin: string,
  fallback = '/',
): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  try {
    const url = new URL(value, appOrigin);
    if (url.origin !== appOrigin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function resolveAuthConfig(config: DataGsmAuthConfig): ResolvedAuthConfig {
  if (!config.clientId) throw new Error('[datagsm-oauth] clientId is required.');
  assertSessionSecret(config.sessionSecret);

  let redirect: URL;
  try {
    redirect = new URL(config.redirectUri);
  } catch {
    throw new Error('[datagsm-oauth] redirectUri must be an absolute URL.');
  }

  const basePath = normalizeBasePath(config.basePath ?? DEFAULT_BASE_PATH);
  if (redirect.pathname.replace(/\/+$/, '') !== `${basePath}/callback`) {
    throw new Error(
      `[datagsm-oauth] redirectUri path must be "${basePath}/callback" (got "${redirect.pathname}").`,
    );
  }

  // scope에 공백이 섞여 있으면 첫 로그인 요청이 아니라 설정 시점에 알 수 있게 미리 검사한다.
  serializeScope(config.scope);

  const sessionMaxAge = config.sessionMaxAge ?? DEFAULT_SESSION_MAX_AGE;
  if (!Number.isFinite(sessionMaxAge) || sessionMaxAge <= 0) {
    throw new Error('[datagsm-oauth] sessionMaxAge must be a positive number of seconds.');
  }

  const appOrigin = redirect.origin;
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret || undefined,
    redirectUri: config.redirectUri,
    sessionSecret: config.sessionSecret,
    scope: config.scope,
    basePath,
    sessionMaxAge,
    errorPath: sanitizeRedirectPath(config.errorPath, appOrigin),
    issuer: (config.issuer ?? DATAGSM_OAUTH_ISSUER).replace(/\/+$/, ''),
    userInfoUrl: config.userInfoUrl ?? DATAGSM_USERINFO_URL,
    appOrigin,
    secure: redirect.protocol === 'https:',
  };
}
