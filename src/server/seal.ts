import { EncryptJWT, jwtDecrypt, type JWTPayload } from 'jose';

/**
 * 쿠키 용도별로 다른 키를 쓴다. 그래야 로그인 요청 쿠키를 세션 쿠키 자리에 넣는 식의 바꿔치기가 통하지 않는다.
 */
export type SealPurpose = 'session' | 'authorize';

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<Uint8Array>>();

async function deriveKey(secret: string, purpose: SealPurpose): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('datagsm-oauth-react'),
      info: encoder.encode(`datagsm-oauth-react:${purpose}`),
    },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

function getKey(secret: string, purpose: SealPurpose): Promise<Uint8Array> {
  const cacheKey = `${purpose}:${secret}`;
  let key = keyCache.get(cacheKey);
  if (!key) {
    key = deriveKey(secret, purpose);
    keyCache.set(cacheKey, key);
  }
  return key;
}

/** payload를 A256GCM으로 암호화한 JWE 문자열을 만듭니다. maxAge(초)가 지나면 열 수 없습니다. */
export async function seal(
  payload: JWTPayload,
  secret: string,
  purpose: SealPurpose,
  maxAge: number,
): Promise<string> {
  const key = await getKey(secret, purpose);
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .encrypt(key);
}

/** seal로 만든 값을 엽니다. 변조됐거나 만료됐거나 다른 용도의 값이면 null입니다. */
export async function unseal<T extends JWTPayload>(
  token: string,
  secret: string,
  purpose: SealPurpose,
): Promise<T | null> {
  try {
    const key = await getKey(secret, purpose);
    const { payload } = await jwtDecrypt(token, key, {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    });
    return payload as T;
  } catch {
    return null;
  }
}
