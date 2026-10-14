import type { ReactNode } from 'react';

export const metadata = { title: 'DataGSM OAuth 예제' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
