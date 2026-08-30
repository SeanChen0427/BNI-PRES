import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveSourceAccountEmail,
  sourceResponseErrorMessage,
} from './source-auth.ts';

void test('既有共用帳號會轉成來源 Auth Email', () => {
  assert.equal(resolveSourceAccountEmail('vice'), 'fulian0857+vp@gmail.com');
  assert.equal(
    resolveSourceAccountEmail(' Fulian '),
    'fulian0857+committee@gmail.com',
  );
  assert.equal(
    resolveSourceAccountEmail('ADMIN'),
    'fulian0857+admin@gmail.com',
  );
});

void test('仍接受完整 Email，並在送出前拒絕未知帳號', () => {
  assert.equal(
    resolveSourceAccountEmail('person@example.com'),
    'person@example.com',
  );
  assert.throws(
    () => resolveSourceAccountEmail('unknown-account'),
    /admin、vice 或 Fulian/,
  );
});

void test('Supabase msg 與錯誤代碼會轉成可理解的中文訊息', () => {
  assert.equal(
    sourceResponseErrorMessage(
      {
        error_code: 'invalid_credentials',
        msg: 'Invalid login credentials',
      },
      400,
    ),
    '會員系統帳號或密碼不正確',
  );
  assert.equal(
    sourceResponseErrorMessage({ msg: '來源暫時不可用' }, 503),
    '來源暫時不可用',
  );
  assert.equal(sourceResponseErrorMessage({}, 418), '正式來源 HTTP 418');
});
