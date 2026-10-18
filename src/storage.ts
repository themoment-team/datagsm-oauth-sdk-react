import { NONCE_KEY, PKCE_VERIFIER_KEY, STATE_KEY } from './constants';

export interface StoredAuthorizationRequest {
  state: string | null;
  codeVerifier: string | null;
  nonce: string | null;
}

export interface AuthorizationRequestToStore {
  state: string;
  codeVerifier?: string;
  nonce?: string;
}

function setOrRemove(key: string, value: string | undefined): void {
  if (value === undefined) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, value);
}

/**
 * 로그인 시작 시 만든 값을 sessionStorage에 저장합니다.
 * 저장 도중 실패하면(스토리지 차단, 용량 초과 등) state만 남고 verifier가 빠지는 일이 없도록
 * 저장한 값을 모두 지우고 원래 오류를 다시 던집니다.
 */
export function saveAuthorizationRequest(request: AuthorizationRequestToStore): void {
  try {
    sessionStorage.setItem(STATE_KEY, request.state);
    setOrRemove(PKCE_VERIFIER_KEY, request.codeVerifier);
    setOrRemove(NONCE_KEY, request.nonce);
  } catch (error) {
    try {
      clearAuthorizationRequest();
    } catch {
      // 스토리지 접근 자체가 막힌 경우에는 지울 값도 없다.
    }
    throw error;
  }
}

export function loadAuthorizationRequest(): StoredAuthorizationRequest {
  return {
    state: sessionStorage.getItem(STATE_KEY),
    codeVerifier: sessionStorage.getItem(PKCE_VERIFIER_KEY),
    nonce: sessionStorage.getItem(NONCE_KEY),
  };
}

export function clearAuthorizationRequest(): void {
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(NONCE_KEY);
}
