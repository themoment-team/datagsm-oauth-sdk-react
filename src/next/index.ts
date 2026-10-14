import { cookies } from 'next/headers';
import { createAuthHandler } from '../server/handler';
import { readSession } from '../server/session';
import type { DataGsmAuthConfig, DataGsmUser } from '../server/types';

export interface DataGsmAuth {
  /** `app/api/auth/[...datagsm]/route.ts`에서 `export const { GET, POST } = auth.handlers;`로 씁니다. */
  handlers: {
    GET: (request: Request) => Promise<Response>;
    POST: (request: Request) => Promise<Response>;
  };
  /**
   * 서버 컴포넌트, Route Handler, Server Action에서 로그인한 사용자를 읽습니다. 없으면 null입니다.
   * 쿠키를 읽기만 하므로 서버 컴포넌트에서도 쓸 수 있습니다.
   */
  getUser: () => Promise<DataGsmUser | null>;
}

export function createDataGsmAuth(config: DataGsmAuthConfig): DataGsmAuth {
  const handler = createAuthHandler(config);

  return {
    handlers: { GET: handler, POST: handler },
    async getUser() {
      // Next 14는 cookies()가 동기, 15부터는 비동기다. await는 둘 다 처리한다.
      const store = await cookies();
      return readSession(store.getAll(), config);
    },
  };
}

export type { DataGsmAuthConfig, DataGsmUser } from '../server/types';
