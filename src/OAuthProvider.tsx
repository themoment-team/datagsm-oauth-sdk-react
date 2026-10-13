import { type ReactNode, useMemo, useCallback } from 'react';
import { OAuthContext } from './context';
import { PKCE_VERIFIER_KEY } from './constants';
import {
  buildAuthorizationUrl,
  includesOpenIdScope,
  navigateToUrl,
  resolveAuthorizationUrl,
} from './authorize';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateNonce,
  generateState,
} from './crypto';
import { handleOAuthCallback } from './callback';
import { saveAuthorizationRequest } from './storage';
import type { OAuthConfig, OAuthContextValue } from './types';

export interface OAuthProviderProps extends OAuthConfig {
  children: ReactNode;
}

export function OAuthProvider({
  clientId,
  redirectUri,
  authMode = 'PKCE',
  scope,
  useNonce = true,
  issuer,
  authorizationUrl,
  children,
}: OAuthProviderProps) {
  const login = useCallback(async () => {
    try {
      const state = generateState();
      const codeVerifier = authMode === 'PKCE' ? generateCodeVerifier() : undefined;
      const codeChallenge = codeVerifier ? await generateCodeChallenge(codeVerifier) : undefined;

      const nonce = useNonce && includesOpenIdScope(scope) ? generateNonce() : undefined;

      const url = buildAuthorizationUrl(resolveAuthorizationUrl({ issuer, authorizationUrl }), {
        clientId,
        redirectUri,
        state,
        codeChallenge,
        scope,
        nonce,
      });

      saveAuthorizationRequest({ state, codeVerifier, nonce });
      navigateToUrl(url);
    } catch (error) {
      console.error('Failed to initiate OAuth login:', error);
      throw error;
    }
  }, [clientId, redirectUri, authMode, scope, useNonce, issuer, authorizationUrl]);

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
      issuer,
      authorizationUrl,
      login,
      handleCallback: handleOAuthCallback,
      getCodeVerifier,
      clearVerifier,
    }),
    [
      clientId,
      redirectUri,
      authMode,
      scope,
      useNonce,
      issuer,
      authorizationUrl,
      login,
      getCodeVerifier,
      clearVerifier,
    ],
  );

  return <OAuthContext.Provider value={value}>{children}</OAuthContext.Provider>;
}
