import { OPENID_SCOPE } from './constants';

export interface AuthorizationRequestParams {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  scope?: readonly string[];
  nonce?: string;
}

const WHITESPACE = /\s/;

/**
 * 서버는 authorize 요청의 scope를 공백 하나로 구분한 문자열로 받습니다.
 * 빈 값과 중복을 걸러내고, 값 안에 공백이 있으면 서버에서 다른 scope로 쪼개지므로 거부합니다.
 * 걸러낸 뒤 남는 값이 없으면 undefined를 돌려줘 서버 기본 scope를 쓰게 합니다.
 */
export function serializeScope(scope: readonly string[] | undefined): string | undefined {
  if (!scope) return undefined;

  const normalized = scope.map((value) => value.trim()).filter((value) => value.length > 0);
  const invalid = normalized.find((value) => WHITESPACE.test(value));
  if (invalid !== undefined) {
    throw new Error(`Invalid OAuth scope "${invalid}": a scope must not contain whitespace.`);
  }

  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique.join(' ') : undefined;
}

export function buildAuthorizationUrl(baseUrl: string, params: AuthorizationRequestParams): string {
  const url = new URL(baseUrl);
  const query = url.searchParams;

  query.set('client_id', params.clientId);
  query.set('redirect_uri', params.redirectUri);
  query.set('response_type', 'code');
  query.set('state', params.state);

  const scope = serializeScope(params.scope);
  if (scope) {
    query.set('scope', scope);
  }

  if (params.nonce) {
    query.set('nonce', params.nonce);
  }

  if (params.codeChallenge) {
    query.set('code_challenge', params.codeChallenge);
    query.set('code_challenge_method', 'S256');
  }

  return url.toString();
}

export function includesOpenIdScope(scope: readonly string[] | undefined): boolean {
  return scope?.some((value) => value.trim() === OPENID_SCOPE) ?? false;
}

export function navigateToUrl(url: string): void {
  window.location.href = url;
}
