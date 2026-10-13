import { beforeEach, describe, expect, it } from 'vitest';
import { verifyState } from './state';
import {
  clearAuthorizationRequest,
  loadAuthorizationRequest,
  saveAuthorizationRequest,
} from './storage';

describe('authorization request storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('state와 verifier를 sessionStorage에 저장하고 꺼낸다', () => {
    saveAuthorizationRequest({ state: 's', codeVerifier: 'v', nonce: 'n' });

    expect(loadAuthorizationRequest()).toEqual({ state: 's', codeVerifier: 'v', nonce: 'n' });
  });

  it('verifier나 nonce 없이 저장하면 이전 로그인 시도의 값을 지운다', () => {
    saveAuthorizationRequest({ state: 's1', codeVerifier: 'old', nonce: 'old' });

    saveAuthorizationRequest({ state: 's2' });

    expect(loadAuthorizationRequest()).toEqual({ state: 's2', codeVerifier: null, nonce: null });
  });

  it('clearAuthorizationRequest는 저장한 값을 모두 지운다', () => {
    saveAuthorizationRequest({ state: 's', codeVerifier: 'v', nonce: 'n' });

    clearAuthorizationRequest();

    expect(loadAuthorizationRequest()).toEqual({ state: null, codeVerifier: null, nonce: null });
  });
});

describe('verifyState', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('저장된 state와 같으면 true다', () => {
    saveAuthorizationRequest({ state: 'expected' });

    expect(verifyState('expected')).toBe(true);
  });

  it('저장된 state와 다르면 false다', () => {
    saveAuthorizationRequest({ state: 'expected' });

    expect(verifyState('forged')).toBe(false);
  });

  it('저장된 state가 없거나 받은 state가 비어 있으면 false다', () => {
    expect(verifyState('anything')).toBe(false);

    saveAuthorizationRequest({ state: 'expected' });

    expect(verifyState(null)).toBe(false);
    expect(verifyState('')).toBe(false);
  });

  it('검증만 하고 저장된 state는 지우지 않는다', () => {
    saveAuthorizationRequest({ state: 'expected' });

    verifyState('expected');

    expect(loadAuthorizationRequest().state).toBe('expected');
  });
});
