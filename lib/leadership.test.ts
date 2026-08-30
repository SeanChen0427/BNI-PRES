import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSPACE_SCHEMA,
  applyOfficialSource,
  createDemoWorkspace,
  createNextTerm,
  getActiveTerm,
  getTermIssues,
  getTermMetrics,
  isWorkspaceSnapshot,
  memberNeedsRenewal,
  roleAcceptsAnotherAssignment,
  workspaceForPersistence,
  type Member,
  type OfficialCoreRoster,
  type TeamGroup,
  type WorkspaceSourceMeta,
} from './leadership.ts';

test('示範資料可一致計算職位、核心缺額與問題', () => {
  const workspace = createDemoWorkspace();
  const term = getActiveTerm(workspace);
  const metrics = getTermMetrics(workspace, term);

  assert.equal(metrics.assignedPeople, 22);
  assert.equal(metrics.positions, 23);
  assert.equal(metrics.coreGaps, 0);
  assert.equal(metrics.issueCount, 13);
});

test('下層組員不限人數，核心職務仍維持單一席次', () => {
  const workspace = createDemoWorkspace();
  const term = getActiveTerm(workspace);

  assert.equal(roleAcceptsAnotherAssignment(term, 'group-membership'), true);
  assert.equal(roleAcceptsAnotherAssignment(term, 'core-vice-chair'), false);
});

test('保存工作台時移除舊版小組人數上限欄位', () => {
  const workspace = createDemoWorkspace();
  const legacyGroup = workspace.terms[0].groups[0] as TeamGroup & {
    capacity?: number;
  };
  legacyGroup.capacity = 4;

  const snapshot = workspaceForPersistence(workspace);

  assert.equal('capacity' in snapshot.terms[0].groups[0], false);
});

test('同一會員多職位只產生一筆兼任與一筆培訓問題', () => {
  const workspace = createDemoWorkspace();
  const term = getActiveTerm(workspace);
  const issues = getTermIssues(workspace, term);

  assert.equal(
    issues.filter(
      (issue) => issue.kind === 'conflict' && issue.memberId === 'demo-009',
    ).length,
    1,
  );
  assert.equal(
    issues.filter(
      (issue) => issue.kind === 'training' && issue.memberId === 'demo-009',
    ).length,
    1,
  );
});

test('續約門檻包含門檻當日', () => {
  const workspace = createDemoWorkspace();
  const member = {
    ...workspace.members[0],
    expiryDate: '2027-03-01',
  };

  assert.equal(memberNeedsRenewal(member, '2027-03-01'), true);
  assert.equal(memberNeedsRenewal(member, '2027-02-28'), false);
});

test('建立下一屆只複製結構，不複製人選或追蹤狀態', () => {
  const workspace = createDemoWorkspace();
  const nextWorkspace = createNextTerm(workspace);
  const nextTerm = getActiveTerm(nextWorkspace);

  assert.equal(nextTerm.number, 12);
  assert.equal(nextTerm.sourceTermId, 'term-11');
  assert.deepEqual(nextTerm.coreRoles, workspace.terms[0].coreRoles);
  assert.deepEqual(nextTerm.groups, workspace.terms[0].groups);
  assert.deepEqual(nextTerm.assignments, []);
  assert.deepEqual(nextTerm.training, {});
  assert.deepEqual(nextTerm.renewal, {});
  assert.equal(nextWorkspace.members.length, workspace.members.length);
});

test('只接受目前版本且 active term 存在的備份', () => {
  const workspace = createDemoWorkspace();

  assert.equal(isWorkspaceSnapshot(workspace), true);
  assert.equal(
    isWorkspaceSnapshot({ ...workspace, schema: 'another-schema' }),
    false,
  );
  assert.equal(
    isWorkspaceSnapshot({ ...workspace, activeTermId: 'term-missing' }),
    false,
  );
  assert.equal(workspace.schema, WORKSPACE_SCHEMA);
});

test('正式唯讀來源會移除示範安排，且備份不保存正式姓名與會籍', () => {
  const workspace = createDemoWorkspace();
  const roleKeys = [
    'chair',
    'vice-chair',
    'secretary-treasurer',
    'visitor-host',
    'education',
    'events',
    'mentoring',
    'growth',
  ];
  const members: Member[] = roleKeys.map((_, index) => ({
    id: `official-id-${index + 1}`,
    name: `正式測試會員${index + 1}`,
    profession: `測試專業${index + 1}`,
    expiryDate: `2027-${String(index + 1).padStart(2, '0')}-28`,
    status: 'active',
    source: 'official-read-only',
  }));
  const roster: OfficialCoreRoster = {
    term: {
      number: 11,
      label: '第 11 屆',
      status: 'planning',
      meetingDate: '2026-08-31',
      startsOn: '',
      endsOn: '',
    },
    coreLeaders: roleKeys.map((roleKey, index) => ({
      roleKey,
      roleName: `核心職務${index + 1}`,
      memberId: members[index].id,
    })),
  };
  const sourceMeta: WorkspaceSourceMeta = {
    mode: 'official',
    adapter: 'supabase-members-read-only',
    loadedAt: '2026-08-30T01:00:00.000Z',
    memberCount: members.length,
    missingExpiryCount: 0,
    memberMasterUpdatedAt: '2026-08-30T00:00:00.000Z',
    snapshotPeriodEnd: '2026-07-31',
    snapshotGeneratedAt: '2026-08-01T00:00:00.000Z',
    snapshotFingerprint: 'fixture-only',
    snapshotMemberCount: members.length,
    reconciliation: 'matched',
    coreRosterExpected: 0,
    coreRosterMatched: 0,
  };

  const official = applyOfficialSource(workspace, members, roster, sourceMeta);
  const term = getActiveTerm(official);

  assert.equal(term.assignments.length, 8);
  assert.equal(
    term.assignments.every((item) => item.kind === 'core'),
    true,
  );
  assert.equal(official.sourceMeta?.coreRosterMatched, 8);
  assert.equal(
    official.members.every((member) => member.source === 'official-read-only'),
    true,
  );

  const persisted = workspaceForPersistence(official);
  assert.deepEqual(persisted.members, []);
  assert.equal(JSON.stringify(persisted).includes('正式測試會員1'), false);
});
