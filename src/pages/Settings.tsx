import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Repo, Release } from '../api/client';

interface GitLabProject { id: number; name: string; path_with_namespace: string }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-[3px] h-4 bg-[#ff460b]" />
      <h2 className="text-[10px] font-semibold text-white uppercase tracking-widest">{children}</h2>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#111] border border-[#1f1f1f] p-5 space-y-4">
      {children}
    </div>
  );
}

export default function Settings() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<GitLabProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createBranches, setCreateBranches] = useState(false);
  const [excludedTickets, setExcludedTickets] = useState<string[]>([]);
  const [newExclude, setNewExclude] = useState('');
  const [scanWindowDays, setScanWindowDays] = useState(90);

  const [manualName, setManualName] = useState('');
  const [manualPath, setManualPath] = useState('');
  const [manualProjectId, setManualProjectId] = useState('');
  const [showManual, setShowManual] = useState(false);

  // Scan-excluded repos
  const [scanExcluded, setScanExcluded] = useState<string[]>([]);
  const [scanExcludeSearch, setScanExcludeSearch] = useState('');
  const [scanExcludeResults, setScanExcludeResults] = useState<GitLabProject[]>([]);
  const [scanExcludeSearching, setScanExcludeSearching] = useState(false);
  const scanExcludeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [youtrackProject, setYoutrackProject] = useState('INDEV');
  const [testers, setTesters] = useState<string[]>([]);
  const [newTester, setNewTester] = useState('');
  const [testerSuggestions, setTesterSuggestions] = useState<{ id: string; name: string; login: string }[]>([]);
  const [testerSearching, setTesterSearching] = useState(false);
  const testerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete release modal state
  const [releases, setReleases] = useState<Release[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Release | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get<Repo[]>('/repos').then(setRepos).catch(e => setError(String(e)));
    api.get<Release[]>('/releases').then(r => setReleases([...r].reverse())).catch(() => null);
    api.get<Record<string, string>>('/settings').then(s => {
      setCreateBranches(s['CREATE_BRANCHES'] === 'true');
      const ex = s['EXCLUDED_TICKET_PATTERNS'];
      setExcludedTickets(ex ? ex.split(',').map(t => t.trim()).filter(Boolean) : []);
      if (s['SCAN_WINDOW_DAYS']) setScanWindowDays(parseInt(s['SCAN_WINDOW_DAYS'], 10) || 90);
      if (s['YOUTRACK_PROJECT']) setYoutrackProject(s['YOUTRACK_PROJECT']);
      const se = s['SCAN_EXCLUDED_REPOS'];
      setScanExcluded(se ? se.split(',').map(p => p.trim()).filter(Boolean) : []);
      const te = s['TESTERS'];
      setTesters(te ? te.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
    }).catch(() => null);
  }, []);

  const flash = (msg: string, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const saveExcludedTickets = async (list: string[]) => {
    await api.put('/settings/EXCLUDED_TICKET_PATTERNS', { value: list.join(',') });
  };

  const addExcludedTicket = async () => {
    const val = newExclude.trim().toUpperCase();
    if (!val || excludedTickets.includes(val)) return;
    const updated = [...excludedTickets, val];
    setExcludedTickets(updated);
    setNewExclude('');
    await saveExcludedTickets(updated);
    flash(`${val} added`);
  };

  const removeExcludedTicket = async (ticket: string) => {
    const updated = excludedTickets.filter(t => t !== ticket);
    setExcludedTickets(updated);
    await saveExcludedTickets(updated);
  };

  const toggleBranchCreation = async (enabled: boolean) => {
    setCreateBranches(enabled);
    await api.put('/settings/CREATE_BRANCHES', { value: String(enabled) });
    flash(enabled ? 'Branch creation enabled' : 'Branch creation disabled');
  };

  const searchGitLab = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get<GitLabProject[]>(`/repos/gitlab-search?q=${encodeURIComponent(q)}`);
      setSearchResults(res);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const addFromGitLab = async (project: GitLabProject) => {
    setSaving(true);
    setError('');
    try {
      await api.post('/repos', { name: project.name, gitlab_path: project.path_with_namespace, project_id: String(project.id) });
      const updated = await api.get<Repo[]>('/repos');
      setRepos(updated);
      setSearch('');
      setSearchResults([]);
      flash(`Added ${project.name}`);
    } catch (e) { flash(String(e), true); }
    finally { setSaving(false); }
  };

  const addManual = async () => {
    if (!manualName || !manualPath) { flash('Name and path required', true); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/repos', { name: manualName, gitlab_path: manualPath, project_id: manualProjectId || undefined });
      const updated = await api.get<Repo[]>('/repos');
      setRepos(updated);
      setManualName(''); setManualPath(''); setManualProjectId('');
      setShowManual(false);
      flash('Repo added');
    } catch (e) { flash(String(e), true); }
    finally { setSaving(false); }
  };

  const toggleEnabled = async (repo: Repo) => {
    await api.put(`/repos/${repo.id}`, { enabled: repo.enabled ? 0 : 1 });
    setRepos(r => r.map(x => x.id === repo.id ? { ...x, enabled: x.enabled ? 0 : 1 } : x));
  };

  const deleteRepo = async (id: string) => {
    if (!confirm('Remove this repo from the registry?')) return;
    await api.delete(`/repos/${id}`);
    setRepos(r => r.filter(x => x.id !== id));
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    setDeleting(true);
    try {
      await api.delete(`/releases/${deleteTarget.id}`);
      setReleases(r => r.filter(x => x.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteConfirmText('');
      flash(`Release "${deleteTarget.name}" deleted`);
    } catch (e) {
      flash(String(e), true);
    } finally {
      setDeleting(false);
    }
  };

  const saveScanExcluded = async (list: string[]) => {
    await api.put('/settings/SCAN_EXCLUDED_REPOS', { value: list.join(',') });
  };

  const addScanExclude = async (path: string) => {
    const val = path.trim();
    if (!val || scanExcluded.includes(val)) return;
    const updated = [...scanExcluded, val];
    setScanExcluded(updated);
    setScanExcludeSearch('');
    await saveScanExcluded(updated);
    flash(`${val} excluded from scan`);
  };

  const removeScanExclude = async (path: string) => {
    const updated = scanExcluded.filter(p => p !== path);
    setScanExcluded(updated);
    await saveScanExcluded(updated);
  };

  const alreadyAdded = new Set(repos.map(r => r.gitlab_path));

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Page title */}
      <div className="flex items-center gap-3">
        <div className="w-[3px] h-5 bg-[#ff460b]" />
        <h1 className="text-sm font-semibold text-white uppercase tracking-widest">Settings</h1>
      </div>

      {/* Toast */}
      {error && (
        <div className="border border-red-900 bg-red-950/40 px-4 py-2.5 text-red-400 text-xs font-mono">{error}</div>
      )}
      {success && (
        <div className="border border-green-900 bg-green-950/40 px-4 py-2.5 text-green-400 text-xs font-mono">{success}</div>
      )}

      {/* GitLab integration */}
      <div>
        <SectionTitle>GitLab Integration</SectionTitle>
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white font-medium">Auto-create release branches</p>
              <p className="text-xs text-[#555] mt-1">
                When creating a release, automatically create the{' '}
                <code className="text-[#ff460b] font-mono">release-YYYYMMDD</code> branch on each repo via GitLab API.
                Disable if your network blocks Cloudflare Worker IPs.
              </p>
            </div>
            <button
              onClick={() => toggleBranchCreation(!createBranches)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${createBranches ? 'bg-[#ff460b]' : 'bg-[#2a2a2a]'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${createBranches ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {createBranches && (
            <div className="border border-yellow-900/50 bg-yellow-950/20 px-3 py-2 text-yellow-500 text-xs">
              Branch creation will run against your live GitLab. Branches are created from <code className="font-mono">stage</code> — read-only on stage.
            </div>
          )}
        </Panel>

        {/* Scan window */}
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white font-medium">Scan Window (days)</p>
              <p className="text-xs text-[#555] mt-1">
                How far back to look for GitLab projects with activity when scanning for repos with changes.
                Default is 90 days. Increase if you have long-lived stage changes.
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={365}
              value={scanWindowDays}
              onChange={e => {
                const v = Math.max(1, parseInt(e.target.value, 10) || 90);
                setScanWindowDays(v);
              }}
              onBlur={async () => {
                await api.put('/settings/SCAN_WINDOW_DAYS', { value: String(scanWindowDays) });
                flash(`Scan window set to ${scanWindowDays} days`);
              }}
              className="w-20 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-white text-sm text-center font-mono focus:outline-none focus:border-[#ff460b] transition-colors"
            />
          </div>
        </Panel>

        {/* YouTrack project */}
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white font-medium">YouTrack Project</p>
              <p className="text-xs text-[#555] mt-1">
                Project ID(s) used when querying YouTrack for stage tickets in Recon. Comma-separated for multiple (e.g. <code className="text-[#ff460b] font-mono">INDEV,OPS</code>).
              </p>
            </div>
            <input
              type="text"
              value={youtrackProject}
              onChange={e => setYoutrackProject(e.target.value)}
              onBlur={async () => {
                await api.put('/settings/YOUTRACK_PROJECT', { value: youtrackProject });
                flash(`YouTrack project set to ${youtrackProject}`);
              }}
              className="w-40 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-white text-sm text-center font-mono focus:outline-none focus:border-[#ff460b] transition-colors"
            />
          </div>
        </Panel>

        {/* Testers */}
        <div>
          <SectionTitle>Testers</SectionTitle>
          <Panel>
            <p className="text-xs text-[#555]">
              Names listed here are known QA testers. When a ticket is assigned to one of them, the release doc will show the GitLab MR author (the dev) instead, with a "With Tester" badge.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {testers.map(t => (
                <div key={t} className="flex items-center gap-1.5 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5">
                  <span className="text-sm text-white">{t}</span>
                  <button
                    onClick={async () => {
                      const updated = testers.filter(x => x !== t);
                      setTesters(updated);
                      await api.put('/settings/TESTERS', { value: updated.join(',') });
                      flash(`Removed ${t}`);
                    }}
                    className="text-[#444] hover:text-red-400 transition-colors ml-1 text-xs">✕</button>
                </div>
              ))}
            </div>
            <div className="relative mt-3">
              <div className="flex gap-2">
                <input
                  value={newTester}
                  onChange={e => {
                    setNewTester(e.target.value);
                    const q = e.target.value.trim();
                    if (testerTimer.current) clearTimeout(testerTimer.current);
                    if (q.length < 2) { setTesterSuggestions([]); return; }
                    testerTimer.current = setTimeout(async () => {
                      setTesterSearching(true);
                      try {
                        const res = await api.get<{ id: string; name: string; login: string }[]>(`/settings/youtrack-users?q=${encodeURIComponent(q)}`);
                        setTesterSuggestions(res.filter(u => !testers.includes(u.name)));
                      } catch { setTesterSuggestions([]); }
                      finally { setTesterSearching(false); }
                    }, 300);
                  }}
                  onKeyDown={async e => {
                    if (e.key === 'Escape') { setTesterSuggestions([]); return; }
                    if (e.key !== 'Enter') return;
                    const val = newTester.trim();
                    if (!val || testers.includes(val)) return;
                    const updated = [...testers, val];
                    setTesters(updated); setNewTester(''); setTesterSuggestions([]);
                    await api.put('/settings/TESTERS', { value: updated.join(',') });
                    flash(`Added ${val} as tester`);
                  }}
                  placeholder="Search YouTrack users..."
                  className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#333] focus:outline-none focus:border-[#ff460b] transition-colors"
                />
                {testerSearching && <span className="self-center text-xs text-[#555]">Searching...</span>}
              </div>
              {testerSuggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 bg-[#111] border border-[#2a2a2a] mt-1 max-h-48 overflow-y-auto">
                  {testerSuggestions.map(u => (
                    <button key={u.id}
                      onClick={async () => {
                        const updated = [...testers, u.name];
                        setTesters(updated); setNewTester(''); setTesterSuggestions([]);
                        await api.put('/settings/TESTERS', { value: updated.join(',') });
                        flash(`Added ${u.name} as tester`);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#1a1a1a] transition-colors flex items-center gap-3">
                      <span className="text-sm text-white">{u.name}</span>
                      <span className="text-xs text-[#444] font-mono">@{u.login}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Clear cache */}
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white font-medium">Clear Cache</p>
              <p className="text-xs text-[#555] mt-1">
                Clears all KV caches — pipeline, hotfixes, branch status, repo scan, and GitLab search results.
                Use this if you're seeing stale data.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await api.post<{ cleared: number }>('/settings/clear-cache', {});
                  flash(`Cache cleared (${res.cleared} keys)`);
                } catch (e) { flash(String(e), true); }
              }}
              className="shrink-0 px-4 py-2 border border-[#2a2a2a] text-[#888] hover:border-[#ff460b] hover:text-white text-xs uppercase tracking-wider transition-colors"
            >
              Clear Now
            </button>
          </div>
        </Panel>
      </div>

      {/* Repo registry */}
      <div>
        <SectionTitle>Repository Registry</SectionTitle>
        <Panel>
          <p className="text-xs text-[#555]">Global list of repos tracked by Nimbus. Add repos here, then include them in a release.</p>

          {/* GitLab search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); searchGitLab(e.target.value); }}
              placeholder="Search GitLab repos..."
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b] transition-colors font-mono"
            />
            {searching && <span className="absolute right-3 top-2.5 text-[#444] text-xs">Searching...</span>}
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-px bg-[#111] border border-[#2a2a2a] shadow-2xl">
                {searchResults.map(p => {
                  const added = alreadyAdded.has(p.path_with_namespace);
                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a] last:border-0 hover:bg-[#161616]">
                      <div>
                        <p className="text-sm text-white font-medium">{p.name}</p>
                        <p className="text-xs text-[#444] font-mono mt-0.5">{p.path_with_namespace}</p>
                      </div>
                      {added
                        ? <span className="text-xs text-[#333] uppercase tracking-wider">Added</span>
                        : <button onClick={() => addFromGitLab(p)} disabled={saving}
                            className="text-xs px-3 py-1 bg-[#ff460b] hover:bg-[#e03d08] text-white transition-colors font-medium uppercase tracking-wide">
                            Add
                          </button>
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual add toggle */}
          <div>
            <button onClick={() => setShowManual(v => !v)} className="text-xs text-[#555] hover:text-[#999] uppercase tracking-wider transition-colors">
              {showManual ? '▲ Hide' : '▼ Add manually (no GitLab access)'}
            </button>
            {showManual && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Display name"
                  className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b]" />
                <input value={manualPath} onChange={e => setManualPath(e.target.value)} placeholder="group/repo-name"
                  className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b] font-mono" />
                <input value={manualProjectId} onChange={e => setManualProjectId(e.target.value)} placeholder="GitLab project ID (optional)"
                  className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b]" />
                <button onClick={addManual} disabled={saving}
                  className="col-span-3 px-4 py-2 bg-[#ff460b] hover:bg-[#e03d08] text-white text-xs font-semibold uppercase tracking-wider transition-colors">
                  Add Repo
                </button>
              </div>
            )}
          </div>

          {/* Repo list */}
          <div className="divide-y divide-[#1a1a1a] border border-[#1a1a1a]">
            {repos.length === 0 && (
              <p className="text-[#444] text-xs px-4 py-3">No repos added yet.</p>
            )}
            {repos.map(repo => (
              <div key={repo.id} className={`flex items-center justify-between px-4 py-3 transition-colors ${repo.enabled ? 'bg-[#0f0f0f]' : 'bg-[#0a0a0a] opacity-40'}`}>
                <div>
                  <p className="text-sm text-white font-medium">{repo.name}</p>
                  <p className="text-xs text-[#444] font-mono mt-0.5">
                    {repo.gitlab_path}{repo.project_id ? ` · ID: ${repo.project_id}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleEnabled(repo)}
                    className={`text-[10px] px-2.5 py-1 uppercase tracking-wider border transition-colors ${
                      repo.enabled
                        ? 'border-green-900 text-green-500 hover:bg-green-950/20'
                        : 'border-[#2a2a2a] text-[#444] hover:border-[#3a3a3a]'
                    }`}>
                    {repo.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button onClick={() => deleteRepo(repo.id)} className="text-[#333] hover:text-red-500 transition-colors px-2 py-1 text-sm">✕</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Danger Zone */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-[3px] h-4 bg-red-600" />
          <h2 className="text-[10px] font-semibold text-red-500 uppercase tracking-widest">Danger Zone</h2>
        </div>
        <div className="bg-[#111] border border-red-900/40 p-5 space-y-4">
          <p className="text-xs text-[#555]">
            Permanently delete a release and all its associated data — repos, document, and history. This cannot be undone.
          </p>
          <div className="divide-y divide-[#1a1a1a] border border-[#1a1a1a]">
            {releases.length === 0 && (
              <p className="text-[#444] text-xs px-4 py-3">No releases found.</p>
            )}
            {releases.map(release => (
              <div key={release.id} className="flex items-center justify-between px-4 py-3 bg-[#0f0f0f]">
                <div>
                  <p className="text-sm text-white font-medium font-mono">{release.name}</p>
                  <p className="text-xs text-[#444] mt-0.5">
                    <span className={`uppercase tracking-wider text-[10px] mr-2 ${release.status === 'active' ? 'text-[#ff460b]' : 'text-[#333]'}`}>
                      {release.status}
                    </span>
                    {release.created_at ? new Date(release.created_at).toLocaleDateString() : ''}
                  </p>
                </div>
                <button
                  onClick={() => { setDeleteTarget(release); setDeleteConfirmText(''); }}
                  className="text-xs px-3 py-1.5 border border-red-900/60 text-red-600 hover:bg-red-950/30 hover:border-red-700 transition-colors uppercase tracking-wider"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete release confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[#111] border border-red-900/60 w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-[3px] h-4 bg-red-600 shrink-0" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Delete Release</h2>
            </div>

            <div className="border border-red-900/40 bg-red-950/20 px-4 py-3 text-red-400 text-xs space-y-1">
              <p>This will permanently delete:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-red-500/80">
                <li>The release record</li>
                <li>All associated repo links</li>
                <li>The generated release document</li>
              </ul>
              <p className="mt-2 font-semibold text-red-400">This action cannot be undone.</p>
            </div>

            <div>
              <p className="text-xs text-[#666] mb-2">
                Type <code className="text-white font-mono bg-[#1a1a1a] px-1.5 py-0.5">{deleteTarget.name}</code> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmDelete()}
                placeholder={deleteTarget.name}
                autoFocus
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#2a2a2a] font-mono focus:outline-none focus:border-red-800 transition-colors"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}
                className="px-4 py-2 text-xs text-[#666] hover:text-white border border-[#2a2a2a] hover:border-[#444] transition-colors uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmText !== deleteTarget.name || deleting}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors bg-red-900 text-red-200 hover:bg-red-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excluded tickets */}
      <div>
        <SectionTitle>Excluded Ticket IDs</SectionTitle>
        <Panel>
          <p className="text-xs text-[#555]">
            Ticket IDs added here are always marked <span className="text-red-500">excluded</span> when generating a document —
            they won't appear in the PDF or markdown output.
          </p>

          <div className="flex gap-2">
            <input
              value={newExclude}
              onChange={e => setNewExclude(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addExcludedTicket()}
              placeholder="e.g. INDEV-1234 or INDEV (prefix)"
              className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#3a3a3a] font-mono focus:outline-none focus:border-[#ff460b] transition-colors"
            />
            <button onClick={addExcludedTicket}
              className="px-4 py-2 bg-[#ff460b] hover:bg-[#e03d08] text-white text-xs font-semibold uppercase tracking-wider transition-colors">
              Add
            </button>
          </div>

          {excludedTickets.length === 0
            ? <p className="text-[#333] text-xs">No exclusions configured.</p>
            : (
              <div className="flex flex-wrap gap-1.5">
                {excludedTickets.map(t => (
                  <div key={t} className="flex items-center gap-1 border border-red-900/50 bg-red-950/20 pl-2.5 pr-1 py-1">
                    <code className="text-red-500 text-xs font-mono">{t}</code>
                    <button onClick={() => removeExcludedTicket(t)}
                      className="text-red-800 hover:text-red-400 transition-colors ml-1 px-1 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )
          }
          <p className="text-[10px] text-[#333]">
            Tip: Add a prefix like <code className="text-[#444] font-mono">INFRA</code> to exclude all tickets with that prefix.
          </p>
        </Panel>
      </div>

      {/* Scan-excluded repos */}
      <div>
        <SectionTitle>Release Scan Exclusions</SectionTitle>
        <Panel>
          <p className="text-xs text-[#555]">
            Repos listed here are hidden from the <span className="text-white">Repos with Changes</span> list when creating a release.
            They stay in the registry and can still be added manually via search.
          </p>

          {/* Search + pick */}
          <div className="relative">
            <input
              value={scanExcludeSearch}
              onChange={e => {
                const q = e.target.value;
                setScanExcludeSearch(q);
                if (scanExcludeTimer.current) clearTimeout(scanExcludeTimer.current);
                if (q.length < 2) { setScanExcludeResults([]); return; }
                scanExcludeTimer.current = setTimeout(async () => {
                  setScanExcludeSearching(true);
                  try {
                    const res = await api.get<GitLabProject[]>(`/repos/gitlab-search?q=${encodeURIComponent(q)}`);
                    setScanExcludeResults(res);
                  } catch { setScanExcludeResults([]); }
                  finally { setScanExcludeSearching(false); }
                }, 300);
              }}
              onKeyDown={e => e.key === 'Escape' && (setScanExcludeSearch(''), setScanExcludeResults([]))}
              placeholder="Search GitLab repos to exclude..."
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] font-mono focus:outline-none focus:border-[#ff460b] transition-colors"
            />
            {scanExcludeSearching && <span className="absolute right-3 top-2.5 text-[#444] text-xs">Searching...</span>}
            {scanExcludeResults.length > 0 && (
              <div className="absolute z-10 w-full mt-px bg-[#111] border border-[#2a2a2a] shadow-2xl max-h-56 overflow-y-auto">
                {scanExcludeResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a] last:border-0 hover:bg-[#161616]">
                    <div>
                      <p className="text-sm text-white font-medium">{p.name}</p>
                      <p className="text-xs text-[#444] font-mono mt-0.5">{p.path_with_namespace}</p>
                    </div>
                    {scanExcluded.includes(p.path_with_namespace)
                      ? <span className="text-xs text-[#333] uppercase tracking-wider">Excluded</span>
                      : <button
                          onClick={() => addScanExclude(p.path_with_namespace)}
                          className="text-xs px-3 py-1 bg-[#ff460b] hover:bg-[#e03d08] text-white transition-colors font-medium uppercase tracking-wide"
                        >
                          Exclude
                        </button>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current exclusions */}
          {scanExcluded.length > 0 && (
            <div>
              <p className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Currently excluded</p>
              <div className="divide-y divide-[#1a1a1a] border border-[#1a1a1a]">
                {scanExcluded.map(path => {
                  const repo = repos.find(r => r.gitlab_path === path);
                  return (
                    <div key={path} className="flex items-center justify-between px-4 py-2.5 bg-[#0f0f0f]">
                      <div>
                        {repo && <p className="text-sm text-white font-medium">{repo.name}</p>}
                        <p className="text-xs text-[#444] font-mono">{path}</p>
                      </div>
                      <button
                        onClick={() => removeScanExclude(path)}
                        className="text-[10px] px-2.5 py-1 border border-[#2a2a2a] text-[#555] hover:border-green-700 hover:text-green-500 uppercase tracking-wider transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
