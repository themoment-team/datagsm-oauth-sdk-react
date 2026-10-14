// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { cookies } from 'next/headers';
import { sealSession } from '../server/session';
import { CONFIG, SESSION_SECRET, USER } from '../server/test-fixtures';
import { createDataGsmAuth } from './index';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

function mockCookies(entries: { name: string; value: string }[]) {
  vi.mocked(cookies).mockResolvedValue({ getAll: () => entries } as unknown as Awaited<
    ReturnType<typeof cookies>
  >);
}

describe('createDataGsmAuth', () => {
  it('GET과 POST에 같은 핸들러를 준다', () => {
    const auth = createDataGsmAuth(CONFIG);

    expect(auth.handlers.GET).toBe(auth.handlers.POST);
  });

  it('getUser는 유효한 세션 쿠키면 사용자를 돌려준다', async () => {
    mockCookies([
      { name: 'datagsm_oauth_session', value: await sealSession(USER, SESSION_SECRET, 60) },
    ]);

    await expect(createDataGsmAuth(CONFIG).getUser()).resolves.toEqual(USER);
  });

  it('getUser는 쿠키가 없거나 변조됐으면 null이다', async () => {
    const auth = createDataGsmAuth(CONFIG);

    mockCookies([]);
    await expect(auth.getUser()).resolves.toBeNull();

    mockCookies([{ name: 'datagsm_oauth_session', value: 'not-a-jwe' }]);
    await expect(auth.getUser()).resolves.toBeNull();
  });

  it('Next 14처럼 cookies()가 동기여도 동작한다', async () => {
    const token = await sealSession(USER, SESSION_SECRET, 60);
    vi.mocked(cookies).mockReturnValue({
      getAll: () => [{ name: 'datagsm_oauth_session', value: token }],
    } as unknown as ReturnType<typeof cookies>);

    await expect(createDataGsmAuth(CONFIG).getUser()).resolves.toEqual(USER);
  });

  it('모듈을 불러오는 시점에는 설정을 검사하지 않는다', () => {
    expect(() => createDataGsmAuth({ ...CONFIG, sessionSecret: '' })).not.toThrow();
  });
});
