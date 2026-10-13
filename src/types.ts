type AuthMode = 'STANDARD' | 'PKCE';

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  authMode?: AuthMode;
  /**
   * 요청할 scope 목록입니다. 형식은 `{appId}:account_read`이고, OIDC id_token이 필요하면 `openid`를 넣습니다.
   * 생략하면 서버가 기본 scope(`{appId}:account_read`, `{appId}:student_read`)를 부여합니다.
   */
  scope?: string[];
  /**
   * `openid` scope를 요청할 때 nonce를 만들어 authorize 요청에 싣고 sessionStorage에 저장합니다.
   * 서버는 이 값을 id_token의 `nonce` 클레임에 그대로 넣습니다. 기본값은 `true`입니다.
   */
  useNonce?: boolean;
}

export interface OAuthContextValue extends OAuthConfig {
  login: () => Promise<void>;
  getCodeVerifier: () => string | null;
  clearVerifier: () => void;
}
