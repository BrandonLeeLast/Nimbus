import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'https://nimbus-worker-prod.brandonl-9ff.workers.dev/api';

export default function ReleaseDocs() {
  const { token, user } = useAuth()
  const [generating, setGenerating] = useState(false)
  const [releaseData, setReleaseData] = useState<any>(null)
  const [releases, setReleases] = useState<any[]>([])
  const [fromBranch, setFromBranch] = useState('stage')
  const [toBranch, setToBranch] = useState('main')
  const [newReleaseName, setNewReleaseName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'planner' | 'history'>('planner')

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchReleases()
  }, [])

  const fetchReleases = async () => {
    try {
      const res = await fetch(`${API_URL}/releases`)
      const data = await res.json()
      if (Array.isArray(data)) setReleases(data)
    } catch (err) {
      console.error('Failed to fetch releases', err)
    }
  }

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/releases`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newReleaseName })
      })
      const data = await res.json()
      if (res.ok) {
        setNewReleaseName('')
        fetchReleases()
        alert('Release created and branches synced!')
      } else {
        setError(data.error || 'Failed to create release')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const headers: any = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      
      const res = await fetch(`${API_URL}/release-docs/compare?from=${fromBranch}&to=${toBranch}`, { headers })
      const data = await res.json()
      
      if (res.ok) {
        setReleaseData(data)
      } else {
        setError(data.error || 'Failed to generate release planner')
      }
    } catch (err) {
      setError('Network error occurred')
    } finally {
      setGenerating(false)
    }
  }

  const generateMarkdown = () => {
    if (!releaseData) return '';
    
    let md = `# Release Notes - ${new Date().toISOString().split('T')[0]}\n\n`;
    md += `## Comparison: ${releaseData.from} → ${releaseData.to}\n\n`;
    md += `--- \n\n## Changes by Project\n\n`;

    const projectMap: Record<string, any[]> = {};
    releaseData.tickets.forEach((t: any) => {
      t.projects.forEach((p: string) => {
        if (!projectMap[p]) projectMap[p] = [];
        projectMap[p].push(t);
      });
    });

    Object.entries(projectMap).forEach(([project, tickets]) => {
      md += `### **${project}**\n`;
      tickets.forEach(t => {
        md += `- **[${t.id}]** - ${t.summary} - [@${t.assignee}]\n`;
      });
      md += `\n`;
    });

    return md;
  }

  const copyToClipboard = () => {
    const md = generateMarkdown();
    navigator.clipboard.writeText(md);
    alert('Markdown copied to clipboard!');
  }

  return (
    <div className="release-docs-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '2rem', height: '100%', overflow: 'hidden' }}>
      
      {/* Sidebar: Config & History */}
      <div className="config-pane" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
        <header className="page-header">
          <h1>Releases</h1>
          <div className="tab-switcher" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`} onClick={() => setActiveTab('planner')}>Planner</button>
            <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
          </div>
        </header>

        {activeTab === 'planner' ? (
          <>
            {isAdmin && (
              <div className="card" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Initiate New Release</h3>
                <p className="subtitle" style={{ fontSize: '0.8rem' }}>Creates branches across all GitLab repos</p>
                <form onSubmit={handleCreateRelease} style={{ marginTop: '1rem' }}>
                  <input 
                    type="text" 
                    placeholder="e.g. release-20260401" 
                    value={newReleaseName}
                    onChange={e => setNewReleaseName(e.target.value)}
                    className="settings-input"
                    style={{ width: '100%', marginBottom: '1rem', padding: '0.7rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
                    required
                  />
                  <button type="submit" className="btn small" disabled={isCreating} style={{ width: '100%' }}>
                    {isCreating ? 'Synchronizing...' : 'Create & Sync branches'}
                  </button>
                </form>
              </div>
            )}

            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Analysis & Generation</h3>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Source Branch</label>
                <input type="text" value={fromBranch} onChange={e => setFromBranch(e.target.value)} style={{ width: '100%', padding: '0.7rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Target Branch</label>
                <input type="text" value={toBranch} onChange={e => setToBranch(e.target.value)} style={{ width: '100%', padding: '0.7rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }} />
              </div>

              {isAdmin ? (
                <button className="btn" onClick={handleGenerate} disabled={generating} style={{ width: '100%' }}>
                  {generating ? 'Comparing...' : 'Run Automated Planner'}
                </button>
              ) : (
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Generation restricted to Admins
                </div>
              )}
              {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</p>}
            </div>
          </>
        ) : (
          <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {releases.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>No release history found.</p>}
            {releases.map(r => (
              <div key={r.id} className="card history-card" style={{ padding: '1rem', cursor: 'pointer', borderLeft: '3px solid var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <strong style={{ fontSize: '1rem' }}>{r.name}</strong>
                   <span className={`status-badge ${r.status}`} style={{ fontSize: '0.7rem' }}>{r.status}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Created: {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Preview */}
      <div className="preview-pane card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></div>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>release-preview.md</span>
          {releaseData && isAdmin && (
            <button className="btn small outline" onClick={copyToClipboard} style={{ height: '28px', fontSize: '0.75rem' }}>Copy Markdown</button>
          )}
        </div>
        
        <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
          {generating ? (
            <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div style={{ height: '30px', width: '40%', background: 'var(--border)', borderRadius: '4px' }}></div>
               <div style={{ height: '200px', width: '100%', background: 'var(--border)', borderRadius: '8px', opacity: 0.5 }}></div>
            </div>
          ) : releaseData ? (
            <div className="document-content">
              <h1>Release Plan: {fromBranch} → {toBranch}</h1>
              <div style={{ marginTop: '2rem' }}>
                {Object.entries(
                  releaseData.tickets.reduce((acc: any, t: any) => {
                    t.projects.forEach((p: string) => {
                      if (!acc[p]) acc[p] = [];
                      acc[p].push(t);
                    });
                    return acc;
                  }, {})
                ).map(([project, tickets]: [string, any]) => (
                  <div key={project} style={{ marginBottom: '2rem' }}>
                    <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{project}</h4>
                    {tickets.map((t: any) => (
                      <div key={t.id} style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: 'bold' }}>[{t.id}]</span> - {t.summary} <span style={{ color: 'var(--text-muted)' }}>@{t.assignee}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ width: '80px', height: '80px', marginBottom: '1rem', opacity: 0.3 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <p style={{ fontSize: '1.2rem' }}>Use the sidebar to analyze branches or view history.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .tab-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding-bottom: 4px; border-bottom: 2px solid transparent; font-weight: 500; font-size: 0.9rem; }
        .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
        .history-card:hover { background: rgba(255,255,255,0.03); }
        .status-badge.active { background: #10b98120; color: #10b981; }
        .status-badge.completed { background: #3b82f620; color: #3b82f6; }
      `}</style>
    </div>
  )
}
