import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSPACE_SCHEMA,
  createDemoWorkspace,
  createNextTerm,
  getActiveTerm,
  getTermIssues,
  getTermMetrics,
  isWorkspaceSnapshot,
  memberNeedsRenewal,
} from './leadership.ts';

test('示範資料可一致計算職位、缺額與問題', () => {
  const workspace = createDemoWorkspace();
  const term = getActiveTerm(workspace);
  const metrics = getTermMetrics(workspace, term);

  assert.equal(metrics.assignedPeople, 22);
  assert.equal(metrics.positions, 23);
  assert.equal(metrics.gaps, 7);
  assert.equal(metrics.issueCount, 13);
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
