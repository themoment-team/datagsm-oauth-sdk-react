// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readSession, sealSession } from './session';
import { SESSION_SECRET, USER } from './test-fixtures';

describe('readSession', () => {
  it('쿠키 헤더 문자열에서 사용자를 읽는다', async () => {
    const token = await sealSession(USER, SESSION_SECRET, 60);

    await expect(
      readSession(`other=1; datagsm_oauth_session=${token}`, { sessionSecret: SESSION_SECRET }),
    ).resolves.toEqual(USER);
  });

  it('{ name, value } 목록에서도 읽는다', async () => {
    const token = await sealSession(USER, SESSION_SECRET, 60);

    await expect(
      readSession([{ name: 'datagsm_oauth_session', value: token }], {
        sessionSecret: SESSION_SECRET,
      }),
    ).resolves.toEqual(USER);
  });

  it('쿠키가 없으면 null이다', async () => {
    await expect(readSession(null, { sessionSecret: SESSION_SECRET })).resolves.toBeNull();
    await expect(readSession('', { sessionSecret: SESSION_SECRET })).resolves.toBeNull();
  });

  it('sessionSecret이 짧으면 알려 준다', () => {
    expect(() => readSession(null, { sessionSecret: 'short' })).toThrow(/32/);
  });
});
