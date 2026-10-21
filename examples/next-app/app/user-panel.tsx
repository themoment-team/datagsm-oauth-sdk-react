'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@themoment-team/datagsm-oauth-react';

export function UserPanel() {
  const router = useRouter();
  const { user, status, login, logout } = useUser();

  if (status === 'loading') return <p>불러오는 중...</p>;
  if (!user) return <button onClick={() => login()}>DataGSM으로 로그인</button>;

  return (
    <div>
      <p>
        {user.email} ({user.role})
      </p>
      <button onClick={() => logout().then(() => router.refresh())}>로그아웃</button>
    </div>
  );
}
