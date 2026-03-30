import { useState, useEffect } from 'react'
import './Dashboard.css'

export default function Dashboard() {
  const [branches, setBranches] = useState<any[]>([])
  const [hotfixes, setHotfixes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data fetch for local tests since backend might not be fully seeded
    setTimeout(() => {
      setBranches([
        { id: '1', name: 'release/v1.2.0', status: 'active', created_by: 'alice', created_at: '2024-03-20T10:00:00Z' }
      ])
      setHotfixes([
        { id: '10', branch_id: 'release/v1.2.0', pr_url: 'https://gitlab.com/pr/1234', author: 'bob', merged_at: '2024-03-21T14:30:00Z' }
      ])
      setLoading(false)
    }, 1000)
  }, [])

  return (
    <div className="dashboard">
      <header className="page-header">
        <h1>Dashboard Overview</h1>
        <p className="subtitle">Real-time bi-weekly release tracking</p>
      </header>
      
      {loading ? (
        <div className="loader">Loading metrics...</div>
      ) : (
        <div className="grid">
          <div className="card stat-card">
            <h3>Active Releases</h3>
            <div className="value">{branches.length}</div>
          </div>
          <div className="card stat-card">
            <h3>Recent Hotfixes</h3>
            <div className="value warning">{hotfixes.length}</div>
          </div>

          <div className="card full-width">
            <h2>Recent Hotfixes</h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Branch / Target</th>
                    <th>Author</th>
                    <th>PR Link</th>
                    <th>Merged At</th>
                  </tr>
                </thead>
                <tbody>
                  {hotfixes.map(hf => (
                    <tr key={hf.id}>
                      <td><span className="badge">{hf.branch_id}</span></td>
                      <td>{hf.author}</td>
                      <td><a href={hf.pr_url} target="_blank" rel="noreferrer">View PR</a></td>
                      <td>{new Date(hf.merged_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
