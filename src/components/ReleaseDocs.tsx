import { useState } from 'react'

export default function ReleaseDocs() {
  const [generating, setGenerating] = useState(false)

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => setGenerating(false), 2000)
  }

  return (
    <div className="release-docs">
      <header className="page-header">
        <h1>Release Documents</h1>
        <p className="subtitle">Generate and review business sign-off documents</p>
      </header>

      <div className="card full-width">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2>Upcoming Release: v1.3.0</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Scheduled deployment: Friday</p>
          </div>
          <button className="btn" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Doc Now'}
          </button>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '300px' }}>
          {generating ? (
             <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem' }}>Compiling Youtrack & Gitlab data...</div>
          ) : (
            <div>
              <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>Release v1.3.0 Draft Document</h3>
              <p><strong>Features:</strong></p>
              <ul>
                <li>User Analytics Dashboard</li>
                <li>Payment Gateway V2</li>
              </ul>
              <p><strong>Hotfixes Included:</strong></p>
              <ul>
                <li>Fix null pointer in auth layer (alice)</li>
              </ul>
              <div style={{ marginTop: '2rem' }}>
                <button className="btn" style={{ background: 'var(--success)' }}>Send to Business Team</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
