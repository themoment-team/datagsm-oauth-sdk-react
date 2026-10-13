import { STATE_KEY } from './constants';
import { timingSafeEqual } from './crypto';

/**
 * 콜백으로 돌아온 state가 로그인 시작 시 저장한 값과 같은지 확인합니다.
 * 저장된 state는 지우지 않습니다. 정리까지 하려면 handleOAuthCallback을 사용하세요.
 */
export function verifyState(receivedState: string | null | undefined): boolean {
  const storedState = sessionStorage.getItem(STATE_KEY);
  if (!storedState || !receivedState) return false;
  return timingSafeEqual(storedState, receivedState);
}
