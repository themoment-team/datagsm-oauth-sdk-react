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

  it('PKCE 모드에서는 verifier를 저장하고 S256 challenge를 보낸다', async () => {
    const url = await loginAndGetUrl({ authMode: 'PKCE' });

    expect(loadAuthorizationRequest().codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
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
