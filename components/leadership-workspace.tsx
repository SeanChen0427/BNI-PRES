'use client';

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Database,
  Download,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogIn,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toaster, toast } from '@/components/ui/toast';
import {
  STORAGE_KEY,
  applyOfficialSource,
  cloneWorkspace,
  createDemoWorkspace,
  createNextTerm,
  decisionStatusLabel,
  getActiveTerm,
  getAssignedMemberIds,
  getAssignmentsForMember,
  getMember,
  getRoleLabel,
  getTermIssues,
  getTermMetrics,
  isWorkspaceSnapshot,
  makeAssignmentId,
  memberNeedsRenewal,
  renewalStatusLabel,
  workspaceForPersistence,
  type Assignment,
  type DecisionStatus,
  type Member,
  type RenewalStatus,
  type TeamGroup,
  type TermState,
  type WorkspaceIssue,
  type WorkspaceState,
} from '@/lib/leadership';
import {
  hasOfficialSourceSession,
  loadOfficialWorkspace,
  loginAndLoadOfficialSource,
  restoreAndLoadOfficialSource,
  saveOfficialWorkspace,
  type OfficialSourceResult,
} from '@/lib/official-source';

type WorkspaceView = 'board' | 'people' | 'issues';
type CloudSyncStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'synced'
  | 'error';

const GROUP_VISUALS: Record<
  string,
  { accent: string; soft: string; badge: string; avatar: string }
> = {
  'group-pack': {
    accent: 'bg-emerald-500',
    soft: 'bg-emerald-50/80',
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    avatar: 'bg-emerald-100 text-emerald-800',
  },
  'group-membership': {
    accent: 'bg-sky-500',
    soft: 'bg-sky-50/80',
    badge: 'bg-sky-100 text-sky-800 ring-sky-200',
    avatar: 'bg-sky-100 text-sky-800',
  },
  'group-closing': {
    accent: 'bg-amber-500',
    soft: 'bg-amber-50/80',
    badge: 'bg-amber-100 text-amber-900 ring-amber-200',
    avatar: 'bg-amber-100 text-amber-900',
  },
  'group-reception': {
    accent: 'bg-violet-500',
    soft: 'bg-violet-50/80',
    badge: 'bg-violet-100 text-violet-800 ring-violet-200',
    avatar: 'bg-violet-100 text-violet-800',
  },
  'group-events': {
    accent: 'bg-rose-500',
    soft: 'bg-rose-50/80',
    badge: 'bg-rose-100 text-rose-800 ring-rose-200',
    avatar: 'bg-rose-100 text-rose-800',
  },
  'group-mentor': {
    accent: 'bg-indigo-500',
    soft: 'bg-indigo-50/80',
    badge: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
    avatar: 'bg-indigo-100 text-indigo-800',
  },
  'group-six-weeks': {
    accent: 'bg-orange-500',
    soft: 'bg-orange-50/80',
    badge: 'bg-orange-100 text-orange-800 ring-orange-200',
    avatar: 'bg-orange-100 text-orange-800',
  },
};

const FALLBACK_VISUAL = {
  accent: 'bg-slate-500',
  soft: 'bg-slate-50',
  badge: 'bg-slate-100 text-slate-800 ring-slate-200',
  avatar: 'bg-slate-100 text-slate-800',
};

const DECISION_STYLES: Record<DecisionStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800',
  tentative: 'bg-amber-100 text-amber-900',
  nominated: 'bg-slate-100 text-slate-700',
};

const ISSUE_META = {
  conflict: {
    label: '兼任需討論',
    icon: AlertTriangle,
    chip: 'bg-rose-100 text-rose-800',
  },
  renewal: {
    label: '會籍續約',
    icon: CalendarClock,
    chip: 'bg-amber-100 text-amber-900',
  },
  training: {
    label: '培訓未報名',
    icon: GraduationCap,
    chip: 'bg-sky-100 text-sky-800',
  },
} satisfies Record<WorkspaceIssue['kind'], object>;

const NAV_ITEMS = [
  { id: 'board' as const, label: '編組工作台', icon: LayoutDashboard },
  { id: 'people' as const, label: '依人員查看', icon: UsersRound },
  { id: 'issues' as const, label: '待處理事項', icon: AlertTriangle },
];

function shortDate(value: string): string {
  return value ? value.replaceAll('-', '/') : '尚待確認';
}

function shortName(name: string): string {
  return name.replace('測試會員・', '').slice(0, 1);
}

function savedLabel(value: string | null): string {
  if (!value) return '尚未儲存';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '已儲存';
  return `${date.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  })} 已儲存`;
}

function cloudSyncLabel(status: CloudSyncStatus): string {
  return {
    idle: '尚未連線',
    loading: '正在載入 D1',
    saving: '正在同步 D1',
    synced: 'D1 已同步',
    error: 'D1 同步失敗',
  }[status];
}

function getGroupVisual(groupId: string) {
  return GROUP_VISUALS[groupId] ?? FALLBACK_VISUAL;
}

function roleBadgeClass(term: TermState, roleId: string): string {
  const group = term.groups.find((item) => item.id === roleId);
  if (group) return getGroupVisual(group.id).badge;
  const ownerGroup = term.groups.find((item) =>
    item.coreRoleIds.includes(roleId),
  );
  return ownerGroup
    ? getGroupVisual(ownerGroup.id).badge
    : FALLBACK_VISUAL.badge;
}

function RoleBadge({ term, roleId }: { term: TermState; roleId: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${roleBadgeClass(
        term,
        roleId,
      )}`}
    >
      {getRoleLabel(term, roleId)}
    </span>
  );
}

function DecisionBadge({ status }: { status: DecisionStatus }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${DECISION_STYLES[status]}`}
    >
      {decisionStatusLabel(status)}
    </span>
  );
}

function Avatar({
  member,
  className = '',
}: {
  member: Member;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-black ${className}`}
    >
      {shortName(member.name)}
    </span>
  );
}

type TeamCardProps = {
  workspace: WorkspaceState;
  term: TermState;
  group: TeamGroup;
  onAdd: (roleId: string) => void;
  onMemberOpen: (memberId: string) => void;
  onRemove: (assignmentId: string) => void;
  onTrainingChange: (memberId: string, checked: boolean) => void;
};

function TeamCard({
  workspace,
  term,
  group,
  onAdd,
  onMemberOpen,
  onRemove,
  onTrainingChange,
}: TeamCardProps) {
  const visual = getGroupVisual(group.id);
  const groupAssignments = term.assignments.filter(
    (item) => item.kind === 'group' && item.roleId === group.id,
  );
  const isFull = groupAssignments.length >= group.capacity;

  return (
    <article
      id={group.id}
      className={`relative scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_30px_rgb(31_58_52/5%)] ${
        group.id === 'group-pack' ? '2xl:col-span-2' : ''
      }`}
    >
      <div className={`h-1.5 w-full ${visual.accent}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black tracking-tight">{group.title}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${visual.badge}`}
              >
                {group.memberRole}
              </span>
              {group.id === 'group-pack' ? (
                <span className="text-[10px] font-medium text-muted-foreground">
                  共用名單
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold">
              {groupAssignments.length} / {group.capacity}
            </p>
          </div>
        </div>

        <div
          className={`mt-4 grid gap-2 rounded-xl p-2.5 ${visual.soft} ${
            group.coreRoleIds.length > 1 ? 'sm:grid-cols-2' : ''
          }`}
        >
          {group.coreRoleIds.map((roleId) => {
            const role = term.coreRoles.find((item) => item.id === roleId);
            const current = term.assignments.find(
              (item) => item.kind === 'core' && item.roleId === roleId,
            );
            const member = current
              ? getMember(workspace, current.memberId)
              : undefined;

            return (
              <div
                key={roleId}
                className="rounded-xl bg-white/75 p-2.5 ring-1 ring-black/5"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {role?.shortLabel ?? '核心職務'}
                </p>
                {member ? (
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center gap-2 text-left"
                    onClick={() => onMemberOpen(member.id)}
                  >
                    <Avatar member={member} className={visual.avatar} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold">
                        {member.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                        {member.profession}
                      </span>
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-input px-2 py-2 text-xs font-bold text-primary hover:bg-white"
                    onClick={() => onAdd(roleId)}
                  >
                    <Plus className="size-3.5" />
                    補上核心人選
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          {groupAssignments.length ? (
            groupAssignments.map((item) => {
              const member = getMember(workspace, item.memberId);
              if (!member) return null;
              const positions = getAssignmentsForMember(term, member.id).length;
              const needsRenewal = memberNeedsRenewal(
                member,
                term.settings.renewalThreshold,
              );

              return (
                <div
                  key={item.id}
                  className="group/member rounded-xl border border-border/80 bg-background/45 p-2.5 transition hover:border-primary/25 hover:bg-background"
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      onClick={() => onMemberOpen(member.id)}
                    >
                      <Avatar member={member} className={visual.avatar} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold">
                            {member.name}
                          </span>
                          {positions > 1 ? (
                            <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-800">
                              {positions} 職位
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {member.profession}・到期{' '}
                          {shortDate(member.expiryDate)}
                        </span>
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="-mr-1 text-muted-foreground opacity-70 hover:text-destructive sm:opacity-0 sm:group-hover/member:opacity-100"
                      aria-label={`移除 ${member.name}`}
                      onClick={() => onRemove(item.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2.5">
                    <DecisionBadge status={item.decision} />
                    {needsRenewal ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">
                        <CalendarClock className="size-3" />
                        需續約
                      </span>
                    ) : null}
                    <label className="ml-auto flex min-h-6 items-center gap-1.5 rounded-md px-1 text-[10px] font-bold text-muted-foreground hover:bg-muted">
                      <Checkbox
                        checked={Boolean(term.training[member.id])}
                        onCheckedChange={(checked) =>
                          onTrainingChange(member.id, checked === true)
                        }
                        aria-label={`${member.name}培訓已報名`}
                      />
                      培訓已報名
                    </label>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-input bg-muted/25 px-3 py-5 text-center">
              <p className="text-xs font-bold text-muted-foreground">
                尚未安排{group.memberRole}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/75">
                新屆次只複製結構，不會帶入上一屆人選
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isFull}
          onClick={() => onAdd(group.id)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-input py-2.5 text-xs font-bold text-primary transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Plus className="size-3.5" />
          {isFull ? '名額已滿' : `加入${group.memberRole}`}
        </button>
      </div>
    </article>
  );
}

function LeadershipWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    createDemoWorkspace(),
  );
  const [history, setHistory] = useState<WorkspaceState[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<WorkspaceView>('board');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [targetRoleId, setTargetRoleId] = useState('group-pack');
  const [memberOpen, setMemberOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [draftRenewalThreshold, setDraftRenewalThreshold] = useState('');
  const [draftTrainingDate, setDraftTrainingDate] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceEmail, setSourceEmail] = useState('');
  const [sourcePassword, setSourcePassword] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [cloudSyncStatus, setCloudSyncStatus] =
    useState<CloudSyncStatus>('idle');
  const importInputRef = useRef<HTMLInputElement>(null);
  const sourceRestoreStarted = useRef(false);
  const cloudReady = useRef(false);
  const cloudSaveSequence = useRef(0);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isWorkspaceSnapshot(parsed)) setWorkspace(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(workspaceForPersistence(workspace)),
    );
  }, [hydrated, workspace]);

  useEffect(() => {
    if (!hydrated || sourceRestoreStarted.current) return;
    sourceRestoreStarted.current = true;
    if (!hasOfficialSourceSession()) {
      setSourceOpen(true);
      return;
    }

    setSourceLoading(true);
    void restoreAndLoadOfficialSource()
      .then(async (result) => {
        if (!result) {
          setSourceOpen(true);
          return;
        }
        await acceptOfficialSource(result, '正式姓名與會籍已載入', true);
      })
      .catch((error: unknown) => {
        setSourceError(
          error instanceof Error ? error.message : '正式資料讀取失敗',
        );
        setSourceOpen(true);
      })
      .finally(() => setSourceLoading(false));
  }, [hydrated]);

  useEffect(() => {
    if (
      !hydrated ||
      !cloudReady.current ||
      workspace.sourceMeta?.mode !== 'official'
    ) {
      return;
    }
    const sequence = ++cloudSaveSequence.current;
    setCloudSyncStatus('saving');
    const timer = window.setTimeout(() => {
      void saveOfficialWorkspace(workspaceForPersistence(workspace))
        .then(() => {
          if (sequence === cloudSaveSequence.current) {
            setCloudSyncStatus('synced');
          }
        })
        .catch((error: unknown) => {
          if (sequence !== cloudSaveSequence.current) return;
          setCloudSyncStatus('error');
          toast.add({
            title: 'D1 同步失敗',
            description:
              error instanceof Error ? error.message : '請稍後重試',
            type: 'error',
          });
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [hydrated, workspace]);

  const term = getActiveTerm(workspace);
  const metrics = useMemo(
    () => getTermMetrics(workspace, term),
    [workspace, term],
  );
  const issues = useMemo(
    () => getTermIssues(workspace, term),
    [workspace, term],
  );
  const isOfficial = workspace.sourceMeta?.mode === 'official';

  async function acceptOfficialSource(
    result: OfficialSourceResult,
    message: string,
    loadCloud = false,
  ) {
    setCloudSyncStatus(loadCloud ? 'loading' : 'saving');
    let baseWorkspace = workspaceRef.current;
    if (loadCloud) {
      const cloudWorkspace = await loadOfficialWorkspace();
      if (cloudWorkspace && isWorkspaceSnapshot(cloudWorkspace)) {
        baseWorkspace = cloudWorkspace;
      }
    }
    const officialIds = new Set(result.members.map((member) => member.id));
    const matched = result.roster.coreLeaders.filter(
      (leader) => leader.memberId && officialIds.has(leader.memberId),
    ).length;
    const next = applyOfficialSource(
      baseWorkspace,
      result.members,
      result.roster,
      result.sourceMeta,
    );
    cloudReady.current = true;
    workspaceRef.current = next;
    setWorkspace(next);
    setHistory([]);
    toast.add({
      title: message,
      description: `${result.members.length} 位現任會員・8 長對上 ${matched}/8 位`,
      type: matched === 8 ? 'success' : 'warning',
    });
  }

  async function connectOfficialSource() {
    setSourceLoading(true);
    setSourceError('');
    try {
      const result = await loginAndLoadOfficialSource(
        sourceEmail,
        sourcePassword,
      );
      await acceptOfficialSource(result, '正式姓名與會籍已載入', true);
      setSourcePassword('');
      setSourceOpen(false);
    } catch (error) {
      setSourceError(
        error instanceof Error ? error.message : '正式資料讀取失敗',
      );
    } finally {
      setSourceLoading(false);
    }
  }

  async function refreshOfficialSource() {
    setSourceLoading(true);
    setSourceError('');
    try {
      const result = await restoreAndLoadOfficialSource();
      if (!result) {
        setSourceOpen(true);
        return;
      }
      await acceptOfficialSource(result, '正式資料已重新讀取');
    } catch (error) {
      setSourceError(
        error instanceof Error ? error.message : '正式資料讀取失敗',
      );
      setSourceOpen(true);
    } finally {
      setSourceLoading(false);
    }
  }

  const roleOptions = useMemo(
    () => [
      ...term.coreRoles.map((role) => ({
        id: role.id,
        label: `核心・${role.shortLabel}`,
        kind: 'core' as const,
      })),
      ...term.groups.map((group) => ({
        id: group.id,
        label: `小組・${group.memberRole}`,
        kind: 'group' as const,
      })),
    ],
    [term],
  );

  const assignedPeople = useMemo(() => {
    return getAssignedMemberIds(term)
      .map((memberId) => getMember(workspace, memberId))
      .filter((member): member is Member => Boolean(member))
      .sort((a, b) => {
        const countDifference =
          getAssignmentsForMember(term, b.id).length -
          getAssignmentsForMember(term, a.id).length;
        return countDifference || a.name.localeCompare(b.name, 'zh-Hant');
      });
  }, [term, workspace]);

  const displayedPeople = assignedPeople.filter((member) => {
    const query = peopleSearch.trim().toLocaleLowerCase('zh-Hant');
    if (!query) return true;
    const roleText = getAssignmentsForMember(term, member.id)
      .map((item) => getRoleLabel(term, item.roleId))
      .join(' ');
    return `${member.name} ${member.profession} ${roleText}`
      .toLocaleLowerCase('zh-Hant')
      .includes(query);
  });

  const candidateMembers = workspace.members.filter((member) => {
    const query = addSearch.trim().toLocaleLowerCase('zh-Hant');
    const matches = !query
      ? true
      : `${member.name} ${member.profession}`
          .toLocaleLowerCase('zh-Hant')
          .includes(query);
    const alreadyInRole = term.assignments.some(
      (item) => item.memberId === member.id && item.roleId === targetRoleId,
    );
    return matches && !alreadyInRole;
  });

  const selectedMember = selectedMemberId
    ? getMember(workspace, selectedMemberId)
    : undefined;

  function commit(
    recipe: (current: WorkspaceState) => WorkspaceState,
    message?: string,
  ) {
    setWorkspace((current) => {
      setHistory((items) => [...items, cloneWorkspace(current)].slice(-20));
      const next = recipe(cloneWorkspace(current));
      return { ...next, lastSavedAt: new Date().toISOString() };
    });
    if (message) toast.add({ title: message, type: 'success' });
  }

  function updateActiveTerm(
    current: WorkspaceState,
    update: (active: TermState) => TermState,
  ): WorkspaceState {
    return {
      ...current,
      terms: current.terms.map((item) =>
        item.id === current.activeTermId ? update(item) : item,
      ),
    };
  }

  function undo() {
    setHistory((items) => {
      const previous = items.at(-1);
      if (!previous) return items;
      setWorkspace({ ...previous, lastSavedAt: new Date().toISOString() });
      toast.add({ title: '已復原上一個動作', type: 'info' });
      return items.slice(0, -1);
    });
  }

  function openAdd(roleId: string) {
    setTargetRoleId(roleId);
    setAddSearch('');
    setAddOpen(true);
  }

  function addMember(memberId: string) {
    const option = roleOptions.find((item) => item.id === targetRoleId);
    if (!option) return;

    const roleAssignments = term.assignments.filter(
      (item) => item.roleId === targetRoleId,
    );
    const capacity =
      option.kind === 'core'
        ? 1
        : (term.groups.find((group) => group.id === targetRoleId)?.capacity ??
          0);
    if (roleAssignments.length >= capacity) {
      toast.add({
        title: '這個職位目前沒有空位',
        description: '請先移除或改派現有人選。',
        type: 'warning',
      });
      return;
    }

    commit(
      (current) =>
        updateActiveTerm(current, (active) => ({
          ...active,
          assignments: [
            ...active.assignments,
            {
              id: makeAssignmentId(),
              memberId,
              roleId: targetRoleId,
              kind: option.kind,
              decision: 'tentative',
            },
          ],
          training: {
            ...active.training,
            [memberId]: active.training[memberId] ?? false,
          },
        })),
      '已加入名單並設為會議暫定',
    );
    setAddOpen(false);
  }

  function removeAssignment(assignmentId: string) {
    commit(
      (current) =>
        updateActiveTerm(current, (active) => ({
          ...active,
          assignments: active.assignments.filter(
            (item) => item.id !== assignmentId,
          ),
        })),
      '已移除人選，可使用復原還原',
    );
  }

  function toggleTraining(memberId: string, checked: boolean) {
    commit((current) =>
      updateActiveTerm(current, (active) => ({
        ...active,
        training: { ...active.training, [memberId]: checked },
      })),
    );
  }

  function updateDecision(assignmentId: string, decision: DecisionStatus) {
    commit((current) =>
      updateActiveTerm(current, (active) => ({
        ...active,
        assignments: active.assignments.map((item) =>
          item.id === assignmentId ? { ...item, decision } : item,
        ),
      })),
    );
  }

  function moveAssignment(assignment: Assignment, roleId: string) {
    if (roleId === assignment.roleId) return;
    const option = roleOptions.find((item) => item.id === roleId);
    if (!option || option.kind !== assignment.kind) return;
    const alreadyAssigned = term.assignments.some(
      (item) => item.memberId === assignment.memberId && item.roleId === roleId,
    );
    const capacity =
      option.kind === 'core'
        ? 1
        : (term.groups.find((group) => group.id === roleId)?.capacity ?? 0);
    const filled = term.assignments.filter(
      (item) => item.roleId === roleId,
    ).length;
    if (alreadyAssigned || filled >= capacity) {
      toast.add({
        title: alreadyAssigned ? '此人已在該職位' : '目標職位沒有空位',
        type: 'warning',
      });
      return;
    }

    commit(
      (current) =>
        updateActiveTerm(current, (active) => ({
          ...active,
          assignments: active.assignments.map((item) =>
            item.id === assignment.id ? { ...item, roleId } : item,
          ),
        })),
      '職位已改派',
    );
  }

  function updateRenewal(memberId: string, status: RenewalStatus) {
    commit((current) =>
      updateActiveTerm(current, (active) => ({
        ...active,
        renewal: { ...active.renewal, [memberId]: status },
      })),
    );
  }

  function openMember(memberId: string) {
    setSelectedMemberId(memberId);
    setMemberOpen(true);
  }

  function focusIssue(issue: WorkspaceIssue) {
    setPeopleSearch(issue.memberId);
    setView('people');
    setPeopleSearch(getMember(workspace, issue.memberId)?.name ?? '');
  }

  function changeTerm(termId: string) {
    setWorkspace((current) => ({
      ...current,
      activeTermId: termId,
      lastSavedAt: new Date().toISOString(),
    }));
    setView('board');
    setPeopleSearch('');
  }

  function addNextTerm() {
    commit((current) => createNextTerm(current), '已建立下一屆空白編組');
    setView('board');
  }

  function openSettings() {
    setDraftRenewalThreshold(term.settings.renewalThreshold);
    setDraftTrainingDate(term.settings.trainingDate);
    setSettingsOpen(true);
  }

  function saveSettings() {
    if (!draftRenewalThreshold || !draftTrainingDate) return;
    commit(
      (current) =>
        updateActiveTerm(current, (active) => ({
          ...active,
          settings: {
            ...active.settings,
            renewalThreshold: draftRenewalThreshold,
            trainingDate: draftTrainingDate,
          },
        })),
      isOfficial ? '工作台設定已保存並同步' : '測試設定已保存',
    );
    setSettingsOpen(false);
  }

  function exportBackup() {
    const exportWorkspace = workspaceForPersistence(workspace);
    const blob = new Blob([JSON.stringify(exportWorkspace, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fulian-leadership-work-term-${term.number}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.add({
      title: '工作資料備份已匯出',
      description: isOfficial
        ? '正式姓名與會籍未寫入備份，還原後重新連接來源即可。'
        : undefined,
      type: 'success',
    });
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isWorkspaceSnapshot(parsed)) {
        throw new Error('invalid snapshot');
      }
      commit(() => cloneWorkspace(parsed), '備份已還原');
      setBackupOpen(false);
    } catch {
      toast.add({
        title: '無法匯入這份備份',
        description: '請確認檔案是本工作台匯出的 v1 JSON。',
        type: 'error',
      });
    }
  }

  const pageTitle = {
    board: `${term.label}領導團隊編組`,
    people: '依人員查看',
    issues: '會議待處理事項',
  }[view];

  return (
    <Toaster>
      <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen bg-sidebar px-5 py-6 text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex items-center gap-3 px-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-sidebar-primary font-black text-sidebar-primary-foreground shadow-sm">
              富
            </span>
            <div>
              <p className="font-semibold tracking-wide">富聯</p>
              <p className="text-xs text-sidebar-foreground/60">
                領導團隊工作台
              </p>
            </div>
          </div>

          <nav className="mt-10 space-y-1" aria-label="主要導覽">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => {
                  setView(item.id);
                  setPeopleSearch('');
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  view === item.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
                {item.id === 'issues' && issues.length ? (
                  <span className="ml-auto rounded-full bg-amber-300 px-2 py-0.5 text-xs font-semibold text-amber-950">
                    {issues.length}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="mt-8 border-t border-sidebar-border/60 pt-6">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/40">
              屆次
            </p>
            <div className="mt-2 space-y-1">
              {workspace.terms.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeTerm(item.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                    term.id === item.id
                      ? 'bg-white/10 text-white'
                      : 'text-sidebar-foreground/55 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      item.status === 'archived'
                        ? 'bg-slate-400'
                        : item.status === 'active'
                          ? 'bg-emerald-400'
                          : 'bg-amber-300'
                    }`}
                  />
                  {item.label}
                  <span className="ml-auto text-[10px] font-medium opacity-50">
                    {item.status === 'planning' ? '規劃中' : item.status}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={addNextTerm}
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-amber-200 hover:bg-white/5"
            >
              <Plus className="size-3.5" />
              建立下一屆
            </button>
          </div>

          <div className="mt-auto space-y-3">
            <div className="rounded-2xl border border-sidebar-border bg-white/5 p-4">
              <div
                className={`flex items-center gap-2 text-xs font-semibold ${
                  isOfficial ? 'text-emerald-200' : 'text-amber-200'
                }`}
              >
                {isOfficial ? (
                  <ShieldCheck className="size-3.5" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {isOfficial ? '正式唯讀資料' : '虛構資料模式'}
              </div>
              <p className="mt-2 text-xs leading-5 text-sidebar-foreground/60">
                {isOfficial
                  ? `會員主檔 ${workspace.sourceMeta?.memberCount ?? workspace.members.length} 位；會籍資料只在登入期間讀取。`
                  : `Demo adapter，共 ${workspace.members.length} 位測試會員。`}
              </p>
              <button
                type="button"
                onClick={() =>
                  isOfficial
                    ? void refreshOfficialSource()
                    : setSourceOpen(true)
                }
                className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-white/85 hover:text-white"
              >
                {sourceLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : isOfficial ? (
                  <RefreshCw className="size-3" />
                ) : (
                  <LogIn className="size-3" />
                )}
                {isOfficial ? '重新讀取' : '載入正式資料'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setBackupOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-sidebar-border py-2.5 text-xs font-bold text-sidebar-foreground/75 hover:bg-white/5 hover:text-white"
            >
              <Database className="size-3.5" />
              備份與還原
            </button>
          </div>
        </aside>

        <section className="min-w-0 pb-20 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6 xl:px-8">
            <div className="mx-auto flex max-w-[1560px] items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary font-black text-primary-foreground lg:hidden">
                  富
                </span>
                <Select
                  value={term.id}
                  onValueChange={(value) => value && changeTerm(value)}
                >
                  <SelectTrigger className="h-9 min-w-[108px] bg-card font-bold shadow-sm">
                    <SelectValue>{term.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {workspace.terms.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  {cloudSyncStatus === 'saving' ||
                  cloudSyncStatus === 'loading' ? (
                    <Loader2 className="size-3.5 animate-spin text-sky-600" />
                  ) : (
                    <Check
                      className={`size-3.5 ${
                        cloudSyncStatus === 'error'
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    />
                  )}
                  {isOfficial
                    ? cloudSyncLabel(cloudSyncStatus)
                    : savedLabel(workspace.lastSavedAt)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="hidden bg-card sm:inline-flex"
                  disabled={!history.length}
                  onClick={undo}
                >
                  <RotateCcw data-icon="inline-start" />
                  復原
                </Button>
                <Button
                  variant="outline"
                  className="hidden bg-card md:inline-flex"
                  onClick={() => setBackupOpen(true)}
                >
                  <Database data-icon="inline-start" />
                  備份
                </Button>
                <Button
                  variant="outline"
                  className="bg-card px-3"
                  aria-label="工作台設定"
                  onClick={openSettings}
                >
                  <Settings2 data-icon="inline-start" />
                  <span className="hidden md:inline">設定</span>
                </Button>
                <Button
                  className="bg-primary px-3.5 hover:bg-primary/90"
                  onClick={() =>
                    openAdd(term.groups[0]?.id ?? term.coreRoles[0]?.id ?? '')
                  }
                >
                  <Plus data-icon="inline-start" />
                  <span className="hidden sm:inline">加入成員</span>
                  <span className="sm:hidden">加入</span>
                </Button>
              </div>
            </div>
          </header>

          <div className="border-b border-border/60 bg-card/45 px-4 lg:hidden">
            <nav
              className="mx-auto flex max-w-[1560px] gap-1 overflow-x-auto py-2"
              aria-label="畫面切換"
            >
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setView(item.id);
                    setPeopleSearch('');
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
                    view === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                  {item.id === 'issues' && issues.length ? (
                    <span className="rounded-full bg-amber-300 px-1.5 text-[10px] text-amber-950">
                      {issues.length}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>

          <div className="mx-auto max-w-[1560px] px-4 py-7 sm:px-6 xl:px-8">
            <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
                    {term.status === 'planning' ? '規劃中' : term.status}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {term.meetingDate
                      ? `8 長名單會議・${shortDate(term.meetingDate)}`
                      : '會議日期尚待安排'}
                  </span>
                </div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  {pageTitle}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {view === 'board'
                    ? '調整人選後，兼任、續約與培訓缺口會立即同步更新。'
                    : view === 'people'
                      ? '每位成員只出現一次，依職位數從多至少排列。'
                      : '把需要會議決定與會後追蹤的項目集中處理。'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  ['已安排', metrics.assignedPeople, '人'],
                  ['仍有缺口', metrics.gaps, '席'],
                  ['待處理', issues.length, '項'],
                ].map(([label, value, unit]) => (
                  <Card
                    key={String(label)}
                    className="min-w-[96px] border-none bg-card/90 shadow-sm ring-border/80"
                  >
                    <CardContent className="px-3 py-3.5 sm:px-4">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {label}
                      </p>
                      <p className="mt-0.5 text-2xl font-black tracking-tight">
                        {value}{' '}
                        <span className="text-xs font-medium text-muted-foreground">
                          {unit}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {view === 'board' ? (
              <>
                <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <section className="min-w-0 rounded-3xl border border-border/80 bg-card/70 p-4 shadow-[0_18px_50px_rgb(30_58_52/6%)] sm:p-5">
                    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-black">8 核與下層編組</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          主席與成長共用領頭羊；每個有效安排都計入職位數。
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-muted-foreground">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
                          {metrics.confirmedPositions} 已定案
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1">
                          {metrics.positions} / {metrics.capacity} 職位
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {term.groups.map((group) => (
                        <TeamCard
                          key={group.id}
                          workspace={workspace}
                          term={term}
                          group={group}
                          onAdd={openAdd}
                          onMemberOpen={openMember}
                          onRemove={removeAssignment}
                          onTrainingChange={toggleTraining}
                        />
                      ))}
                    </div>
                  </section>

                  <aside className="space-y-4">
                    <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-[0_18px_50px_rgb(22_85_76/18%)] xl:sticky xl:top-24">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black">會議待處理</p>
                          <p className="mt-1 text-xs text-primary-foreground/65">
                            依急迫性排序
                          </p>
                        </div>
                        <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-sm font-black">
                          {issues.length}
                        </span>
                      </div>

                      <div className="mt-5 space-y-2.5">
                        {issues.slice(0, 5).map((issue) => {
                          const meta = ISSUE_META[issue.kind];
                          const Icon = meta.icon;
                          return (
                            <button
                              key={issue.id}
                              type="button"
                              onClick={() => focusIssue(issue)}
                              className="flex w-full gap-3 rounded-2xl bg-white/9 p-3 text-left transition hover:bg-white/14"
                            >
                              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-300 text-amber-950">
                                <Icon className="size-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-bold">
                                  {issue.title}
                                </span>
                                <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-primary-foreground/65">
                                  {issue.detail}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                        {!issues.length ? (
                          <div className="rounded-2xl bg-white/9 px-4 py-8 text-center">
                            <CheckCircle2 className="mx-auto size-6 text-emerald-300" />
                            <p className="mt-2 text-xs font-bold">
                              目前沒有待處理項目
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => setView('issues')}
                        className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/20 py-2.5 text-xs font-bold hover:bg-white/10"
                      >
                        查看全部
                        <ArrowRight className="size-3.5" />
                      </button>

                      <div className="mt-5 border-t border-white/15 pt-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-200">
                          {isOfficial ? (
                            <ShieldCheck className="size-3.5" />
                          ) : (
                            <Database className="size-3.5" />
                          )}
                          {isOfficial
                            ? '正式會員主檔唯讀連線'
                            : 'Demo adapter 已連線'}
                        </div>
                        <p className="mt-1.5 text-[10px] leading-4 text-primary-foreground/55">
                          {isOfficial
                            ? `本次載入 ${workspace.sourceMeta?.memberCount ?? workspace.members.length} 位；姓名與會籍不寫入 Git 或本機備份。`
                            : '使用版本化虛構資料；可由上方載入正式來源。'}
                        </p>
                      </div>
                    </section>
                  </aside>
                </div>
              </>
            ) : null}

            {view === 'people' ? (
              <section className="mt-6 overflow-hidden rounded-3xl border border-border/80 bg-card/85 shadow-[0_18px_50px_rgb(30_58_52/6%)]">
                <div className="flex flex-col justify-between gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
                  <div>
                    <p className="text-sm font-black">人員與全部職位</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {assignedPeople.length} 位成員・{metrics.positions}{' '}
                      個有效安排
                    </p>
                  </div>
                  <label className="relative block w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={peopleSearch}
                      onChange={(event) => setPeopleSearch(event.target.value)}
                      className="h-9 bg-background pl-9"
                      placeholder="搜尋姓名、專業別或職位"
                    />
                  </label>
                </div>

                {displayedPeople.length ? (
                  <div className="divide-y divide-border">
                    {displayedPeople.map((member) => {
                      const assignments = getAssignmentsForMember(
                        term,
                        member.id,
                      );
                      const needsRenewal = memberNeedsRenewal(
                        member,
                        term.settings.renewalThreshold,
                      );
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => openMember(member.id)}
                          className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-muted/35 sm:grid-cols-[minmax(220px,1fr)_minmax(260px,1.5fr)_160px_36px] sm:items-center sm:px-5"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <Avatar
                              member={member}
                              className={
                                assignments.length > 1
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-primary/10 text-primary'
                              }
                            />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-black">
                                  {member.name}
                                </span>
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-black text-muted-foreground">
                                  {assignments.length} 職位
                                </span>
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {member.profession}
                              </span>
                            </span>
                          </span>
                          <span className="flex flex-wrap gap-1.5">
                            {assignments.map((item) => (
                              <RoleBadge
                                key={item.id}
                                term={term}
                                roleId={item.roleId}
                              />
                            ))}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                            {needsRenewal ? (
                              <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">
                                續約・{shortDate(member.expiryDate)}
                              </span>
                            ) : (
                              <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">
                                會籍至 {shortDate(member.expiryDate)}
                              </span>
                            )}
                            <span
                              className={`rounded-md px-2 py-1 ${
                                term.training[member.id]
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {term.training[member.id]
                                ? '培訓已報名'
                                : '培訓未報名'}
                            </span>
                          </span>
                          <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-16 text-center">
                    <UsersRound className="mx-auto size-8 text-muted-foreground/40" />
                    <p className="mt-3 text-sm font-black">
                      {assignedPeople.length
                        ? '找不到符合條件的成員'
                        : '這個屆次尚未安排人選'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {assignedPeople.length
                        ? '試著清除搜尋條件。'
                        : `新屆次只複製職務結構，請從${isOfficial ? '正式' : '虛構'}會員名單開始安排。`}
                    </p>
                    {!assignedPeople.length ? (
                      <Button
                        className="mt-5"
                        onClick={() => openAdd(term.groups[0]?.id ?? '')}
                      >
                        <Plus data-icon="inline-start" />
                        加入第一位成員
                      </Button>
                    ) : null}
                  </div>
                )}
              </section>
            ) : null}

            {view === 'issues' ? (
              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                {(['conflict', 'renewal', 'training'] as const).map((kind) => {
                  const meta = ISSUE_META[kind];
                  const Icon = meta.icon;
                  const kindIssues = issues.filter(
                    (issue) => issue.kind === kind,
                  );
                  return (
                    <section
                      key={kind}
                      className="overflow-hidden rounded-3xl border border-border bg-card/90 shadow-[0_12px_35px_rgb(30_58_52/5%)]"
                    >
                      <div className="flex items-center justify-between border-b border-border px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`grid size-9 place-items-center rounded-xl ${meta.chip}`}
                          >
                            <Icon className="size-4" />
                          </span>
                          <div>
                            <p className="text-sm font-black">{meta.label}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {kindIssues.length} 項
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="divide-y divide-border">
                        {kindIssues.map((issue) => (
                          <button
                            key={issue.id}
                            type="button"
                            onClick={() => openMember(issue.memberId)}
                            className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-muted/35"
                          >
                            <span
                              className={`mt-0.5 size-2 shrink-0 rounded-full ${
                                issue.severity === 'high'
                                  ? 'bg-rose-500'
                                  : 'bg-amber-500'
                              }`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-black">
                                {issue.title}
                              </span>
                              <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                                {issue.detail}
                              </span>
                            </span>
                            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                        {!kindIssues.length ? (
                          <div className="px-5 py-12 text-center">
                            <CheckCircle2 className="mx-auto size-6 text-emerald-500" />
                            <p className="mt-2 text-xs font-bold text-muted-foreground">
                              目前沒有此類問題
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>載入正式姓名與會籍</DialogTitle>
              <DialogDescription>
                使用既有副主席系統帳密登入。只會唯讀現任會員主檔與已發布快照，密碼不保存。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-xs font-bold">
                來源帳號 Email
                <Input
                  type="email"
                  autoComplete="username"
                  value={sourceEmail}
                  onChange={(event) => setSourceEmail(event.target.value)}
                  placeholder="輸入現有共用帳號"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold">
                密碼
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={sourcePassword}
                  onChange={(event) => setSourcePassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !sourceLoading) {
                      void connectOfficialSource();
                    }
                  }}
                  placeholder="輸入現有共用密碼"
                />
              </label>
              {sourceError ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-800">
                  {sourceError}
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSourceOpen(false)}>
                稍後再載入
              </Button>
              <Button
                disabled={sourceLoading || !sourceEmail || !sourcePassword}
                onClick={() => void connectOfficialSource()}
              >
                {sourceLoading ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <LogIn data-icon="inline-start" />
                )}
                讀取正式資料
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                從{isOfficial ? '正式' : '虛構'}會員名單加入人選
              </DialogTitle>
              <DialogDescription>
                選擇職位後加入；新安排預設為「會議暫定」，並立即重算所有警示。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-[190px_1fr]">
              <Select
                value={targetRoleId}
                onValueChange={(value) => value && setTargetRoleId(value)}
              >
                <SelectTrigger className="h-9 w-full bg-background">
                  <SelectValue>
                    {
                      roleOptions.find((item) => item.id === targetRoleId)
                        ?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={addSearch}
                  onChange={(event) => setAddSearch(event.target.value)}
                  className="h-9 bg-background pl-9"
                  placeholder="搜尋姓名或專業別"
                />
              </label>
            </div>

            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {candidateMembers.slice(0, 16).map((member) => {
                const positionCount = getAssignmentsForMember(
                  term,
                  member.id,
                ).length;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => addMember(member.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/45 p-3 text-left hover:border-primary/30 hover:bg-primary/5"
                  >
                    <Avatar
                      member={member}
                      className="bg-primary/10 text-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-black">
                        {member.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {member.profession}・會籍至{' '}
                        {shortDate(member.expiryDate)}
                      </span>
                    </span>
                    {positionCount ? (
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-800">
                        已有 {positionCount} 職位
                      </span>
                    ) : (
                      <Plus className="size-4 text-primary" />
                    )}
                  </button>
                );
              })}
              {!candidateMembers.length ? (
                <div className="rounded-xl border border-dashed border-input px-4 py-10 text-center text-xs text-muted-foreground">
                  找不到可加入的{isOfficial ? '正式會員' : '測試會員'}
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
          <DialogContent className="sm:max-w-xl">
            {selectedMember ? (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 pr-8">
                    <Avatar
                      member={selectedMember}
                      className="bg-primary text-primary-foreground"
                    />
                    <div>
                      <DialogTitle>{selectedMember.name}</DialogTitle>
                      <DialogDescription className="mt-1">
                        {selectedMember.profession}・
                        {selectedMember.source === 'official-read-only'
                          ? '正式會員主檔（唯讀）'
                          : `Demo ID ${selectedMember.id}`}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-muted/45 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      會籍
                    </p>
                    <p className="mt-1 text-xs font-black">
                      到期 {shortDate(selectedMember.expiryDate)}
                    </p>
                    {memberNeedsRenewal(
                      selectedMember,
                      term.settings.renewalThreshold,
                    ) ? (
                      <Select
                        value={
                          term.renewal[selectedMember.id] ?? 'needs-action'
                        }
                        onValueChange={(value) =>
                          updateRenewal(
                            selectedMember.id,
                            value as RenewalStatus,
                          )
                        }
                      >
                        <SelectTrigger className="mt-2 h-8 w-full bg-card">
                          <SelectValue>
                            {renewalStatusLabel(
                              term.renewal[selectedMember.id] ?? 'needs-action',
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            [
                              'needs-action',
                              'reminded',
                              'in-progress',
                              'completed',
                            ] as RenewalStatus[]
                          ).map((status) => (
                            <SelectItem key={status} value={status}>
                              {renewalStatusLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-2 text-[11px] font-bold text-emerald-700">
                        目前不需續約
                      </p>
                    )}
                  </div>

                  <label className="flex items-center gap-3 rounded-xl bg-sky-50 p-3 text-sky-950">
                    <Checkbox
                      checked={Boolean(term.training[selectedMember.id])}
                      onCheckedChange={(checked) =>
                        toggleTraining(selectedMember.id, checked === true)
                      }
                    />
                    <span>
                      <span className="block text-xs font-black">
                        {shortDate(term.settings.trainingDate)} 培訓
                      </span>
                      <span className="mt-0.5 block text-[10px] text-sky-800/75">
                        勾選代表已完成報名
                      </span>
                    </span>
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    全部職位
                  </p>
                  <div className="space-y-2">
                    {getAssignmentsForMember(term, selectedMember.id).map(
                      (item) => (
                        <div
                          key={item.id}
                          className="grid gap-2 rounded-xl border border-border bg-background/45 p-3 sm:grid-cols-[minmax(0,1fr)_130px_34px] sm:items-center"
                        >
                          <div>
                            <RoleBadge term={term} roleId={item.roleId} />
                            <Select
                              value={item.roleId}
                              onValueChange={(value) =>
                                value && moveAssignment(item, value)
                              }
                            >
                              <SelectTrigger className="mt-2 h-8 w-full bg-card text-xs">
                                <SelectValue>
                                  改派：{getRoleLabel(term, item.roleId)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {roleOptions
                                  .filter((option) => option.kind === item.kind)
                                  .map((option) => (
                                    <SelectItem
                                      key={option.id}
                                      value={option.id}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Select
                            value={item.decision}
                            onValueChange={(value) =>
                              updateDecision(item.id, value as DecisionStatus)
                            }
                          >
                            <SelectTrigger className="h-8 w-full bg-card text-xs">
                              <SelectValue>
                                {decisionStatusLabel(item.decision)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                [
                                  'nominated',
                                  'tentative',
                                  'confirmed',
                                ] as DecisionStatus[]
                              ).map((status) => (
                                <SelectItem key={status} value={status}>
                                  {decisionStatusLabel(status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="移除此職位"
                            onClick={() => removeAssignment(item.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>工作台設定</DialogTitle>
              <DialogDescription>
                集中查看正式資料來源，並設定本屆的續約與培訓提醒。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <section
                className={`rounded-2xl border p-4 ${
                  isOfficial
                    ? workspace.sourceMeta?.reconciliation === 'mismatch'
                      ? 'border-rose-200 bg-rose-50/80'
                      : 'border-emerald-200 bg-emerald-50/80'
                    : 'border-amber-200 bg-amber-50/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid size-8 place-items-center rounded-xl ${
                        isOfficial
                          ? workspace.sourceMeta?.reconciliation === 'mismatch'
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-emerald-200 text-emerald-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {isOfficial ? (
                        <ShieldCheck className="size-4" />
                      ) : (
                        <Database className="size-4" />
                      )}
                    </span>
                    <div>
                      <p className="text-xs font-black">正式資料來源</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {isOfficial
                          ? '會員主檔已載入，只讀不回寫'
                          : '目前使用虛構測試資料'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                      isOfficial
                        ? workspace.sourceMeta?.reconciliation === 'mismatch'
                          ? 'bg-rose-200 text-rose-950'
                          : 'bg-emerald-200 text-emerald-950'
                        : 'bg-amber-200 text-amber-950'
                    }`}
                  >
                    {isOfficial
                      ? workspace.sourceMeta?.reconciliation === 'mismatch'
                        ? '待對帳'
                        : '已載入'
                      : '待載入'}
                  </span>
                </div>

                {isOfficial ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    {[
                      [
                        '現任會員',
                        `${workspace.sourceMeta?.memberCount ?? workspace.members.length} 位`,
                      ],
                      [
                        '會籍缺值',
                        `${workspace.sourceMeta?.missingExpiryCount ?? 0} 位`,
                      ],
                      [
                        '8 長對上',
                        `${workspace.sourceMeta?.coreRosterMatched ?? 0}/${workspace.sourceMeta?.coreRosterExpected ?? 8} 位`,
                      ],
                      [
                        '分析快照',
                        `${workspace.sourceMeta?.snapshotMemberCount ?? '未提供'} 人`,
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white/70 p-2.5">
                        <p className="text-muted-foreground">{label}</p>
                        <p className="mt-1 font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] leading-5 text-amber-950/75">
                    登入既有副主席系統後，會讀取 Supabase
                    正式姓名與會籍；密碼不會保存。
                  </p>
                )}

                {isOfficial && workspace.sourceMeta?.snapshotPeriodEnd ? (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    最新已發布快照：
                    {shortDate(workspace.sourceMeta.snapshotPeriodEnd)}
                  </p>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={sourceLoading}
                  className="mt-3 bg-white/75"
                  onClick={() => {
                    if (isOfficial) {
                      void refreshOfficialSource();
                    } else {
                      setSettingsOpen(false);
                      setSourceOpen(true);
                    }
                  }}
                >
                  {sourceLoading ? (
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : isOfficial ? (
                    <RefreshCw data-icon="inline-start" />
                  ) : (
                    <LogIn data-icon="inline-start" />
                  )}
                  {isOfficial ? '重新讀取' : '載入正式資料'}
                </Button>
              </section>

              <section className="rounded-2xl border border-border bg-muted/25 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black">續約與培訓</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      調整後所有清單會立即重算，不會修改來源會籍日期。
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-900">
                    規則尚待確認
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-bold">
                    續約提醒門檻
                    <Input
                      type="date"
                      value={draftRenewalThreshold}
                      onChange={(event) =>
                        setDraftRenewalThreshold(event.target.value)
                      }
                    />
                    <span className="font-normal leading-5 text-muted-foreground">
                      到期日在此日期以前（含當日）列入提醒。
                    </span>
                  </label>
                  <label className="grid content-start gap-1.5 text-xs font-bold">
                    主要培訓日期
                    <Input
                      type="date"
                      value={draftTrainingDate}
                      onChange={(event) =>
                        setDraftTrainingDate(event.target.value)
                      }
                    />
                  </label>
                </div>
              </section>

              <p
                className={`rounded-xl px-3 py-2.5 text-[11px] font-bold leading-5 ${
                  cloudSyncStatus === 'error'
                    ? 'bg-rose-50 text-rose-800'
                    : isOfficial
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-primary/5 text-muted-foreground'
                }`}
              >
                {isOfficial
                  ? `${cloudSyncLabel(cloudSyncStatus)}・編組、設定與追蹤儲存在 BNI-PRES 獨立 Cloudflare D1；委員會 Supabase 只讀。`
                  : '登入正式來源後，手機與電腦會透過 BNI-PRES D1 同步。'}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                取消
              </Button>
              <Button onClick={saveSettings}>保存並重算</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>備份與還原</DialogTitle>
              <DialogDescription>
                匯出目前所有屆次、安排與追蹤狀態；正式姓名與會籍不會寫入備份。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={exportBackup}
                className="rounded-2xl border border-border bg-background/50 p-4 text-left hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                  <Download className="size-4" />
                </span>
                <span className="mt-3 block text-xs font-black">
                  匯出 JSON 備份
                </span>
                <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                  保存版本化 schema，可在此工作台還原。
                </span>
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="rounded-2xl border border-border bg-background/50 p-4 text-left hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-sky-100 text-sky-800">
                  <FileUp className="size-4" />
                </span>
                <span className="mt-3 block text-xs font-black">
                  還原 JSON 備份
                </span>
                <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                  匯入前會檢查版本與基本資料結構。
                </span>
              </button>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={importBackup}
            />
          </DialogContent>
        </Dialog>
      </main>
    </Toaster>
  );
}

export { LeadershipWorkspace };
