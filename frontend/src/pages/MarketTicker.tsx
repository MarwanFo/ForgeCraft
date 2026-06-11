import { useState, useEffect, Fragment } from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const API_BASE = "http://localhost:8000/api";

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
  data[6].Price = currentPrice;
  return data;
};

export default function MarketTicker() {
  const [market, setMarket] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const fetchMarket = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/market`);
      if (!res.ok) throw new Error("Failed to fetch market data.");
      const data = await res.json();
      setMarket(data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarket();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>Market Ticker</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Dynamically calculated exchange values based on total supply and demand activity.</p>
        </div>
        <button onClick={fetchMarket} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} />
          <span>Refresh Prices</span>
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '16px', borderColor: 'var(--error)', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={24} style={{ color: 'var(--error)' }} />
          <span>Failed to synchronize live market data with backend API.</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <RefreshCw size={36} className="brand-icon" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
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
                  const isSelected = selectedItemId === c.item_id;
                  const rarityClass = `badge-${c.rarity.toLowerCase()}`;
                  const isUp = c.demand_multiplier >= 1.0;
                  
                  return (
                    <Fragment key={c.item_id}>
                      <tr 
                        style={{ cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                        onClick={() => setSelectedItemId(isSelected ? null : c.item_id)}
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
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
