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
  AlertCircle
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
  const [activeTab, setActiveTab] = useState<'tickets' | 'warnings' | 'audit'>('tickets');
  const [openTickets, setOpenTickets] = useState<Ticket[]>([]);
  const [warnings, setWarnings] = useState<UserWarning[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

    // Sort descending by date
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
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
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

      {loading ? (
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
                        <th style={{ padding: '16px' }}>User</th>
                        <th style={{ padding: '16px' }}>Discord ID</th>
                        <th style={{ padding: '16px' }}>Warning Reason</th>
                        <th style={{ padding: '16px' }}>Issued Date</th>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. Audit Log Ledger Tab */}
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
