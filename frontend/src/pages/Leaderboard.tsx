import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

interface User {
  discord_id: string;
  username: string;
  experience_points: number;
  player_class: string;
  gold_balance: number;
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/leaderboard`);
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
    fetchLeaderboard();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>Adventurer Leaderboard</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Ranking logs of top users based on chat experience points and progression.</p>
        </div>
        <button onClick={fetchLeaderboard} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} />
          <span>Refresh Standings</span>
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
          <RefreshCw size={36} className="brand-icon" style={{ animation: 'spin 1s linear infinite' }} />
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
                  <div className="podium-avatar">👤</div>
                  <h3 style={{ margin: '8px 0 0' }}>{leaderboard[1].username}</h3>
                  <span className="badge badge-uncommon" style={{ marginTop: '8px' }}>{leaderboard[1].player_class}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>XP: {leaderboard[1].experience_points}</span>
                </div>
              )}
              
              {/* Rank 1 */}
              {leaderboard[0] && (
                <div className="glass-panel podium-card rank-1">
                  <div className="podium-badge">1</div>
                  <div className="podium-avatar" style={{ fontSize: '2rem' }}>👑</div>
                  <h2 style={{ margin: '8px 0 0' }}>{leaderboard[0].username}</h2>
                  <span className="badge badge-legendary" style={{ marginTop: '8px' }}>{leaderboard[0].player_class}</span>
                  <span style={{ fontSize: '1rem', color: 'var(--warning)', fontWeight: 600, marginTop: '8px' }}>XP: {leaderboard[0].experience_points}</span>
                </div>
              )}

              {/* Rank 3 */}
              {leaderboard[2] && (
                <div className="glass-panel podium-card rank-3">
                  <div className="podium-badge">3</div>
                  <div className="podium-avatar">👤</div>
                  <h3 style={{ margin: '8px 0 0' }}>{leaderboard[2].username}</h3>
                  <span className="badge badge-rare" style={{ marginTop: '8px' }}>{leaderboard[2].player_class}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>XP: {leaderboard[2].experience_points}</span>
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
        </>
      )}
    </div>
  );
}
