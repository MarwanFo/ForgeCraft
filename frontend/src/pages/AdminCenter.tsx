import { useState, useEffect } from 'react';
import { 
  Shield, 
  Ticket as TicketIcon, 
  AlertTriangle, 
  Calendar, 
  User as UserIcon, 
  Clock, 
  CheckCircle, 
  RefreshCw,
  AlertCircle,
  Trash2,
  Sliders,
  UserCheck
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

interface Ticket {
  ticket_id: string;
  discord_id: string;
  channel_id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  username: string;
}

interface UserWarning {
  warning_id: string;
  discord_id: string;
  moderator_id: string;
  reason: string;
  issued_at: string;
  username: string;
}

export default function AdminCenter() {
  const [activeTab, setActiveTab] = useState<'tickets' | 'warnings' | 'players' | 'audit'>('tickets');
  const [openTickets, setOpenTickets] = useState<Ticket[]>([]);
  const [warnings, setWarnings] = useState<UserWarning[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Player Inspector state
  const [inspectId, setInspectId] = useState('');
  const [inspectedUser, setInspectedUser] = useState<any>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState('');

  // Form states
  const [formXp, setFormXp] = useState(0);
  const [formGold, setFormGold] = useState(0.0);
  const [formClass, setFormClass] = useState('Adventurer');
  const [formTitle, setFormTitle] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(false);
    try {
      // 1. Fetch Open Tickets
      const ticketsRes = await fetch(`${API_BASE}/tickets`);
      if (!ticketsRes.ok) throw new Error("Failed to load tickets.");
      const ticketsData = await ticketsRes.json();
      setOpenTickets(ticketsData);

      // 2. Fetch Moderation Logs (Warnings and All Tickets)
      const logsRes = await fetch(`${API_BASE}/moderation/logs`);
      if (!logsRes.ok) throw new Error("Failed to load moderation logs.");
      const logsData = await logsRes.json();
      setWarnings(logsData.warnings || []);
      setAllTickets(logsData.tickets || []);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Format timestamp helper
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Warning deletion handler
  const handleDeleteWarning = async (warningId: string) => {
    if (!window.confirm("Are you sure you want to delete this warning record?")) return;
    try {
      const res = await fetch(`${API_BASE}/warnings/${warningId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete warning.");
      alert("Warning deleted successfully.");
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Error deleting warning record from database.");
    }
  };

  // Player inspect loader
  const handleInspect = async (idToInspect?: string) => {
    const targetId = idToInspect || inspectId;
    if (!targetId) return;
    setInspectLoading(true);
    setInspectError('');
    setInspectedUser(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/users/${targetId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Player profile not found. Make sure they have interacted with the bot.");
        }
        throw new Error("Failed to fetch player profile.");
      }
      const data = await res.json();
      setInspectedUser(data.user);
      setFormXp(data.user.experience_points);
      setFormGold(data.user.gold_balance);
      setFormClass(data.user.player_class);
      setFormTitle(data.user.custom_title || '');
      if (idToInspect) {
        setInspectId(targetId);
      }
    } catch (err: any) {
      setInspectError(err.message || "An error occurred.");
    } finally {
      setInspectLoading(false);
    }
  };

  // Player update handler
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedUser) return;
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/users/${inspectedUser.discord_id}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          experience_points: Number(formXp),
          gold_balance: Number(formGold),
          player_class: formClass,
          custom_title: formTitle || null
        })
      });
      if (!res.ok) throw new Error("Failed to save changes.");
      setSaveSuccess(true);
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Failed to update user profile.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Compile a chronological ledger of all events (warnings and ticket operations)
  const compileAuditLedger = () => {
    const events: Array<{
      id: string;
      timestamp: Date;
      type: 'warning' | 'ticket_open' | 'ticket_close';
      title: string;
      description: string;
      user: string;
      meta?: string;
    }> = [];

    // Add Warnings
    warnings.forEach(w => {
      events.push({
        id: w.warning_id,
        timestamp: new Date(w.issued_at),
        type: 'warning',
        title: 'User Warned',
        description: `Reason: "${w.reason}"`,
        user: w.username,
        meta: `Moderator ID: ${w.moderator_id}`
      });
    });

    // Add Ticket Opens & Closes
    allTickets.forEach(t => {
      events.push({
        id: `${t.ticket_id}-open`,
        timestamp: new Date(t.created_at),
        type: 'ticket_open',
        title: 'Support Ticket Created',
        description: `Channel Name: "ticket-${t.username.toLowerCase()}"`,
        user: t.username
      });

      if (t.status === 'CLOSED' && t.closed_at) {
        events.push({
          id: `${t.ticket_id}-close`,
          timestamp: new Date(t.closed_at),
          type: 'ticket_close',
          title: 'Support Ticket Closed',
          description: `Channel ID: ${t.channel_id}`,
          user: t.username
        });
      }
    });

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const auditEvents = compileAuditLedger();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={36} className="brand-icon" style={{ color: 'var(--primary-glow)' }} />
            <span>Admin Center</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Monitor server moderation history, open support tickets, and system warnings.</p>
        </div>
        <button onClick={fetchAdminData} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} />
          <span>Refresh Records</span>
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '16px', borderColor: 'var(--error)', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={24} style={{ color: 'var(--error)' }} />
          <span>Failed to synchronize admin metrics with the API bridge.</span>
        </div>
      )}

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('tickets')}
          className={`btn-primary ${activeTab === 'tickets' ? 'active' : ''}`}
          style={{ 
            background: activeTab === 'tickets' ? 'var(--primary)' : 'transparent',
            borderColor: activeTab === 'tickets' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
            color: '#fff'
          }}
        >
          Tickets Pending ({openTickets.length})
        </button>
        <button 
          onClick={() => setActiveTab('warnings')}
          className={`btn-primary ${activeTab === 'warnings' ? 'active' : ''}`}
          style={{ 
            background: activeTab === 'warnings' ? 'var(--primary)' : 'transparent',
            borderColor: activeTab === 'warnings' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
            color: '#fff'
          }}
        >
          Warned Users ({warnings.length})
        </button>
        <button 
          onClick={() => setActiveTab('players')}
          className={`btn-primary ${activeTab === 'players' ? 'active' : ''}`}
          style={{ 
            background: activeTab === 'players' ? 'var(--primary)' : 'transparent',
            borderColor: activeTab === 'players' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
            color: '#fff'
          }}
        >
          Player Editor
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`btn-primary ${activeTab === 'audit' ? 'active' : ''}`}
          style={{ 
            background: activeTab === 'audit' ? 'var(--primary)' : 'transparent',
            borderColor: activeTab === 'audit' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
            color: '#fff'
          }}
        >
          Audit Ledger ({auditEvents.length})
        </button>
      </div>

      {loading && activeTab !== 'players' ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <RefreshCw size={36} className="brand-icon" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* 1. Support Tickets Tab */}
          {activeTab === 'tickets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Active Support Tickets</h2>
              {openTickets.length === 0 ? (
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 16px', display: 'block' }} />
                  <p style={{ margin: 0 }}>No open tickets. All player queries have been resolved!</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {openTickets.map(ticket => (
                    <div key={ticket.ticket_id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <TicketIcon size={20} style={{ color: 'var(--primary)' }} />
                          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>ticket-{ticket.username.toLowerCase()}</span>
                        </div>
                        <span className="badge badge-uncommon">OPEN</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span><strong>Owner Username:</strong> {ticket.username}</span>
                        <span><strong>Discord ID:</strong> <code>{ticket.discord_id}</code></span>
                        <span><strong>Channel ID:</strong> <code>{ticket.channel_id}</code></span>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        <span>Created: {formatDate(ticket.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Warnings Tab */}
          {activeTab === 'warnings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Issued User Warnings</h2>
              {warnings.length === 0 ? (
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 16px', display: 'block' }} />
                  <p style={{ margin: 0 }}>No warning logs recorded in the registry.</p>
                </div>
              ) : (
                <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
                        <th style={{ padding: '16px' }}>User</th>
                        <th style={{ padding: '16px' }}>Discord ID</th>
                        <th style={{ padding: '16px' }}>Warning Reason</th>
                        <th style={{ padding: '16px' }}>Issued Date</th>
                        <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warnings.map(w => (
                        <tr key={w.warning_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '16px', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <UserIcon size={16} style={{ color: 'var(--text-muted)' }} />
                              <span>{w.username}</span>
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}><code>{w.discord_id}</code></td>
                          <td style={{ padding: '16px', color: 'var(--warning)' }}>{w.reason}</td>
                          <td style={{ padding: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{formatDate(w.issued_at)}</td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button 
                                onClick={() => {
                                  setActiveTab('players');
                                  handleInspect(w.discord_id);
                                }}
                                className="btn-primary" 
                                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Sliders size={12} />
                                <span>Inspect</span>
                              </button>
                              <button 
                                onClick={() => handleDeleteWarning(w.warning_id)}
                                className="btn-primary" 
                                style={{ 
                                  padding: '6px 12px', 
                                  fontSize: '0.8rem', 
                                  background: 'rgba(239, 68, 68, 0.15)', 
                                  borderColor: 'rgba(239, 68, 68, 0.3)',
                                  color: '#ff4d4d',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Trash2 size={12} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. Player Attributes Editor Tab */}
          {activeTab === 'players' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={24} style={{ color: 'var(--primary)' }} />
                  <span>Inspect & Edit Player Profile</span>
                </h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="text" 
                    placeholder="Enter Player Discord ID..." 
                    value={inspectId}
                    onChange={(e) => setInspectId(e.target.value)}
                    style={{
                      flexGrow: 1,
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                      fontSize: '1rem'
                    }}
                  />
                  <button 
                    onClick={() => handleInspect()}
                    disabled={inspectLoading || !inspectId}
                    className="btn-primary"
                    style={{ padding: '0 24px' }}
                  >
                    {inspectLoading ? 'Searching...' : 'Inspect'}
                  </button>
                </div>

                {inspectError && (
                  <p style={{ color: 'var(--error)', margin: 0, fontSize: '0.9rem' }}>⚠️ {inspectError}</p>
                )}
              </div>

              {inspectedUser && (
                <form onSubmit={handleSaveUser} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                    Modify Profile: <span style={{ color: 'var(--primary-glow)' }}>{inspectedUser.username}</span>
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Experience Points (XP)</label>
                      <input 
                        type="number" 
                        value={formXp}
                        onChange={(e) => setFormXp(Number(e.target.value))}
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          color: '#fff'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Gold Balance</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={formGold}
                        onChange={(e) => setFormGold(Number(e.target.value))}
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          color: '#fff'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Player Class</label>
                      <select 
                        value={formClass}
                        onChange={(e) => setFormClass(e.target.value)}
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(25,25,25,0.95)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Adventurer">Adventurer</option>
                        <option value="Warrior">Warrior</option>
                        <option value="Mage">Mage</option>
                        <option value="Rogue">Rogue</option>
                        <option value="Cleric">Cleric</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Custom Profile Title</label>
                      <input 
                        type="text" 
                        placeholder="No custom title" 
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          color: '#fff'
                        }}
                      />
                    </div>
                  </div>

                  {saveSuccess && (
                    <p style={{ color: 'var(--success)', margin: 0, fontSize: '0.9rem' }}>✅ Changes saved and synchronized successfully!</p>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button 
                      type="submit" 
                      disabled={saveLoading}
                      className="btn-primary"
                      style={{ padding: '12px 32px' }}
                    >
                      {saveLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setInspectedUser(null)}
                      className="btn-primary"
                      style={{ padding: '12px 24px', background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 4. Audit Log Ledger Tab */}
          {activeTab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Chronological Audit Ledger</h2>
              {auditEvents.length === 0 ? (
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0 }}>No activities logged in the audit ledger.</p>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {auditEvents.map((event, index) => {
                    const isLast = index === auditEvents.length - 1;
                    return (
                      <div key={event.id} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                        {/* Timeline Connector Line */}
                        {!isLast && (
                          <div style={{ 
                            position: 'absolute', 
                            left: '11px', 
                            top: '24px', 
                            bottom: '-20px', 
                            width: '2px', 
                            background: 'rgba(255,255,255,0.06)' 
                          }}></div>
                        )}

                        {/* Event Icon Block */}
                        <div style={{ 
                          width: '24px', 
                          height: '24px', 
                          borderRadius: '50%', 
                          background: event.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 
                                     event.type === 'ticket_open' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${
                            event.type === 'warning' ? 'var(--warning)' : 
                            event.type === 'ticket_open' ? 'var(--success)' : 'var(--error)'
                          }`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          zIndex: 1
                        }}>
                          {event.type === 'warning' && <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />}
                          {event.type === 'ticket_open' && <TicketIcon size={12} style={{ color: 'var(--success)' }} />}
                          {event.type === 'ticket_close' && <Clock size={12} style={{ color: 'var(--error)' }} />}
                        </div>

                        {/* Event Content Description */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontWeight: 600, color: '#fff' }}>{event.title}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(event.timestamp.toISOString())}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            {event.description}
                          </p>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <span><strong>Target Adventurer:</strong> {event.user}</span>
                            {event.meta && <span>| {event.meta}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
