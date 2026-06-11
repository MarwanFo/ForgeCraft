import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Search } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

interface Chronicle {
  event_id: string;
  event_type: string;
  raw_trigger_summary: string;
  generated_lore: string;
  recorded_at: string;
}

export default function ChroniclePage() {
  const [chronicles, setChronicles] = useState<Chronicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const fetchChronicles = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/chronicles`);
      if (!res.ok) throw new Error("Failed to fetch chronicles.");
      const data = await res.json();
      setChronicles(data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChronicles();
  }, []);

  const filtered = chronicles.filter(ch => 
    ch.generated_lore.toLowerCase().includes(filterQuery.toLowerCase()) ||
    ch.event_type.toLowerCase().includes(filterQuery.toLowerCase()) ||
    ch.raw_trigger_summary.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>Lore Chronicles</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Chronological feed of RPG world events generated in response to high-intensity chat dynamics.</p>
        </div>
        <button onClick={fetchChronicles} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} />
          <span>Sync Chronicle</span>
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Search size={20} style={{ color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Filter chronicles by theme, keyword, or summary context..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="search-input"
          style={{ border: 'none', background: 'transparent', margin: 0, padding: 0 }}
        />
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '16px', borderColor: 'var(--error)', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={24} style={{ color: 'var(--error)' }} />
          <span>Failed to sync lore ledger files.</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <RefreshCw size={36} className="brand-icon" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div className="timeline">
          {filtered.map((ch) => (
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
          {filtered.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>No chronicles matched your search keyword.</p>
          )}
        </div>
      )}
    </div>
  );
}
