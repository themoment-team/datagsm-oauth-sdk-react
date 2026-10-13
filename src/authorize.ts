export interface AuthorizationRequestParams {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
}

export function buildAuthorizationUrl(baseUrl: string, params: AuthorizationRequestParams): string {
  const url = new URL(baseUrl);
  const query = url.searchParams;

  query.set('client_id', params.clientId);
  query.set('redirect_uri', params.redirectUri);
  query.set('response_type', 'code');
  query.set('state', params.state);

  if (params.codeChallenge) {
    query.set('code_challenge', params.codeChallenge);
    query.set('code_challenge_method', 'S256');
  }

  return url.toString();
}

export function navigateToUrl(url: string): void {
  window.location.href = url;
}
