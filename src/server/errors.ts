/**
 * DataGSM 서버가 돌려준 오류입니다.
 * - OAuth 오류(`{ error, error_description }`)는 `error`가 `invalid_grant` 같은 값입니다.
 * - 그 밖의 오류(`{ status, code, message }`)는 `error`가 `UNAUTHORIZED`, `TOO_MANY_REQUESTS` 같은 값입니다.
 * - 본문을 해석할 수 없으면 `error`는 `http_error`입니다.
 */
export class DataGsmOAuthError extends Error {
  readonly error: string;
  readonly errorDescription: string | null;
  readonly status: number;

  constructor(error: string, errorDescription: string | null, status: number) {
    super(
      `DataGSM request failed (${status}): ${error}${errorDescription ? ` - ${errorDescription}` : ''}`,
    );
    this.name = 'DataGsmOAuthError';
    this.error = error;
    this.errorDescription = errorDescription;
    this.status = status;
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// 서버는 `401 UNAUTHORIZED`처럼 상태 코드를 앞에 붙여 보내기도 한다.
function statusName(value: unknown): string | null {
  const status = stringOrNull(value);
  return status ? status.replace(/^\d{3}\s+/, '') : null;
}

export async function toDataGsmOAuthError(response: Response): Promise<DataGsmOAuthError> {
  const text = await response.text().catch(() => '');

  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // JSON이 아니면 상태 코드만 남긴다.
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const oauthError = stringOrNull(record.error);
    if (oauthError) {
      return new DataGsmOAuthError(
        oauthError,
        stringOrNull(record.error_description),
        response.status,
      );
    }

    const status = statusName(record.status);
    const message = stringOrNull(record.message);
    if (status || message) {
      return new DataGsmOAuthError(status ?? 'http_error', message, response.status);
    }
  }

  return new DataGsmOAuthError('http_error', null, response.status);
}
