import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // 서버 코드 테스트는 node 환경(`@vitest-environment node`)이라 sessionStorage가 없다.
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
});
