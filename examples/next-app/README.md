# DataGSM OAuth Next.js 예제

`@themoment-team/datagsm-oauth-react/next`로 Next.js App Router에 DataGSM 로그인을 붙인 최소 예제입니다.

## 실행

```bash
# 저장소 루트에서 SDK를 먼저 빌드합니다.
pnpm install && pnpm build

cd examples/next-app
cp .env.example .env.local   # 값을 채웁니다.
pnpm install --ignore-workspace
pnpm dev
```

DataGSM 클라이언트의 리다이렉트 URL에 `http://localhost:3000/api/auth/callback`을 등록해야 합니다. SDK를 고친 뒤에는 루트에서 `pnpm build`를 다시 하고 이 폴더에서 `pnpm install --ignore-workspace`를 다시 실행하세요.

## 파일

| 파일                                 | 내용                                             |
| ------------------------------------ | ------------------------------------------------ |
| `lib/datagsm.ts`                     | `createDataGsmAuth()` 설정                       |
| `app/api/auth/[...datagsm]/route.ts` | 로그인, 콜백, 세션, 로그아웃 라우트              |
| `app/page.tsx`                       | 서버 컴포넌트에서 `auth.getUser()`로 사용자 읽기 |
| `app/user-panel.tsx`                 | 클라이언트 컴포넌트에서 `useUser()` 사용         |
