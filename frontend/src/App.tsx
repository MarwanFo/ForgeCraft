import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  BookOpen, 
  Trophy, 
  Search, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

// Import modular pages
import DashboardOverview from './pages/DashboardOverview';
import MarketTicker from './pages/MarketTicker';
import ChroniclePage from './pages/Chronicle';
import Leaderboard from './pages/Leaderboard';
import InspectPlayer from './pages/InspectPlayer';

const API_BASE = "http://localhost:8000/api";

function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'market' | 'chronicles' | 'leaderboard' | 'search'>('overview');
  const [apiOnline, setApiOnline] = useState(true);

  // Quick health check on mount
  const checkApiHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/`);
      if (res.ok) {
        setApiOnline(true);
      } else {
        setApiOnline(false);
      }
    } catch {
      setApiOnline(false);
    }
  };

  useEffect(() => {
    checkApiHealth();
    // Run health check periodically every 10 seconds
    const interval = setInterval(checkApiHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container">
      {/* 1. Sidebar Navigation panel */}
      <aside className="sidebar">
        <div className="brand">
          <Sparkles className="brand-icon" size={28} />
          <span>ForgeCraft AI</span>
        </div>
        
        <ul className="nav-menu">
          <li 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard className="nav-item-icon" size={20} />
            <span>Overview</span>
          </li>
          <li 
            className={`nav-item ${activeTab === 'market' ? 'active' : ''}`}
            onClick={() => setActiveTab('market')}
          >
            <TrendingUp className="nav-item-icon" size={20} />
            <span>Market Ticker</span>
          </li>
          <li 
            className={`nav-item ${activeTab === 'chronicles' ? 'active' : ''}`}
            onClick={() => setActiveTab('chronicles')}
          >
            <BookOpen className="nav-item-icon" size={20} />
            <span>Lore Chronicles</span>
          </li>
          <li 
            className={`nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            <Trophy className="nav-item-icon" size={20} />
            <span>Leaderboard</span>
          </li>
          <li 
            className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search className="nav-item-icon" size={20} />
            <span>Inspect Player</span>
          </li>
        </ul>
        
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: apiOnline ? 'var(--success)' : 'var(--error)',
              boxShadow: apiOnline ? '0 0 8px #10b981' : '0 0 8px #ef4444'
            }}></span>
            <span style={{ color: 'var(--text-muted)' }}>
              {apiOnline ? 'API Bridge Online' : 'API Bridge Offline'}
            </span>
          </div>
          <button onClick={checkApiHealth} className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
            Sync Health
          </button>
        </div>
      </aside>

      {/* 2. Main content display panel */}
      <main className="main-content">
        {!apiOnline && (
          <div className="glass-panel" style={{ 
            padding: '20px', 
            borderColor: 'var(--error)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            background: 'rgba(239, 68, 68, 0.08)',
            marginBottom: '16px'
          }}>
            <AlertCircle size={32} style={{ color: 'var(--error)' }} />
            <div>
              <h3 style={{ margin: 0, color: '#fff' }}>Connection Disturbed</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                The React dashboard is currently unable to communicate with the FastAPI server at <code>http://localhost:8000</code>. Please ensure your Python script is running.
              </p>
            </div>
          </div>
        )}

        {/* Render modular pages based on active navigation item */}
        {activeTab === 'overview' && <DashboardOverview />}
        {activeTab === 'market' && <MarketTicker />}
        {activeTab === 'chronicles' && <ChroniclePage />}
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'search' && <InspectPlayer />}
      </main>
    </div>
  );
}

export default App;
