import type { OAuthCallbackResult } from './callback';

export type AuthMode = 'STANDARD' | 'PKCE';

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  /**
   * 인가 코드 흐름 방식입니다. 기본값은 `PKCE`입니다.
   * PKCE 없이 발급된 code는 토큰으로 바꿀 때 client_secret이 필요하므로,
   * `STANDARD`는 client_secret을 보관하는 백엔드가 code를 교환할 때만 사용하세요.
   * PKCE는 Web Crypto(`crypto.subtle`)를 쓰므로 HTTPS 또는 localhost에서만 동작합니다.
   */
  authMode?: AuthMode;
  /**
   * 요청할 scope 목록입니다. 형식은 `{appId}:account_read`이고, OIDC id_token이 필요하면 `openid`를 넣습니다.
   * 생략하면 서버가 기본 scope(`{appId}:account_read`, `{appId}:student_read`)를 부여합니다.
   * 값이 같으면 배열 참조가 바뀌어도 `login`을 새로 만들지 않으므로 인라인 배열로 넘겨도 됩니다.
   */
  scope?: readonly string[];
  /**
   * `openid` scope를 요청할 때 nonce를 만들어 authorize 요청에 싣고 sessionStorage에 저장합니다.
   * 서버는 이 값을 id_token의 `nonce` 클레임에 그대로 넣습니다. 기본값은 `true`입니다.
   */
  useNonce?: boolean;
  /**
   * 인가 서버 주소입니다. 지정하면 `${issuer}/v1/oauth/authorize`로 이동합니다.
   * 기본값은 `https://oauth.authorization.datagsm.kr`입니다.
   */
  issuer?: string;
  /** authorize 엔드포인트 전체 주소입니다. `issuer`보다 우선합니다. */
  authorizationUrl?: string;
}

export interface OAuthContextValue extends OAuthConfig {
  login: () => Promise<void>;
  /** handleOAuthCallback과 같습니다. url을 생략하면 현재 주소를 처리합니다. */
  handleCallback: (url?: string) => OAuthCallbackResult;
  getCodeVerifier: () => string | null;
  clearVerifier: () => void;
}
