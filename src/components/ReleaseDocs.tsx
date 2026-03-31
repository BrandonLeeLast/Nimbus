import { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'https://nimbus-worker-prod.brandonl-9ff.workers.dev/api'

interface Ticket {
  id: string
  summary: string
  assignee: string
  projects: string[]
}

interface ReleaseSnapshot {
  release_name: string
  from: string
  to: string
  generated_at: string
  ticket_count: number
  tickets: Ticket[]
  youtrackErrors: string[]
}

interface Release {
  id: string
  name: string
  status: string
  created_at: string
}

// ── PDF generation ────────────────────────────────────────────────────────────
function exportPDF(snapshot: ReleaseSnapshot) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  const usableW = pageW - margin * 2
  let y = margin

  const LINE_H = 6
  const SECTION_GAP = 4

  function checkPage(needed = LINE_H) {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Header bar
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, pageW, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Release Notes — ${snapshot.release_name}`, margin, 13)
  y = 26

  // Metadata
  doc.setTextColor(80, 80, 80)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Comparison: ${snapshot.from} → ${snapshot.to}`, margin, y)
  y += LINE_H
  doc.text(`Generated: ${new Date(snapshot.generated_at).toLocaleString()}`, margin, y)
  y += LINE_H
  doc.text(`Total tickets: ${snapshot.ticket_count}`, margin, y)
  y += SECTION_GAP + LINE_H

  if (snapshot.youtrackErrors.length > 0) {
    doc.setTextColor(220, 50, 50)
    doc.setFontSize(8)
    for (const err of snapshot.youtrackErrors) {
      doc.text(`⚠ ${err}`, margin, y)
      y += LINE_H
    }
    y += SECTION_GAP
  }

  // Group tickets by project
  const projectMap: Record<string, Ticket[]> = {}
  for (const t of snapshot.tickets) {
    for (const p of t.projects) {
      if (!projectMap[p]) projectMap[p] = []
      projectMap[p].push(t)
    }
  }

  for (const [project, tickets] of Object.entries(projectMap)) {
    checkPage(LINE_H * 3)

    // Project heading
    doc.setFillColor(240, 240, 255)
    doc.rect(margin, y - 4, usableW, LINE_H + 2, 'F')
    doc.setTextColor(60, 60, 180)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(project, margin + 2, y + 1)
    y += LINE_H + SECTION_GAP

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    for (const t of tickets) {
      checkPage(LINE_H * 2)

      // Ticket ID pill
      doc.setFillColor(230, 230, 250)
      doc.setTextColor(80, 80, 160)
      const idText = `[${t.id}]`
      doc.text(idText, margin + 2, y)

      // Summary
      doc.setTextColor(30, 30, 30)
      const summaryLines = doc.splitTextToSize(t.summary, usableW - 42)
      doc.text(summaryLines, margin + 30, y)

      // Assignee (right-aligned)
      doc.setTextColor(120, 120, 120)
      const assigneeText = `@${t.assignee}`
      const assigneeW = doc.getTextWidth(assigneeText)
      doc.text(assigneeText, pageW - margin - assigneeW, y)

      y += Math.max(summaryLines.length, 1) * LINE_H + 1
    }

    y += SECTION_GAP
  }

  // Footer on each page
  const totalPages = (doc.internal as any).getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text(`Nimbus Release Tracker — ${snapshot.release_name}`, margin, doc.internal.pageSize.getHeight() - 8)
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin - 20, doc.internal.pageSize.getHeight() - 8)
  }

  doc.save(`release-notes-${snapshot.release_name}.pdf`)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReleaseDocs() {
  const { token, user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [releases, setReleases] = useState<Release[]>([])
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [snapshot, setSnapshot] = useState<ReleaseSnapshot | null>(null)
  const [newReleaseName, setNewReleaseName] = useState('')
  const [fromBranch, setFromBranch] = useState('stage')
  const [toBranch, setToBranch] = useState('main')

  const [activeTab, setActiveTab] = useState<'planner' | 'history'>('planner')
  const [isCreating, setIsCreating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingDoc, setIsLoadingDoc] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchReleases() }, [])

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  })

  async function fetchReleases() {
    try {
      const res = await fetch(`${API_URL}/releases`)
      const data = await res.json()
      if (Array.isArray(data)) setReleases(data)
    } catch { /* network */ }
  }

  async function handleCreateRelease(e: React.FormEvent) {
    e.preventDefault()
    setIsCreating(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/releases`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: newReleaseName })
      })
      const data = await res.json()
      if (res.ok) {
        setNewReleaseName('')
        await fetchReleases()
      } else {
        setError(data.error || 'Failed to create release')
      }
    } catch { setError('Network error') }
    finally { setIsCreating(false) }
  }

  async function handleGenerate() {
    if (!selectedRelease) return
    setIsGenerating(true)
    setError('')
    setSnapshot(null)
    try {
      const res = await fetch(`${API_URL}/releases/${selectedRelease.id}/generate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ from: fromBranch, to: toBranch })
      })
      const data = await res.json()
      if (res.ok) {
        setSnapshot(data)
        if (data.youtrackErrors?.length) {
          setError(`YouTrack warning: ${data.youtrackErrors[0]}`)
        }
      } else {
        setError(data.error || 'Generation failed')
      }
    } catch { setError('Network error') }
    finally { setIsGenerating(false) }
  }

  async function loadDocument(release: Release) {
    setSelectedRelease(release)
    setSnapshot(null)
    setError('')
    setIsLoadingDoc(true)
    try {
      const res = await fetch(`${API_URL}/releases/${release.id}/document`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setSnapshot(data.content)
      }
      // 404 = not generated yet, that's fine
    } catch { /* network */ }
    finally { setIsLoadingDoc(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) 2fr', gap: '2rem', height: '100%', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
        <header className="page-header">
          <h1>Releases</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`} onClick={() => setActiveTab('planner')}>Planner</button>
            <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
          </div>
        </header>

        {activeTab === 'planner' ? (
          <>
            {isAdmin && (
              <div className="card" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Initiate New Release</h3>
                <p className="subtitle" style={{ fontSize: '0.8rem' }}>Creates branches across all GitLab repos</p>
                <form onSubmit={handleCreateRelease} style={{ marginTop: '1rem' }}>
                  <input
                    type="text"
                    placeholder="e.g. release-20260401"
                    value={newReleaseName}
                    onChange={e => setNewReleaseName(e.target.value)}
                    style={{ width: '100%', marginBottom: '1rem', padding: '0.7rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', boxSizing: 'border-box' }}
                    required
                  />
                  <button type="submit" className="btn small" disabled={isCreating} style={{ width: '100%' }}>
                    {isCreating ? 'Synchronizing...' : 'Create & Sync Branches'}
                  </button>
                </form>
              </div>
            )}

            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>Generate Release Document</h3>

              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Release</label>
              <select
                value={selectedRelease?.id || ''}
                onChange={e => {
                  const r = releases.find(r => r.id === e.target.value) || null
                  setSelectedRelease(r)
                  setSnapshot(null)
                  setError('')
                }}
                style={{ width: '100%', marginBottom: '1rem', padding: '0.7rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', boxSizing: 'border-box' }}
              >
                <option value="">— Select a release —</option>
                {releases.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>From</label>
                  <input type="text" value={fromBranch} onChange={e => setFromBranch(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>To</label>
                  <input type="text" value={toBranch} onChange={e => setToBranch(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white', boxSizing: 'border-box' }} />
                </div>
              </div>

              {isAdmin ? (
                <button className="btn" onClick={handleGenerate} disabled={isGenerating || !selectedRelease} style={{ width: '100%' }}>
                  {isGenerating ? 'Generating...' : 'Generate & Save Document'}
                </button>
              ) : (
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Generation restricted to Admins
                </div>
              )}

              {error && <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '0.75rem' }}>{error}</p>}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {releases.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No release history found.</p>
            )}
            {releases.map(r => (
              <div
                key={r.id}
                onClick={() => loadDocument(r)}
                className="card"
                style={{
                  padding: '1rem',
                  cursor: 'pointer',
                  borderLeft: `3px solid ${selectedRelease?.id === r.id ? 'var(--primary)' : 'transparent'}`,
                  background: selectedRelease?.id === r.id ? 'rgba(99,102,241,0.08)' : undefined
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{r.name}</strong>
                  <span className={`status-badge ${r.status}`} style={{ fontSize: '0.7rem' }}>{r.status}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview Pane ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '0.75rem 1.25rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }} />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {snapshot ? `${snapshot.release_name} — ${snapshot.ticket_count} tickets` : 'release-preview'}
          </span>
          {snapshot && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn small outline" style={{ height: '28px', fontSize: '0.75rem' }}
                onClick={() => navigator.clipboard.writeText(buildMarkdown(snapshot))}>
                Copy MD
              </button>
              <button className="btn small" style={{ height: '28px', fontSize: '0.75rem' }}
                onClick={() => exportPDF(snapshot)}>
                Export PDF
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
          {isGenerating || isLoadingDoc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ height: '28px', width: '45%', background: 'var(--border)', borderRadius: '4px' }} />
              <div style={{ height: '180px', width: '100%', background: 'var(--border)', borderRadius: '8px', opacity: 0.4 }} />
            </div>
          ) : snapshot ? (
            <SnapshotView snapshot={snapshot} />
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ width: '72px', height: '72px', marginBottom: '1rem', opacity: 0.25 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
              <p style={{ fontSize: '1.1rem' }}>
                {activeTab === 'history'
                  ? 'Select a release from the History tab to view its document.'
                  : 'Select a release and click Generate to build the document.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .tab-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding-bottom: 4px; border-bottom: 2px solid transparent; font-weight: 500; font-size: 0.9rem; }
        .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
        .status-badge.active { background: #10b98120; color: #10b981; padding: 2px 8px; border-radius: 99px; }
        .status-badge.completed { background: #3b82f620; color: #3b82f6; padding: 2px 8px; border-radius: 99px; }
      `}</style>
    </div>
  )
}

// ── Snapshot preview component ────────────────────────────────────────────────
function SnapshotView({ snapshot }: { snapshot: ReleaseSnapshot }) {
  const projectMap: Record<string, Ticket[]> = {}
  for (const t of snapshot.tickets) {
    for (const p of t.projects) {
      if (!projectMap[p]) projectMap[p] = []
      projectMap[p].push(t)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.5rem' }}>Release Notes — {snapshot.release_name}</h2>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span>{snapshot.from} → {snapshot.to}</span>
          <span>{snapshot.ticket_count} tickets</span>
          <span>Generated {new Date(snapshot.generated_at).toLocaleString()}</span>
        </div>
      </div>

      {snapshot.youtrackErrors?.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#f59e0b' }}>
          {snapshot.youtrackErrors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {Object.entries(projectMap).map(([project, tickets]) => (
        <div key={project} style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>{project}</h4>
          {tickets.map(t => (
            <div key={t.id} style={{ marginBottom: '0.6rem', fontSize: '0.9rem', display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--primary)', minWidth: '110px' }}>[{t.id}]</span>
              <span style={{ flex: 1 }}>{t.summary}</span>
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>@{t.assignee}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Markdown export helper ────────────────────────────────────────────────────
function buildMarkdown(snapshot: ReleaseSnapshot): string {
  let md = `# Release Notes — ${snapshot.release_name}\n\n`
  md += `**Comparison:** ${snapshot.from} → ${snapshot.to}  \n`
  md += `**Generated:** ${new Date(snapshot.generated_at).toLocaleString()}  \n`
  md += `**Total tickets:** ${snapshot.ticket_count}\n\n---\n\n`

  const projectMap: Record<string, Ticket[]> = {}
  for (const t of snapshot.tickets) {
    for (const p of t.projects) {
      if (!projectMap[p]) projectMap[p] = []
      projectMap[p].push(t)
    }
  }

  for (const [project, tickets] of Object.entries(projectMap)) {
    md += `## ${project}\n\n`
    for (const t of tickets) {
      md += `- **[${t.id}]** ${t.summary} — @${t.assignee}\n`
    }
    md += '\n'
  }

  return md
}
