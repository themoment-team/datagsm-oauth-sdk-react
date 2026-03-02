export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
}

export interface OAuthContextValue extends OAuthConfig {
  login: () => void;
  getCodeVerifier: () => string | null;
  clearVerifier: () => void;
}
