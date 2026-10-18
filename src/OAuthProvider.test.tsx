import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthLoginButton } from './OAuthLoginButton';
import { OAuthProvider, type OAuthProviderProps } from './OAuthProvider';
import { useOAuth } from './hooks';
import { navigateToUrl } from './authorize';
import { loadAuthorizationRequest } from './storage';

vi.mock('./authorize', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./authorize')>()),
  navigateToUrl: vi.fn(),
}));

const BASE_PROPS = {
  clientId: 'client',
  redirectUri: 'https://app.example.com/callback',
};

function renderOAuth(props: Partial<OAuthProviderProps> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <OAuthProvider {...BASE_PROPS} {...props}>
      {children}
    </OAuthProvider>
  );
  return renderHook(() => useOAuth(), { wrapper });
}

async function loginAndGetUrl(props: Partial<OAuthProviderProps> = {}): Promise<URL> {
  const { result } = renderOAuth(props);
  await act(() => result.current.login());
  const calls = vi.mocked(navigateToUrl).mock.calls;
  return new URL(calls[calls.length - 1][0]);
}

describe('OAuthProvider', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(navigateToUrl).mockClear();
  });

  it('login은 state를 만들어 저장하고 authorize 요청에 싣는다', async () => {
    const url = await loginAndGetUrl();

    const { state } = loadAuthorizationRequest();
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('state')).toBe(state);
  });

  it('login할 때마다 새 state를 만든다', async () => {
    const first = (await loginAndGetUrl()).searchParams.get('state');
    const second = (await loginAndGetUrl()).searchParams.get('state');

    expect(first).not.toBe(second);
    expect(loadAuthorizationRequest().state).toBe(second);
  });

  it('기본 모드는 PKCE다', () => {
    const { result } = renderOAuth();

    expect(result.current.authMode).toBe('PKCE');
  });

  it('authMode를 지정하지 않으면 verifier를 저장하고 S256 challenge를 보낸다', async () => {
    const url = await loginAndGetUrl();

    expect(loadAuthorizationRequest().codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('STANDARD 모드는 challenge를 보내지 않고 이전 verifier를 지운다', async () => {
    await loginAndGetUrl();

    const url = await loginAndGetUrl({ authMode: 'STANDARD' });

    expect(loadAuthorizationRequest().codeVerifier).toBeNull();
    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.searchParams.has('code_challenge_method')).toBe(false);
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('PKCE 모드에서는 verifier를 저장하고 S256 challenge를 보낸다', async () => {
    const url = await loginAndGetUrl({ authMode: 'PKCE' });

    expect(loadAuthorizationRequest().codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('설정한 scope를 authorize 요청에 싣는다', async () => {
    const url = await loginAndGetUrl({ scope: ['app:account_read', 'app:club_read'] });

    expect(url.searchParams.get('scope')).toBe('app:account_read app:club_read');
  });

  it('scope를 설정하지 않으면 scope 파라미터를 보내지 않는다', async () => {
    const url = await loginAndGetUrl();

    expect(url.searchParams.has('scope')).toBe(false);
  });

  it('잘못된 scope면 이동하지 않고 login이 실패한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderOAuth({ scope: ['a b'] });

    await expect(result.current.login()).rejects.toThrow('must not contain whitespace');
    expect(navigateToUrl).not.toHaveBeenCalled();
  });

  it('openid scope를 요청하면 nonce를 만들어 저장하고 authorize 요청에 싣는다', async () => {
    const url = await loginAndGetUrl({ scope: ['openid', 'app:account_read'] });

    const { nonce } = loadAuthorizationRequest();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('nonce')).toBe(nonce);
  });

  it('openid scope가 없으면 nonce를 만들지 않는다', async () => {
    const url = await loginAndGetUrl({ scope: ['app:account_read'] });

    expect(loadAuthorizationRequest().nonce).toBeNull();
    expect(url.searchParams.has('nonce')).toBe(false);
  });

  it('useNonce가 false면 openid scope여도 nonce를 만들지 않는다', async () => {
    const url = await loginAndGetUrl({ scope: ['openid'], useNonce: false });

    expect(loadAuthorizationRequest().nonce).toBeNull();
    expect(url.searchParams.has('nonce')).toBe(false);
  });

  it('기본 authorize 주소로 이동한다', async () => {
    const url = await loginAndGetUrl();

    expect(url.origin + url.pathname).toBe(
      'https://oauth.authorization.datagsm.kr/v1/oauth/authorize',
    );
  });

  it('issuer를 지정하면 그 서버의 authorize 주소로 이동한다', async () => {
    const url = await loginAndGetUrl({ issuer: 'http://localhost:8081/' });

    expect(url.origin + url.pathname).toBe('http://localhost:8081/v1/oauth/authorize');
  });

  it('authorizationUrl을 지정하면 그 주소로 이동한다', async () => {
    const url = await loginAndGetUrl({ authorizationUrl: 'https://custom.example.com/authorize' });

    expect(url.origin + url.pathname).toBe('https://custom.example.com/authorize');
  });

  it('authorize 주소를 만들지 못하면 state를 저장하지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderOAuth({ authorizationUrl: 'not a url' });

    await expect(result.current.login()).rejects.toThrow();
    expect(loadAuthorizationRequest().state).toBeNull();
  });

  it('인라인 scope 배열로 다시 렌더해도 값이 같으면 login과 context 값을 유지한다', () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <OAuthProvider {...BASE_PROPS} scope={['app:account_read', 'openid']}>
          {children}
        </OAuthProvider>
      );
    }
    const { result, rerender } = renderHook(() => useOAuth(), { wrapper: Wrapper });
    const first = result.current;

    rerender();

    expect(result.current.login).toBe(first.login);
    expect(result.current).toBe(first);
  });

  it('scope 값이 바뀌면 바뀐 scope로 로그인한다', async () => {
    let scope: readonly string[] = ['app:account_read'];
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <OAuthProvider {...BASE_PROPS} scope={scope}>
          {children}
        </OAuthProvider>
      );
    }
    const { result, rerender } = renderHook(() => useOAuth(), { wrapper: Wrapper });
    const firstLogin = result.current.login;

    scope = ['app:account_read', 'app:club_read'];
    rerender();
    await act(() => result.current.login());

    expect(result.current.login).not.toBe(firstLogin);
    const calls = vi.mocked(navigateToUrl).mock.calls;
    expect(new URL(calls[calls.length - 1][0]).searchParams.get('scope')).toBe(
      'app:account_read app:club_read',
    );
  });

  it('as const로 만든 readonly scope 상수를 받는다', async () => {
    const SCOPES = ['app:account_read', 'openid'] as const;

    const url = await loginAndGetUrl({ scope: SCOPES });

    expect(url.searchParams.get('scope')).toBe('app:account_read openid');
  });

  it('sessionStorage를 쓸 수 없으면 이동하지 않고 login이 실패한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const blocked = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw blocked;
    });
    const { result } = renderOAuth({ authMode: 'STANDARD' });

    await expect(result.current.login()).rejects.toBe(blocked);
    expect(navigateToUrl).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('login으로 시작한 흐름의 콜백을 handleCallback으로 처리한다', async () => {
    const url = await loginAndGetUrl({ scope: ['openid'] });
    const stored = loadAuthorizationRequest();
    const state = url.searchParams.get('state') ?? '';
    const { result } = renderOAuth();

    const callback = result.current.handleCallback(
      `https://app.example.com/callback?code=abc&state=${encodeURIComponent(state)}`,
    );

    expect(callback).toEqual({
      ok: true,
      code: 'abc',
      state,
      codeVerifier: stored.codeVerifier,
      nonce: stored.nonce,
    });
  });

  it('useOAuth를 Provider 밖에서 쓰면 에러를 던진다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useOAuth())).toThrow(
      'useOAuth must be used within OAuthProvider',
    );
  });

  it('로그인 버튼을 누르면 authorize 페이지로 이동한다', async () => {
    render(
      <OAuthProvider {...BASE_PROPS}>
        <OAuthLoginButton />
      </OAuthProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Data GSM 로그인' }));
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(navigateToUrl).toHaveBeenCalledOnce());
  });

  it('로그인 시작에 실패하면 버튼의 onError로 알린다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('boom');
    });
    const onError = vi.fn();
    render(
      <OAuthProvider {...BASE_PROPS}>
        <OAuthLoginButton onError={onError} />
      </OAuthProvider>,
    );

    fireEvent.click(screen.getByRole('button'));

    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(navigateToUrl).not.toHaveBeenCalled();
  });
});
