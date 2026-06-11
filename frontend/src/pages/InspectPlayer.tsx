import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

interface User {
  discord_id: string;
  username: string;
  experience_points: number;
  player_class: string;
  gold_balance: number;
  created_at: string;
  last_active_at: string;
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

export default function InspectPlayer() {
  const [searchId, setSearchId] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setSearching(true);
    setError('');
    setProfile(null);
    try {
      const res = await fetch(`${API_BASE}/users/${searchId.trim()}`);
      if (res.status === 404) {
        setError("No player registered under this Discord ID.");
      } else if (!res.ok) {
        setError("Error fetching player database record.");
      } else {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      setError("Server connection failure.");
    } finally {
      setSearching(false);
    }
  };

  return (
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
          <button type="submit" className="btn-primary" disabled={searching}>
            {searching ? 'Querying...' : 'Search Registry'}
          </button>
        </form>

        {error && (
          <div style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', marginTop: '16px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {profile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '24px', textAlign: 'left' }}>
            {/* User Details */}
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="podium-avatar" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>🛡️</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ margin: 0 }}>{profile.user.username}</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Discord ID: {profile.user.discord_id}</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <span className="badge badge-legendary">{profile.user.player_class}</span>
                  <span className="badge badge-uncommon">Level {Math.floor(Math.sqrt(profile.user.experience_points / 100)) + 1}</span>
                </div>
              </div>
            </div>

            <div className="stat-grid">
              <div className="glass-panel stat-card" style={{ padding: '16px' }}>
                <div className="stat-info">
                  <span className="stat-title">Wallet Balance</span>
                  <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--warning)' }}>🪙 {profile.user.gold_balance.toFixed(2)} Gold</span>
                </div>
              </div>

              <div className="glass-panel stat-card" style={{ padding: '16px' }}>
                <div className="stat-info">
                  <span className="stat-title">Backpack Space</span>
                  <span className="stat-value" style={{ fontSize: '1.5rem' }}>
                    {profile.inventory.reduce((acc, curr) => acc + curr.quantity, 0)} items
                  </span>
                </div>
              </div>

              <div className="glass-panel stat-card" style={{ padding: '16px' }}>
                <div className="stat-info">
                  <span className="stat-title">Total Experience</span>
                  <span className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{profile.user.experience_points} XP</span>
                </div>
              </div>
            </div>

            {/* Inventory Slot Details */}
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
                    {profile.inventory.map(slot => (
                      <tr key={slot.item_id}>
                        <td style={{ fontWeight: 600 }}>{slot.name}</td>
                        <td><span className={`badge badge-${slot.rarity.toLowerCase()}`}>{slot.rarity}</span></td>
                        <td>{slot.quantity} units</td>
                        <td>🪙 {slot.base_value.toFixed(2)} Gold</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{slot.description}</td>
                      </tr>
                    ))}
                    {profile.inventory.length === 0 && (
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
  );
}
