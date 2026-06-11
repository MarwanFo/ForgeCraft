import { useState, useEffect } from 'react';
import { Trophy, Package, BookOpen, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

interface User {
  discord_id: string;
  username: string;
  experience_points: number;
  player_class: string;
  gold_balance: number;
}

interface Commodity {
  commodity_id: number;
}

interface Chronicle {
  event_id: string;
  event_type: string;
  raw_trigger_summary: string;
  generated_lore: string;
  recorded_at: string;
}

export default function DashboardOverview() {
  const [users, setUsers] = useState<User[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [chronicles, setChronicles] = useState<Chronicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError(false);
    try {
      const [marketRes, leaderboardRes, chroniclesRes] = await Promise.all([
        fetch(`${API_BASE}/market`).then(res => res.json()),
        fetch(`${API_BASE}/leaderboard`).then(res => res.json()),
        fetch(`${API_BASE}/chronicles`).then(res => res.json())
      ]);

      setCommodities(marketRes);
      setUsers(leaderboardRes);
      setChronicles(chroniclesRes);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>Guild Hall Overview</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Real-time summaries of community activity, currency balances, and market supply pools.</p>
        </div>
        <button onClick={fetchStats} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} />
          <span>Sync Status</span>
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '16px', borderColor: 'var(--error)', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={24} style={{ color: 'var(--error)' }} />
          <span>Failed to synchronize overview statistics.</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <RefreshCw size={36} className="brand-icon" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="glass-panel stat-card">
              <div className="stat-info">
                <span className="stat-title">Active Adventurers</span>
                <span className="stat-value">{users.length}</span>
              </div>
              <div className="stat-icon-wrapper">
                <Trophy size={24} style={{ color: 'var(--primary)' }} />
              </div>
            </div>

            <div className="glass-panel stat-card">
              <div className="stat-info">
                <span className="stat-title">Market Commodities</span>
                <span className="stat-value">{commodities.length}</span>
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
        </>
      )}
    </div>
  );
}
