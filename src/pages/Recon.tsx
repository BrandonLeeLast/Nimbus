import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Release } from '../api/client';

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

// States considered healthy — code is ready for release
const GOOD_STATES = new Set(['Stage Approved', 'Stage Testing', 'Staging', 'Production Testing', 'Production', 'Closed']);

// Anything not in GOOD_STATES and not Unknown is flagged — avoids missing new state names
function isFlagged(state: string) {
  return state !== 'Unknown' && !GOOD_STATES.has(state);
}

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

  const [filterText, setFilterText] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  const applyFilter = <T extends { id: string; title: string; assignee: string; state: string }>(list: T[]) => {
    const q = filterText.toLowerCase();
    return list.filter(t =>
      (!q || t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)) &&
      (!filterState || t.state === filterState) &&
      (!filterAssignee || t.assignee.toLowerCase().includes(filterAssignee.toLowerCase()))
    );
  };

  const flagged = result?.releaseTickets.filter(t => !t.excluded && isFlagged(t.state)) ?? [];
  const healthy = result?.releaseTickets.filter(t => !t.excluded && GOOD_STATES.has(t.state)) ?? [];
  const unknown = result?.releaseTickets.filter(t => !t.excluded && t.state === 'Unknown') ?? [];
  const excluded = result?.releaseTickets.filter(t => t.excluded) ?? [];

  const allStageStates = [...new Set(result?.stageOnlyTickets.map(t => t.state) ?? [])].sort();
  const allStageAssignees = [...new Set(result?.stageOnlyTickets.map(t => t.assignee).filter(Boolean) ?? [])].sort();
  const filteredStageOnly = applyFilter(result?.stageOnlyTickets ?? []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-5 bg-[#ff460b]" />
          <h1 className="text-sm font-semibold text-white uppercase tracking-widest">Recon</h1>
        </div>
        <button
          onClick={() => selectedId && runRecon(selectedId)}
          disabled={loading || !selectedId}
          className="text-xs px-4 py-2 border border-[#2a2a2a] text-[#888] hover:border-[#ff460b] hover:text-white uppercase tracking-wider transition-colors disabled:opacity-30"
        >
          {loading ? 'Running...' : 'Refresh'}
        </button>
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

        {sprints.length > 0 && (
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
              <option value="">All sprints</option>
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

          {/* Summary bar */}
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

          {/* Flagged — needs attention */}
          {flagged.length > 0 && (
            <Section title="Flagged — Needs Attention" accent="border-red-900/60" titleColor="text-red-400">
              <p className="text-xs text-[#555] mb-3">These tickets are in the release (code found in commits) but their YouTrack state suggests they may not be ready.</p>
              <TicketTable tickets={flagged} showRepos youtrackBase={youtrackUrl} />
            </Section>
          )}

          {/* Stage only — not in release */}
          {result.stageOnlyTickets.length > 0 && (
            <Section title={`Stage Only — Not in Release (${filteredStageOnly.length}/${result.stageOnlyTickets.length})`} accent="border-yellow-900/60" titleColor="text-yellow-400">
              <p className="text-xs text-[#555] mb-4">These tickets are marked as Staging / Stage Testing / Stage Approved on YouTrack but no commits were found for them in this release.</p>

              {/* Filters */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <input
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  placeholder="Search ID or title..."
                  className="flex-1 min-w-40 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#3a3a3a] font-mono focus:outline-none focus:border-[#ff460b] transition-colors"
                />
                <select
                  value={filterState}
                  onChange={e => setFilterState(e.target.value)}
                  className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b] transition-colors"
                >
                  <option value="">All states</option>
                  {allStageStates.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={filterAssignee}
                  onChange={e => setFilterAssignee(e.target.value)}
                  className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b] transition-colors"
                >
                  <option value="">All assignees</option>
                  {allStageAssignees.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {(filterText || filterState || filterAssignee) && (
                  <button onClick={() => { setFilterText(''); setFilterState(''); setFilterAssignee(''); }}
                    className="px-3 py-1.5 text-xs text-[#555] hover:text-white border border-[#2a2a2a] transition-colors">
                    Clear
                  </button>
                )}
              </div>

              <TicketTable tickets={filteredStageOnly} showRepos={false} youtrackBase={youtrackUrl} />
            </Section>
          )}

          {/* Healthy */}
          {healthy.length > 0 && (
            <Section title={`Healthy (${healthy.length})`} accent="border-[#1f1f1f]" titleColor="text-[#666]" collapsible>
              <TicketTable tickets={healthy} showRepos youtrackBase={youtrackUrl} />
            </Section>
          )}

          {/* Unknown state */}
          {unknown.length > 0 && (
            <Section title={`Unknown State (${unknown.length})`} accent="border-[#1f1f1f]" titleColor="text-[#666]" collapsible>
              <p className="text-xs text-[#555] mb-3">Ticket not found in YouTrack or state couldn't be determined.</p>
              <TicketTable tickets={unknown} showRepos youtrackBase={youtrackUrl} />
            </Section>
          )}

          {/* Excluded */}
          {excluded.length > 0 && (
            <Section title={`Excluded (${excluded.length})`} accent="border-[#1f1f1f]" titleColor="text-[#333]" collapsible>
              <TicketTable tickets={excluded} showRepos youtrackBase={youtrackUrl} />
            </Section>
          )}

        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-[#444] text-xs py-12 text-center">Select a release to run recon.</div>
      )}
    </div>
  );
}

function Section({ title, accent, titleColor, children, collapsible }: {
  title: string;
  accent: string;
  titleColor: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div className={`border ${accent} bg-[#111]`}>
      <div
        className={`flex items-center justify-between px-5 py-3 border-b ${accent} ${collapsible ? 'cursor-pointer hover:bg-[#141414]' : ''}`}
        onClick={() => collapsible && setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-[3px] h-3.5 ${titleColor.replace('text-', 'bg-')}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${titleColor}`}>{title}</span>
        </div>
        {collapsible && <span className="text-[#444] text-xs">{open ? '▲' : '▼'}</span>}
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
