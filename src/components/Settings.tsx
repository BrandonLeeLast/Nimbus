import { useState } from 'react'

export default function Settings() {
  const [cleanupEnabled, setCleanupEnabled] = useState(true)
  const [cleanupSchedule, setCleanupSchedule] = useState('weekly')

  return (
    <div className="settings">
      <header className="page-header">
        <h1>Tracker Settings</h1>
        <p className="subtitle">Configure automated jobs and repositories</p>
      </header>

      <div className="grid">
        <div className="card">
          <h2>Branch Cleanup</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Automatically clear old PRs and branches.
          </p>
          
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="checkbox" 
                checked={cleanupEnabled}
                onChange={e => setCleanupEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Enable Automations
            </label>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Frequency</label>
            <select 
              value={cleanupSchedule} 
              onChange={e => setCleanupSchedule(e.target.value)}
              style={{
                background: 'var(--surface)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                padding: '0.75rem',
                borderRadius: '8px',
                width: '100%',
                fontSize: '1rem'
              }}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <button className="btn">Save Configuration</button>
        </div>

        <div className="card">
          <h2>Watched Repositories</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Micro-services triggering PR alerts.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {['backend-auth-service', 'frontend-core', 'payment-gateway'].map(repo => (
              <li key={repo} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                {repo}
                <button style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Remove</button>
              </li>
            ))}
          </ul>
          <button className="btn" style={{ marginTop: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>+ Add Repository</button>
        </div>
      </div>
    </div>
  )
}
