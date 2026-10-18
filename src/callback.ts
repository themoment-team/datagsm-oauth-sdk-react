import { timingSafeEqual } from './crypto';
import { clearAuthorizationRequest, loadAuthorizationRequest } from './storage';

/**
 * 콜백 실패 사유입니다.
 * - `not_callback`: URL에 `code`, `state`, `error`가 모두 없습니다. 콜백이 아닌 일반 방문이며 저장값은 그대로 둡니다.
 * - `already_handled`: 이 URL은 이미 처리했습니다. React StrictMode의 effect 재실행이나 뒤로 가기에서 나오며 무시하면 됩니다.
 * - `invalid_state`: 받은 state가 저장한 값과 다르거나 저장된 값이 없습니다(CSRF 의심).
 * - `missing_code`: 오류도 code도 없는 콜백입니다.
 * - 그 밖의 값은 서버가 보낸 `error` 그대로입니다. 사용자가 동의를 거부하면 `access_denied`입니다.
 */
export type OAuthCallbackErrorCode =
  | 'not_callback'
  | 'already_handled'
  | 'invalid_state'
  | 'missing_code'
  | 'access_denied'
  | (string & {});

export interface OAuthCallbackParams {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
}

export interface OAuthCallbackSuccess {
  ok: true;
  code: string;
  state: string;
  /** PKCE 모드로 로그인했을 때 저장해 둔 code_verifier입니다. STANDARD 모드면 null입니다. */
  codeVerifier: string | null;
  /** openid scope로 로그인했을 때 저장해 둔 nonce입니다. id_token의 nonce 클레임과 비교하세요. */
  nonce: string | null;
}

export interface OAuthCallbackFailure {
  ok: false;
  error: OAuthCallbackErrorCode;
  errorDescription: string | null;
}

export type OAuthCallbackResult = OAuthCallbackSuccess | OAuthCallbackFailure;

// 브라우저 밖(SSR, 테스트)에서 상대 URL을 해석할 때만 쓰는 기준 주소다. 쿼리만 읽으므로 호스트는 의미가 없다.
const FALLBACK_BASE_URL = 'http://localhost';

function currentUrl(): string {
  return window.location.href;
}

function toAbsoluteUrl(url: string): URL {
  const base = typeof window === 'undefined' ? FALLBACK_BASE_URL : window.location.href;
  return new URL(url, base);
}

/**
 * 콜백 URL의 쿼리에서 code, state, error, error_description을 꺼냅니다.
 * `location.search`나 `/callback?code=...` 같은 상대 URL도 받습니다.
 */
export function parseOAuthCallback(url: string = currentUrl()): OAuthCallbackParams {
  const query = toAbsoluteUrl(url).searchParams;
  return {
    code: query.get('code'),
    state: query.get('state'),
    error: query.get('error'),
    errorDescription: query.get('error_description'),
  };
}

function resolveCallback(params: OAuthCallbackParams): OAuthCallbackResult {
  const stored = loadAuthorizationRequest();
  clearAuthorizationRequest();

  if (!stored.state || !params.state || !timingSafeEqual(stored.state, params.state)) {
    return {
      ok: false,
      error: 'invalid_state',
      errorDescription: 'The state parameter does not match the stored value.',
    };
  }

  if (params.error) {
    return { ok: false, error: params.error, errorDescription: params.errorDescription };
  }

  if (!params.code) {
    return {
      ok: false,
      error: 'missing_code',
      errorDescription: 'The callback URL does not contain an authorization code.',
    };
  }

  return {
    ok: true,
    code: params.code,
    state: params.state,
    codeVerifier: stored.codeVerifier,
    nonce: stored.nonce,
  };
}

function isCallback(params: OAuthCallbackParams): boolean {
  return params.code !== null || params.state !== null || params.error !== null;
}

// 콜백은 한 번만 소비한다. StrictMode의 effect 재실행이나 뒤로 가기로 같은 URL을 다시 처리하면
// 이미 쓴 code를 또 성공으로 돌려주지 않도록 already_handled로 응답한다.
// code·verifier·nonce가 메모리에 남지 않도록 URL만 기억한다.
let lastHandledUrl: string | null = null;

/**
 * 콜백 URL을 처리합니다. state를 검증하고, 저장해 둔 code_verifier와 nonce를 꺼낸 뒤
 * 성공과 실패에 관계없이 sessionStorage에서 지웁니다(일회용).
 * 같은 URL을 다시 처리하면 `already_handled`, 콜백이 아닌 URL이면 `not_callback`을 돌려줍니다.
 */
export function handleOAuthCallback(url: string = currentUrl()): OAuthCallbackResult {
  const params = parseOAuthCallback(url);
  if (!isCallback(params)) {
    return {
      ok: false,
      error: 'not_callback',
      errorDescription: 'The URL does not contain OAuth callback parameters.',
    };
  }

  const handledUrl = toAbsoluteUrl(url).href;
  if (lastHandledUrl === handledUrl) {
    return {
      ok: false,
      error: 'already_handled',
      errorDescription: 'This callback URL has already been handled.',
    };
  }

  lastHandledUrl = handledUrl;
  return resolveCallback(params);
}
