import { useCallback, useEffect, useState } from 'react';
import { navigateToUrl } from './authorize';
import { DEFAULT_BASE_PATH } from './server/constants';
import type { DataGsmUser } from './server/types';

export type UserStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface UseUserOptions {
  /** 서버 인증 라우트의 경로입니다. 기본값은 `/api/auth`입니다. */
  basePath?: string;
}

export interface UseUserResult {
  user: DataGsmUser | null;
  status: UserStatus;
  /** `{basePath}/login`으로 이동합니다. 로그인 뒤에는 returnTo(기본값: 현재 주소)로 돌아옵니다. */
  login: (returnTo?: string) => void;
  /** 세션 쿠키를 지우고 로그인 안 된 상태로 바꿉니다. */
  logout: () => Promise<void>;
  /** 세션을 다시 읽습니다. */
  refresh: () => Promise<void>;
}

interface UserState {
  user: DataGsmUser | null;
  status: UserStatus;
}

const UNAUTHENTICATED: UserState = { user: null, status: 'unauthenticated' };

async function fetchSessionUser(basePath: string): Promise<DataGsmUser | null> {
  const response = await fetch(`${basePath}/session`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Failed to load session: ${response.status}`);
  const body = (await response.json()) as { user: DataGsmUser | null };
  return body.user;
}

function toState(user: DataGsmUser | null): UserState {
  return user ? { user, status: 'authenticated' } : UNAUTHENTICATED;
}

/**
 * Next.js 서버 흐름(`@themoment-team/datagsm-oauth-react/next`)으로 로그인한 사용자를 클라이언트에서 읽습니다.
 * 마운트할 때 `{basePath}/session`을 한 번 호출합니다. 토큰은 브라우저로 내려오지 않습니다.
 */
export function useUser({ basePath = DEFAULT_BASE_PATH }: UseUserOptions = {}): UseUserResult {
  const [state, setState] = useState<UserState>({ user: null, status: 'loading' });

  useEffect(() => {
    let active = true;
    fetchSessionUser(basePath)
      .then((user) => active && setState(toState(user)))
      .catch(() => active && setState(UNAUTHENTICATED));
    return () => {
      active = false;
    };
  }, [basePath]);

  const refresh = useCallback(async () => {
    try {
      setState(toState(await fetchSessionUser(basePath)));
    } catch {
      setState(UNAUTHENTICATED);
    }
  }, [basePath]);

  const login = useCallback(
    (returnTo?: string) => {
      const target =
        returnTo ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigateToUrl(`${basePath}/login?returnTo=${encodeURIComponent(target)}`);
    },
    [basePath],
  );

  const logout = useCallback(async () => {
    const response = await fetch(`${basePath}/logout`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(`Failed to log out: ${response.status}`);
    setState(UNAUTHENTICATED);
  }, [basePath]);

  return { user: state.user, status: state.status, login, logout, refresh };
}
