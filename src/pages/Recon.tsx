import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Release, ReleaseRepo } from '../api/client';

interface ReconTicket {
  id: string;
  title: string;
  assignee: string;
  state: string;
  priority: string;
  repos: string[];
  excluded: boolean;
}

interface StageTicket {
  id: string;
  title: string;
  assignee: string;
  state: string;
  priority: string;
}

interface ReconResult {
  releaseTickets: ReconTicket[];
  stageOnlyTickets: StageTicket[];
}

interface YTSprint {
  id: string;
  name: string;
  board: string;
  start?: number;
  finish?: number;
  archived: boolean;
}

// States considered healthy pre-launch — code is staged and ready
const PRE_LAUNCH_GOOD = new Set(['Stage Approved', 'Stage Testing', 'Staging', 'Production Testing', 'Production', 'Closed']);

// States considered done post-launch — ticket has moved to prod columns
const POST_LAUNCH_DONE = new Set(['Production Testing', 'Production', 'Closed', 'Done', 'Verified', 'Deployed']);

// Pre-launch: anything not in good states and not Unknown is flagged
function isFlagged(state: string) {
  return state !== 'Unknown' && !PRE_LAUNCH_GOOD.has(state);
}

// Post-launch: ticket went in but hasn't moved to prod columns yet
function isNotMovedToProd(state: string) {
  return !POST_LAUNCH_DONE.has(state);
}

const GOOD_STATES = PRE_LAUNCH_GOOD;

function stateColor(state: string) {
  if (GOOD_STATES.has(state)) return 'text-green-400 border-green-900/50 bg-green-950/20';
  if (isFlagged(state)) return 'text-red-400 border-red-900/50 bg-red-950/20';
  return 'text-[#888] border-[#2a2a2a] bg-[#0f0f0f]';
}

function stateDot(state: string) {
  if (GOOD_STATES.has(state)) return 'bg-green-500';
  if (isFlagged(state)) return 'bg-red-500';
  return 'bg-[#444]';
}

export default function Recon() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();

  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedId, setSelectedId] = useState(paramId ?? '');
  const [result, setResult] = useState<ReconResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [youtrackUrl, setYoutrackUrl] = useState('');
  const [sprints, setSprints] = useState<YTSprint[]>([]);
  const [selectedSprint, setSelectedSprint] = useState('');

  useEffect(() => {
    api.get<Record<string, string>>('/settings').then(s => {
      if (s['YOUTRACK_BASE_URL']) setYoutrackUrl(s['YOUTRACK_BASE_URL']);
      if (s['DEFAULT_SPRINT']) setSelectedSprint(s['DEFAULT_SPRINT']);
    }).catch(() => null);
    api.get<Release[]>('/releases').then(r => {
      const sorted = r.slice().reverse();
      setReleases(sorted);
      if (!selectedId && sorted.length) {
        const active = sorted.find(x => x.status === 'active') ?? sorted[0];
        setSelectedId(active.id);
      }
    }).catch(() => null);
    api.get<YTSprint[]>('/releases/youtrack-sprints').then(s => setSprints(s)).catch(() => null);
  }, [selectedId]);

  const runRecon = useCallback(async (id: string, sprint = selectedSprint) => {
    if (!id) return;
    setLoading(true);
    setError('');
    setResult(null);
    navigate(`/recon/${id}`, { replace: true });
    try {
      const qs = sprint ? `?sprint=${encodeURIComponent(sprint)}` : '';
      const data = await api.get<ReconResult>(`/releases/${id}/recon${qs}`);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedSprint]);

  useEffect(() => {
    if (selectedId) runRecon(selectedId);
  }, [selectedId, runRecon]);

  const [mode, setMode] = useState<'pre' | 'post'>('pre');
  const [filterText, setFilterText] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [releaseRepoNames, setReleaseRepoNames] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedId) {
      setReleaseRepoNames([]);
      return;
    }
    api.get<ReleaseRepo[]>(`/releases/${selectedId}/repos`)
      .then(rows => {
        const names = [...new Set(rows.map(r => r.repo.name).filter(Boolean))].sort();
        setReleaseRepoNames(names);
      })
      .catch(() => setReleaseRepoNames([]));
  }, [selectedId]);

  const applyFilter = <T extends { id: string; title: string; assignee: string; state: string }>(list: T[]) => {
    const q = filterText.toLowerCase();
    return list.filter(t =>
      (!q || t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)) &&
      (!filterState || t.state === filterState) &&
      (!filterAssignee || t.assignee.toLowerCase().includes(filterAssignee.toLowerCase())) &&
      (!selectedUser || t.assignee.toLowerCase() === selectedUser.toLowerCase())
    );
  };

  // Pre-launch derived lists
  const flaggedRaw = result?.releaseTickets.filter(t => !t.excluded && isFlagged(t.state)) ?? [];
  const healthyRaw = result?.releaseTickets.filter(t => !t.excluded && GOOD_STATES.has(t.state)) ?? [];
  const unknownRaw = result?.releaseTickets.filter(t => !t.excluded && t.state === 'Unknown') ?? [];
  const excludedRaw = result?.releaseTickets.filter(t => t.excluded) ?? [];
  
  const flagged = applyFilter(flaggedRaw);
  const healthy = applyFilter(healthyRaw);
  const unknown = applyFilter(unknownRaw);
  const excluded = applyFilter(excludedRaw);
  
  const allStageStates = [...new Set(result?.stageOnlyTickets.map(t => t.state) ?? [])].sort();
  const allStageAssignees = [...new Set(result?.stageOnlyTickets.map(t => t.assignee).filter(Boolean) ?? [])].sort();
  const filteredStageOnly = applyFilter(result?.stageOnlyTickets ?? []);

  // Post-launch derived lists
  const notMovedToProdRaw = result?.releaseTickets.filter(t => !t.excluded && isNotMovedToProd(t.state)) ?? [];
  const movedToProdRaw = result?.releaseTickets.filter(t => !t.excluded && POST_LAUNCH_DONE.has(t.state)) ?? [];
  
  const notMovedToProd = applyFilter(notMovedToProdRaw);
  const movedToProd = applyFilter(movedToProdRaw);
  
  const allPostStates = [...new Set(notMovedToProdRaw.map(t => t.state))].sort();
  const allPostAssignees = [...new Set(notMovedToProdRaw.map(t => t.assignee).filter(Boolean))].sort();
  const filteredNotMoved = notMovedToProd;
  
  // Get all unique assignees for the current mode
  const allAssignees = mode === 'pre'
    ? [...new Set([
        ...flaggedRaw.map(t => t.assignee),
        ...healthyRaw.map(t => t.assignee),
        ...unknownRaw.map(t => t.assignee),
        ...(result?.stageOnlyTickets.map(t => t.assignee) ?? [])
      ].filter(Boolean))].sort()
    : [...new Set([
        ...notMovedToProdRaw.map(t => t.assignee),
        ...movedToProdRaw.map(t => t.assignee)
      ].filter(Boolean))].sort();

  const releaseDevelopers = [...new Set((result?.releaseTickets ?? []).map(t => t.assignee).filter(Boolean))].sort();
  const releaseReposFromRecon = [...new Set((result?.releaseTickets ?? []).flatMap(t => t.repos).filter(Boolean))].sort();
  const releaseTickets = [...new Set((result?.releaseTickets ?? []).map(t => t.id).filter(Boolean))].sort();
  const releaseRepos = releaseRepoNames.length > 0 ? releaseRepoNames : releaseReposFromRecon;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-5 bg-[#ff460b]" />
          <h1 className="text-sm font-semibold text-white uppercase tracking-widest">Recon</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex border border-[#2a2a2a]">
            <button
              onClick={() => { setMode('pre'); setFilterText(''); setFilterState(''); setFilterAssignee(''); setSelectedUser(''); }}
              className={`px-4 py-2 text-xs uppercase tracking-wider transition-colors ${mode === 'pre' ? 'bg-[#ff460b] text-white' : 'text-[#555] hover:text-[#999]'}`}
            >
              Pre-Launch
            </button>
            <button
              onClick={() => { setMode('post'); setFilterText(''); setFilterState(''); setFilterAssignee(''); setSelectedUser(''); }}
              className={`px-4 py-2 text-xs uppercase tracking-wider transition-colors border-l border-[#2a2a2a] ${mode === 'post' ? 'bg-[#ff460b] text-white' : 'text-[#555] hover:text-[#999]'}`}
            >
              Post-Launch
            </button>
          </div>
          <button
            onClick={() => setShowManualAdd(true)}
            className="text-xs px-4 py-2 border border-[#2a2a2a] text-[#888] hover:border-[#ff460b] hover:text-white uppercase tracking-wider transition-colors"
          >
            Add Manual Card
          </button>
          <button
            onClick={() => selectedId && runRecon(selectedId)}
            disabled={loading || !selectedId}
            className="text-xs px-4 py-2 border border-[#2a2a2a] text-[#888] hover:border-[#ff460b] hover:text-white uppercase tracking-wider transition-colors disabled:opacity-30"
          >
            {loading ? 'Running...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Pickers */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#555] uppercase tracking-widest shrink-0">Release</span>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#ff460b] transition-colors"
          >
            {releases.map(r => (
              <option key={r.id} value={r.id}>{r.name}{r.status === 'active' ? ' (active)' : ''}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#555] uppercase tracking-widest shrink-0">Sprint</span>
          <select
            value={selectedSprint}
            onChange={e => {
              const val = e.target.value;
              setSelectedSprint(val);
              api.put('/settings/DEFAULT_SPRINT', { value: val }).catch(() => null);
              if (selectedId) runRecon(selectedId, val);
            }}
            className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff460b] transition-colors"
          >
            <option value="">None (all sprints)</option>
            {sprints.filter(s => {
              if (s.archived) return false;
              const thisYear = new Date().getFullYear();
              if (s.finish) return new Date(s.finish).getFullYear() === thisYear;
              if (s.start) return new Date(s.start).getFullYear() === thisYear;
              return true;
            }).map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Filter by User */}
        {result && !loading && allAssignees.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#555] uppercase tracking-widest shrink-0">Filter by User</span>
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff460b] transition-colors"
            >
              <option value="">All Users</option>
              {allAssignees.map(assignee => (
                <option key={assignee} value={assignee}>{assignee}</option>
              ))}
            </select>
            {selectedUser && (
              <button
                onClick={() => setSelectedUser('')}
                className="px-3 py-2 text-xs text-[#555] hover:text-white border border-[#2a2a2a] hover:border-[#ff460b] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-red-400 text-xs font-mono">{error}</div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 bg-[#111] border border-[#1a1a1a] animate-pulse" />
          ))}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-8">

          {/* ── PRE-LAUNCH ── */}
          {mode === 'pre' && (
            <>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'In Release', value: result.releaseTickets.filter(t => !t.excluded).length, color: 'text-white' },
                  { label: 'Flagged', value: flagged.length, color: flagged.length > 0 ? 'text-red-400' : 'text-white' },
                  { label: 'Stage Only', value: result.stageOnlyTickets.length, color: result.stageOnlyTickets.length > 0 ? 'text-yellow-400' : 'text-white' },
                  { label: 'Healthy', value: healthy.length, color: 'text-green-400' },
                ].map(s => (
                  <div key={s.label} className="bg-[#111] border border-[#1a1a1a] px-4 py-3">
                    <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-[#555] uppercase tracking-widest mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {flagged.length > 0 && (
                <Section title="Flagged — Needs Attention" accent="border-red-900/60" titleColor="text-red-400" tickets={flagged}>
                  <p className="text-xs text-[#555] mb-3">These tickets are in the release but their YouTrack state suggests they may not be ready.</p>
                  <TicketTable tickets={flagged} showRepos youtrackBase={youtrackUrl} />
                </Section>
              )}

              {result.stageOnlyTickets.length > 0 && (
                <Section title={`Stage Only — Not in Release (${filteredStageOnly.length}/${result.stageOnlyTickets.length})`} accent="border-yellow-900/60" titleColor="text-yellow-400" tickets={filteredStageOnly}>
                  <p className="text-xs text-[#555] mb-4">These tickets are marked as Staging / Stage Testing / Stage Approved on YouTrack but no commits were found for them in this release.</p>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <input value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Search ID or title..."
                      className="flex-1 min-w-40 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#3a3a3a] font-mono focus:outline-none focus:border-[#ff460b] transition-colors" />
                    <select value={filterState} onChange={e => setFilterState(e.target.value)}
                      className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b] transition-colors">
                      <option value="">All states</option>
                      {allStageStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                      className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b] transition-colors">
                      <option value="">All assignees</option>
                      {allStageAssignees.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    {(filterText || filterState || filterAssignee) && (
                      <button onClick={() => { setFilterText(''); setFilterState(''); setFilterAssignee(''); }}
                        className="px-3 py-1.5 text-xs text-[#555] hover:text-white border border-[#2a2a2a] transition-colors">Clear</button>
                    )}
                  </div>
                  <TicketTable tickets={filteredStageOnly} showRepos={false} youtrackBase={youtrackUrl} />
                </Section>
              )}

              {healthy.length > 0 && (
                <Section title={`Healthy (${healthy.length})`} accent="border-[#1f1f1f]" titleColor="text-[#666]" collapsible tickets={healthy}>
                  <TicketTable tickets={healthy} showRepos youtrackBase={youtrackUrl} />
                </Section>
              )}

              {unknown.length > 0 && (
                <Section title={`Unknown State (${unknown.length})`} accent="border-[#1f1f1f]" titleColor="text-[#666]" collapsible tickets={unknown}>
                  <p className="text-xs text-[#555] mb-3">Ticket not found in YouTrack or state couldn't be determined.</p>
                  <TicketTable tickets={unknown} showRepos youtrackBase={youtrackUrl} />
                </Section>
              )}

              {excluded.length > 0 && (
                <Section title={`Excluded (${excluded.length})`} accent="border-[#1f1f1f]" titleColor="text-[#333]" collapsible tickets={excluded}>
                  <TicketTable tickets={excluded} showRepos youtrackBase={youtrackUrl} />
                </Section>
              )}
            </>
          )}

          {/* ── POST-LAUNCH ── */}
          {mode === 'post' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'In Release', value: result.releaseTickets.filter(t => !t.excluded).length, color: 'text-white' },
                  { label: 'Needs Moving', value: notMovedToProd.length, color: notMovedToProd.length > 0 ? 'text-amber-400' : 'text-white' },
                  { label: 'In Prod', value: movedToProd.length, color: 'text-green-400' },
                ].map(s => (
                  <div key={s.label} className="bg-[#111] border border-[#1a1a1a] px-4 py-3">
                    <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-[#555] uppercase tracking-widest mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {notMovedToProd.length > 0 && (
                <Section title={`Needs Moving to Prod (${filteredNotMoved.length}/${notMovedToProdRaw.length})`} accent="border-amber-900/60" titleColor="text-amber-400" tickets={filteredNotMoved}>
                  <p className="text-xs text-[#555] mb-4">These tickets were deployed in this release but haven't been moved to Production Testing, Production, or Closed on YouTrack. Ask the devs to update them.</p>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <input value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Search ID or title..."
                      className="flex-1 min-w-40 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#3a3a3a] font-mono focus:outline-none focus:border-[#ff460b] transition-colors" />
                    <select value={filterState} onChange={e => setFilterState(e.target.value)}
                      className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b] transition-colors">
                      <option value="">All states</option>
                      {allPostStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                      className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b] transition-colors">
                      <option value="">All assignees</option>
                      {allPostAssignees.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    {(filterText || filterState || filterAssignee) && (
                      <button onClick={() => { setFilterText(''); setFilterState(''); setFilterAssignee(''); }}
                        className="px-3 py-1.5 text-xs text-[#555] hover:text-white border border-[#2a2a2a] transition-colors">Clear</button>
                    )}
                  </div>
                  <TicketTable tickets={filteredNotMoved} showRepos youtrackBase={youtrackUrl} />
                </Section>
              )}

              {notMovedToProd.length === 0 && (
                <div className="border border-green-900/40 bg-green-950/10 px-5 py-8 text-center">
                  <p className="text-green-400 text-sm font-medium">All tickets have been moved to prod columns.</p>
                  <p className="text-[#555] text-xs mt-1">Nothing to action.</p>
                </div>
              )}

              {movedToProd.length > 0 && (
                <Section title={`In Prod (${movedToProd.length})`} accent="border-[#1f1f1f]" titleColor="text-green-500" collapsible tickets={movedToProd}>
                  <TicketTable tickets={movedToProd} showRepos youtrackBase={youtrackUrl} />
                </Section>
              )}
            </>
          )}

        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-[#444] text-xs py-12 text-center">Select a release to run recon.</div>
      )}

      {showManualAdd && <ManualCardModal
        selectedId={selectedId}
        developerOptions={releaseDevelopers}
        repoOptions={releaseRepos}
        ticketOptions={releaseTickets}
        onClose={() => setShowManualAdd(false)}
        onAdded={() => { setShowManualAdd(false); if (selectedId) runRecon(selectedId); }}
      />}
    </div>
  );
}

function Section({ title, accent, titleColor, children, collapsible, tickets }: {
  title: string;
  accent: string;
  titleColor: string;
  children: React.ReactNode;
  collapsible?: boolean;
  tickets?: Array<{ id: string; title: string }>;
}) {
  const [open, setOpen] = useState(!collapsible);
  const [copied, setCopied] = useState(false);
  
  const copyTickets = () => {
    if (!tickets || tickets.length === 0) return;
    const text = tickets.map(t => `${t.id}\n${t.title}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  return (
    <div className={`border ${accent} bg-[#111]`}>
      <div
        className={`flex items-center justify-between px-5 py-3 border-b ${accent} ${collapsible ? 'cursor-pointer hover:bg-[#141414]' : ''}`}
        onClick={(e) => {
          if (collapsible && !(e.target as HTMLElement).closest('button')) {
            setOpen(v => !v);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <div className={`w-[3px] h-3.5 ${titleColor.replace('text-', 'bg-')}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${titleColor}`}>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {tickets && tickets.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyTickets();
              }}
              className="px-3 py-1 text-[10px] text-[#888] hover:text-white border border-[#2a2a2a] hover:border-[#ff460b] uppercase tracking-wider transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
          {collapsible && <span className="text-[#444] text-xs">{open ? '▲' : '▼'}</span>}
        </div>
      </div>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

function TicketTable({ tickets, showRepos, youtrackBase }: {
  tickets: (ReconTicket | StageTicket)[];
  showRepos: boolean;
  youtrackBase?: string;
}) {
  return (
    <div className="divide-y divide-[#1a1a1a] border border-[#1a1a1a]">
      {tickets.map(t => (
        <div key={t.id} className="flex items-start gap-4 px-4 py-3 bg-[#0f0f0f] hover:bg-[#111] transition-colors">
          <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${stateDot(t.state)}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {youtrackBase
                ? <a href={`${youtrackBase}/issue/${t.id}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-mono text-[#ff460b] hover:underline shrink-0">{t.id}</a>
                : <span className="text-xs font-mono text-[#ff460b] shrink-0">{t.id}</span>
              }
              <span className="text-sm text-white truncate">{t.title}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {t.assignee && <span className="text-[11px] text-[#555]">@{t.assignee}</span>}
              {showRepos && 'repos' in t && t.repos.length > 0 && (
                <span className="text-[11px] text-[#444] font-mono">{t.repos.join(', ')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {t.priority && (
              <span className="text-[10px] px-2 py-0.5 border border-[#2a2a2a] text-[#555] font-mono">{t.priority}</span>
            )}
            <span className={`text-[10px] px-2 py-0.5 border font-medium uppercase tracking-wide ${stateColor(t.state)}`}>
              {t.state}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SuggestInput({
  label,
  value,
  onChange,
  options,
  placeholder,
  helperText,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  helperText?: string;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter(o => o.toLowerCase().includes(q)).slice(0, 8);
  }, [options, value]);

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-[10px] text-[#777] uppercase tracking-widest mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className={`w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#ff460b] transition-colors ${mono ? 'font-mono' : ''}`}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 border border-[#2a2a2a] bg-[#111] shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs text-[#bbb] hover:bg-[#1a1a1a] hover:text-white border-b border-[#1a1a1a] last:border-b-0 transition-colors ${mono ? 'font-mono' : ''}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {helperText && <p className="text-[10px] text-[#666] mt-1">{helperText}</p>}
    </div>
  );
}

function ManualCardModal({ selectedId, developerOptions, repoOptions, ticketOptions, onClose, onAdded }: {
  selectedId: string;
  developerOptions: string[];
  repoOptions: string[];
  ticketOptions: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [ticketId, setTicketId] = useState('');
  const [title, setTitle] = useState('');
  const [developer, setDeveloper] = useState('');
  const [repo, setRepo] = useState('');
  const [description, setDescription] = useState('');
  const [linkedTicket, setLinkedTicket] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId.trim() || !title.trim() || !developer.trim() || !repo.trim()) {
      setError('Ticket ID, Title, Developer, and Repo are required');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await api.post(`/releases/${selectedId}/manual-ticket`, {
        id: ticketId.toUpperCase(),
        title,
        developer,
        repo,
        description,
        linkedTicket: linkedTicket || undefined,
      });
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] px-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-[#2a2a2a] bg-gradient-to-b from-[#171717] to-[#121212] shadow-[0_18px_70px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-5 bg-[#ff460b]" />
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Add Manual Card</h2>
              <p className="text-[11px] text-[#666] mt-0.5">Add work that was completed on another linked card</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center border border-[#2a2a2a] text-[#666] hover:text-white hover:border-[#ff460b] transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-[#777] uppercase tracking-widest mb-1.5">Ticket ID</label>
              <input
                type="text"
                value={ticketId}
                onChange={e => setTicketId(e.target.value)}
                placeholder="e.g., INDEV-1234"
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#ff460b] transition-colors font-mono"
              />
            </div>

            <SuggestInput
              label="Developer"
              value={developer}
              onChange={setDeveloper}
              options={developerOptions}
              placeholder={developerOptions.length > 0 ? 'Pick from release devs or type...' : 'Developer name'}
              helperText={developerOptions.length > 0 ? `${developerOptions.length} in this release` : undefined}
            />
          </div>

          <div>
            <label className="block text-[10px] text-[#777] uppercase tracking-widest mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Card title"
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#ff460b] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SuggestInput
              label="Repository"
              value={repo}
              onChange={setRepo}
              options={repoOptions}
              placeholder={repoOptions.length > 0 ? 'Pick from release repos or type...' : 'e.g., wsb-openbet-web'}
              helperText={repoOptions.length > 0 ? `${repoOptions.length} in this release` : undefined}
            />

            <SuggestInput
              label="Link To Another Card (Optional)"
              value={linkedTicket}
              onChange={setLinkedTicket}
              options={ticketOptions}
              placeholder={ticketOptions.length > 0 ? 'Pick a current release ticket or type...' : 'e.g., INDEV-5678'}
              helperText="Link where the actual work happened"
              mono
            />
          </div>

          <div>
            <label className="block text-[10px] text-[#777] uppercase tracking-widest mb-1.5">Description (Optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Additional context about this work"
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#ff460b] transition-colors resize-none h-24"
            />
          </div>

          {error && (
            <div className="border border-red-900/50 bg-red-950/20 px-3 py-2 text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#1f1f1f]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#ff460b] uppercase tracking-wider text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#ff460b] hover:bg-[#ff5722] disabled:opacity-50 text-white uppercase tracking-wider text-xs font-semibold transition-colors"
            >
              {loading ? 'Adding...' : 'Add Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
