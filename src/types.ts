type AuthMode = 'STANDARD' | 'PKCE';

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  authMode?: AuthMode;
}

export interface OAuthContextValue extends OAuthConfig {
  login: () => Promise<void>;
  getCodeVerifier: () => string | null;
  clearVerifier: () => void;
}
