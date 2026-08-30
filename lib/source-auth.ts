const SOURCE_ACCOUNT_EMAILS = Object.freeze({
  admin: 'fulian0857+admin@gmail.com',
  vice: 'fulian0857+vp@gmail.com',
  fulian: 'fulian0857+committee@gmail.com',
});

type SourceErrorPayload = {
  error?: unknown;
  error_code?: unknown;
  error_description?: unknown;
  message?: unknown;
  msg?: unknown;
};

function textField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveSourceAccountEmail(account: string): string {
  const value = account.trim();
  if (!value) throw new Error('請輸入既有共用帳號');

  const alias = value.toLocaleLowerCase('en-US');
  const mapped =
    SOURCE_ACCOUNT_EMAILS[alias as keyof typeof SOURCE_ACCOUNT_EMAILS];
  if (mapped) return mapped;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value;
  throw new Error('請輸入既有共用帳號 admin、vice 或 Fulian');
}

export function sourceResponseErrorMessage(
  data: unknown,
  status: number,
): string {
  const payload =
    data && typeof data === 'object' ? (data as SourceErrorPayload) : {};
  const errorCode = textField(payload.error_code);
  if (errorCode === 'invalid_credentials') return '帳號或密碼不正確';
  if (errorCode === 'email_address_invalid') return '帳號格式不正確';

  const message =
    textField(payload.error_description) ||
    textField(payload.msg) ||
    textField(payload.message) ||
    textField(payload.error);
  if (message === 'Invalid login credentials') return '帳號或密碼不正確';
  return message || `正式來源 HTTP ${status}`;
}
