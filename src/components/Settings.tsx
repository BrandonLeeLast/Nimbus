import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'https://nimbus-worker-prod.brandonl-9ff.workers.dev/api';

export default function Settings() {
  const { token } = useAuth()
  const [repos, setRepos] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({ CLEANUP_ENABLED: 'false', CLEANUP_SCHEDULE: 'weekly' })
  const [newRepo, setNewRepo] = useState({ name: '', url: '', provider: 'github', remote_id: '' })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [reposRes, settingsRes] = await Promise.all([
      fetch(`${API_URL}/repositories`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/settings`, { headers: { 'Authorization': `Bearer ${token}` } })
    ])
    setRepos(await reposRes.json())
    setSettings(await settingsRes.json())
  }

  const handleSaveSettings = async () => {
    await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(settings)
    })
    setMessage('Settings saved successfully!')
  }

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch(`${API_URL}/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newRepo)
    })
    setNewRepo({ name: '', url: '', provider: 'github', remote_id: '' })
    fetchData()
  }

  const handleDeleteRepo = async (id: string) => {
    await fetch(`${API_URL}/repositories/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    fetchData()
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch(`${API_URL}/auth/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole })
    })
    if (res.ok) {
      setMessage(`Invited ${inviteEmail} successfully!`)
      setInviteEmail('')
    }
  }

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
                checked={settings.CLEANUP_ENABLED === 'true'}
                onChange={e => setSettings({ ...settings, CLEANUP_ENABLED: String(e.target.checked) })}
                style={{ width: '18px', height: '18px' }}
              />
              Enable Automations
            </label>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Frequency</label>
            <select 
              value={settings.CLEANUP_SCHEDULE} 
              onChange={e => setSettings({ ...settings, CLEANUP_SCHEDULE: e.target.value })}
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

          <button className="btn" onClick={handleSaveSettings}>Save Configuration</button>
          {message && <p style={{ marginTop: '1rem', color: 'var(--success)', fontSize: '0.9rem' }}>{message}</p>}
        </div>

        <div className="card">
          <h2>Invite Team Member</h2>
          <form onSubmit={handleInvite}>
            <input 
              type="email" 
              placeholder="Email address" 
              value={inviteEmail} 
              onChange={e => setInviteEmail(e.target.value)}
              className="settings-input"
              required 
            />
            <select 
              value={inviteRole} 
              onChange={e => setInviteRole(e.target.value)}
              className="settings-input"
              style={{ marginTop: '0.5rem' }}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn" style={{ marginTop: '1rem', width: '100%' }}>Send Invitation</button>
          </form>
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h2>Managed Repositories</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {repos.map(repo => (
                  <li key={repo.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{repo.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{repo.provider} ID: {repo.remote_id}</div>
                    </div>
                    <button 
                      onClick={() => handleDeleteRepo(repo.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
                {repos.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No repositories tracked yet.</p>}
              </ul>
            </div>
            
            <form onSubmit={handleAddRepo} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ marginTop: 0 }}>Add New Repository</h3>
              <input 
                placeholder="Repo Name (e.g. Frontend Core)" 
                value={newRepo.name} 
                onChange={e => setNewRepo({...newRepo, name: e.target.value})}
                className="settings-input"
                required 
              />
              <input 
                placeholder="Provider ID (e.g. owner/repo or ID)" 
                value={newRepo.remote_id} 
                onChange={e => setNewRepo({...newRepo, remote_id: e.target.value})}
                className="settings-input"
                required 
              />
              <select 
                value={newRepo.provider} 
                onChange={e => setNewRepo({...newRepo, provider: e.target.value})}
                className="settings-input"
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
              </select>
              <input 
                placeholder="Repository URL" 
                value={newRepo.url} 
                onChange={e => setNewRepo({...newRepo, url: e.target.value})}
                className="settings-input"
                required 
              />
              <button type="submit" className="btn primary" style={{ width: '100%', marginTop: '1rem' }}>Track Repository</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
