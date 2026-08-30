import { spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateRosterPath = path.resolve(
  webRoot,
  '../data/private/term-11-core-roster.json',
);
const quote = (value) => `'${String(value ?? '').replaceAll("'", "''")}'`;
const normalizeName = (value) => String(value).replace(/\s+/g, '').trim();

const roster = JSON.parse(await readFile(privateRosterPath, 'utf8'));
if (
  !roster.term ||
  !Array.isArray(roster.coreLeaders) ||
  roster.coreLeaders.length !== 8 ||
  new Set(roster.coreLeaders.map((item) => item.roleKey)).size !== 8 ||
  roster.coreLeaders.some((item) => !item.memberName)
) {
  throw new Error('私密名單必須含八個不重複的角色與姓名');
}

const secret = randomBytes(32).toString('hex');
const hmac = (name) =>
  createHmac('sha256', secret).update(normalizeName(name)).digest('hex');
const now = new Date().toISOString();
const termNumber = Number(roster.term.number);
const sql = [
  'PRAGMA foreign_keys = ON;',
  `INSERT INTO leadership_term_profiles
    (term_number, label, status, meeting_date, starts_on, ends_on, updated_at)
   VALUES (${termNumber}, ${quote(roster.term.label)}, ${quote(roster.term.status)}, ${quote(roster.term.meetingDate)}, ${quote(roster.term.startsOn)}, ${quote(roster.term.endsOn)}, ${quote(now)})
   ON CONFLICT(term_number) DO UPDATE SET
    label = excluded.label,
    status = excluded.status,
    meeting_date = excluded.meeting_date,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    updated_at = excluded.updated_at;`,
  `DELETE FROM leadership_core_roster_bootstrap WHERE term_number = ${termNumber};`,
  ...roster.coreLeaders.map(
    (leader) => `INSERT INTO leadership_core_roster_bootstrap
      (term_number, role_key, role_name, member_name_hmac)
     VALUES (${termNumber}, ${quote(leader.roleKey)}, ${quote(leader.roleName)}, ${quote(hmac(leader.memberName))});`,
  ),
].join('\n');

const tempDirectory = await mkdtemp(path.join(tmpdir(), 'bni-pres-seed-'));
const seedPath = path.join(tempDirectory, 'seed.sql');
const wranglerEnvironment = {
  ...process.env,
  WRANGLER_LOG_PATH: '.wrangler/logs',
  WRANGLER_WRITE_LOGS: 'false',
};
try {
  await writeFile(seedPath, sql, { encoding: 'utf8', mode: 0o600 });
  const secretResult = spawnSync(
    'npx',
    [
      'wrangler',
      'secret',
      'put',
      'ROSTER_HMAC_SECRET',
      '--config',
      'wrangler.toml',
    ],
    {
      cwd: webRoot,
      env: wranglerEnvironment,
      input: `${secret}\n`,
      encoding: 'utf8',
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );
  if (secretResult.status !== 0) process.exit(secretResult.status || 1);

  const seedResult = spawnSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'bni-pres',
      '--remote',
      '--file',
      seedPath,
      '--config',
      'wrangler.toml',
    ],
    {
      cwd: webRoot,
      env: wranglerEnvironment,
      stdio: 'inherit',
    },
  );
  if (seedResult.status !== 0) process.exitCode = seedResult.status || 1;
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
