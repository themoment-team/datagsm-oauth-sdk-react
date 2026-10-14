import { timingSafeEqual } from './crypto';
import { clearAuthorizationRequest, loadAuthorizationRequest } from './storage';

/**
 * 콜백 실패 사유입니다.
 * - `invalid_state`: 받은 state가 저장한 값과 다르거나 저장된 값이 없습니다(CSRF 의심).
 * - `missing_code`: 오류도 code도 없는 콜백입니다.
 * - 그 밖의 값은 서버가 보낸 `error` 그대로입니다. 사용자가 동의를 거부하면 `access_denied`입니다.
 */
export type OAuthCallbackErrorCode =
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

function currentUrl(): string {
  return window.location.href;
}

/** 콜백 URL의 쿼리에서 code, state, error, error_description을 꺼냅니다. */
export function parseOAuthCallback(url: string = currentUrl()): OAuthCallbackParams {
  const query = new URL(url).searchParams;
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

// React StrictMode는 개발 모드에서 effect를 두 번 실행한다.
// 첫 호출이 저장값을 지우므로, 같은 URL을 다시 처리하면 첫 결과를 그대로 돌려준다.
let lastHandled: { url: string; result: OAuthCallbackResult } | null = null;

/**
 * 콜백 URL을 처리합니다. state를 검증하고, 저장해 둔 code_verifier와 nonce를 꺼낸 뒤
 * 성공과 실패에 관계없이 sessionStorage에서 지웁니다(일회용).
 */
export function handleOAuthCallback(url: string = currentUrl()): OAuthCallbackResult {
  if (lastHandled?.url === url) return lastHandled.result;

  const result = resolveCallback(parseOAuthCallback(url));
  lastHandled = { url, result };
  return result;
}
