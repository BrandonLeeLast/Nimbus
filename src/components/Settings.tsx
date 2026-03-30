import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'https://nimbus-worker-prod.brandonl-9ff.workers.dev/api';

export default function Settings() {
  const { token } = useAuth()
  const [repos, setRepos] = useState<any[]>([])
  const [releases, setReleases] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({ 
    CLEANUP_ENABLED: 'false', 
    CLEANUP_SCHEDULE: 'weekly', 
    EXCLUDED_TICKETS: '',
    ACTIVE_RELEASE: '' 
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [reposRes, settingsRes, releasesRes] = await Promise.all([
      fetch(`${API_URL}/repositories`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/releases`, { headers: { 'Authorization': `Bearer ${token}` } })
    ])
    setRepos(await reposRes.json())
    setReleases(await releasesRes.json())
    
    const settingsArray = await settingsRes.json()
    const settingsObj: any = {}
    settingsArray.forEach((s: any) => settingsObj[s.key] = s.value)
    setSettings(prev => ({ ...prev, ...settingsObj }))
  }

  const handleSaveSettings = async () => {
    await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(settings)
    })
    setMessage('Settings saved successfully!')
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
        <p className="subtitle">Configure automated jobs and active release context</p>
      </header>

      <div className="grid">
        <div className="card">
          <h2>Dashboard Focus</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Select which release the dashboard should track across all projects.
          </p>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Active Release Pointer</label>
            <select 
              value={settings.ACTIVE_RELEASE}
              onChange={e => setSettings({ ...settings, ACTIVE_RELEASE: e.target.value })}
              className="settings-input"
            >
              <option value="">None (Tracking all hotfixes)</option>
              {releases.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Excluded Tickets (Comma separated)</label>
            <input 
              value={settings.EXCLUDED_TICKETS}
              onChange={e => setSettings({ ...settings, EXCLUDED_TICKETS: e.target.value })}
              className="settings-input"
              placeholder="e.g. INDEV-1111"
            />
          </div>

          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="checkbox" 
                checked={settings.CLEANUP_ENABLED === 'true'}
                onChange={e => setSettings({ ...settings, CLEANUP_ENABLED: String(e.target.checked) })}
                style={{ width: '18px', height: '18px' }}
              />
              Enable Branch Cleanup Logic
            </label>
          </div>

          <button className="btn" onClick={handleSaveSettings}>Update Global Settings</button>
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
          <h2>Live GitLab Repositories ({repos.length})</h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {repos.map(repo => (
                <li key={repo.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{repo.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {repo.id} — {repo.url}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
