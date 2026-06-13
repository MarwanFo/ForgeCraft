import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Trophy, Coins, Star, Award } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

interface BoardUser {
  discord_id: string;
  username: string;
  player_class: string;
  experience_points?: number;
  gold_balance?: number;
  reputation?: number;
  level?: number;
}

type LeaderboardTab = 'xp' | 'wealth' | 'reputation';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('xp');
  const [leaderboard, setLeaderboard] = useState<BoardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchLeaderboard = async (tab: LeaderboardTab) => {
    setLoading(true);
    setError(false);
    try {
      let endpoint = `${API_BASE}/leaderboard`; // Default XP
      if (tab === 'wealth') {
        endpoint = `${API_BASE}/leaderboards/wealth`;
      } else if (tab === 'reputation') {
        endpoint = `${API_BASE}/leaderboards/reputation`;
      }

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to load leaderboard.");
      const data = await res.json();
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(activeTab);
  }, [activeTab]);

  const getScoreLabel = (user: BoardUser) => {
    if (activeTab === 'xp') {
      return `${user.experience_points ?? 0} XP`;
    } else if (activeTab === 'wealth') {
      return `${(user.gold_balance ?? 0).toFixed(2)} Gold`;
    } else {
      return `+${user.reputation ?? 0} REP`;
    }
  };

  const getBadgeClass = (rank: number) => {
    if (rank === 1) return 'badge-legendary';
    if (rank === 2) return 'badge-epic';
    return 'badge-rare';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Live Standings</span>
            <Trophy style={{ color: 'var(--warning)' }} size={28} />
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Global standings tracking progress, wealth, and honor metrics across the server.</p>
        </div>
        <button onClick={() => fetchLeaderboard(activeTab)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} />
          <span>Sync Standings</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('xp')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'xp' ? 'var(--primary)' : 'transparent',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.2s'
          }}
        >
          <Star size={16} />
          <span>XP & Level</span>
        </button>
        <button 
          onClick={() => setActiveTab('wealth')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'wealth' ? 'var(--primary)' : 'transparent',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.2s'
          }}
        >
          <Coins size={16} />
          <span>Wealth (Gold)</span>
        </button>
        <button 
          onClick={() => setActiveTab('reputation')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'reputation' ? 'var(--primary)' : 'transparent',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.2s'
          }}
        >
          <Award size={16} />
          <span>Reputation</span>
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '16px', borderColor: 'var(--error)', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={24} style={{ color: 'var(--error)' }} />
          <span>Failed to synchronize live leaderboard with API.</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <>
          {/* Podium top 3 */}
          {leaderboard.length > 0 && (
            <div className="podium-container">
              {/* Rank 2 */}
              {leaderboard[1] && (
                <div className="glass-panel podium-card rank-2">
                  <div className="podium-badge">2</div>
                  <div className="podium-avatar">🥈</div>
                  <h3 style={{ margin: '8px 0 0' }}>{leaderboard[1].username}</h3>
                  <span className={`badge ${getBadgeClass(2)}`} style={{ marginTop: '8px' }}>
                    {leaderboard[1].player_class}
                  </span>
                  <span style={{ fontSize: '1rem', color: 'var(--primary-glow)', fontWeight: 600, marginTop: '8px' }}>
                    {getScoreLabel(leaderboard[1])}
                  </span>
                </div>
              )}
              
              {/* Rank 1 */}
              {leaderboard[0] && (
                <div className="glass-panel podium-card rank-1">
                  <div className="podium-badge">1</div>
                  <div className="podium-avatar" style={{ fontSize: '2rem' }}>👑</div>
                  <h2 style={{ margin: '8px 0 0' }}>{leaderboard[0].username}</h2>
                  <span className={`badge ${getBadgeClass(1)}`} style={{ marginTop: '8px' }}>
                    {leaderboard[0].player_class}
                  </span>
                  <span style={{ fontSize: '1.2rem', color: 'var(--warning)', fontWeight: 700, marginTop: '8px' }}>
                    {getScoreLabel(leaderboard[0])}
                  </span>
                </div>
              )}

              {/* Rank 3 */}
              {leaderboard[2] && (
                <div className="glass-panel podium-card rank-3">
                  <div className="podium-badge">3</div>
                  <div className="podium-avatar">🥉</div>
                  <h3 style={{ margin: '8px 0 0' }}>{leaderboard[2].username}</h3>
                  <span className={`badge ${getBadgeClass(3)}`} style={{ marginTop: '8px' }}>
                    {leaderboard[2].player_class}
                  </span>
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {getScoreLabel(leaderboard[2])}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Ranks 4+ table */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', color: '#fff' }}>Remaining Standings</h3>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', height: '40px' }}>
                    <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Rank</th>
                    <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Adventurer</th>
                    <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Class</th>
                    {activeTab === 'reputation' && <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Level</th>}
                    <th style={{ padding: '8px', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {activeTab === 'xp' ? 'Experience score' : activeTab === 'wealth' ? 'Gold Vault' : 'Reputation score'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(3).map((user, index) => (
                    <tr key={user.discord_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', height: '48px' }}>
                      <td style={{ padding: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>#{index + 4}</td>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#fff' }}>{user.username}</td>
                      <td style={{ padding: '8px' }}>
                        <span className="badge badge-common">{user.player_class}</span>
                      </td>
                      {activeTab === 'reputation' && (
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                          Level {user.level ?? 1}
                        </td>
                      )}
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: activeTab === 'wealth' ? 'var(--warning)' : '#fff' }}>
                        {getScoreLabel(user)}
                      </td>
                    </tr>
                  ))}
                  {leaderboard.length <= 3 && (
                    <tr>
                      <td colSpan={activeTab === 'reputation' ? 5 : 4} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                        No other competitors logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
