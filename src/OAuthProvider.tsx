import { type ReactNode, useMemo, useCallback } from 'react';
import { OAuthContext } from './context';
import { DATAGSM_OAUTH_URL, PKCE_VERIFIER_KEY } from './constants';
import { buildOAuthUrl, navigateToUrl, generateCodeVerifier, generateCodeChallenge } from './utils';
import type { OAuthConfig, OAuthContextValue } from './types';

export interface OAuthProviderProps extends OAuthConfig {
  children: ReactNode;
}

export function OAuthProvider({ clientId, redirectUri, children }: OAuthProviderProps) {
  const login = useCallback(async () => {
    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);

      const url = buildOAuthUrl(DATAGSM_OAUTH_URL, {
        clientId,
        redirectUri,
        codeChallenge,
      });
      navigateToUrl(url);
    } catch (error) {
      console.error('Failed to initiate OAuth login:', error);
      throw error;
    }
  }, [clientId, redirectUri]);

  const getCodeVerifier = useCallback(() => {
    return sessionStorage.getItem(PKCE_VERIFIER_KEY);
  }, []);

  const clearVerifier = useCallback(() => {
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  }, []);
  const value: OAuthContextValue = useMemo(
    () => ({
      clientId,
      redirectUri,
      login,
      getCodeVerifier,
      clearVerifier,
    }),
    [clientId, redirectUri, login, getCodeVerifier, clearVerifier],
  );

  return <OAuthContext.Provider value={value}>{children}</OAuthContext.Provider>;
}
