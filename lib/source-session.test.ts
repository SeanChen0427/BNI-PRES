import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SOURCE_SESSION_KEY,
  clearSourceSession,
  readSourceSession,
  saveSourceSession,
  type SourceSession,
} from './source-session.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

const session: SourceSession = {
  kind: 'shared',
  accessToken: 'access-token-for-test',
  refreshToken: 'refresh-token-for-test',
  expiresAt: 2_000_000_000_000,
};

void test('共用工作台登入會保存於目前裝置並清除舊分頁暫存', () => {
  const persistent = memoryStorage();
  const legacy = memoryStorage({ [SOURCE_SESSION_KEY]: 'old-value' });

  saveSourceSession(session, persistent, legacy);

  assert.deepEqual(readSourceSession(persistent, legacy), session);
  assert.equal(legacy.getItem(SOURCE_SESSION_KEY), null);
});

void test('沒有 kind 的舊來源 session 仍可讀取', () => {
  const persistent = memoryStorage({
    [SOURCE_SESSION_KEY]: JSON.stringify({
      accessToken: 'legacy-access',
      refreshToken: 'legacy-refresh',
      expiresAt: 2_000_000_000_000,
    }),
  });

  assert.equal(readSourceSession(persistent, memoryStorage())?.kind, 'source');
});

void test('舊版分頁登入會自動搬到裝置儲存', () => {
  const persistent = memoryStorage();
  const legacy = memoryStorage({
    [SOURCE_SESSION_KEY]: JSON.stringify(session),
  });

  assert.deepEqual(readSourceSession(persistent, legacy), session);
  assert.equal(persistent.getItem(SOURCE_SESSION_KEY), JSON.stringify(session));
  assert.equal(legacy.getItem(SOURCE_SESSION_KEY), null);
});

void test('登出會同時清除裝置與舊分頁登入', () => {
  const stored = JSON.stringify(session);
  const persistent = memoryStorage({ [SOURCE_SESSION_KEY]: stored });
  const legacy = memoryStorage({ [SOURCE_SESSION_KEY]: stored });

  clearSourceSession(persistent, legacy);

  assert.equal(readSourceSession(persistent, legacy), null);
});
