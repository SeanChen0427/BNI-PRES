import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSPACE_SCHEMA,
  validateCoreRoster,
  validateWorkspacePayload,
} from './validation.ts';

test('D1 工作資料允許編組狀態但不含會員主檔', () => {
  const payload = {
    schema: WORKSPACE_SCHEMA,
    activeTermId: 'term-11',
    members: [],
    terms: [
      {
        id: 'term-11',
        assignments: [{ memberId: 'source-member-id', roleId: 'core-chair' }],
      },
    ],
  };
  assert.equal(validateWorkspacePayload(payload), null);
  assert.notEqual(
    validateWorkspacePayload({
      ...payload,
      members: [{ id: 'source-member-id', name: '虛構姓名' }],
    }),
    null,
  );
  assert.notEqual(
    validateWorkspacePayload({
      ...payload,
      sourceCopy: { profession: '虛構專業' },
    }),
    null,
  );
});

test('8 長必須是八個不重複的角色與來源會員 ID', () => {
  const valid = {
    term: {
      number: 11,
      label: '第 11 屆',
      status: 'planning',
      meetingDate: '2026-08-31',
      startsOn: '',
      endsOn: '',
    },
    coreLeaders: Array.from({ length: 8 }, (_, index) => ({
      roleKey: `role-${index}`,
      roleName: `虛構職務 ${index}`,
      memberId: `source-id-${index}`,
    })),
  };
  assert.equal(validateCoreRoster(valid), true);
  assert.equal(
    validateCoreRoster({
      ...valid,
      coreLeaders: valid.coreLeaders.map((leader) => ({
        ...leader,
        memberId: 'same-id',
      })),
    }),
    false,
  );
});
