import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, emptyDoc } from '../api/client';
import type { Release, Repo, ReleaseRepo, ReleaseDoc } from '../api/client';
import ReleaseDocEditor from '../components/ReleaseDoc';
import StagingPipeline from '../components/StagingPipeline';
import HotfixView from '../components/HotfixView';

type Tab = 'document' | 'pipeline' | 'hotfixes';
type BranchStatus = { repoId: string; name: string; exists: boolean | null; error: string | null };

export default function Releases() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();

  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedId, setSelectedId] = useState<string>(paramId ?? '');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [releaseRepos, setReleaseRepos] = useState<ReleaseRepo[]>([]);
  const [doc, setDoc] = useState<ReleaseDoc | null>(null);
  const [tab, setTab] = useState<Tab>('document');
  const [genOptions, setGenOptions] = useState({ hideMergeCommits: true });
  const [showGenOptions, setShowGenOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [genMsg, setGenMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [branchResults, setBranchResults] = useState<{ repo: string; result: string }[]>([]);

  // Branch status prompt
  const [missingBranches, setMissingBranches] = useState<{ branch: string; repos: BranchStatus[] } | null>(null);
  const [creatingBranches, setCreatingBranches] = useState(false);

  // Deploy MRs
  const [creatingMRs, setCreatingMRs] = useState(false);
  const [mrResults, setMrResults] = useState<{ repo: string; result: string; url?: string | null }[]>([]);

  const loadReleases = useCallback(async () => {
    const all = await api.get<Release[]>('/releases');
    setReleases(all.slice().reverse());
    if (!selectedId && all.length) {
      const active = all.find(r => r.status === 'active') ?? all[all.length - 1];
      setSelectedId(active.id);
    }
  }, [selectedId]);

  useEffect(() => {
    api.get<Repo[]>('/repos').then(setRepos).catch(() => null);
    loadReleases();
  }, [loadReleases]);

  useEffect(() => {
    if (!selectedId) return;
    navigate(`/releases/${selectedId}`, { replace: true });
    setDoc(null);
    setError('');
    setLoading(true);

    Promise.all([
      api.get<ReleaseRepo[]>(`/releases/${selectedId}/repos`),
      api.get<{ content: ReleaseDoc } | null>(`/releases/${selectedId}/document`),
    ])
      .then(([rr, docRes]) => {
        setReleaseRepos(rr);
        setDoc(docRes?.content ? hydrateDoc(docRes.content) : null);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selectedId, navigate]);

  const handleCreated = async (id: string, branches: { repo: string; result: string }[]) => {
    await loadReleases();
    setSelectedId(id);
    setShowCreate(false);
    if (branches?.length) setBranchResults(branches);
  };

  const runGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    setGenMsg('Calling GitLab + YouTrack...');
    setError('');
    setMissingBranches(null);
    try {
      await api.post(`/releases/${selectedId}/generate`, genOptions);
      const docRes = await api.get<{ content: ReleaseDoc }>(`/releases/${selectedId}/document`);
      setDoc(hydrateDoc(docRes.content));
      setGenMsg('');
      setTab('document');
    } catch (e) {
      setError(String(e));
      setGenMsg('');
    } finally {
      setGenerating(false);
    }
  };

  const generate = async () => {
    if (!selectedId) return;
    setError('');
    setGenMsg('Checking branches...');
    setGenerating(true);
    try {
      const status = await api.get<{ branch: string; repos: BranchStatus[] }>(`/releases/${selectedId}/branch-status`);
      const missing = status.repos.filter(r => r.exists === false);
      if (missing.length > 0) {
        setMissingBranches({ branch: status.branch, repos: status.repos });
        setGenMsg('');
        setGenerating(false);
        return;
      }
    } catch {
      // network error — proceed anyway, generate will surface the real error
    }
    setGenerating(false);
    await runGenerate();
  };

  const createMissingBranches = async () => {
    if (!selectedId) return;
    setCreatingBranches(true);
    try {
      await api.post(`/releases/${selectedId}/create-branches`, {});
      const status = await api.get<{ branch: string; repos: BranchStatus[] }>(`/releases/${selectedId}/branch-status`);
      setMissingBranches({ branch: status.branch, repos: status.repos });
    } catch (e) {
      setError(String(e));
    } finally {
      setCreatingBranches(false);
    }
  };

  const completeRelease = async () => {
    if (!selectedId || !confirm('Mark this release as completed/deployed?')) return;
    await api.post(`/releases/${selectedId}/complete`, {});
    await loadReleases();
  };

  const createDeployMRs = async () => {
    if (!selectedId) return;
    setCreatingMRs(true);
    setMrResults([]);
    try {
      const res = await api.post<{ branch: string; results: { repo: string; result: string; url?: string | null }[] }>(
        `/releases/${selectedId}/create-mrs`, {}
      );
      setMrResults(res.results);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreatingMRs(false);
    }
  };

  const addRepo = async (repoId: string) => {
    await api.post(`/releases/${selectedId}/repos`, { repo_id: repoId });
    const rr = await api.get<ReleaseRepo[]>(`/releases/${selectedId}/repos`);
    setReleaseRepos(rr);
    await api.get<Repo[]>('/repos').then(setRepos).catch(() => null);
  };

  const removeRepo = async (rrId: string) => {
    await api.delete(`/releases/${selectedId}/repos/${rrId}`);
    setReleaseRepos(rr => rr.filter(x => x.rr.id !== rrId));
  };

  const selected = releases.find(r => r.id === selectedId);

  return (
    <div className="flex gap-0 h-full bg-[#1a1a1a]">
      {showCreate && <NewReleaseModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}

      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-[#2a2a2a] flex flex-col bg-[#111111]">
        <div className="p-3 border-b border-[#2a2a2a]">
          <button onClick={() => setShowCreate(true)}
            className="w-full px-3 py-2 bg-[#ff460b] hover:bg-[#e03d08] text-white text-xs font-semibold uppercase tracking-wider transition-colors rounded">
            + New Release
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {releases.map(r => (
            <button key={r.id} onClick={() => setSelectedId(r.id)}
              className={`w-full text-left px-4 py-3 border-l-2 transition-colors ${
                r.id === selectedId
                  ? 'border-l-[#ff460b] bg-[#1a1a1a] text-white'
                  : 'border-l-transparent text-[#777] hover:text-[#aaa] hover:bg-[#151515]'
              }`}>
              <div className="text-xs font-mono font-medium truncate">{r.name}</div>
              <div className={`text-[10px] mt-0.5 uppercase tracking-wider ${r.id === selectedId ? 'text-[#ff460b]' : 'text-[#555]'}`}>
                {r.status === 'active' ? '● Active' : r.completed_at ? new Date(r.completed_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : 'completed'}
              </div>
            </button>
          ))}
          {!releases.length && <p className="text-[#555] text-xs px-4 py-3">No releases yet.</p>}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Alerts — dark, padded */}
        <div className="px-6 pt-4 space-y-3">
          {branchResults.length > 0 && (
            <div className="border border-[#2a2a2a] bg-[#111111] p-4 space-y-2 rounded-lg shadow-lg">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white">Branch Creation Results</p>
                <button onClick={() => setBranchResults([])} className="text-[10px] text-[#666] hover:text-white uppercase tracking-wider">Dismiss</button>
              </div>
              {branchResults.map(r => (
                <div key={r.repo} className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-0.5 font-mono uppercase tracking-wider rounded ${
                    r.result === 'created' ? 'bg-green-950/40 text-green-500 border border-green-900' :
                    r.result === 'already exists' ? 'bg-yellow-950/40 text-yellow-500 border border-yellow-900' :
                    'bg-red-950/40 text-red-500 border border-red-900'
                  }`}>{r.result}</span>
                  <span className="text-xs text-[#888] font-mono">{r.repo}</span>
                </div>
              ))}
            </div>
          )}

          {error && <div className="border border-red-900 bg-red-950/30 px-4 py-2.5 text-red-400 text-xs font-mono rounded-lg">{error}</div>}

          {mrResults.length > 0 && (
            <div className="border border-[#2a2a2a] bg-[#111111] p-4 space-y-2 rounded-lg shadow-lg">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white">Deploy Merge Requests</p>
                <div className="flex items-center gap-3">
                  {mrResults.filter(r => r.url).length > 1 && (
                    <button
                      onClick={() => {
                        const text = mrResults
                          .filter(r => r.url)
                          .map(r => `${r.repo}\n${r.url}`)
                          .join('\n\n');
                        navigator.clipboard.writeText(text);
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 uppercase tracking-wider transition-colors">
                      Copy all links
                    </button>
                  )}
                  <button onClick={() => setMrResults([])} className="text-[10px] text-[#666] hover:text-white uppercase tracking-wider">Dismiss</button>
                </div>
              </div>
              {mrResults.map(r => (
                <div key={r.repo} className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-0.5 font-mono uppercase tracking-wider rounded ${
                    r.result === 'created' ? 'bg-green-950/40 text-green-500 border border-green-900' :
                    r.result === 'already exists' ? 'bg-yellow-950/40 text-yellow-500 border border-yellow-900' :
                    'bg-red-950/40 text-red-500 border border-red-900'
                  }`}>{r.result}</span>
                  <span className="text-xs text-[#888] font-mono">{r.repo}</span>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-400 hover:text-blue-300 underline ml-auto">
                      View MR
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {missingBranches && (
            <div className="border border-yellow-900/60 bg-[#111111] p-5 space-y-3 rounded-lg shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-yellow-400">Release branches missing on GitLab</p>
                  <p className="text-xs text-[#777] mt-1">
                    Branch <code className="text-[#ff460b] font-mono">{missingBranches.branch}</code> doesn't exist on some repos.
                    Create them from <code className="text-green-500 font-mono">stage</code> before generating.
                  </p>
                </div>
                <button onClick={() => setMissingBranches(null)} className="text-[#666] hover:text-[#999] text-xs uppercase tracking-wider shrink-0">Dismiss</button>
              </div>
              <div className="space-y-1.5 border border-[#2a2a2a] divide-y divide-[#2a2a2a] rounded bg-[#0d0d0d]">
                {missingBranches.repos.map(r => (
                  <div key={r.repoId} className="flex items-center gap-3 px-3 py-2">
                    <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${r.error ? 'bg-[#555]' : r.exists ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-xs text-[#aaa] flex-1 font-mono">{r.name}</span>
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${r.error ? 'text-[#666]' : r.exists ? 'text-green-500' : 'text-yellow-500'}`}>
                      {r.error ?? (r.exists ? 'exists' : 'missing')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={createMissingBranches} disabled={creatingBranches}
                  className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider transition-colors rounded">
                  {creatingBranches ? 'Creating...' : 'Create missing from stage'}
                </button>
                <button onClick={runGenerate} disabled={generating}
                  className="px-4 py-2 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#777] hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors rounded">
                  Generate anyway
                </button>
              </div>
            </div>
          )}
        </div>

        {!selectedId && <div className="text-[#666] py-12 text-center text-sm">Select or create a release.</div>}

        {selected && (
          <>
            {/* Release header */}
            <div className="mx-6 mt-4 bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/40 border-l-4 border-l-[#ff460b] overflow-hidden">
              <div className="px-6 py-5 flex items-start justify-between gap-4 flex-wrap border-b border-[#2a2a2a]">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-base font-semibold text-white font-mono">{selected.name}</h1>
                    <StatusBadge status={selected.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#777]">Branch <code className="text-[#ff460b] font-mono normal-case ml-1">{selected.branch_name}</code></span>
                    <span className="text-[10px] uppercase tracking-wider text-[#777]">Created <span className="text-[#999] normal-case ml-1">{new Date(selected.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
                  </div>
                </div>
                <div className="flex gap-2 items-center relative">
                  <div className="relative flex">
                    <button onClick={generate} disabled={generating}
                      className="px-4 py-2 bg-[#1a3a1a] hover:bg-[#1e451e] disabled:opacity-50 text-green-400 text-xs font-semibold uppercase tracking-wider transition-colors border border-green-900 rounded-l">
                      {generating ? genMsg || 'Generating...' : doc ? 'Regenerate' : 'Generate Document'}
                    </button>
                    <button onClick={() => setShowGenOptions(v => !v)} disabled={generating}
                      className="px-2.5 py-2 bg-[#1a3a1a] hover:bg-[#1e451e] disabled:opacity-50 text-green-500 border border-green-900 border-l-green-950 text-xs transition-colors rounded-r">
                      ⚙
                    </button>
                  </div>
                  {showGenOptions && (
                    <div className="absolute right-0 top-full mt-1 w-72 bg-[#111111] border border-[#2a2a2a] shadow-2xl z-20 p-4 space-y-3 rounded-lg">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white">Generation Options</p>
                      <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setGenOptions(o => ({ ...o, hideMergeCommits: !o.hideMergeCommits }))}>
                        <div>
                          <p className="text-xs text-white">Ignore merge commits</p>
                          <p className="text-[10px] text-[#666] mt-0.5">Skip "Merge branch X into Y" commits</p>
                        </div>
                        <div className={`relative inline-flex h-5 w-9 shrink-0 border-2 border-transparent transition-colors rounded-full ${genOptions.hideMergeCommits ? 'bg-[#ff460b]' : 'bg-[#2a2a2a]'}`}>
                          <span className={`inline-block h-4 w-4 bg-white shadow transform transition-transform rounded-full ${genOptions.hideMergeCommits ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </div>
                  )}
                  {selected.status === 'active' && (
                    <button onClick={createDeployMRs} disabled={creatingMRs}
                      className="px-4 py-2 bg-[#1a1a3a] hover:bg-[#1e1e45] disabled:opacity-50 text-blue-400 text-xs font-semibold uppercase tracking-wider transition-colors border border-blue-900 rounded">
                      {creatingMRs ? 'Creating MRs...' : 'Create Deploy MRs'}
                    </button>
                  )}
                  {selected.status === 'active' && (
                    <button onClick={completeRelease}
                      className="px-4 py-2 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#777] hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors rounded">
                      Mark Deployed
                    </button>
                  )}
                </div>
              </div>

              {/* Tracked repos */}
              <div className="px-6 py-4 flex items-center gap-2 flex-wrap border-t border-[#2a2a2a]">
                <span className="text-[10px] uppercase tracking-widest text-[#666] mr-1">Repos</span>
                {releaseRepos.map(({ rr, repo }) => (
                  <div key={rr.id} className="flex items-center gap-1 border border-[#2a2a2a] bg-[#0d0d0d] pl-2.5 pr-1 py-1 rounded">
                    <span className="text-xs text-[#888] font-mono">{repo.name}</span>
                    <button onClick={() => removeRepo(rr.id)} className="text-[#666] hover:text-red-500 transition-colors ml-1 px-1 text-xs">✕</button>
                  </div>
                ))}
                <RepoSearchDropdown
                  excludeIds={new Set(releaseRepos.map(r => r.repo.project_id || ''))}
                  onAdd={async (project) => {
                    // Ensure repo exists in registry, then add to release
                    let repoId = repos.find(r => r.gitlab_path === project.path_with_namespace)?.id;
                    if (!repoId) {
                      const res = await api.post<{ id: string }>('/repos', {
                        name: project.name,
                        gitlab_path: project.path_with_namespace,
                        project_id: String(project.id),
                      }).catch(async () => {
                        const all = await api.get<{ id: string; gitlab_path: string }[]>('/repos');
                        return all.find(r => r.gitlab_path === project.path_with_namespace) ?? { id: '' };
                      });
                      repoId = res.id;
                    }
                    if (repoId) {
                      await addRepo(repoId);
                    }
                  }}
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="mx-6 mt-4 flex border-b border-[#2a2a2a]">
              {(['document', 'pipeline', 'hotfixes'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                    tab === t
                      ? 'border-[#ff460b] text-white'
                      : 'border-transparent text-[#777] hover:text-[#999]'
                  }`}>
                  {t === 'pipeline' ? 'Staging Pipeline' : t === 'hotfixes' ? 'Hotfixes' : 'Document'}
                </button>
              ))}
            </div>

            {loading && <p className="text-[#666] px-6 py-4 text-sm">Loading...</p>}

            {/* Document tab */}
            {!loading && tab === 'document' && (
              doc
                ? <div className="mt-4 mx-6">
                    <ReleaseDocEditor releaseId={selectedId} doc={doc} onSaved={setDoc} />
                  </div>
                : <div className="mx-6 mt-4 border border-[#2a2a2a] bg-[#111111] p-10 text-center rounded-xl shadow-lg">
                    <p className="text-[#777] text-sm mb-2">No document generated yet.</p>
                    <p className="text-[#666] text-xs">Click "Generate Document" to pull data from GitLab and YouTrack.</p>
                  </div>
            )}

            {!loading && tab === 'pipeline' && <div className="mx-6 mt-4"><StagingPipeline releaseId={selectedId} /></div>}
            {!loading && tab === 'hotfixes' && <div className="mx-6 mt-4"><HotfixView releaseId={selectedId} /></div>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Repo Search Dropdown ───────────────────────────────────────────────────────

interface GitLabProject { id: number; name: string; path_with_namespace: string; namespace?: { name: string } }

interface RepoSearchDropdownProps {
  excludeIds: Set<string>;
  onAdd: (project: GitLabProject) => Promise<void>;
}

function RepoSearchDropdown({ excludeIds, onAdd }: RepoSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<GitLabProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Position dropdown when opening
  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(v => !v);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (q.length < 2) { setResults([]); return; }
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<GitLabProject[]>(`/repos/gitlab-search?q=${encodeURIComponent(q)}`);
        setResults(res);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const handleAdd = async (project: GitLabProject) => {
    setAdding(true);
    try {
      await onAdd(project);
      setSearch('');
      setResults([]);
      setOpen(false);
    } finally {
      setAdding(false);
    }
  };

  // Filter out repos already in release
  const filtered = results.filter(p => !excludeIds.has(String(p.id)));

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        disabled={adding}
        className="bg-[#0d0d0d] border border-dashed border-[#2a2a2a] hover:border-[#ff460b] px-2.5 py-1 text-xs text-[#777] hover:text-white focus:outline-none cursor-pointer rounded transition-colors disabled:opacity-50">
        {adding ? 'Adding...' : '+ Add repo'}
      </button>

      {open && (
        <div
          className="fixed w-80 bg-[#111] border border-[#2a2a2a] shadow-2xl z-50 rounded-lg overflow-hidden"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}>
          <div className="p-2 border-b border-[#2a2a2a]">
            <input
              autoFocus
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search GitLab repos..."
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#ff460b] rounded"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {searching && (
              <p className="text-xs text-[#666] px-3 py-3 animate-pulse">Searching GitLab...</p>
            )}

            {!searching && search.length < 2 && (
              <p className="text-xs text-[#555] px-3 py-3">Type at least 2 characters to search</p>
            )}

            {!searching && search.length >= 2 && filtered.length === 0 && (
              <p className="text-xs text-[#555] px-3 py-3">No repos found</p>
            )}

            {!searching && filtered.map(p => (
              <button
                key={p.id}
                onClick={() => handleAdd(p)}
                className="w-full flex flex-col px-3 py-2.5 text-left hover:bg-[#1a1a1a] transition-colors border-b border-[#2a2a2a] last:border-0">
                <span className="text-sm text-white font-medium">{p.name}</span>
                <span className="text-xs text-[#666] font-mono truncate">{p.path_with_namespace}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Release Modal ─────────────────────────────────────────────────────────

interface NewReleaseModalProps {
  onClose: () => void;
  onCreated: (id: string, branches: { repo: string; result: string }[]) => void;
}

type ActiveRepo = { id: number; name: string; gitlab_path: string; commitCount: number; featureCount: number; hotfixCount: number; backmergeCount: number };

function NewReleaseModal({ onClose, onCreated }: NewReleaseModalProps) {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultName = `release-${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;

  const [name, setName] = useState(defaultName);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<GitLabProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GitLabProject[]>([]);
  const [createBranches, setCreateBranches] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Active repo scan
  const [scanning, setScanning] = useState(true);
  const [activeRepos, setActiveRepos] = useState<ActiveRepo[]>([]);
  const [scanError, setScanError] = useState('');
  const [showHotfixOnly, setShowHotfixOnly] = useState(true);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // On open: scan GitLab projects for stage → main changes (server controls scan window)
  useEffect(() => {
    api.get<ActiveRepo[]>('/repos/active')
      .then(repos => {
        setActiveRepos(repos);
        // Auto-select repos with feature commits; hotfix-only repos start unchecked
        setSelected(repos
          .filter(r => r.featureCount > 0)
          .map(r => ({ id: r.id, name: r.name, path_with_namespace: r.gitlab_path })));
      })
      .catch(() => setScanError('Could not scan GitLab — select repos manually below.'))
      .finally(() => setScanning(false));
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<GitLabProject[]>(`/repos/gitlab-search?q=${encodeURIComponent(q)}`);
        setSearchResults(res);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const toggle = (project: GitLabProject) => {
    setSelected(prev =>
      prev.find(p => p.id === project.id)
        ? prev.filter(p => p.id !== project.id)
        : [...prev, project]
    );
  };

  const toggleActive = (repo: ActiveRepo) => {
    const asProject: GitLabProject = { id: repo.id, name: repo.name, path_with_namespace: repo.gitlab_path };
    toggle(asProject);
  };

  const handleCreate = async () => {
    if (!name || !selected.length) return;
    setCreating(true);
    setError('');
    try {
      const repoIds: string[] = [];
      for (const project of selected) {
        const res = await api.post<{ id: string }>('/repos', {
          name: project.name,
          gitlab_path: project.path_with_namespace,
          project_id: String(project.id),
        }).catch(async () => {
          const all = await api.get<{ id: string; gitlab_path: string }[]>('/repos');
          return all.find(r => r.gitlab_path === project.path_with_namespace) ?? { id: '' };
        });
        if (res.id) repoIds.push(res.id);
      }
      const result = await api.post<{ id: string; branches: { repo: string; result: string }[] }>(
        '/releases', { name, repo_ids: repoIds, create_branches: createBranches }
      );
      onCreated(result.id, result.branches ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const withChanges = showHotfixOnly ? activeRepos : activeRepos.filter(r => r.featureCount > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#111111] border border-[#2a2a2a] shadow-2xl shadow-black/50 w-full max-w-2xl flex flex-col max-h-[90vh] rounded-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-4 bg-[#ff460b]" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">New Release</h2>
          </div>
          <button onClick={onClose} className="text-[#666] hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Release name */}
          <div>
            <label className="text-[10px] font-semibold text-[#777] uppercase tracking-widest block mb-2">Release Name</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#ff460b] transition-colors rounded"
              placeholder="release-20260407"
            />
          </div>

          {/* Active repos scan */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-semibold text-[#777] uppercase tracking-widest">
                Repos with Changes
                <span className="text-[#666] normal-case font-normal ml-1">— stage ahead of main</span>
              </label>
              {scanning && <span className="text-[10px] text-[#666] uppercase tracking-wider animate-pulse">Scanning GitLab...</span>}
              {!scanning && !scanError && (
                <span className="text-[10px] text-[#777]">
                  {activeRepos.length} repo{activeRepos.length !== 1 ? 's' : ''} with changes
                </span>
              )}
            </div>

            {/* Filter toggle */}
            {!scanning && activeRepos.some(r => r.featureCount === 0 && r.hotfixCount > 0) && (
              <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                <span className={`w-7 h-4 rounded-full relative transition-colors ${showHotfixOnly ? 'bg-[#ff460b]' : 'bg-[#2a2a2a]'}`}
                  onClick={() => setShowHotfixOnly(!showHotfixOnly)}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showHotfixOnly ? 'left-3.5' : 'left-0.5'}`} />
                </span>
                <span className="text-[10px] text-[#777] group-hover:text-[#999] transition-colors">Include hotfix-only repos</span>
              </label>
            )}

            {scanError && (
              <p className="text-xs text-yellow-600 font-mono mb-3">{scanError}</p>
            )}

            {scanning && (
              <div className="border border-[#2a2a2a] divide-y divide-[#2a2a2a] rounded-lg bg-[#0d0d0d]">
                {[1,2,3,4].map(i => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-4 h-4 bg-[#1a1a1a] animate-pulse rounded" />
                    <div className="flex-1 h-3 bg-[#1a1a1a] rounded animate-pulse" />
                    <div className="w-16 h-3 bg-[#1a1a1a] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {!scanning && activeRepos.length > 0 && (
              <div className="border border-[#2a2a2a] divide-y divide-[#2a2a2a] max-h-72 overflow-y-auto rounded-lg bg-[#0d0d0d]">
                {/* Repos with changes first */}
                {withChanges.map(repo => {
                  const isSelected = !!selected.find(s => s.id === repo.id);
                  const isHotfixOnly = repo.featureCount === 0 && repo.hotfixCount > 0;
                  return (
                    <button key={repo.id} onClick={() => toggleActive(repo)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2 ${isHotfixOnly ? 'border-l-amber-500' : 'border-l-transparent'} ${isSelected ? 'bg-[#1a1a1a]' : 'hover:bg-[#161616]'}`}>
                      <span className={`w-4 h-4 shrink-0 border rounded flex items-center justify-center text-xs transition-colors ${
                        isSelected ? 'bg-[#ff460b] border-[#ff460b] text-white' : 'border-[#444]'
                      }`}>
                        {isSelected && '✓'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white font-medium truncate">{repo.name}</p>
                          {isHotfixOnly && <span className="text-[8px] px-1.5 py-0.5 bg-amber-900/40 border border-amber-500/30 text-amber-400 font-semibold uppercase tracking-wider shrink-0 rounded">Hotfix Only</span>}
                        </div>
                        <p className="text-xs text-[#666] font-mono truncate">{repo.gitlab_path}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {repo.featureCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 bg-[#1a0800] border border-[#ff460b]/30 text-[#ff460b] font-mono rounded">
                            {repo.featureCount} feature{repo.featureCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {repo.hotfixCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 bg-amber-900/20 border border-amber-500/30 text-amber-400 font-mono rounded">
                            {repo.hotfixCount} hotfix{repo.hotfixCount !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual search — for repos not in registry */}
          <div>
            <label className="text-[10px] font-semibold text-[#777] uppercase tracking-widest block mb-2">
              Add More <span className="text-[#666] normal-case font-normal">— search GitLab for repos not in registry</span>
            </label>
            <div className="relative">
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search GitLab repos..."
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-4 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#ff460b] transition-colors rounded"
              />
              {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#666]">Searching...</span>}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 border border-[#2a2a2a] overflow-hidden rounded-lg bg-[#0d0d0d]">
                {searchResults
                  .filter(p => !activeRepos.find(r => r.id === p.id))
                  .map(p => {
                    const isSelected = !!selected.find(s => s.id === p.id);
                    return (
                      <button key={p.id} onClick={() => toggle(p)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#2a2a2a] last:border-0 ${isSelected ? 'bg-[#1a1a1a]' : 'hover:bg-[#161616]'}`}>
                        <span className={`w-4 h-4 shrink-0 border rounded flex items-center justify-center text-xs transition-colors ${
                          isSelected ? 'bg-[#ff460b] border-[#ff460b] text-white' : 'border-[#444]'
                        }`}>
                          {isSelected && '✓'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{p.name}</p>
                          <p className="text-xs text-[#666] font-mono truncate">{p.path_with_namespace}</p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Branch creation */}
          {selected.length > 0 && (
            <div className="border border-[#2a2a2a] p-4 space-y-3 rounded-lg bg-[#0d0d0d]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Create release branches on GitLab?</p>
                  <p className="text-xs text-[#777] mt-0.5">
                    Creates <code className="text-[#ff460b] font-mono">{name || 'release-YYYYMMDD'}</code> from{' '}
                    <code className="text-green-500 font-mono">stage</code> on each selected repo
                  </p>
                </div>
                <button onClick={() => setCreateBranches(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 border-2 border-transparent transition-colors cursor-pointer rounded-full ${createBranches ? 'bg-[#ff460b]' : 'bg-[#2a2a2a]'}`}>
                  <span className={`inline-block h-4 w-4 bg-white shadow transform transition-transform rounded-full ${createBranches ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              {createBranches && (
                <div className="border border-yellow-900/60 bg-yellow-950/20 px-3 py-2 text-yellow-500 text-xs rounded">
                  Make sure <code className="font-mono">stage</code> is stable — branches cut from it now.
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] flex items-center justify-between gap-3">
          <p className="text-xs text-[#777]">
            {selected.length === 0
              ? 'Select at least one repo to continue'
              : `${selected.length} repo${selected.length !== 1 ? 's' : ''} selected`}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[#777] hover:text-white text-xs uppercase tracking-wider transition-colors rounded">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name || selected.length === 0}
              className="px-5 py-2 bg-[#ff460b] hover:bg-[#e03d08] disabled:opacity-40 text-white text-xs font-semibold uppercase tracking-wider transition-colors rounded">
              {creating ? (createBranches ? 'Creating branches...' : 'Creating...') : 'Create Release'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hydrateDoc(stored: ReleaseDoc): ReleaseDoc {
  const defaults = emptyDoc(stored.release?.name ?? '', stored.release?.date ?? '', stored.release?.branch ?? '');
  return {
    ...defaults,
    ...stored,
    riskFactors: { ...defaults.riskFactors, ...(stored.riskFactors ?? {}) },
    summary: { ...defaults.summary, ...(stored.summary ?? {}) },
    libraryVersions: stored.libraryVersions ?? [],
    externalDependencies: stored.externalDependencies ?? [],
    dbMigrations: stored.dbMigrations ?? [],
    envVarUpdates: stored.envVarUpdates ?? [],
    deploymentOrder: stored.deploymentOrder ?? [],
    preDeployChecklist: stored.preDeployChecklist ?? defaults.preDeployChecklist,
    postDeployChecklist: stored.postDeployChecklist ?? defaults.postDeployChecklist,
    rollbackTriggers: stored.rollbackTriggers ?? defaults.rollbackTriggers,
    rollbackSteps: stored.rollbackSteps ?? defaults.rollbackSteps,
    knownIssues: stored.knownIssues ?? [],
    stakeholders: stored.stakeholders ?? defaults.stakeholders,
    riskNotes: stored.riskNotes ?? [],
    excludedTickets: stored.excludedTickets ?? [],
    signOff: { ...defaults.signOff, ...(stored.signOff ?? {}) },
    deploymentWindow: { ...defaults.deploymentWindow, ...(stored.deploymentWindow ?? {}) },
    repos: (stored.repos ?? []).map(r => ({
      ...r,
      tickets: r.tickets ?? [],
      sections: r.sections ?? [],
    })),
  };
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'active'
    ? 'border border-[#ff460b]/40 text-[#ff460b] bg-[#1a0a00]'
    : 'border border-[#2a2a2a] text-[#444]';
  return <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest ${cls}`}>{status}</span>;
}
