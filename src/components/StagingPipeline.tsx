import { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';
import type { PipelineRepo } from '../api/client';

interface Filters {
  hideMergeCommits: boolean;
  onlyWithTickets: boolean;
  authorFilter: string;
  ticketPrefix: string;
  titleContains: string;
}

const DEFAULT_FILTERS: Filters = {
  hideMergeCommits: true,
  onlyWithTickets: false,
  authorFilter: '',
  ticketPrefix: '',
  titleContains: '',
};

const MERGE_COMMIT_RE = /^merge branch|^merge remote|^merged? .* into /i;

function applyFilters(commits: PipelineRepo['commits'], filters: Filters) {
  return commits.filter(cm => {
    if (filters.hideMergeCommits && MERGE_COMMIT_RE.test(cm.title)) return false;
    if (filters.onlyWithTickets && cm.tickets.length === 0) return false;
    if (filters.authorFilter && !cm.author.toLowerCase().includes(filters.authorFilter.toLowerCase())) return false;
    if (filters.ticketPrefix && !cm.tickets.some(t => t.toUpperCase().startsWith(filters.ticketPrefix.toUpperCase()))) return false;
    if (filters.titleContains && !cm.title.toLowerCase().includes(filters.titleContains.toLowerCase())) return false;
    return true;
  });
}

export default function StagingPipeline({ releaseId }: { releaseId: string }) {
  const [data, setData] = useState<PipelineRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<PipelineRepo[]>(`/releases/${releaseId}/pipeline`);
      setData(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [releaseId]);

  const filtered = useMemo(() => data.map(repo => ({
    ...repo,
    commits: applyFilters(repo.commits, filters),
    _total: repo.commits.length,
  })), [data, filters]);

  const totalVisible = filtered.reduce((n, r) => n + r.commits.length, 0);
  const totalRaw = data.reduce((n, r) => n + r.commits.length, 0);
  const activeFilterCount = Object.entries(filters).filter(([k, v]) =>
    k === 'hideMergeCommits' ? !v : Boolean(v)
  ).length;

  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters(f => ({ ...f, [key]: val }));

  if (loading) return <p className="text-[#555] py-4 text-sm">Fetching pipeline data from GitLab...</p>;
  if (error) return (
    <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-red-400 text-sm">
      {error} <button onClick={load} className="ml-4 underline">Retry</button>
    </div>
  );
  if (!data.length) return <p className="text-[#555] py-4 text-sm">No repos in this release.</p>;

  return (
    <div className="space-y-3">
      {/* Header + filter toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#666]">
          <span className="text-white font-medium">{totalVisible}</span>
          {totalVisible !== totalRaw && <span className="text-[#444]"> / {totalRaw}</span>}
          {' '}commits on <code className="text-[#ff460b] font-mono">stage</code> not yet on <code className="text-[#ff460b] font-mono">main</code>
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium uppercase tracking-wider transition-colors ${
              showFilters ? 'border-[#ff460b]/50 text-[#ff460b] bg-[#1a0800]' : 'border-[#2a2a2a] text-[#555] hover:border-[#3a3a3a] hover:text-[#999]'
            }`}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-[#ff460b] text-white text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button onClick={load} className="text-xs text-[#444] hover:text-white uppercase tracking-wider transition-colors">Refresh</button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-[#111] border border-[#1f1f1f] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white uppercase tracking-widest">Filters</p>
            <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-[10px] text-[#444] hover:text-white uppercase tracking-wider transition-colors">Reset all</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Hide merge commits" desc='Hides commits starting with "Merge branch …"' value={filters.hideMergeCommits} onChange={v => setFilter('hideMergeCommits', v)} />
            <Toggle label="Only commits with tickets" desc="Hides commits with no ticket references" value={filters.onlyWithTickets} onChange={v => setFilter('onlyWithTickets', v)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-[#555] uppercase tracking-widest block mb-1.5">Ticket prefix</label>
              <input value={filters.ticketPrefix} onChange={e => setFilter('ticketPrefix', e.target.value)} placeholder="e.g. INDEV"
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b] font-mono transition-colors" />
            </div>
            <div>
              <label className="text-[10px] text-[#555] uppercase tracking-widest block mb-1.5">Author contains</label>
              <input value={filters.authorFilter} onChange={e => setFilter('authorFilter', e.target.value)} placeholder="e.g. Brandon"
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b] transition-colors" />
            </div>
            <div>
              <label className="text-[10px] text-[#555] uppercase tracking-widest block mb-1.5">Title contains</label>
              <input value={filters.titleContains} onChange={e => setFilter('titleContains', e.target.value)} placeholder="e.g. hotfix"
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b] transition-colors" />
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {filtered.map(repo => {
        const hiddenCount = repo._total - repo.commits.length;
        return (
          <div key={repo.repo} className="bg-[#111] border border-[#1f1f1f] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
              <div>
                <span className="font-semibold text-white text-sm">{repo.repo}</span>
                <span className="ml-2 text-xs text-[#444] font-mono">{repo.path}</span>
                {hiddenCount > 0 && <span className="ml-2 text-xs text-[#333]">({hiddenCount} hidden by filters)</span>}
              </div>
              <span className={`text-[10px] px-2 py-0.5 font-mono uppercase tracking-wider ${
                repo.error ? 'bg-red-950/40 text-red-500 border border-red-900' :
                repo.commits.length > 0 ? 'bg-[#1a0800] text-[#ff460b] border border-[#ff460b]/30' :
                'bg-[#1a1a1a] text-[#444]'
              }`}>
                {repo.error ? 'error' : `${repo.commits.length} commits`}
              </span>
            </div>

            {repo.error && <p className="px-5 py-3 text-red-400 text-sm">{repo.error}</p>}
            {!repo.error && repo.commits.length === 0 && (
              <p className="px-5 py-3 text-[#444] text-sm">
                {hiddenCount > 0 ? `All ${hiddenCount} commits hidden by active filters.` : 'Up to date'}
              </p>
            )}

            {repo.commits.length > 0 && (
              <div className="divide-y divide-[#1a1a1a]">
                {repo.commits.map(cm => (
                  <div key={cm.id} className="px-5 py-3 flex items-start gap-3">
                    <code className="text-[10px] text-[#333] mt-0.5 shrink-0 font-mono">{cm.id}</code>
                    <div className="flex-1 min-w-0">
                      <a href={cm.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-[#ccc] hover:text-white transition-colors block truncate">
                        {cm.title}
                      </a>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-[#444]">{cm.author}</span>
                        <span className="text-xs text-[#333]">{formatDate(cm.date)}</span>
                        {cm.tickets.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 bg-[#1a0800] border border-[#ff460b]/30 text-[#ff460b] font-mono">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-[#161616] border border-[#1f1f1f] p-3 cursor-pointer" onClick={() => onChange(!value)}>
      <div className="flex-1">
        <p className="text-xs text-white font-medium">{label}</p>
        <p className="text-[10px] text-[#444] mt-0.5">{desc}</p>
      </div>
      <div className={`relative inline-flex h-5 w-9 shrink-0 mt-0.5 border-2 border-transparent transition-colors ${value ? 'bg-[#ff460b]' : 'bg-[#2a2a2a]'}`}>
        <span className={`inline-block h-4 w-4 bg-white shadow transform transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </div>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
