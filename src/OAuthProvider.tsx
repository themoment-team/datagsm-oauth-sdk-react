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
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const expires = new Date(Date.now() + 5 * 60 * 1000).toUTCString();
    document.cookie = `${PKCE_VERIFIER_KEY}=${codeVerifier}; expires=${expires}; path=/; SameSite=Lax`;

    const url = buildOAuthUrl(DATAGSM_OAUTH_URL, {
      clientId,
      redirectUri,
      codeChallenge,
    });
    navigateToUrl(url);
  }, [clientId, redirectUri]);

  const getCodeVerifier = useCallback(() => {
    const cookies = document.cookie.split('; ');
    const verifierCookie = cookies.find((row) => row.startsWith(`${PKCE_VERIFIER_KEY}=`));
    return verifierCookie ? verifierCookie.split('=')[1] : null;
  }, []);

  const clearVerifier = useCallback(() => {
    document.cookie = `${PKCE_VERIFIER_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
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
