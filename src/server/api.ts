import { DATAGSM_OAUTH_ISSUER } from '../constants';
import { DATAGSM_USERINFO_URL, TOKEN_PATH } from './constants';
import { toDataGsmOAuthError } from './errors';
import type { DataGsmUser, TokenSet } from './types';

export interface ExchangeAuthorizationCodeParams {
  clientId: string;
  clientSecret?: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  /** 기본값은 `https://oauth.authorization.datagsm.kr`입니다. */
  issuer?: string;
}

interface TokenResponseBody {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string | null;
  scope: string;
  id_token?: string | null;
}

/**
 * 인가 코드를 토큰으로 바꿉니다. 서버는 JSON 본문만 받습니다.
 * scope는 보내지 않습니다. 생략하면 서버가 인가 코드의 scope를 그대로 씁니다.
 */
export async function exchangeAuthorizationCode(
  params: ExchangeAuthorizationCodeParams,
): Promise<TokenSet> {
  const issuer = (params.issuer ?? DATAGSM_OAUTH_ISSUER).replace(/\/+$/, '');
  const response = await fetch(`${issuer}${TOKEN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      ...(params.clientSecret ? { client_secret: params.clientSecret } : {}),
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
    cache: 'no-store',
  });

  if (!response.ok) throw await toDataGsmOAuthError(response);

  const body = (await response.json()) as TokenResponseBody;
  return {
    accessToken: body.access_token,
    tokenType: body.token_type,
    expiresIn: body.expires_in,
    refreshToken: body.refresh_token ?? null,
    scope: body.scope,
    ...(body.id_token !== undefined ? { idToken: body.id_token } : {}),
  };
}

/** 액세스 토큰으로 사용자 정보를 가져옵니다. */
export async function fetchUserInfo(
  accessToken: string,
  options: { userInfoUrl?: string } = {},
): Promise<DataGsmUser> {
  const response = await fetch(options.userInfoUrl ?? DATAGSM_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) throw await toDataGsmOAuthError(response);

  return (await response.json()) as DataGsmUser;
}
