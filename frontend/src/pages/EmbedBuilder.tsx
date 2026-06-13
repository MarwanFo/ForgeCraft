import { useState, useEffect } from 'react';
import { Sparkles, Trash2, Save, RefreshCw } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";
const GUILD_ID = "1116516121063993384"; // Default ForgeCraft Guild

interface EmbedTemplate {
  template_id: string;
  title?: string;
  description?: string;
  color_hex?: string;
  thumbnail_url?: string;
  image_url?: string;
  author_name?: string;
  footer_text?: string;
}

export default function EmbedBuilder() {
  const [templates, setTemplates] = useState<EmbedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  // Form states
  const [authorName, setAuthorName] = useState("");
  const [title, setTitle] = useState("ForgeCraft System Alert");
  const [description, setDescription] = useState("Greetings, adventurer! We have detected a rift in the temporal space surrounding the Forge. Prepare your weapons.");
  const [colorHex, setColorHex] = useState("#5865f2"); // Default Discord Blurple
  const [thumbnailUrl, setThumbnailUrl] = useState("https://cdn.discordapp.com/embed/avatars/1.png");
  const [imageUrl, setImageUrl] = useState("");
  const [footerText, setFooterText] = useState("ForgeCraft Bot Console • Automated Broadcast");

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/guilds/${GUILD_ID}/embed-templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title && !description) {
      alert("Embed must contain at least a Title or a Description.");
      return;
    }

    setSaveLoading(true);
    try {
      const res = await fetch(`${API_BASE}/guilds/${GUILD_ID}/embed-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          description: description || null,
          color_hex: colorHex || "#5865F2",
          thumbnail_url: thumbnailUrl || null,
          image_url: imageUrl || null,
          author_name: authorName || null,
          footer_text: footerText || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save template.");

      alert("Embed layout template saved successfully!");
      // Reset form options selectively
      fetchTemplates();
    } catch (err: any) {
      alert(err.message || "Error saving embed template.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this embed template?")) return;
    try {
      const res = await fetch(`${API_BASE}/guilds/${GUILD_ID}/embed-templates/${templateId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert("Template deleted.");
        fetchTemplates();
      } else {
        const data = await res.json();
        throw new Error(data.detail || "Deletion failed.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete template.");
    }
  };

  const loadTemplateIntoBuilder = (tpl: EmbedTemplate) => {
    setAuthorName(tpl.author_name || "");
    setTitle(tpl.title || "");
    setDescription(tpl.description || "");
    setColorHex(tpl.color_hex || "#5865f2");
    setThumbnailUrl(tpl.thumbnail_url || "");
    setImageUrl(tpl.image_url || "");
    setFooterText(tpl.footer_text || "");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Embed Creator</span>
          <Sparkles style={{ color: 'var(--primary)' }} size={28} />
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Build, preview, and save rich card embed templates to use for server notifications and auto-responders.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Form Editor */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: '1.25rem' }}>Embed Configuration</h3>
          
          <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Author Name</label>
                <input 
                  type="text" 
                  value={authorName} 
                  onChange={(e) => setAuthorName(e.target.value)} 
                  placeholder="e.g. System Announcement" 
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Border Color</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="color" 
                    value={colorHex} 
                    onChange={(e) => setColorHex(e.target.value)}
                    style={{ width: '42px', height: '42px', border: 'none', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                  />
                  <input 
                    type="text" 
                    value={colorHex} 
                    onChange={(e) => setColorHex(e.target.value)}
                    placeholder="#5865F2" 
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Embed Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Required if description is empty" 
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Embed Description</label>
              <textarea 
                rows={4}
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Markdown and linebreaks supported" 
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Thumbnail Image URL</label>
                <input 
                  type="text" 
                  value={thumbnailUrl} 
                  onChange={(e) => setThumbnailUrl(e.target.value)} 
                  placeholder="https://..." 
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Main Banner Image URL</label>
                <input 
                  type="text" 
                  value={imageUrl} 
                  onChange={(e) => setImageUrl(e.target.value)} 
                  placeholder="https://..." 
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Footer Text</label>
              <input 
                type="text" 
                value={footerText} 
                onChange={(e) => setFooterText(e.target.value)} 
                placeholder="Small text at bottom of embed" 
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff' }}
              />
            </div>

            <button 
              type="submit" 
              disabled={saveLoading} 
              className="btn-primary" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
            >
              {saveLoading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <>
                  <Save size={18} />
                  <span>Save Embed Template</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Preview Side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '20px' }}>
          
          {/* Discord Card Mock */}
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
              Discord UI Visual Mockup
            </span>
            <div style={{ background: '#313338', borderRadius: '8px', padding: '16px', fontFamily: '"gg sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              
              {/* Bot Header */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  F
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#f2f3f5', fontWeight: 600, fontSize: '0.95rem' }}>ForgeCraft Bot</span>
                    <span style={{ background: '#5865f2', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 4px', borderRadius: '3px', textTransform: 'uppercase' }}>BOT</span>
                    <span style={{ color: '#949ba4', fontSize: '0.75rem' }}>Today at 9:42 PM</span>
                  </div>
                  <span style={{ color: '#dbdee1', fontSize: '0.9rem', marginTop: '4px', display: 'block' }}>Here is the triggered announcement:</span>
                </div>
              </div>

              {/* Visual Embed Box */}
              <div 
                style={{ 
                  marginLeft: '52px',
                  background: '#2b2d31', 
                  borderRadius: '4px', 
                  borderLeft: `4px solid ${colorHex || '#1e1f22'}`, 
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '12px',
                  maxWidth: '520px'
                }}
              >
                <div>
                  {/* Author */}
                  {authorName && (
                    <div style={{ color: '#f2f3f5', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                      {authorName}
                    </div>
                  )}

                  {/* Title */}
                  {title && (
                    <h3 style={{ color: '#00a8fc', margin: '0 0 8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
                      {title}
                    </h3>
                  )}

                  {/* Description */}
                  {description && (
                    <div style={{ color: '#dbdee1', fontSize: '0.875rem', lineHeight: '1.375', whiteSpace: 'pre-wrap' }}>
                      {description}
                    </div>
                  )}

                  {/* Main Banner Image */}
                  {imageUrl && (
                    <div style={{ marginTop: '12px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', maxWidth: '400px' }}>
                      <img src={imageUrl} alt="Embed Visual Banner" style={{ width: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as any).style.display = 'none'; }} />
                    </div>
                  )}

                  {/* Footer */}
                  {footerText && (
                    <div style={{ color: '#949ba4', fontSize: '0.75rem', marginTop: '12px' }}>
                      {footerText}
                    </div>
                  )}
                </div>

                {/* Thumbnail Image */}
                {thumbnailUrl && (
                  <div style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <img src={thumbnailUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as any).style.display = 'none'; }} />
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Saved Templates List */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#fff', fontSize: '1.1rem' }}>Saved Templates</h4>
            
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
              </div>
            ) : templates.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No custom templates saved yet. Create one above!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {templates.map(tpl => (
                  <div 
                    key={tpl.template_id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '10px 12px', 
                      background: 'rgba(255,255,255,0.02)', 
                      borderRadius: '6px', 
                      border: '1px solid rgba(255,255,255,0.04)',
                      gap: '12px'
                    }}
                  >
                    <div 
                      onClick={() => loadTemplateIntoBuilder(tpl)}
                      style={{ cursor: 'pointer', flex: 1 }}
                    >
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{tpl.title || "Untitled Embed"}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                        {tpl.description || "No description body."}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteTemplate(tpl.template_id)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
