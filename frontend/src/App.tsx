import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  BookOpen, 
  Trophy, 
  Search, 
  Sparkles,
  AlertCircle,
  Shield
} from 'lucide-react';

// Import modular pages
import DashboardOverview from './pages/DashboardOverview';
import MarketTicker from './pages/MarketTicker';
import ChroniclePage from './pages/Chronicle';
import Leaderboard from './pages/Leaderboard';
import InspectPlayer from './pages/InspectPlayer';
import AdminCenter from './pages/AdminCenter';

const API_BASE = "http://localhost:8000/api";

function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'market' | 'chronicles' | 'leaderboard' | 'search' | 'admin'>('overview');
  const [apiOnline, setApiOnline] = useState(true);
  const [user, setUser] = useState<{ discord_id: string; username: string; avatar: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

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

    // Read existing user session
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }

    // Capture OAuth2 redirection code callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAuthLoading(true);
      // Clean address bar immediately
      window.history.replaceState({}, document.title, window.location.pathname);

      fetch(`${API_BASE}/auth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })
      .then(async (res) => {
        if (!res.ok) throw new Error("Discord Login authentication failed.");
        return res.json();
      })
      .then(data => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(err => {
        console.error(err);
        alert("Discord Login failed. Ensure the API bridge is online and active.");
      })
      .finally(() => {
        setAuthLoading(false);
      });
    }

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
          <li 
            className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <Shield className="nav-item-icon" size={20} />
            <span>Admin Center</span>
          </li>
        </ul>
        
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 0 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img 
                  src={user.avatar === "default_avatar" ? "https://cdn.discordapp.com/embed/avatars/0.png" : `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`} 
                  alt="Avatar" 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--primary-glow)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{user.username}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {user.discord_id}</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  setUser(null);
                }} 
                className="btn-primary" 
                style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={() => {
                  setAuthLoading(true);
                  fetch(`${API_BASE}/auth/callback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: 'sandbox_dev_bypass' })
                  })
                  .then(res => {
                    if (!res.ok) throw new Error("Sandbox login failed.");
                    return res.json();
                  })
                  .then(data => {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    setUser(data.user);
                  })
                  .catch(err => {
                    console.error(err);
                    alert("Local sandbox authentication failed. Ensure the FastAPI backend is running.");
                  })
                  .finally(() => {
                    setAuthLoading(false);
                  });
                }}
                disabled={authLoading}
                className="btn-primary" 
                style={{ 
                  padding: '10px 14px', 
                  fontSize: '0.9rem', 
                  background: 'var(--primary)', 
                  borderColor: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <span>{authLoading ? 'Signing In...' : 'Login with Discord'}</span>
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Note: Local Sandbox mode is enabled by default to bypass Discord OAuth URI redirects.
              </span>
            </div>
          )}

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
        {activeTab === 'admin' && <AdminCenter />}
      </main>
    </div>
  );
}

export default App;
