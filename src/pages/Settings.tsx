import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Repo } from '../api/client';

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

  useEffect(() => {
    api.get<Repo[]>('/repos').then(setRepos).catch(e => setError(String(e)));
    api.get<Record<string, string>>('/settings').then(s => {
      setCreateBranches(s['CREATE_BRANCHES'] === 'true');
      const ex = s['EXCLUDED_TICKET_PATTERNS'];
      setExcludedTickets(ex ? ex.split(',').map(t => t.trim()).filter(Boolean) : []);
      if (s['SCAN_WINDOW_DAYS']) setScanWindowDays(parseInt(s['SCAN_WINDOW_DAYS'], 10) || 90);
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

  const alreadyAdded = new Set(repos.map(r => r.gitlab_path));

  return (
    <div className="max-w-3xl space-y-8">

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
    </div>
  );
}
