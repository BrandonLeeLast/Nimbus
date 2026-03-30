import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'https://nimbus-worker-prod.brandonl-9ff.workers.dev/api';

export default function ReleaseDocs() {
  const { token } = useAuth()
  const [generating, setGenerating] = useState(false)
  const [releaseData, setReleaseData] = useState<any>(null)
  const [fromBranch, setFromBranch] = useState('stage')
  const [toBranch, setToBranch] = useState('main')
  const [error, setError] = useState('')

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
    md += `## Branch Comparison: ${releaseData.from} → ${releaseData.to}\n\n`;
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
    <div className="release-docs-layout" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', height: '100%' }}>
      
      <div className="config-pane" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <header className="page-header" style={{ marginBottom: '1rem' }}>
          <h1>Release Planner</h1>
          <p className="subtitle">Automated Cross-Repo Comparison</p>
        </header>

        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Comparison Target</h3>
          
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Source (New Changes)</label>
            <input 
              type="text" 
              value={fromBranch} 
              onChange={e => setFromBranch(e.target.value)}
              placeholder="e.g. stage"
              style={{ width: '100%', marginBottom: '1rem', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
            />
            
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Target (Comparison Base)</label>
            <input 
              type="text" 
              value={toBranch} 
              onChange={e => setToBranch(e.target.value)}
              placeholder="e.g. main"
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
            />
          </div>

          <button className="btn" onClick={handleGenerate} disabled={generating} style={{ width: '100%', marginTop: '1rem' }}>
            {generating ? 'Comparing...' : 'Run Automated Planner'}
          </button>
          
          {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</p>}
        </div>

        {releaseData && (
          <div className="card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#10b981' }}>
              ✓ Found {releaseData.tickets.length} unique tickets across projects.
            </p>
            <button className="btn outline" onClick={copyToClipboard} style={{ width: '100%', marginTop: '1rem', borderColor: '#10b981', color: '#10b981' }}>
              Copy Markdown Template
            </button>
          </div>
        )}
      </div>

      <div className="preview-pane card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></div>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>release-preview.md</span>
        </div>
        
        <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
          {generating ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div style={{ height: '20px', width: '60%', background: 'var(--border)', borderRadius: '4px', opacity: 0.5 }}></div>
               <div style={{ height: '150px', width: '100%', background: 'var(--border)', borderRadius: '8px', opacity: 0.3 }}></div>
            </div>
          ) : releaseData ? (
            <div className="document-content" style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
              <h1 style={{ color: 'white', marginTop: 0, borderBottom: '2px solid var(--border)', paddingBottom: '1rem' }}>
                 Release Plan: {fromBranch} → {toBranch}
              </h1>
              
              <h3 style={{ color: '#818cf8', marginTop: '2rem' }}>Changes by Project</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {Object.entries(
                  releaseData.tickets.reduce((acc: any, t: any) => {
                    t.projects.forEach((p: string) => {
                      if (!acc[p]) acc[p] = [];
                      acc[p].push(t);
                    });
                    return acc;
                  }, {})
                ).map(([project, tickets]: [string, any]) => (
                  <div key={project} className="project-group">
                    <h4 style={{ color: 'white', marginBottom: '0.5rem', borderLeft: '3px solid var(--primary)', paddingLeft: '0.75rem' }}>{project}</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {tickets.map((t: any) => (
                        <li key={t.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>[{t.id}]</span> - {t.summary} - <span style={{ color: '#94a3b8' }}>@{t.assignee}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ width: '64px', height: '64px', marginBottom: '1rem', opacity: 0.5 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <p style={{ fontSize: '1.1rem' }}>Enter branches and run the planner to see what's pending for production.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
