import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { navigateToUrl } from './authorize';
import { USER, mockFetch } from './server/test-fixtures';
import { useUser } from './useUser';

vi.mock('./authorize', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./authorize')>()),
  navigateToUrl: vi.fn(),
}));

function mockSession(user: unknown) {
  return mockFetch((url, init) =>
    url.endsWith('/logout') && init?.method === 'POST'
      ? new Response(null, { status: 204 })
      : Response.json({ user }),
  );
}

describe('useUser', () => {
  it('처음에는 loading이고, 세션이 있으면 authenticated가 된다', async () => {
    const fetchMock = mockSession(USER);

    const { result } = renderHook(() => useUser());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual(USER);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/session');
  });

  it('세션이 없으면 unauthenticated다', async () => {
    mockSession(null);

    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('세션 조회가 실패하면 unauthenticated다', async () => {
    mockFetch(() => new Response('error', { status: 500 }));

    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
  });

  it('logout은 POST를 보내고 unauthenticated로 바꾼다', async () => {
    const fetchMock = mockSession(USER);
    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(() => result.current.logout());

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });

  it('logout이 거절되면 상태를 바꾸지 않고 오류를 던진다', async () => {
    mockFetch((_url, init) =>
      init?.method === 'POST' ? new Response(null, { status: 403 }) : Response.json({ user: USER }),
    );
    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await expect(act(() => result.current.logout())).rejects.toThrow(/403/);
    expect(result.current.status).toBe('authenticated');
  });

  it('login은 현재 주소를 returnTo로 붙여 login 라우트로 이동한다', async () => {
    mockSession(null);
    window.history.replaceState(null, '', '/posts/1?tab=comments');
    const { result } = renderHook(() => useUser({ basePath: '/auth' }));

    result.current.login();
    result.current.login('/after');

    expect(navigateToUrl).toHaveBeenNthCalledWith(
      1,
      `/auth/login?returnTo=${encodeURIComponent('/posts/1?tab=comments')}`,
    );
    expect(navigateToUrl).toHaveBeenNthCalledWith(2, '/auth/login?returnTo=%2Fafter');
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
  });
});
