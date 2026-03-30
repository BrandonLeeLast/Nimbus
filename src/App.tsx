import { useState } from 'react'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import ReleaseDocs from './components/ReleaseDocs'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="logo">
          <div className="logo-icon"></div>
          <h2>Nimbus Tracker</h2>
        </div>
        <ul className="nav-links">
          <li className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </li>
          <li className={activeTab === 'releases' ? 'active' : ''} onClick={() => setActiveTab('releases')}>
            Release Docs
          </li>
          <li className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
            Settings
          </li>
        </ul>
      </nav>
      <main className="main-content">
        <header className="topbar">
          <div className="user-profile">
            <span>Admin</span>
            <div className="avatar"></div>
          </div>
        </header>
        <div className="content-area">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'releases' && <ReleaseDocs />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  )
}

export default App
