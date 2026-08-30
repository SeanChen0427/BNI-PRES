export const WORKSPACE_SCHEMA = 'fulian.leadership-team.workspace.v1';
export const WORKSPACE_MAX_BYTES = 750_000;

const FORBIDDEN_IDENTITY_KEYS = new Set([
  'name',
  'displayname',
  'profession',
  'expirydate',
  'membershipexpireson',
  'email',
  'password',
  'accesstoken',
  'refreshtoken',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function hasForbiddenIdentityKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenIdentityKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, item]) =>
      FORBIDDEN_IDENTITY_KEYS.has(normalizedKey(key)) ||
      hasForbiddenIdentityKey(item),
  );
}

export function validateWorkspacePayload(value: unknown): string | null {
  if (!isRecord(value)) return '工作台資料必須是 JSON 物件';
  if (value.schema !== WORKSPACE_SCHEMA) return '工作台 schema 版本不符';
  if (typeof value.activeTermId !== 'string' || !value.activeTermId) {
    return '缺少 activeTermId';
  }
  if (!Array.isArray(value.members) || value.members.length !== 0) {
    return '正式姓名與會籍不得寫入 BNI-PRES D1';
  }
  if (!Array.isArray(value.terms) || value.terms.length < 1) {
    return '工作台必須至少有一個屆次';
  }
  if (value.terms.length > 100) return '屆次數量超過上限';
  if (hasForbiddenIdentityKey(value)) {
    return '工作資料包含不可儲存的會員身分欄位';
  }

  const encoded = JSON.stringify(value);
  if (new TextEncoder().encode(encoded).byteLength > WORKSPACE_MAX_BYTES) {
    return '工作台資料超過大小上限';
  }
  return null;
}

export type CoreRosterInput = {
  term: {
    number: number;
    label: string;
    status: 'planning' | 'active' | 'archived';
    meetingDate: string;
    startsOn: string;
    endsOn: string;
  };
  coreLeaders: Array<{
    roleKey: string;
    roleName: string;
    memberId: string;
  }>;
};

export type MemberDirectoryInput = {
  members: Array<{
    id: string;
    name: string;
    profession: string;
    expiryDate: string;
    status: 'active';
    sourceUpdatedAt: string;
  }>;
  sourceMeta: Record<string, unknown>;
};

export function validateMemberDirectory(
  value: unknown,
): value is MemberDirectoryInput {
  if (!isRecord(value) || !Array.isArray(value.members)) return false;
  if (value.members.length < 1 || value.members.length > 500) return false;
  if (!isRecord(value.sourceMeta)) return false;

  const ids = new Set<string>();
  for (const member of value.members) {
    if (
      !isRecord(member) ||
      typeof member.id !== 'string' ||
      !member.id ||
      member.id.length > 128 ||
      typeof member.name !== 'string' ||
      !member.name.trim() ||
      member.name.length > 100 ||
      typeof member.profession !== 'string' ||
      member.profession.length > 200 ||
      typeof member.expiryDate !== 'string' ||
      member.expiryDate.length > 32 ||
      member.status !== 'active' ||
      typeof member.sourceUpdatedAt !== 'string' ||
      member.sourceUpdatedAt.length > 64
    ) {
      return false;
    }
    ids.add(member.id);
  }
  return ids.size === value.members.length;
}

export function validateCoreRoster(value: unknown): value is CoreRosterInput {
  if (!isRecord(value) || !isRecord(value.term)) return false;
  const term = value.term;
  if (!Number.isInteger(term.number) || Number(term.number) < 1) return false;
  if (typeof term.label !== 'string' || !term.label) return false;
  if (!['planning', 'active', 'archived'].includes(String(term.status))) {
    return false;
  }
  if (!Array.isArray(value.coreLeaders) || value.coreLeaders.length !== 8) {
    return false;
  }

  const roles = new Set<string>();
  const members = new Set<string>();
  for (const leader of value.coreLeaders) {
    if (!isRecord(leader)) return false;
    if (
      typeof leader.roleKey !== 'string' ||
      !leader.roleKey ||
      typeof leader.roleName !== 'string' ||
      !leader.roleName ||
      typeof leader.memberId !== 'string' ||
      !leader.memberId
    ) {
      return false;
    }
    roles.add(leader.roleKey);
    members.add(leader.memberId);
  }
  return roles.size === 8 && members.size === 8;
}
