# DataGSM OAuth SDK for React

React 애플리케이션에서 DataGSM OAuth 서비스를 간편하게 연동하기 위한 라이브러리입니다.

[![npm version](https://img.shields.io/npm/v/@themoment-team/datagsm-oauth-react.svg)](https://www.npmjs.com/package/@themoment-team/datagsm-oauth-react)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18%2B-61DAFB.svg)](https://react.dev/)

## 설치

```bash
# npm
npm install @themoment-team/datagsm-oauth-react

# pnpm
pnpm add @themoment-team/datagsm-oauth-react

# yarn
yarn add @themoment-team/datagsm-oauth-react
```

## 흐름 한눈에 보기

1. `login()`이 `state`, PKCE `code_verifier`, (openid를 요청하면) `nonce`를 만들어 `sessionStorage`에 저장하고 DataGSM authorize 페이지로 이동합니다.
2. 사용자가 로그인하고 동의하면 서버가 `redirectUri?code=...&state=...`로 돌려보냅니다. 동의를 거부하면 `redirectUri?error=access_denied&error_description=...&state=...`로 돌려보냅니다.
3. 콜백 페이지에서 `handleOAuthCallback()`으로 state를 검증하고, 저장해 둔 `code_verifier`와 `nonce`를 꺼냅니다.
4. 앱의 **백엔드**가 `code`와 `code_verifier`로 토큰을 발급받습니다. ([토큰 교환](#토큰-교환-pkce) 참고)

## 사용 방법

### 1. Provider 설정

```tsx
import { OAuthProvider } from '@themoment-team/datagsm-oauth-react';

const APP_ID = 'datagsm-application-id';

export function App() {
  return (
    <OAuthProvider
      clientId="your-client-id"
      redirectUri="https://your-app.com/oauth/callback"
      scope={[`${APP_ID}:account_read`, `${APP_ID}:student_read`, 'openid']}
    >
      <Routes />
    </OAuthProvider>
  );
}
```

| 옵션               | 타입                   | 기본값                                   | 설명                                                                                                |
| ------------------ | ---------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `clientId`         | `string`               | (필수)                                   | DataGSM에 등록한 클라이언트 ID                                                                      |
| `redirectUri`      | `string`               | (필수)                                   | 클라이언트에 등록한 redirect URI 중 하나. 정확히 일치해야 합니다.                                   |
| `authMode`         | `'PKCE' \| 'STANDARD'` | `'PKCE'`                                 | 인가 코드 흐름 방식. `STANDARD`는 client_secret을 보관하는 백엔드가 code를 교환할 때만 사용하세요.  |
| `scope`            | `string[]`             | 생략 시 서버 기본값                      | 요청할 scope 목록 ([scope](#scope) 참고)                                                            |
| `useNonce`         | `boolean`              | `true`                                   | `openid` scope를 요청할 때 nonce를 만들어 함께 보냅니다.                                            |
| `issuer`           | `string`               | `https://oauth.authorization.datagsm.kr` | 인가 서버 주소. `${issuer}/v1/oauth/authorize`로 이동합니다. 로컬·스테이지 서버를 쓸 때 지정합니다. |
| `authorizationUrl` | `string`               | -                                        | authorize 엔드포인트 전체 주소. `issuer`보다 우선합니다.                                            |

### 2. 로그인 버튼

```tsx
import { OAuthLoginButton, useOAuth } from '@themoment-team/datagsm-oauth-react';

export function LoginPage() {
  return <OAuthLoginButton onError={() => alert('로그인을 시작하지 못했습니다.')} />;
}

// 직접 버튼을 만들 때
export function CustomLoginButton() {
  const { login } = useOAuth();
  return <button onClick={() => login().catch(console.error)}>DataGSM으로 로그인</button>;
}
```

### 3. 콜백 처리

`handleOAuthCallback()`은 현재 URL에서 `code`, `state`, `error`를 읽고 state를 검증한 뒤, 저장해 둔 `code_verifier`와 `nonce`를 돌려줍니다. 저장값은 성공과 실패에 관계없이 지웁니다. 같은 URL을 다시 처리하면 첫 결과를 그대로 돌려주므로 React StrictMode에서 effect가 두 번 실행돼도 안전합니다.

```tsx
import { useEffect, useState } from 'react';
import { handleOAuthCallback } from '@themoment-team/datagsm-oauth-react';

export function OAuthCallbackPage() {
  const [message, setMessage] = useState('로그인 처리 중...');

  useEffect(() => {
    const result = handleOAuthCallback();

    if (!result.ok) {
      if (result.error === 'access_denied') {
        setMessage('권한 요청을 거부했습니다.');
      } else if (result.error === 'invalid_state') {
        setMessage('잘못된 로그인 요청입니다. 다시 시도해 주세요.');
      } else {
        setMessage(result.errorDescription ?? '로그인에 실패했습니다.');
      }
      return;
    }

    // code와 code_verifier를 앱 백엔드로 보내 토큰을 발급받습니다.
    fetch('/api/auth/datagsm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: result.code,
        codeVerifier: result.codeVerifier,
        nonce: result.nonce,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('token exchange failed');
        setMessage('로그인되었습니다.');
      })
      .catch(() => setMessage('로그인에 실패했습니다.'));
  }, []);

  return <p>{message}</p>;
}
```

결과 타입은 `ok`로 구분합니다.

| 필드        | 설명                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `ok: true`  | `code`, `state`, `codeVerifier`(STANDARD 모드면 `null`), `nonce`(openid를 요청하지 않았으면 `null`)     |
| `ok: false` | `error`, `errorDescription`                                                                             |
| `error`     | `invalid_state`(state 불일치 또는 저장값 없음), `missing_code`, 또는 서버가 보낸 값(`access_denied` 등) |

state 검증만 따로 하려면 `verifyState(receivedState)`를, 저장값을 직접 지우려면 `clearAuthorizationRequest()`를 사용하세요.

### 토큰 교환 (PKCE)

PKCE로 발급된 code는 `client_secret` 없이 `code_verifier`만으로 교환할 수 있습니다. 다만 DataGSM 인가 서버의 CORS 허용 출처는 DataGSM 자체 프론트엔드로 제한되어 있어 **외부 서비스의 브라우저에서 `/v1/oauth/token`을 직접 호출할 수 없습니다.** 그래서 이 SDK는 토큰 교환 함수를 제공하지 않습니다. 콜백에서 얻은 `code`와 `codeVerifier`를 앱의 백엔드로 보내고, 백엔드가 아래처럼 교환하세요.

```ts
// 앱 백엔드 (예: Node.js)
const response = await fetch('https://oauth.authorization.datagsm.kr/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    client_id: 'your-client-id',
    code,
    redirect_uri: 'https://your-app.com/oauth/callback', // authorize 요청과 같은 값
    code_verifier: codeVerifier,
    // scope: ['datagsm-application-id:account_read'], // 선택. 배열이며, 인가된 범위 안에서 줄일 때만 사용
  }),
});

if (!response.ok) {
  // 실패 응답은 { "error": "invalid_grant", "error_description": "..." } 형식입니다.
  throw new Error(`token exchange failed: ${response.status}`);
}

// 응답은 envelope 없이 바로 토큰 객체입니다.
const token: {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number; // 초
  refresh_token: string | null;
  scope: string; // 공백으로 구분된 문자열
  id_token?: string | null; // openid scope를 요청했을 때만
} = await response.json();
```

- 요청 본문은 JSON이며 `scope`는 **배열**입니다(authorize 요청의 scope는 공백 구분 문자열).
- `openid`를 요청했다면 `id_token`의 서명을 `/v1/oauth/jwks`로 검증한 뒤, `nonce` 클레임이 콜백에서 받은 `nonce`와 같은지 확인하세요.
- `STANDARD` 모드로 받은 code는 `client_secret`이 반드시 필요합니다.

### scope

scope는 `{appId}:{scopeName}` 형식입니다. 요청한 scope는 클라이언트에 허용된 범위 안에 있어야 합니다.

| scope                  | 설명                             |
| ---------------------- | -------------------------------- |
| `{appId}:account_read` | 계정 정보 조회                   |
| `{appId}:student_read` | 학생 정보 조회                   |
| `{appId}:club_read`    | 동아리 정보 조회                 |
| `{appId}:project_read` | 프로젝트 정보 조회               |
| `openid`               | id_token 발급 요청 (접두어 없음) |

- `scope`를 생략하면 서버가 `{appId}:account_read`, `{appId}:student_read`를 기본으로 부여합니다.
- `club_read`, `project_read`는 명시적으로 요청해야 합니다.
- `openid`만 요청해도 기본 scope가 함께 부여됩니다.

## 2.0.0 마이그레이션

- **기본 `authMode`가 `STANDARD`에서 `PKCE`로 바뀌었습니다.** 기존처럼 백엔드가 `client_secret`으로 code를 교환한다면 `authMode="STANDARD"`를 명시하세요. PKCE로 바꾸면 토큰 요청에 `code_verifier`를 함께 보내야 합니다.
- 모든 authorize 요청에 `state`가 붙습니다. 콜백 페이지에서 `handleOAuthCallback()` 또는 `verifyState()`로 검증하세요.
- `useOAuth()`의 `getCodeVerifier()`, `clearVerifier()`는 그대로 사용할 수 있습니다. 새 코드에서는 `handleOAuthCallback()` 결과의 `codeVerifier`를 사용하는 것을 권장합니다.

자세한 사용법은 [기술문서](https://docs.datagsm.kr/oauth/sdk/react)를 참고하십시오.
