// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { exchangeAuthorizationCode, fetchUserInfo } from './api';
import { DataGsmOAuthError, toDataGsmOAuthError } from './errors';
import { TOKEN_RESPONSE, USER, USERINFO_URL, mockFetch } from './test-fixtures';

const EXCHANGE_PARAMS = {
  clientId: 'client-id',
  code: 'code',
  redirectUri: 'https://app.example.com/api/auth/callback',
  codeVerifier: 'verifier',
};

describe('toDataGsmOAuthError', () => {
  it('OAuth 오류 형식에서 error와 error_description을 꺼낸다', async () => {
    const error = await toDataGsmOAuthError(
      Response.json({ error: 'invalid_grant', error_description: '만료된 코드' }, { status: 400 }),
    );

    expect(error).toBeInstanceOf(DataGsmOAuthError);
    expect(error).toMatchObject({
      error: 'invalid_grant',
      errorDescription: '만료된 코드',
      status: 400,
    });
  });

  it('공통 오류 형식은 status 이름과 message를 쓴다', async () => {
    const error = await toDataGsmOAuthError(
      Response.json(
        { status: '401 UNAUTHORIZED', code: 401, message: '잘못된 형식의 토큰입니다.' },
        { status: 401 },
      ),
    );

    expect(error).toMatchObject({
      error: 'UNAUTHORIZED',
      errorDescription: '잘못된 형식의 토큰입니다.',
      status: 401,
    });
  });

  it('상태 코드가 붙지 않은 status 값도 그대로 쓴다', async () => {
    const error = await toDataGsmOAuthError(
      Response.json(
        { status: 'TOO_MANY_REQUESTS', code: 429, message: '요청이 너무 많습니다.' },
        { status: 429 },
      ),
    );

    expect(error.error).toBe('TOO_MANY_REQUESTS');
  });

  it('JSON이 아닌 본문은 http_error로 둔다', async () => {
    const error = await toDataGsmOAuthError(
      new Response('<html>Bad Gateway</html>', { status: 502 }),
    );

    expect(error).toMatchObject({ error: 'http_error', errorDescription: null, status: 502 });
  });
});

describe('exchangeAuthorizationCode', () => {
  it('응답을 camelCase TokenSet으로 바꾼다', async () => {
    mockFetch(() => Response.json(TOKEN_RESPONSE));

    await expect(exchangeAuthorizationCode(EXCHANGE_PARAMS)).resolves.toEqual({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshToken: 'refresh-token',
      scope: 'datagsm:self_read',
    });
  });

  it('issuer 끝의 /를 떼고 토큰 엔드포인트를 만든다', async () => {
    const fetchMock = mockFetch(() => Response.json(TOKEN_RESPONSE));

    await exchangeAuthorizationCode({ ...EXCHANGE_PARAMS, issuer: 'http://localhost:8080/' });

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/v1/oauth/token');
  });

  it('실패 응답은 DataGsmOAuthError로 던진다', async () => {
    mockFetch(() =>
      Response.json({ error: 'invalid_client', error_description: 'bad' }, { status: 401 }),
    );

    await expect(exchangeAuthorizationCode(EXCHANGE_PARAMS)).rejects.toMatchObject({
      name: 'DataGsmOAuthError',
      error: 'invalid_client',
      status: 401,
    });
  });
});

describe('fetchUserInfo', () => {
  it('Bearer 토큰으로 사용자 정보를 가져온다', async () => {
    const fetchMock = mockFetch(() => Response.json(USER));

    await expect(fetchUserInfo('token')).resolves.toEqual(USER);
    expect(fetchMock.mock.calls[0][0]).toBe(USERINFO_URL);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('authorization')).toBe(
      'Bearer token',
    );
  });

  it('토큰이 잘못되면 DataGsmOAuthError로 던진다', async () => {
    mockFetch(() =>
      Response.json({ status: '401 UNAUTHORIZED', code: 401, message: '만료' }, { status: 401 }),
    );

    await expect(fetchUserInfo('expired')).rejects.toMatchObject({
      error: 'UNAUTHORIZED',
      status: 401,
    });
  });
});
