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

## 어떤 방식을 쓸지

DataGSM 토큰 엔드포인트는 외부 서비스의 브라우저 요청을 받지 않으므로, 토큰 교환은 항상 서버에서 해야 합니다.

| 상황                                               | 사용할 API                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| 토큰을 교환하는 백엔드(Spring 등)가 따로 있다      | `OAuthProvider`와 `handleOAuthCallback()` ([사용 방법](#사용-방법)) |
| Next.js(App Router) 하나로 프론트와 서버를 다 한다 | `@themoment-team/datagsm-oauth-react/next` ([Next.js](#nextjs))     |

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

`handleOAuthCallback()`은 현재 URL에서 `code`, `state`, `error`를 읽고 state를 검증한 뒤, 저장해 둔 `code_verifier`와 `nonce`를 돌려줍니다. 저장값은 성공과 실패에 관계없이 지웁니다.

콜백은 **한 번만 소비됩니다.** 같은 URL을 다시 처리하면 `already_handled`를 돌려주므로, React StrictMode에서 effect가 두 번 실행되거나 뒤로 가기로 콜백 URL에 돌아와도 이미 쓴 code로 토큰 교환을 다시 시도하지 않습니다. `already_handled`는 무시하면 되고, 처리한 뒤에는 `history.replaceState`로 주소창의 code를 지우는 것을 권장합니다.

```tsx
import { useEffect, useState } from 'react';
import { handleOAuthCallback } from '@themoment-team/datagsm-oauth-react';

export function OAuthCallbackPage() {
  const [message, setMessage] = useState('로그인 처리 중...');

  useEffect(() => {
    const result = handleOAuthCallback();

    if (!result.ok) {
      // 이미 처리한 콜백(StrictMode 재실행, 뒤로 가기)이면 첫 처리 결과를 그대로 둡니다.
      if (result.error === 'already_handled') return;

      if (result.error === 'access_denied') {
        setMessage('권한 요청을 거부했습니다.');
      } else if (result.error === 'invalid_state') {
        setMessage('잘못된 로그인 요청입니다. 다시 시도해 주세요.');
      } else {
        setMessage(result.errorDescription ?? '로그인에 실패했습니다.');
      }
      return;
    }

    // code가 주소창과 방문 기록에 남지 않도록 지웁니다.
    window.history.replaceState(null, '', window.location.pathname);

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

`redirectUri`가 앱 루트처럼 콜백이 아닌 방문도 받는 주소라면, OAuth 파라미터가 없는 URL에서는 `not_callback`이 나오고 저장값은 그대로 남습니다. URL 인자로 `location.search`나 `/callback?code=...` 같은 상대 URL도 넘길 수 있습니다.

결과 타입은 `ok`로 구분합니다.

| 필드        | 설명                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `ok: true`  | `code`, `state`, `codeVerifier`(STANDARD 모드면 `null`), `nonce`(openid를 요청하지 않았으면 `null`) |
| `ok: false` | `error`, `errorDescription`                                                                         |
| `error`     | 아래 표 참고                                                                                        |

| `error`           | 의미                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `not_callback`    | URL에 `code`, `state`, `error`가 없음. 콜백이 아닌 방문이며 저장값을 유지 |
| `already_handled` | 이미 처리한 콜백 URL. 무시하면 됨                                         |
| `invalid_state`   | state 불일치 또는 저장값 없음 (CSRF 의심)                                 |
| `missing_code`    | 오류도 code도 없는 콜백                                                   |
| 그 밖의 값        | 서버가 보낸 값 그대로 (`access_denied` 등)                                |

state 검증만 따로 하려면 `verifyState(receivedState)`를 사용하세요. 검증한 state는 결과와 관계없이 지워지므로 한 번만 쓸 수 있습니다. 저장값을 직접 지우려면 `clearAuthorizationRequest()`를 사용하세요.

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

## Next.js

Next.js 14 이상의 App Router에서 로그인, 콜백, 세션, 로그아웃을 서버가 처리합니다. 토큰 교환과 사용자 정보 조회는 서버에서만 일어나고, 브라우저에는 암호화된 세션 쿠키만 남습니다. 전체 예제는 [`examples/next-app`](./examples/next-app)에 있습니다.

### 1. 환경 변수

```bash
DATAGSM_CLIENT_ID=your-client-id
DATAGSM_CLIENT_SECRET=your-client-secret # 선택. 로그인은 항상 PKCE를 씁니다.
DATAGSM_SESSION_SECRET=                  # 32자 이상. 예: openssl rand -base64 32
DATAGSM_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

`DATAGSM_REDIRECT_URI`를 DataGSM 클라이언트의 리다이렉트 URL에 등록하세요. 경로는 `{basePath}/callback`(기본값 `/api/auth/callback`)이어야 합니다.

### 2. 설정과 Route Handler

```ts
// lib/datagsm.ts
import { createDataGsmAuth } from '@themoment-team/datagsm-oauth-react/next';

export const auth = createDataGsmAuth({
  clientId: process.env.DATAGSM_CLIENT_ID!,
  clientSecret: process.env.DATAGSM_CLIENT_SECRET,
  sessionSecret: process.env.DATAGSM_SESSION_SECRET!,
  redirectUri: process.env.DATAGSM_REDIRECT_URI!,
});
```

```ts
// app/api/auth/[...datagsm]/route.ts
import { auth } from '@/lib/datagsm';

export const { GET, POST } = auth.handlers;
```

설정은 첫 요청 때 검사합니다. 그래서 환경 변수가 없는 `next build` 단계에서도 빌드가 깨지지 않습니다.

### 3. 로그인한 사용자 읽기

```tsx
// 서버 컴포넌트, Route Handler, Server Action
import { auth } from '@/lib/datagsm';

export default async function Page() {
  const user = await auth.getUser(); // DataGsmUser | null
  if (!user) return <a href="/api/auth/login?returnTo=/dashboard">DataGSM으로 로그인</a>;
  return <p>{user.student?.name ?? user.email}님, 안녕하세요.</p>;
}
```

```tsx
// 클라이언트 컴포넌트
'use client';
import { useUser } from '@themoment-team/datagsm-oauth-react';

export function UserMenu() {
  const { user, status, login, logout } = useUser();
  if (status === 'loading') return null;
  if (!user) return <button onClick={() => login()}>로그인</button>;
  return <button onClick={() => logout()}>{user.email} 로그아웃</button>;
}
```

`useUser()`는 마운트할 때 `/api/auth/session`을 한 번 호출합니다. `login(returnTo?)`은 로그인 뒤 돌아올 경로(기본값: 현재 주소)를 받고, `logout()`은 세션 쿠키를 지웁니다. 로그아웃 뒤 서버 컴포넌트까지 갱신하려면 `router.refresh()`를 호출하세요.

### 라우트

| 경로                                 | 설명                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `GET /api/auth/login?returnTo=/path` | state와 PKCE 값을 10분짜리 암호화 쿠키에 담고 DataGSM으로 보냅니다. `returnTo`는 같은 출처 경로만 받습니다. |
| `GET /api/auth/callback`             | state를 검증하고 토큰 교환, 사용자 정보 조회를 거쳐 세션 쿠키를 만든 뒤 `returnTo`로 보냅니다.              |
| `GET /api/auth/session`              | `{ user }`를 JSON으로 돌려줍니다. 토큰은 내보내지 않습니다.                                                 |
| `POST /api/auth/logout`              | 세션 쿠키를 지웁니다. 같은 출처(`Origin`)의 요청만 받습니다.                                                |

로그인에 실패하면 `errorPath`(기본값 `/`)에 `?error=코드`를 붙여 보냅니다. 코드는 `invalid_state`(state 불일치, 로그인 요청 쿠키 없음·만료), `missing_code`, `invalid_grant` 같은 DataGSM 오류 코드, 네트워크 오류일 때 `server_error`입니다.

### 옵션

| 옵션            | 기본값                                       | 설명                                                       |
| --------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `clientId`      | (필수)                                       | DataGSM 클라이언트 ID                                      |
| `redirectUri`   | (필수)                                       | 등록한 리다이렉트 URL. 이 값의 origin을 앱 주소로 씁니다.  |
| `sessionSecret` | (필수)                                       | 쿠키 암호화 키를 만드는 32자 이상의 비밀값                 |
| `clientSecret`  | -                                            | 넣으면 토큰 요청에 함께 보냅니다.                          |
| `scope`         | 서버 기본값                                  | 요청할 scope 목록                                          |
| `basePath`      | `/api/auth`                                  | 인증 라우트 경로. `useUser({ basePath })`도 같게 맞추세요. |
| `sessionMaxAge` | 7일                                          | 세션 쿠키 수명(초)                                         |
| `errorPath`     | `/`                                          | 로그인 실패 시 이동할 같은 출처 경로                       |
| `issuer`        | `https://oauth.authorization.datagsm.kr`     | 스테이지·로컬 인가 서버를 쓸 때 지정합니다.                |
| `userInfoUrl`   | `https://oauth.resource.datagsm.kr/userinfo` | 스테이지·로컬 사용자 정보 서버를 쓸 때 지정합니다.         |

### 알아 둘 점

- 세션에는 **로그인 시점의 사용자 정보**만 담깁니다. DataGSM 토큰은 보관하지 않고, 페이지마다 DataGSM을 호출하지도 않습니다. 사용자 정보가 바뀌면 다시 로그인해야 반영됩니다.
- 로그아웃은 이 앱의 세션 쿠키만 지웁니다. DataGSM 쪽 로그인 상태는 남아 있어서, 다시 로그인하면 비밀번호 없이 들어갈 수 있습니다.
- 세션이 쿠키 하나의 한도(약 4KB)를 넘으면 여러 쿠키로 나눠 담습니다.
- Next.js가 아닌 서버에서는 `@themoment-team/datagsm-oauth-react/server`를 쓰세요. `createAuthHandler(config)`는 웹 표준 `Request`를 받아 `Response`를 돌려주고, `readSession(cookieHeader, { sessionSecret })`로 사용자를 읽습니다.

## 2.0.0 마이그레이션

- **기본 `authMode`가 `STANDARD`에서 `PKCE`로 바뀌었습니다.** 기존처럼 백엔드가 `client_secret`으로 code를 교환한다면 `authMode="STANDARD"`를 명시하세요. PKCE로 바꾸면 토큰 요청에 `code_verifier`를 함께 보내야 합니다.
- **PKCE는 HTTPS 또는 localhost에서만 동작합니다.** challenge를 만드는 Web Crypto(`crypto.subtle`)는 보안 컨텍스트에서만 제공되므로, `http://192.168.x.x:5173` 같은 HTTP 개발 서버나 HTTP 배포에서는 `login()`이 실패합니다. 이런 환경이라면 HTTPS로 바꾸거나 `authMode="STANDARD"`를 명시하세요.
- 모든 authorize 요청에 `state`가 붙고, 모드와 관계없이 `sessionStorage`에 저장합니다. 사이트 데이터를 차단한 브라우저나 스토리지가 막힌 서드파티 iframe에서는 `login()`이 실패하며, 이때 중간까지 저장한 값은 지워집니다.
- 콜백 페이지에서는 `handleOAuthCallback()`으로 state 검증과 저장값 정리를 한 번에 처리하는 것을 권장합니다. `getCodeVerifier()`, `clearVerifier()`는 그대로 쓸 수 있지만, 이 조합을 쓴다면 `verifyState()`로 state를 함께 검증하세요(검증한 state는 지워집니다).

자세한 사용법은 [기술문서](https://docs.datagsm.kr/oauth/sdk/react)를 참고하십시오.
