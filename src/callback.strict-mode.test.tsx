import { render } from '@testing-library/react';
import { StrictMode, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { handleOAuthCallback } from './callback';
import { saveAuthorizationRequest } from './storage';

describe('handleOAuthCallback in React StrictMode', () => {
  it('README 예제처럼 effect에서 호출해도 토큰 교환은 한 번만 일어난다', () => {
    saveAuthorizationRequest({ state: 'strict', codeVerifier: 'v' });
    window.history.replaceState(null, '', '/callback?code=strict-code&state=strict');
    const exchange = vi.fn();

    function CallbackPage() {
      useEffect(() => {
        const result = handleOAuthCallback();
        if (!result.ok) return;
        exchange(result.code, result.codeVerifier);
      }, []);
      return null;
    }

    render(
      <StrictMode>
        <CallbackPage />
      </StrictMode>,
    );

    expect(exchange).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledWith('strict-code', 'v');
  });
});
