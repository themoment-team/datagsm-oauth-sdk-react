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

export function saveAuthorizationRequest(request: AuthorizationRequestToStore): void {
  sessionStorage.setItem(STATE_KEY, request.state);
  setOrRemove(PKCE_VERIFIER_KEY, request.codeVerifier);
  setOrRemove(NONCE_KEY, request.nonce);
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
