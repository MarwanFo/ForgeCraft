import { useState, useEffect } from 'react';
import { Sparkles, Save, RefreshCw, Eye } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";
const GUILD_ID = "1116516121063993384"; // ForgeCraft Default Guild

export default function WelcomeDesigner() {
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Settings states
  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [welcomeText, setWelcomeText] = useState("Welcome [user] to the Forge! Prepare your anvil.");
  const [avatarShape, setAvatarShape] = useState("circle");
  const [avatarSize, setAvatarSize] = useState(128);
  const [avatarX, setAvatarX] = useState(50);
  const [avatarY, setAvatarY] = useState(50);
  const [usernameX, setUsernameX] = useState(50);
  const [usernameY, setUsernameY] = useState(200);
  const [backgroundUrl, setBackgroundUrl] = useState("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/guilds/${GUILD_ID}/welcome`);
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
        setChannelId(data.channel_id);
        setWelcomeText(data.welcome_text);
        setAvatarShape(data.avatar_shape);
        setAvatarSize(data.avatar_size);
        setAvatarX(data.avatar_x);
        setAvatarY(data.avatar_y);
        setUsernameX(data.username_x);
        setUsernameY(data.username_y);
        setBackgroundUrl(data.background_url);
      }
    } catch (err) {
      console.error("Failed to load welcome settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/welcome/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: "Marwan",
          avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
          avatar_shape: avatarShape,
          avatar_size: avatarSize,
          avatar_x: avatarX,
          avatar_y: avatarY,
          username_x: usernameX,
          username_y: usernameY,
          background_url: backgroundUrl || null
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error("Failed to fetch image preview:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Fetch preview on settings load or when coordinates settle
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        fetchPreview();
      }, 500); // Debounce preview generation
      return () => clearTimeout(timer);
    }
  }, [loading, avatarShape, avatarSize, avatarX, avatarY, usernameX, usernameY, backgroundUrl]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const res = await fetch(`${API_BASE}/guilds/${GUILD_ID}/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          channel_id: channelId || null,
          welcome_text: welcomeText,
          avatar_shape: avatarShape,
          avatar_size: avatarSize,
          avatar_x: avatarX,
          avatar_y: avatarY,
          username_x: usernameX,
          username_y: usernameY,
          background_url: backgroundUrl || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save settings.");

      alert("Welcome settings saved successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to save settings.");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Welcoming Canvas Designer</span>
          <Sparkles style={{ color: 'var(--primary)' }} size={28} />
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Create customized graphic welcoming cards. Configure text overlays, shape masks, and background files.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <RefreshCw size={48} className="animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Form controls */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: '1.25rem' }}>Configuration Controls</h3>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff' }}>
                  <input 
                    type="checkbox" 
                    checked={enabled} 
                    onChange={(e) => setEnabled(e.target.checked)} 
                    style={{ width: '18px', height: '18px' }}
                  />
                  <strong>Enable Welcomer Banners</strong>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Welcome Message Text</label>
                <textarea 
                  rows={2}
                  value={welcomeText} 
                  onChange={(e) => setWelcomeText(e.target.value)} 
                  placeholder="Welcome [user] to [server]!"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff', fontSize: '0.9rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Variables: <code>[user]</code> pings the user, <code>[server]</code> prints guild name.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Channel ID</label>
                  <input 
                    type="text" 
                    value={channelId} 
                    onChange={(e) => setChannelId(e.target.value)} 
                    placeholder="e.g. 1116516121063993384"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Avatar Mask Shape</label>
                  <select 
                    value={avatarShape} 
                    onChange={(e) => setAvatarShape(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff' }}
                  >
                    <option value="circle" style={{ background: '#18181b' }}>Circle Mask</option>
                    <option value="square" style={{ background: '#18181b' }}>Square Block</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Background Canvas Image URL</label>
                <input 
                  type="text" 
                  value={backgroundUrl} 
                  onChange={(e) => setBackgroundUrl(e.target.value)} 
                  placeholder="https://images.unsplash.com/..."
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              {/* Sliders Panel */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: '0 0 4px', color: '#fff', fontSize: '0.95rem' }}>Coordinate & Sizing Offsets</h4>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Avatar Size (px)</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{avatarSize}px</span>
                  </div>
                  <input 
                    type="range" min={32} max={256} step={2}
                    value={avatarSize} onChange={(e) => setAvatarSize(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <span>Avatar X Offset</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{avatarX}px</span>
                    </div>
                    <input 
                      type="range" min={0} max={800} step={5}
                      value={avatarX} onChange={(e) => setAvatarX(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <span>Avatar Y Offset</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{avatarY}px</span>
                    </div>
                    <input 
                      type="range" min={0} max={400} step={5}
                      value={avatarY} onChange={(e) => setAvatarY(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <span>Username X Offset</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{usernameX}px</span>
                    </div>
                    <input 
                      type="range" min={0} max={800} step={5}
                      value={usernameX} onChange={(e) => setUsernameX(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <span>Username Y Offset</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{usernameY}px</span>
                    </div>
                    <input 
                      type="range" min={0} max={400} step={5}
                      value={usernameY} onChange={(e) => setUsernameY(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={saveLoading} 
                className="btn-primary" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', marginTop: '8px' }}
              >
                {saveLoading ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    <span>Save Canvas Settings</span>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Right Visual Sandbox Display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Live Canvas Server Output (800 x 400)
              </span>
              <button 
                onClick={fetchPreview} 
                disabled={previewLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '4px 10px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {previewLoading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <>
                    <Eye size={14} />
                    <span>Force Redraw</span>
                  </>
                )}
              </button>
            </div>

            {/* Pillow Image Frame */}
            <div style={{ background: '#0e0e11', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', width: '100%', aspectRatio: '2/1' }}>
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Pillow Welcomer Card Preview" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '8px' }}>
                  <RefreshCw size={24} className="animate-spin" />
                  <span style={{ fontSize: '0.85rem' }}>Awaiting Pillow engine output...</span>
                </div>
              )}

              {/* Grid overlay helpers to assist alignment */}
              <div style={{ position: 'absolute', inset: 0, border: '1px dashed rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
            </div>

            {/* Helpful Guide info */}
            <div className="glass-panel" style={{ padding: '16px', background: 'rgba(14, 165, 233, 0.03)', borderColor: 'rgba(14, 165, 233, 0.1)' }}>
              <h5 style={{ margin: '0 0 6px', color: 'var(--primary-glow)', fontSize: '0.9rem' }}>Canvas Designer Guide</h5>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                <li>Coordinate space is exactly <strong>800px width</strong> by <strong>400px height</strong>.</li>
                <li>Ensure custom background graphics are scaled to matches the aspect ratio.</li>
                <li>Changes made to coordinate sliders will live-render via backend Pillow image builders.</li>
              </ul>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
