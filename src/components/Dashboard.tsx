import { useState, useEffect } from 'react'
import './Dashboard.css'

export default function Dashboard() {
  const [branches, setBranches] = useState<any[]>([])
  const [hotfixes, setHotfixes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setBranches([
        { id: '1', name: 'release/v1.2.0', status: 'active', created_by: 'alice', created_at: '2024-03-20T10:00:00Z' },
        { id: '2', name: 'release/v1.1.0', status: 'closed', created_by: 'bob', created_at: '2024-03-05T10:00:00Z' }
      ])
      setHotfixes([
        { id: '10', branch_id: 'release/v1.2.0', pr_url: 'https://gitlab.com/pr/1234', author: 'bob', developer: 'Brandon', ticket_id: 'OPENBET-3081', merged_at: '2024-03-21T14:30:00Z' },
        { id: '11', branch_id: 'main', pr_url: 'https://gitlab.com/pr/1235', author: 'charlie', developer: 'Zweni', ticket_id: 'INDEV-3591', merged_at: '2024-03-22T09:15:00Z' }
      ])
      setLoading(false)
    }, 800)
  }, [])

  return (
    <div className="dashboard-layout">
      <div className="dashboard-main">
        <header className="page-header">
          <h1>Release Overview</h1>
          <p className="subtitle">Real-time metrics for bi-weekly deployments</p>
        </header>
        
        {loading ? (
          <div className="shimmer-loader">
            <div className="shimmer-card"></div>
            <div className="shimmer-card"></div>
            <div className="shimmer-card large"></div>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="card stat-card primary-gradient">
                <div className="stat-header">
                  <h3>Active Releases</h3>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                </div>
                <div className="value">{branches.filter(b => b.status === 'active').length}</div>
                <div className="stat-footer">Tracked across 4 repositories</div>
              </div>
              
              <div className="card stat-card warning-gradient">
                <div className="stat-header">
                  <h3>Recent Hotfixes</h3>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <div className="value warning">{hotfixes.length}</div>
                <div className="stat-footer">+2 since last week</div>
              </div>
            </div>

            <div className="card table-card active-releases-card">
              <div className="card-header">
                <h2>Tracked Branches</h2>
                <button className="btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Branch Name</th>
                      <th>Status</th>
                      <th>Created By</th>
                      <th>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.id}>
                        <td className="branch-name">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
                          {b.name}
                        </td>
                        <td>
                          <span className={`status-badge ${b.status}`}>
                            {b.status === 'active' && <span className="pulse-dot"></span>}
                            {b.status}
                          </span>
                        </td>
                        <td><div className="user-chip">{b.created_by.charAt(0).toUpperCase()}</div> {b.created_by}</td>
                        <td className="text-muted">3 days ago</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="dashboard-sidebar">
        <div className="card activity-feed">
          <h2>Recent Activity</h2>
          <div className="feed-timeline">
            {hotfixes.map((hf) => (
              <div className="feed-item" key={hf.id}>
                <div className="feed-icon hotfix">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                </div>
                <div className="feed-content">
                  <p><strong>{hf.developer || hf.author}</strong> merged a hotfix into <span className="highlight-tag">{hf.branch_id}</span></p>
                  {hf.ticket_id && <span className="highlight-tag" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', marginRight: '8px' }}>{hf.ticket_id}</span>}
                  <span className="feed-time">{new Date(hf.merged_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            ))}
             <div className="feed-item">
                <div className="feed-icon branch">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
                </div>
                <div className="feed-content">
                  <p>Release document generated for <strong>v1.2.0</strong></p>
                  <span className="feed-time">Yesterday</span>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  )
}
