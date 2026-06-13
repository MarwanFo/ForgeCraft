import { useState, useEffect } from 'react';
import { Trash2, PlusCircle, AlertCircle, RefreshCw, Layers } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";
const GUILD_ID = "1116516121063993384"; // ForgeCraft default guild ID

interface AutoResponseRule {
  response_id: string;
  trigger_keyword: string;
  matching_rule: string;
  reply_content: string;
  is_embed: boolean;
  embed_template_id?: string;
  created_at: string;
}

interface EmbedTemplate {
  template_id: string;
  title?: string;
}

export default function AutoResponder() {
  const [rules, setRules] = useState<AutoResponseRule[]>([]);
  const [templates, setTemplates] = useState<EmbedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [triggerKeyword, setTriggerKeyword] = useState("");
  const [matchingRule, setMatchingRule] = useState("exact");
  const [replyContent, setReplyContent] = useState("");
  const [isEmbed, setIsEmbed] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch configured autoresponder rules
      const rulesRes = await fetch(`${API_BASE}/guilds/${GUILD_ID}/auto-responder`);
      let rulesData = [];
      if (rulesRes.ok) {
        rulesData = await rulesRes.json();
      }

      // 2. Fetch saved embed templates for selector dropdown
      const templatesRes = await fetch(`${API_BASE}/guilds/${GUILD_ID}/embed-templates`);
      let templatesData = [];
      if (templatesRes.ok) {
        templatesData = await templatesRes.json();
      }

      setRules(rulesData);
      setTemplates(templatesData);

      // Default selected template to the first one if available
      if (templatesData.length > 0) {
        setSelectedTemplateId(templatesData[0].template_id);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to synchronize auto-responder rules ledger from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerKeyword.trim()) {
      alert("Trigger keyword is required.");
      return;
    }
    if (!replyContent.trim() && (!isEmbed || !selectedTemplateId)) {
      alert("Please supply a text response or specify an embed template layout.");
      return;
    }

    setSaveLoading(true);
    try {
      const res = await fetch(`${API_BASE}/guilds/${GUILD_ID}/auto-responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_keyword: triggerKeyword.trim(),
          matching_rule: matchingRule,
          reply_content: replyContent.trim(),
          is_embed: isEmbed,
          embed_template_id: isEmbed ? selectedTemplateId : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to configure trigger rule.");

      alert("Trigger auto-response rule configured successfully!");
      setTriggerKeyword("");
      setReplyContent("");
      setIsEmbed(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Error creating auto-responder rule.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this auto-responder trigger rule?")) return;
    try {
      const res = await fetch(`${API_BASE}/guilds/${GUILD_ID}/auto-responder/${ruleId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert("Auto-response rule removed.");
        fetchData();
      } else {
        const data = await res.json();
        throw new Error(data.detail || "Deletion failed.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to remove rules trigger.");
    }
  };

  const getTemplateName = (tplId?: string) => {
    if (!tplId) return "None";
    const found = templates.find(t => t.template_id === tplId);
    return found ? found.title || "Untitled Embed" : "Unknown Template";
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Auto-Responder Manager</span>
          <Layers style={{ color: 'var(--primary)' }} size={28} />
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Set up automatic keyword-matching rules to make the bot reply with text strings or pre-saved embeds.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Rules Form Configurator */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: '1.25rem' }}>Create Trigger Rule</h3>
          
          <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Trigger Keyword</label>
              <input 
                type="text" 
                value={triggerKeyword} 
                onChange={(e) => setTriggerKeyword(e.target.value)} 
                placeholder="e.g. !help, rules, ip address" 
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Matching Rule Type</label>
              <select 
                value={matchingRule} 
                onChange={(e) => setMatchingRule(e.target.value)} 
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff' }}
              >
                <option value="exact" style={{ background: '#18181b' }}>Exact Match (matches keyword exactly)</option>
                <option value="contains" style={{ background: '#18181b' }}>Contains Keyword (matches keyword anywhere in message)</option>
                <option value="wildcard" style={{ background: '#18181b' }}>Wildcard matching (using * wildcards)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Text Reply Content</label>
              <textarea 
                rows={3}
                value={replyContent} 
                onChange={(e) => setReplyContent(e.target.value)} 
                placeholder="Standard text string content the bot replies with..." 
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff', fontSize: '0.9rem' }}>
                <input 
                  type="checkbox" 
                  checked={isEmbed} 
                  onChange={(e) => setIsEmbed(e.target.checked)} 
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>Attach saved Visual Embed card template</span>
              </label>

              {isEmbed && (
                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Select Embed Template</label>
                  {templates.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--error)' }}>
                      No templates configured. Please create and save embed layout templates first in the Embed Creator page.
                    </div>
                  ) : (
                    <select 
                      value={selectedTemplateId} 
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff' }}
                    >
                      {templates.map(tpl => (
                        <option key={tpl.template_id} value={tpl.template_id} style={{ background: '#18181b' }}>
                          {tpl.title || "Untitled Embed"}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={saveLoading || (isEmbed && templates.length === 0)} 
              className="btn-primary" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', marginTop: '8px' }}
            >
              {saveLoading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <>
                  <PlusCircle size={18} />
                  <span>Configure Auto-Response Rule</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Rules Ledger Overview */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: '1.25rem' }}>Active Auto-Response Rules</h3>
          
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : error ? (
            <div style={{ color: 'var(--error)', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          ) : rules.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
              No rules configured for this server. Use the builder on the left to add rules!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rules.map(rule => (
                <div 
                  key={rule.response_id} 
                  style={{ 
                    padding: '14px', 
                    background: 'rgba(255,255,255,0.02)', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    position: 'relative'
                  }}
                >
                  <button 
                    onClick={() => handleDeleteRule(rule.response_id)}
                    style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{rule.trigger_keyword}</span>
                    <span className="badge badge-uncommon" style={{ fontSize: '0.7rem' }}>
                      {rule.matching_rule.toUpperCase()}
                    </span>
                    {rule.is_embed && (
                      <span className="badge badge-rare" style={{ fontSize: '0.7rem' }}>
                        EMBED
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', wordBreak: 'break-word', paddingRight: '24px' }}>
                    {rule.reply_content ? (
                      <div><strong>Reply:</strong> &ldquo;{rule.reply_content}&rdquo;</div>
                    ) : (
                      <div style={{ fontStyle: 'italic' }}>No raw text body.</div>
                    )}

                    {rule.is_embed && (
                      <div style={{ marginTop: '4px', color: 'var(--primary-glow)' }}>
                        <strong>Embed:</strong> {getTemplateName(rule.embed_template_id)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
