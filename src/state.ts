import { STATE_KEY } from './constants';
import { timingSafeEqual } from './crypto';

/**
 * 콜백으로 돌아온 state가 로그인 시작 시 저장한 값과 같은지 확인합니다.
 * state는 한 번만 쓸 수 있도록 결과와 관계없이 저장값에서 지웁니다.
 * code_verifier와 nonce까지 함께 처리하려면 handleOAuthCallback을 사용하세요.
 */
export function verifyState(receivedState: string | null | undefined): boolean {
  const storedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (!storedState || !receivedState) return false;
  return timingSafeEqual(storedState, receivedState);
}
