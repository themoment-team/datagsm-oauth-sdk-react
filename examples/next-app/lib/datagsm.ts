import { createDataGsmAuth } from '@themoment-team/datagsm-oauth-react/next';

export const auth = createDataGsmAuth({
  clientId: process.env.DATAGSM_CLIENT_ID!,
  clientSecret: process.env.DATAGSM_CLIENT_SECRET,
  sessionSecret: process.env.DATAGSM_SESSION_SECRET!,
  redirectUri: process.env.DATAGSM_REDIRECT_URI!,
  // 스테이지·로컬 DataGSM 서버를 쓸 때만 지정합니다.
  issuer: process.env.DATAGSM_ISSUER,
  userInfoUrl: process.env.DATAGSM_USERINFO_URL,
});
