export const WORKSPACE_SCHEMA = 'fulian.leadership-team.workspace.v1';
export const STORAGE_KEY = 'fulian.leadership-team.workspace.v1';

export type TermStatus = 'planning' | 'active' | 'archived';
export type DecisionStatus = 'nominated' | 'tentative' | 'confirmed';
export type RenewalStatus =
  | 'needs-action'
  | 'reminded'
  | 'in-progress'
  | 'completed';

export type Member = {
  id: string;
  name: string;
  profession: string;
  expiryDate: string;
  status: 'active';
  source: 'demo-adapter' | 'official-read-only';
};

export type WorkspaceSourceMeta = {
  mode: 'demo' | 'official';
  adapter: 'demo-adapter' | 'supabase-members-read-only';
  loadedAt: string | null;
  memberCount: number;
  missingExpiryCount: number;
  memberMasterUpdatedAt: string | null;
  snapshotPeriodEnd: string | null;
  snapshotGeneratedAt: string | null;
  snapshotFingerprint: string | null;
  snapshotMemberCount: number | null;
  reconciliation: 'matched' | 'mismatch' | 'unavailable';
  coreRosterExpected: number;
  coreRosterMatched: number;
};

export type CoreRole = {
  id: string;
  label: string;
  shortLabel: string;
  order: number;
};

export type TeamGroup = {
  id: string;
  title: string;
  memberRole: string;
  coreRoleIds: string[];
  capacity: number;
  order: number;
};

export type Assignment = {
  id: string;
  memberId: string;
  roleId: string;
  kind: 'core' | 'group';
  decision: DecisionStatus;
};

export type TermSettings = {
  renewalThreshold: string;
  renewalRuleStatus: 'pending-confirmation';
  trainingDate: string;
};

export type TermState = {
  id: string;
  number: number;
  label: string;
  status: TermStatus;
  meetingDate: string;
  startDate: string;
  endDate: string;
  sourceTermId: string | null;
  coreRoles: CoreRole[];
  groups: TeamGroup[];
  assignments: Assignment[];
  training: Record<string, boolean>;
  renewal: Record<string, RenewalStatus>;
  settings: TermSettings;
};

export type WorkspaceState = {
  schema: typeof WORKSPACE_SCHEMA;
  activeTermId: string;
  members: Member[];
  terms: TermState[];
  lastSavedAt: string | null;
  sourceMeta?: WorkspaceSourceMeta;
};

export type OfficialCoreRoster = {
  term: {
    number: number;
    label: string;
    status: TermStatus;
    meetingDate: string;
    startsOn: string;
    endsOn: string;
  };
  coreLeaders: Array<{
    roleKey: string;
    roleName: string;
    memberName: string;
  }>;
};

export type WorkspaceIssue = {
  id: string;
  kind: 'conflict' | 'renewal' | 'training';
  memberId: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium';
};

export const CORE_ROLES: CoreRole[] = [
  { id: 'core-chair', label: '主席', shortLabel: '主席', order: 1 },
  { id: 'core-vice-chair', label: '副主席', shortLabel: '副主席', order: 2 },
  {
    id: 'core-secretary-treasurer',
    label: '秘書財務',
    shortLabel: '秘財',
    order: 3,
  },
  {
    id: 'core-reception',
    label: '來賓接待組長',
    shortLabel: '接待組長',
    order: 4,
  },
  { id: 'core-training', label: '教育協調員', shortLabel: '教培', order: 5 },
  {
    id: 'core-events',
    label: '活動協調員',
    shortLabel: '活動協調員',
    order: 6,
  },
  {
    id: 'core-mentor',
    label: '導師協調員',
    shortLabel: '導師協調員',
    order: 7,
  },
  { id: 'core-growth', label: '成長協調員', shortLabel: '成長', order: 8 },
];

export const TEAM_GROUPS: TeamGroup[] = [
  {
    id: 'group-pack',
    title: '主席 ＋ 成長',
    memberRole: '領頭羊',
    coreRoleIds: ['core-chair', 'core-growth'],
    capacity: 4,
    order: 1,
  },
  {
    id: 'group-membership',
    title: '副主席',
    memberRole: '會員委員',
    coreRoleIds: ['core-vice-chair'],
    capacity: 3,
    order: 2,
  },
  {
    id: 'group-closing',
    title: '秘書財務',
    memberRole: '締結組',
    coreRoleIds: ['core-secretary-treasurer'],
    capacity: 3,
    order: 3,
  },
  {
    id: 'group-reception',
    title: '來賓接待',
    memberRole: '接待組員',
    coreRoleIds: ['core-reception'],
    capacity: 3,
    order: 4,
  },
  {
    id: 'group-events',
    title: '活動協調',
    memberRole: '活動組員',
    coreRoleIds: ['core-events'],
    capacity: 3,
    order: 5,
  },
  {
    id: 'group-mentor',
    title: '導師協調',
    memberRole: '導師',
    coreRoleIds: ['core-mentor'],
    capacity: 3,
    order: 6,
  },
  {
    id: 'group-six-weeks',
    title: '教育培訓',
    memberRole: '6W 組員',
    coreRoleIds: ['core-training'],
    capacity: 3,
    order: 7,
  },
];

const DEMO_MEMBERS: Member[] = [
  ['demo-001', '測試會員・晨星', '品牌策略', '2027-10-31'],
  ['demo-002', '測試會員・青禾', '財務顧問', '2027-02-15'],
  ['demo-003', '測試會員・向陽', '商務法律', '2026-12-31'],
  ['demo-004', '測試會員・若川', '空間設計', '2027-06-30'],
  ['demo-005', '測試會員・望舒', '教育訓練', '2027-03-10'],
  ['demo-006', '測試會員・景澄', '活動企劃', '2027-01-31'],
  ['demo-007', '測試會員・知夏', '職涯教練', '2028-04-30'],
  ['demo-008', '測試會員・沐禾', '數位行銷', '2027-02-28'],
  ['demo-009', '測試會員・星野', '影像製作', '2027-08-31'],
  ['demo-010', '測試會員・予安', '保險規劃', '2026-11-30'],
  ['demo-011', '測試會員・清和', '系統整合', '2028-01-31'],
  ['demo-012', '測試會員・書晴', '企業禮贈', '2027-05-31'],
  ['demo-013', '測試會員・禾牧', '不動產顧問', '2027-02-01'],
  ['demo-014', '測試會員・昕岳', '室內工程', '2027-12-31'],
  ['demo-015', '測試會員・澄心', '健康管理', '2027-01-15'],
  ['demo-016', '測試會員・以墨', '視覺設計', '2028-03-31'],
  ['demo-017', '測試會員・映竹', '人資顧問', '2027-09-30'],
  ['demo-018', '測試會員・謙石', '餐飲顧問', '2026-10-31'],
  ['demo-019', '測試會員・好雨', '旅遊規劃', '2028-02-29'],
  ['demo-020', '測試會員・長風', '舞台技術', '2027-04-30'],
  ['demo-021', '測試會員・冬青', '企業攝影', '2027-02-20'],
  ['demo-022', '測試會員・月白', '組織顧問', '2027-07-31'],
  ['demo-023', '測試會員・南枝', '語言培訓', '2027-11-30'],
  ['demo-024', '測試會員・微光', '網站企劃', '2028-06-30'],
].map(([id, name, profession, expiryDate]) => ({
  id,
  name,
  profession,
  expiryDate,
  status: 'active' as const,
  source: 'demo-adapter' as const,
}));

const assignment = (
  id: string,
  memberId: string,
  roleId: string,
  kind: Assignment['kind'],
  decision: DecisionStatus = 'confirmed',
): Assignment => ({ id, memberId, roleId, kind, decision });

const DEMO_ASSIGNMENTS: Assignment[] = [
  assignment('a-core-01', 'demo-001', 'core-chair', 'core'),
  assignment('a-core-02', 'demo-002', 'core-vice-chair', 'core'),
  assignment('a-core-03', 'demo-003', 'core-secretary-treasurer', 'core'),
  assignment('a-core-04', 'demo-004', 'core-reception', 'core'),
  assignment('a-core-05', 'demo-005', 'core-training', 'core'),
  assignment('a-core-06', 'demo-006', 'core-events', 'core'),
  assignment('a-core-07', 'demo-007', 'core-mentor', 'core'),
  assignment('a-core-08', 'demo-008', 'core-growth', 'core'),
  assignment('a-group-01', 'demo-009', 'group-pack', 'group'),
  assignment('a-group-02', 'demo-010', 'group-pack', 'group'),
  assignment('a-group-03', 'demo-011', 'group-pack', 'group', 'tentative'),
  assignment('a-group-04', 'demo-012', 'group-membership', 'group'),
  assignment('a-group-05', 'demo-013', 'group-membership', 'group'),
  assignment('a-group-06', 'demo-014', 'group-closing', 'group'),
  assignment('a-group-07', 'demo-015', 'group-closing', 'group', 'tentative'),
  assignment('a-group-08', 'demo-016', 'group-reception', 'group'),
  assignment('a-group-09', 'demo-017', 'group-reception', 'group'),
  assignment('a-group-10', 'demo-009', 'group-events', 'group'),
  assignment('a-group-11', 'demo-018', 'group-events', 'group', 'nominated'),
  assignment('a-group-12', 'demo-019', 'group-mentor', 'group'),
  assignment('a-group-13', 'demo-020', 'group-mentor', 'group'),
  assignment('a-group-14', 'demo-021', 'group-six-weeks', 'group'),
  assignment('a-group-15', 'demo-022', 'group-six-weeks', 'group', 'tentative'),
];

const DEMO_TRAINING: Record<string, boolean> = {
  'demo-001': true,
  'demo-002': true,
  'demo-003': false,
  'demo-004': true,
  'demo-005': true,
  'demo-006': false,
  'demo-007': true,
  'demo-008': true,
  'demo-009': false,
  'demo-010': true,
  'demo-011': false,
  'demo-012': true,
  'demo-013': true,
  'demo-014': true,
  'demo-015': false,
  'demo-016': true,
  'demo-017': true,
  'demo-018': false,
  'demo-019': true,
  'demo-020': true,
  'demo-021': false,
  'demo-022': true,
};

function cloneStructure<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDemoWorkspace(): WorkspaceState {
  const term: TermState = {
    id: 'term-11',
    number: 11,
    label: '第 11 屆',
    status: 'planning',
    meetingDate: '2026-08-31',
    startDate: '',
    endDate: '',
    sourceTermId: null,
    coreRoles: cloneStructure(CORE_ROLES),
    groups: cloneStructure(TEAM_GROUPS),
    assignments: cloneStructure(DEMO_ASSIGNMENTS),
    training: cloneStructure(DEMO_TRAINING),
    renewal: {
      'demo-002': 'reminded',
      'demo-003': 'needs-action',
      'demo-006': 'in-progress',
      'demo-008': 'needs-action',
      'demo-010': 'needs-action',
      'demo-013': 'needs-action',
      'demo-015': 'completed',
      'demo-018': 'needs-action',
      'demo-021': 'needs-action',
    },
    settings: {
      renewalThreshold: '2027-03-01',
      renewalRuleStatus: 'pending-confirmation',
      trainingDate: '2026-09-15',
    },
  };

  return {
    schema: WORKSPACE_SCHEMA,
    activeTermId: term.id,
    members: cloneStructure(DEMO_MEMBERS),
    terms: [term],
    lastSavedAt: null,
    sourceMeta: {
      mode: 'demo',
      adapter: 'demo-adapter',
      loadedAt: null,
      memberCount: DEMO_MEMBERS.length,
      missingExpiryCount: 0,
      memberMasterUpdatedAt: null,
      snapshotPeriodEnd: null,
      snapshotGeneratedAt: null,
      snapshotFingerprint: null,
      snapshotMemberCount: null,
      reconciliation: 'unavailable',
      coreRosterExpected: 0,
      coreRosterMatched: 0,
    },
  };
}

const OFFICIAL_CORE_ROLE_IDS: Record<string, string> = {
  chair: 'core-chair',
  'vice-chair': 'core-vice-chair',
  'secretary-treasurer': 'core-secretary-treasurer',
  'visitor-host': 'core-reception',
  education: 'core-training',
  events: 'core-events',
  mentoring: 'core-mentor',
  growth: 'core-growth',
};

function normalizedMemberName(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

export function applyOfficialSource(
  workspace: WorkspaceState,
  members: Member[],
  roster: OfficialCoreRoster,
  sourceMeta: WorkspaceSourceMeta,
): WorkspaceState {
  const wasOfficial = workspace.sourceMeta?.mode === 'official';
  const memberIds = new Set(members.map((member) => member.id));
  const memberByName = new Map(
    members.map((member) => [normalizedMemberName(member.name), member]),
  );
  const matchedLeaders = roster.coreLeaders
    .map((leader) => ({
      leader,
      roleId: OFFICIAL_CORE_ROLE_IDS[leader.roleKey],
      member: memberByName.get(normalizedMemberName(leader.memberName)),
    }))
    .filter((item) => item.roleId && item.member);

  const terms = workspace.terms.map((term) => {
    const retainedAssignments = wasOfficial
      ? term.assignments.filter((item) => memberIds.has(item.memberId))
      : [];
    const retainedTraining = wasOfficial
      ? Object.fromEntries(
          Object.entries(term.training).filter(([memberId]) =>
            memberIds.has(memberId),
          ),
        )
      : {};
    const retainedRenewal = wasOfficial
      ? Object.fromEntries(
          Object.entries(term.renewal).filter(([memberId]) =>
            memberIds.has(memberId),
          ),
        )
      : {};

    if (term.number !== roster.term.number || wasOfficial) {
      return {
        ...term,
        assignments: retainedAssignments,
        training: retainedTraining,
        renewal: retainedRenewal,
      };
    }

    return {
      ...term,
      label: roster.term.label || term.label,
      status: roster.term.status || term.status,
      meetingDate: roster.term.meetingDate || term.meetingDate,
      startDate: roster.term.startsOn || term.startDate,
      endDate: roster.term.endsOn || term.endDate,
      assignments: matchedLeaders.map(({ roleId, member }) => ({
        id: `official-core-${roleId}`,
        memberId: member!.id,
        roleId,
        kind: 'core' as const,
        decision: 'confirmed' as const,
      })),
      training: {},
      renewal: {},
    };
  });

  return {
    ...workspace,
    members: cloneStructure(members),
    terms,
    lastSavedAt: new Date().toISOString(),
    sourceMeta: {
      ...sourceMeta,
      coreRosterExpected: roster.coreLeaders.length,
      coreRosterMatched: matchedLeaders.length,
    },
  };
}

export function workspaceForPersistence(
  workspace: WorkspaceState,
): WorkspaceState {
  const snapshot = cloneWorkspace(workspace);
  if (snapshot.sourceMeta?.mode === 'official') snapshot.members = [];
  return snapshot;
}

export function getActiveTerm(workspace: WorkspaceState): TermState {
  return (
    workspace.terms.find((term) => term.id === workspace.activeTermId) ??
    workspace.terms[0]
  );
}

export function getMember(
  workspace: WorkspaceState,
  memberId: string,
): Member | undefined {
  return workspace.members.find((member) => member.id === memberId);
}

export function getAssignmentsForMember(
  term: TermState,
  memberId: string,
): Assignment[] {
  return term.assignments.filter((item) => item.memberId === memberId);
}

export function getRoleLabel(term: TermState, roleId: string): string {
  return (
    term.coreRoles.find((role) => role.id === roleId)?.shortLabel ??
    term.groups.find((group) => group.id === roleId)?.memberRole ??
    '未命名職位'
  );
}

export function memberNeedsRenewal(
  member: Member,
  renewalThreshold: string,
): boolean {
  return Boolean(
    member.expiryDate &&
    renewalThreshold &&
    member.expiryDate <= renewalThreshold,
  );
}

export function getAssignedMemberIds(term: TermState): string[] {
  return [...new Set(term.assignments.map((item) => item.memberId))];
}

export function getTermMetrics(workspace: WorkspaceState, term: TermState) {
  const coreCapacity = term.coreRoles.length;
  const groupCapacity = term.groups.reduce(
    (sum, group) => sum + group.capacity,
    0,
  );
  const gaps =
    term.coreRoles.filter(
      (role) => !term.assignments.some((item) => item.roleId === role.id),
    ).length +
    term.groups.reduce((sum, group) => {
      const filled = term.assignments.filter(
        (item) => item.roleId === group.id,
      ).length;
      return sum + Math.max(0, group.capacity - filled);
    }, 0);
  const assignedMemberIds = getAssignedMemberIds(term);
  const issues = getTermIssues(workspace, term);

  return {
    assignedPeople: assignedMemberIds.length,
    positions: term.assignments.length,
    capacity: coreCapacity + groupCapacity,
    gaps,
    issueCount: issues.length,
    confirmedPositions: term.assignments.filter(
      (item) => item.decision === 'confirmed',
    ).length,
  };
}

export function getTermIssues(
  workspace: WorkspaceState,
  term: TermState,
): WorkspaceIssue[] {
  const assignedIds = getAssignedMemberIds(term);
  const issues: WorkspaceIssue[] = [];

  assignedIds.forEach((memberId) => {
    const member = getMember(workspace, memberId);
    if (!member) return;

    const assignments = getAssignmentsForMember(term, memberId);
    if (assignments.length >= 2) {
      const labels = assignments.map((item) => getRoleLabel(term, item.roleId));
      issues.push({
        id: `conflict-${memberId}`,
        kind: 'conflict',
        memberId,
        title: `${member.name}承接 ${assignments.length} 項職位`,
        detail: labels.join('、'),
        severity: 'high',
      });
    }

    if (
      memberNeedsRenewal(member, term.settings.renewalThreshold) &&
      term.renewal[memberId] !== 'completed'
    ) {
      issues.push({
        id: `renewal-${memberId}`,
        kind: 'renewal',
        memberId,
        title: `${member.name}需要續約確認`,
        detail: `會籍到期 ${member.expiryDate.replaceAll('-', '/')}・${renewalStatusLabel(
          term.renewal[memberId] ?? 'needs-action',
        )}`,
        severity: 'medium',
      });
    }

    const hasConfirmedRole = assignments.some(
      (item) => item.decision === 'confirmed',
    );
    if (hasConfirmedRole && !term.training[memberId]) {
      issues.push({
        id: `training-${memberId}`,
        kind: 'training',
        memberId,
        title: `${member.name}尚未報名培訓`,
        detail: `${term.settings.trainingDate.replaceAll('-', '/')} 期中領導團隊培訓`,
        severity: 'high',
      });
    }
  });

  const order: Record<WorkspaceIssue['kind'], number> = {
    conflict: 0,
    training: 1,
    renewal: 2,
  };

  return issues.sort((a, b) => order[a.kind] - order[b.kind]);
}

export function decisionStatusLabel(status: DecisionStatus): string {
  return {
    nominated: '提名',
    tentative: '會議暫定',
    confirmed: '會議定案',
  }[status];
}

export function renewalStatusLabel(status: RenewalStatus): string {
  return {
    'needs-action': '待處理',
    reminded: '已提醒',
    'in-progress': '辦理中',
    completed: '已完成',
  }[status];
}

export function createNextTerm(workspace: WorkspaceState): WorkspaceState {
  const current = getActiveTerm(workspace);
  const nextNumber =
    Math.max(...workspace.terms.map((term) => term.number)) + 1;
  const nextId = `term-${nextNumber}`;
  const existing = workspace.terms.find((term) => term.id === nextId);
  if (existing) {
    return { ...workspace, activeTermId: existing.id };
  }

  const next: TermState = {
    id: nextId,
    number: nextNumber,
    label: `第 ${nextNumber} 屆`,
    status: 'planning',
    meetingDate: '',
    startDate: '',
    endDate: '',
    sourceTermId: current.id,
    coreRoles: cloneStructure(current.coreRoles),
    groups: cloneStructure(current.groups),
    assignments: [],
    training: {},
    renewal: {},
    settings: cloneStructure(current.settings),
  };

  return {
    ...workspace,
    activeTermId: next.id,
    terms: [...workspace.terms, next],
  };
}

export function isWorkspaceSnapshot(value: unknown): value is WorkspaceState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkspaceState>;
  if (candidate.schema !== WORKSPACE_SCHEMA) return false;
  if (typeof candidate.activeTermId !== 'string') return false;
  if (!Array.isArray(candidate.members) || !Array.isArray(candidate.terms)) {
    return false;
  }
  if (!candidate.terms.some((term) => term?.id === candidate.activeTermId)) {
    return false;
  }

  const membersValid = candidate.members.every(
    (member) =>
      member &&
      typeof member.id === 'string' &&
      typeof member.name === 'string' &&
      typeof member.expiryDate === 'string',
  );
  const termsValid = candidate.terms.every(
    (term) =>
      term &&
      typeof term.id === 'string' &&
      typeof term.number === 'number' &&
      Array.isArray(term.coreRoles) &&
      Array.isArray(term.groups) &&
      Array.isArray(term.assignments) &&
      term.settings &&
      typeof term.settings.renewalThreshold === 'string',
  );

  return membersValid && termsValid;
}

export function cloneWorkspace(workspace: WorkspaceState): WorkspaceState {
  return cloneStructure(workspace);
}

export function makeAssignmentId(): string {
  return `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
