export const SOURCE_SESSION_KEY = 'fulian.leadership-team.official-source.v1';

export type SourceSession = {
  kind: 'shared' | 'source';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function parseSession(raw: string | null): SourceSession | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Partial<SourceSession> | null;
    const expiresAt = Number(session?.expiresAt);
    if (
      !session?.accessToken ||
      !session.refreshToken ||
      !Number.isFinite(expiresAt)
    ) {
      return null;
    }
    return {
      kind: session.kind === 'shared' ? 'shared' : 'source',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt,
    };
  } catch {
    return null;
  }
}

function safelyRead(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safelyRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Browser storage may be unavailable; the other storage remains usable.
  }
}

export function saveSourceSession(
  session: SourceSession,
  persistentStorage: StorageLike = window.localStorage,
  legacySessionStorage: StorageLike = window.sessionStorage,
): void {
  const serialized = JSON.stringify(session);
  try {
    persistentStorage.setItem(SOURCE_SESSION_KEY, serialized);
    safelyRemove(legacySessionStorage, SOURCE_SESSION_KEY);
  } catch {
    legacySessionStorage.setItem(SOURCE_SESSION_KEY, serialized);
  }
}

export function readSourceSession(
  persistentStorage: StorageLike = window.localStorage,
  legacySessionStorage: StorageLike = window.sessionStorage,
): SourceSession | null {
  const persistent = parseSession(
    safelyRead(persistentStorage, SOURCE_SESSION_KEY),
  );
  if (persistent) return persistent;

  const legacy = parseSession(
    safelyRead(legacySessionStorage, SOURCE_SESSION_KEY),
  );
  if (!legacy) return null;

  saveSourceSession(legacy, persistentStorage, legacySessionStorage);
  return legacy;
}

export function clearSourceSession(
  persistentStorage: StorageLike = window.localStorage,
  legacySessionStorage: StorageLike = window.sessionStorage,
): void {
  safelyRemove(persistentStorage, SOURCE_SESSION_KEY);
  safelyRemove(legacySessionStorage, SOURCE_SESSION_KEY);
}
