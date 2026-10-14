// @vitest-environment node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function dist(file: string): string {
  return readFileSync(join(ROOT, 'dist', file), 'utf-8');
}

function exportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(exportTargets);
  return [];
}

describe('build output', () => {
  beforeAll(() => {
    execSync('pnpm run build', { cwd: ROOT, stdio: 'pipe' });
  }, 120_000);

  it("브라우저 엔트리에만 'use client'를 붙인다", () => {
    for (const file of ['index.js', 'index.cjs']) {
      expect(dist(file).startsWith("'use client';")).toBe(true);
    }
    for (const file of ['server.js', 'server.cjs', 'next.js', 'next.cjs']) {
      expect(dist(file)).not.toMatch(/["']use client["']/);
    }
  });

  it('package.json exports가 가리키는 파일이 모두 있다', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
      exports: Record<string, unknown>;
    };

    expect(Object.keys(pkg.exports)).toEqual(['.', './server', './next']);
    for (const target of exportTargets(pkg.exports)) {
      expect(existsSync(join(ROOT, target)), target).toBe(true);
    }
  });

  it('브라우저 번들에 서버 코드가 섞이지 않는다', () => {
    for (const file of ['index.js', 'index.cjs']) {
      expect(dist(file)).not.toContain('jose');
      expect(dist(file)).not.toContain('client_secret');
    }
  });

  it('jose와 next는 번들하지 않고 불러온다', () => {
    expect(dist('server.js')).toMatch(/from\s*["']jose["']/);
    expect(dist('next.js')).toMatch(/from\s*["']next\/headers["']/);
    expect(dist('server.js')).not.toMatch(/from\s*["']react["']/);
  });
});
