import { describe, expect, it } from 'vitest';
import { handleOAuthCallback, parseOAuthCallback } from './callback';
import { loadAuthorizationRequest, saveAuthorizationRequest } from './storage';

const REDIRECT_URI = 'https://app.example.com/callback';

let sequence = 0;
// handleOAuthCallback은 같은 URL의 결과를 재사용하므로 테스트마다 URL을 다르게 만든다.
function callbackUrl(query: string): string {
  sequence += 1;
  return `${REDIRECT_URI}?${query}&_t=${sequence}`;
}

// 서버(IssueAuthorizationCodeServiceImpl, CompleteOauthConsentServiceImpl)는
// java.net.URLEncoder로 값을 인코딩하므로 공백이 '+'가 된다.
function javaUrlEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

describe('parseOAuthCallback', () => {
  it('code와 state를 꺼낸다', () => {
    expect(parseOAuthCallback(`${REDIRECT_URI}?code=abc&state=xyz`)).toEqual({
      code: 'abc',
      state: 'xyz',
      error: null,
      errorDescription: null,
    });
  });

  it('서버의 동의 거부 리다이렉트에서 error와 error_description을 꺼낸다', () => {
    const description = '사용자가 접근 권한 요청을 거부했습니다.';
    const url = `${REDIRECT_URI}?error=access_denied&error_description=${javaUrlEncode(description)}&state=xyz`;

    expect(parseOAuthCallback(url)).toEqual({
      code: null,
      state: 'xyz',
      error: 'access_denied',
      errorDescription: description,
    });
  });

  it('redirect_uri에 원래 쿼리가 있어도 code와 state를 꺼낸다', () => {
    const params = parseOAuthCallback('https://app.example.com/callback?tab=1&code=abc&state=xyz');

    expect(params.code).toBe('abc');
    expect(params.state).toBe('xyz');
  });

  it('URL을 생략하면 현재 주소를 읽는다', () => {
    window.history.replaceState(null, '', '/callback?code=current&state=s');

    expect(parseOAuthCallback().code).toBe('current');
  });
});

describe('handleOAuthCallback', () => {
  it('state가 맞으면 code와 저장해 둔 verifier, nonce를 돌려준다', () => {
    saveAuthorizationRequest({ state: 'st+/=', codeVerifier: 'verifier', nonce: 'nonce' });

    const result = handleOAuthCallback(callbackUrl(`code=abc&state=${javaUrlEncode('st+/=')}`));

    expect(result).toEqual({
      ok: true,
      code: 'abc',
      state: 'st+/=',
      codeVerifier: 'verifier',
      nonce: 'nonce',
    });
  });

  it('처리한 뒤에는 저장한 state, verifier, nonce를 지운다', () => {
    saveAuthorizationRequest({ state: 's', codeVerifier: 'v', nonce: 'n' });

    handleOAuthCallback(callbackUrl('code=abc&state=s'));

    expect(loadAuthorizationRequest()).toEqual({ state: null, codeVerifier: null, nonce: null });
  });

  it('STANDARD 모드로 로그인했으면 codeVerifier가 null이다', () => {
    saveAuthorizationRequest({ state: 's' });

    const result = handleOAuthCallback(callbackUrl('code=abc&state=s'));

    expect(result).toMatchObject({ ok: true, codeVerifier: null, nonce: null });
  });

  it('state가 다르면 invalid_state로 실패하고 저장값을 지운다', () => {
    saveAuthorizationRequest({ state: 'expected', codeVerifier: 'v' });

    const result = handleOAuthCallback(callbackUrl('code=abc&state=forged'));

    expect(result).toMatchObject({ ok: false, error: 'invalid_state' });
    expect(loadAuthorizationRequest().codeVerifier).toBeNull();
  });

  it('저장된 state가 없으면 invalid_state로 실패한다', () => {
    const result = handleOAuthCallback(callbackUrl('code=abc&state=s'));

    expect(result).toMatchObject({ ok: false, error: 'invalid_state' });
  });

  it('콜백에 state가 없으면 invalid_state로 실패한다', () => {
    saveAuthorizationRequest({ state: 's' });

    const result = handleOAuthCallback(callbackUrl('code=abc'));

    expect(result).toMatchObject({ ok: false, error: 'invalid_state' });
  });

  it('사용자가 동의를 거부하면 access_denied와 서버 설명을 돌려준다', () => {
    saveAuthorizationRequest({ state: 's', codeVerifier: 'v' });
    const description = '사용자가 접근 권한 요청을 거부했습니다.';

    const result = handleOAuthCallback(
      callbackUrl(`error=access_denied&error_description=${javaUrlEncode(description)}&state=s`),
    );

    expect(result).toEqual({ ok: false, error: 'access_denied', errorDescription: description });
    expect(loadAuthorizationRequest()).toEqual({ state: null, codeVerifier: null, nonce: null });
  });

  it('state가 맞지 않는 오류 응답은 invalid_state로 처리한다', () => {
    saveAuthorizationRequest({ state: 's' });

    const result = handleOAuthCallback(callbackUrl('error=access_denied&state=other'));

    expect(result).toMatchObject({ ok: false, error: 'invalid_state' });
  });

  it('code도 error도 없으면 missing_code로 실패한다', () => {
    saveAuthorizationRequest({ state: 's' });

    const result = handleOAuthCallback(callbackUrl('state=s'));

    expect(result).toMatchObject({ ok: false, error: 'missing_code' });
  });

  it('같은 URL을 다시 처리하면 첫 결과를 돌려준다 (StrictMode 이중 실행 대비)', () => {
    saveAuthorizationRequest({ state: 's', codeVerifier: 'v' });
    const url = callbackUrl('code=abc&state=s');

    const first = handleOAuthCallback(url);
    const second = handleOAuthCallback(url);

    expect(first).toMatchObject({ ok: true, codeVerifier: 'v' });
    expect(second).toBe(first);
  });

  it('다른 URL은 새로 처리한다', () => {
    saveAuthorizationRequest({ state: 's' });
    handleOAuthCallback(callbackUrl('code=abc&state=s'));

    const result = handleOAuthCallback(callbackUrl('code=abc&state=s'));

    expect(result).toMatchObject({ ok: false, error: 'invalid_state' });
  });
});
