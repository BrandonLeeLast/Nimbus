import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { ExecDoc } from '../api/client';
import { exportExecOverviewPdf, exportExecSummariesPdf } from './PdfExport';

interface Props {
  releaseId: string;
}

type Section = 'summary' | 'deliverables' | 'impact' | 'scope' | 'risk' | 'tickets';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'summary', label: 'Executive Summary' },
  { id: 'deliverables', label: 'Key Deliverables' },
  { id: 'impact', label: 'Business Impact' },
  { id: 'scope', label: 'Release Scope' },
  { id: 'risk', label: 'Risk Assessment' },
  { id: 'tickets', label: 'Ticket Summaries' },
];

export default function ExecutiveDocEditor({ releaseId }: Props) {
  const [doc, setDoc] = useState<ExecDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('summary');

  useEffect(() => {
    setLoading(true);
    setDoc(null);
    api.get<{ content: ExecDoc } | null>(`/releases/${releaseId}/executive`)
      .then(res => {
        if (res?.content && res.content.executiveSummary) setDoc(res.content);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [releaseId]);

  const update = (patch: Partial<ExecDoc>) => {
    setDoc(d => d ? { ...d, ...patch } : d);
    setDirty(true);
  };

  // Auto-save after 2 seconds of inactivity
  useEffect(() => {
    if (!dirty || saving || !doc) return;
    const timer = setTimeout(() => {
      save(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [doc, dirty, saving]);

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await api.post<ExecDoc>(`/releases/${releaseId}/executive/generate`, {});
      setDoc(result);
      setDirty(false);
      setSaveMsg('Generated');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const save = async (isAutoSave = false) => {
    if (!doc) return;
    setSaving(true);
    try {
      await api.put(`/releases/${releaseId}/executive`, doc as unknown as Record<string, unknown>);
      setDirty(false);
      setSaveMsg(isAutoSave ? 'Auto-saved' : 'Saved');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-[#666] px-6 py-4 text-sm">Loading...</p>;

  // No doc yet — show generate prompt
  if (!doc) {
    return (
      <div className="border border-[#2a2a2a] bg-[#111111] p-10 text-center">
        <p className="text-white text-sm font-semibold mb-2">Executive Document</p>
        <p className="text-[#666] text-xs mb-6">Generate executive-level documentation from your release data using AI.</p>
        <button onClick={generate} disabled={generating}
          className="px-6 py-2.5 bg-[#ff460b] hover:bg-[#e03d08] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider transition-colors">
          {generating ? 'Generating with AI...' : 'Generate Executive Document'}
        </button>
        <p className="text-[#555] text-xs mt-3">Requires a generated release document first.</p>
      </div>
    );
  }

  return (
    <div className="border border-[#1f1f1f] bg-[#111] flex" style={{ minHeight: 600 }}>
      {/* Sidebar */}
      <div className="w-44 shrink-0 bg-[#0d0d0d] border-r border-[#1f1f1f] py-3">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`w-full text-left px-4 py-2 text-xs transition-colors ${
              activeSection === s.id
                ? 'text-white bg-[#111] border-l-2 border-[#ff460b] font-semibold'
                : 'text-[#777] hover:text-[#999] border-l-2 border-transparent'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="bg-[#111] border-b border-[#1f1f1f] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">{SECTIONS.find(s => s.id === activeSection)?.label}</span>
            {dirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
            {saveMsg && <span className={`text-xs ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{saveMsg}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportExecOverviewPdf(doc, true)}
              className="px-3 py-1.5 border border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-white text-xs font-medium uppercase tracking-wider transition-colors">
              Preview Overview
            </button>
            <button onClick={() => exportExecSummariesPdf(doc, true)}
              className="px-3 py-1.5 border border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-white text-xs font-medium uppercase tracking-wider transition-colors">
              Preview Summaries
            </button>
            <button onClick={() => { exportExecOverviewPdf(doc); exportExecSummariesPdf(doc); }}
              className="px-3 py-1.5 border border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-white text-xs font-medium uppercase tracking-wider transition-colors">
              Export PDFs
            </button>
            <button onClick={generate} disabled={generating}
              className="px-3 py-1.5 bg-[#1a3a1a] hover:bg-[#1e451e] border border-green-900 text-green-400 text-xs font-medium uppercase tracking-wider transition-colors">
              {generating ? 'Generating...' : 'Generate with AI'}
            </button>
            <button onClick={save} disabled={saving || !dirty}
              className="px-4 py-1.5 bg-[#ff460b] hover:bg-[#e03d08] disabled:opacity-40 text-white text-xs font-semibold uppercase tracking-wider transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Section content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeSection === 'summary' && <SummarySection doc={doc} update={update} />}
          {activeSection === 'deliverables' && <DeliverablesSection doc={doc} update={update} />}
          {activeSection === 'impact' && <ImpactSection doc={doc} update={update} />}
          {activeSection === 'scope' && <ScopeSection doc={doc} update={update} />}
          {activeSection === 'risk' && <RiskSection doc={doc} update={update} />}
          {activeSection === 'tickets' && <TicketsSection doc={doc} update={update} />}
        </div>
      </div>
    </div>
  );
}

// ── Shared UI primitives ─────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111] border border-[#1f1f1f]">
      <div className="px-4 py-2.5 border-b border-[#1f1f1f] flex items-center gap-2">
        <div className="w-1 h-4 bg-[#ff460b]" />
        <span className="text-xs font-semibold text-white uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff460b] rounded" />
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b] rounded" />
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────

function SummarySection({ doc, update }: { doc: ExecDoc; update: (p: Partial<ExecDoc>) => void }) {
  return (
    <div className="space-y-5">
      <Card title="Release Info">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-[#777] mb-1 block">Release Name</label>
            <Input value={doc.releaseName} onChange={v => update({ releaseName: v })} />
          </div>
          <div>
            <label className="text-xs text-[#777] mb-1 block">Release Date</label>
            <Input value={doc.releaseDate} onChange={v => update({ releaseDate: v })} />
          </div>
          <div>
            <label className="text-xs text-[#777] mb-1 block">Release Lead</label>
            <Input value={doc.releaseLead} onChange={v => update({ releaseLead: v })} />
          </div>
        </div>
      </Card>
      <Card title="Executive Summary">
        <TextArea value={doc.executiveSummary} onChange={v => update({ executiveSummary: v })}
          placeholder="2-3 paragraph business summary of this release..." rows={8} />
      </Card>
    </div>
  );
}

function DeliverablesSection({ doc, update }: { doc: ExecDoc; update: (p: Partial<ExecDoc>) => void }) {
  const addItem = (key: 'features' | 'improvements' | 'fixes') => {
    update({ [key]: [...doc[key], { name: '', description: '' }] });
  };
  const updateItem = (key: 'features' | 'improvements' | 'fixes', idx: number, patch: { name?: string; description?: string }) => {
    update({ [key]: doc[key].map((item, i) => i === idx ? { ...item, ...patch } : item) });
  };
  const removeItem = (key: 'features' | 'improvements' | 'fixes', idx: number) => {
    update({ [key]: doc[key].filter((_, i) => i !== idx) });
  };

  const renderList = (title: string, key: 'features' | 'improvements' | 'fixes') => (
    <Card title={title}>
      <div className="space-y-3">
        {doc[key].map((item, i) => (
          <div key={i} className="flex gap-2">
            <input value={item.name} onChange={e => updateItem(key, i, { name: e.target.value })}
              placeholder="Name" className="w-40 bg-[#0d0d0d] border border-[#2a2a2a] px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b]" />
            <input value={item.description} onChange={e => updateItem(key, i, { description: e.target.value })}
              placeholder="Business description..." className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b]" />
            <button onClick={() => removeItem(key, i)} className="text-[#555] hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button onClick={() => addItem(key)}
          className="text-xs text-[#ff460b] hover:text-[#ff6633] transition-colors">+ Add item</button>
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      {renderList('New Features & Capabilities', 'features')}
      {renderList('Platform Improvements', 'improvements')}
      {renderList('Critical Fixes', 'fixes')}
    </div>
  );
}

function ImpactSection({ doc, update }: { doc: ExecDoc; update: (p: Partial<ExecDoc>) => void }) {
  return (
    <div className="space-y-5">
      <Card title="Customer Experience">
        <TextArea value={doc.customerExperience} onChange={v => update({ customerExperience: v })}
          placeholder="How will customers benefit from this release?" rows={5} />
      </Card>
      <Card title="Operational Efficiency">
        <TextArea value={doc.operationalEfficiency} onChange={v => update({ operationalEfficiency: v })}
          placeholder="What manual processes are being automated?" rows={5} />
      </Card>
      <Card title="Revenue & Growth">
        <TextArea value={doc.revenueGrowth} onChange={v => update({ revenueGrowth: v })}
          placeholder="Revenue or growth implications..." rows={5} />
      </Card>
      <Card title="Risk Mitigation">
        <TextArea value={doc.riskMitigation} onChange={v => update({ riskMitigation: v })}
          placeholder="Security, stability, compliance improvements..." rows={5} />
      </Card>
    </div>
  );
}

function ScopeSection({ doc, update }: { doc: ExecDoc; update: (p: Partial<ExecDoc>) => void }) {
  return (
    <Card title="Release Scope">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-[#777] mb-1 block">Total Changes</label>
          <Input value={doc.totalChanges} onChange={v => update({ totalChanges: v })} placeholder="e.g. 33 tickets across 6 systems" />
        </div>
        <div>
          <label className="text-xs text-[#777] mb-1 block">Projects Updated</label>
          <Input value={doc.projectsUpdated} onChange={v => update({ projectsUpdated: v })} placeholder="e.g. 5 backend services, 2 frontend applications" />
        </div>
        <div>
          <label className="text-xs text-[#777] mb-1 block">Key Integrations</label>
          <Input value={doc.keyIntegrations} onChange={v => update({ keyIntegrations: v })} placeholder="e.g. OTT (payment SMS), Growth Book (feature flags)" />
        </div>
      </div>
    </Card>
  );
}

function RiskSection({ doc, update }: { doc: ExecDoc; update: (p: Partial<ExecDoc>) => void }) {
  const addRiskFactor = () => update({ riskFactors: [...doc.riskFactors, ''] });
  const addMitigation = () => update({ mitigationStrategies: [...doc.mitigationStrategies, ''] });

  return (
    <div className="space-y-5">
      <Card title="Overall Risk Level">
        <select value={doc.overallRisk} onChange={e => update({ overallRisk: e.target.value })}
          className="bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b] rounded">
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
      </Card>
      <Card title="Key Risk Factors">
        <div className="space-y-2">
          {doc.riskFactors.map((f, i) => (
            <div key={i} className="flex gap-2">
              <input value={f} onChange={e => update({ riskFactors: doc.riskFactors.map((x, j) => j === i ? e.target.value : x) })}
                className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b]" />
              <button onClick={() => update({ riskFactors: doc.riskFactors.filter((_, j) => j !== i) })}
                className="text-[#555] hover:text-red-500 text-xs px-1">✕</button>
            </div>
          ))}
          <button onClick={addRiskFactor} className="text-xs text-[#ff460b] hover:text-[#ff6633]">+ Add risk factor</button>
        </div>
      </Card>
      <Card title="Mitigation Strategies">
        <div className="space-y-2">
          {doc.mitigationStrategies.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input value={s} onChange={e => update({ mitigationStrategies: doc.mitigationStrategies.map((x, j) => j === i ? e.target.value : x) })}
                className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b]" />
              <button onClick={() => update({ mitigationStrategies: doc.mitigationStrategies.filter((_, j) => j !== i) })}
                className="text-[#555] hover:text-red-500 text-xs px-1">✕</button>
            </div>
          ))}
          <button onClick={addMitigation} className="text-xs text-[#ff460b] hover:text-[#ff6633]">+ Add strategy</button>
        </div>
      </Card>
    </div>
  );
}

function TicketsSection({ doc, update }: { doc: ExecDoc; update: (p: Partial<ExecDoc>) => void }) {
  const updateTicket = (idx: number, summary: string) => {
    update({ ticketSummaries: doc.ticketSummaries.map((t, i) => i === idx ? { ...t, summary } : t) });
  };

  return (
    <Card title={`Ticket Summaries (${doc.ticketSummaries.length})`}>
      <p className="text-[#666] text-xs mb-4">Plain-language summaries of each ticket for non-technical stakeholders.</p>
      <div className="space-y-3">
        {doc.ticketSummaries.map((t, i) => (
          <div key={t.id} className="flex gap-3 items-start">
            <span className="text-[#ff460b] text-xs font-mono font-bold w-28 shrink-0 pt-2">{t.id}</span>
            <input value={t.summary} onChange={e => updateTicket(i, e.target.value)}
              className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff460b]"
              placeholder="Plain-language summary..." />
          </div>
        ))}
        {doc.ticketSummaries.length === 0 && (
          <p className="text-[#555] text-xs italic">No ticket summaries yet. Generate with AI to populate.</p>
        )}
      </div>
    </Card>
  );
}
