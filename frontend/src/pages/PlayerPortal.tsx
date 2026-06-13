import { useState, useEffect, useRef } from 'react';
import { 
  Coins, 
  ShieldAlert, 
  Sparkles, 
  Calendar, 
  ListOrdered, 
  RefreshCw, 
  UserCheck
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

interface DashboardStats {
  discord_id: string;
  username: string;
  gold_balance: number;
  experience_points: number;
  level: number;
  next_level_xp: number;
  prev_level_xp: number;
  rank: number;
  reputation: number;
  player_class: string;
  custom_title: string;
}

interface Transaction {
  transaction_id: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function PlayerPortal() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Daily claim state
  const [claimLoading, setClaimLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const timerRef = useRef<any>(null);

  const fetchPortalData = async () => {
    // Attempt to read logged-in user from localStorage
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      setError("Please log in with Discord or Sandbox to access your player portal.");
      setLoading(false);
      return;
    }

    const userObj = JSON.parse(storedUser);
    const discordId = userObj.discord_id;

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch dashboard stats
      const statsRes = await fetch(`${API_BASE}/users/${discordId}/dashboard-stats`);
      if (!statsRes.ok) throw new Error("Failed to load player stats.");
      const statsData = await statsRes.json();
      setStats(statsData);

      // 2. Fetch transactions ledger
      const txRes = await fetch(`${API_BASE}/users/${discordId}/transactions`);
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }

      // 3. Initiate claim check (dry run claim check or retrieve cooldown)
      const claimCheckRes = await fetch(`${API_BASE}/users/${discordId}/daily-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Sending empty payload to check cooldown without claiming
      });
      if (claimCheckRes.ok) {
        const claimResult = await claimCheckRes.json();
        if (!claimResult.claimed && claimResult.cooldown_seconds) {
          setCooldownRemaining(claimResult.cooldown_seconds);
        } else {
          setCooldownRemaining(0);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to retrieve player portal details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Cooldown countdown clock scheduler
  useEffect(() => {
    if (cooldownRemaining > 0) {
      timerRef.current = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldownRemaining]);

  const handleDailyClaim = async () => {
    if (!stats) return;
    setClaimLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/${stats.discord_id}/daily-claim`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Failed to claim daily reward.");
      const data = await res.json();
      
      if (data.claimed) {
        alert(data.message);
        // Refresh local stats
        fetchPortalData();
      } else if (data.cooldown_seconds) {
        setCooldownRemaining(data.cooldown_seconds);
      }
    } catch (err: any) {
      alert(err.message || "Error claiming daily rewards.");
    } finally {
      setClaimLoading(false);
    }
  };

  const formatCooldown = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const calculateXpPercent = () => {
    if (!stats) return 0;
    const range = stats.next_level_xp - stats.prev_level_xp;
    if (range <= 0) return 0;
    const currentProgress = stats.experience_points - stats.prev_level_xp;
    return Math.min(Math.max((currentProgress / range) * 100, 0), 100);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw className="animate-spin" size={36} style={{ color: 'var(--primary)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Retrieving player coordinates...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: '24px', borderColor: 'var(--error)', background: 'rgba(239,68,68,0.05)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
        <ShieldAlert size={48} style={{ color: 'var(--error)' }} />
        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Adventurer Portal Restricted</h3>
        <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: '400px' }}>{error}</p>
        <button onClick={fetchPortalData} className="btn-primary" style={{ padding: '8px 16px' }}>
          Retry Load
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const xpPercent = calculateXpPercent();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Player Portal</span>
            <Sparkles style={{ color: 'var(--primary)' }} size={28} />
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Manage your statistics, daily claims, and credit transaction ledger.</p>
        </div>
        <button onClick={fetchPortalData} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' }}>
          <RefreshCw size={18} />
          <span>Refresh stats</span>
        </button>
      </div>

      {/* 2. Visual Profile Card Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Main Stats Card */}
        <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, padding: '12px', background: 'var(--primary-glow)', borderRadius: '0 0 0 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
            {stats.player_class}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--primary)', overflow: 'hidden' }}>
              <img 
                src={`https://cdn.discordapp.com/embed/avatars/0.png`} 
                alt="Avatar" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>{stats.username}</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--primary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                &ldquo;{stats.custom_title}&rdquo;
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Level:</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>⭐ Level {stats.level}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Global Rank:</span>
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>#{stats.rank}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Trust Reputation:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{stats.reputation} REP</span>
            </div>
          </div>
        </div>

        {/* Currency & Progression Card */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Coins style={{ color: 'var(--warning)' }} size={24} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Gold Vault Balance</span>
            </div>
            <h2 style={{ margin: 0, fontSize: '2.5rem', color: '#fff', fontWeight: 700 }}>
              {stats.gold_balance.toFixed(2)} <span style={{ fontSize: '1.2rem', color: 'var(--warning)' }}>Gold</span>
            </h2>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>XP Progress: {stats.experience_points} / {stats.next_level_xp} XP</span>
              <span style={{ color: 'var(--primary)' }}>{Math.round(xpPercent)}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${xpPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--primary-glow))', borderRadius: '4px' }}></div>
            </div>
          </div>
        </div>

        {/* Daily Claim Card */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Calendar style={{ color: 'var(--primary)' }} size={24} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Daily Gold Claim</span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Claim daily rewards to maintain your streak and receive up to 100.00 Gold!
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cooldownRemaining > 0 ? (
              <button disabled className="btn-primary" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', cursor: 'not-allowed' }}>
                Cooldown: {formatCooldown(cooldownRemaining)}
              </button>
            ) : (
              <button 
                onClick={handleDailyClaim} 
                disabled={claimLoading} 
                className="btn-primary" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {claimLoading ? (
                  <RefreshCw className="animate-spin" size={16} />
                ) : (
                  <>
                    <UserCheck size={18} />
                    <span>Claim Daily Gold</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 3. Transaction Ledger Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <ListOrdered style={{ color: 'var(--primary)' }} size={22} />
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Credit Transaction History</h3>
        </div>

        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            No transaction history found. Claim your daily rewards or adjust points to see records here.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>DATE / TIME</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>DESCRIPTION</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.transaction_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#fff', fontWeight: 500 }}>
                      {tx.description}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: tx.amount >= 0 ? 'var(--success)' : 'var(--error)' }}>
                      {tx.amount >= 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)} Gold
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
