import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

// 브라우저용 엔트리에만 'use client'를 붙인다.
// server, next 엔트리에 붙으면 Next.js가 클라이언트 모듈로 취급해 서버에서 쓸 수 없다.
const CLIENT_ENTRIES = ['index'];

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server/index.ts',
    next: 'src/next/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  target: 'es2020',
  outDir: 'dist',
  external: ['react', 'next', 'jose'],
  onSuccess: async () => {
    const distDir = 'dist';
    const files = readdirSync(distDir).filter((file) =>
      CLIENT_ENTRIES.some((entry) => file === `${entry}.js` || file === `${entry}.cjs`),
    );

    files.forEach((file) => {
      const filePath = join(distDir, file);
      const content = readFileSync(filePath, 'utf-8');
      if (!content.startsWith("'use client';")) {
        writeFileSync(filePath, "'use client';\n" + content);
      }
    });
  },
});
