import { describe, expect, expectTypeOf, it } from 'vitest';
import * as sdk from './index';
import type {
  AuthMode,
  OAuthCallbackErrorCode,
  OAuthCallbackFailure,
  OAuthCallbackParams,
  OAuthCallbackResult,
  OAuthCallbackSuccess,
  OAuthConfig,
  OAuthContextValue,
  OAuthLoginButtonProps,
  OAuthProviderProps,
} from './index';

describe('public API', () => {
  it('컴포넌트, 훅, 콜백 유틸을 export한다', () => {
    expect(Object.keys(sdk).sort()).toEqual(
      [
        'DATAGSM_OAUTH_ISSUER',
        'OAuthLoginButton',
        'OAuthProvider',
        'clearAuthorizationRequest',
        'handleOAuthCallback',
        'parseOAuthCallback',
        'useOAuth',
        'useUser',
        'verifyState',
      ].sort(),
    );
    expect(sdk.DATAGSM_OAUTH_ISSUER).toBe('https://oauth.authorization.datagsm.kr');
  });

  it('공개 타입을 export한다', () => {
    expectTypeOf<AuthMode>().toEqualTypeOf<'STANDARD' | 'PKCE'>();
    expectTypeOf<OAuthConfig['scope']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<
      OAuthContextValue['handleCallback']
    >().returns.toEqualTypeOf<OAuthCallbackResult>();
    expectTypeOf<OAuthProviderProps>().toMatchTypeOf<OAuthConfig>();
    expectTypeOf<OAuthLoginButtonProps['onError']>().toEqualTypeOf<
      ((error: unknown) => void) | undefined
    >();
    expectTypeOf<OAuthCallbackSuccess['ok']>().toEqualTypeOf<true>();
    expectTypeOf<OAuthCallbackFailure['error']>().toEqualTypeOf<OAuthCallbackErrorCode>();
    expectTypeOf<OAuthCallbackParams['code']>().toEqualTypeOf<string | null>();
  });
});
