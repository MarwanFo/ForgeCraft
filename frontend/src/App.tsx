import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  BookOpen, 
  Trophy, 
  Search, 
  Sparkles,
  Package,
  AlertCircle,
  Database,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

const API_BASE = "http://localhost:8000/api";

// Helper to generate a stable pseudo-random price trend based on seed
const generateMockHistory = (currentPrice: number, itemId: number) => {
  const data = [];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let priceWalk = currentPrice * 0.92;
  
  for (let i = 0; i < 7; i++) {
    const changeFactor = Math.sin(itemId * 100 + i) * 0.04; // -4% to +4%
    priceWalk = priceWalk * (1 + changeFactor);
    data.push({
      day: days[i],
      Price: parseFloat(priceWalk.toFixed(2))
    });
  }
  // Guarantee final matches the real-time ticker price
  data[6].Price = currentPrice;
  return data;
};

interface User {
  discord_id: string;
  username: string;
  experience_points: number;
  player_class: string;
  gold_balance: number;
  created_at: string;
  last_active_at: string;
}

interface Commodity {
  commodity_id: number;
  item_id: number;
  current_price: number;
  supply_pool: number;
  demand_multiplier: number;
  updated_at: string;
  name: string;
  rarity: string;
  description: string;
}

interface Chronicle {
  event_id: string;
  event_type: string;
  raw_trigger_summary: string;
  generated_lore: string;
  recorded_at: string;
}

interface UserInventoryItem {
  item_id: number;
  name: string;
  rarity: string;
  description: string;
  base_value: number;
  quantity: number;
}

interface UserProfile {
  user: User;
  inventory: UserInventoryItem[];
}

function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'market' | 'chronicles' | 'leaderboard' | 'search'>('overview');
  
  // Data States
  const [market, setMarket] = useState<Commodity[]>([]);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [chronicles, setChronicles] = useState<Chronicle[]>([]);
  
  // Search States
  const [searchId, setSearchId] = useState('');
  const [searchProfile, setSearchProfile] = useState<UserProfile | null>(null);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // App States
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);
  const [selectedMarketItem, setSelectedMarketItem] = useState<number | null>(null);

  // Fetch all background statistics
  const fetchData = async () => {
    setLoading(true);
    try {
      const [marketRes, leaderboardRes, chroniclesRes] = await Promise.all([
        fetch(`${API_BASE}/market`).then(res => res.json()),
        fetch(`${API_BASE}/leaderboard`).then(res => res.json()),
        fetch(`${API_BASE}/chronicles`).then(res => res.json())
      ]);

      setMarket(marketRes);
      setLeaderboard(leaderboardRes);
      setChronicles(chroniclesRes);
      setApiOnline(true);
    } catch (error) {
      console.error("Failed to sync with backend api bridge:", error);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle player search logic
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    
    setIsSearching(true);
    setSearchError('');
    setSearchProfile(null);
    
    try {
      const res = await fetch(`${API_BASE}/users/${searchId.trim()}`);
      if (res.status === 404) {
        setSearchError("No player has been registered under this Discord ID.");
      } else if (!res.ok) {
        setSearchError("Failed to fetch coordinates for this profile.");
      } else {
        const data = await res.json();
        setSearchProfile(data);
      }
    } catch (err) {
      setSearchError("Server connection error during registry search.");
    } finally {
      setIsSearching(false);
    }
  };

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
            onClick={() => {
              setActiveTab('search');
              setSearchProfile(null);
              setSearchError('');
              setSearchId('');
            }}
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
          <button onClick={fetchData} className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
            Sync Server
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
            background: 'rgba(239, 68, 68, 0.08)' 
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

        {loading && apiOnline ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <Database className="brand-icon" size={48} style={{ animation: 'pulse 1.5s infinite' }} />
              <p style={{ color: 'var(--text-muted)' }}>Retrieving chronicles and dynamic coordinates...</p>
            </div>
          </div>
        ) : (
          <>
            {/* TAB CONTENT: Overview */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>Guild Hall Overview</h1>
                  <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Real-time summaries of community activity, currency balances, and market supply pools.</p>
                </div>
                
                <div className="stat-grid">
                  <div className="glass-panel stat-card">
                    <div className="stat-info">
                      <span className="stat-title">Active Adventurers</span>
                      <span className="stat-value">{leaderboard.length}</span>
                    </div>
                    <div className="stat-icon-wrapper">
                      <Trophy size={24} style={{ color: 'var(--primary)' }} />
                    </div>
                  </div>

                  <div className="glass-panel stat-card">
                    <div className="stat-info">
                      <span className="stat-title">Market Commodities</span>
                      <span className="stat-value">{market.length}</span>
                    </div>
                    <div className="stat-icon-wrapper">
                      <Package size={24} style={{ color: 'var(--secondary)' }} />
                    </div>
                  </div>

                  <div className="glass-panel stat-card">
                    <div className="stat-info">
                      <span className="stat-title">Chronicle Events</span>
                      <span className="stat-value">{chronicles.length}</span>
                    </div>
                    <div className="stat-icon-wrapper">
                      <BookOpen size={24} style={{ color: 'var(--warning)' }} />
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '32px' }}>
                  <h2 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Sparkles style={{ color: 'var(--primary)' }} />
                    <span>The Chronicler's Latest Entry</span>
                  </h2>
                  {chronicles.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="timeline-header">
                        <span className="badge badge-epic">{chronicles[0].event_type.replace("_", " ")}</span>
                        <span className="timeline-time">
                          {new Date(chronicles[0].recorded_at).toLocaleDateString()} at {new Date(chronicles[0].recorded_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="timeline-body" style={{ margin: 0 }}>
                        "{chronicles[0].generated_lore}"
                      </p>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>The ledger lies empty. Fuel the Discord chat to trigger events!</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Market Ticker */}
            {activeTab === 'market' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>Market Exchanges</h1>
                  <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Logarithmic pricing tickers adjusted dynamically by player trade transactions.</p>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Asset Name</th>
                          <th>Rarity</th>
                          <th>Supply Pool</th>
                          <th>Demand Weight</th>
                          <th>Exchange Price</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {market.map(c => {
                          const isSelected = selectedMarketItem === c.item_id;
                          const rarityClass = `badge-${c.rarity.toLowerCase()}`;
                          const isUp = c.demand_multiplier >= 1.0;
                          
                          return (
                            <React.Fragment key={c.item_id}>
                              <tr 
                                style={{ cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                                onClick={() => setSelectedMarketItem(isSelected ? null : c.item_id)}
                              >
                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                <td><span className={`badge ${rarityClass}`}>{c.rarity}</span></td>
                                <td>{c.supply_pool} units</td>
                                <td>{c.demand_multiplier.toFixed(2)}x</td>
                                <td style={{ color: 'var(--warning)', fontWeight: 700 }}>
                                  🪙 {c.current_price.toFixed(2)} Gold
                                </td>
                                <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                                  {isUp ? (
                                    <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
                                      <ArrowUpRight size={16} /> Bullish
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
                                      <ArrowDownRight size={16} /> Bearish
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {isSelected && (
                                <tr>
                                  <td colSpan={6} style={{ padding: '24px', background: 'rgba(0,0,0,0.15)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                      <div>
                                        <h4 style={{ margin: '0 0 4px', color: '#fff' }}>Asset Description</h4>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{c.description}</p>
                                      </div>
                                      
                                      <div style={{ height: '200px', width: '100%' }}>
                                        <h4 style={{ margin: '0 0 12px', color: '#fff' }}>Historical Price Graph (7 Days)</h4>
                                        <ResponsiveContainer width="100%" height="100%">
                                          <LineChart data={generateMockHistory(c.current_price, c.item_id)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="day" stroke="var(--text-dark)" />
                                            <YAxis stroke="var(--text-dark)" />
                                            <Tooltip 
                                              contentStyle={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
                                              itemStyle={{ color: 'var(--warning)' }}
                                            />
                                            <Line type="monotone" dataKey="Price" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
                                          </LineChart>
                                        </ResponsiveContainer>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Lore Chronicles */}
            {activeTab === 'chronicles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>Lore Chronicles</h1>
                  <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>History logs of world events triggered by AI evaluations of high-intensity server discussions.</p>
                </div>

                <div className="timeline">
                  {chronicles.map((ch) => (
                    <div key={ch.event_id} className="timeline-item">
                      <div className="timeline-dot"></div>
                      <div className="glass-panel timeline-content">
                        <div className="timeline-header">
                          <span className="badge badge-epic">{ch.event_type.replace("_", " ")}</span>
                          <span className="timeline-time">
                            {new Date(ch.recorded_at).toLocaleDateString()} at {new Date(ch.recorded_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p style={{ margin: '8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <strong>Trigger Summary:</strong> {ch.raw_trigger_summary}
                        </p>
                        <p className="timeline-body" style={{ margin: 0 }}>
                          "{ch.generated_lore}"
                        </p>
                      </div>
                    </div>
                  ))}
                  {chronicles.length === 0 && (
                    <p style={{ color: 'var(--text-muted)' }}>No chronicles have been recorded yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Leaderboard */}
            {activeTab === 'leaderboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>Adventurer Leaderboard</h1>
                  <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Ranking logs of top users based on chat experience points and progression.</p>
                </div>

                {/* Podium top 3 */}
                {leaderboard.length > 0 && (
                  <div className="podium-container">
                    {/* Rank 2 */}
                    {leaderboard[1] && (
                      <div className="glass-panel podium-card rank-2">
                        <div className="podium-badge">2</div>
                        <div className="podium-avatar">👤</div>
                        <h3 style={{ margin: 0 }}>{leaderboard[1].username}</h3>
                        <span className="badge badge-uncommon">{leaderboard[1].player_class}</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>XP: {leaderboard[1].experience_points}</span>
                      </div>
                    )}
                    
                    {/* Rank 1 */}
                    {leaderboard[0] && (
                      <div className="glass-panel podium-card rank-1">
                        <div className="podium-badge">1</div>
                        <div className="podium-avatar" style={{ fontSize: '2rem' }}>👑</div>
                        <h2 style={{ margin: 0 }}>{leaderboard[0].username}</h2>
                        <span className="badge badge-legendary">{leaderboard[0].player_class}</span>
                        <span style={{ fontSize: '1rem', color: 'var(--warning)', fontWeight: 600 }}>XP: {leaderboard[0].experience_points}</span>
                      </div>
                    )}

                    {/* Rank 3 */}
                    {leaderboard[2] && (
                      <div className="glass-panel podium-card rank-3">
                        <div className="podium-badge">3</div>
                        <div className="podium-avatar">👤</div>
                        <h3 style={{ margin: 0 }}>{leaderboard[2].username}</h3>
                        <span className="badge badge-rare">{leaderboard[2].player_class}</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>XP: {leaderboard[2].experience_points}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Ranks 4-10 table */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#fff' }}>Remaining Standings</h3>
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Adventurer</th>
                          <th>Class</th>
                          <th>Wallet Balance</th>
                          <th style={{ textAlign: 'right' }}>Experience</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.slice(3).map((user, index) => (
                          <tr key={user.discord_id}>
                            <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>#{index + 4}</td>
                            <td style={{ fontWeight: 600 }}>{user.username}</td>
                            <td><span className="badge badge-common">{user.player_class}</span></td>
                            <td style={{ color: 'var(--warning)' }}>🪙 {user.gold_balance.toFixed(2)} Gold</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{user.experience_points} XP</td>
                          </tr>
                        ))}
                        {leaderboard.length <= 3 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No other competitors logged.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Inspect Player */}
            {activeTab === 'search' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>Inspect Profile</h1>
                  <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Query specific player inventory logs, XP statistics, and class categories.</p>
                </div>

                <div className="glass-panel" style={{ padding: '32px' }}>
                  <form onSubmit={handleSearch} className="search-container">
                    <input 
                      type="text" 
                      placeholder="Enter Player's 18-digit Discord ID (e.g. 177984812843513856)"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      className="search-input"
                    />
                    <button type="submit" className="btn-primary" disabled={isSearching}>
                      {isSearching ? 'Querying...' : 'Search Registry'}
                    </button>
                  </form>

                  {searchError && (
                    <div style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                      <AlertCircle size={18} />
                      <span>{searchError}</span>
                    </div>
                  )}

                  {searchProfile && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '24px', textAlign: 'left' }}>
                      {/* User Stats Card */}
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="podium-avatar" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>🛡️</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <h2 style={{ margin: 0 }}>{searchProfile.user.username}</h2>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Discord ID: {searchProfile.user.discord_id}</span>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <span className="badge badge-legendary">{searchProfile.user.player_class}</span>
                            <span className="badge badge-uncommon">Level {Math.floor(Math.sqrt(searchProfile.user.experience_points / 100)) + 1}</span>
                          </div>
                        </div>
                      </div>

                      <div className="stat-grid">
                        <div className="glass-panel stat-card" style={{ padding: '16px' }}>
                          <div className="stat-info">
                            <span className="stat-title">Wallet Balance</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--warning)' }}>🪙 {searchProfile.user.gold_balance.toFixed(2)} Gold</span>
                          </div>
                        </div>

                        <div className="glass-panel stat-card" style={{ padding: '16px' }}>
                          <div className="stat-info">
                            <span className="stat-title">Backpack Space</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem' }}>
                              {searchProfile.inventory.reduce((acc, curr) => acc + curr.quantity, 0)} items
                            </span>
                          </div>
                        </div>

                        <div className="glass-panel stat-card" style={{ padding: '16px' }}>
                          <div className="stat-info">
                            <span className="stat-title">Total Experience</span>
                            <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{searchProfile.user.experience_points} XP</span>
                          </div>
                        </div>
                      </div>

                      {/* User Inventory Details */}
                      <div>
                        <h3 style={{ margin: '0 0 16px', color: '#fff' }}>Backpack Inventory</h3>
                        <div className="table-container">
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Rarity</th>
                                <th>Quantity</th>
                                <th>Store Price Value</th>
                                <th>Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {searchProfile.inventory.map(slot => (
                                <tr key={slot.item_id}>
                                  <td style={{ fontWeight: 600 }}>{slot.name}</td>
                                  <td><span className={`badge badge-${slot.rarity.toLowerCase()}`}>{slot.rarity}</span></td>
                                  <td>{slot.quantity} units</td>
                                  <td>🪙 {slot.base_value.toFixed(2)} Gold</td>
                                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{slot.description}</td>
                                </tr>
                              ))}
                              {searchProfile.inventory.length === 0 && (
                                <tr>
                                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Backpack is completely empty.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
