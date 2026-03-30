import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'https://nimbus-worker-prod.brandonl-9ff.workers.dev/api';

export default function ReleaseDocs() {
  const { token } = useAuth()
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/branches`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBranches(data)
          if (data.length > 0) setSelectedBranch(data[0].name)
        }
      })
      .catch(err => console.error(err))
  }, [])

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
    }, 2000)
  }

  return (
    <div className="release-docs-layout" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', height: '100%' }}>
      
      {/* Configuration Pane */}
      <div className="config-pane" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <header className="page-header" style={{ marginBottom: '1rem' }}>
          <h1>Document Generator</h1>
          <p className="subtitle">Configure business sign-off exports</p>
        </header>

        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Release Target</h3>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Select Branch</label>
            <select 
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'white',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {branches.length === 0 && <option value="">No active branches found</option>}
              {branches.map(b => (
                <option key={b.id} value={b.name}>{b.name} ({b.status})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
              Include unverified hotfixes
            </label>
          </div>

          <button className="btn" onClick={handleGenerate} disabled={generating} style={{ width: '100%' }}>
            {generating ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', width: '18px', height: '18px' }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
                Processing Data...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Generate Preview
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Pane */}
      <div className="preview-pane card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></div>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>document-preview.pdf</span>
        </div>
        
        <div style={{ padding: '2.5rem', flex: 1, overflowY: 'auto' }}>
          {generating ? (
            <div className="shimmer-card large"></div>
          ) : generated ? (
            <div className="document-content" style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
              <h1 style={{ color: 'white', marginTop: 0, borderBottom: '2px solid var(--border)', paddingBottom: '1rem' }}>Release Documentation: {selectedBranch.split('/')[1]}</h1>
              
              <h3 style={{ color: '#818cf8', marginTop: '2rem' }}>1. Executive Summary</h3>
              <p>This deployment includes 2 major feature enhancements and 1 critical hotfix patched directly into the release candidate.</p>

              <h3 style={{ color: '#818cf8', marginTop: '2rem' }}>2. Included Hotfixes</h3>
              <ul style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1rem 1rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <li style={{ marginBottom: '0.5rem' }}><strong>[URGENT]</strong> Null pointer execution in payment gateway (Author: alice)</li>
              </ul>

              <h3 style={{ color: '#818cf8', marginTop: '2rem' }}>3. Business Approvals Required</h3>
              <p>Please review and sign off on this release using the notification sent to your email.</p>

              <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button className="btn" style={{ background: 'transparent', border: '1px solid var(--border)' }}>Export PDF</button>
                <button className="btn" style={{ background: 'var(--success)' }}>Approve & Email Stakeholders</button>
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ width: '64px', height: '64px', marginBottom: '1rem', opacity: 0.5 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <p style={{ fontSize: '1.1rem' }}>Select a branch to generate the release document preview.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
