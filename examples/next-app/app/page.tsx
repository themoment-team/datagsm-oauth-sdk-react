import { auth } from '../lib/datagsm';
import { UserPanel } from './user-panel';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await auth.getUser();
  const { error } = await searchParams;

  return (
    <main>
      <h1>DataGSM OAuth 예제</h1>
      {error && <p role="alert">로그인에 실패했습니다: {error}</p>}

      <section>
        <h2>서버 컴포넌트 (auth.getUser)</h2>
        {user ? (
          <p data-testid="server-user">
            {user.student?.name ?? user.teacher?.name ?? user.email}님, 안녕하세요.
          </p>
        ) : (
          <a href="/api/auth/login">DataGSM으로 로그인</a>
        )}
      </section>

      <section>
        <h2>클라이언트 컴포넌트 (useUser)</h2>
        <UserPanel />
      </section>
    </main>
  );
}
