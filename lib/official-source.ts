import type {
  Member,
  OfficialCoreRoster,
  WorkspaceSourceMeta,
} from './leadership';

const SOURCE_SESSION_KEY = 'fulian.leadership-team.official-source.v1';

const SOURCE_CONFIG = Object.freeze({
  url: 'https://fahrblkukuhgveiptufn.supabase.co',
  publishableKey: 'sb_publishable_f5U5bDJjXjvRxYSzh7zqGQ__lF-jwPZ',
});

const SOURCE_ACCOUNTS = Object.freeze({
  admin: {
    email: 'fulian0857+admin@gmail.com',
    role: 'admin',
    label: 'Admin',
  },
  vice: {
    email: 'fulian0857+vp@gmail.com',
    role: 'vp',
    label: '副主席',
  },
  Fulian: {
    email: 'fulian0857+committee@gmail.com',
    role: 'committee',
    label: '會員委員',
  },
});

export type OfficialSourceAccount = keyof typeof SOURCE_ACCOUNTS;

type SourceSession = {
  account: OfficialSourceAccount;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type AuthToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string };
};

type MemberRow = {
  id: string;
  profession: string | null;
  membership_expires_on: string | null;
  updated_at: string | null;
  people: { display_name: string; status: string } | null;
};

type SnapshotRow = {
  schema_version: string;
  analysis_version: string;
  period_end: string;
  generated_at: string;
  source_version: string;
  source_fingerprint: string | null;
  member_count: number;
  reconciliation: Record<string, unknown>;
};

export type OfficialSourceResult = {
  members: Member[];
  roster: OfficialCoreRoster;
  sourceMeta: WorkspaceSourceMeta;
};

class SourceRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function headers(accessToken?: string): HeadersInit {
  return {
    apikey: SOURCE_CONFIG.publishableKey,
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function sourceJson<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${SOURCE_CONFIG.url}${path}`, {
    ...options,
    headers: { ...headers(accessToken), ...(options.headers ?? {}) },
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error_description?: string;
  };
  if (!response.ok) {
    throw new SourceRequestError(
      data.error_description ||
        data.message ||
        `正式來源 HTTP ${response.status}`,
      response.status,
    );
  }
  return data;
}

function saveSession(session: SourceSession) {
  window.sessionStorage.setItem(SOURCE_SESSION_KEY, JSON.stringify(session));
}

function readSession(): SourceSession | null {
  try {
    const session = JSON.parse(
      window.sessionStorage.getItem(SOURCE_SESSION_KEY) || 'null',
    ) as SourceSession | null;
    return session?.accessToken && session.refreshToken ? session : null;
  } catch {
    return null;
  }
}

export function hasOfficialSourceSession(): boolean {
  return Boolean(readSession());
}

function sessionFromToken(
  account: OfficialSourceAccount,
  token: AuthToken,
): SourceSession {
  return {
    account,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
  };
}

async function refreshSession(session: SourceSession): Promise<SourceSession> {
  const token = await sourceJson<AuthToken>(
    '/auth/v1/token?grant_type=refresh_token',
    {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    },
  );
  const refreshed = sessionFromToken(session.account, token);
  saveSession(refreshed);
  return refreshed;
}

async function currentSession(): Promise<SourceSession | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() > 30_000) return session;
  try {
    return await refreshSession(session);
  } catch {
    window.sessionStorage.removeItem(SOURCE_SESSION_KEY);
    return null;
  }
}

async function verifyAccount(
  session: SourceSession,
  userId: string,
): Promise<void> {
  const rows = await sourceJson<
    Array<{ role: string; label: string; enabled: boolean }>
  >(
    `/rest/v1/app_accounts?auth_user_id=eq.${encodeURIComponent(userId)}&select=role,label,enabled`,
    {},
    session.accessToken,
  );
  const account = rows[0];
  if (!account?.enabled) throw new Error('此正式來源帳號目前未啟用');
  if (account.role !== SOURCE_ACCOUNTS[session.account].role) {
    throw new Error('正式來源帳號角色設定不一致');
  }
}

async function loadRoster(): Promise<OfficialCoreRoster> {
  const response = await fetch('/api/formal-core-roster', {
    cache: 'no-store',
  });
  const data = (await response
    .json()
    .catch(() => ({}))) as OfficialCoreRoster & {
    message?: string;
  };
  if (!response.ok) throw new Error(data.message || '無法讀取第 11 屆 8 長');
  return data;
}

async function loadData(session: SourceSession): Promise<OfficialSourceResult> {
  const memberPath =
    '/rest/v1/members?status=eq.active&select=id,profession,membership_expires_on,updated_at,people!inner(display_name,status)&people.status=eq.active&order=created_at.asc';
  const snapshotPath =
    '/rest/v1/analysis_snapshots?is_published=eq.true&select=schema_version,analysis_version,period_end,generated_at,source_version,source_fingerprint,member_count,reconciliation&order=period_end.desc,generated_at.desc&limit=1';
  const [memberRows, snapshotRows, roster] = await Promise.all([
    sourceJson<MemberRow[]>(memberPath, {}, session.accessToken),
    sourceJson<SnapshotRow[]>(snapshotPath, {}, session.accessToken),
    loadRoster(),
  ]);

  const members: Member[] = memberRows
    .filter((row) => row.id && row.people?.display_name)
    .map((row) => ({
      id: row.id,
      name: row.people!.display_name,
      profession: row.profession || '專業別待確認',
      expiryDate: row.membership_expires_on || '',
      status: 'active',
      source: 'official-read-only',
    }));
  if (!members.length) throw new Error('正式會員主檔目前沒有可讀取的現任會員');

  const snapshot = snapshotRows[0] ?? null;
  const snapshotCount = snapshot?.member_count ?? null;
  const masterUpdatedAt = memberRows
    .map((row) => row.updated_at || '')
    .sort()
    .at(-1);
  const reconciliation = snapshot
    ? snapshotCount === members.length
      ? 'matched'
      : 'mismatch'
    : 'unavailable';

  return {
    members,
    roster,
    sourceMeta: {
      mode: 'official',
      adapter: 'supabase-members-read-only',
      loadedAt: new Date().toISOString(),
      memberCount: members.length,
      missingExpiryCount: members.filter((member) => !member.expiryDate).length,
      memberMasterUpdatedAt: masterUpdatedAt || null,
      snapshotPeriodEnd: snapshot?.period_end ?? null,
      snapshotGeneratedAt: snapshot?.generated_at ?? null,
      snapshotFingerprint: snapshot?.source_fingerprint ?? null,
      snapshotMemberCount: snapshotCount,
      reconciliation,
      coreRosterExpected: 0,
      coreRosterMatched: 0,
    },
  };
}

export async function loginAndLoadOfficialSource(
  account: OfficialSourceAccount,
  password: string,
): Promise<OfficialSourceResult> {
  const expected = SOURCE_ACCOUNTS[account];
  if (!password) throw new Error('請輸入正式副主席系統密碼');
  const token = await sourceJson<AuthToken>(
    '/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      body: JSON.stringify({ email: expected.email, password }),
    },
  );
  const session = sessionFromToken(account, token);
  await verifyAccount(session, token.user.id);
  saveSession(session);
  return loadData(session);
}

export async function restoreAndLoadOfficialSource(): Promise<OfficialSourceResult | null> {
  const session = await currentSession();
  if (!session) return null;
  try {
    return await loadData(session);
  } catch (error) {
    if (error instanceof SourceRequestError && error.status === 401) {
      window.sessionStorage.removeItem(SOURCE_SESSION_KEY);
      return null;
    }
    throw error;
  }
}

export const OFFICIAL_SOURCE_ACCOUNT_OPTIONS = Object.entries(
  SOURCE_ACCOUNTS,
).map(([value, item]) => ({
  value: value as OfficialSourceAccount,
  label: item.label,
}));
