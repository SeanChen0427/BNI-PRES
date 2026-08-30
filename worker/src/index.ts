import {
  WORKSPACE_SCHEMA,
  validateCoreRoster,
  validateMemberDirectory,
  validateWorkspacePayload,
} from './validation';

type Env = {
  DB: D1Database;
  SOURCE_SUPABASE_URL: string;
  SOURCE_SUPABASE_ANON_KEY: string;
  ALLOWED_ORIGINS: string;
  ROSTER_HMAC_SECRET: string;
  SHARED_WORKSPACE_PASSWORD: string;
};

type SourceUser = {
  id: string;
  email: string;
  role: string;
};

type AppAccount = {
  role: string;
  enabled: boolean;
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    env.ALLOWED_ORIGINS.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins(env).has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

function json(
  request: Request,
  env: Env,
  value: unknown,
  status = 200,
): Response {
  return Response.json(value, {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function authenticate(request: Request, env: Env): Promise<SourceUser> {
  const authorization = request.headers.get('Authorization');
  if (authorization?.startsWith('Shared ')) {
    const password = authorization.slice('Shared '.length);
    if (!env.SHARED_WORKSPACE_PASSWORD) {
      throw new HttpError('共同工作台登入尚未設定', 503);
    }
    if (password !== env.SHARED_WORKSPACE_PASSWORD) {
      throw new HttpError('共用密碼不正確', 401);
    }
    return {
      id: 'shared-workspace',
      email: 'shared-workspace@local.invalid',
      role: 'committee',
    };
  }
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError('請先輸入共用密碼', 401);
  }
  const commonHeaders = {
    apikey: env.SOURCE_SUPABASE_ANON_KEY,
    Authorization: authorization,
  };
  const userResponse = await fetch(`${env.SOURCE_SUPABASE_URL}/auth/v1/user`, {
    headers: commonHeaders,
  });
  if (!userResponse.ok) throw new HttpError('正式來源登入已失效', 401);
  const user = (await userResponse.json()) as Partial<SourceUser>;
  if (!user.id || !user.email) throw new HttpError('無法識別正式帳號', 401);

  const accountResponse = await fetch(
    `${env.SOURCE_SUPABASE_URL}/rest/v1/app_accounts?auth_user_id=eq.${encodeURIComponent(user.id)}&select=role,enabled`,
    { headers: commonHeaders },
  );
  if (!accountResponse.ok) throw new HttpError('無法確認帳號權限', 403);
  const accounts = (await accountResponse.json()) as AppAccount[];
  const account = accounts[0];
  if (
    !account?.enabled ||
    !['admin', 'vp', 'committee'].includes(account.role)
  ) {
    throw new HttpError('此帳號未啟用工作台權限', 403);
  }
  return { id: user.id, email: user.email, role: account.role };
}

function workspaceKey(url: URL): string {
  const key = url.searchParams.get('key') || 'main';
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(key)) {
    throw new HttpError('工作台 key 格式錯誤', 400);
  }
  return key;
}

async function getWorkspace(request: Request, env: Env, url: URL) {
  const key = workspaceKey(url);
  const row = await env.DB.prepare(
    'SELECT payload_json, updated_at FROM leadership_workspaces WHERE workspace_key = ?',
  )
    .bind(key)
    .first<{ payload_json: string; updated_at: string }>();
  if (!row) return json(request, env, { message: '尚未建立雲端工作台' }, 404);
  return json(request, env, {
    workspace: JSON.parse(row.payload_json),
    updatedAt: row.updated_at,
  });
}

async function putWorkspace(
  request: Request,
  env: Env,
  url: URL,
  user: SourceUser,
) {
  const key = workspaceKey(url);
  const payload = await request.json().catch(() => null);
  const validationError = validateWorkspacePayload(payload);
  if (validationError) throw new HttpError(validationError, 400);
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO leadership_workspaces
      (workspace_key, schema_version, payload_json, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(workspace_key) DO UPDATE SET
      schema_version = excluded.schema_version,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by`,
  )
    .bind(key, WORKSPACE_SCHEMA, JSON.stringify(payload), updatedAt, user.id)
    .run();
  return json(request, env, { ok: true, updatedAt });
}

async function getMemberDirectory(request: Request, env: Env) {
  const rows = await env.DB.prepare(
    `SELECT member_id, display_name, profession, expiry_date, status,
            source_updated_at, cached_at
     FROM leadership_member_directory
     WHERE status = 'active'
     ORDER BY display_name`,
  ).all<{
    member_id: string;
    display_name: string;
    profession: string;
    expiry_date: string;
    status: 'active';
    source_updated_at: string;
    cached_at: string;
  }>();
  if (!rows.results.length) {
    throw new HttpError('正式會員目錄尚未載入', 503);
  }
  const metaRow = await env.DB.prepare(
    `SELECT payload_json, updated_at
     FROM leadership_source_cache_meta
     WHERE cache_key = 'official-members'`,
  ).first<{ payload_json: string; updated_at: string }>();
  const sourceMeta = metaRow
    ? (JSON.parse(metaRow.payload_json) as Record<string, unknown>)
    : {};
  return json(request, env, {
    members: rows.results.map((row) => ({
      id: row.member_id,
      name: row.display_name,
      profession: row.profession || '專業別待確認',
      expiryDate: row.expiry_date,
      status: 'active',
      source: 'official-read-only',
    })),
    sourceMeta: {
      snapshotPeriodEnd: null,
      snapshotGeneratedAt: null,
      snapshotFingerprint: null,
      snapshotMemberCount: null,
      reconciliation: 'unavailable',
      ...sourceMeta,
      mode: 'official',
      adapter: 'd1-official-member-cache',
      loadedAt: metaRow?.updated_at || rows.results[0].cached_at,
      memberCount: rows.results.length,
      missingExpiryCount: rows.results.filter((row) => !row.expiry_date).length,
      memberMasterUpdatedAt:
        rows.results
          .map((row) => row.source_updated_at)
          .filter(Boolean)
          .sort()
          .at(-1) || null,
      coreRosterExpected: 0,
      coreRosterMatched: 0,
    },
  });
}

async function putMemberDirectory(
  request: Request,
  env: Env,
  user: SourceUser,
) {
  if (user.id === 'shared-workspace') {
    throw new HttpError('請先在設定裡登入原會員系統', 403);
  }
  const payload = await request.json().catch(() => null);
  if (!validateMemberDirectory(payload)) {
    throw new HttpError('正式會員目錄格式錯誤', 400);
  }
  const cachedAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM leadership_member_directory'),
    ...payload.members.map((member) =>
      env.DB.prepare(
        `INSERT INTO leadership_member_directory
          (member_id, display_name, profession, expiry_date, status,
           source_updated_at, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        member.id,
        member.name,
        member.profession,
        member.expiryDate,
        member.status,
        member.sourceUpdatedAt,
        cachedAt,
      ),
    ),
    env.DB.prepare(
      `INSERT INTO leadership_source_cache_meta
        (cache_key, payload_json, updated_at)
       VALUES ('official-members', ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at`,
    ).bind(JSON.stringify(payload.sourceMeta), cachedAt),
  ]);
  return json(request, env, {
    ok: true,
    count: payload.members.length,
    updatedAt: cachedAt,
  });
}

async function getCoreRoster(request: Request, env: Env, url: URL) {
  const termNumber = Number(url.searchParams.get('term') || 11);
  if (!Number.isInteger(termNumber) || termNumber < 1) {
    throw new HttpError('屆次格式錯誤', 400);
  }
  const term = await env.DB.prepare(
    `SELECT term_number, label, status, meeting_date, starts_on, ends_on
     FROM leadership_term_profiles WHERE term_number = ?`,
  )
    .bind(termNumber)
    .first<{
      term_number: number;
      label: string;
      status: 'planning' | 'active' | 'archived';
      meeting_date: string;
      starts_on: string;
      ends_on: string;
    }>();
  if (!term) return json(request, env, { message: '尚未設定此屆 8 長' }, 404);

  const leaders = await env.DB.prepare(
    `SELECT role_key, role_name, member_id
     FROM leadership_core_roster WHERE term_number = ? ORDER BY rowid`,
  )
    .bind(termNumber)
    .all<{ role_key: string; role_name: string; member_id: string }>();
  if (leaders.results.length !== 8) {
    return json(
      request,
      env,
      {
        code: 'roster_resolution_required',
        message: '正式 8 長尚待首次登入完成 ID 對應',
      },
      409,
    );
  }
  return json(request, env, {
    term: {
      number: term.term_number,
      label: term.label,
      status: term.status,
      meetingDate: term.meeting_date,
      startsOn: term.starts_on,
      endsOn: term.ends_on,
    },
    coreLeaders: leaders.results.map((leader) => ({
      roleKey: leader.role_key,
      roleName: leader.role_name,
      memberId: leader.member_id,
    })),
  });
}

function normalizeMemberName(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

async function memberNameHmac(name: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(normalizeMemberName(name)),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function resolveCoreRoster(request: Request, env: Env, url: URL) {
  const payload = (await request.json().catch(() => null)) as {
    members?: Array<{ memberId?: unknown; name?: unknown }>;
  } | null;
  if (
    !payload?.members ||
    !Array.isArray(payload.members) ||
    payload.members.length < 8 ||
    payload.members.length > 200 ||
    payload.members.some(
      (member) =>
        typeof member.memberId !== 'string' ||
        !member.memberId ||
        typeof member.name !== 'string' ||
        !member.name,
    )
  ) {
    throw new HttpError('會員 ID 對應資料格式錯誤', 400);
  }
  if (!env.ROSTER_HMAC_SECRET) {
    throw new HttpError('8 長對應密鑰尚未設定', 503);
  }
  const termNumber = Number(url.searchParams.get('term') || 11);
  const bootstrap = await env.DB.prepare(
    `SELECT role_key, role_name, member_name_hmac
     FROM leadership_core_roster_bootstrap WHERE term_number = ?`,
  )
    .bind(termNumber)
    .all<{
      role_key: string;
      role_name: string;
      member_name_hmac: string;
    }>();
  if (bootstrap.results.length !== 8) {
    throw new HttpError('8 長初始對應資料不完整', 503);
  }

  const memberByHmac = new Map<string, string>();
  for (const member of payload.members) {
    memberByHmac.set(
      await memberNameHmac(member.name as string, env.ROSTER_HMAC_SECRET),
      member.memberId as string,
    );
  }
  const resolved = bootstrap.results.map((row) => ({
    ...row,
    memberId: memberByHmac.get(row.member_name_hmac),
  }));
  if (
    resolved.some((row) => !row.memberId) ||
    new Set(resolved.map((row) => row.memberId)).size !== 8
  ) {
    throw new HttpError('正式會員主檔無法完整對上 8 長', 409);
  }

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM leadership_core_roster WHERE term_number = ?',
    ).bind(termNumber),
    ...resolved.map((row) =>
      env.DB.prepare(
        `INSERT INTO leadership_core_roster
          (term_number, role_key, role_name, member_id, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(termNumber, row.role_key, row.role_name, row.memberId, now),
    ),
    env.DB.prepare(
      'DELETE FROM leadership_core_roster_bootstrap WHERE term_number = ?',
    ).bind(termNumber),
  ]);
  return getCoreRoster(request, env, url);
}

async function putCoreRoster(request: Request, env: Env, user: SourceUser) {
  if (user.role !== 'admin') {
    throw new HttpError('只有 Admin 可設定正式 8 長', 403);
  }
  const payload = await request.json().catch(() => null);
  if (!validateCoreRoster(payload))
    throw new HttpError('8 長資料格式錯誤', 400);
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      `INSERT INTO leadership_term_profiles
        (term_number, label, status, meeting_date, starts_on, ends_on, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(term_number) DO UPDATE SET
        label = excluded.label,
        status = excluded.status,
        meeting_date = excluded.meeting_date,
        starts_on = excluded.starts_on,
        ends_on = excluded.ends_on,
        updated_at = excluded.updated_at`,
    ).bind(
      payload.term.number,
      payload.term.label,
      payload.term.status,
      payload.term.meetingDate || '',
      payload.term.startsOn || '',
      payload.term.endsOn || '',
      now,
    ),
    env.DB.prepare(
      'DELETE FROM leadership_core_roster WHERE term_number = ?',
    ).bind(payload.term.number),
    ...payload.coreLeaders.map((leader) =>
      env.DB.prepare(
        `INSERT INTO leadership_core_roster
          (term_number, role_key, role_name, member_id, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(
        payload.term.number,
        leader.roleKey,
        leader.roleName,
        leader.memberId,
        now,
      ),
    ),
  ];
  await env.DB.batch(statements);
  return json(request, env, { ok: true, count: 8, updatedAt: now });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && !allowedOrigins(env).has(origin)) {
      return json(request, env, { message: '不允許的網站來源' }, 403);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(request, env),
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return json(request, env, {
        ok: true,
        service: 'bni-pres-api',
        database: 'd1',
      });
    }

    try {
      const user = await authenticate(request, env);
      if (url.pathname === '/member-directory' && request.method === 'GET') {
        return getMemberDirectory(request, env);
      }
      if (url.pathname === '/member-directory' && request.method === 'PUT') {
        return putMemberDirectory(request, env, user);
      }
      if (url.pathname === '/workspace' && request.method === 'GET') {
        return getWorkspace(request, env, url);
      }
      if (url.pathname === '/workspace' && request.method === 'PUT') {
        return putWorkspace(request, env, url, user);
      }
      if (url.pathname === '/core-roster' && request.method === 'GET') {
        return getCoreRoster(request, env, url);
      }
      if (url.pathname === '/core-roster' && request.method === 'PUT') {
        return putCoreRoster(request, env, user);
      }
      if (
        url.pathname === '/core-roster/resolve' &&
        request.method === 'POST'
      ) {
        return resolveCoreRoster(request, env, url);
      }
      return json(request, env, { message: '找不到 API' }, 404);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(request, env, { message: error.message }, error.status);
      }
      console.error(error);
      return json(request, env, { message: '工作台服務暫時無法使用' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
