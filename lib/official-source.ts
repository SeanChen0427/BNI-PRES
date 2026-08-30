import type {
  Member,
  OfficialCoreRoster,
  WorkspaceState,
  WorkspaceSourceMeta,
} from './leadership';
import {
  resolveSourceAccountEmail,
  sourceResponseErrorMessage,
} from './source-auth';
import {
  clearSourceSession,
  readSourceSession,
  saveSourceSession,
  type SourceSession,
} from './source-session';
const WORKSPACE_API_URL = String(
  import.meta.env.VITE_WORKSPACE_API_URL ||
    'https://bni-pres-api.seanchen0427.workers.dev',
).replace(/\/$/, '');
const SHARED_SESSION_EXPIRES_AT = Date.UTC(2100, 0, 1);

const SOURCE_CONFIG = Object.freeze({
  url: 'https://fahrblkukuhgveiptufn.supabase.co',
  publishableKey: 'sb_publishable_f5U5bDJjXjvRxYSzh7zqGQ__lF-jwPZ',
});

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

type SourceDirectory = {
  members: Member[];
  importMembers: Array<{
    id: string;
    name: string;
    profession: string;
    expiryDate: string;
    status: 'active';
    sourceUpdatedAt: string;
  }>;
  sourceMeta: WorkspaceSourceMeta;
};

export type OfficialSourceResult = {
  members: Member[];
  roster: OfficialCoreRoster;
  sourceMeta: WorkspaceSourceMeta;
};

export class MemberDirectoryMissingError extends Error {
  constructor() {
    super('共同工作台還沒有會員名單');
  }
}

class SourceRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function headers(accessToken?: string): Record<string, string> {
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
  const requestHeaders = new Headers(headers(accessToken));
  new Headers(options.headers).forEach((value, key) =>
    requestHeaders.set(key, value),
  );
  const response = await fetch(`${SOURCE_CONFIG.url}${path}`, {
    ...options,
    headers: requestHeaders,
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    throw new SourceRequestError(
      sourceResponseErrorMessage(data, response.status),
      response.status,
    );
  }
  return data;
}

function saveSession(session: SourceSession) {
  saveSourceSession(session);
}

function readSession(): SourceSession | null {
  return readSourceSession();
}

export function hasOfficialSourceSession(): boolean {
  return Boolean(readSession());
}

function sessionFromToken(token: AuthToken): SourceSession {
  return {
    kind: 'source',
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
  const refreshed = sessionFromToken(token);
  saveSession(refreshed);
  return refreshed;
}

async function verifySourceAccount(
  session: SourceSession,
  userId: string,
): Promise<void> {
  const rows = await sourceJson<Array<{ role: string; enabled: boolean }>>(
    `/rest/v1/app_accounts?auth_user_id=eq.${encodeURIComponent(userId)}&select=role,enabled`,
    {},
    session.accessToken,
  );
  if (!rows[0]?.enabled) throw new Error('這個會員系統帳號未啟用');
  if (!['admin', 'vp', 'committee'].includes(rows[0].role)) {
    throw new Error('這個會員系統帳號無法讀取名單');
  }
}

async function currentSession(): Promise<SourceSession | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() > 30_000) return session;
  if (session.kind === 'shared') {
    clearSourceSession();
    return null;
  }
  try {
    return await refreshSession(session);
  } catch {
    clearSourceSession();
    return null;
  }
}

async function workspaceJson<T>(
  path: string,
  session: SourceSession,
  options: RequestInit = {},
): Promise<T> {
  if (!WORKSPACE_API_URL) throw new Error('BNI-PRES D1 後台尚未設定');
  const requestHeaders = new Headers({
    Authorization: `${session.kind === 'shared' ? 'Shared' : 'Bearer'} ${session.accessToken}`,
    'Content-Type': 'application/json',
  });
  new Headers(options.headers).forEach((value, key) =>
    requestHeaders.set(key, value),
  );
  const response = await fetch(`${WORKSPACE_API_URL}${path}`, {
    ...options,
    headers: requestHeaders,
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
  };
  if (!response.ok) {
    throw new SourceRequestError(
      data.message || `BNI-PRES D1 HTTP ${response.status}`,
      response.status,
    );
  }
  return data;
}

async function loadRoster(
  session: SourceSession,
  members: Member[],
): Promise<OfficialCoreRoster> {
  try {
    return await workspaceJson<OfficialCoreRoster>(
      '/core-roster?term=11',
      session,
    );
  } catch (error) {
    if (!(error instanceof SourceRequestError) || error.status !== 409) {
      throw error;
    }
    return workspaceJson<OfficialCoreRoster>(
      '/core-roster/resolve?term=11',
      session,
      {
        method: 'POST',
        body: JSON.stringify({
          members: members.map((member) => ({
            memberId: member.id,
            name: member.name,
          })),
        }),
      },
    );
  }
}

async function fetchSourceDirectory(
  session: SourceSession,
): Promise<SourceDirectory> {
  const memberPath =
    '/rest/v1/members?status=eq.active&select=id,profession,membership_expires_on,updated_at,people!inner(display_name,status)&people.status=eq.active&order=created_at.asc';
  const snapshotPath =
    '/rest/v1/analysis_snapshots?is_published=eq.true&select=schema_version,analysis_version,period_end,generated_at,source_version,source_fingerprint,member_count,reconciliation&order=period_end.desc,generated_at.desc&limit=1';
  const [memberRows, snapshotRows] = await Promise.all([
    sourceJson<MemberRow[]>(memberPath, {}, session.accessToken),
    sourceJson<SnapshotRow[]>(snapshotPath, {}, session.accessToken),
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
    importMembers: memberRows
      .filter((row) => row.id && row.people?.display_name)
      .map((row) => ({
        id: row.id,
        name: row.people!.display_name,
        profession: row.profession || '專業別待確認',
        expiryDate: row.membership_expires_on || '',
        status: 'active' as const,
        sourceUpdatedAt: row.updated_at || '',
      })),
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

async function loadSourceData(
  session: SourceSession,
): Promise<OfficialSourceResult> {
  const directory = await fetchSourceDirectory(session);
  return {
    members: directory.members,
    roster: await loadRoster(session, directory.members),
    sourceMeta: directory.sourceMeta,
  };
}

export async function syncOfficialMemberDirectory(
  account: string,
  password: string,
): Promise<number> {
  const email = resolveSourceAccountEmail(account);
  if (!password) throw new Error('請輸入原會員系統密碼');
  const token = await sourceJson<AuthToken>(
    '/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
  const session = sessionFromToken(token);
  await verifySourceAccount(session, token.user.id);
  const directory = await fetchSourceDirectory(session);
  const result = await workspaceJson<{ count: number }>(
    '/member-directory',
    session,
    {
      method: 'PUT',
      body: JSON.stringify({
        members: directory.importMembers,
        sourceMeta: directory.sourceMeta,
      }),
    },
  );
  return result.count;
}

function createSharedSession(password: string): SourceSession {
  if (!password) throw new Error('請輸入共用密碼');
  return {
    kind: 'shared',
    accessToken: password,
    refreshToken: password,
    expiresAt: SHARED_SESSION_EXPIRES_AT,
  };
}

async function loadSharedData(
  session: SourceSession,
): Promise<OfficialSourceResult> {
  let directory: { members: Member[]; sourceMeta: WorkspaceSourceMeta };
  try {
    directory = await workspaceJson<{
      members: Member[];
      sourceMeta: WorkspaceSourceMeta;
    }>('/member-directory', session);
  } catch (error) {
    if (error instanceof SourceRequestError && error.status === 503) {
      throw new MemberDirectoryMissingError();
    }
    throw error;
  }
  if (!directory.members.length) {
    throw new MemberDirectoryMissingError();
  }
  const roster = await loadRoster(session, directory.members);
  return {
    members: directory.members,
    roster,
    sourceMeta: directory.sourceMeta,
  };
}

export async function loginAndLoadOfficialSource(
  password: string,
): Promise<OfficialSourceResult> {
  const session = createSharedSession(password);
  try {
    const result = await loadSharedData(session);
    saveSession(session);
    return result;
  } catch (error) {
    if (error instanceof MemberDirectoryMissingError) saveSession(session);
    throw error;
  }
}

export async function restoreAndLoadOfficialSource(): Promise<OfficialSourceResult | null> {
  const session = await currentSession();
  if (!session) return null;
  try {
    return session.kind === 'shared'
      ? await loadSharedData(session)
      : await loadSourceData(session);
  } catch (error) {
    if (error instanceof SourceRequestError && error.status === 401) {
      clearSourceSession();
      return null;
    }
    throw error;
  }
}

export async function logoutOfficialSource(): Promise<void> {
  const session = readSession();
  clearSourceSession();
  if (!session || session.kind === 'shared') return;
  try {
    await fetch(`${SOURCE_CONFIG.url}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: headers(session.accessToken),
      cache: 'no-store',
    });
  } catch {
    // The local login is already cleared; remote revocation is best effort.
  }
}

export async function loadOfficialWorkspace(): Promise<WorkspaceState | null> {
  const session = await currentSession();
  if (!session) return null;
  try {
    const result = await workspaceJson<{ workspace: WorkspaceState }>(
      '/workspace?key=main',
      session,
    );
    return result.workspace;
  } catch (error) {
    if (error instanceof SourceRequestError && error.status === 404)
      return null;
    throw error;
  }
}

export async function saveOfficialWorkspace(
  workspace: WorkspaceState,
): Promise<string> {
  const session = await currentSession();
  if (!session) throw new Error('正式來源登入已失效');
  const result = await workspaceJson<{ updatedAt: string }>(
    '/workspace?key=main',
    session,
    { method: 'PUT', body: JSON.stringify(workspace) },
  );
  return result.updatedAt;
}
