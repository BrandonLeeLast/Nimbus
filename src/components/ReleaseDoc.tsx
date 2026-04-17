import { useState, useEffect, useRef } from 'react';
import { api, remapTicket } from '../api/client';
import { exportPdf } from './PdfExport';
import type { ReleaseDoc, DocRepo, DocSection, LibraryVersion, DbMigration, EnvVarUpdate, ExternalDependency } from '../api/client';

const ALL_GROUPS = ['Sport', 'Racing', 'Marketing/VIP', 'Risk/KYC', 'Casino', 'Left menu', 'Betslip', 'Admin', 'Registration', 'Strapi', 'Markets', 'User Profile', 'Promo Engine', 'Data Free', 'Icons', 'Technical Debt', 'Knowledge Share', 'Communications', 'Payment/s'];

function GroupDropdown({ groups, disabled, onChange }: { groups: string[]; disabled: boolean; onChange: (groups: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleGroup = (group: string) => {
    const newGroups = groups.includes(group)
      ? groups.filter(g => g !== group)
      : [...groups, group];
    onChange(newGroups);
  };

  const displayText = groups.length === 0 ? 'Select groups...' : groups.length === 1 ? groups[0] : `${groups.length} groups selected`;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`bg-[#0d0d0d] border px-3 py-1.5 text-xs hover:border-[#ff460b] focus:outline-none disabled:opacity-40 w-full text-left flex items-center justify-between gap-2 transition-colors ${
          isOpen ? 'border-[#ff460b]' : 'border-[#2a2a2a]'
        } ${groups.length > 0 ? 'text-white' : 'text-[#666]'}`}
      >
        <span className="truncate">{displayText}</span>
        <span className={`text-[10px] transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d0d0d] border border-[#ff460b] z-50 max-h-80 overflow-y-auto shadow-2xl" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#ff460b #1a1a1a'
        }}>
          <div className="p-3 grid grid-cols-2 gap-1.5">
            {ALL_GROUPS.map(group => (
              <label key={group} className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] px-2 py-1.5 rounded transition-colors group">
                <input
                  type="checkbox"
                  checked={groups.includes(group)}
                  onChange={() => toggleGroup(group)}
                  className="w-3.5 h-3.5 accent-[#ff460b] cursor-pointer"
                />
                <span className="text-[10px] text-[#999] group-hover:text-white transition-colors">{group}</span>
              </label>
            ))}
          </div>
          {groups.length > 0 && (
            <div className="border-t border-[#2a2a2a] p-2 flex justify-between items-center bg-[#0a0a0a]">
              <span className="text-[9px] text-[#666] uppercase tracking-wider">{groups.length} selected</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="text-[9px] text-[#ff460b] hover:text-white uppercase tracking-wider transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  releaseId: string;
  doc: ReleaseDoc;
  onSaved: (doc: ReleaseDoc) => void;
}

type Section = 'info' | 'risk' | 'description' | 'changes' | 'libraries' | 'migrations' | 'envvars' | 'deployment' | 'rollback' | 'issues' | 'notes' | 'comms' | 'signoff';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'info', label: 'Release Info' },
  { id: 'risk', label: 'Risk Assessment' },
  { id: 'description', label: 'Release Description' },
  { id: 'changes', label: 'Changes by Project' },
  { id: 'libraries', label: 'Library Versions' },
  { id: 'migrations', label: 'DB Migrations' },
  { id: 'envvars', label: 'Env Var Updates' },
  { id: 'deployment', label: 'Deployment Plan' },
  { id: 'rollback', label: 'Rollback Plan' },
  { id: 'issues', label: 'Known Issues' },
  { id: 'notes', label: 'Additional Notes' },
  { id: 'comms', label: 'Communication' },
  { id: 'signoff', label: 'Sign-Off' },
];

export default function ReleaseDocEditor({ releaseId, doc: initial, onSaved }: Props) {
  const [doc, setDoc] = useState<ReleaseDoc>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('info');
  const [youtrackBase, setYoutrackBase] = useState('');

  // Sync docStatus from parent when toggled externally (draft/final toggle in tab bar)
  useEffect(() => {
    if (initial.docStatus !== doc.docStatus) {
      setDoc(d => ({ ...d, docStatus: initial.docStatus }));
    }
  }, [initial.docStatus]);

  useEffect(() => {
    api.get<Record<string, string>>('/settings')
      .then(s => { if (s['YOUTRACK_BASE_URL']) setYoutrackBase(s['YOUTRACK_BASE_URL'].replace(/\/$/, '')); })
      .catch(() => null);
  }, []);

  const update = (patch: Partial<ReleaseDoc>) => { setDoc(d => ({ ...d, ...patch })); setDirty(true); };
  const updateRepo = (idx: number, patch: Partial<DocRepo>) => {
    update({ repos: doc.repos.map((r, i) => i === idx ? { ...r, ...patch } : r) });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/releases/${releaseId}/document`, doc);
      onSaved(doc);
      setDirty(false);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e) {
      setSaveMsg(`Error: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-0 bg-[#111] border border-[#1f1f1f]">
      {/* Section nav — dark sidebar */}
      <nav className="w-44 shrink-0 sticky top-0 self-start border-r border-[#1f1f1f]">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`w-full text-left px-4 py-2.5 text-xs transition-colors border-l-2 ${
              activeSection === s.id
                ? 'border-l-[#ff460b] text-white bg-[#1a1a1a]'
                : 'border-l-transparent text-[#555] hover:text-[#999] hover:bg-[#161616]'
            }`}>
            {s.label}
          </button>
        ))}
      </nav>

      {/* Document area */}
      <div className="flex-1 min-w-0 bg-[#0d0d0d]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#1f1f1f] bg-[#111] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">{SECTIONS.find(s => s.id === activeSection)?.label}</span>
            {dirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
            {saveMsg && <span className={`text-xs ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{saveMsg}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportPdf(doc, true)}
              className="px-3 py-1.5 border border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-white text-xs font-medium uppercase tracking-wider transition-colors">
              Preview
            </button>
            <button onClick={() => exportPdf(doc)}
              className="px-3 py-1.5 border border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-white text-xs font-medium uppercase tracking-wider transition-colors">
              Export PDF
            </button>
            <button onClick={save} disabled={saving || !dirty}
              className="px-4 py-1.5 bg-[#ff460b] hover:bg-[#e03d08] disabled:opacity-40 text-white text-xs font-semibold uppercase tracking-wider transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {activeSection === 'info' && <ReleaseInfoSection doc={doc} update={update} />}
          {activeSection === 'risk' && <RiskSection doc={doc} update={update} />}
          {activeSection === 'description' && <DescriptionSection doc={doc} update={update} />}
          {activeSection === 'changes' && <ChangesSection doc={doc} updateRepo={updateRepo} update={update} youtrackBase={youtrackBase} releaseId={releaseId} />}
          {activeSection === 'libraries' && <LibrariesSection doc={doc} update={update} />}
          {activeSection === 'migrations' && <MigrationsSection doc={doc} update={update} />}
          {activeSection === 'envvars' && <EnvVarsSection doc={doc} update={update} />}
          {activeSection === 'deployment' && <DeploymentSection doc={doc} update={update} />}
          {activeSection === 'rollback' && <RollbackSection doc={doc} update={update} />}
          {activeSection === 'issues' && <KnownIssuesSection doc={doc} update={update} />}
          {activeSection === 'notes' && <NotesSection doc={doc} update={update} />}
          {activeSection === 'comms' && <CommsSection doc={doc} update={update} />}
          {activeSection === 'signoff' && <SignOffSection doc={doc} update={update} />}
        </div>
      </div>
    </div>
  );
}

// ─── Section components ────────────────────────────────────────────────────────

function ReleaseInfoSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  return (
    <Card title="Release Information">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Release Name"><Input value={doc.release.name} disabled /></Field>
        <Field label="Release Date"><Input value={doc.release.date} onChange={v => update({ release: { ...doc.release, date: v } })} type="date" /></Field>
        <Field label="Release Lead"><Input value={doc.releaseLead} onChange={v => update({ releaseLead: v })} placeholder="e.g. Werner" /></Field>
        <Field label="Release Backup"><Input value={doc.releaseBackup} onChange={v => update({ releaseBackup: v })} placeholder="e.g. Brandon" /></Field>
        <Field label="Branch"><Input value={doc.release.branch} disabled /></Field>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Total Commits', value: doc.summary.totalCommits },
          { label: 'Tickets', value: doc.summary.totalTickets },
          { label: 'Repos Modified', value: `${doc.summary.reposModified} / ${doc.summary.reposTotal}` },
        ].map(s => (
          <div key={s.label} className="border border-[#1f1f1f] bg-[#161616] p-4 text-center">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-[#555] mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RiskSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  const rf = doc.riskFactors;
  const toggleFactor = (key: keyof typeof rf) =>
    update({ riskFactors: { ...rf, [key]: !rf[key] } });

  const factors: { key: keyof typeof rf; label: string }[] = [
    { key: 'dbMigrations', label: 'Database migrations required' },
    { key: 'breakingApiChanges', label: 'Breaking API changes' },
    { key: 'infrastructureChanges', label: 'Infrastructure changes' },
    { key: 'thirdPartyDeps', label: 'Third-party dependency updates' },
    { key: 'securityPatches', label: 'Security patches included' },
    { key: 'featureFlags', label: 'Feature flags required' },
    { key: 'rollbackPlan', label: 'Rollback plan prepared' },
  ];

  return (
    <div className="space-y-5">
      <Card title="Risk Assessment">
        <Field label="Overall Risk Level">
          <select value={doc.overallRisk} onChange={e => update({ overallRisk: e.target.value })}
            className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff460b] w-48">
            <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
          </select>
        </Field>
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-widest text-[#999] mb-3">Risk Factors</p>
          <div className="space-y-2.5">
            {factors.map(f => (
              <label key={f.key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={rf[f.key]} onChange={() => toggleFactor(f.key)}
                  className="w-4 h-4 accent-[#ff460b]" />
                <span className="text-sm text-[#ccc]">{f.label}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>
      <Card title="Risk Notes">
        <p className="text-xs text-[#999] mb-3">Add a bullet for each checked risk factor — explain the specific risk.</p>
        <BulletList items={doc.riskNotes} onChange={v => update({ riskNotes: v })} placeholder="Describe this risk factor..." />
      </Card>
    </div>
  );
}

function DescriptionSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  return (
    <Card title="Release Description">
      <Field label="Overview paragraph">
        <textarea value={doc.overview} rows={6} onChange={e => update({ overview: e.target.value })}
          placeholder="Describe what this release delivers..."
          className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#ff460b] placeholder-[#bbb]" />
      </Field>
    </Card>
  );
}

function ChangesSection({ doc, updateRepo, update, youtrackBase, releaseId }: { doc: ReleaseDoc; updateRepo: (i: number, p: Partial<DocRepo>) => void; update: (p: Partial<ReleaseDoc>) => void; youtrackBase: string; releaseId: string }) {
  return (
    <div className="space-y-5">
      {doc.repos.map((repo, ri) => (
        <RepoChangeCard key={repo.repoId} repo={repo} onChange={p => updateRepo(ri, p)} youtrackBase={youtrackBase} releaseId={releaseId} />
      ))}
      {!doc.repos.length && <p className="text-[#999] text-sm">No repos yet — generate the document first.</p>}

      {/* Global excluded tickets */}
      <Card title="Excluded Ticket IDs">
        <p className="text-xs text-[#999] mb-3">These tickets are globally excluded from this document (separate from Settings-level exclusions).</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {doc.excludedTickets.map(t => (
            <div key={t} className="flex items-center gap-1 bg-red-950/20 border border-red-900/50 px-2 py-1">
              <code className="text-red-400 text-xs font-mono">{t}</code>
              <button onClick={() => update({ excludedTickets: doc.excludedTickets.filter(x => x !== t) })}
                className="text-red-800 hover:text-red-400 ml-1 text-xs">✕</button>
            </div>
          ))}
        </div>
        <AddItemInput placeholder="Ticket ID to exclude e.g. INDEV-1234"
          onAdd={v => update({ excludedTickets: [...doc.excludedTickets, v.toUpperCase()] })} />
      </Card>
    </div>
  );
}

function parseSuspicious(s: string): { reason: string; suggestions: string[] } {
  const marker = ' · Did you mean ';
  const idx = s.indexOf(marker);
  if (idx === -1) return { reason: s, suggestions: [] };
  const reason = s.slice(0, idx);
  const sugStr = s.slice(idx + marker.length).replace(/\?$/, '');
  return { reason, suggestions: sugStr.split(',').map(x => x.trim()).filter(Boolean) };
}

function RepoChangeCard({ repo, onChange, youtrackBase, releaseId }: { repo: DocRepo; onChange: (p: Partial<DocRepo>) => void; youtrackBase: string; releaseId: string }) {
  const [expanded, setExpanded] = useState(true);
  const [remapping, setRemapping] = useState<string | null>(null);
  const updateSection = (i: number, patch: Partial<DocSection>) =>
    onChange({ sections: repo.sections.map((s, j) => j === i ? { ...s, ...patch } : s) });

  const handleRemap = async (oldId: string, newId: string, ticketIndex: number) => {
    setRemapping(newId);
    try {
      const res = await remapTicket(releaseId, oldId, newId);
      if (res.success) {
        const tickets = repo.tickets.map((x, j) => j === ticketIndex ? res.ticket : x);
        onChange({ tickets, ticketCount: tickets.filter(x => !x.excluded).length });
      }
    } catch (e) {
      console.error('Remap failed:', e);
    } finally {
      setRemapping(null);
    }
  };

  return (
    <div className="border border-[#1f1f1f] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1f1f1f] bg-[#161616] cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-[#ff460b] text-sm">{repo.name}</span>
          <span className="text-xs text-[#999]">{repo.commitCount} commits · {repo.tickets.filter(t => !t.excluded).length} tickets</span>
          <span className={`text-[10px] px-2 py-0.5 uppercase tracking-wider font-medium ${repo.deployStatus === 'no-deploy' ? 'bg-[#1a1a1a] text-[#555]' : 'bg-green-950/30 text-green-500 border border-green-900/50'}`}>
            {repo.deployStatus === 'no-deploy' ? 'no-deploy' : 'deploy'}
          </span>
        </div>
        <span className="text-[#aaa] text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="p-5 space-y-5 bg-[#111]">
          {/* Repo-level controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#999]">Deploy:</label>
              <select value={repo.deployStatus} onChange={e => onChange({ deployStatus: e.target.value })}
                className="bg-[#0d0d0d] border border-[#2a2a2a] px-2 py-1 text-sm text-white focus:outline-none focus:border-[#ff460b]">
                <option value="deploy">Deploy</option>
                <option value="no-deploy">No Deploy</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#999]">Risk:</label>
              <select value={repo.riskLevel} onChange={e => onChange({ riskLevel: e.target.value })}
                className="bg-[#0d0d0d] border border-[#2a2a2a] px-2 py-1 text-sm text-white focus:outline-none focus:border-[#ff460b]">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div className="flex-1">
              <input value={repo.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Deployment notes..."
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#bbb] focus:outline-none focus:border-[#ff460b]" />
            </div>
          </div>

          {/* Tickets */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#999] mb-2">Tickets</p>
            <div className="space-y-1.5">
              {repo.tickets.map((t, ti) => (
                <div key={t.id} className={`flex flex-col border transition-colors ${t.suspicious ? 'border-amber-700/60 bg-amber-950/10' : t.excluded ? 'border-red-900/50 bg-red-950/20' : 'border-[#1f1f1f] bg-[#141414]'}`}>
                  {t.suspicious && (() => {
                    const { reason, suggestions } = parseSuspicious(t.suspicious);
                    return (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/30 border-b border-amber-700/40 flex-wrap">
                        <span className="text-amber-400 text-[10px] font-semibold uppercase tracking-wider">Suspicious</span>
                        <span className="text-amber-300/80 text-[10px]">{reason}</span>
                        {suggestions.length > 0 && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-amber-400/60 text-[10px]">Remap to:</span>
                            {suggestions.map(s => (
                              <button key={s} disabled={remapping !== null}
                                onClick={e => { e.stopPropagation(); handleRemap(t.id, s, ti); }}
                                className="px-2 py-0.5 text-[10px] font-mono bg-amber-900/40 border border-amber-700/50 text-amber-200 hover:bg-amber-800/50 hover:text-white transition-colors disabled:opacity-40">
                                {remapping === s ? 'Remapping...' : s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex items-start gap-3 px-3 py-2.5">
                  {youtrackBase
                    ? <a href={`${youtrackBase}/issue/${t.id}`} target="_blank" rel="noreferrer"
                        className="text-[#ff460b] hover:underline text-xs mt-0.5 w-28 shrink-0 font-mono transition-colors">
                        {t.id}
                      </a>
                    : <code className="text-[#ff460b] text-xs mt-0.5 w-28 shrink-0 font-mono">{t.id}</code>
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${t.excluded ? 'line-through text-[#bbb]' : 'text-white'}`}>{t.title}</p>
                    <p className="text-xs text-[#aaa] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>
                        {t.withTester
                          ? <>
                              {t.dev && <span className="text-white">{t.dev}</span>}
                              <span className={`${t.dev ? 'ml-2' : ''} px-1.5 py-0.5 text-[9px] uppercase tracking-wider border border-blue-800/60 bg-blue-950/30 text-blue-400 font-medium`}>with tester</span>
                              <span className="text-[#555] ml-2">{t.assignee}</span>
                            </>
                          : t.assignee
                        }
                        {t.priority ? ` · ${t.priority}` : ''}
                      </span>
                      {t.groups && t.groups.length > 0 && (
                        <span className="flex gap-1 flex-wrap">
                          {t.groups.map((group, gi) => {
                            const getGroupColor = (g: string) => {
                              switch (g) {
                                case 'Sport': return 'border-cyan-800/60 bg-cyan-950/30 text-cyan-400';
                                case 'Racing': return 'border-orange-800/60 bg-orange-950/30 text-orange-400';
                                case 'Marketing/VIP': return 'border-blue-800/60 bg-blue-950/30 text-blue-400';
                                case 'Risk/KYC': return 'border-red-800/60 bg-red-950/30 text-red-400';
                                case 'Casino': return 'border-pink-800/60 bg-pink-950/30 text-pink-400';
                                case 'Left menu': return 'border-gray-800/60 bg-gray-950/30 text-gray-400';
                                case 'Betslip': return 'border-indigo-800/60 bg-indigo-950/30 text-indigo-400';
                                case 'Admin': return 'border-amber-800/60 bg-amber-950/30 text-amber-400';
                                case 'Registration': return 'border-orange-700/60 bg-orange-900/30 text-orange-300';
                                case 'Strapi': return 'border-yellow-800/60 bg-yellow-950/30 text-yellow-400';
                                case 'Markets': return 'border-fuchsia-800/60 bg-fuchsia-950/30 text-fuchsia-400';
                                case 'User Profile': return 'border-teal-800/60 bg-teal-950/30 text-teal-400';
                                case 'Promo Engine': return 'border-violet-800/60 bg-violet-950/30 text-violet-400';
                                case 'Data Free': return 'border-lime-800/60 bg-lime-950/30 text-lime-400';
                                case 'Icons': return 'border-sky-800/60 bg-sky-950/30 text-sky-400';
                                case 'Technical Debt': return 'border-blue-700/60 bg-blue-900/30 text-blue-300';
                                case 'Knowledge Share': return 'border-rose-800/60 bg-rose-950/30 text-rose-400';
                                case 'Communications': return 'border-purple-800/60 bg-purple-950/30 text-purple-400';
                                case 'Payment/s': return 'border-green-800/60 bg-green-950/30 text-green-400';
                                default: return 'border-[#2a2a2a] bg-[#111] text-[#888]';
                              }
                            };
                            return (
                              <span key={gi} className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider border font-medium ${getGroupColor(group)}`}>
                                {group}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </p>
                    {!t.excluded && (
                      <input value={t.notes} placeholder="Risk notes..."
                        onChange={e => {
                          const tickets = repo.tickets.map((x, j) => j === ti ? { ...x, notes: e.target.value } : x);
                          onChange({ tickets });
                        }}
                        className="mt-1.5 w-full bg-[#0d0d0d] border border-[#2a2a2a] px-2 py-1 text-xs text-[#ccc] placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b]" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <select value={t.risk} disabled={t.excluded}
                        onChange={e => {
                          const tickets = repo.tickets.map((x, j) => j === ti ? { ...x, risk: e.target.value } : x);
                          onChange({ tickets });
                        }}
                        className="bg-[#0d0d0d] border border-[#2a2a2a] px-2 py-1 text-xs text-[#ccc] focus:outline-none disabled:opacity-40">
                        <option value="">Risk?</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <button
                        title={t.excluded ? 'Excluded from PDF — click to include' : 'Click to hide from PDF'}
                        onClick={() => {
                          const tickets = repo.tickets.map((x, j) => j === ti ? { ...x, excluded: !x.excluded } : x);
                          onChange({ tickets, ticketCount: tickets.filter(x => !x.excluded).length });
                        }}
                        className={`text-xs px-2 py-1 border font-medium transition-colors ${
                          t.excluded
                            ? 'border-red-900/50 bg-red-950/20 text-red-400 hover:bg-red-950/40'
                            : 'border-[#2a2a2a] text-[#555] hover:border-red-900/50 hover:text-red-400'
                        }`}>
                        {t.excluded ? 'Hidden from PDF' : 'Hide from PDF'}
                      </button>
                    </div>
                    <GroupDropdown
                      groups={t.groups || []}
                      disabled={t.excluded}
                      onChange={(newGroups) => {
                        const tickets = repo.tickets.map((x, j) => j === ti ? { ...x, groups: newGroups.length > 0 ? newGroups : undefined } : x);
                        onChange({ tickets });
                      }}
                    />
                  </div>
                </div>
                </div>
              ))}
            </div>
          </div>

          {/* Description sections */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#999] mb-2">Description Sections</p>
            <div className="space-y-3">
              {repo.sections.map((s, si) => (
                <div key={si} className="border border-[#1f1f1f] p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={s.title} onChange={e => updateSection(si, { title: e.target.value })}
                      placeholder="Section title e.g. Feature Name (TICKET-123)"
                      className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#bbb] focus:outline-none focus:border-[#ff460b] font-medium" />
                    <button onClick={() => onChange({ sections: repo.sections.filter((_, j) => j !== si) })}
                      className="text-[#ccc] hover:text-red-500 px-2 transition-colors">✕</button>
                  </div>
                  <textarea value={s.body} rows={2} onChange={e => updateSection(si, { body: e.target.value })}
                    placeholder="Description..."
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white resize-none placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b]" />
                </div>
              ))}
              <button onClick={() => onChange({ sections: [...repo.sections, { title: '', body: '' }] })}
                className="text-xs text-[#ff460b] hover:text-[#e03d08] uppercase tracking-wider font-medium transition-colors">+ Add section</button>
            </div>
          </div>

          {/* By Developer */}
          {repo.tickets.filter(t => !t.excluded).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#999] mb-2">By Developer</p>
              <ByDevMini tickets={repo.tickets.filter(t => !t.excluded)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ByDevMini({ tickets }: { tickets: DocRepo['tickets'] }) {
  const map = new Map<string, string[]>();
  tickets.forEach(t => {
    const dev = (t.withTester && t.dev ? t.dev : t.assignee) || 'Unassigned';
    if (!map.has(dev)) map.set(dev, []);
    map.get(dev)!.push(t.id);
  });
  return (
    <div className="flex flex-wrap gap-2">
      {[...map.entries()].map(([dev, ids]) => (
        <div key={dev} className="border border-[#1f1f1f] bg-[#161616] px-3 py-2">
          <p className="text-xs font-semibold text-white">{dev}</p>
          <p className="text-xs text-[#999] mt-0.5 font-mono">{ids.join(', ')}</p>
        </div>
      ))}
    </div>
  );
}

function LibrariesSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  const PRESET_LIBRARIES = [
    'WSB.Core.Contracts',
    'WSB.Core.Library',
    'WSB.Shared.Library',
    'WSB.Shared.Contracts',
    'OTTIntegration.Core',
    'SCodeIntegration.Core',
    'EWallet-Integration',
    'ShopriteIntegration.Core',
    'TymeBank-Integration',
  ];

  const add = (libraryName = '') => update({ libraryVersions: [...doc.libraryVersions, { library: libraryName, currentVersion: '', deployVersion: '', description: '', breakingChanges: false }] });
  const upd = (i: number, p: Partial<LibraryVersion>) => update({ libraryVersions: doc.libraryVersions.map((r, j) => j === i ? { ...r, ...p } : r) });
  const del = (i: number) => update({ libraryVersions: doc.libraryVersions.filter((_, j) => j !== i) });

  const addDep = () => update({ externalDependencies: [...doc.externalDependencies, { dependency: '', affectedProjects: '', description: '', breakingChanges: false }] });
  const updDep = (i: number, p: Partial<ExternalDependency>) => update({ externalDependencies: doc.externalDependencies.map((r, j) => j === i ? { ...r, ...p } : r) });
  const delDep = (i: number) => update({ externalDependencies: doc.externalDependencies.filter((_, j) => j !== i) });

  return (
    <div className="space-y-5">
      <Card title="Shared Library Versions">
        <table className="w-full text-sm">
          <thead><tr className="text-[10px] text-[#999] uppercase tracking-wider text-left border-b border-[#1f1f1f]">
            <th className="pb-2 pr-3">Library</th><th className="pb-2 pr-3">Current Prod</th><th className="pb-2 pr-3">Deploy Version</th><th className="pb-2 pr-3">Description</th><th className="pb-2 pr-3">Breaking?</th><th className="pb-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {doc.libraryVersions.map((lv, i) => (
              <tr key={i}>
                <td className="py-2 pr-3 relative">
                  <LibraryAutocomplete value={lv.library} onChange={v => upd(i, { library: v })} presets={PRESET_LIBRARIES} />
                </td>
                <td className="py-2 pr-3"><TdInput value={lv.currentVersion} onChange={v => upd(i, { currentVersion: v })} placeholder="v1.87.5" /></td>
                <td className="py-2 pr-3"><TdInput value={lv.deployVersion} onChange={v => upd(i, { deployVersion: v })} placeholder="v1.87.6" /></td>
                <td className="py-2 pr-3"><TdInput value={lv.description} onChange={v => upd(i, { description: v })} placeholder="Description" /></td>
                <td className="py-2 pr-3"><input type="checkbox" checked={lv.breakingChanges} onChange={e => upd(i, { breakingChanges: e.target.checked })} className="accent-[#ff460b]" /></td>
                <td className="py-2"><button onClick={() => del(i)} className="text-[#ccc] hover:text-red-500 text-xs px-1 transition-colors">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => add('')} className="mt-3 text-xs text-[#ff460b] hover:text-[#e03d08] uppercase tracking-wider font-medium transition-colors">+ Add library</button>
      </Card>

      <Card title="External Dependencies">
        <table className="w-full text-sm">
          <thead><tr className="text-[10px] text-[#999] uppercase tracking-wider text-left border-b border-[#1f1f1f]">
            <th className="pb-2 pr-3">Dependency</th><th className="pb-2 pr-3">Affected Projects</th><th className="pb-2 pr-3">Description</th><th className="pb-2 pr-3">Breaking?</th><th className="pb-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {doc.externalDependencies.map((d, i) => (
              <tr key={i}>
                <td className="py-2 pr-3"><TdInput value={d.dependency} onChange={v => updDep(i, { dependency: v })} placeholder="Dependency name" /></td>
                <td className="py-2 pr-3"><TdInput value={d.affectedProjects} onChange={v => updDep(i, { affectedProjects: v })} placeholder="Projects" /></td>
                <td className="py-2 pr-3"><TdInput value={d.description} onChange={v => updDep(i, { description: v })} placeholder="Description" /></td>
                <td className="py-2 pr-3"><input type="checkbox" checked={d.breakingChanges} onChange={e => updDep(i, { breakingChanges: e.target.checked })} className="accent-[#ff460b]" /></td>
                <td className="py-2"><button onClick={() => delDep(i)} className="text-[#ccc] hover:text-red-500 text-xs px-1 transition-colors">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addDep} className="mt-3 text-xs text-[#ff460b] hover:text-[#e03d08] uppercase tracking-wider font-medium transition-colors">+ Add dependency</button>
      </Card>
    </div>
  );
}

function MigrationsSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  const add = () => update({ dbMigrations: [...doc.dbMigrations, { migration: '', affectedDb: '', description: '', rollbackScript: '' }] });
  const upd = (i: number, p: Partial<DbMigration>) => update({ dbMigrations: doc.dbMigrations.map((r, j) => j === i ? { ...r, ...p } : r) });
  const del = (i: number) => update({ dbMigrations: doc.dbMigrations.filter((_, j) => j !== i) });

  return (
    <Card title="Database Migrations">
      <div className="space-y-4">
        {doc.dbMigrations.map((m, i) => (
          <div key={i} className="border border-[#1f1f1f] p-4 space-y-3">
            <div className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <TdInput value={m.migration} onChange={v => upd(i, { migration: v })} placeholder="Migration name" mono />
                <TdInput value={m.affectedDb} onChange={v => upd(i, { affectedDb: v })} placeholder="WSB_Dev" />
                <TdInput value={m.description} onChange={v => upd(i, { description: v })} placeholder="What this migration does" />
              </div>
              <button onClick={() => del(i)} className="text-[#ccc] hover:text-red-500 text-xs px-1 pt-2 shrink-0 transition-colors">✕</button>
            </div>
            <div>
              <p className="text-xs text-[#999] mb-1.5">Rollback Script</p>
              <textarea
                value={m.rollbackScript}
                onChange={e => upd(i, { rollbackScript: e.target.value })}
                placeholder="-- SQL script to rollback this migration..."
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-xs text-[#ccc] font-mono focus:outline-none focus:border-[#ff460b] min-h-24 resize-y"
              />
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-4 text-xs text-[#ff460b] hover:text-[#e03d08] uppercase tracking-wider font-medium transition-colors">+ Add migration</button>
    </Card>
  );
}

function EnvVarsSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  const repoNames = doc.repos.map(r => r.name);
  const add = () => update({ envVarUpdates: [...doc.envVarUpdates, { variable: '', affectedProjects: '', oldValue: '', newValue: '', description: '' }] });
  const upd = (i: number, p: Partial<EnvVarUpdate>) => update({ envVarUpdates: doc.envVarUpdates.map((r, j) => j === i ? { ...r, ...p } : r) });
  const del = (i: number) => update({ envVarUpdates: doc.envVarUpdates.filter((_, j) => j !== i) });

  return (
    <Card title="Environment Variable Updates">
      <div className="space-y-4">
        {doc.envVarUpdates.map((e, i) => (
          <div key={i} className="border border-[#1f1f1f] p-4 space-y-3">
            <div className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <TdInput value={e.variable} onChange={v => upd(i, { variable: v })} placeholder="VARIABLE_NAME" mono />
                <TdInput value={e.oldValue} onChange={v => upd(i, { oldValue: v })} placeholder="Old value" />
                <TdInput value={e.newValue} onChange={v => upd(i, { newValue: v })} placeholder="New value" />
              </div>
              <button onClick={() => del(i)} className="text-[#ccc] hover:text-red-500 text-xs px-1 pt-2 shrink-0 transition-colors">✕</button>
            </div>
            <TdInput value={e.description} onChange={v => upd(i, { description: v })} placeholder="Description" />
            <div>
              <p className="text-xs text-[#999] mb-1.5">Affected projects</p>
              <ProjectPicker repoNames={repoNames} value={e.affectedProjects} onChange={v => upd(i, { affectedProjects: v })} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-4 text-xs text-[#ff460b] hover:text-[#e03d08] uppercase tracking-wider font-medium transition-colors">+ Add env var</button>
    </Card>
  );
}

function ProjectPicker({ repoNames, value, onChange }: { repoNames: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  const toggle = (name: string) => {
    const next = selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name];
    onChange(next.join(', '));
  };

  const filtered = repoNames.filter(n => n.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <div
        onClick={() => setOpen(v => !v)}
        className="min-h-[34px] flex flex-wrap gap-1.5 items-center border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-1.5 cursor-pointer hover:border-[#3a3a3a] transition-colors">
        {selected.length === 0
          ? <span className="text-[#bbb] text-xs">Select affected projects...</span>
          : selected.map(s => (
              <span key={s} className="flex items-center gap-1 bg-[#fff3ef] border border-[#ffc4ae] px-2 py-0.5 text-xs text-[#ff460b]">
                {s}
                <button onClick={e => { e.stopPropagation(); toggle(s); }} className="text-[#ffaa88] hover:text-[#ff460b] ml-0.5">✕</button>
              </span>
            ))
        }
        <span className="ml-auto text-[#bbb] text-xs">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="absolute z-20 mt-px w-full bg-[#111] border border-[#2a2a2a] shadow-xl overflow-hidden">
          {repoNames.length > 5 && (
            <div className="px-3 py-2 border-b border-[#1f1f1f]">
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filter repos..."
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-2 py-1 text-xs text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b]" />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-xs text-[#aaa] px-3 py-2">No repos match</p>
              : filtered.map(name => (
                  <button key={name} onClick={() => toggle(name)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[#1a1a1a] ${selected.includes(name) ? 'text-[#ff460b]' : 'text-[#aaa]'}`}>
                    <span className={`w-4 h-4 border shrink-0 flex items-center justify-center text-xs transition-colors ${selected.includes(name) ? 'bg-[#ff460b] border-[#ff460b] text-white' : 'border-[#333]'}`}>
                      {selected.includes(name) && '✓'}
                    </span>
                    {name}
                  </button>
                ))
            }
          </div>
          <div className="px-3 py-2 border-t border-[#1f1f1f] flex justify-end">
            <button onClick={() => setOpen(false)} className="text-xs text-[#555] hover:text-white transition-colors">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeploymentSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); dragOverIdx.current = i; };
  const onDrop = () => {
    const from = dragIdx.current;
    const to = dragOverIdx.current;
    if (from === null || to === null || from === to) return;
    const next = [...doc.deploymentOrder];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update({ deploymentOrder: next });
    dragIdx.current = null;
    dragOverIdx.current = null;
  };

  return (
    <div className="space-y-5">
      <Card title="Deployment Order">
        <p className="text-xs text-[#999] mb-3">Drag rows to reorder.</p>
        <div className="space-y-2">
          {doc.deploymentOrder.map((item, i) => (
            <div key={i}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={e => onDragOver(e, i)}
              onDrop={onDrop}
              className="flex gap-2 items-center group cursor-grab active:cursor-grabbing">
              <span className="text-[#ccc] text-sm w-6 text-right shrink-0 select-none">{i + 1}.</span>
              <span className="text-[#ccc] group-hover:text-[#999] shrink-0 select-none text-sm">⠿</span>
              <input value={item} onChange={e => update({ deploymentOrder: doc.deploymentOrder.map((x, j) => j === i ? e.target.value : x) })}
                onMouseDown={e => e.stopPropagation()}
                className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-[#ff460b] cursor-text" />
              <button onClick={() => update({ deploymentOrder: doc.deploymentOrder.filter((_, j) => j !== i) })} className="text-[#ccc] hover:text-red-500 text-xs px-1 shrink-0 transition-colors">✕</button>
            </div>
          ))}
          <AddItemInput placeholder="Add service/repo to deployment order" onAdd={v => update({ deploymentOrder: [...doc.deploymentOrder, v] })} />
        </div>
      </Card>
      <Card title="Pre-Deployment Checklist">
        <CheckList items={doc.preDeployChecklist} onChange={v => update({ preDeployChecklist: v })} />
      </Card>
      <Card title="Post-Deployment Verification">
        <CheckList items={doc.postDeployChecklist} onChange={v => update({ postDeployChecklist: v })} />
      </Card>
    </div>
  );
}

function RollbackSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  return (
    <div className="space-y-5">
      <Card title="Rollback Trigger Conditions">
        <BulletList items={doc.rollbackTriggers} onChange={v => update({ rollbackTriggers: v })} placeholder="Add trigger condition..." />
      </Card>
      <Card title="Rollback Steps">
        <div className="space-y-2">
          {doc.rollbackSteps.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-[#ccc] text-sm w-6 text-right shrink-0">{i + 1}.</span>
              <input value={s} onChange={e => update({ rollbackSteps: doc.rollbackSteps.map((x, j) => j === i ? e.target.value : x) })}
                className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b]" />
              <button onClick={() => update({ rollbackSteps: doc.rollbackSteps.filter((_, j) => j !== i) })} className="text-[#ccc] hover:text-red-500 text-xs px-1 transition-colors">✕</button>
            </div>
          ))}
          <AddItemInput placeholder="Add rollback step..." onAdd={v => update({ rollbackSteps: [...doc.rollbackSteps, v] })} />
        </div>
      </Card>
      <Card title="Estimated Rollback Time">
        <Input value={doc.rollbackTime} onChange={v => update({ rollbackTime: v })} placeholder="e.g. 30 minutes" />
      </Card>
    </div>
  );
}

function KnownIssuesSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  return (
    <Card title="Known Issues & Limitations">
      <BulletList items={doc.knownIssues} onChange={v => update({ knownIssues: v })} placeholder="Describe a known issue..." />
    </Card>
  );
}

function NotesSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  return (
    <Card title="Additional Notes">
      <textarea
        value={doc.additionalNotes}
        onChange={e => update({ additionalNotes: e.target.value })}
        placeholder="Add any additional context or notes about this release..."
        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff460b] rounded min-h-40"
      />
    </Card>
  );
}

function CommsSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  const dw = doc.deploymentWindow;
  return (
    <div className="space-y-5">
      <Card title="Stakeholder Notifications">
        <CheckList items={doc.stakeholders} onChange={v => update({ stakeholders: v })} />
      </Card>
      <Card title="Deployment Window">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Start Time"><Input value={dw.start} onChange={v => update({ deploymentWindow: { ...dw, start: v } })} placeholder="e.g. 2026-04-07 20:00" /></Field>
          <Field label="End Time"><Input value={dw.end} onChange={v => update({ deploymentWindow: { ...dw, end: v } })} placeholder="e.g. 2026-04-07 22:00" /></Field>
          <Field label="Estimated Downtime"><Input value={dw.estimatedDowntime} onChange={v => update({ deploymentWindow: { ...dw, estimatedDowntime: v } })} placeholder="e.g. None / 15min" /></Field>
        </div>
      </Card>
    </div>
  );
}

function SignOffSection({ doc, update }: { doc: ReleaseDoc; update: (p: Partial<ReleaseDoc>) => void }) {
  const so = doc.signOff;
  return (
    <Card title="Sign-Off">
      <div className="grid grid-cols-3 gap-4">
        <Field label="Release Lead Approval"><Input value={so.releaseLead} onChange={v => update({ signOff: { ...so, releaseLead: v } })} placeholder="Name" /></Field>
        <Field label="Technical Lead Approval"><Input value={so.technicalLead} onChange={v => update({ signOff: { ...so, technicalLead: v } })} placeholder="Name" /></Field>
        <Field label="QA Lead Approval"><Input value={so.qaLead} onChange={v => update({ signOff: { ...so, qaLead: v } })} placeholder="Name" /></Field>
      </div>
    </Card>
  );
}

// ─── Shared primitives ─────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#1f1f1f] bg-[#111] p-5 mb-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-[3px] h-4 bg-[#ff460b] shrink-0" />
        <h3 className="text-xs font-semibold text-white uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-[#555] block mb-1.5 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type, disabled, mono }: { value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean; mono?: boolean }) {
  return (
    <input type={type ?? 'text'} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled}
      style={type === 'date' ? { colorScheme: 'dark' } : undefined}
      className={`w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b] disabled:opacity-40 transition-colors ${mono ? 'font-mono' : ''}`} />
  );
}

function LibraryAutocomplete({ value, onChange, presets }: { value: string; onChange: (v: string) => void; presets: string[] }) {
  const [focused, setFocused] = useState(false);
  const query = value.toLowerCase();
  const suggestions = presets.filter(p => p.toLowerCase().includes(query) && p !== value);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Type or select library..."
        className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-2 py-1.5 text-xs text-white font-mono placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b] transition-colors"
      />
      {focused && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full bg-[#111] border border-[#2a2a2a] shadow-xl z-20 rounded max-h-40 overflow-y-auto">
          {suggestions.map(s => (
            <button
              key={s}
              onMouseDown={() => onChange(s)}
              className="w-full text-left px-3 py-1.5 text-xs text-[#aaa] font-mono hover:bg-[#1a1a1a] hover:text-white transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TdInput({ value, onChange, placeholder, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-[#0d0d0d] border border-[#2a2a2a] px-2 py-1.5 text-xs text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b] transition-colors ${mono ? 'font-mono' : ''}`} />
  );
}

function BulletList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-[#ff460b] shrink-0 text-sm">•</span>
          <input value={item} onChange={e => onChange(items.map((x, j) => j === i ? e.target.value : x))}
            className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b] transition-colors" />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-[#ccc] hover:text-red-500 text-xs px-1 transition-colors">✕</button>
        </div>
      ))}
      <AddItemInput placeholder={placeholder} onAdd={v => onChange([...items, v])} />
    </div>
  );
}

function CheckList({ items, onChange }: { items: { item: string; checked: boolean }[]; onChange: (v: { item: string; checked: boolean }[]) => void }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <input type="checkbox" checked={item.checked} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, checked: e.target.checked } : x))}
            className="accent-[#ff460b] w-4 h-4 shrink-0" />
          <input value={item.item} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, item: e.target.value } : x))}
            className="flex-1 bg-transparent border-0 text-sm text-[#ccc] focus:outline-none" />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-[#ccc] hover:text-red-500 text-xs px-1 transition-colors">✕</button>
        </div>
      ))}
      <AddItemInput placeholder="Add checklist item..." onAdd={v => onChange([...items, { item: v, checked: false }])} />
    </div>
  );
}

function AddItemInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [val, setVal] = useState('');
  const add = () => { if (val.trim()) { onAdd(val.trim()); setVal(''); } };
  return (
    <div className="flex gap-2 mt-1">
      <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={placeholder}
        className="flex-1 bg-[#0d0d0d] border border-dashed border-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#ff460b] transition-colors" />
      <button onClick={add} className="px-3 py-1.5 text-xs text-[#ff460b] hover:text-[#e03d08] border border-[#2a2a2a] uppercase tracking-wider font-medium transition-colors">Add</button>
    </div>
  );
}
