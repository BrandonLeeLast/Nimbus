import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './components/Login.tsx'
import Dashboard from './components/Dashboard.tsx'
import Settings from './components/Settings.tsx'
import ReleaseDocs from './components/ReleaseDocs.tsx'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showLogin, setShowLogin] = useState(false)
  const { token, user, isLoading, logout } = useAuth()

  if (isLoading) return null;

  return (
    <div className="app-container">
      {showLogin && <Login onClose={() => setShowLogin(false)} />}
      <nav className="sidebar">
        <div className="logo-section">
          <div className="logo-icon glow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <h2>Nimbus <span className="highlight-text">Tracker</span></h2>
        </div>
        
        <div className="nav-group-title">MAIN MENU</div>
        <ul className="nav-links">
          <li className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
            Overview
          </li>
          <li className={activeTab === 'releases' ? 'active' : ''} onClick={() => setActiveTab('releases')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Generate Docs
          </li>
          {token && user?.role === 'admin' && (
            <li className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Automations
            </li>
          )}
          {!token ? (
            <li className="login-btn" onClick={() => setShowLogin(true)} style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', color: 'var(--primary)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
              Sign In
            </li>
          ) : (
            <li className="logout-btn" onClick={logout} style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Sign Out
            </li>
          )}
        </ul>
      </nav>
      <main className="main-content">
        <header className="topbar">
          <div className="search-bar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search branches or hotfixes..." />
          </div>
          <div className="user-profile">
            {token ? (
              <>
                <span className="user-name">{user?.email.split('@')[0]}</span>
                <div className="avatar">{user?.email[0].toUpperCase()}</div>
              </>
            ) : (
              <button className="btn outline" onClick={() => setShowLogin(true)}>Admin Login</button>
            )}
          </div>
        </header>
        <div className="content-area">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'releases' && <ReleaseDocs />}
          {token && user?.role === 'admin' && activeTab === 'settings' && <Settings />}
          {!token && activeTab === 'settings' && <div className="card">Please login to access settings.</div>}
        </div>
      </main>
    </div>
  )
}

export default App
