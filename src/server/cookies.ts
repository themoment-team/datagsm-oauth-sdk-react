export interface CookieEntry {
  name: string;
  value: string;
}

/** 쿠키 헤더 문자열이나 `{ name, value }` 목록(Next.js의 `cookies().getAll()` 등)입니다. */
export type CookieSource = string | null | undefined | Iterable<CookieEntry>;

// 브라우저의 쿠키 하나 한도는 이름과 값을 합쳐 약 4096바이트다. 이름과 속성 몫을 남긴다.
export const COOKIE_CHUNK_SIZE = 3800;

export function toCookieMap(source: CookieSource): Map<string, string> {
  const map = new Map<string, string>();
  if (!source) return map;

  if (typeof source === 'string') {
    for (const part of source.split(';')) {
      const index = part.indexOf('=');
      if (index === -1) continue;
      const name = part.slice(0, index).trim();
      if (name && !map.has(name)) map.set(name, part.slice(index + 1).trim());
    }
    return map;
  }

  for (const { name, value } of source) map.set(name, value);
  return map;
}

function chunkName(name: string, index: number): string {
  return `${name}.${index}`;
}

function existingChunkIndexes(cookies: Map<string, string>, name: string): number[] {
  const prefix = `${name}.`;
  const indexes: number[] = [];
  for (const key of cookies.keys()) {
    if (!key.startsWith(prefix)) continue;
    const index = Number(key.slice(prefix.length));
    if (Number.isInteger(index) && index >= 0) indexes.push(index);
  }
  return indexes;
}

/** 나눠 담은 쿠키를 이어 붙여 읽습니다. 하나로 담겼으면 그대로 돌려줍니다. */
export function readChunkedCookie(cookies: Map<string, string>, name: string): string | null {
  const whole = cookies.get(name);
  if (whole !== undefined) return whole;

  const chunks: string[] = [];
  for (let index = 0; cookies.has(chunkName(name, index)); index++) {
    chunks.push(cookies.get(chunkName(name, index))!);
  }
  return chunks.length > 0 ? chunks.join('') : null;
}

export interface CookieAttributes {
  maxAge: number;
  secure: boolean;
}

export function serializeCookie(name: string, value: string, attributes: CookieAttributes): string {
  // Strict이면 DataGSM에서 돌아오는 요청에 쿠키가 실리지 않으므로 Lax를 쓴다.
  const parts = [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(attributes.maxAge))}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (attributes.secure) parts.push('Secure');
  return parts.join('; ');
}

export function expireCookie(name: string, secure: boolean): string {
  return serializeCookie(name, '', { maxAge: 0, secure });
}

/**
 * 값을 쿠키에 담는 Set-Cookie 목록을 만듭니다. 한도를 넘으면 `name.0`, `name.1`…로 나누고,
 * 요청에 있던 쿠키 중 이번에 쓰지 않는 조각은 지웁니다.
 */
export function setChunkedCookie(
  cookies: Map<string, string>,
  name: string,
  value: string,
  attributes: CookieAttributes,
): string[] {
  const headers: string[] = [];
  const written = new Set<string>();

  if (value.length <= COOKIE_CHUNK_SIZE) {
    headers.push(serializeCookie(name, value, attributes));
    written.add(name);
  } else {
    for (let index = 0; index * COOKIE_CHUNK_SIZE < value.length; index++) {
      const chunk = value.slice(index * COOKIE_CHUNK_SIZE, (index + 1) * COOKIE_CHUNK_SIZE);
      headers.push(serializeCookie(chunkName(name, index), chunk, attributes));
      written.add(chunkName(name, index));
    }
  }

  const candidates = [name, ...existingChunkIndexes(cookies, name).map((i) => chunkName(name, i))];
  for (const stale of candidates) {
    if (cookies.has(stale) && !written.has(stale)) {
      headers.push(expireCookie(stale, attributes.secure));
    }
  }
  return headers;
}

/** 요청에 있던 쿠키와 그 조각을 모두 지우는 Set-Cookie 목록입니다. */
export function clearChunkedCookie(
  cookies: Map<string, string>,
  name: string,
  secure: boolean,
): string[] {
  const names = existingChunkIndexes(cookies, name).map((index) => chunkName(name, index));
  if (cookies.has(name)) names.unshift(name);
  return names.map((cookieName) => expireCookie(cookieName, secure));
}
