import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Release, ReleaseRepo } from '../api/client';

interface ActiveRelease extends Release {
  repos: ReleaseRepo[];
}

export default function Dashboard() {
  const [active, setActive] = useState<ActiveRelease | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<ActiveRelease | null>('/releases/active'),
      api.get<Release[]>('/releases'),
    ])
      .then(([a, all]) => { setActive(a); setReleases(all); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-[#555] text-sm">Loading...</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;

  const completed = releases.filter(r => r.status === 'completed').slice().reverse();
  const deployRepos = active?.repos?.filter(r => r.rr.deploy_status === 'deploy') ?? [];
  const noDeployRepos = active?.repos?.filter(r => r.rr.deploy_status === 'no-deploy') ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* Page title */}
      <div className="flex items-center gap-3">
        <div className="w-[3px] h-6 bg-[#ff460b] rounded-full" />
        <h1 className="text-lg font-semibold text-white uppercase tracking-widest">Dashboard</h1>
      </div>

      {/* Active release */}
      {active ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/40 overflow-hidden hover:border-[#333] transition-colors">
          <div className="px-8 py-6 border-b border-[#2a2a2a] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#ff460b] border border-[#ff460b]/60 px-2.5 py-1 rounded bg-[#ff460b]/5">
                Active
              </span>
              <h2 className="text-lg font-semibold text-white tracking-tight">{active.name}</h2>
            </div>
            <Link
              to={`/releases/${active.id}`}
              className="text-xs font-semibold uppercase tracking-wider px-5 py-2.5 bg-[#ff460b] hover:bg-[#ff5722] text-white transition-all rounded shadow-lg hover:shadow-xl hover:shadow-[#ff460b]/30"
            >
              Open Release →
            </Link>
          </div>

          <div className="px-8 py-8 grid grid-cols-3 divide-x divide-[#2a2a2a]">
            <StatCell label="Total Repos" value={active.repos?.length ?? 0} />
            <StatCell label="Deploying" value={deployRepos.length} accent />
            <StatCell label="No-Deploy" value={noDeployRepos.length} muted />
          </div>

          <div className="px-8 py-5 border-t border-[#2a2a2a] flex items-center gap-4 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-[#666]">Branch</span>
            <code className="text-xs text-[#ff460b] font-mono px-2.5 py-1 bg-[#1a1a1a] rounded border border-[#2a2a2a]">{active.branch_name}</code>
            <span className="text-[#333]">·</span>
            <span className="text-[10px] uppercase tracking-widest text-[#666]">Created</span>
            <span className="text-xs text-[#888]">{new Date(active.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>

          {active.repos?.length > 0 && (
            <div className="px-8 py-6 border-t border-[#2a2a2a]">
              <p className="text-[10px] uppercase tracking-widest text-[#666] mb-4 font-semibold">Tracked Repos ({active.repos.length})</p>
              <div className="flex flex-wrap gap-2.5">
                {active.repos.map(({ repo, rr }) => (
                  <span
                    key={repo.id}
                    className={`text-[11px] px-3 py-1.5 font-mono rounded border transition-colors ${
                      rr.deploy_status === 'no-deploy'
                        ? 'border-[#2a2a2a] text-[#777] bg-[#0d0d0d] hover:bg-[#141414]'
                        : rr.risk_level === 'high'
                          ? 'border-red-900/50 text-red-400 bg-red-950/30 hover:bg-red-950/50'
                          : rr.risk_level === 'medium'
                            ? 'border-yellow-900/50 text-yellow-400 bg-yellow-950/30 hover:bg-yellow-950/50'
                            : 'border-[#2a2a2a] text-[#aaa] bg-[#141414] hover:bg-[#1a1a1a]'
                    }`}
                  >
                    {repo.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/40 px-8 py-16 text-center">
          <p className="text-[#666] text-sm mb-4">No active release</p>
          <Link to="/releases" className="text-xs font-semibold uppercase tracking-wider text-[#ff460b] hover:text-[#ff5722] transition-colors inline-block px-4 py-2 hover:bg-[#ff460b]/10 rounded">
            Create one in Releases →
          </Link>
        </div>
      )}

      {/* Recent releases */}
      {completed.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-[3px] h-5 bg-[#ff460b] rounded-full" />
            <h2 className="text-[11px] font-semibold text-[#888] uppercase tracking-widest">Recent Releases</h2>
            <span className="text-[11px] text-[#666]">({completed.length})</span>
          </div>
          <div className="border border-[#2a2a2a] rounded-xl overflow-hidden shadow-2xl shadow-black/40 divide-y divide-[#2a2a2a]">
            {completed.slice(0, 8).map((r, i) => (
              <Link
                key={r.id}
                to={`/releases/${r.id}`}
                className="flex items-center justify-between px-8 py-4 bg-[#111111] hover:bg-[#151515] transition-all group border-l-4 border-l-transparent hover:border-l-[#ff460b]"
              >
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-[#555] w-4 text-right font-mono font-semibold">{i + 1}</span>
                  <span className="text-sm text-[#aaa] group-hover:text-white transition-colors font-mono">{r.name}</span>
                </div>
                <div className="flex items-center gap-5">
                  <span className="text-[11px] text-[#777]">
                    {r.completed_at ? new Date(r.completed_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[#777] border border-[#2a2a2a] px-2.5 py-1 rounded bg-[#0a0a0a] group-hover:text-[#aaa] group-hover:border-[#333] transition-colors">deployed</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, accent, muted }: { label: string; value: number; accent?: boolean; muted?: boolean }) {
  return (
    <div className="px-6 py-4 text-center hover:bg-[#1a1a1a] transition-colors">
      <div className={`text-4xl font-bold tracking-tight ${accent ? 'text-[#ff460b]' : muted ? 'text-[#666]' : 'text-white'}`}>
        {value}
      </div>
      <div className={`text-[10px] uppercase tracking-widest mt-3 ${accent ? 'text-[#ff460b]/70' : muted ? 'text-[#666]' : 'text-[#777]'}`}>{label}</div>
    </div>
  );
}
