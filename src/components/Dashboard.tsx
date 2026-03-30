import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

const API_URL = import.meta.env.VITE_API_URL || 'https://nimbus-worker-prod.brandonl-9ff.workers.dev/api';

export default function Dashboard() {
  const { token } = useAuth()
  const [stats, setStats] = useState({ repos: 0, branches: 0, hotfixes: 0 })
  const [activeRelease, setActiveRelease] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [reposRes, branchesRes, hotfixesRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/repositories`),
        fetch(`${API_URL}/branches`),
        fetch(`${API_URL}/hotfixes`),
        fetch(`${API_URL}/settings`)
      ])

      const repos = await reposRes.json()
      const branches = await branchesRes.json()
      const hotfixes = await hotfixesRes.json()
      const settingsArray = await settingsRes.json()
      
      const activeSetting = settingsArray.find((s: any) => s.key === 'ACTIVE_RELEASE')
      setActiveRelease(activeSetting?.value || 'Global')

      setStats({
        repos: Array.isArray(repos) ? repos.length : 0,
        branches: Array.isArray(branches) ? branches.length : 0,
        hotfixes: Array.isArray(hotfixes) ? hotfixes.length : 0
      })
    } catch (e) {
      console.error('Fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="dashboard-loading">
      <div className="shimmer card" style={{ height: '200px' }}></div>
      <div className="shimmer card" style={{ height: '200px' }}></div>
      <div className="shimmer card" style={{ height: '200px' }}></div>
    </div>
  )

  return (
    <div className="dashboard">
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>Nimbus Dashboard</h1>
            <p className="subtitle">Real-time status across GitLab ecosystem</p>
          </div>
          {activeRelease && (
            <div className="active-release-badge">
              Tracking: <strong>{activeRelease}</strong>
            </div>
          )}
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Member Projects</div>
          <div className="stat-value">{stats.repos}</div>
          <div className="stat-trend">Live Sync Active</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-label">Active Branches</div>
          <div className="stat-value">{stats.branches}</div>
          <div className="stat-trend">Matched to {activeRelease}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Merged Hotfixes</div>
          <div className="stat-value">{stats.hotfixes}</div>
          <div className="stat-trend">Total Sign-offs</div>
        </div>
      </div>

      <div className="activity-section card">
        <h3>Live GitLab Feed</h3>
        <p style={{ color: 'var(--text-muted)' }}>Showing activities for <strong>{activeRelease}</strong> context.</p>
        {/* Placeholder for future activity feed */}
        <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', marginTop: '1rem' }}>
          Real-time branch events and merge activity will appear here.
        </div>
      </div>
    </div>
  )
}
