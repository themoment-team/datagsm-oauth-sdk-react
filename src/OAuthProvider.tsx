import { type ReactNode, useMemo, useCallback } from 'react';
import { OAuthContext } from './context';
import { DATAGSM_OAUTH_URL, PKCE_VERIFIER_KEY } from './constants';
import { buildAuthorizationUrl, includesOpenIdScope, navigateToUrl } from './authorize';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateNonce,
  generateState,
} from './crypto';
import { saveAuthorizationRequest } from './storage';
import type { OAuthConfig, OAuthContextValue } from './types';

export interface OAuthProviderProps extends OAuthConfig {
  children: ReactNode;
}

export function OAuthProvider({
  clientId,
  redirectUri,
  authMode = 'STANDARD',
  scope,
  useNonce = true,
  children,
}: OAuthProviderProps) {
  const login = useCallback(async () => {
    try {
      const state = generateState();
      const codeVerifier = authMode === 'PKCE' ? generateCodeVerifier() : undefined;
      const codeChallenge = codeVerifier ? await generateCodeChallenge(codeVerifier) : undefined;

      const nonce = useNonce && includesOpenIdScope(scope) ? generateNonce() : undefined;

      saveAuthorizationRequest({ state, codeVerifier, nonce });

      const url = buildAuthorizationUrl(DATAGSM_OAUTH_URL, {
        clientId,
        redirectUri,
        state,
        codeChallenge,
        scope,
        nonce,
      });
      navigateToUrl(url);
    } catch (error) {
      console.error('Failed to initiate OAuth login:', error);
      throw error;
    }
  }, [clientId, redirectUri, authMode, scope, useNonce]);

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
      authMode,
      scope,
      useNonce,
      login,
      getCodeVerifier,
      clearVerifier,
    }),
    [clientId, redirectUri, authMode, scope, useNonce, login, getCodeVerifier, clearVerifier],
  );

  return <OAuthContext.Provider value={value}>{children}</OAuthContext.Provider>;
}
