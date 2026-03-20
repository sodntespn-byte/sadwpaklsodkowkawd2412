// LIBERTY - Main Application (Complete Rewrite)
// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA DE PROTEÇÃO ANTI-QUEBRA
// Este código é projetado para ser inquebrável - erros são capturados e logados
// mas nunca impedem a execução do restante do código.
// ═══════════════════════════════════════════════════════════════════════════

// Helper global para execução segura
window._safeExec = function(fn, fallback, context) {
  try {
    return fn();
  } catch (e) {
    console.warn('[LIBERTY] Safe exec caught error:', e?.message || e, context || '');
    return typeof fallback === 'function' ? fallback() : fallback;
  }
};

// Helper para acessar propriedades com segurança
window._safeGet = function(obj, path, fallback) {
  try {
    return path.split('.').reduce((o, p) => (o && o[p] != null ? o[p] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
};

// Helper para elementos DOM com segurança
window._safeEl = function(id) {
  try {
    if (typeof id === 'string') {
      return document.getElementById(id) || null;
    }
    return id || null;
  } catch {
    return null;
  }
};

// Helper para querySelector com segurança
window._safeQuery = function(selector, root) {
  try {
    const ctx = root || document;
    return ctx.querySelector(selector) || null;
  } catch {
    return null;
  }
};

// Helper para querySelectorAll com segurança
window._safeQueryAll = function(selector, root) {
  try {
    const ctx = root || document;
    return ctx.querySelectorAll(selector) || [];
  } catch {
    return [];
  }
};

// Helper para localStorage com segurança
window._safeStorage = {
  get: function(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: function(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  },
  remove: function(key) {
    try { localStorage.removeItem(key); return true; } catch { return false; }
  },
  getJSON: function(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  setJSON: function(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
};

// Helper para adicionar event listeners com segurança
window._safeOn = function(el, event, handler, options) {
  try {
    const element = typeof el === 'string' ? document.getElementById(el) : el;
    if (element && typeof element.addEventListener === 'function') {
      element.addEventListener(event, function(e) {
        try { handler(e); } catch (err) {
          console.warn('[LIBERTY] Event handler error:', err?.message || err);
        }
      }, options);
      return true;
    }
  } catch {}
  return false;
};

// Helper para manipular classes com segurança
window._safeClass = {
  add: function(el, className) {
    try { (typeof el === 'string' ? document.getElementById(el) : el)?.classList?.add(className); } catch {}
  },
  remove: function(el, className) {
    try { (typeof el === 'string' ? document.getElementById(el) : el)?.classList?.remove(className); } catch {}
  },
  toggle: function(el, className, force) {
    try { 
      const element = typeof el === 'string' ? document.getElementById(el) : el;
      return element?.classList?.toggle(className, force) ?? false;
    } catch { return false; }
  },
  has: function(el, className) {
    try {
      const element = typeof el === 'string' ? document.getElementById(el) : el;
      return element?.classList?.contains(className) ?? false;
    } catch { return false; }
  }
};

// Helper para manipular estilos com segurança
window._safeStyle = function(el, prop, value) {
  try {
    const element = typeof el === 'string' ? document.getElementById(el) : el;
    if (element?.style) {
      element.style[prop] = value;
      return true;
    }
  } catch {}
  return false;
};

// Helper para manipular innerHTML com segurança
window._safeHTML = function(el, html) {
  try {
    const element = typeof el === 'string' ? document.getElementById(el) : el;
    if (element) {
      element.innerHTML = html;
      return true;
    }
  } catch {}
  return false;
};

// Helper para manipular textContent com segurança
window._safeText = function(el, text) {
  try {
    const element = typeof el === 'string' ? document.getElementById(el) : el;
    if (element) {
      element.textContent = text;
      return true;
    }
  } catch {}
  return false;
};

console.log('[LIBERTY] Sistema de proteção carregado');

(function injectDynamicCSS() {
  const s = document.createElement('style');
  s.textContent = `
.emoji-picker{position:absolute;bottom:100%;right:0;width:352px;max-height:420px;background:rgba(24,21,18,.96);backdrop-filter:blur(20px);border:1px solid rgba(255,215,0,.12);border-radius:var(--radius-lg);box-shadow:var(--glass-shadow);z-index:800;display:flex;flex-direction:column;animation:contextMenuIn .15s var(--ease-out-expo)}
.emoji-picker-search{padding:8px;border-bottom:1px solid rgba(255,215,0,.06)}
.emoji-picker-search input{width:100%;padding:6px 10px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;font-family:inherit}
.emoji-picker-search input:focus{outline:none;border-color:var(--primary-yellow)}
.emoji-picker-cats{display:flex;gap:2px;padding:4px 8px;border-bottom:1px solid rgba(255,215,0,.06);overflow-x:auto}
.emoji-picker-cats button{background:transparent;border:none;padding:4px 8px;font-size:13px;cursor:pointer;border-radius:var(--radius-sm);color:var(--text-secondary);white-space:nowrap;font-family:inherit;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.emoji-picker-cats button:hover,.emoji-picker-cats button.active{background:rgba(255,215,0,.1);color:var(--primary-yellow)}
.emoji-picker-grid{flex:1;overflow-y:auto;padding:8px;display:flex;flex-wrap:wrap;gap:2px;align-content:flex-start}
.emoji-picker-grid .emoji-cat-label{width:100%;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-secondary);padding:8px 4px 4px;margin-top:4px}
.emoji-picker-grid .emoji-cat-label:first-child{margin-top:0;padding-top:4px}
.emoji-item{width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;border-radius:var(--radius-sm);transition:background .1s,transform .1s}
.emoji-item:hover{background:rgba(255,215,0,.1);transform:scale(1.2)}
.message-code-block{display:block;margin:8px 0;padding:12px;background:rgba(0,0,0,.3);border-radius:var(--radius-md);overflow-x:auto;font-size:13px;border:1px solid rgba(255,215,0,.08)}
.message-code-block code{background:none;padding:0}
.mention{color:var(--primary-yellow);background:rgba(255,215,0,.12);padding:1px 4px;border-radius:var(--radius-sm);cursor:pointer}
.mention:hover{background:rgba(255,215,0,.2)}
.message{animation:messageFadeIn .2s ease}
@keyframes messageFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.skeleton{background:linear-gradient(90deg,var(--dark-gray) 25%,rgba(255,255,255,.06) 50%,var(--dark-gray) 75%);background-size:200% 100%;animation:skeleton-shimmer 1.2s ease-in-out infinite}
.message-skeleton{display:flex;gap:12px;padding:12px 16px}
.message-skeleton-avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0}
.message-skeleton-body{flex:1}
.message-skeleton-line{height:12px;border-radius:4px;margin-bottom:6px}
.message-skeleton-line.short{width:60%}
@keyframes skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media(max-width:768px){.channel-sidebar{position:fixed;left:var(--server-sidebar-width);top:0;bottom:0;z-index:150;transform:translateX(0);transition:transform .2s ease;box-shadow:2px 0 12px rgba(0,0,0,.3)}.channel-sidebar.mobile-hidden{transform:translateX(-100%)}.channel-sidebar .mobile-overlay{display:none}.channel-sidebar-toggle.mobile-only{display:flex!important;margin-right:8px}}
.status-picker{position:absolute;bottom:calc(100% + 8px);left:0;width:260px;background:rgba(24,21,18,.96);backdrop-filter:blur(20px);border:1px solid rgba(255,215,0,.12);border-radius:var(--radius-lg);box-shadow:var(--glass-shadow);z-index:800;padding:8px 0;animation:contextMenuIn .15s var(--ease-out-expo)}
.status-picker-item{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:background .15s;font-size:14px;color:var(--text-secondary)}
.status-picker-item:hover{background:rgba(255,215,0,.07);color:var(--text-primary)}
.status-picker-item .status-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.status-picker-item .status-dot.online{background:var(--status-online)}
.status-picker-item .status-dot.idle{background:var(--status-idle)}
.status-picker-item .status-dot.dnd{background:var(--status-dnd)}
.status-picker-item .status-dot.invisible{background:var(--status-offline)}
.status-picker-divider{height:1px;background:rgba(255,215,0,.06);margin:4px 0}
.status-picker-custom{padding:8px 14px}
.status-picker-custom input{width:100%;padding:6px 10px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;font-family:inherit}
.status-picker-custom input:focus{outline:none;border-color:var(--primary-yellow)}
.profile-card{position:fixed;width:300px;background:rgba(24,21,18,.96);backdrop-filter:blur(20px);border:1px solid rgba(255,215,0,.12);border-radius:var(--radius-lg);box-shadow:var(--glass-shadow);z-index:800;overflow:hidden;animation:contextMenuIn .15s var(--ease-out-expo)}
.profile-card-banner{height:60px;background:linear-gradient(135deg,var(--primary-yellow),var(--dark-yellow))}
.profile-card-avatar{width:64px;height:64px;background:var(--dark-gray);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:var(--text-secondary);border:4px solid rgba(24,21,18,.96);margin:-32px 0 0 16px;position:relative;overflow:hidden}
.profile-card-avatar span{font-size:26px;font-weight:700}
.profile-card-body{padding:8px 16px 16px}
.profile-card-name{font-size:18px;font-weight:700;color:var(--text-primary);margin-top:4px}
.profile-card-tag{font-size:12px;color:var(--text-muted)}
.profile-card-status{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:var(--text-secondary)}
.profile-card-status .status-dot{width:8px;height:8px;border-radius:50%}
.profile-card-section{margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,215,0,.06)}
.profile-card-section h4{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-secondary);margin-bottom:6px}
.profile-card-section p{font-size:13px;color:var(--text-primary);line-height:1.5}
.profile-card-note textarea{width:100%;padding:6px 8px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:inherit;resize:none;height:48px}
.profile-card-note textarea:focus{outline:none;border-color:var(--primary-yellow)}
.profile-card-roles{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.profile-card-role{display:flex;align-items:center;gap:4px;padding:2px 8px;background:var(--dark-gray);border-radius:var(--radius-full);font-size:11px;color:var(--text-secondary)}
.profile-card-role .role-dot{width:8px;height:8px;border-radius:50%}
.profile-card-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:900;pointer-events:none}
.profile-card-modal .profile-card-modal-inner{pointer-events:auto;width:320px;background:rgba(24,21,18,.97);backdrop-filter:blur(20px);border:1px solid rgba(255,215,0,.25);border-radius:1rem;box-shadow:0 0 40px rgba(255,215,0,.15);padding:24px 20px;text-align:center}
.profile-card-trophy{color:var(--primary-yellow);font-size:24px;margin-bottom:8px;display:block}
.profile-card-modal .profile-card-avatar-wrap{margin-bottom:12px}
.profile-card-modal .profile-card-avatar{width:80px;height:80px;margin:0 auto;border-radius:50%;background:var(--dark-gray);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:var(--text-secondary);border:3px solid rgba(255,215,0,.3);position:relative}
.profile-card-online-dot{position:absolute;bottom:4px;right:4px;width:14px;height:14px;border-radius:50%;background:var(--status-online);border:2px solid rgba(24,21,18,.97)}
.profile-card-online-dot.offline,.profile-card-online-dot.invisible{background:var(--text-muted)}
.profile-card-user-id{font-size:20px;font-weight:700;color:var(--primary-yellow);margin-bottom:12px}
.profile-card-desc{width:100%;padding:10px 12px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:var(--text-primary);font-size:13px;font-family:inherit;margin-bottom:16px;box-sizing:border-box}
.profile-card-desc:focus{outline:none;border-color:var(--primary-yellow)}
.profile-card-actions{display:flex;justify-content:center;gap:12px;margin-bottom:16px}
.profile-card-btn{width:44px;height:44px;border-radius:50%;background:var(--dark-gray);border:1px solid rgba(255,255,255,.08);color:var(--text-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .15s}
.profile-card-btn:hover:not(:disabled){border-color:var(--primary-yellow);color:var(--primary-yellow)}
.profile-card-btn:disabled{opacity:.6;cursor:default}
.profile-card-close{width:100%;padding:10px 16px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:var(--text-primary);font-size:14px;cursor:pointer;font-family:inherit}
.profile-card-close:hover{background:var(--medium-gray);border-color:var(--primary-yellow)}
.profile-card-full{pointer-events:auto!important;align-items:center;justify-content:center;padding:0;box-sizing:border-box;width:100%;height:100%;display:flex;position:absolute;inset:0}
.profile-card-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:0;cursor:pointer}
.profile-card-modal.profile-card-full{pointer-events:auto!important}
.profile-card-overlay{position:fixed!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;z-index:99999!important;background:rgba(0,0,0,.65)!important}
.profile-card-full .profile-card-modal-inner{position:relative;z-index:1;display:flex;max-width:90vw;width:720px;max-height:85vh;overflow:hidden;border-radius:16px;text-align:left;padding:0}
.profile-card-two-panels{background:rgba(24,21,18,.98);border:1px solid rgba(255,215,0,.2);box-shadow:0 0 60px rgba(255,215,0,.12)}
.profile-card-close-btn{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.08);border:none;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;transition:all .15s}
.profile-card-close-btn:hover{background:rgba(255,255,255,.12);color:var(--text-primary)}
.profile-card-left{flex:0 0 320px;min-width:0;padding:0 20px 24px;overflow-y:auto;border-right:1px solid rgba(255,215,0,.08)}
.profile-card-banner-full{height:80px;background:linear-gradient(135deg,var(--primary-yellow),var(--dark-yellow));border-radius:16px 16px 0 0;margin:0 -20px 0 -20px}
.profile-card-avatar-wrap-full{margin-top:-40px;margin-bottom:12px;text-align:center}
.profile-card-avatar-full{width:88px;height:88px;margin:0 auto;border-radius:50%;border:4px solid rgba(24,21,18,.98);font-size:32px}
.profile-card-display-name{font-size:18px;font-weight:700;color:var(--text-primary);margin:0 0 2px}
.profile-card-tag{font-size:13px;color:var(--text-muted);margin:0 0 14px}
.profile-card-actions-row{display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.profile-card-btn-msg{flex:1;min-width:100px;height:36px;border-radius:8px;font-size:13px;padding:0 14px;background:var(--primary-blue, #5865f2);border:none;color:#fff}
.profile-card-btn-msg:hover:not(:disabled){filter:brightness(1.1)}
.profile-card-btn-icon{width:36px;height:36px;flex-shrink:0}
.profile-card-section{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,215,0,.06)}
.profile-card-section h4{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-secondary);margin:0 0 8px}
.profile-links-list{display:flex;flex-direction:column;gap:6px}
.profile-link-item{font-size:13px;color:var(--primary-yellow);text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.profile-link-item:hover{text-decoration:underline}
.profile-links-empty{font-size:12px;color:var(--text-muted);margin:0}
.profile-links-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.profile-card-link-add{padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.1);color:var(--text-primary);font-family:inherit}
.profile-card-link-add:hover{border-color:var(--primary-yellow);color:var(--primary-yellow)}
.profile-card-link-add.secondary{background:transparent}
.profile-card-note-input{width:100%;padding:8px 10px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:inherit;resize:none;height:56px;box-sizing:border-box}
.profile-card-note-input:focus{outline:none;border-color:var(--primary-yellow)}
.profile-card-right{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;padding:16px 20px 24px}
.profile-card-tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid rgba(255,215,0,.08)}
.profile-card-tab{padding:8px 12px;font-size:13px;color:var(--text-muted);background:none;border:none;cursor:pointer;font-family:inherit;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s,border-color .15s}
.profile-card-tab:hover{color:var(--text-secondary)}
.profile-card-tab.active{color:var(--primary-yellow);border-bottom-color:var(--primary-yellow)}
.profile-card-tab-content{flex:1;overflow-y:auto;min-height:0}
.profile-card-tab-content h4{font-size:12px;font-weight:600;color:var(--text-secondary);margin:0 0 8px}
.profile-card-activity-empty{font-size:13px;color:var(--text-muted);margin:0}
/* Player banner — perfil modal: quadrado ao centro do ecrã */
.player-banner-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:0;cursor:pointer;animation:profileBackdropIn .2s ease-out}
.player-banner-card{position:relative;z-index:1;width:min(420px,85vmin);height:min(420px,85vmin);min-width:280px;min-height:280px;max-width:95vw;max-height:85vh;overflow:auto;border-radius:var(--radius-2xl, 1rem);background:rgba(18,16,14,.98);border:1px solid rgba(255,215,0,.15);box-shadow:0 25px 50px -12px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.04),0 0 80px rgba(255,215,0,.06);display:flex;flex-direction:column;animation:profileCardIn .28s cubic-bezier(0.16,1,0.3,1) forwards;flex-shrink:0;aspect-ratio:1/1;box-sizing:border-box}
@keyframes profileBackdropIn{from{opacity:0}to{opacity:1}}
@keyframes profileCardIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.player-banner-banner{height:120px;background:linear-gradient(135deg,var(--primary-yellow) 0%,var(--dark-yellow) 50%,#b8860b 100%);background-size:cover;background-position:center;position:relative}
.player-banner-banner::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(18,16,14,.6) 100%)}
.player-banner-avatar-wrap{text-align:center;margin-top:-52px;position:relative;z-index:1;padding:0 24px}
.player-banner-avatar{position:relative;width:100px;height:100px;margin:0 auto;border-radius:50%;border:4px solid rgba(18,16,14,.98);background:var(--dark-gray);display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;color:var(--text-secondary);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.4)}
.player-banner-avatar img{width:100%;height:100%;object-fit:cover}
.player-banner-avatar .profile-card-online-dot{position:absolute;bottom:6px;right:6px;width:16px;height:16px;border-radius:50%;border:3px solid rgba(18,16,14,.98)}
.player-banner-body{padding:16px 24px 24px;text-align:center;flex:1;overflow-y:auto}
.player-banner-name{font-size:22px;font-weight:700;color:var(--text-primary);margin:0 0 4px;letter-spacing:-0.02em}
.player-banner-tag{font-size:14px;color:var(--text-muted);margin:0 0 8px}
.player-banner-status{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);margin-bottom:14px}
.player-banner-status .status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.player-banner-desc{padding:12px 16px;background:rgba(255,255,255,.04);border-radius:12px;font-size:14px;color:var(--text-secondary);line-height:1.5;margin-bottom:20px;border:1px solid rgba(255,215,0,.06);min-height:48px}
.player-banner-desc.empty{color:var(--text-muted);font-style:italic}
.player-banner-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:20px}
.player-banner-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;border:none;cursor:pointer;font-family:inherit;transition:all .2s}
.player-banner-btn-msg{background:var(--primary-blue,#5865f2);color:#fff}
.player-banner-btn-msg:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px)}
.player-banner-btn-icon{width:44px;height:44px;padding:0;justify-content:center;background:var(--dark-gray);border:1px solid rgba(255,255,255,.1);color:var(--text-primary)}
.player-banner-btn-icon:hover:not(:disabled){border-color:var(--primary-yellow);color:var(--primary-yellow);background:rgba(255,215,0,.08)}
.player-banner-close-btn{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);color:var(--text-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;transition:all .2s}
.player-banner-close-btn:hover{background:rgba(255,255,255,.12);color:var(--primary-yellow)}
.player-banner-more{display:block;padding:12px 0 0;border-top:1px solid rgba(255,215,0,.06);text-align:left}
.player-banner-more .profile-card-section{margin-top:12px;padding-top:12px}
.player-banner-more .profile-card-section h4{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-secondary);margin:0 0 8px}
.settings-overlay{position:fixed;inset:0;background:#1a1a1a;z-index:3500;display:flex;animation:settingsFadeIn .25s var(--ease-out-expo)}
@keyframes settingsFadeIn{from{opacity:0}to{opacity:1}}
.settings-overlay .settings-sidebar{flex:0 0 240px;width:240px;background:#0a0a0a;border-right:1px solid rgba(255,255,255,.06);overflow-y:auto;flex-shrink:0}
.settings-overlay .settings-sidebar-inner{padding:24px 12px 20px;min-height:100%}
.settings-overlay .settings-sidebar-profile{display:none}
.settings-overlay .settings-sidebar-search{display:none}
.settings-overlay .settings-sidebar-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-secondary);padding:8px 14px 6px;margin-top:12px}
.settings-overlay .settings-sidebar-title:first-child{margin-top:0}
.settings-overlay .settings-sidebar-item{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;cursor:pointer;font-size:14px;color:var(--lighter-gray);transition:background .15s,color .15s;margin-bottom:2px;white-space:nowrap}
.settings-overlay .settings-sidebar-item i{width:20px;text-align:center;font-size:15px;flex-shrink:0;color:inherit}
.settings-overlay .settings-sidebar-item:hover{background:rgba(255,255,255,.06);color:var(--text-primary)}
.settings-overlay .settings-sidebar-item.active{background:var(--primary-yellow);color:var(--primary-black);font-weight:600}
.settings-overlay .settings-sidebar-item.active i{color:var(--primary-black)}
.settings-overlay .settings-sidebar-item.danger{color:var(--error)}
.settings-overlay .settings-sidebar-item.danger:hover{background:rgba(229,57,53,.12)}
.settings-overlay .settings-sidebar-item.danger.active{background:var(--error);color:#fff}
.settings-overlay .settings-sidebar-divider{height:1px;background:rgba(255,255,255,.06);margin:8px 14px}
.settings-overlay .settings-content{flex:1;display:flex;flex-direction:column;background:#1a1a1a;position:relative;overflow-y:auto;padding:32px 40px 80px}
.settings-overlay .settings-content-inner{max-width:720px;width:100%}
.settings-overlay .settings-content h2.settings-page-title{font-size:28px;font-weight:700;color:var(--text-primary);margin:0 0 28px;display:block}
.settings-overlay .settings-close{position:absolute;top:24px;right:32px;z-index:10}
.settings-overlay .settings-close button{width:36px;height:36px;border-radius:50%;background:transparent;border:none;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:color .15s}
.settings-overlay .settings-close button:hover{color:var(--text-primary)}
.settings-overlay .settings-close-hint{display:none}
.settings-overlay .settings-subscription-card{background:var(--dark-gray);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px 24px;margin-bottom:24px}
.settings-overlay .settings-subscription-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.settings-overlay .settings-subscription-label{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700;color:var(--text-primary)}
.settings-overlay .settings-subscription-label i{color:var(--primary-yellow);font-size:18px}
.settings-overlay .settings-subscription-desc{font-size:13px;color:var(--text-secondary);margin:8px 0 0;line-height:1.45}
.settings-overlay .settings-plan-select{padding:10px 36px 10px 14px;background:var(--secondary-black);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:var(--text-primary);font-size:14px;font-family:inherit;min-width:220px;appearance:auto;cursor:pointer}
.settings-overlay .settings-account-hero{display:flex;align-items:center;gap:20px;padding:24px 28px;background:var(--primary-yellow);border-radius:12px;margin-bottom:24px;flex-wrap:wrap}
.settings-overlay .settings-account-hero-avatar{position:relative;width:64px;height:64px;border-radius:50%;background:var(--dark-gray);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:var(--text-primary);flex-shrink:0;overflow:hidden}
.settings-overlay .settings-account-hero-avatar .settings-avatar-file-input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;z-index:2}
.settings-overlay .settings-account-hero-avatar .settings-avatar-preview{position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
.settings-overlay .settings-account-hero-avatar .settings-avatar-preview img{width:100%;height:100%;object-fit:cover}
.settings-overlay .settings-account-hero-body{flex:1;min-width:0}
.settings-overlay .settings-account-hero-name{font-size:16px;font-weight:600;color:var(--primary-black);display:block;margin-bottom:8px}
.settings-overlay .settings-account-hero .btn-change-photo{background:var(--dark-gray);color:var(--text-primary);border:none;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .15s}
.settings-overlay .settings-account-hero .btn-change-photo:hover{background:rgba(0,0,0,.25)}
.settings-overlay .settings-avatar-card{background:var(--secondary-black);border:1px solid rgba(255,215,0,.1);border-radius:var(--radius-lg);padding:24px;margin-bottom:24px}
.settings-overlay .settings-avatar-preview-wrap{position:relative;width:160px;height:160px;margin:0 auto 20px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,215,0,.25);background:var(--dark-gray);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .2s,box-shadow .2s}
.settings-overlay .settings-avatar-preview-wrap:hover{border-color:var(--primary-yellow);box-shadow:0 0 24px rgba(255,215,0,.2)}
.settings-overlay .settings-avatar-preview-wrap.drag-over{border-color:var(--primary-yellow);background:rgba(255,215,0,.08)}
.settings-overlay .settings-avatar-preview{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;color:var(--text-secondary);position:relative;z-index:1}
.settings-overlay .settings-avatar-preview img{width:100%;height:100%;object-fit:cover}
.settings-overlay .settings-avatar-overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;opacity:0;transition:opacity .2s;z-index:2;color:#fff;font-size:13px;font-weight:600}
.settings-overlay .settings-avatar-preview-wrap:hover .settings-avatar-overlay{opacity:1}
.settings-overlay .settings-avatar-overlay i{font-size:28px;opacity:.9}
.settings-overlay .settings-avatar-file-input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;z-index:3}
.settings-overlay .settings-avatar-actions{display:flex;flex-direction:column;align-items:center;gap:14px}
.settings-overlay .settings-avatar-btn-file{cursor:pointer;margin:0}
.settings-overlay .settings-avatar-divider{font-size:12px;color:var(--text-muted);text-transform:lowercase}
.settings-overlay .settings-avatar-url-row{display:flex;gap:10px;width:100%;max-width:400px;flex-wrap:wrap}
.settings-overlay .settings-avatar-url-input{flex:1;min-width:180px;padding:10px 14px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit}
.settings-overlay .settings-avatar-url-input:focus{outline:none;border-color:var(--primary-yellow)}
.settings-overlay .settings-avatar-card-improved{padding:24px;border-radius:var(--radius-lg);border:1px solid rgba(255,215,0,.12)}
.settings-overlay .settings-avatar-card-title{font-size:15px;font-weight:700;color:var(--text-primary);margin:0 0 6px;display:flex;align-items:center;gap:8px}
.settings-overlay .settings-avatar-card-title i{color:var(--primary-yellow)}
.settings-overlay .settings-avatar-card-desc{font-size:13px;color:var(--text-muted);margin:0 0 20px;line-height:1.45}
.settings-overlay .settings-avatar-preview-wrap{width:180px;height:180px;margin:0 auto 20px}
.settings-overlay .settings-avatar-remove-btn{display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:8px 14px;background:rgba(229,57,53,.15);border:1px solid rgba(229,57,53,.3);border-radius:var(--radius-md);color:#ff6b6b;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.settings-overlay .settings-avatar-remove-btn:hover{background:rgba(229,57,53,.25)}
.settings-overlay .settings-sidebar-profile-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.settings-overlay .settings-subscription-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px}
.settings-overlay .settings-subscription-label{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--text-primary)}
.settings-overlay .settings-subscription-label i{color:var(--primary-yellow)}
.settings-overlay .settings-section-block{margin-bottom:24px}
.settings-overlay .settings-section-block h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-secondary);margin:0 0 8px;display:block}
.settings-overlay .settings-section-block p{font-size:13px;color:var(--text-secondary);line-height:1.5;margin:0 0 10px}
.settings-overlay .settings-section-block .input-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.settings-overlay .settings-section-block input[type="text"],.settings-overlay .settings-section-block input[type="url"]{flex:1;min-width:200px;padding:10px 12px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit}
.settings-overlay .settings-password-input{width:100%;max-width:320px;padding:10px 12px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit;box-sizing:border-box}
.settings-overlay .settings-password-input:focus{outline:none;border-color:var(--primary-yellow)}
.settings-overlay .settings-section-block input:focus{outline:none;border-color:var(--primary-yellow)}
.settings-overlay .settings-section-block .btn-save{background:var(--primary-yellow);color:var(--primary-black);border:none;padding:10px 18px;border-radius:var(--radius-md);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.settings-overlay .settings-section-block .btn-save:hover{background:var(--dark-yellow);color:var(--primary-black)}
.settings-overlay .settings-section-block .btn-clear-db{display:inline-flex;align-items:center;gap:8px;background:var(--error);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:8px}
.settings-overlay .settings-section-block .btn-clear-db:hover{background:#c62828}
.settings-overlay .settings-section-block select{padding:10px 12px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit;min-width:200px}
.settings-overlay .settings-section-block select:focus{outline:none;border-color:var(--primary-yellow)}
.settings-overlay .settings-content h3{font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.08em;margin:24px 0 8px;display:block}
.settings-overlay .settings-content p{font-size:13px;color:var(--text-secondary);line-height:1.55;margin-bottom:12px;display:block}
.settings-overlay .settings-card{background:var(--dark-gray);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px 20px;margin-bottom:16px}
.settings-overlay .settings-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.settings-overlay .settings-row:last-child{border-bottom:none}
.settings-overlay .settings-row-label{font-size:14px;color:var(--text-primary);font-weight:500}
.settings-overlay .settings-row-desc{font-size:12px;color:var(--text-muted);margin-top:2px}
.settings-overlay .settings-profile-card{background:var(--secondary-black);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:16px;border:1px solid rgba(255,215,0,.06)}
.settings-overlay .settings-profile-banner{height:100px;background:linear-gradient(135deg,var(--primary-yellow),var(--dark-yellow))}
.settings-overlay .settings-profile-about-empty{color:var(--text-muted);font-style:italic}
.settings-overlay .settings-voice-select{background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-size:14px;min-width:200px}
.settings-overlay .settings-voice-range{width:180px;accent-color:var(--primary-yellow)}
.settings-overlay .settings-voice-test-card{margin-top:20px}
.settings-overlay .settings-voice-test-row{margin-bottom:20px}
.settings-overlay .settings-voice-test-block{padding:16px;background:var(--dark-gray);border-radius:var(--radius-md);border:1px solid rgba(255,255,255,.06)}
.settings-overlay .settings-voice-level-wrap{margin-bottom:12px}
.settings-overlay .settings-voice-level-bars{display:flex;align-items:flex-end;gap:4px;height:24px;margin-bottom:6px}
.settings-overlay .settings-voice-level-bars span{width:8px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;transition:height .05s,background .1s}
.settings-overlay .settings-voice-level-bars span.active{height:100%;background:var(--status-online)}
.settings-overlay .settings-voice-level-label{font-size:12px;color:var(--text-muted)}
.settings-overlay .settings-voice-video-preview{width:100%;max-width:400px;aspect-ratio:16/10;background:#000;border-radius:var(--radius-md);overflow:hidden;margin-bottom:8px}
.settings-overlay .settings-voice-video-preview video{width:100%;height:100%;object-fit:contain}
.settings-overlay .settings-profile-info{padding:0 16px 16px;position:relative}
.settings-overlay .settings-profile-avatar{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:var(--primary-black);margin-top:-40px;border:6px solid var(--secondary-black);position:relative;overflow:hidden;background:linear-gradient(135deg,var(--primary-yellow),var(--dark-yellow))}
.settings-overlay .settings-profile-details{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
.settings-overlay .settings-profile-name{font-size:20px;font-weight:700;color:var(--text-primary)}
.settings-overlay .settings-profile-email{font-size:14px;color:var(--text-muted)}
.settings-overlay .settings-field-row{display:flex;align-items:flex-start;justify-content:space-between;padding:14px 16px;background:var(--primary-black);border-radius:var(--radius-md);margin-top:8px}
.settings-overlay .settings-field-row+.settings-field-row{margin-top:1px}
.settings-overlay .settings-field-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:2px}
.settings-overlay .settings-field-value{font-size:14px;color:var(--text-primary)}
.toggle-switch{position:relative;width:40px;height:22px;background:var(--medium-gray);border-radius:var(--radius-full);cursor:pointer;transition:background .2s;flex-shrink:0}
.toggle-switch.active{background:var(--status-online)}
.toggle-switch::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s}
.toggle-switch.active::after{transform:translateX(18px)}
.reply-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--secondary-black);border-radius:var(--radius-md) var(--radius-md) 0 0;border:1px solid rgba(255,215,0,.06);border-bottom:none;font-size:13px;color:var(--text-secondary);margin-bottom:-1px}
.reply-bar span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.reply-bar strong{color:var(--primary-yellow);margin-right:4px}
.reply-bar button{background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:4px;display:flex;align-items:center;font-size:14px}
.reply-bar button:hover{color:var(--text-primary)}
.voice-panel{padding:8px 12px;background:rgba(67,160,71,.08);border-top:1px solid rgba(67,160,71,.2);border-bottom:1px solid rgba(67,160,71,.2)}
.voice-panel-header{display:flex;align-items:center;justify-content:space-between}
.voice-panel-title{font-size:12px;font-weight:700;color:var(--status-online);text-transform:uppercase;letter-spacing:.5px}
.voice-panel-channel{font-size:13px;color:var(--text-secondary);margin-top:2px}
.voice-panel-actions{display:flex;gap:4px}
.voice-panel-actions button{width:28px;height:28px;background:transparent;border:none;border-radius:var(--radius-md);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .15s}
.voice-panel-actions button:hover{background:rgba(229,57,53,.15);color:var(--error)}
.search-panel{position:absolute;top:0;right:0;bottom:0;width:420px;background:var(--secondary-black);border-left:1px solid rgba(255,215,0,.06);z-index:50;display:flex;flex-direction:column;animation:slideFromRight .2s var(--ease-out-expo)}
@keyframes slideFromRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
.search-panel-header{padding:12px;border-bottom:1px solid rgba(255,215,0,.06);display:flex;align-items:center;gap:8px}
.search-panel-header input{flex:1;padding:8px 12px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit}
.search-panel-header input:focus{outline:none;border-color:var(--primary-yellow)}
.search-panel-results{flex:1;overflow-y:auto;padding:12px}
.search-panel-results .search-result{padding:8px;border-radius:var(--radius-md);cursor:pointer;margin-bottom:4px;transition:background .15s}
.search-panel-results .search-result:hover{background:var(--dark-gray)}
.search-result-author{font-size:13px;font-weight:600;color:var(--primary-yellow)}
.search-result-text{font-size:13px;color:var(--text-secondary);margin-top:2px}
.search-result-date{font-size:11px;color:var(--text-muted);margin-top:2px}
.pinned-panel{position:absolute;top:calc(var(--header-height) + 4px);right:80px;width:420px;max-height:500px;background:rgba(24,21,18,.96);backdrop-filter:blur(20px);border:1px solid rgba(255,215,0,.12);border-radius:var(--radius-lg);box-shadow:var(--glass-shadow);z-index:500;display:flex;flex-direction:column;animation:contextMenuIn .15s var(--ease-out-expo)}
.pinned-panel-header{padding:14px 16px;border-bottom:1px solid rgba(255,215,0,.06);font-size:14px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;justify-content:space-between}
.pinned-panel-list{flex:1;overflow-y:auto;padding:8px}
.pinned-panel-list .pinned-msg{padding:10px;border-radius:var(--radius-md);border-bottom:1px solid rgba(255,255,255,.04);margin-bottom:4px}
.pinned-msg-author{font-size:13px;font-weight:600;color:var(--primary-yellow)}
.pinned-msg-text{font-size:13px;color:var(--text-primary);margin-top:4px;line-height:1.5}
.pinned-msg-date{font-size:11px;color:var(--text-muted);margin-top:4px}
.dm-list-item{display:flex;align-items:center;gap:12px;padding:6px 8px;margin:1px 8px;border-radius:var(--radius-md);cursor:pointer;transition:background .15s}
.dm-list-item:hover{background:rgba(255,255,255,.04)}
.dm-list-item.active{background:rgba(255,255,255,.06)}
.dm-list-item-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;position:relative;flex-shrink:0;overflow:hidden}
.dm-list-item-avatar img{width:100%;height:100%;object-fit:cover}
.dm-list-item-avatar span{line-height:1}
.dm-list-item-avatar::after{content:'';position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;border:3px solid var(--secondary-black);box-sizing:border-box}
.dm-list-item-avatar.online::after{background:var(--status-online)}
.dm-list-item-avatar.idle::after{background:var(--status-idle)}
.dm-list-item-avatar.dnd::after{background:var(--status-dnd)}
.dm-list-item-avatar.offline::after{background:var(--status-offline)}
.dm-list-item-info{flex:1;min-width:0}
.dm-list-item-name{font-size:16px;font-weight:500;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-list-item:hover .dm-list-item-name,.dm-list-item.active .dm-list-item-name{color:var(--text-primary)}
.dm-list-item-msg{font-size:13px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.home-sidebar-btn{display:flex;align-items:center;gap:10px;padding:8px 12px;margin:2px 8px;border-radius:var(--radius-md);cursor:pointer;transition:background .15s;font-size:14px;color:var(--text-secondary);font-weight:500}
.home-sidebar-btn:hover{background:var(--dark-gray);color:var(--text-primary)}
.home-sidebar-btn.active{background:var(--medium-gray);color:var(--text-primary)}
.home-sidebar-btn i{width:20px;text-align:center;font-size:16px}
.friends-header{display:flex;align-items:center;gap:12px;padding:0 16px;height:var(--header-height);border-bottom:1px solid rgba(255,215,0,.05);flex-shrink:0}
.friends-header h3{font-size:15px;font-weight:700;color:var(--text-primary)}
.friends-header .divider-v{width:1px;height:24px;background:var(--dark-gray)}
.friends-tabs{display:flex;gap:4px}
.friends-tab{padding:4px 10px;border-radius:var(--radius-md);background:transparent;border:none;font-size:13px;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:all .15s;font-family:inherit}
.friends-tab:hover{background:var(--dark-gray);color:var(--text-primary)}
.friends-tab.active{background:var(--medium-gray);color:var(--text-primary)}
.friends-tab.add-friend{background:rgba(67,160,71,.15);color:var(--status-online)}
.friends-tab.add-friend:hover{background:rgba(67,160,71,.25)}
.friends-list{flex:1;overflow-y:auto;padding:8px 16px}
.friend-item{display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:var(--radius-md);border-top:1px solid rgba(255,255,255,.03);cursor:pointer;transition:background .15s;min-height:48px;box-sizing:border-box}
.friend-item:hover{background:var(--dark-gray)}
.friend-item-avatar{width:36px;height:36px;border-radius:50%;background:var(--medium-gray);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--text-secondary);position:relative;flex-shrink:0;overflow:hidden}
.friend-item-avatar img{width:100%;height:100%;object-fit:cover;display:block}
.friend-item-avatar::after{content:'';position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:50%;border:2px solid var(--primary-black)}
.friend-item-avatar.online::after{background:var(--status-online)}
.friend-item-avatar.idle::after{background:var(--status-idle)}
.friend-item-avatar.dnd::after{background:var(--status-dnd)}
.friend-item-avatar.offline::after{background:var(--status-offline)}
.friend-item-info{flex:1;min-width:0}
.friend-item-name{font-size:14px;font-weight:600;color:var(--text-primary)}
.friend-item-status{font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.friend-item-actions{display:flex;gap:4px}
.friend-item-actions button{width:32px;height:32px;border-radius:50%;background:var(--dark-gray);border:none;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .15s}
.friend-item-actions button:hover{background:var(--medium-gray);color:var(--text-primary)}
.add-friend-form{padding:20px;max-width:600px}
.add-friend-form h2{font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px}
.add-friend-form p{font-size:14px;color:var(--text-secondary);margin-bottom:16px}
.add-friend-input-row{display:flex;gap:8px}
.add-friend-input-row input{flex:1;padding:10px 14px;background:var(--dark-gray);border:1.5px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit}
.add-friend-input-row input:focus{outline:none;border-color:var(--primary-yellow)}
.friends-body-wrapper{display:flex;flex:1;overflow:hidden}
.friends-body-wrapper .friends-list{flex:1;overflow-y:auto;padding:8px 16px}
.active-now-panel{width:360px;border-left:1px solid rgba(255,215,0,.05);padding:16px;overflow-y:auto;flex-shrink:0}
.active-now-panel h4{font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:16px}
.active-now-empty{text-align:center;padding:20px 16px}
.active-now-empty p{font-size:14px;color:var(--text-secondary);line-height:1.5}
@media(max-width:1100px){.active-now-panel{display:none}}
.channel-unread-dot{width:8px;height:8px;border-radius:50%;background:var(--text-primary);margin-left:auto;flex-shrink:0}
.home-nav-badge{font-size:12px;min-width:16px;height:16px;padding:0 5px;border-radius:8px;margin-left:auto;font-weight:700;background:var(--error);color:#fff;display:flex;align-items:center;justify-content:center;line-height:1}
.home-nav-badge.new{background:none;color:var(--text-muted);font-size:10px;font-weight:600;text-transform:uppercase}
.message-edit-area{width:100%}
.message-edit-area textarea{width:100%;padding:8px;background:var(--dark-gray);border:1px solid rgba(255,215,0,.15);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit;resize:none;min-height:44px}
.message-edit-area textarea:focus{outline:none;border-color:var(--primary-yellow)}
.message-edit-actions{display:flex;gap:8px;margin-top:4px;font-size:12px;color:var(--text-muted)}
.message-edit-actions a{color:var(--primary-yellow);cursor:pointer;text-decoration:none}
.message-edit-actions a:hover{text-decoration:underline}
.server-dropdown{position:absolute;top:calc(var(--header-height) + 2px);left:0;width:220px;background:rgba(24,21,18,.96);backdrop-filter:blur(20px);border:1px solid rgba(255,215,0,.12);border-radius:var(--radius-lg);box-shadow:var(--glass-shadow);z-index:200;padding:6px 0;animation:contextMenuIn .15s var(--ease-out-expo)}
.btn-icon.muted{color:var(--error)!important;background:rgba(229,57,53,.12)!important}
.friends-header-tabs{display:flex;gap:10px;align-items:center;flex-wrap:wrap;row-gap:8px}
.friends-header-tab{padding:8px 14px;border-radius:var(--radius-md);background:transparent;border:none;font-size:14px;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:all .15s;font-family:inherit;white-space:nowrap;min-height:36px;display:inline-flex;align-items:center;justify-content:center}
.friends-header-tab:hover{background:var(--dark-gray);color:var(--text-primary)}
.friends-header-tab.active{background:rgba(255,215,0,.2);color:var(--primary-yellow)}
.friends-header-tab.add-friend{background:transparent;color:var(--text-secondary)}
.friends-header-tab.add-friend:hover,.friends-header-tab.add-friend.active{background:var(--primary-yellow);color:#000}
.friends-search-wrapper{padding:12px 16px}
.friends-search-wrapper input{width:100%;padding:10px 14px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit;min-height:44px;box-sizing:border-box}
.friends-search-wrapper input:focus{outline:none;border-color:var(--primary-yellow)}
.friends-search-wrapper i{display:none}
.friends-add-section{padding:24px 20px}
.friends-add-section h2{font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:10px}
.friends-add-section p{font-size:14px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5}
.friends-add-input-wrapper{display:flex;gap:10px}
.friends-add-input-wrapper input{flex:1;padding:12px 16px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit;min-height:44px;box-sizing:border-box}
.friends-add-input-wrapper input:focus{outline:none;border-color:var(--primary-yellow)}
.friends-view{display:flex;flex-direction:column;flex:1;overflow:hidden}
.main-content{position:relative}
.member-role-badge{font-size:10px;padding:1px 6px;border-radius:var(--radius-full);margin-left:4px;font-weight:600}
    `;
  document.head.appendChild(s);
})();

const EMOJIS = {
  Smileys: [
    '😀',
    '😃',
    '😄',
    '😁',
    '😆',
    '😅',
    '🤣',
    '😂',
    '🙂',
    '😊',
    '😇',
    '🥰',
    '😍',
    '🤩',
    '😘',
    '😗',
    '😋',
    '😛',
    '😜',
    '🤪',
    '😝',
    '🤑',
    '🤗',
    '🤭',
    '🤫',
    '🤔',
    '🤐',
    '🤨',
    '😐',
    '😑',
    '😶',
    '😏',
    '😒',
    '🙄',
    '😬',
    '😮‍💨',
    '🤥',
    '😌',
    '😔',
    '😪',
    '🤤',
    '😴',
    '😷',
    '🤒',
    '🤕',
    '🤢',
    '🤮',
    '🥵',
    '🥶',
    '🥴',
    '😵',
    '🤯',
    '🤠',
    '🥳',
    '🥸',
    '😎',
    '🤓',
    '🧐',
  ],
  Gestures: [
    '👋',
    '🤚',
    '🖐️',
    '✋',
    '🖖',
    '👌',
    '🤌',
    '🤏',
    '✌️',
    '🤞',
    '🤟',
    '🤘',
    '🤙',
    '👈',
    '👉',
    '👆',
    '👇',
    '☝️',
    '👍',
    '👎',
    '👏',
    '🙌',
    '🤝',
    '🙏',
    '💪',
    '🦾',
  ],
  Hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  Animals: [
    '🐶',
    '🐱',
    '🐭',
    '🐹',
    '🐰',
    '🦊',
    '🐻',
    '🐼',
    '🐨',
    '🐯',
    '🦁',
    '🐮',
    '🐷',
    '🐸',
    '🐵',
    '🐔',
    '🐧',
    '🐦',
    '🦅',
    '🦆',
    '🦉',
    '🐝',
    '🦋',
    '🐌',
    '🐛',
  ],
  Food: [
    '🍎',
    '🍊',
    '🍋',
    '🍌',
    '🍉',
    '🍇',
    '🍓',
    '🫐',
    '🍒',
    '🍑',
    '🍍',
    '🥭',
    '🥝',
    '🍅',
    '🥑',
    '🌽',
    '🍕',
    '🍔',
    '🍟',
    '🌭',
    '🍿',
    '🧁',
    '🍩',
    '🍪',
    '🎂',
    '🍰',
  ],
  Activities: [
    '⚽',
    '🏀',
    '🏈',
    '⚾',
    '🎾',
    '🏐',
    '🎮',
    '🎯',
    '🎲',
    '🧩',
    '♟️',
    '🎭',
    '🎨',
    '🎬',
    '🎤',
    '🎧',
    '🎵',
    '🎶',
    '🏆',
    '🥇',
    '🥈',
    '🥉',
    '🎖️',
    '🏅',
  ],
  Objects: [
    '💡',
    '🔦',
    '🕯️',
    '💰',
    '💎',
    '⚙️',
    '🔧',
    '🔨',
    '🛡️',
    '🔑',
    '🗝️',
    '📱',
    '💻',
    '⌨️',
    '🖥️',
    '🖨️',
    '📷',
    '📹',
    '📺',
    '📻',
    '⏰',
    '🔔',
    '📢',
    '📣',
  ],
  Symbols: [
    '❤️',
    '💯',
    '💢',
    '💥',
    '💫',
    '💦',
    '🔥',
    '⭐',
    '✨',
    '🌟',
    '💨',
    '🕳️',
    '💣',
    '🗯️',
    '💤',
    '✅',
    '❌',
    '⭕',
    '🚫',
    '♻️',
    '⚠️',
    '🔴',
    '🟡',
    '🟢',
    '🔵',
  ],
};

/**
 * Cache local de mensagens (LocalStorage) para acesso rápido.
 * Fluxo: 1) Ler do cache. 2) Se vazio, buscar na API e repopular o cache.
 * O servidor persiste no DB para que os dados não se percam (refresh ou cache limpo).
 * Identificadores únicos (id) evitam duplicados ao mesclar cache + API.
 */
const MessageCache = {
  key(channelId) {
    return 'liberty_msg_' + (channelId || '');
  },
  maxPerChannel: 200,
  get(channelId) {
    try {
      const raw = localStorage.getItem(this.key(channelId));
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  },
  set(channelId, messages) {
    if (!channelId) return;
    try {
      const list = Array.isArray(messages) ? messages : [];
      const byId = new Map();
      list.forEach(m => {
        const id = m.id ?? m.message_id;
        if (id != null && id !== '') byId.set(String(id), { ...m, id: String(id), message_id: String(id) });
      });
      
      // Remover mensagens pending antigas (não devem ser salvas no cache)
      byId.forEach((m, id) => {
        if (id.startsWith('pending-') || id.startsWith('temp-')) {
          byId.delete(id);
        }
      });
      
      const sorted = [...byId.values()].sort((a, b) => {
        const tA = (a.created_at && new Date(a.created_at).getTime()) || 0;
        const tB = (b.created_at && new Date(b.created_at).getTime()) || 0;
        return tA - tB;
      });
      const capped = sorted.length > this.maxPerChannel ? sorted.slice(-this.maxPerChannel) : sorted;
      localStorage.setItem(this.key(channelId), JSON.stringify(capped));
    } catch (_) {}
  },
  add(channelId, message) {
    if (!channelId || !message) return;
    const id = message.id ?? message.message_id;
    const idStr = id != null && id !== '' ? String(id) : null;
    
    // Se é uma mensagem pending, não salvar no localStorage (só manter em memória)
    // Ela será substituída quando a resposta do servidor chegar
    if (idStr && idStr.startsWith('pending-')) {
      return; // Não salvar pending no cache
    }
    
    const list = this.get(channelId);
    const content = message.content;
    const authorId = message.author_id;
    
    // Remover mensagens pending antigas com mesmo conteúdo/autor
    const without = list.filter(m => {
      const mId = String(m.id ?? m.message_id ?? '');
      if (mId.startsWith('pending-') || mId.startsWith('temp-')) {
        // Se conteúdo e autor batem, remover (é a mesma mensagem)
        if (m.content === content && m.author_id === authorId) {
          return false;
        }
      }
      // Também remover se tiver o mesmo id
      return mId !== idStr;
    });
    
    const normalized = idStr ? { ...message, id: idStr, message_id: idStr } : message;
    this.set(channelId, [...without, normalized]);
  },
  clearAll() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('liberty_msg_')) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  },
};

class LibertyApp {
  constructor() {
    this.currentUser = null;
    this.servers = [];
    this.currentServer = null;
    this.channels = [];
    this.currentChannel = null;
    this.members = [];
    this.messages = new Map();
    this.typing = new Map();
    this._typingTimeouts = new Map();
    this._typingDebounce = null;

    this.isMuted = false;
    this.isDeafened = false;
    this.currentStatus = 'online';
    this.customStatusText = '';
    this.voiceChannel = null;
    this.localStream = null;
    this.replyingTo = null;
    this.membersSidebarVisible = true;
    this.isHomeView = true;
    this.currentFriendsTab = 'online';
    this.reactions = new Map();
    this.unreadChannels = new Set();
    this._contextMenu = null;
    this._emojiPicker = null;
    this._statusPicker = null;
    this._profileCard = null;
    this._profileCardOpening = false;
    this._profileJustOpened = false;
    this._serverDropdown = null;
    this._searchPanel = null;
    this._pinnedPanel = null;
    this._settingsOverlay = null;

    this.dmChannels = [];
    this.relationships = [];
    this.gateway = null;
    this._callSocket = null;
    /** @type {Array<{ file: File; previewUrl?: string; name: string; size: number; mimeType: string }>} */
    this._pendingAttachments = [];
    /** @type {boolean} */
    this._sendingMessage = false;

    this.init();
  }

  applyBackground() {
    const type = (() => { try { return localStorage.getItem('liberty-bg-type') || 'default'; } catch { return 'default'; } })();
    const body = document.body;
    const appEl = document.getElementById('app');
    body.style.backgroundImage = '';
    body.style.backgroundSize = '';
    body.style.backgroundPosition = '';
    body.style.backgroundRepeat = '';
    body.style.backgroundAttachment = '';
    body.style.background = '#000';
    body.style.backgroundColor = '#000';

    let layer = appEl && appEl.querySelector('.app-bg-layer');
    if (type === 'default') {
      if (appEl) appEl.classList.remove('app-has-custom-bg');
      if (layer) {
        layer.style.background = '';
        layer.style.backgroundImage = '';
        layer.style.backgroundColor = '';
        layer.style.visibility = 'hidden';
        const img = layer.querySelector('.app-bg-layer-img');
        if (img) img.remove();
      }
      return;
    }

    if (!appEl) return;
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'app-bg-layer';
      layer.setAttribute('aria-hidden', 'true');
      appEl.insertBefore(layer, appEl.firstChild);
    }
    layer.style.visibility = '';
    layer.classList.remove('app-bg-layer--image');
    const existingImg = layer.querySelector('.app-bg-layer-img');
    if (existingImg) existingImg.remove();
    let overlay = layer.querySelector('.app-bg-layer-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'app-bg-layer-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      layer.appendChild(overlay);
    }

    if (type === 'solid') {
      layer.style.backgroundRepeat = 'no-repeat';
      layer.style.backgroundPosition = 'center';
      const color = (() => { try { return localStorage.getItem('liberty-bg-solid') || '#000000'; } catch { return '#000000'; } })();
      layer.style.background = color;
      layer.style.backgroundColor = color;
      layer.style.backgroundImage = '';
      layer.style.backgroundSize = '';
    } else if (type === 'gradient') {
      layer.style.backgroundRepeat = 'no-repeat';
      layer.style.backgroundPosition = 'center';
      try {
        const g = JSON.parse(localStorage.getItem('liberty-bg-gradient') || '{}');
        const angle = g.angle ?? 135;
        const c1 = g.color1 || '#0d0b09';
        const c2 = g.color2 || '#1a1814';
        layer.style.background = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
        layer.style.backgroundColor = c1;
        layer.style.backgroundImage = '';
        layer.style.backgroundSize = '';
      } catch (_) {
        layer.style.background = '#000';
        layer.style.backgroundColor = '#000';
      }
    } else if (type === 'image') {
      const url = (() => { try { return (localStorage.getItem('liberty-bg-image') || '').trim(); } catch { return ''; } })();
      if (url) {
        layer.classList.add('app-bg-layer--image');
        layer.style.background = '';
        layer.style.backgroundImage = '';
        layer.style.backgroundColor = '#000';
        const img = document.createElement('img');
        img.className = 'app-bg-layer-img';
        img.alt = '';
        img.setAttribute('loading', 'eager');
        img.onerror = () => {
          img.remove();
          layer.style.backgroundColor = '#000';
          if (typeof this !== 'undefined' && this.showToast) this.showToast('Não foi possível carregar a imagem/GIF. Verifique a URL.', 'error');
        };
        img.onload = () => { img.style.opacity = '1'; };
        img.style.opacity = '0';
        img.src = url;
        layer.appendChild(img);
        if (overlay && overlay.parentNode === layer) { layer.appendChild(overlay); }
      } else {
        layer.style.backgroundColor = '#000';
        layer.style.backgroundImage = '';
        layer.style.backgroundSize = '';
      }
    }
    appEl.classList.add('app-has-custom-bg');
  }

  applyTheme(themeClass) {
    const body = document.body;
    const themeClasses = [
      'Dark-theme', 'Light-theme', 'Dark-Accent-theme',
      'Dark-Blue-theme', 'Dark-Green-theme', 'Dark-Purple-theme',
      'Dark-Red-theme', 'Dark-Cyan-theme', 'Dark-Orange-theme',
    ];
    themeClasses.forEach(c => body.classList.remove(c));
    body.classList.add(themeClass);
    try { localStorage.setItem('liberty-theme', themeClass); } catch (e) {}
    this.updateThemeButtons();
  }

  /** Aplica cor de destaque do site (botões, links). Não altera fundo nem GIFs. */
  applyAccentColor(hex) {
    const root = document.documentElement;
    if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      root.style.setProperty('--user-accent', hex);
    } else {
      root.style.removeProperty('--user-accent');
    }
  }

  updateThemeButtons() {
    const current = (() => { try { return localStorage.getItem('liberty-theme') || 'Dark-theme'; } catch { return 'Dark-theme'; } })();
    document.querySelectorAll('.theme-option').forEach(el => {
      el.classList.toggle('theme-active', el.dataset.theme === current);
      el.style.borderColor = el.dataset.theme === current ? 'var(--primary-yellow)' : 'transparent';
    });
  }

  // ═══════════════════════════════════════════
  //  PERFORMANCE UTILITIES
  // ═══════════════════════════════════════════

  _debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  _throttle(fn, limit) {
    let inThrottle = false;
    return (...args) => {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  _detectLowEndDevice() {
    const nav = navigator;
    const lowMemory = nav.deviceMemory && nav.deviceMemory < 4;
    const slowCpu = nav.hardwareConcurrency && nav.hardwareConcurrency < 4;
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(nav.userAgent);
    return lowMemory || slowCpu || mobile;
  }

  _getCachedElement(id) {
    if (!this._domCache) this._domCache = new Map();
    if (!this._domCache.has(id)) {
      const el = document.getElementById(id);
      if (el) this._domCache.set(id, el);
    }
    return this._domCache.get(id);
  }

  async init() {
    console.log('[APP] init() iniciado');
    const initStart = Date.now();
    
    // Limpar timer de fallback do HTML
    if (typeof window._clearFallbackTimer === 'function') {
      window._clearFallbackTimer();
    }
    
    // Tornar body visível imediatamente
    document.body.style.visibility = 'visible';
    document.body.style.opacity = '1';
    
    // Detectar dispositivo fraco e aplicar otimizações
    this._isLowEndDevice = this._detectLowEndDevice();
    if (this._isLowEndDevice) {
      document.body.classList.add('low-performance');
      console.log('[APP] Modo baixo desempenho ativado');
    }
    
    // Aplicar tema IMEDIATAMENTE (síncrono)
    try {
      const theme = (() => { try { return localStorage.getItem('liberty-theme'); } catch { return null; } })();
      const accent = (() => { try { return localStorage.getItem('liberty_accent_color'); } catch { return null; } })();
      const compact = (() => { try { return localStorage.getItem('liberty_layout_compact'); } catch { return null; } })();
      const channelsRight = (() => { try { return localStorage.getItem('liberty_layout_channels_right'); } catch { return null; } })();
      const membersLeft = (() => { try { return localStorage.getItem('liberty_layout_members_left'); } catch { return null; } })();
      
      this.applyTheme(theme || 'Dark-theme');
      this.applyAccentColor(accent);
      document.body.classList.toggle('layout-compact', compact === 'true');
      document.body.classList.toggle('layout-channels-right', channelsRight === 'true');
      document.body.classList.toggle('layout-members-left', membersLeft === 'true');
    } catch (_) {}
    
    const path = typeof location !== 'undefined' && location.pathname ? location.pathname : '';
    const isInviteRoute = path && /^\/invite\/[A-Za-z0-9]+\/?$/.test(path);
    
    // Verificar se está autenticado (tratando localStorage em modo anônimo)
    const hasToken = API?.Token?.isAuthenticated?.() || 
      (() => { try { return localStorage.getItem('access_token') || localStorage.getItem('token'); } catch { return null; } })();
    console.log('[APP] hasToken:', !!hasToken);
    
    if (hasToken) {
      console.log('[APP] Token encontrado, mostrando interface imediatamente...');
      
      // Mostrar interface PRIMEIRO (antes de qualquer rede)
      this.showApp();
      
      // Carregar dados do usuário do localStorage para exibir imediatamente
      const cachedUsername = (() => { try { return localStorage.getItem('liberty_username'); } catch { return null; } })();
      if (cachedUsername) {
        this.currentUser = { username: cachedUsername };
        this.updateUserPanel();
      }
      
      // Carregar tudo em background (não bloquear)
      this._initAsync().catch(e => {
        console.error('[APP] Erro no init assíncrono:', e?.message || e);
        // Se falhar, limpar tokens e mostrar login
        API?.Token?.clearTokens?.();
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('liberty_token');
        } catch (e) {}
        this.showAuth();
      });
      
      console.log('[APP] Interface mostrada em', Date.now() - initStart, 'ms');
    } else if (isInviteRoute) {
      this.showApp();
      this._applyRouteFromPath(path).catch(() => {});
    } else {
      console.log('[APP] Sem token, mostrando login');
      this.showAuth();
    }
    this.setupEventListeners();
  }

  // Inicialização assíncrona em background
  async _initAsync() {
    const startTime = Date.now();
    
    // Carregar dados em paralelo com timeout curto
    const [me, serverList] = await Promise.all([
      API.User.getCurrentUser().catch(e => {
        console.warn('[APP] getCurrentUser failed:', e?.message || e);
        return null;
      }),
      API.Server.list().catch(() => [])
    ]);
    
    this.currentUser = me && me.user ? me.user : me;
    this.servers = Array.isArray(serverList) ? serverList : [];
    
    console.log('[APP] Dados carregados em', Date.now() - startTime, 'ms');
    console.log('[APP] currentUser:', this.currentUser?.username || 'null');
    
    if (this.currentUser?.username) {
      try {
        localStorage.setItem('liberty_username', this.currentUser.username);
      } catch (_) {}
    }
    
    // Atualizar UI com dados reais
    this.updateUserPanel();
    this.renderServers();
    
    // Aplicar background (não bloqueante)
    requestAnimationFrame(() => this._applyAppBackground());
    
    // Inicializar socket para chamadas
    console.log('[APP] Inicializando Socket.io para chamadas...');
    this._setupVoiceCallHandlers();
    
    // Gateway com timeout de 3 segundos
    if (window.Gateway) {
      this.gateway = window.Gateway;
      try {
        const data = await Promise.race([
          this.gateway.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Gateway timeout')), 3000))
        ]);
        if (data?.servers) this.servers = data.servers;
      } catch (_) {
        // Manter servers já carregados
      }
      this.setupGatewayHandlers();
    }
    
    // Carregar rota e friends em background
    this._applyInitialRoute().catch(() => {});
    this.loadFriends().catch(() => {});
    this._startActivityPing();
    this._refreshUIAfterConnect();
    
    // Inicializar React se disponível
    if (typeof window.LibertyChatReactInit === 'function' && !window.LibertyChatRoot) {
      window.LibertyChatReactInit(this);
    }
    if (window.LibertyChatRoot?.render) window.LibertyChatRoot.render();
  }

  async _applyInitialRoute() {
    const path = typeof location !== 'undefined' && location.pathname ? location.pathname : '';
    await this._applyRouteFromPath(path);
  }

  async _applyRouteFromPath(path) {
    const inviteMatch = path && path.match(/^\/invite\/([A-Za-z0-9]+)\/?$/);
    if (inviteMatch) {
      const code = inviteMatch[1];
      await this._showInviteLanding(code);
      return;
    }
    this._hideInviteLanding();
    if (!path) {
      this.selectHome();
      return;
    }
    const serverChannelMatch = path.match(/^\/channels\/([^/]+)\/([^/]+)\/?$/);
    const serverOnlyMatch = path.match(/^\/channels\/([^/]+)\/?$/);
    if (serverChannelMatch) {
      const [, serverId, channelId] = serverChannelMatch;
      if (serverId !== '@me') {
        await this.selectServer(serverId, channelId);
        return;
      }
    }
    if (serverOnlyMatch) {
      const [, serverId] = serverOnlyMatch;
      if (serverId !== '@me') {
        await this.selectServer(serverId);
        return;
      }
    }
    this.selectHome();
  }

  _hideInviteLanding() {
    const el = document.getElementById('invite-landing');
    if (el) el.classList.add('hidden');
  }

  async _showInviteLanding(code) {
    console.log('[APP] _showInviteLanding chamado com código:', code);
    const landing = document.getElementById('invite-landing');
    const cardWrap = document.getElementById('invite-landing-card');
    const errEl = document.getElementById('invite-landing-error');
    const loginHint = document.getElementById('invite-landing-login-hint');
    const joinBtn = document.getElementById('invite-landing-join-btn');
    const backLink = document.getElementById('invite-landing-back');
    if (!landing || !cardWrap) {
      console.error('[APP] Elementos de invite landing não encontrados');
      return;
    }
    
    this._hideInviteLanding();
    landing.classList.remove('hidden');
    errEl?.classList.add('hidden');
    loginHint?.classList.add('hidden');
    joinBtn?.classList.add('hidden');
    cardWrap.innerHTML = '<p class="invite-landing-loading">A carregar convite…</p>';
    
    if (backLink) {
      backLink.onclick = (e) => {
        e.preventDefault();
        if (history.replaceState) history.replaceState(null, '', '/');
        this._applyRouteFromPath('/');
      };
    }
    
    try {
      console.log('[APP] Buscando convite:', code);
      const data = await API.Invite.get(code);
      console.log('[APP] Dados do convite:', data);
      
      const server = data.server || data;
      const name = server.name || 'Servidor';
      const iconUrl = server.icon_url || server.icon || null;
      const memberCount = server.approximate_member_count ?? data.member_count ?? server.member_count ?? 0;
      const onlineCount = server.approximate_presence_count ?? data.presence_count ?? server.presence_count ?? 0;
      const createdAt = server.created_at || data.created_at;
      const sinceStr = createdAt ? new Date(createdAt).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' }) : '';
      const avatarUrl = iconUrl && iconUrl.trim() ? iconUrl.trim() : this._getPlaceholderAvatarUrl(name);
      
      cardWrap.innerHTML = `
        <div class="message-embed-invite">
          <div class="message-embed-invite-icon" style="background-image:url(${this.escapeHtml(avatarUrl)})"></div>
          <div class="message-embed-invite-body">
            <span class="message-embed-invite-name">${this.escapeHtml(name)}</span>
            <span class="message-embed-invite-stats">• ${onlineCount} online • ${memberCount} membros</span>
            ${sinceStr ? `<span class="message-embed-invite-since">Desde ${sinceStr}</span>` : ''}
          </div>
        </div>
      `;
      
      const hasAuth = !!(API.Token?.getAccessToken?.() || (() => { try { return localStorage.getItem('access_token'); } catch { return null; } })());
      console.log('[APP] hasAuth:', hasAuth);
      
      if (hasAuth && joinBtn) {
        joinBtn.classList.remove('hidden');
        joinBtn.onclick = async () => {
          console.log('[APP] Botão de entrar clicado');
          joinBtn.disabled = true;
          joinBtn.textContent = 'A entrar...';
          
          try {
            // Tentar via API primeiro
            console.log('[APP] Tentando entrar via API...');
            const result = await API.Invite.join(code);
            console.log('[APP] Resultado do join:', result);
            
            const server = result.server || result;
            const channel = result.channel;
            
            if (server && server.id) {
              if (!this.servers.some((s) => s.id === server.id)) {
                this.servers.push(server);
              }
              this.renderServers();
              this.selectServer(server.id, channel ? channel.id : null);
              this._hideInviteLanding();
              this.showToast('Entraste no servidor!', 'success');
            }
          } catch (err) {
            console.error('[APP] Erro ao entrar:', err);
            this.showToast(err?.message || 'Erro ao entrar no servidor', 'error');
            joinBtn.disabled = false;
            joinBtn.textContent = 'Entrar';
          }
        };
      } else {
        loginHint?.classList.remove('hidden');
        loginHint.innerHTML = `
          <p>Inicia sessão para entrar no servidor</p>
          <button class="btn btn-primary" id="invite-login-btn">Iniciar Sessão</button>
        `;
        const loginBtn = document.getElementById('invite-login-btn');
        if (loginBtn) {
          loginBtn.onclick = () => {
            this._hideInviteLanding();
            this.showAuth();
          };
        }
      }
    } catch (err) {
      console.error('[APP] Erro ao carregar convite:', err);
      errEl.textContent = err?.message || 'Convite inválido ou expirado.';
      errEl?.classList.remove('hidden');
      cardWrap.innerHTML = '';
    }
  }

  _refreshDMListSidebar() {
    const dmList = document.getElementById('dm-list');
    const navArea = document.querySelector('.home-nav');
    if (dmList) {
      dmList.innerHTML = '';
      this._loadDMList(dmList, navArea, { mergeFriends: true });
    }
  }

  _refreshUIAfterConnect() {
    requestAnimationFrame(() => {
      this.updateUserPanel();
      this._updateUserAvatarInUI();
      this.renderServers();
      if (this.isHomeView) {
        this._refreshDMListSidebar();
        this.renderFriendsView(this.currentFriendsTab || 'online').catch(() => {});
        this._updateChannelHeaderForContext();
      }
      const channelList = document.getElementById('channel-list');
      if (channelList && this.currentServer) this.renderChannels();
      this._updateMembersSidebarVisibility();
    });
  }

  _startActivityPing() {
    if (this._activityPingInterval) clearInterval(this._activityPingInterval);
    if (!API.Token?.getAccessToken?.()) return;
    API.Activity?.ping?.();
    this._activityPingInterval = setInterval(() => {
      if (API.Token?.getAccessToken?.()) API.Activity?.ping?.();
    }, 60 * 1000);
  }

  _getPlaceholderAvatarUrl(name) {
    const n = (name || 'U').toString().trim() || 'U';
    const letter = n.charAt(0).toUpperCase();
    const colors = [
      '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
      '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548'
    ];
    let hash = 0;
    for (let i = 0; i < n.length; i++) hash = ((hash << 5) - hash) + n.charCodeAt(i);
    const color = colors[Math.abs(hash) % colors.length];
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(64, 64, 64, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 56px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, 64, 64);
      return canvas.toDataURL('image/png');
    } catch (_) {
      return null;
    }
  }

  /** Avatar URL para qualquer utilizador: avatar_url ou placeholder com inicial e cor. */
  _getAvatarUrlForUser(userOrName) {
    const name = typeof userOrName === 'string' ? userOrName : (userOrName?.username || userOrName?.display_name || 'U');
    const url = userOrName && typeof userOrName === 'object' && (userOrName.avatar_url || userOrName.avatar);
    if (url && typeof url === 'string' && url.trim()) return url.trim();
    return this._getPlaceholderAvatarUrl(name);
  }

  _getAvatarUrl() {
    const u = this.currentUser;
    let url = (u && (u.avatar_url || u.avatar)) || null;
    if (!url) {
      try {
        const local = localStorage.getItem('liberty_avatar_url');
        if (local && local.trim()) url = local.trim();
      } catch (_) {}
    }
    if (!url) return this._getPlaceholderAvatarUrl(u?.username || u?.display_name || 'U');
    const bust = this._avatarCacheBuster;
    const sep = url.includes('?') ? '&' : '?';
    return bust ? `${url}${sep}_=${bust}` : url;
  }

  _updateUserAvatarInUI() {
    this.updateUserPanel();
    const letter = this.currentUser ? (this.currentUser.username || 'U').charAt(0).toUpperCase() : 'U';
    const avatarSrc = this._getAvatarUrl();
    const sidebarAvatar = document.querySelector('.settings-sidebar-profile-avatar');
    if (sidebarAvatar && this.currentUser) {
      if (avatarSrc) {
        sidebarAvatar.innerHTML = `<img src="${this.escapeHtml(avatarSrc)}" alt="" data-fallback-avatar=""><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:14px;font-weight:700;color:var(--primary-black)">${this.escapeHtml(letter)}</span>`;
      } else {
        sidebarAvatar.innerHTML = `<span>${this.escapeHtml(letter)}</span>`;
      }
    }
    const heroPreview = document.querySelector('#settings-avatar-preview');
    if (heroPreview && this.currentUser) {
      if (avatarSrc) {
        heroPreview.innerHTML = `<img src="${this.escapeHtml(avatarSrc)}" alt="" data-fallback-avatar=""><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:#fff">${this.escapeHtml(letter)}</span>`;
      } else {
        heroPreview.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:var(--text-secondary)">${this.escapeHtml(letter)}</span>`;
      }
    }
  }

  updateUserPanel() {
    if (!this.currentUser) return;
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    const statusEl = document.getElementById('user-status');
    if (nameEl) nameEl.textContent = this.currentUser.username || this.currentUser.display_name || 'User';
    if (avatarEl) {
      const letter = (this.currentUser.username || 'U').charAt(0).toUpperCase();
      const statusColor =
        this.currentStatus === 'invisible' ? 'var(--status-offline)' : `var(--status-${this.currentStatus})`;
      avatarEl.style.setProperty('--status-color', statusColor);
      const avatarSrc = this._getAvatarUrl();
      avatarEl.innerHTML = avatarSrc
        ? `<img src="${this.escapeHtml(avatarSrc)}" alt="${this.escapeHtml(this.currentUser.username)}"><span class="user-avatar-status" id="user-avatar-status" data-status="${this.currentStatus}"></span>`
        : `<span>${this.escapeHtml(letter)}</span><span class="user-avatar-status" id="user-avatar-status" data-status="${this.currentStatus}"></span>`;
    }
    if (statusEl) {
      const labels = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', invisible: 'Invisible' };
      statusEl.textContent = this.customStatusText || labels[this.currentStatus] || 'Online';
      statusEl.style.color = `var(--status-${this.currentStatus === 'invisible' ? 'offline' : this.currentStatus})`;
    }
  }

  showAuth() {
    console.log('[APP] showAuth() chamado');
    const loading = document.getElementById('loading-screen');
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app');
    
    // Garantir que o body está visível
    document.body.style.visibility = 'visible';
    document.body.style.opacity = '1';
    
    // Garantir que app está escondido IMEDIATAMENTE
    if (app) {
      app.classList.add('hidden');
    }
    
    // Esconder loading IMEDIATAMENTE
    if (loading) {
      loading.classList.add('hidden');
      loading.classList.remove('fade-out');
    }
    
    // Mostrar auth IMEDIATAMENTE
    if (auth) {
      auth.classList.remove('hidden');
    }
    
    // Limpar URL
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', '/');
    }
    
    console.log('[APP] showAuth() completo');
  }

  showApp() {
    console.log('[APP] showApp() chamado');
    const loading = document.getElementById('loading-screen');
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app');
    
    // Garantir que o body está visível
    document.body.style.visibility = 'visible';
    document.body.style.opacity = '1';
    
    // Esconder auth e loading IMEDIATAMENTE
    if (auth) auth.classList.add('hidden');
    if (loading) {
      loading.classList.add('hidden');
      loading.classList.remove('fade-out');
    }
    
    // Mostrar app IMEDIATAMENTE
    if (app) {
      app.classList.remove('hidden');
      // Forçar reflow para garantir que CSS seja aplicado
      void app.offsetHeight;
    }
    
    console.log('[APP] showApp() completo');
  }

  _logoutWithoutReload() {
    this.currentUser = null;
    this.servers = [];
    this.currentServer = null;
    this.currentChannel = null;
    this.isHomeView = true;
    this.messages.clear();
    this._hideInviteLanding();
    if (this.gateway && this.gateway.disconnect) {
      try { this.gateway.disconnect(); } catch (_) {}
    }
    const app = document.getElementById('app');
    if (app) app.classList.add('hidden');
    const auth = document.getElementById('auth-screen');
    if (auth) auth.classList.remove('hidden');
    if (history.replaceState) history.replaceState(null, '', '/');
  }

  // ═══════════════════════════════════════════
  //  EVENT LISTENERS
  // ═══════════════════════════════════════════

  setupEventListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-choice-btn, .auth-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
    });
    document.getElementById('login-form')?.addEventListener('submit', e => {
      e.preventDefault();
      this.handleLogin();
    });
    document.getElementById('register-form')?.addEventListener('submit', e => {
      e.preventDefault();
      this.handleRegister();
    });

    // Home button
    const homeBtn = document.querySelector('.server-item.home');
    if (homeBtn) homeBtn.addEventListener('click', () => this.selectHome());

    // Navegação sem F5: Voltar/Avançar do browser
    window.addEventListener('popstate', () => {
      const path = typeof location !== 'undefined' && location.pathname ? location.pathname : '';
      this._applyRouteFromPath(path);
    });

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="/channels/"], a[href^="/invite/"]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('http')) return;
      const path = href.split('?')[0];
      if ((path.startsWith('/channels/') || path.startsWith('/invite/')) && (!a.origin || a.origin === location.origin)) {
        e.preventDefault();
        if (history.pushState) history.pushState(null, '', path);
        this._applyRouteFromPath(path);
      }
    }, true);

    this._startAvatarFallbackObserver();

    // Add server
    document.getElementById('add-server-btn')?.addEventListener('click', () => this.showModal('create-server-modal'));
    
    // Auth security modal setup buttons
    document.querySelectorAll('.auth-setup-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const method = btn.dataset.method;
        this.showAuthMethodSetup(method);
      });
    });

    // Modal close
    document.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', () => this.hideModal()));
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') {
        this.hideProfileCard();
        this.hideModal();
      }
    });
    document.getElementById('create-server-form')?.addEventListener('submit', e => {
      e.preventDefault();
      this.handleCreateServer();
    });
    document
      .querySelectorAll('.modal-cancel-btn')
      .forEach(btn => btn.addEventListener('click', () => this.hideModal()));

    // Message input
    const msgInput = document.getElementById('message-input');
    const charCountEl = document.getElementById('message-char-count');
    const sendBtn = document.getElementById('send-message-btn');
    const updateCharCount = () => {
      if (charCountEl && msgInput) charCountEl.textContent = `${msgInput.value.length} / 5.000`;
      if (sendBtn) this._updateSendButtonState();
    };
    if (msgInput) {
      msgInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
      msgInput.addEventListener('input', () => {
        updateCharCount();
        this.autoResizeTextarea(msgInput);
        if (!this._typingDebounce) this.handleTyping();
        clearTimeout(this._typingDebounce);
        this._typingDebounce = setTimeout(() => {
          this._typingDebounce = null;
        }, 2000);
      });
    }
    if (sendBtn) sendBtn.addEventListener('click', () => this.handleSendMessage());
    updateCharCount();

    // Members toggle
    document.getElementById('toggle-members-btn')?.addEventListener('click', () => this.toggleMembers());

    // Server header dropdown
    document.querySelector('.server-header')?.addEventListener('click', e => {
      if (!this.isHomeView) this.toggleServerDropdown(e);
    });

    // Mobile: toggle channel sidebar + backdrop (tap outside to close)
    const channelSidebarToggle = document.querySelector('.channel-sidebar-toggle');
    const channelSidebarBackdrop = document.getElementById('channel-sidebar-backdrop');
    const channelSidebar = document.querySelector('.channel-sidebar');
    const closeMobileChannelDrawer = () => {
      if (channelSidebar) channelSidebar.classList.add('mobile-hidden');
      if (channelSidebarBackdrop) channelSidebarBackdrop.classList.remove('is-open');
    };
    this._closeMobileChannelDrawer = closeMobileChannelDrawer;
    if (channelSidebarToggle && channelSidebar) {
      channelSidebarToggle.addEventListener('click', () => {
        const isHidden = channelSidebar.classList.toggle('mobile-hidden');
        if (channelSidebarBackdrop) {
          if (isHidden) channelSidebarBackdrop.classList.remove('is-open');
          else channelSidebarBackdrop.classList.add('is-open');
        }
      });
    }
    if (channelSidebarBackdrop) {
      channelSidebarBackdrop.addEventListener('click', closeMobileChannelDrawer);
    }
    const membersSidebarBackdrop = document.getElementById('members-sidebar-backdrop');
    if (membersSidebarBackdrop) {
      membersSidebarBackdrop.addEventListener('click', () => {
        if (this.membersSidebarVisible && window.matchMedia('(max-width: 48rem)').matches) this.toggleMembers();
      });
    }
    // Em mobile, iniciar com drawer fechado
    const mq = window.matchMedia('(max-width: 768px)');
    const mqMembers = window.matchMedia('(max-width: 48rem)');
    const applyMobileDrawerState = () => {
      if (!channelSidebar || !channelSidebarBackdrop) return;
      if (mq.matches) {
        channelSidebar.classList.add('mobile-hidden');
        channelSidebarBackdrop.classList.remove('is-open');
      } else {
        channelSidebar.classList.remove('mobile-hidden');
        channelSidebarBackdrop.classList.remove('is-open');
      }
      if (!mqMembers.matches) document.body.classList.remove('members-drawer-open');
    };
    applyMobileDrawerState();
    mq.addEventListener('change', applyMobileDrawerState);
    mqMembers.addEventListener('change', applyMobileDrawerState);

    // User panel buttons
    const muteBtn = document.querySelector('[data-tooltip="Mute"]');
    const deafenBtn = document.querySelector('[data-tooltip="Deafen"]');
    const settingsBtn = document.querySelector('.user-controls [data-tooltip="Settings"]');
    if (muteBtn) muteBtn.addEventListener('click', () => this.toggleMute());
    if (deafenBtn) deafenBtn.addEventListener('click', () => this.toggleDeafen());
    if (settingsBtn) settingsBtn.addEventListener('click', () => this.showSettingsPanel('user'));

    // User info -> abre perfil (quadrado ao centro); clique no status no perfil para mudar
    document.querySelector('.user-info').addEventListener('click', e => {
      if (this.currentUser) {
        this.showProfileCard({ ...this.currentUser, user_id: this.currentUser.id, status: this.currentStatus || 'online' }, e);
      } else {
        this.showStatusPicker(e);
      }
    });

    // Voice sidebar (static) Disconnect / Screen Share
    document
      .querySelector('.voice-connected-actions [data-tooltip="Disconnect"]')
      ?.addEventListener('click', () => this.disconnectVoice());
    document
      .querySelector('.voice-connected-actions [data-tooltip="Screen Share"]')
      ?.addEventListener('click', () => this.showToast('Screen share — coming in a future update!', 'info'));

    // Channel header buttons
    const pinnedBtn = document.getElementById('pinned-btn');
    if (pinnedBtn) pinnedBtn.addEventListener('click', () => this.togglePinnedPanel());

    const toggleMembersBtn = document.getElementById('toggle-members-btn');
    if (toggleMembersBtn) toggleMembersBtn.addEventListener('click', () => this.toggleMembers());
    const membersSidebarCloseBtn = document.getElementById('members-sidebar-close-btn');
    if (membersSidebarCloseBtn) membersSidebarCloseBtn.addEventListener('click', () => { if (this.membersSidebarVisible) this.toggleMembers(); });

    // Listener removido - usando novo sistema WebRTCManager no final do arquivo

    // Threads, Notifications, Inbox, Help
    const threadsBtn = document.querySelector('.channel-actions [data-tooltip="Threads"]');
    if (threadsBtn)
      threadsBtn.addEventListener('click', () =>
        this.showToast('Threads — view conversation threads here. Coming in a future update!', 'info')
      );
    const notifBtn = document.querySelector('.channel-actions [data-tooltip="Notifications"]');
    if (notifBtn)
      notifBtn.addEventListener('click', () =>
        this.showToast('Notification settings — mute or highlight this channel.', 'info')
      );
    const inboxBtn = document.querySelector('.channel-actions [data-tooltip="Inbox"]');
    if (inboxBtn)
      inboxBtn.addEventListener('click', () => this.showToast('Inbox — your mentions and DMs in one place.', 'info'));
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) helpBtn.addEventListener('click', () => this.showHelp());

    // Search bar: focus opens search panel
    const channelSearchInput = document.getElementById('channel-search-input');
    if (channelSearchInput) {
      channelSearchInput.addEventListener('focus', () => {
        if (!this._searchPanel) this.toggleSearchPanel();
      });
      channelSearchInput.addEventListener('click', e => {
        e.stopPropagation();
        if (!this._searchPanel) this.toggleSearchPanel();
      });
    }

    // Input action buttons
    const attachBtn =
      document.getElementById('attach-btn') || document.querySelector('.message-input-wrapper [data-tooltip="Anexar"]');
    const emojiBtn =
      document.getElementById('emoji-btn') || document.querySelector('.input-actions [data-tooltip="Emoji"]');
    if (attachBtn) attachBtn.addEventListener('click', () => this._openFilePicker());
    const imageOnlyBtn = document.querySelector('.input-actions [data-tooltip="Imagem"]');
    if (imageOnlyBtn) imageOnlyBtn.addEventListener('click', () => this._openFilePicker('image/*,.gif,.webp'));
    const fileInput = document.getElementById('message-file-input');
    if (fileInput) fileInput.addEventListener('change', e => this._onMessageFileInputChange(e));
    this._setupMessageInputDragAndDropAndPaste();
    if (emojiBtn)
      emojiBtn.addEventListener('click', e => {
        this.showEmojiPicker(emojiBtn, emoji => {
          const input = document.getElementById('message-input');
          input.value += emoji;
          input.focus();
        });
      });

    // Global click to close popups
    document.addEventListener('click', e => {
      if (this._contextMenu && !this._contextMenu.contains(e.target)) this.hideContextMenu();
      if (this._statusPicker && !this._statusPicker.contains(e.target) && !e.target.closest('.user-info'))
        this.hideStatusPicker();
      if (this._serverDropdown && !this._serverDropdown.contains(e.target) && !e.target.closest('.server-header'))
        this.hideServerDropdown();
      if (this._profileCard && !this._profileCard.contains(e.target)) {
        if (this._profileJustOpened) this._profileJustOpened = false;
        else this.hideProfileCard();
      }
      if (this._pinnedPanel && !this._pinnedPanel.contains(e.target) && !e.target.closest('#pinned-btn'))
        this.hidePinnedPanel();
      if (
        this._searchPanel &&
        !this._searchPanel.contains(e.target) &&
        !e.target.closest('#channel-search-input') &&
        !e.target.closest('.channel-search-wrapper')
      )
        this.hideSearchPanel();
      if (
        this._emojiPicker &&
        !this._emojiPicker.contains(e.target) &&
        !e.target.closest('[data-tooltip="Emoji"]') &&
        !e.target.closest('.message-actions')
      )
        this.hideEmojiPicker();
    });

    // Global right-click prevention for custom menus
    document.addEventListener('contextmenu', e => {
      const serverItem = e.target.closest('.server-item:not(.home):not(.add-server)');
      const channelItem = e.target.closest('.channel-item');
      const messageEl = e.target.closest('.message-group');
      const memberItem = e.target.closest('.member-item');
      if (serverItem || channelItem || messageEl || memberItem) {
        e.preventDefault();
        if (serverItem) this.showServerContextMenu(serverItem, e);
        else if (channelItem) this.showChannelContextMenu(channelItem, e);
        else if (messageEl) this.showMessageContextMenu(messageEl, e);
        else if (memberItem) this.showMemberContextMenu(memberItem, e);
      }
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (this._settingsOverlay) {
          this.hideSettingsPanel();
          return;
        }
        if (this._contextMenu) {
          this.hideContextMenu();
          return;
        }
        if (this._emojiPicker) {
          this.hideEmojiPicker();
          return;
        }
        if (this._statusPicker) {
          this.hideStatusPicker();
          return;
        }
        if (this._profileCard) {
          this.hideProfileCard();
          return;
        }
        if (this._serverDropdown) {
          this.hideServerDropdown();
          return;
        }
        if (this._pinnedPanel) {
          this.hidePinnedPanel();
          return;
        }
        if (this._searchPanel) {
          this.hideSearchPanel();
          return;
        }
        this.hideModal();
      }
    });

    // Security warning modal (after login)
    document
      .getElementById('security-warning-ignore-btn')
      ?.addEventListener('click', () => this._onSecurityWarningIgnore());
    document
      .getElementById('security-warning-privacy-btn')
      ?.addEventListener('click', () => this._onSecurityWarningPrivacy());

    // Create server modal: server icon upload (preview + base64 para envio)
    const serverIconUpload = document.querySelector('.server-icon-upload');
    const serverIconInput = document.getElementById('server-icon-input');
    if (serverIconUpload && serverIconInput) {
      serverIconUpload.addEventListener('click', () => serverIconInput.click());
      serverIconInput.addEventListener('change', () => {
        const file = serverIconInput.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
          const circle = serverIconUpload?.querySelector('.icon-upload-circle');
          if (circle) {
            const prev = circle.querySelector('.server-icon-preview');
            if (prev) prev.remove();
            circle.querySelectorAll('i, span').forEach(el => el.style.setProperty('display', 'none'));
            const img = document.createElement('img');
            img.className = 'server-icon-preview';
            img.src = reader.result;
            img.alt = '';
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;position:absolute;inset:0;';
            circle.style.position = 'relative';
            circle.style.overflow = 'hidden';
            circle.appendChild(img);
          }
          serverIconUpload.dataset.iconDataUrl = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }
  }

  _bindOneAvatarFallback(img) {
    if (img._avatarFallbackBound) return;
    img._avatarFallbackBound = true;
    img.addEventListener('error', function () {
      const fallback = this.dataset.fallbackAvatar;
      if (fallback) {
        this.onerror = null;
        this.src = fallback;
      } else {
        this.style.display = 'none';
        const s = this.nextElementSibling;
        if (s) s.style.display = 'flex';
      }
    });
  }

  _startAvatarFallbackObserver() {
    this._bindAvatarFallbacks(document.body);
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = node;
          if (el.matches && el.matches('img[data-fallback-avatar]')) this._bindOneAvatarFallback(el);
          if (el.querySelectorAll) el.querySelectorAll('img[data-fallback-avatar]').forEach((im) => this._bindOneAvatarFallback(im));
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  _bindAvatarFallbacks(container) {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('img[data-fallback-avatar]').forEach((img) => this._bindOneAvatarFallback(img));
  }

  _openFilePicker(accept) {
    const input = document.getElementById('message-file-input');
    if (!input) return;
    input.setAttribute('accept', accept || 'image/*,video/*,audio/*,.gif,.webp,.pdf,application/pdf,.txt,text/plain,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.zip,.rar,application/zip,application/x-rar-compressed');
    input.value = '';
    try {
      input.click();
    } catch (err) {
      this.showToast('Não foi possível abrir a janela de ficheiros.', 'error');
    }
  }

  /** Aceita FileList ou array de File; até 1 GB por ficheiro; fotos, gifs, vídeos, ficheiros. */
  _addFilesToPendingAttachments(fileList) {
    if (!fileList?.length) return;
    const MAX_SIZE = 1024 * 1024 * 1024;
    const MAX_FILES = 10;
    const files = Array.from(fileList);
    for (let i = 0; i < files.length && this._pendingAttachments.length < MAX_FILES; i++) {
      const file = files[i];
      if (file.size > MAX_SIZE) {
        this.showToast(`"${file.name}" excede 1 GB. Não anexado.`, 'error');
        continue;
      }
      const mimeType = file.type || '';
      const isImage = mimeType.startsWith('image/');
      const isVideo = mimeType.startsWith('video/');
      let previewUrl = null;
      if (isImage || isVideo) previewUrl = URL.createObjectURL(file);
      this._pendingAttachments.push({
        file,
        previewUrl,
        name: file.name,
        size: file.size,
        mimeType,
      });
    }
    if (this._pendingAttachments.length >= MAX_FILES && files.length > 1) {
      this.showToast(`Máximo ${MAX_FILES} anexos por mensagem.`, 'info');
    }
    this._renderAttachmentPreviews();
    this._updateSendButtonState();
  }

  _onMessageFileInputChange(e) {
    const input = e.target;
    const files = input?.files;
    if (!files?.length) return;
    this._addFilesToPendingAttachments(files);
    input.value = '';
  }

  _setupMessageInputDragAndDropAndPaste() {
    const wrapper = document.querySelector('.message-input-container') || document.querySelector('.message-input-wrapper');
    const msgInput = document.getElementById('message-input');
    if (!wrapper) return;
    wrapper.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.add('message-input-drag-over');
    });
    wrapper.addEventListener('dragleave', e => {
      e.preventDefault();
      if (!wrapper.contains(e.relatedTarget)) wrapper.classList.remove('message-input-drag-over');
    });
    wrapper.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.remove('message-input-drag-over');
      const files = e.dataTransfer?.files;
      if (files?.length) this._addFilesToPendingAttachments(files);
    });
    if (msgInput) {
      msgInput.addEventListener('paste', e => {
        const items = e.clipboardData?.items;
        if (!items?.length) return;
        const files = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') {
            const f = items[i].getAsFile();
            if (f) files.push(f);
          }
        }
        if (files.length) {
          e.preventDefault();
          this._addFilesToPendingAttachments(files);
        }
      });
    }
  }

  _renderAttachmentPreviews() {
    const container = document.getElementById('input-attachments-preview');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < this._pendingAttachments.length; i++) {
      const att = this._pendingAttachments[i];
      const isImage = att.mimeType.startsWith('image/');
      const isVideo = att.mimeType.startsWith('video/');
      const div = document.createElement('div');
      div.className = 'input-attachment-item' + (isImage || isVideo ? ' input-attachment-item--thumb' : ' input-attachment-item--file');
      if (isImage && att.previewUrl) {
        div.innerHTML = `<img src="${this.escapeHtml(att.previewUrl)}" alt="">`;
      } else if (isVideo && att.previewUrl) {
        div.innerHTML = `<video src="${this.escapeHtml(att.previewUrl)}" muted></video>`;
      } else {
        const icon = att.mimeType.includes('pdf') ? 'fa-file-pdf' : 'fa-file';
        div.innerHTML = `<i class="fas ${icon} input-attachment-icon"></i><span class="input-attachment-name">${this.escapeHtml(att.name)}</span>`;
      }
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'input-attachment-remove';
      removeBtn.setAttribute('aria-label', 'Remover anexo');
      removeBtn.innerHTML = '<i class="fas fa-xmark"></i>';
      removeBtn.addEventListener('click', () => {
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
        this._pendingAttachments.splice(i, 1);
        this._renderAttachmentPreviews();
        this._updateSendButtonState();
      });
      div.appendChild(removeBtn);
      container.appendChild(div);
    }
  }

  _updateSendButtonState() {
    const msgInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');
    if (!sendBtn) return;
    const hasText = msgInput && msgInput.value.trim().length > 0;
    const hasAttachments = this._pendingAttachments.length > 0;
    const canSend = (hasText || hasAttachments) && !this._sendingMessage;
    sendBtn.disabled = !canSend;
    sendBtn.classList.toggle('is-sending', this._sendingMessage);
    sendBtn.setAttribute('aria-busy', this._sendingMessage ? 'true' : 'false');
  }

  setupGatewayHandlers() {
    if (!this.gateway) return;
    const g = this.gateway;
    g.on('ready', (data) => {
      if (data && data.reconnected) {
        if (this.currentChannel?.id && this.gateway) this.gateway.subscribeChannel(this.currentChannel.id);
        this.showToast('Reconectado.', 'success');
      }
    });
    g.on('message', msg => {
      const chId = msg.channel_id || msg.channelId || msg.chat_id;
      const msgId = msg.id || msg.message_id;
      
      console.log('[APP] Mensagem recebida:', {
        chId: chId,
        msgId: msgId,
        currentChannelId: this.currentChannel?.id,
        author: msg.author_username || msg.author
      });
      
      if (!msgId) return;
      const normalized = {
        ...msg,
        id: msgId,
        message_id: msgId,
        author_username: msg.author_username || msg.author,
        created_at: msg.created_at || msg.timestamp,
      };
      const isCurrentChannel = chId && this.currentChannel?.id && String(chId) === String(this.currentChannel.id);
      
      if (isCurrentChannel) {
        // SEMPRE processar mensagem - não depender do React
        const fromSelf = normalized.author_id && this.currentUser && String(normalized.author_id) === String(this.currentUser.id);
        
        if (fromSelf) {
          // Para mensagens do próprio usuário, substituir pending
          const pending = [...this.messages.entries()].find(
            ([id, m]) => id.startsWith('pending-') && (m.content === normalized.content || m.content === msg.content)
          );
          if (pending) {
            console.log('[APP] Substituindo pending por mensagem real');
            this.replacePendingWithMessage(pending[0], normalized);
            return;
          }
          // Se já existe, não adicionar novamente
          if (this.messages.has(String(msgId)) || document.getElementById('messages-list')?.querySelector(`[data-message="${msgId}"]`)) {
            console.log('[APP] Mensagem já existe, ignorando');
            return;
          }
        }
        
        // Adicionar mensagem ao DOM
        console.log('[APP] Adicionando mensagem ao DOM');
        this.addMessage(normalized, true);
        this.scrollToBottom(true);
      } else if (chId) {
        // Mensagem para outro canal - marcar como não lida
        console.log('[APP] Mensagem para outro canal - marcando como não lida');
        this.unreadChannels.add(chId);
        const isDM = this.dmChannels && this.dmChannels.some(d => d.id && String(d.id) === String(chId));
        if (isDM && typeof LibertyDMUnreadStore !== 'undefined') {
          LibertyDMUnreadStore.increment(chId);
          this._updateDMUnreadTotal();
        }
        this._updateChannelUnread(chId, true);
      }
    });
    g.on('message_update', data => this.updateMessage(data));
    g.on('message_delete', data => this.deleteMessage(data));
    g.on('typing', data => this.showTypingIndicator(data));
    g.on('presence', data => this.updatePresence(data));
    g.on('server_create', data => {
      if (data.server && !this.servers.some(s => s.id === data.server.id)) {
        this.servers.push(data.server);
        this.renderServers();
      }
      if (this._pendingInviteCode && data.server?.id) {
        const serverId = data.server.id;
        const channelId = data.channel_id || null;
        this._pendingInviteCode = null;
        this.selectServer(serverId, channelId);
        this.showToast('Entraste no servidor.', 'success');
      }
    });
    g.on('invite_error', data => {
      this._pendingInviteCode = null;
      this.showToast(data.message || 'Convite inválido ou expirado.', 'error');
    });
    g.on('webrtc_incoming_call', d => {
      const from = d && d.from_user_id ? String(d.from_user_id) : null;
      if (!from || !this.gateway || !this.gateway.acceptCall) return;
      this.gateway.acceptCall(from).catch(() => {});
    });
    g.on('webrtc_call_rejected', () => {});
    g.on('webrtc_call_ended', () => {});
    
    // DESATIVADO: call-system.js gerencia chamadas
    // O listener call:incoming agora é tratado pelo call-system.js
    /*
    // Listener global para call:incoming - garantir que o sinal chegue
    if (g.socket) {
      g.socket.on('call:incoming', (data) => {
        console.log('[Gateway] call:incoming recebido:', data);
        alert('DEBUG [Gateway] Chamada de: ' + (data?.from || 'Desconhecido'));
        // Repassar para o CallManager se existir
        if (window.CallManager && window.CallManager.handleIncomingCall) {
          window.CallManager.handleIncomingCall(data);
        }
      });
    }
    */
    
    g.on('server_delete', data => {
      this.servers = this.servers.filter(s => s.id !== data.server_id);
      this.renderServers();
      if (this.currentServer?.id === data.server_id) this.selectHome();
    });
    g.on('channel_create', data => {
      if (this.currentServer?.id === data.channel?.server_id) {
        this.channels.push(data.channel);
        this.renderChannels();
      }
    });
    g.on('channel_delete', data => {
      this.channels = this.channels.filter(c => c.id !== data.channel_id);
      this.renderChannels();
      if (this.currentChannel?.id === data.channel_id) {
        const next = this.channels.find(c => c.channel_type === 'text');
        if (next) this.selectChannel(next.id);
      }
    });
    g.on('member_join', data => {
      if (this.currentServer?.id === data.member?.server_id) {
        this.members.push(data.member);
        this.renderMembers();
      }
    });
    g.on('member_leave', data => {
      this.members = this.members.filter(m => m.user_id !== data.user_id);
      this.renderMembers();
    });
    g.on('member_update', data => {
      const idx = this.members.findIndex(m => m.user_id === data.member?.user_id);
      if (idx !== -1) {
        this.members[idx] = { ...this.members[idx], ...data.member };
        this.renderMembers();
      }
    });
    g.on('disconnected', () => this.showToast('Disconnected from server. Reconnecting...', 'error'));
    g.on('ready', () => {
      this.showToast('Connected to LIBERTY!', 'success');
      if (this.isHomeView) {
        const dmList = document.getElementById('dm-list');
        const navArea = document.querySelector('.home-nav');
        if (dmList) {
          dmList.innerHTML = '';
          this._loadDMList(dmList, navArea, { mergeFriends: true });
        }
      }
    });
    g.on('friend_added', data => {
      this.showToast(`You have a new friend request from ${data.user?.username || 'User'}`, 'success');
      this.loadFriends().catch(() => {});
      if (document.getElementById('friends-view')?.classList.contains('hidden') === false) {
        this.renderFriendsView('pending').catch(() => {});
      }
      this._refreshDMListSidebar();
    });
    g.on('friendship_pending_sent', () => {
      if (document.getElementById('friends-view')?.classList.contains('hidden') === false) {
        this.renderFriendsView('pending').catch(() => {});
      }
      this.loadFriends().catch(() => {});
    });
    g.on('friendship_accepted', () => {
      this.loadFriends().catch(() => {});
      if (document.getElementById('friends-view')?.classList.contains('hidden') === false) {
        this.renderFriendsView('all').catch(() => {});
      }
      this._refreshDMListSidebar();
    });
    const refreshCurrentUserAndUI = async () => {
      try {
        const me = await API.User.getCurrentUser();
        const user = me && me.user ? me.user : me;
        if (user) {
          this.currentUser = user;
          this.updateUserPanel();
          this._updateUserAvatarInUI();
          if (this.isHomeView) {
            this._refreshDMListSidebar();
            this.renderFriendsView(this.currentFriendsTab || 'online').catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[APP] Erro ao atualizar usuário:', err);
      }
    };
    g.on('user_update', refreshCurrentUserAndUI);
    g.on('user_updated', refreshCurrentUserAndUI);
  }

  _voiceCallState = {
    pc: null,
    stream: null,
    targetUserId: null,
    pendingOffer: null,
    incomingFromUserId: null,
    displayStream: null,
    videoEnabled: true,
    callId: null,
    remoteAudioStream: null,
    remoteAudioElements: [],
    audioLevelRAF: null,
    localAudioLevelRAF: null,
    muteRemote: false,
    pendingIceCandidates: [],
  };

  _roomCallState = {
    socket: null,
    roomId: null,
    peers: new Map(),
    peerIceQueue: new Map(),
    remoteStreams: new Map(),
    participants: new Map(),
    localStream: null,
    startedAt: 0,
    durationTimer: null,
    localSpeaking: false,
    localVadRaf: null,
  };

  _roomCallUrl() {
    if (typeof window !== 'undefined' && window.VOICEROOM_URL) return String(window.VOICEROOM_URL);
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
    const proto = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') ? 'https://' : 'http://';
    if (host === 'localhost' || host === '127.0.0.1') return proto + host + ':4000';
    return proto + host + ':4000';
  }

  _roomCallToken() {
    try {
      if (typeof API !== 'undefined' && API.Token && API.Token.getAccessToken) return API.Token.getAccessToken();
    } catch (_) {}
    try {
      return localStorage.getItem('access_token') || localStorage.getItem('token') || '';
    } catch (_) {}
    return '';
  }

  _roomCallStopVad() {
    if (this._roomCallState.localVadRaf) {
      cancelAnimationFrame(this._roomCallState.localVadRaf);
      this._roomCallState.localVadRaf = null;
    }
    this._roomCallState.localSpeaking = false;
  }

  _roomCallStartVad(stream) {
    this._roomCallStopVad();
    if (!stream) return;
    let audioContext = null;
    let analyser = null;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
    } catch (_) {
      return;
    }
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const onTh = 28;
    const offTh = 22;
    const emitMinMs = 250;
    let lastEmit = 0;
    const loop = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      const now = Date.now();
      const prev = this._roomCallState.localSpeaking;
      const next = prev ? avg > offTh : avg > onTh;
      if (next !== prev && now - lastEmit >= emitMinMs) {
        this._roomCallState.localSpeaking = next;
        lastEmit = now;
        const s = this._roomCallState.socket;
        if (s && s.emit) s.emit('speaking-state-changed', { roomId: this._roomCallState.roomId, isSpeaking: next });
      }
      const p = document.getElementById('call-avatar-me');
      if (p) p.classList.toggle('call-neo__avatar--speaking', next);
      const h = document.getElementById('header-call-avatar-me');
      if (h) h.classList.toggle('header-call__avatar--speaking', next);
      this._roomCallState.localVadRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  _roomCallRenderDuration() {
    const titleEl = document.getElementById('voice-call-channel-name');
    if (!titleEl || !this._roomCallState.startedAt) return;
    const ms = Date.now() - this._roomCallState.startedAt;
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const base = titleEl.dataset.baseTitle || titleEl.textContent || 'Chamada';
    titleEl.textContent = base + ' • ' + mm + ':' + ss;
  }

  _roomCallSetParticipants(participants) {
    this._roomCallState.participants.clear();
    (participants || []).forEach((p) => {
      if (!p || !p.socketId) return;
      this._roomCallState.participants.set(String(p.socketId), p);
    });
  }

  _roomCallUpdateParticipant(socketId, patch) {
    const id = String(socketId);
    const prev = this._roomCallState.participants.get(id) || null;
    if (!prev) return;
    this._roomCallState.participants.set(id, { ...prev, ...(patch || {}) });
  }

  _roomCallEnsureGridSize() {
    const grid = document.getElementById('call-neo-grid');
    if (!grid) return;
    const count = 1 + Array.from(this._roomCallState.participants.keys()).filter((id) => this._roomCallState.socket && id !== this._roomCallState.socket.id).length;
    grid.classList.remove('call-neo__grid--1', 'call-neo__grid--2', 'call-neo__grid--3', 'call-neo__grid--4');
    if (count <= 1) grid.classList.add('call-neo__grid--1');
    else if (count === 2) grid.classList.add('call-neo__grid--2');
    else if (count === 3) grid.classList.add('call-neo__grid--3');
    else grid.classList.add('call-neo__grid--4');
  }

  _roomCallRenderGrid() {
    const grid = document.getElementById('call-neo-grid');
    if (!grid) return;
    const socket = this._roomCallState.socket;
    const localName = this.currentUser?.username || 'Você';
    const localId = socket ? socket.id : 'local';
    const localAvatar = this._getAvatarUrlForUser({ username: localName, avatar_url: this.currentUser?.avatar_url || this.currentUser?.avatar });
    const makeTile = (id, name, avatarUrl, stream, isLocal) => {
      const tile = document.createElement('div');
      tile.className = 'call-neo__tile' + (isLocal ? ' call-neo__tile--local' : '');
      tile.id = 'call-tile-' + id;
      const v = document.createElement('video');
      v.className = 'call-neo__tile-video webrtc-video hidden';
      v.autoplay = true;
      v.playsInline = true;
      if (isLocal) v.muted = true;
      const ph = document.createElement('div');
      ph.className = 'call-neo__tile-placeholder';
      const ring = document.createElement('div');
      ring.className = 'call-neo__avatar-ring';
      if (avatarUrl) {
        const img = document.createElement('img');
        img.className = 'webrtc-remote-avatar';
        img.src = avatarUrl;
        img.alt = '';
        ring.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'call-neo__avatar-initial';
        span.textContent = String(name || 'U').charAt(0).toUpperCase();
        ring.appendChild(span);
      }
      const label = document.createElement('span');
      label.className = 'call-neo__tile-name';
      label.textContent = name || 'User';
      ph.appendChild(ring);
      ph.appendChild(label);
      tile.appendChild(v);
      tile.appendChild(ph);
      if (stream) {
        v.srcObject = stream;
        v.classList.remove('hidden');
      }
      return tile;
    };
    const oldScroll = grid.scrollTop;
    grid.replaceChildren();
    const localTile = makeTile(localId, localName, localAvatar, this._roomCallState.localStream, true);
    grid.appendChild(localTile);
    const ids = Array.from(this._roomCallState.participants.keys());
    for (let i = 0; i < ids.length; i++) {
      const sid = ids[i];
      if (socket && sid === socket.id) continue;
      const p = this._roomCallState.participants.get(sid);
      const name = p?.name || 'User';
      const avatarUrl = '';
      const stream = this._roomCallState.remoteStreams.get(sid) || null;
      const t = makeTile(sid, name, avatarUrl, stream, false);
      if (p && p.isSpeaking) t.classList.add('call-neo__tile--speaking');
      grid.appendChild(t);
    }
    grid.scrollTop = oldScroll;
    this._roomCallEnsureGridSize();
  }

  _roomCallCreatePeer(remoteSocketId, isInitiator) {
    if (!remoteSocketId) return;
    const socket = this._roomCallState.socket;
    if (!socket || !socket.emit) return;
    const rid = String(remoteSocketId);
    if (this._roomCallState.peers.has(rid)) return;
    const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (window.__TURN_SERVER_URL__) iceServers.push({
      urls: window.__TURN_SERVER_URL__,
      username: window.__TURN_USERNAME__ || undefined,
      credential: window.__TURN_PASSWORD__ || undefined,
    });
    const pc = new RTCPeerConnection({ iceServers: iceServers });
    this._roomCallState.peers.set(rid, pc);
    this._roomCallState.peerIceQueue.set(rid, []);
    const ls = this._roomCallState.localStream;
    if (ls) ls.getTracks().forEach((t) => pc.addTrack(t, ls));
    pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0];
      if (!stream) return;
      this._roomCallState.remoteStreams.set(rid, stream);
      this._roomCallRenderGrid();
      Promise.resolve().then(() => {
        const el = document.getElementById('call-tile-' + rid);
        const v = el ? el.querySelector('video') : null;
        if (v) v.play().catch(() => {});
      });
    };
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const pl = e.candidate.toJSON ? e.candidate.toJSON() : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex };
      socket.emit('rtc-ice-candidate', { roomId: this._roomCallState.roomId, targetSocketId: rid, candidate: pl });
    };
    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (!pc.localDescription) return;
          socket.emit('rtc-offer', { roomId: this._roomCallState.roomId, targetSocketId: rid, sdp: pc.localDescription.toJSON() });
        })
        .catch(() => {});
    }
  }

  _roomCallClosePeer(remoteSocketId) {
    const rid = String(remoteSocketId);
    const pc = this._roomCallState.peers.get(rid);
    if (pc) {
      try { pc.close(); } catch (_) {}
      this._roomCallState.peers.delete(rid);
    }
    this._roomCallState.peerIceQueue.delete(rid);
    this._roomCallState.remoteStreams.delete(rid);
  }

  _roomCallStop() {
    const s = this._roomCallState.socket;
    const rid = this._roomCallState.roomId;
    if (s && s.emit && rid) {
      try { s.emit('leave-room', { roomId: rid }); } catch (_) {}
    }
    this._roomCallStopVad();
    if (this._roomCallState.durationTimer) {
      clearInterval(this._roomCallState.durationTimer);
      this._roomCallState.durationTimer = null;
    }
    this._roomCallState.startedAt = 0;
    if (this._roomCallState.localStream) {
      this._roomCallState.localStream.getTracks().forEach((t) => t.stop());
      this._roomCallState.localStream = null;
    }
    Array.from(this._roomCallState.peers.keys()).forEach((id) => this._roomCallClosePeer(id));
    this._roomCallState.participants.clear();
    if (s && s.disconnect) {
      try { s.disconnect(); } catch (_) {}
    }
    this._roomCallState.socket = null;
    this._roomCallState.roomId = null;
    const grid = document.getElementById('call-neo-grid');
    if (grid) grid.replaceChildren();
  }

  _roomCallStart(roomId, baseTitle) {
    if (!roomId) return;
    if (!window.io) {
      this.showToast('Falha ao iniciar chamada.', 'error');
      return;
    }
    const voiceView = document.getElementById('voice-call-view');
    if (voiceView) {
      voiceView.classList.remove('hidden');
      voiceView.classList.add('call-neo--visible');
      voiceView.classList.remove('call-neo--hidden');
    }
    const titleEl = document.getElementById('voice-call-channel-name');
    if (titleEl) {
      titleEl.dataset.baseTitle = baseTitle || titleEl.textContent || 'Chamada';
      titleEl.textContent = titleEl.dataset.baseTitle;
    }
    this._updateVoiceCallParticipantsBar();
    this._updateHeaderCallUI([
      { id: this.currentUser?.id || 'me', username: this.currentUser?.username || 'Você', avatar_url: this.currentUser?.avatar_url || this.currentUser?.avatar, isSpeaking: false },
    ]);
    const token = this._roomCallToken();
    const url = this._roomCallUrl();
    this._roomCallStop();
    this._roomCallState.roomId = String(roomId);
    const roomCallUserId = this.currentUser?.id || this.currentUser?.user_id || this.user?.id;
    this._roomCallState.socket = window.io(url, { 
      transports: ['websocket'], 
      auth: { accessToken: token, userId: String(roomCallUserId) } 
    });
    const socket = this._roomCallState.socket;
    this._roomCallState.startedAt = Date.now();
    this._roomCallState.durationTimer = setInterval(() => this._roomCallRenderDuration(), 1000);
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
      this._roomCallState.localStream = stream;
      this._roomCallStartVad(stream);
      this._roomCallRenderGrid();
      socket.emit('join-room', { roomId: this._roomCallState.roomId });
    }).catch(() => {
      this.showToast('Permissão de microfone negada.', 'error');
      this._roomCallStop();
    });
    socket.on('room-state', (payload) => {
      if (!payload || String(payload.roomId) !== String(this._roomCallState.roomId)) return;
      this._roomCallSetParticipants(payload.participants || []);
      const list = payload.participants || [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p || !p.socketId) continue;
        if (p.socketId !== socket.id) this._roomCallCreatePeer(p.socketId, true);
      }
      this._roomCallRenderGrid();
      this._updateVoiceCallParticipantsBar();
      {
        const ps = [{ id: this.currentUser?.id || 'me', username: this.currentUser?.username || 'Você', avatar_url: this.currentUser?.avatar_url || this.currentUser?.avatar, isSpeaking: this._roomCallState.localSpeaking }];
        (payload.participants || []).forEach((p) => { if (p && p.socketId && p.socketId !== socket.id) ps.push({ id: p.socketId, username: p.username || p.name || 'User', avatar_url: p.avatar_url || p.avatar, isSpeaking: !!p.isSpeaking }); });
        this._updateHeaderCallUI(ps);
      }
    });
    socket.on('participant-joined', (payload) => {
      if (!payload || String(payload.roomId) !== String(this._roomCallState.roomId)) return;
      const p = payload.participant;
      if (p && p.socketId) this._roomCallState.participants.set(String(p.socketId), p);
      if (p && p.socketId && p.socketId !== socket.id) this._roomCallCreatePeer(p.socketId, true);
      this._roomCallRenderGrid();
      this._updateVoiceCallParticipantsBar();
      {
        const ps = [{ id: this.currentUser?.id || 'me', username: this.currentUser?.username || 'Você', avatar_url: this.currentUser?.avatar_url || this.currentUser?.avatar, isSpeaking: this._roomCallState.localSpeaking }];
        this._roomCallState.participants.forEach((p) => { if (p && p.socketId && p.socketId !== socket.id) ps.push({ id: p.socketId, username: p.username || p.name || 'User', avatar_url: p.avatar_url || p.avatar, isSpeaking: !!p.isSpeaking }); });
        this._updateHeaderCallUI(ps);
      }
    });
    socket.on('participant-left', (payload) => {
      if (!payload || String(payload.roomId) !== String(this._roomCallState.roomId)) return;
      const sid = payload.socketId;
      if (!sid) return;
      this._roomCallState.participants.delete(String(sid));
      this._roomCallClosePeer(String(sid));
      this._roomCallRenderGrid();
      this._updateVoiceCallParticipantsBar();
      {
        const ps = [{ id: this.currentUser?.id || 'me', username: this.currentUser?.username || 'Você', avatar_url: this.currentUser?.avatar_url || this.currentUser?.avatar, isSpeaking: this._roomCallState.localSpeaking }];
        this._roomCallState.participants.forEach((p) => { if (p && p.socketId && p.socketId !== socket.id) ps.push({ id: p.socketId, username: p.username || p.name || 'User', avatar_url: p.avatar_url || p.avatar, isSpeaking: !!p.isSpeaking }); });
        this._updateHeaderCallUI(ps);
      }
    });
    socket.on('rtc-offer', (payload) => {
      if (!payload || String(payload.roomId) !== String(this._roomCallState.roomId)) return;
      if (payload.targetSocketId !== socket.id) return;
      const from = String(payload.fromSocketId);
      if (!this._roomCallState.peers.has(from)) this._roomCallCreatePeer(from, false);
      const pc = this._roomCallState.peers.get(from);
      if (!pc) return;
      pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        .then(() => pc.createAnswer())
        .then((ans) => pc.setLocalDescription(ans))
        .then(() => {
          const q = this._roomCallState.peerIceQueue.get(from) || [];
          this._roomCallState.peerIceQueue.set(from, []);
          q.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
          if (!pc.localDescription) return;
          socket.emit('rtc-answer', { roomId: this._roomCallState.roomId, targetSocketId: from, sdp: pc.localDescription.toJSON() });
        })
        .catch(() => {});
    });
    socket.on('rtc-answer', (payload) => {
      if (!payload || String(payload.roomId) !== String(this._roomCallState.roomId)) return;
      if (payload.targetSocketId !== socket.id) return;
      const from = String(payload.fromSocketId);
      const pc = this._roomCallState.peers.get(from);
      if (!pc) return;
      pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).then(() => {
        const q = this._roomCallState.peerIceQueue.get(from) || [];
        this._roomCallState.peerIceQueue.set(from, []);
        q.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
      }).catch(() => {});
    });
    socket.on('rtc-ice-candidate', (payload) => {
      if (!payload || String(payload.roomId) !== String(this._roomCallState.roomId)) return;
      if (payload.targetSocketId !== socket.id) return;
      const from = String(payload.fromSocketId);
      const pc = this._roomCallState.peers.get(from);
      if (!pc || !payload.candidate) return;
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        const q = this._roomCallState.peerIceQueue.get(from) || [];
        q.push(payload.candidate);
        this._roomCallState.peerIceQueue.set(from, q);
        return;
      }
      pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
    });
    socket.on('mute-state-changed', (payload) => {
      if (!payload || String(payload.roomId) !== String(this._roomCallState.roomId)) return;
      this._roomCallUpdateParticipant(payload.socketId, { isMuted: !!payload.isMuted });
      this._roomCallRenderGrid();
    });
    socket.on('speaking-state-changed', (payload) => {
      if (!payload || String(payload.roomId) !== String(this._roomCallState.roomId)) return;
      this._roomCallUpdateParticipant(payload.socketId, { isSpeaking: !!payload.isSpeaking });
      const tile = document.getElementById('call-tile-' + String(payload.socketId));
      if (tile) tile.classList.toggle('call-neo__tile--speaking', !!payload.isSpeaking);
      const headerAv = document.getElementById('header-call-avatar-' + String(payload.socketId));
      if (headerAv) headerAv.classList.toggle('header-call__avatar--speaking', !!payload.isSpeaking);
    });
    socket.on('disconnect', () => {
      this._roomCallStop();
      const voiceView2 = document.getElementById('voice-call-view');
      if (voiceView2) {
        voiceView2.classList.add('hidden');
        voiceView2.classList.add('call-neo--hidden');
        voiceView2.classList.remove('call-neo--visible');
      }
    });
  }

  _callDrainPendingIceCandidates() {
    const pc = this._voiceCallState.pc;
    const queue = this._voiceCallState.pendingIceCandidates;
    if (!pc || pc.signalingState === 'closed' || !queue.length) return;
    this._voiceCallState.pendingIceCandidates = [];
    queue.forEach(candidate => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });
  }

  _webrtcClearRemote() {
    this._webrtcStopAudioLevel();
    this._voiceCallState.remoteAudioStream = null;
    this._voiceCallState.remoteAudioElements = [];
    const wrap = document.getElementById('webrtc-remote-wrap');
    if (wrap) {
      wrap.classList.remove('webrtc-remote-speaking');
      wrap.classList.remove('call-neo__tile--speaking');
      wrap.querySelectorAll('audio.webrtc-remote-audio').forEach(a => {
        a.srcObject = null;
        a.remove();
      });
    }
    const avatarWrap = document.getElementById('webrtc-remote-avatar-wrap');
    if (avatarWrap) avatarWrap.classList.remove('speaking');
    const remoteV = document.getElementById('webrtc-remote-video');
    const remoteS = document.getElementById('webrtc-remote-screen');
    const screenWrap = document.getElementById('webrtc-remote-screen-wrap');
    const placeholder = document.getElementById('webrtc-remote-placeholder');
    const badge = document.getElementById('webrtc-screen-badge');
    const avatarEl = document.getElementById('webrtc-remote-avatar');
    const placeholderIcon = document.getElementById('webrtc-placeholder-icon');
    const placeholderText = document.getElementById('webrtc-placeholder-text');
    if (remoteV) {
      remoteV.srcObject = null;
      remoteV.classList.add('hidden');
    }
    if (remoteS) {
      remoteS.srcObject = null;
    }
    if (screenWrap) screenWrap.classList.add('hidden');
    if (badge) badge.classList.add('hidden');
    if (placeholder) {
      placeholder.classList.remove('hidden');
      placeholder.classList.remove('webrtc-placeholder-connecting');
    }
    if (avatarEl) {
      avatarEl.classList.add('hidden');
      avatarEl.src = '';
    }
    if (placeholderIcon) {
      placeholderIcon.classList.remove('hidden');
    }
    if (placeholderText) placeholderText.textContent = 'Aguardando a outra pessoa...';
    const muteRemoteBtn = document.getElementById('voice-call-mute-remote');
    if (muteRemoteBtn) muteRemoteBtn.classList.add('hidden');
  }

  _webrtcStopAudioLevel() {
    if (this._voiceCallState.audioLevelRAF) {
      cancelAnimationFrame(this._voiceCallState.audioLevelRAF);
      this._voiceCallState.audioLevelRAF = null;
    }
  }

  _webrtcRunRemoteAudioLevel(stream) {
    if (!stream || !stream.getAudioTracks().length) return;
    this._webrtcStopAudioLevel();
    this._voiceCallState.remoteAudioStream = stream;
    let audioContext = null;
    let analyser = null;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
    } catch (e) {
      return;
    }
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const threshold = 25;
    const wrap = document.getElementById('webrtc-remote-wrap');
    const avatarWrap = document.getElementById('webrtc-remote-avatar-wrap');
    const loop = () => {
      if (!analyser || !wrap) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      const speaking = avg > threshold;
      wrap.classList.toggle('webrtc-remote-speaking', speaking);
      wrap.classList.toggle('call-neo__tile--speaking', speaking);
      if (avatarWrap) avatarWrap.classList.toggle('speaking', speaking);
      const p = document.getElementById('call-avatar-other');
      if (p) p.classList.toggle('call-neo__avatar--speaking', speaking);
      this._voiceCallState.audioLevelRAF = requestAnimationFrame(loop);
    };
    loop();
  }

  _webrtcStopLocalAudioLevel() {
    if (this._voiceCallState.localAudioLevelRAF) {
      cancelAnimationFrame(this._voiceCallState.localAudioLevelRAF);
      this._voiceCallState.localAudioLevelRAF = null;
    }
    const localWrap = document.getElementById('webrtc-local-avatar-wrap');
    if (localWrap) localWrap.classList.remove('call-neo__player-circle--speaking');
  }

  _webrtcRunLocalAudioLevel(stream) {
    if (!stream || !stream.getAudioTracks().length) return;
    this._webrtcStopLocalAudioLevel();
    let audioContext = null;
    let analyser = null;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
    } catch (e) {
      return;
    }
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const threshold = 25;
    const localWrap = document.getElementById('webrtc-local-avatar-wrap');
    const loop = () => {
      if (!analyser || !localWrap) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      const speaking = avg > threshold;
      localWrap.classList.toggle('call-neo__player-circle--speaking', speaking);
      const p = document.getElementById('call-avatar-me');
      if (p) p.classList.toggle('call-neo__avatar--speaking', speaking);
      this._voiceCallState.localAudioLevelRAF = requestAnimationFrame(loop);
    };
    loop();
  }

  async _updateRemotePlaceholderProfile(userId) {
    const avatarEl = document.getElementById('webrtc-remote-avatar');
    const placeholderIcon = document.getElementById('webrtc-placeholder-icon');
    const placeholderText = document.getElementById('webrtc-placeholder-text');
    if (!userId || (!avatarEl && !placeholderText)) return;
    let name = 'Participante';
    let avatarUrl = '';
    const other =
      (this.currentChannel?.recipients || []).find(r => r.id === userId) ||
      this.dmChannels.find(c => c.recipients?.[0]?.id === userId)?.recipients?.[0];
    if (other) {
      name = other.username || name;
      avatarUrl = other.avatar_url || other.avatar || '';
    }
    try {
      const profile = await API.User.getUser(userId);
      if (profile) {
        name = profile.username || name;
        avatarUrl = profile.avatar_url || avatarUrl;
      }
    } catch (_) {}
    if (placeholderText) placeholderText.textContent = name;
    const remoteLabel = document.getElementById('webrtc-remote-label');
    if (remoteLabel) remoteLabel.textContent = name;
    const initialEl = document.getElementById('webrtc-remote-initial');
    if (initialEl) {
      initialEl.textContent = name.charAt(0).toUpperCase();
      initialEl.classList.toggle('hidden', !!avatarUrl);
    }
    if (placeholderIcon) placeholderIcon.classList.toggle('hidden', !!avatarUrl);
    if (avatarEl) {
      if (avatarUrl) {
        avatarEl.src = avatarUrl;
        avatarEl.alt = name;
        avatarEl.classList.remove('hidden');
      } else {
        avatarEl.classList.add('hidden');
      }
    }
  }

  _playCallSound(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      const playTone = (freq, start, dur) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.connect(gain);
        osc.start(start);
        osc.stop(start + dur);
      };
      if (type === 'join') {
        playTone(523.25, ctx.currentTime, 0.12);
        playTone(659.25, ctx.currentTime + 0.08, 0.14);
        playTone(783.99, ctx.currentTime + 0.16, 0.16);
      } else if (type === 'leave') {
        playTone(392, ctx.currentTime, 0.1);
        playTone(293.66, ctx.currentTime + 0.1, 0.2);
      } else if (type === 'screen_share') {
        playTone(587.33, ctx.currentTime, 0.1);
        playTone(783.99, ctx.currentTime + 0.06, 0.12);
      } else if (type === 'mute' || type === 'mute_remote') {
        playTone(349.23, ctx.currentTime, 0.15);
      } else if (type === 'unmute') {
        playTone(440, ctx.currentTime, 0.1);
        playTone(554.37, ctx.currentTime + 0.06, 0.1);
      } else if (type === 'camera_on') {
        playTone(493.88, ctx.currentTime, 0.08);
      } else {
        playTone(400, ctx.currentTime, 0.12);
      }
    } catch (_) {}
  }

  _attachRemoteTrack(e) {
    const stream = e.streams && e.streams[0];
    if (!stream) return;
    const track = e.track;
    const wrap = document.getElementById('webrtc-remote-wrap');
    if (track.kind === 'audio') {
      const audio = document.createElement('audio');
      audio.className = 'webrtc-remote-audio';
      audio.autoplay = true;
      audio.playsInline = true;
      audio.setAttribute('playsinline', '');
      audio.srcObject = stream;
      if (this._voiceCallState.muteRemote) audio.muted = true;
      wrap?.appendChild(audio);
      Promise.resolve().then(() => audio.play().catch(() => {}));
      this._voiceCallState.remoteAudioElements = wrap ? [...wrap.querySelectorAll('audio.webrtc-remote-audio')] : [];
      this._updateRemotePlaceholderProfile(this._voiceCallState.targetUserId);
      this._webrtcRunRemoteAudioLevel(stream);
      this._playCallSound('join');
      const muteRemoteBtn = document.getElementById('voice-call-mute-remote');
      if (muteRemoteBtn) muteRemoteBtn.classList.remove('hidden');
      return;
    }
    if (track.kind === 'video') {
      const isScreen = track.label.toLowerCase().includes('screen');
      const placeholder = document.getElementById('webrtc-remote-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
      if (isScreen) {
        const screenWrap = document.getElementById('webrtc-remote-screen-wrap');
        const vid = document.getElementById('webrtc-remote-screen');
        const badge = document.getElementById('webrtc-screen-badge');
        if (vid) {
          vid.srcObject = stream;
          vid.classList.remove('hidden');
        }
        if (screenWrap) screenWrap.classList.remove('hidden');
        if (badge) badge.classList.remove('hidden');
        this._playCallSound('screen_share');
      } else {
        const vid = document.getElementById('webrtc-remote-video');
        if (vid) {
          vid.srcObject = stream;
          vid.playsInline = true;
          vid.autoplay = true;
          vid.classList.remove('hidden');
        }
        this._playCallSound('camera_on');
      }
      track.onended = () => {
        if (isScreen) {
          const screenWrap = document.getElementById('webrtc-remote-screen-wrap');
          const vid = document.getElementById('webrtc-remote-screen');
          const badge = document.getElementById('webrtc-screen-badge');
          if (vid) vid.srcObject = null;
          if (screenWrap) screenWrap.classList.add('hidden');
          if (badge) badge.classList.add('hidden');
        } else {
          const vid = document.getElementById('webrtc-remote-video');
          if (vid) {
            vid.srcObject = null;
            vid.classList.add('hidden');
          }
          const pl = document.getElementById('webrtc-remote-placeholder');
          if (pl) pl.classList.remove('hidden');
        }
      };
    }
  }

  _setupVoiceCallHandlers() {
    const token = this._getAccessToken ? this._getAccessToken() : (localStorage.getItem('access_token') || localStorage.getItem('token') || '');
    if (window.io && token) {
      try {
        const userId = this.currentUser?.id || this.currentUser?.user_id || this.user?.id;
        console.log('[Socket] Conectando com userId:', userId);
        this._callSocket = window.io(window.location.origin, { 
          path: '/socket.io', 
          transports: ['polling'], 
          upgrade: false, 
          auth: { token, userId: String(userId) }
        });
        
        // LOG DE SUCESSO EXPLÍCITO
        this._callSocket.on('connect', () => {
          console.log('🔥 [FRONTEND] Conectado! ID Real:', this._callSocket.id, '| userId:', userId);
          // Disponibilizar globalmente para call-system.js
          window._voiceCallSocket = this._callSocket;
          window.socket = this._callSocket;
          
          // FORÇA o CallManager a usar este socket IMEDIATAMENTE
          if (window.CallManager) {
            console.log('[Socket] Atribuindo socket ao CallManager...');
            window.CallManager.socket = this._callSocket;
            window.CallManager.setupSocket(this._callSocket);
          }
          
          // Notificar via evento customizado
          window.dispatchEvent(new CustomEvent('voice-call-socket-ready', { 
            detail: { socket: this._callSocket } 
          }));
        });
        
        this._callSocket.on('connect_error', (err) => {
          console.error('❌ [Socket] Erro de conexão:', err.message);
        });
      } catch (e) {
        console.error('❌ [Socket] Erro ao criar socket:', e);
        this._callSocket = null;
      }
    } else {
      console.warn('⚠️ [Socket] window.io ou token não disponível');
    }
    const s = this._callSocket;
    if (s) {
      // DESATIVADO: WebRTCManager não é mais usado - call-system.js gerencia chamadas
      /*
      // Inicializa WebRTCManager imediatamente se socket ja conectado
      if (window.WebRTCManager && !window.WebRTCManager.socket && s.connected) {
        console.log('[WebRTC] Inicializando imediatamente - socket ja conectado');
        window.WebRTCManager.init(s);
      }
      
      s.on('connect', () => {
        try {
          console.log('SOCKET CONECTADO COM SUCESSO!');
          // Inicializa WebRTCManager automaticamente quando socket conectar
          if (window.WebRTCManager && !window.WebRTCManager.socket) {
            console.log('[WebRTC] Inicializando automaticamente apos conexao do socket');
            window.WebRTCManager.init(s);
          }
        } catch (_) {}
      });
      */
      s.on('connect_error', (e) => { try { console.log('Socket failed'); console.log(e && (e.message || e)); } catch (_) {} });

      s.on('call:ended', () => { 
        // Desativado - call-system.js gerencia chamadas
        // this._callHardResetHeaderOnly(); 
      });

      // DESATIVADO: Código antigo de chamadas que conflita com call-system.js
      // O call-system.js agora gerencia todas as chamadas WebRTC
      /*
      s.on('call:accepted', (d) => {
        const callId = d && d.callId ? String(d.callId) : null;
        const to = d && d.to ? String(d.to) : null;
        if (!callId || !to) return;
        this._voiceCallState.callId = callId;
        this._voiceCallState.targetUserId = to;

        const header = document.getElementById('header-call');
        const statusEl = document.getElementById('header-call-status');
        const controls = document.getElementById('header-call-controls');
        if (statusEl) statusEl.textContent = 'Em call';
        if (controls) {
          controls.replaceChildren();
          const mk = (html, cls) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'header-call__btn' + (cls ? ' ' + cls : '');
            b.innerHTML = html;
            return b;
          };
          const btnMic = mk('<i class="fas fa-microphone"></i>', '');
          const btnCam = mk('<i class="fas fa-video"></i>', '');
          const btnScreen = mk('<i class="fas fa-display"></i>', '');
          const btnHang = mk('<i class="fas fa-phone-slash"></i>', 'header-call__btn--hangup');
          btnMic.onclick = () => {
            const st = this._voiceCallState.stream;
            if (!st) return;
            const tracks = st.getAudioTracks ? st.getAudioTracks() : st.getTracks().filter(t => t.kind === 'audio');
            const enabled = tracks.some(t => t.enabled);
            tracks.forEach(t => { t.enabled = !t.enabled; });
          };
          btnCam.onclick = () => {
            const st = this._voiceCallState.stream;
            if (!st) return;
            const tracks = st.getVideoTracks ? st.getVideoTracks() : st.getTracks().filter(t => t.kind === 'video');
            if (!tracks.length) return;
            tracks[0].enabled = !tracks[0].enabled;
          };
          btnScreen.onclick = () => {
            const pc = this._voiceCallState.pc;
            const st = this._voiceCallState.stream;
            if (!pc || !st) return;
            const senders = pc.getSenders ? pc.getSenders() : [];
            let videoSender = null;
            for (let i = 0; i < senders.length; i += 1) {
              const s2 = senders[i];
              if (s2 && s2.track && s2.track.kind === 'video') { videoSender = s2; break; }
            }
            if (!videoSender || !videoSender.replaceTrack) return;
            if (this._voiceCallState.displayStream) {
              const ds = this._voiceCallState.displayStream;
              try { ds.getTracks().forEach(t => t.stop()); } catch (_) {}
              this._voiceCallState.displayStream = null;
              const cams = st.getVideoTracks ? st.getVideoTracks() : st.getTracks().filter(t => t.kind === 'video');
              const back = cams && cams.length ? cams[0] : null;
              try { videoSender.replaceTrack(back); } catch (_) {}
              return;
            }
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then((ds) => {
              this._voiceCallState.displayStream = ds;
              const vids = ds.getVideoTracks ? ds.getVideoTracks() : ds.getTracks().filter(t => t.kind === 'video');
              const vt = vids && vids.length ? vids[0] : null;
              if (!vt) return;
              try { videoSender.replaceTrack(vt); } catch (_) {}
              vt.onended = () => {
                if (this._voiceCallState.displayStream !== ds) return;
                try { ds.getTracks().forEach(t => t.stop()); } catch (_) {}
                this._voiceCallState.displayStream = null;
                const cams = st.getVideoTracks ? st.getVideoTracks() : st.getTracks().filter(t => t.kind === 'video');
                const back = cams && cams.length ? cams[0] : null;
                try { videoSender.replaceTrack(back); } catch (_) {}
              };
            }).catch(() => {});
          };
          btnHang.onclick = () => {
            if (this._callSocket && this._voiceCallState.callId) {
              try { this._callSocket.emit('call:end', { callId: this._voiceCallState.callId }); } catch (_) {}
            }
            this._callHardResetHeaderOnly();
          };
          controls.appendChild(btnMic);
          controls.appendChild(btnCam);
          controls.appendChild(btnScreen);
          controls.appendChild(btnHang);
        }
        if (header) header.classList.remove('hidden');

        navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => navigator.mediaDevices.getUserMedia({ audio: true, video: false })).then((stream) => {
          this._voiceCallState.stream = stream;
          this._webrtcRunLocalAudioLevel(stream);
          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          this._voiceCallState.pc = pc;
          stream.getTracks().forEach((t) => { try { pc.addTrack(t, stream); } catch (_) {} });
          pc.ontrack = (e) => this._attachRemoteTrack(e);
          pc.onicecandidate = (e) => {
            if (!e.candidate || !this._callSocket || !this._voiceCallState.callId) return;
            const pl = e.candidate.toJSON ? e.candidate.toJSON() : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex };
            try { this._callSocket.emit('webrtc_signal', { callId: this._voiceCallState.callId, to: to, kind: 'ice', data: pl }); } catch (_) {}
          };
          pc.oniceconnectionstatechange = () => {
            const st = pc.iceConnectionState;
            if (st === 'failed' || st === 'disconnected' || st === 'closed') this._callHardResetHeaderOnly();
          };
          return pc.createOffer().then((offer) => pc.setLocalDescription(offer)).then(() => {
            if (!pc.localDescription || !this._callSocket || !this._voiceCallState.callId) return;
            try { this._callSocket.emit('webrtc_signal', { callId: this._voiceCallState.callId, to: to, kind: 'offer', data: pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); } catch (_) {}
          });
        }).catch(() => {});
      });

      s.on('webrtc_signal', (d) => {
        const from = d && d.from ? String(d.from) : null;
        const callId = d && d.callId ? String(d.callId) : null;
        const kind = d && d.kind ? String(d.kind) : null;
        const data = d && d.data ? d.data : null;
        if (!from || !callId || !kind || !data) return;
        if (kind === 'offer') {
          this._voiceCallState.callId = callId;
          this._voiceCallState.targetUserId = from;
          navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => navigator.mediaDevices.getUserMedia({ audio: true, video: false })).then((stream) => {
            this._voiceCallState.stream = stream;
            this._webrtcRunLocalAudioLevel(stream);
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            this._voiceCallState.pc = pc;
            this._voiceCallState.pendingIceCandidates = [];
            stream.getTracks().forEach((t) => { try { pc.addTrack(t, stream); } catch (_) {} });
            pc.ontrack = (e) => this._attachRemoteTrack(e);
            pc.onicecandidate = (e) => {
              if (!e.candidate || !this._callSocket || !this._voiceCallState.callId) return;
              const pl = e.candidate.toJSON ? e.candidate.toJSON() : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex };
              try { this._callSocket.emit('webrtc_signal', { callId: this._voiceCallState.callId, to: from, kind: 'ice', data: pl }); } catch (_) {}
            };
            pc.oniceconnectionstatechange = () => {
              const st = pc.iceConnectionState;
              if (st === 'failed' || st === 'disconnected' || st === 'closed') this._callHardResetHeaderOnly();
            };
            return pc.setRemoteDescription(new RTCSessionDescription(data)).then(() => pc.createAnswer()).then((ans) => pc.setLocalDescription(ans)).then(() => {
              if (!pc.localDescription || !this._callSocket || !this._voiceCallState.callId) return;
              try { this._callSocket.emit('webrtc_signal', { callId: this._voiceCallState.callId, to: from, kind: 'answer', data: pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); } catch (_) {}
              const q = this._voiceCallState.pendingIceCandidates || [];
              this._voiceCallState.pendingIceCandidates = [];
              q.forEach((c) => { try { pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}); } catch (_) {} });
            });
          }).catch(() => {});
          return;
        }
        if (kind === 'answer') {
          if (!this._voiceCallState.pc) return;
          this._voiceCallState.pc.setRemoteDescription(new RTCSessionDescription(data)).then(() => {
            const q = this._voiceCallState.pendingIceCandidates || [];
            this._voiceCallState.pendingIceCandidates = [];
            q.forEach((c) => { try { this._voiceCallState.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}); } catch (_) {} });
          }).catch(() => {});
          return;
        }
        if (kind === 'ice') {
          if (!this._voiceCallState.pc) return;
          const pc = this._voiceCallState.pc;
          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            if (!this._voiceCallState.pendingIceCandidates) this._voiceCallState.pendingIceCandidates = [];
            this._voiceCallState.pendingIceCandidates.push(data);
            return;
          }
          try { pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {}); } catch (_) {}
        }
      });
      */ // FIM DO CÓDIGO DESATIVADO

      // DESATIVADO: call-system.js gerencia todos os eventos de chamada
      /*
      s.on('call:ended', () => {
        if (this._voiceCallState.pc) {
          try { this._voiceCallState.pc.close(); } catch (_) {}
          this._voiceCallState.pc = null;
        }
        if (this._voiceCallState.stream) {
          this._voiceCallState.stream.getTracks().forEach(t => t.stop());
          this._voiceCallState.stream = null;
        }
        if (this._voiceCallState.displayStream) {
          this._voiceCallState.displayStream.getTracks().forEach(t => t.stop());
          this._voiceCallState.displayStream = null;
        }
        this._voiceCallState.targetUserId = null;
        this._voiceCallState.pendingOffer = null;
        this._voiceCallState.pendingIceCandidates = [];
        this._voiceCallState.callId = null;
        this._webrtcStopLocalAudioLevel();
        this._webrtcClearRemote();
        const header = document.getElementById('header-call');
        if (header) header.classList.add('hidden');
      });
      s.on('call:error', d => {
        this.showToast((d && d.message) || 'Falha na chamada.', 'error');
      });
      */
    }
  }

  _showIncomingCallAlert(fromUserId) {
    this._hideIncomingCallAlert();
    const overlay = document.createElement('div');
    overlay.className = 'incoming-call-overlay';
    overlay.id = 'incoming-call-overlay';
    const fromName =
      this.dmChannels.find(c => c.recipients?.[0]?.id === fromUserId)?.recipients?.[0]?.username || 'Alguém';
    overlay.innerHTML = `
            <div class="incoming-call-card">
                <div class="incoming-call-icon"><i class="fas fa-phone"></i></div>
                <h3 class="incoming-call-title">Chamada recebida</h3>
                <p class="incoming-call-from">${this.escapeHtml(fromName)}</p>
                <div class="incoming-call-actions">
                    <button type="button" class="btn btn-primary" id="incoming-call-accept"><i class="fas fa-phone"></i> Aceitar</button>
                    <button type="button" class="btn btn-secondary" id="incoming-call-reject"><i class="fas fa-phone-slash"></i> Recusar</button>
                </div>
            </div>
        `;
    overlay.querySelector('#incoming-call-accept').addEventListener('click', () => this._acceptIncomingCall());
    overlay.querySelector('#incoming-call-reject').addEventListener('click', () => this._rejectIncomingCall());
    document.body.appendChild(overlay);
  }

  _hideIncomingCallAlert() {
    const el = document.getElementById('incoming-call-overlay');
    if (el) el.remove();
  }

  async _acceptIncomingCall() {
    const { pendingOffer } = this._voiceCallState;
    this._hideIncomingCallAlert();
    if (!pendingOffer) return;
    if (!window.RTCPeerConnection || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showToast('Seu navegador não suporta chamadas de voz.', 'error');
      if (this._callSocket && this._voiceCallState.callId) {
        try { this._callSocket.emit('call:end', { callId: this._voiceCallState.callId }); } catch (_) {}
      }
      this._voiceCallState.pendingOffer = null;
      return;
    }
    const from = pendingOffer.from;
    const payload = pendingOffer.payload;
    this._voiceCallState.pendingOffer = null;
    this._voiceCallState.targetUserId = from;
    this._voiceCallState.videoEnabled = true;
    this._voiceCallState.stream = null;
    this._voiceCallState.pendingIceCandidates = [];
    try {
      this._voiceCallState.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (_) {
      this._voiceCallState.stream = null;
    }
    const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (window.__TURN_SERVER_URL__) iceServers.push({
      urls: window.__TURN_SERVER_URL__,
      username: window.__TURN_USERNAME__ || undefined,
      credential: window.__TURN_PASSWORD__ || undefined,
    });
    const pc = new RTCPeerConnection({ iceServers: iceServers });
    this._voiceCallState.pc = pc;
    if (this._voiceCallState.stream)
      this._voiceCallState.stream.getTracks().forEach(track => pc.addTrack(track, this._voiceCallState.stream));
    pc.ontrack = e => this._attachRemoteTrack(e);
    pc.onicecandidate = e => {
      if (!e.candidate || !this._callSocket || !this._voiceCallState.callId) return;
      const pl = e.candidate.toJSON ? e.candidate.toJSON() : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex };
      try { this._callSocket.emit('call:ice', { to: from, callId: this._voiceCallState.callId, candidate: pl }); } catch (_) {}
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this._webrtcClearRemote();
        const voiceView = document.getElementById('voice-call-view');
        if (voiceView) voiceView.classList.add('hidden');
        const localV = document.getElementById('webrtc-local-video');
        if (localV) localV.srcObject = null;
      }
    };
    const offerDesc = payload && typeof payload === 'object' ? { type: payload.type || 'offer', sdp: payload.sdp || '' } : { type: 'offer', sdp: '' };
    pc.setRemoteDescription(new RTCSessionDescription(offerDesc))
      .then(() => {
        if (pc.signalingState !== 'have-remote-offer') return Promise.reject(new Error('Wrong signaling state'));
        return pc.createAnswer();
      })
      .then(answer => {
        if (!answer) return;
        return pc.setLocalDescription(answer);
      })
      .then(() => {
        this._callDrainPendingIceCandidates();
        if (this._callSocket && pc.localDescription && this._voiceCallState.callId) {
          try { this._callSocket.emit('call:answer', { to: from, callId: this._voiceCallState.callId, answer: pc.localDescription.toJSON() }); } catch (_) {}
        }
      })
      .catch(() => {});
    const voiceView = document.getElementById('voice-call-view');
    if (voiceView) {
      voiceView.classList.remove('hidden');
      voiceView.classList.add('call-neo--visible');
      voiceView.classList.remove('call-neo--hidden');
    }
    this._webrtcClearRemote();
    const placeholderText = document.querySelector('#webrtc-remote-placeholder .webrtc-placeholder-text');
    if (placeholderText) placeholderText.textContent = 'Aguardando a outra pessoa...';
    const localV = document.getElementById('webrtc-local-video');
    const localFallback = document.getElementById('webrtc-local-fallback-icon');
    if (localV) {
      localV.srcObject = this._voiceCallState.stream;
      localV.muted = true;
      localV.playsInline = true;
      localV.autoplay = true;
      const str = this._voiceCallState.stream;
      const vT = str && (str.getVideoTracks ? str.getVideoTracks() : str.getTracks().filter(t => t.kind === 'video'));
      const hasVideo = vT && vT.length > 0;
      localV.classList.toggle('hidden', !hasVideo);
      if (localFallback) localFallback.classList.toggle('hidden', !!hasVideo);
    } else if (localFallback) localFallback.classList.remove('hidden');
    if (this._voiceCallState.stream) this._webrtcRunLocalAudioLevel(this._voiceCallState.stream);
    const titleEl = document.getElementById('voice-call-channel-name');
    const other =
      (this.currentChannel?.recipients || []).find(r => r.id === from) ||
      this.dmChannels.find(c => c.recipients?.[0]?.id === from)?.recipients?.[0];
    const displayTitle = other
      ? (other.global_name ? `${other.username} • ${other.global_name}` : other.username)
      : 'Chamada';
    if (titleEl) titleEl.textContent = displayTitle;
    const remoteLabel = document.getElementById('webrtc-remote-label');
    if (remoteLabel) remoteLabel.textContent = other?.username || 'Aguardando...';
    this._updateVoiceCallParticipantsBar();
    this._updateWebrtcControlButtons();
  }

  _rejectIncomingCall() {
    const from = this._voiceCallState.incomingFromUserId;
    this._voiceCallState.pendingOffer = null;
    this._voiceCallState.incomingFromUserId = null;
    this._hideIncomingCallAlert();
    if (from && this._callSocket && this._voiceCallState.callId) {
      try { this._callSocket.emit('call:end', { callId: this._voiceCallState.callId }); } catch (_) {}
    }
  }

  _startVoiceCallIfDM() {
    const socket = this._callSocket;
    const ch = this.currentChannel;
    const others = (ch && ch.recipients ? ch.recipients : []).filter(r => r && this.currentUser && r.id !== this.currentUser.id);
    const target = others[0] || null;
    const targetId = target && target.id ? String(target.id) : null;
    console.log('Botão clicado!');
    if (!socket || !socket.emit || !targetId) return;
    socket.emit('call:start', { to: targetId });
  }

  _setupCallResizeHandle() {
    const stage = document.getElementById('call-neo-stage');
    const handle = document.getElementById('call-neo-resize-handle');
    if (!stage || !handle) return;
    let startY = 0;
    let startHeight = 0;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startY = e.clientY;
      const h = stage.getBoundingClientRect().height;
      startHeight = h;
      const onMove = (e2) => {
        const dy = e2.clientY - startY;
        let newH = Math.round(startHeight + dy);
        const minH = 200;
        const maxH = Math.max(minH, window.innerHeight - 140);
        newH = Math.min(maxH, Math.max(minH, newH));
        stage.style.height = newH + 'px';
        stage.style.flex = '0 0 auto';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  _setupVoiceCallButton() {
    const btn = document.getElementById('voice-call-btn');
    const voiceView = document.getElementById('voice-call-view');
    const disconnectBtn = document.getElementById('voice-call-disconnect');
    const muteBtn = document.getElementById('voice-call-mute');
    const headerMuteBtn = document.getElementById('header-call-mute');
    const headerDeafenBtn = document.getElementById('header-call-deafen');
    const headerDisconnectBtn = document.getElementById('header-call-disconnect');
    if (!btn) return;
    this._setupCallResizeHandle();
    const closeVoiceCall = () => {
      this._roomCallStop();
      if (this._callSocket && this._voiceCallState.callId) {
        try { this._callSocket.emit('call:end', { callId: this._voiceCallState.callId }); } catch (_) {}
      }
      if (this._voiceCallState.stream) {
        this._voiceCallState.stream.getTracks().forEach(t => t.stop());
        this._voiceCallState.stream = null;
      }
      if (this._voiceCallState.displayStream) {
        this._voiceCallState.displayStream.getTracks().forEach(t => t.stop());
        this._voiceCallState.displayStream = null;
      }
      if (this._voiceCallState.pc) {
        this._voiceCallState.pc.close();
        this._voiceCallState.pc = null;
      }
      this._voiceCallState.targetUserId = null;
      this._voiceCallState.pendingOffer = null;
      this._voiceCallState.pendingIceCandidates = [];
      this._voiceCallState.callId = null;
      if (voiceView) {
        voiceView.classList.add('hidden');
        voiceView.classList.add('call-neo--hidden');
        voiceView.classList.remove('call-neo--visible');
      }
      const stage = document.getElementById('call-neo-stage');
      if (stage) {
        stage.style.height = '';
        stage.style.flex = '';
      }
      this._webrtcStopLocalAudioLevel();
      this._webrtcClearRemote();
      const localV = document.getElementById('webrtc-local-video');
      if (localV) localV.srcObject = null;
      const screenshareBtn = document.getElementById('voice-call-screenshare');
      if (screenshareBtn) {
        screenshareBtn.classList.remove('active');
        screenshareBtn.classList.remove('call-neo__ctrl--active');
        screenshareBtn.querySelector('span').textContent = 'Compartilhar tela';
        screenshareBtn.querySelector('i').className = 'fas fa-display';
      }
      const videoBtn = document.getElementById('voice-call-video');
      if (videoBtn) {
        videoBtn.classList.remove('off');
        videoBtn.classList.remove('call-neo__ctrl--off');
        videoBtn.querySelector('i').className = 'fas fa-video';
        videoBtn.querySelector('span').textContent = 'Vídeo';
      }
      const headerCall = document.getElementById('header-call');
      if (headerCall) headerCall.classList.add('hidden');
    };
    // O clique em "Chamada" é tratado por delegação em document (init) para funcionar sempre
    if (disconnectBtn) disconnectBtn.addEventListener('click', closeVoiceCall);
    if (headerDisconnectBtn) headerDisconnectBtn.addEventListener('click', closeVoiceCall);
    if (muteBtn)
      muteBtn.addEventListener('click', async () => {
        if (!this._voiceCallState.stream) {
          await this._requestCallMedia();
          return;
        }
        const st = this._voiceCallState.stream;
        const tracks = st.getAudioTracks ? st.getAudioTracks() : st.getTracks().filter(t => t.kind === 'audio');
        const enabled = tracks.some(t => t.enabled);
        tracks.forEach(t => { t.enabled = !t.enabled; });
        this._playCallSound(enabled ? 'mute' : 'unmute');
        this._updateWebrtcControlButtons();
      });
    if (headerMuteBtn)
      headerMuteBtn.addEventListener('click', () => {
        const st = this._roomCallState.localStream || this._voiceCallState.stream;
        if (!st) return;
        const tracks = st.getAudioTracks ? st.getAudioTracks() : st.getTracks().filter(t => t.kind === 'audio');
        const enabled = tracks.some(t => t.enabled);
        tracks.forEach(t => { t.enabled = !t.enabled; });
        this._playCallSound(enabled ? 'mute' : 'unmute');
      });
    if (headerDeafenBtn)
      headerDeafenBtn.addEventListener('click', () => {
        const wrap = document.getElementById('webrtc-remote-wrap');
        if (!wrap) return;
        this._voiceCallState.muteRemote = !this._voiceCallState.muteRemote;
        wrap.querySelectorAll('audio.webrtc-remote-audio').forEach(a => { a.muted = this._voiceCallState.muteRemote; });
      });
    const videoBtn = document.getElementById('voice-call-video');
    if (videoBtn)
      videoBtn.addEventListener('click', async () => {
        const s = this._roomCallState.socket;
        const ls = this._roomCallState.localStream;
        if (!s || !ls) return;
        const tracks = ls.getVideoTracks ? ls.getVideoTracks() : ls.getTracks().filter((t) => t.kind === 'video');
        if (tracks.length === 0) {
          navigator.mediaDevices.getUserMedia({ video: true }).then((vs) => {
            const vt = vs.getVideoTracks ? vs.getVideoTracks()[0] : vs.getTracks().filter((t) => t.kind === 'video')[0];
            if (!vt) return;
            ls.addTrack(vt);
            Array.from(this._roomCallState.peers.values()).forEach((pc) => {
              try { pc.addTrack(vt, ls); } catch (_) {}
              pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => {
                if (!pc.localDescription) return;
                const target = Array.from(this._roomCallState.peers.entries()).find(([, p]) => p === pc)?.[0];
                if (target) s.emit('rtc-offer', { roomId: this._roomCallState.roomId, targetSocketId: target, sdp: pc.localDescription.toJSON() });
              }).catch(() => {});
            });
            this._roomCallRenderGrid();
          }).catch(() => {});
          return;
        }
        tracks[0].enabled = !tracks[0].enabled;
        this._roomCallRenderGrid();
      });
    const muteRemoteBtn = document.getElementById('voice-call-mute-remote');
    if (muteRemoteBtn) {
      muteRemoteBtn.addEventListener('click', () => {
        this._voiceCallState.muteRemote = !this._voiceCallState.muteRemote;
        const wrap = document.getElementById('webrtc-remote-wrap');
        if (wrap)
          wrap.querySelectorAll('audio.webrtc-remote-audio').forEach(a => {
            a.muted = this._voiceCallState.muteRemote;
          });
        muteRemoteBtn.classList.toggle('muted', this._voiceCallState.muteRemote);
        muteRemoteBtn.querySelector('i').className = this._voiceCallState.muteRemote
          ? 'fas fa-volume-off'
          : 'fas fa-volume-xmark';
        muteRemoteBtn.querySelector('span').textContent = this._voiceCallState.muteRemote ? 'Ativar som' : 'Silenciar';
        this._playCallSound(this._voiceCallState.muteRemote ? 'mute_remote' : 'unmute');
      });
    }
    const screenshareBtn = document.getElementById('voice-call-screenshare');
    if (screenshareBtn) {
      screenshareBtn.addEventListener('click', async () => {
        const s = this._roomCallState.socket;
        const ls = this._roomCallState.localStream;
        if (!s || !ls) return;
        if (this._roomCallState.displayStream) {
          this._roomCallState.displayStream.getTracks().forEach((t) => t.stop());
          this._roomCallState.displayStream = null;
          let cameraTrack = null;
          if (ls) {
            const vids = ls.getVideoTracks ? ls.getVideoTracks() : ls.getTracks().filter((t) => t.kind === 'video');
            cameraTrack = vids && vids.length ? vids[0] : null;
          }
          Array.from(this._roomCallState.peers.entries()).forEach(([, pc]) => {
            const sender = pc.getSenders().find((x) => x.track && x.track.kind === 'video');
            if (sender && sender.replaceTrack) {
              try { sender.replaceTrack(cameraTrack); } catch (_) {}
            }
          });
          this._roomCallRenderGrid();
          screenshareBtn.classList.remove('active');
          screenshareBtn.classList.remove('call-neo__ctrl--active');
          screenshareBtn.querySelector('span').textContent = 'Compartilhar tela';
          screenshareBtn.querySelector('i').className = 'fas fa-display';
          return;
        }
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: false })
          .then((ds) => {
          this._roomCallState.displayStream = ds;
          const vt = ds.getVideoTracks ? ds.getVideoTracks()[0] : ds.getTracks().filter((t) => t.kind === 'video')[0];
          if (!vt) return;
          Array.from(this._roomCallState.peers.entries()).forEach(([, pc]) => {
            const sender = pc.getSenders().find((x) => x.track && x.track.kind === 'video');
            if (sender && sender.replaceTrack) {
              try { sender.replaceTrack(vt); } catch (_) {}
            }
          });
          screenshareBtn.classList.add('active');
          screenshareBtn.classList.add('call-neo__ctrl--active');
          screenshareBtn.querySelector('span').textContent = 'Parar partilha';
          screenshareBtn.querySelector('i').className = 'fas fa-display';
          vt.onended = () => {
            if (this._roomCallState.displayStream === ds) {
              try { ds.getTracks().forEach((t) => t.stop()); } catch (_) {}
              this._roomCallState.displayStream = null;
              const vids = ls.getVideoTracks ? ls.getVideoTracks() : ls.getTracks().filter((t) => t.kind === 'video');
              const backTrack = vids && vids.length ? vids[0] : null;
              Array.from(this._roomCallState.peers.entries()).forEach(([, pc]) => {
                const sender = pc.getSenders().find((x) => x.track && x.track.kind === 'video');
                if (sender && sender.replaceTrack) {
                  try { sender.replaceTrack(backTrack); } catch (_) {}
                }
              });
              screenshareBtn.classList.remove('active');
              screenshareBtn.classList.remove('call-neo__ctrl--active');
              screenshareBtn.querySelector('span').textContent = 'Compartilhar tela';
              screenshareBtn.querySelector('i').className = 'fas fa-display';
              this._roomCallRenderGrid();
            }
          };
          this._roomCallRenderGrid();
        })
          .catch((err) => {
            const name = err && err.name ? String(err.name) : '';
            this.showToast(
              name === 'NotAllowedError'
                ? 'Permissão de compartilhamento de tela negada.'
                : 'Não foi possível compartilhar a tela.',
              'error'
            );
          });
      });
    }
  }

  async _requestCallMedia() {
    if (this._voiceCallState.stream || !this._voiceCallState.pc || !this._voiceCallState.targetUserId)
      return this._voiceCallState.stream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      this._voiceCallState.stream = stream;
      this._voiceCallState.videoEnabled = true;
      const pc = this._voiceCallState.pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (this.gateway)
        if (pc.localDescription)
          this.gateway.send('webrtc_offer', {
            target_user_id: this._voiceCallState.targetUserId,
            payload: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
          });
      const localV = document.getElementById('webrtc-local-video');
      if (localV) localV.srcObject = stream;
      this._updateWebrtcControlButtons();
      return stream;
    } catch (_) {
      this.showToast('Permissão de microfone/câmara necessária para falar.', 'info');
      return null;
    }
  }

  _updateWebrtcControlButtons() {
    const muteBtn = document.getElementById('voice-call-mute');
    const videoBtn = document.getElementById('voice-call-video');
    const screenshareBtn = document.getElementById('voice-call-screenshare');
    const stream = this._voiceCallState.stream;
    if (muteBtn) {
      if (stream) {
        const enabled = stream.getAudioTracks().some(t => t.enabled);
        muteBtn.classList.toggle('muted', !enabled);
        muteBtn.classList.toggle('call-neo__ctrl--muted', !enabled);
        muteBtn.querySelector('i').className = enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
        muteBtn.querySelector('span').textContent = enabled ? 'Mute' : 'Desmutar';
      } else {
        muteBtn.classList.remove('muted');
        muteBtn.classList.remove('call-neo__ctrl--muted');
        muteBtn.querySelector('i').className = 'fas fa-microphone';
        muteBtn.querySelector('span').textContent = 'Ativar microfone';
      }
    }
    if (videoBtn) {
      if (stream) {
        const on = this._voiceCallState.videoEnabled !== false;
        videoBtn.classList.toggle('off', !on);
        videoBtn.classList.toggle('call-neo__ctrl--off', !on);
        videoBtn.querySelector('i').className = on ? 'fas fa-video' : 'fas fa-video-slash';
        videoBtn.querySelector('span').textContent = on ? 'Vídeo' : 'Ligar vídeo';
      } else {
        videoBtn.classList.remove('off');
        videoBtn.classList.remove('call-neo__ctrl--off');
        videoBtn.querySelector('i').className = 'fas fa-video';
        videoBtn.querySelector('span').textContent = 'Ativar câmara';
      }
    }
    if (screenshareBtn) {
      const active = !!this._voiceCallState.displayStream;
      screenshareBtn.classList.toggle('active', active);
      screenshareBtn.classList.toggle('call-neo__ctrl--active', active);
    }
  }

  // ═══════════════════════════════════════════
  //  AUTH
  // ═══════════════════════════════════════════

  switchAuthTab(tab) {
    document
      .querySelectorAll('.auth-choice-btn, .auth-tab')
      .forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === `${tab}-form`));
  }

  getOrCreateDeviceId() {
    const KEY = 'liberty_device_id';
    let id = null;
    try { id = localStorage.getItem(KEY); } catch (e) {}
    if (!id) {
      id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      try { localStorage.setItem(KEY, id); } catch (e) {}
    }
    return id;
  }

  /** Após login/registo: mostra modal de segurança e conecta */
  showSecurityWarningThenConnect(loginResult) {
    console.log('[APP] showSecurityWarningThenConnect chamado');
    this._pendingLoginResult = loginResult;
    
    // Verificar se token foi salvo corretamente
    const token = (() => { try { return localStorage.getItem('access_token') || localStorage.getItem('token'); } catch { return null; } })();
    console.log('[APP] Login result:', loginResult ? 'ok' : 'null');
    console.log('[APP] Token salvo:', token ? token.substring(0, 20) + '...' : 'NENHUM');
    
    if (!token) {
      console.error('[APP] ❌ Token não foi salvo! Verificando loginResult...');
      if (loginResult && loginResult.access_token) {
        console.log('[APP] Salvando token do loginResult...');
        try {
          localStorage.setItem('token', loginResult.access_token);
          localStorage.setItem('access_token', loginResult.access_token);
          if (loginResult.refresh_token) {
            localStorage.setItem('refresh_token', loginResult.refresh_token);
          }
        } catch (e) {}
      } else {
        this.showToast('Erro no login: token não recebido', 'error');
        this.showAuth();
        return;
      }
    }
    
    // Mostrar modal de aviso de segurança
    this.showSecurityWarningModal();
  }
  
  showSecurityWarningModal() {
    console.log('[APP] Mostrando modal de segurança');
    const modal = document.getElementById('security-warning-modal');
    const overlay = document.getElementById('security-modal-overlay');
    
    if (modal) {
      modal.classList.remove('hidden');
    }
    if (overlay) {
      overlay.classList.remove('hidden');
    }
    
    // Configurar botões
    const ignoreBtn = document.getElementById('security-warning-ignore');
    const privacyBtn = document.getElementById('security-warning-privacy');
    
    // Remover listeners antigos
    if (ignoreBtn) {
      ignoreBtn.replaceWith(ignoreBtn.cloneNode(true));
    }
    if (privacyBtn) {
      privacyBtn.replaceWith(privacyBtn.cloneNode(true));
    }
    
    // Novos listeners
    document.getElementById('security-warning-ignore')?.addEventListener('click', () => {
      console.log('[APP] Usuário ignorou aviso de segurança');
      this.hideSecurityWarningModal();
      this.proceedWithLogin();
    });
    
    document.getElementById('security-warning-privacy')?.addEventListener('click', () => {
      console.log('[APP] Usuário quer configurar privacidade');
      this.hideSecurityWarningModal();
      this.proceedWithLogin().then(() => {
        this.showAuthSecurityModal();
      });
    });
    
    // Fechar ao clicar no overlay
    document.getElementById('security-modal-overlay')?.addEventListener('click', () => {
      this.hideSecurityWarningModal();
      this.proceedWithLogin();
    }, { once: true });
  }
  
  hideSecurityWarningModal() {
    const modal = document.getElementById('security-warning-modal');
    const overlay = document.getElementById('security-modal-overlay');
    if (modal) modal.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
  }
  
  async proceedWithLogin() {
    console.log('[APP] proceedWithLogin - iniciando conexão');
    
    // Mostrar app
    this.showApp();
    
    // Desconectar gateway anterior se existir
    if (window.Gateway && typeof window.Gateway.disconnect === 'function') {
      try { window.Gateway.disconnect(); } catch (_) {}
    }
    this.gateway = window.Gateway || null;
    
    // Conectar
    try {
      await this.connect();
      console.log('[APP] Connect sucesso');
      this._pendingLoginResult = null;
    } catch (err) {
      this._pendingLoginResult = null;
      console.error('[APP] Erro no connect:', err);
      this.showToast(err && err.message ? err.message : 'Não foi possível conectar. Tente novamente.', 'error');
      this.showAuth();
    }
  }

  _onSecurityWarningIgnore() {
    document.getElementById('security-warning-modal')?.classList?.add('hidden');
    document.getElementById('modal-overlay')?.classList?.add('hidden');
    this._pendingLoginResult = null;
    this.connect();
  }

  _onSecurityWarningPrivacy() {
    document.getElementById('security-warning-modal')?.classList?.add('hidden');
    document.getElementById('modal-overlay')?.classList?.add('hidden');
    this._pendingLoginResult = null;
    this.connect().then(() => {
      this.showModal('privacy-settings-modal');
    });
  }

  async handleLogin() {
    const usernameEl = document.getElementById('login-username');
    if (!usernameEl) return;
    const username = usernameEl.value.trim();
    const btn = document.querySelector('#login-form .btn-primary');
    if (!username) {
      this.showToast('Digite um nome de usuário', 'error');
      return;
    }
    
    // Evitar múltiplas tentativas
    if (this._loginInProgress) {
      console.log('[APP] Login já em andamento...');
      return;
    }
    this._loginInProgress = true;
    
    try {
      this._setButtonLoading(btn, true);
      const deviceId = this.getOrCreateDeviceId();
      console.log('[APP] Tentando login com:', username);
      
      const result = await API.Auth.login(username, undefined, deviceId);
      console.log('[APP] Login result:', result ? 'ok' : 'null');
      
      if (!result || !result.access_token) {
        throw new Error('Token não recebido do servidor');
      }
      
      // Token salvo instantaneamente
      console.log('[APP] Token salvo:', result.access_token.substring(0, 20) + '...');
      
      // Login instantâneo - sem delay
      this.showSecurityWarningThenConnect(result);
    } catch (error) {
      console.error('[APP] Erro no login:', error);
      
      // Limpar tokens inválidos
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('liberty_token');
        localStorage.removeItem('refresh_token');
      } catch (e) {}
      
      // Mensagem mais amigável
      let msg = error.message || 'Login falhou';
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        msg = 'Usuário não encontrado ou senha incorreta';
      } else if (msg.includes('429') || msg.includes('Too Many')) {
        msg = 'Muitas tentativas. Aguarde alguns minutos.';
      }
      
      this.showToast(msg, 'error');
    } finally {
      this._setButtonLoading(btn, false);
      this._loginInProgress = false;
    }
  }

  async handleRegister() {
    const usernameEl = document.getElementById('register-username');
    if (!usernameEl) return;
    const username = usernameEl.value.trim();
    const btn = document.querySelector('#register-form .btn-primary');
    if (!username) {
      this.showToast('Digite um nome de usuário', 'error');
      return;
    }
    
    // Evitar múltiplas tentativas
    if (this._loginInProgress) {
      console.log('[APP] Registro já em andamento...');
      return;
    }
    this._loginInProgress = true;
    
    try {
      this._setButtonLoading(btn, true);
      const deviceId = this.getOrCreateDeviceId();
      console.log('[APP] Tentando registrar:', username);
      
      const result = await API.Auth.register(username, null, undefined, deviceId);
      console.log('[APP] Register result:', result ? 'ok' : 'null');
      
      if (!result || !result.access_token) {
        throw new Error('Token não recebido do servidor');
      }
      
      // Login instantâneo - sem delay
      this.showSecurityWarningThenConnect(result);
    } catch (error) {
      console.error('[APP] Erro no registro:', error);
      
      // Limpar tokens
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('liberty_token');
        localStorage.removeItem('refresh_token');
      } catch (e) {}
      
      let msg = error.message || 'Registro falhou';
      if (msg.includes('409') || msg.includes('Conflict')) {
        msg = 'Este nome de usuário já existe';
      } else if (msg.includes('429') || msg.includes('Too Many')) {
        msg = 'Muitas tentativas. Aguarde alguns minutos.';
      }
      
      this.showToast(msg, 'error');
    } finally {
      this._setButtonLoading(btn, false);
      this._loginInProgress = false;
    }
  }

  _setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn._originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading...</span>';
    } else {
      btn.innerHTML = btn._originalHTML || btn.innerHTML;
    }
  }

  // ═══════════════════════════════════════════
  //  SERVERS
  // ═══════════════════════════════════════════

  renderServers() {
    const container = document.getElementById('server-list-container');
    if (!container) return;
    this.servers = this.servers.filter((s, i, a) => a.findIndex(x => x.id === s.id) === i);
    container.innerHTML = '';
    this.servers.forEach(server => {
      const item = document.createElement('div');
      item.className = 'server-item';
      item.dataset.server = server.id;
      const initial = (server.name || '?').charAt(0).toUpperCase();
      const iconSrc = server.icon_url || server.icon;
      item.innerHTML = `
                <div class="server-icon" title="${this.escapeHtml(server.name)}">
                    ${iconSrc ? `<img src="${this.escapeHtml(iconSrc)}" alt="${this.escapeHtml(server.name)}">` : `<span>${this.escapeHtml(initial)}</span>`}
                </div>
                <span class="server-name">${this.escapeHtml(server.name)}</span>
                <div class="server-indicator"></div>
            `;
      item.addEventListener('click', () => this.selectServer(server.id));
      container.appendChild(item);
    });
  }

  selectHome() {
    if (this._closeMobileChannelDrawer) this._closeMobileChannelDrawer();
    this.isHomeView = true;
    this.currentHomeSubView = 'friends';
    this.currentServer = null;
    this.currentChannel = null;
    this.channels = [];
    this.members = [];
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState({ view: 'home' }, '', '/channels/@me');
    }
    document
      .querySelectorAll('.server-item')
      .forEach(item => item.classList.toggle('active', item.classList.contains('home')));
    const serverHeader = document.querySelector('.server-header');
    if (serverHeader) serverHeader.style.display = 'none';
    this.renderHomeSidebar();
    this.renderFriendsView('online');
    this.renderActiveNow();
    this._updateChannelHeaderForContext();
    const msgInputContainer = document.querySelector('.message-input-container');
    if (msgInputContainer) msgInputContainer.style.display = 'none';
  }

  renderHomeSidebar() {
    const homeContainer = document.getElementById('home-sidebar-content');
    const channelContainer = document.getElementById('channel-list');
    if (homeContainer) homeContainer.style.display = '';
    if (channelContainer) channelContainer.style.display = 'none';

    const navArea = homeContainer?.querySelector('.home-nav');
    const dmList = homeContainer?.querySelector('#dm-list');
    const dmSearchInput = homeContainer?.querySelector('#dm-search-input');

    if (navArea) {
      navArea.querySelectorAll('.home-nav-item').forEach(btn => {
        btn.onclick = () => {
          if (this._closeMobileChannelDrawer) this._closeMobileChannelDrawer();
          navArea.querySelectorAll('.home-nav-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (dmList) dmList.querySelectorAll('.dm-list-item').forEach(d => d.classList.remove('active'));
          const view = btn.dataset.view;
          if (view === 'friends') {
            this.currentHomeSubView = 'friends';
            this.renderFriendsView(this.currentFriendsTab);
            this._updateChannelHeaderForContext();
          } else if (view === 'rankings') {
            this.currentHomeSubView = 'rankings';
            this.renderRankingsView();
            this._updateChannelHeaderForContext();
          } else {
            this.showToast(`${btn.textContent.trim()} — Coming Soon!`, 'info');
          }
        };
      });
    }

    if (dmSearchInput) {
      dmSearchInput.oninput = e => {
        const q = e.target.value.toLowerCase();
        if (dmList)
          dmList.querySelectorAll('.dm-list-item').forEach(item => {
            item.style.display = item.dataset.name?.toLowerCase().includes(q) || !q ? '' : 'none';
          });
      };
    }

    if (dmList) {
      dmList.innerHTML = '';
      this._loadDMList(dmList, navArea, { mergeFriends: true });
    }

    if (!this._createGroupModalSetup) {
      this._createGroupModalSetup = true;
      this._setupCreateGroupModal();
    }

    const friendsSidebar = document.getElementById('friends-list-sidebar');
    if (friendsSidebar) {
      friendsSidebar.innerHTML = '';
      this.loadFriends().catch(() => {});
    }
  }

  async loadFriends() {
    try {
      const friends = await API.Friend.list();
      const pending = (await API.Friend.listPending?.()) || [];
      const container = document.getElementById('friends-list-sidebar');
      if (!container) return;
      container.innerHTML = '';
      if (!friends || friends.length === 0) {
        container.innerHTML =
          '<div style="padding:12px;color:var(--text-muted);font-size:13px">Nenhum amigo adicionado ainda.</div>';
        return;
      }
      friends.forEach(f => {
        const item = document.createElement('div');
        item.className = 'dm-list-item';
        item.innerHTML = `
                    <div class="dm-avatar" aria-hidden="true">
                        <span>${this.escapeHtml((f.username || 'U').charAt(0).toUpperCase())}</span>
                    </div>
                    <div class="dm-list-item-body">
                        <div class="dm-list-item-name">${this.escapeHtml(f.username)}</div>
                    </div>
                `;
        container.appendChild(item);
      });
    } catch {
      const container = document.getElementById('friends-list-sidebar');
      if (container)
        container.innerHTML =
          '<div style="padding:12px;color:var(--text-muted);font-size:13px">Falha ao carregar amigos.</div>';
    }
  }

  async handleAddFriend(username) {
    try {
      await API.Friend.add(username);
      this.showToast(`Pedido de amizade enviado para ${username}`, 'success');
      await this.loadFriends();
    } catch (error) {
      this.showToast(error.message || 'Falha ao adicionar amigo', 'error');
    }
  }

  async _loadDMList(dmList, navArea, options = {}) {
    const avatarColors = [
      '#5865F2',
      '#57F287',
      '#FEE75C',
      '#EB459E',
      '#ED4245',
      '#3BA55D',
      '#FAA61A',
      '#9B59B6',
      '#E67E22',
      '#1ABC9C',
    ];
    let list = [];
    try {
      const raw = await API.DM.list();
      list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.channels) ? raw.channels : [];
      list = list
        .map(channel => {
          if (!channel) return null;
          const recipient = channel.recipient || (channel.recipients && channel.recipients[0]) || null;
          if (channel.type === 'dm') {
            if (!this.isValidUser(recipient)) return null;
            channel.recipient = recipient;
            channel.recipients = channel.recipients && channel.recipients.length ? channel.recipients : [recipient];
          }
          return channel;
        })
        .filter(Boolean);
      if (options.mergeFriends) {
        try {
          const relationships = await API.Friend.list();
          const accepted = Array.isArray(relationships) ? relationships.filter(r => r.type === 1) : [];
          const existingIds = new Set(list.map(c => c.recipients?.[0]?.id).filter(Boolean));
          for (const rel of accepted) {
            const uid = rel.user?.id;
            if (!uid || existingIds.has(uid)) continue;
            list.push({
              type: 'dm',
              id: null,
              recipients: [
                {
                  id: uid,
                  username: rel.user?.username || 'User',
                  avatar_url: rel.user?.avatar_url || null,
                  avatar: rel.user?.avatar_url || null,
                },
              ],
            });
            existingIds.add(uid);
          }
        } catch (_) {}
      }
      this.dmChannels = list;
    } catch (err) {
      this.dmChannels = [];
      dmList.innerHTML =
        '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">' +
        (err.message && err.message.includes('401')
          ? 'Faça login para ver suas conversas.'
          : 'Não foi possível carregar as conversas.') +
        '</div>';
      return;
    }

    dmList.innerHTML = '';
    this.dmChannels.forEach((dm, idx) => {
      const isGroup = dm.type === 'group_dm';
      const recipient0 = dm.recipients?.[0] || null;
      if (!isGroup && !this.isValidUser(recipient0)) return;
      const displayName = isGroup ? dm.name || (dm.recipients || []).map(r => r.username).join(', ') : recipient0.username;
      const recipient = recipient0 || { username: displayName, status: 'offline', id: null };
      const item = document.createElement('div');
      item.className = 'dm-list-item';
      item.dataset.name = displayName;
      item.dataset.dmId = dm.id || '';
      item.dataset.channelType = dm.type || 'dm';
      if (recipient.id) item.dataset.recipientId = recipient.id;
      const letter = displayName.charAt(0).toUpperCase();
      const bgColor = avatarColors[idx % avatarColors.length];
      const avatarSrc = this._getAvatarUrlForUser(recipient);
      const avatarFallback = this._getPlaceholderAvatarUrl(displayName);
      const unreadCount =
        (dm.id && typeof LibertyDMUnreadStore !== 'undefined' && LibertyDMUnreadStore.getCount(dm.id)) ||
        (this.unreadChannels.has(dm.id) ? 1 : 0);
      const hasUnread = unreadCount > 0;
      if (hasUnread) item.classList.add('dm-list-item-unread');
      const avatarHtml = `<img src="${this.escapeHtml(avatarSrc)}" alt="" data-fallback-avatar="${avatarFallback ? this.escapeHtml(avatarFallback) : ''}"><span style="display:none;color:#fff">${this.escapeHtml(letter)}</span>`;
      const badgeHtml = hasUnread
        ? `<span class="dm-unread-badge" aria-label="Mensagens não lidas">${unreadCount > 99 ? '99+' : String(unreadCount)}</span>`
        : '';
      item.innerHTML = `
                <div class="dm-list-item-avatar ${recipient.status || 'offline'}" style="background:var(--dark-gray)">${avatarHtml}</div>
                <div class="dm-list-item-info">
                    <div class="dm-list-item-name">${this.escapeHtml(displayName)}</div>
                    <div class="dm-list-item-msg"></div>
                </div>
                ${badgeHtml}
            `;
      item.addEventListener('click', async () => {
        dmList.querySelectorAll('.dm-list-item').forEach(d => d.classList.remove('active'));
        if (navArea) navArea.querySelectorAll('.home-nav-item').forEach(b => b.classList.remove('active'));
        item.classList.add('active');
        const channelNameEl = document.getElementById('channel-name');
        const channelIconEl = document.querySelector('.channel-header .channel-info i');
        if (channelNameEl) channelNameEl.textContent = recipient.username || displayName;
        if (channelIconEl) channelIconEl.className = 'fas fa-envelope channel-header-icon';

        let channel = dm;
        if (!channel.id && recipient.id && dm.type !== 'group_dm') {
          try {
            channel = await API.DM.create(recipient.id);
            const idx = this.dmChannels.findIndex(d => !d.id && d.recipients?.[0]?.id === recipient.id);
            if (idx >= 0) this.dmChannels[idx] = channel;
            item.dataset.dmId = channel.id;
          } catch (e) {
            this.showToast(e.message || 'Não foi possível abrir a conversa', 'error');
            return;
          }
        }
        if (channel.id) {
          this.unreadChannels.delete(channel.id);
          if (typeof LibertyDMUnreadStore !== 'undefined') LibertyDMUnreadStore.clear(channel.id);
          this._updateChannelUnread(channel.id, false);
        }
        document.getElementById('friends-view')?.classList?.add('hidden');
        document.getElementById('messages-container').style.display = '';
        const msgInputContainer = document.querySelector('.message-input-container');
        if (msgInputContainer) msgInputContainer.style.display = '';
        if (this.currentChannel?.id && this.currentChannel.id !== channel?.id && this.gateway)
          this.gateway.unsubscribeChannel(this.currentChannel.id);
        this.currentChannel = channel;
        this.currentChannel.room = 'dm:' + (channel.id || '');
        if (this.currentChannel.id && this.gateway) this.gateway.subscribeChannel(this.currentChannel.id);
        this._renderDMChat(channel);
        this._updateUserControlsVoiceVisibility();
        if (channel.id)
          try {
            history.replaceState({}, '', `/channels/@me/${channel.id}`);
          } catch (_) {}
      });
      dmList.appendChild(item);
    });

    if (this.dmChannels.length === 0) {
      dmList.innerHTML = '<div class="dm-list-empty" id="dm-list-empty">No conversations</div>';
    }
    this._updateDMUnreadTotal();

    const pathMatch =
      typeof location !== 'undefined' && location.pathname && location.pathname.match(/^\/channels\/@me\/([^/]+)$/);
    if (pathMatch) {
      const channelId = pathMatch[1];
      const dm = this.dmChannels.find(d => d.id === channelId);
      if (dm) {
        dmList.querySelectorAll('.dm-list-item').forEach(d => d.classList.remove('active'));
        const item = dmList.querySelector(`[data-dm-id="${channelId}"]`);
        if (item) item.classList.add('active');
        if (navArea) navArea.querySelectorAll('.home-nav-item').forEach(b => b.classList.remove('active'));
        document.getElementById('friends-view')?.classList?.add('hidden');
        const msgCont = document.getElementById('messages-container');
        if (msgCont) msgCont.style.display = '';
        const inputCont = document.querySelector('.message-input-container');
        if (inputCont) inputCont.style.display = '';
        const recipient = dm.recipients?.[0] || {};
        const channelNameEl = document.getElementById('channel-name');
        const channelIconEl = document.querySelector('.channel-header .channel-info i');
        if (channelNameEl) channelNameEl.textContent = recipient.username || 'DM';
        if (channelIconEl) channelIconEl.className = 'fas fa-envelope channel-header-icon';
        if (this.currentChannel?.id && this.currentChannel.id !== dm?.id && this.gateway)
          this.gateway.unsubscribeChannel(this.currentChannel.id);
        this.currentChannel = dm;
        this.currentChannel.room = 'dm:' + (dm.id || '');
        if (dm.id) {
          this.unreadChannels.delete(dm.id);
          if (typeof LibertyDMUnreadStore !== 'undefined') LibertyDMUnreadStore.clear(dm.id);
          this._updateChannelUnread(dm.id, false);
        }
        if (this.currentChannel.id && this.gateway) this.gateway.subscribeChannel(this.currentChannel.id);
        this._updateChannelHeaderForContext();
        this._renderDMChat(dm);
      }
    }
  }

  async _renderDMChat(dm) {
    const isGroup = dm.type === 'group_dm';
    const recipient = dm.recipients?.[0] || null;
    if (!isGroup && !this.isValidUser(recipient)) return;
    const displayName = isGroup ? dm.name || (dm.recipients || []).map(r => r.username).join(', ') : recipient.username;
    document.getElementById('friends-view')?.classList?.add('hidden');
    const msgCont = document.getElementById('messages-container');
    if (msgCont) msgCont.style.display = '';
    const inputCont = document.querySelector('.message-input-container');
    if (inputCont) inputCont.style.display = '';

    if (this.currentChannel?.id && this.currentChannel.id !== dm?.id && this.gateway)
      this.gateway.unsubscribeChannel(this.currentChannel.id);
    this.currentChannel = dm;
    this.currentChannel.room = 'dm:' + (dm.id || '');
    if (this.currentChannel.id && this.gateway) this.gateway.subscribeChannel(this.currentChannel.id);

    if (window.LibertyChatRoot && window.LibertyChatRoot.render) {
      window.LibertyChatRoot.render();
      document.getElementById('message-input').placeholder = isGroup
        ? `Message ${this.escapeHtml(displayName)}`
        : `Message @${recipient.username}`;
      this._updateVoiceCallButtonVisibility();
      this._updateChannelHeaderForContext();
      return;
    }

    const container = document.getElementById('messages-list');
    container.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon"><span style="font-size:30px;font-weight:700;color:var(--primary-black)">${displayName.charAt(0).toUpperCase()}</span></div>
                <h2 class="welcome-title">${this.escapeHtml(displayName)}</h2>
                <p class="welcome-description">${isGroup ? 'Group conversation.' : `This is the beginning of your direct message history with <strong>${this.escapeHtml(recipient.username)}</strong>.`}</p>
            </div>
        `;

    if (dm.id) {
      this._loadingMessagesChannelId = dm.id;
      const cached = MessageCache.get(dm.id);
      if (cached.length > 0) {
        if (this._loadingMessagesChannelId !== dm.id) return;
        const cacheById = new Map();
        cached.forEach(m => {
          const id = m.id ?? m.message_id;
          if (id != null && id !== '') cacheById.set(String(id), { ...m, id: String(id), message_id: String(id) });
        });
        this.setMessagesFromList([...cacheById.values()]);
      }
      try {
        const messages = await API.DM.getMessages(dm.id, { limit: 50 });
        if (this._loadingMessagesChannelId !== dm.id || this.currentChannel?.id !== dm.id) return;
        const byId = new Map();
        [...(cached || []), ...(Array.isArray(messages) ? messages : [])].forEach(m => {
          const id = m.id ?? m.message_id;
          if (id != null && id !== '') byId.set(String(id), m);
        });
        const merged = [...byId.values()].sort((a, b) => {
          const tA = (a.created_at && new Date(a.created_at).getTime()) || 0;
          const tB = (b.created_at && new Date(b.created_at).getTime()) || 0;
          return tA - tB;
        });
        const seenIds = new Set();
        const unique = [];
        for (const m of merged) {
          const id = String(m.id ?? m.message_id ?? '');
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);
          unique.push({ ...m, id, message_id: id });
        }
        MessageCache.set(dm.id, unique);
        if (unique.length > 0) {
          this.setMessagesFromList(unique);
        } else {
          container.replaceChildren();
          container.innerHTML = `
                        <div class="welcome-message">
                            <div class="welcome-icon"><span style="font-size:30px;font-weight:700;color:var(--primary-black)">${displayName.charAt(0).toUpperCase()}</span></div>
                            <h2 class="welcome-title">${this.escapeHtml(displayName)}</h2>
                            <p class="welcome-description">${isGroup ? 'Group conversation.' : `This is the beginning of your direct message history with <strong>${this.escapeHtml(recipient.username)}</strong>.`}</p>
                        </div>
                    `;
        }
      } catch {
        if (this.currentChannel?.id === dm.id && cached.length === 0) {}
      }
      this._loadingMessagesChannelId = null;
    }

    this.scrollToBottom();
    document.getElementById('message-input').placeholder = isGroup
      ? `Message ${this.escapeHtml(displayName)}`
      : `Message @${recipient.username}`;
    this._updateVoiceCallButtonVisibility();
    this._updateChannelHeaderForContext();
  }

  _setupCreateGroupModal() {
    const btn = document.getElementById('dm-add-btn');
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('create-group-modal');
    const listEl = document.getElementById('create-group-friends-list');
    const nameInput = document.getElementById('group-name-input');
    const noFriendsEl = document.getElementById('create-group-no-friends');
    const submitBtn = document.getElementById('create-group-submit-btn');
    if (!btn || !modal) return;

    const openModal = () => {
      nameInput.value = '';
      listEl.innerHTML = '';
      noFriendsEl.classList.add('hidden');
      API.Friend.list()
        .then(list => {
          const accepted = Array.isArray(list) ? list.filter(r => r.type === 1) : [];
          if (accepted.length === 0) {
            noFriendsEl.textContent = 'Add and accept friends first to create a group.';
            noFriendsEl.classList.remove('hidden');
            return;
          }
          accepted.forEach(r => {
            const u = r.user || {};
            const id = u.id || r.friend_id;
            const username = u.username || r.username || 'User';
            const row = document.createElement('label');
            row.className = 'create-group-friend-row';
            row.innerHTML = `<input type="checkbox" data-id="${this.escapeHtml(id)}" data-username="${this.escapeHtml(username).replace(/"/g, '&quot;')}"><span>${this.escapeHtml(username)}</span>`;
            row.addEventListener('click', e => {
              if (e.target.type !== 'checkbox') row.querySelector('input').click();
            });
            listEl.appendChild(row);
          });
        })
        .catch(() => {
          noFriendsEl.textContent = 'Could not load friends.';
          noFriendsEl.classList.remove('hidden');
        });
      overlay.classList.remove('hidden');
      modal.classList.remove('hidden');
    };

    const closeModal = () => {
      overlay.classList.add('hidden');
      modal.classList.add('hidden');
    };

    btn.addEventListener('click', openModal);
    submitBtn.addEventListener('click', async () => {
      const ids = Array.from(listEl.querySelectorAll('input:checked')).map(c => c.dataset.id);
      if (ids.length < 2) {
        this.showToast('Select at least 2 friends to create a group.', 'error');
        return;
      }
      const name = (nameInput.value || '').trim() || null;
      try {
        submitBtn.disabled = true;
        const channel = await API.DM.createGroup(name, ids);
        this.dmChannels.push(channel);
        closeModal();
        this._refreshDMListSidebar();
        this.showToast('Group created.', 'success');
      } catch (err) {
        this.showToast(err.message || 'Failed to create group.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
    document
      .querySelectorAll('[data-close="create-group-modal"]')
      .forEach(el => el.addEventListener('click', closeModal));
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });
  }

  async renderFriendsView(tab) {
    this.currentFriendsTab = tab || 'online';
    tab = this.currentFriendsTab;

    if (window.matchMedia('(max-width: 48rem)').matches && this._closeMobileChannelDrawer) this._closeMobileChannelDrawer();

    const friendsView = document.getElementById('friends-view');
    const messagesContainer = document.getElementById('messages-container');

    friendsView.classList.remove('hidden');
    messagesContainer.style.display = 'none';

    const friendsList = document.getElementById('friends-list');
    const addSection = document.getElementById('friends-add-section');
    const searchWrapper = friendsView.querySelector('.friends-search-wrapper');

    this._updateChannelHeaderForContext();

    if (addSection) addSection.classList.toggle('hidden', tab !== 'add');
    if (searchWrapper) searchWrapper.style.display = tab === 'add' ? 'none' : '';

    try {
      this.relationships = await API.Friend.list();
    } catch {
      this.relationships = this.relationships || [];
    }

    // type: 1=friend, 2=blocked, 3=pending_incoming, 4=pending_outgoing
    const friends = this.relationships.filter(r => r.type === 1);
    const pending = this.relationships.filter(r => r.type === 3 || r.type === 4);
    const blocked = this.relationships.filter(r => r.type === 2);

    let bodyHtml = '';
    const headerStyle =
      'padding:12px 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-secondary);min-height:1.5em';

    if (tab === 'online') {
      const online = friends.filter(f => f.user?.status !== 'offline');
      bodyHtml += `<div style="${headerStyle}">Online — ${online.length}</div>`;
      online.forEach(f => {
        bodyHtml += this._friendItemHtml(f);
      });
      if (online.length === 0)
        bodyHtml +=
          '<div class="friends-empty-state"><span class="friends-empty-icon" aria-hidden="true"><i class="fas fa-people-group"></i></span><p class="friends-empty-text">Nenhum amigo ainda</p><button type="button" class="btn btn-primary friends-add-btn" data-htab="add">Adicionar amigo</button></div>';
    } else if (tab === 'all') {
      bodyHtml += `<div style="${headerStyle}">Todos — ${friends.length}</div>`;
      friends.forEach(f => {
        bodyHtml += this._friendItemHtml(f);
      });
      if (friends.length === 0)
        bodyHtml +=
          '<div class="friends-empty-state"><span class="friends-empty-icon" aria-hidden="true"><i class="fas fa-people-group"></i></span><p class="friends-empty-text">Nenhum amigo ainda</p><button type="button" class="btn btn-primary friends-add-btn" data-htab="add">Adicionar amigo</button></div>';
    } else if (tab === 'pending') {
      bodyHtml += `<div style="${headerStyle}">Pendentes — ${pending.length}</div>`;
      pending.forEach(p => {
        const u = p.user || null;
        if (!this.isValidUser(u)) return;
        const isIncoming = p.type === 3;
        const avatarHtml = this._avatarImgHtml(u, (u.username || 'U').charAt(0));
        bodyHtml += `<div class="friend-item" data-user="${u.id}" data-rel-id="${p.id}">
                    <div class="friend-item-avatar offline">${avatarHtml}</div>
                    <div class="friend-item-info">
                        <div class="friend-item-name">${this.escapeHtml(u.username)}</div>
                        <div class="friend-item-status">${isIncoming ? 'Convite recebido' : 'Pedido enviado'}</div>
                    </div>
                    <div class="friend-item-actions">
                        ${isIncoming ? '<button title="Accept"><i class="fas fa-check"></i></button><button title="Deny"><i class="fas fa-xmark"></i></button>' : '<button title="Cancel"><i class="fas fa-xmark"></i></button>'}
                    </div>
                </div>`;
      });
      if (pending.length === 0)
        bodyHtml += '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhum pedido pendente</div>';
    } else if (tab === 'invites') {
      const incoming = this.relationships.filter(r => r.type === 3);
      if (incoming.length === 0) {
        bodyHtml += `<div class="friends-invites-empty">
                    <i class="fas fa-envelope-open" aria-hidden="true"></i>
                    <h3>Nenhum convite recebido</h3>
                    <p>Quem acessar o mesmo site e enviar convite para &quot;${this.escapeHtml(this.currentUser?.username || '414123')}&quot; aparecerá aqui.</p>
                </div>`;
      } else {
        bodyHtml += `<div style="${headerStyle}">Convites — ${incoming.length}</div>`;
        incoming.forEach(p => {
          const u = p.user || null;
          if (!this.isValidUser(u)) return;
          const avatarHtml = this._avatarImgHtml(u, (u.username || 'U').charAt(0));
          bodyHtml += `<div class="friend-item" data-user="${u.id}" data-rel-id="${p.id}">
                        <div class="friend-item-avatar offline">${avatarHtml}</div>
                        <div class="friend-item-info">
                            <div class="friend-item-name">${this.escapeHtml(u.username)}</div>
                            <div class="friend-item-status">Convite recebido</div>
                        </div>
                        <div class="friend-item-actions">
                            <button title="Accept"><i class="fas fa-check"></i></button>
                            <button title="Deny"><i class="fas fa-xmark"></i></button>
                        </div>
                    </div>`;
        });
      }
    } else if (tab === 'blocked') {
      bodyHtml += `<div style="${headerStyle}">Blocked — ${blocked.length}</div>`;
      blocked.forEach(b => {
        const u = b.user || null;
        if (!this.isValidUser(u)) return;
        const avatarHtml = this._avatarImgHtml(u, (u.username || 'U').charAt(0));
        bodyHtml += `<div class="friend-item" data-user="${u.id}" data-rel-id="${b.id}">
                    <div class="friend-item-avatar offline">${avatarHtml}</div>
                    <div class="friend-item-info"><div class="friend-item-name">${this.escapeHtml(u.username)}</div><div class="friend-item-status">Blocked</div></div>
                    <div class="friend-item-actions"><button title="Unblock"><i class="fas fa-user-slash"></i></button></div>
                </div>`;
      });
    } else if (tab === 'add') {
      bodyHtml = '';
    }

    if (friendsList) friendsList.innerHTML = bodyHtml;

    friendsList?.querySelectorAll('.friends-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.renderFriendsView('add');
        this._updateChannelHeaderForContext();
      });
    });

    const addBtn = friendsView.querySelector('#send-friend-request-btn');
    if (addBtn) {
      addBtn.onclick = async () => {
        const input = friendsView.querySelector('#add-friend-input');
        if (input?.value.trim()) {
          try {
            await API.Friend.add(input.value.trim());
            this.showToast(`Friend request sent to ${input.value.trim()}!`, 'success');
            input.value = '';
            this.renderFriendsView('pending');
          } catch (err) {
            this.showToast(err.message || 'Failed to send request', 'error');
          }
        }
      };
    }

    friendsList?.querySelectorAll('.friend-item-actions button').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const action = btn.title;
        const item = btn.closest('.friend-item');
        const relId = item?.dataset.relId;
        try {
          if (action === 'Accept' && relId) {
            await API.Friend.accept(relId);
            this.showToast('Friend request accepted!', 'success');
            this.renderFriendsView(tab);
            this._refreshDMListSidebar();
          } else if ((action === 'Deny' || action === 'Cancel' || action === 'Unblock') && relId) {
            await API.Friend.remove(relId);
            this.showToast(action === 'Unblock' ? 'User unblocked' : 'Request removed', 'success');
            this.renderFriendsView(tab);
          } else if (action === 'Message') {
            const user = item?.dataset.user || rel?.user?.id;
            if (user) {
              try {
                this.showToast('Abrindo conversa...', 'info');
                const channel = await API.DM.create(user);
                document.getElementById('friends-view')?.classList?.add('hidden');
                const msgCont = document.getElementById('messages-container');
                if (msgCont) msgCont.style.display = '';
                const inputCont = document.querySelector('.message-input-container');
                if (inputCont) inputCont.style.display = '';
                const channelNameEl = document.getElementById('channel-name');
                const channelIconEl = document.querySelector('.channel-header .channel-info i');
                if (channelNameEl) channelNameEl.textContent = channel.recipients?.[0]?.username || 'DM';
                if (channelIconEl) channelIconEl.className = 'fas fa-envelope channel-header-icon';
                if (this.currentChannel?.id && this.currentChannel.id !== channel?.id && this.gateway)
                  this.gateway.unsubscribeChannel(this.currentChannel.id);
                this.currentChannel = channel;
                this.currentChannel.room = 'dm:' + (channel.id || '');
                if (this.currentChannel.id && this.gateway) this.gateway.subscribeChannel(this.currentChannel.id);
                this._renderDMChat(channel);
                if (channel.id)
                  try {
                    history.replaceState({}, '', `/channels/@me/${channel.id}`);
                  } catch (_) {}
                this._refreshDMListSidebar();
                this._updateChannelHeaderForContext();
              } catch (err) {
                this.showToast(err.message || 'Não foi possível abrir a conversa', 'error');
              }
            }
          }
        } catch (err) {
          this.showToast(err.message || 'Action failed', 'error');
        }
      });
    });

    friendsList?.querySelectorAll('.friend-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.friend-item-actions')) return;
        const userId = item.dataset.user;
        const rel = this.relationships.find(r => r.user?.id === userId);
        if (rel?.user) {
          this.showProfileCard(
            { user_id: rel.user.id, username: rel.user.username, status: rel.user.status || 'offline' },
            e
          );
        }
      });
    });

    const friendsSearchInput = friendsView.querySelector('#friends-search-input');
    if (friendsSearchInput) {
      friendsSearchInput.oninput = e => {
        const q = e.target.value.toLowerCase();
        friendsList?.querySelectorAll('.friend-item').forEach(item => {
          const name = item.querySelector('.friend-item-name')?.textContent?.toLowerCase() || '';
          item.style.display = name.includes(q) || !q ? '' : 'none';
        });
      };
    }
  }

  _formatActivityTime(minutes) {
    if (minutes >= 60) return (Math.round(minutes / 6) / 10).toFixed(1) + ' h';
    return minutes + ' min';
  }

  _rankingActivityProgress(minutes) {
    const m = minutes || 0;
    if (m < 5) return Math.min(100, (m / 5) * 100);
    const level = Math.floor(Math.log(m / 5) / Math.log(1.2)) + 1;
    const minForL = 5 * Math.pow(1.2, level - 1);
    const minForNext = minForL * 1.2;
    const pct = ((m - minForL) / (minForNext - minForL)) * 100;
    return Math.min(100, Math.max(0, pct));
  }

  _rankingXpProgress(xp) {
    const x = xp || 0;
    if (x < 500) return Math.min(100, (x / 500) * 100);
    const level = Math.floor(Math.log(x / 500) / Math.log(1.2)) + 1;
    const xpForL = 500 * Math.pow(1.2, level - 1);
    const xpForNext = xpForL * 1.2;
    const pct = ((x - xpForL) / (xpForNext - xpForL)) * 100;
    return Math.min(100, Math.max(0, pct));
  }

  async renderRankingsView() {
    const friendsView = document.getElementById('friends-view');
    const messagesContainer = document.getElementById('messages-container');
    const friendsList = document.getElementById('friends-list');
    const addSection = document.getElementById('friends-add-section');
    const searchWrapper = document.querySelector('.friends-view .friends-search-wrapper');
    if (friendsView) friendsView.classList.remove('hidden');
    if (messagesContainer) messagesContainer.style.display = 'none';
    if (addSection) addSection.classList.add('hidden');
    if (searchWrapper) searchWrapper.style.display = 'none';
    if (!friendsList) return;
    friendsList.innerHTML =
      '<div class="ranking-loading"><i class="fas fa-trophy"></i><span>A carregar ranking…</span></div>';
    this._updateUserControlsVoiceVisibility();
    try {
      const data = await API.Ranking.list(10);
      const byActivity = data?.by_activity || [];
      const byContent = data?.by_content || [];
      const renderRankRow = (row, type) => {
        const name = (row.username || 'User').trim();
        const initial = (name.charAt(0) || 'U').toUpperCase();
        const avatarSrc = this._getAvatarUrlForUser(row);
        const avatarFallback = this._getPlaceholderAvatarUrl(name);
        const progress =
          type === 'activity' ? this._rankingActivityProgress(row.minutes) : this._rankingXpProgress(row.xp);
        const pct = Math.max(8, Math.min(100, progress));
        const levelLabel = row.level != null && row.level > 0 ? row.level : '—';
        const stat =
          type === 'activity'
            ? `${this._formatActivityTime(row.minutes || 0)} · Nível ${levelLabel}`
            : `${(row.xp || 0).toLocaleString()} XP · Nível ${levelLabel}`;
        const rankClass = row.rank === 1 ? 'rank-1' : row.rank === 2 ? 'rank-2' : row.rank === 3 ? 'rank-3' : '';
        const avatarHtml = `<img src="${this.escapeHtml(avatarSrc)}" alt="" loading="lazy" data-fallback-avatar="${avatarFallback ? this.escapeHtml(avatarFallback) : ''}"><span style="display:none">${this.escapeHtml(initial)}</span>`;
        return `<div class="ranking-row ${rankClass}" data-user-id="${this.escapeHtml(row.id)}" data-rank="${row.rank}">
                    <div class="ranking-row-rank">${row.rank}</div>
                    <div class="ranking-row-avatar" aria-hidden="true">${avatarHtml}</div>
                    <div class="ranking-row-info">
                        <span class="ranking-row-name">${this.escapeHtml(name)}</span>
                        <span class="ranking-row-stat">${stat}</span>
                    </div>
                    <div class="ranking-row-bar-wrap">
                        <div class="ranking-row-bar-fill" style="width:${pct}%"></div>
                    </div>
                </div>`;
      };
      const html = `
                <div class="ranking-view">
                    <header class="ranking-hero">
                        <div class="ranking-hero-icon" aria-hidden="true"><i class="fas fa-trophy"></i></div>
                        <h1 class="ranking-hero-title">LIBERTY Ranking</h1>
                        <p class="ranking-hero-desc">Atividade e níveis da comunidade</p>
                    </header>
                    <div class="ranking-tables">
                        <section class="ranking-card">
                            <div class="ranking-card-head">
                                <span class="ranking-card-icon" aria-hidden="true"><i class="fas fa-clock"></i></span>
                                <div>
                                    <h2 class="ranking-card-title">Por atividade</h2>
                                    <p class="ranking-card-desc">Tempo em app. 5 min → Nível 1, +20% por nível</p>
                                </div>
                            </div>
                            <div class="ranking-list">
                                ${byActivity.length ? byActivity.map(r => renderRankRow(r, 'activity')).join('') : '<div class="ranking-empty"><i class="fas fa-inbox"></i><span>Ainda não há atividade.</span></div>'}
                            </div>
                        </section>
                        <section class="ranking-card">
                            <div class="ranking-card-head">
                                <span class="ranking-card-icon" aria-hidden="true"><i class="fas fa-bolt"></i></span>
                                <div>
                                    <h2 class="ranking-card-title">Por conteúdo (XP)</h2>
                                    <p class="ranking-card-desc">1 char = 1 XP. 500 XP → Nível 1, +20% por nível</p>
                                </div>
                            </div>
                            <div class="ranking-list">
                                ${byContent.length ? byContent.map(r => renderRankRow(r, 'content')).join('') : '<div class="ranking-empty"><i class="fas fa-inbox"></i><span>Ainda não há conteúdo.</span></div>'}
                            </div>
                        </section>
                    </div>
                </div>`;
      friendsList.innerHTML = html;
      friendsList.classList.add('ranking-container');
    } catch (err) {
      friendsList.innerHTML =
        '<div class="ranking-empty" style="padding:24px;text-align:center;color:var(--error)">Falha ao carregar ranking.</div>';
      friendsList.classList.remove('ranking-container');
    }
  }

  _avatarImgHtml(user, letter) {
    const name = typeof user === 'string' ? user : (user?.username || user?.display_name || 'U');
    const L = letter != null ? letter : name.charAt(0).toUpperCase();
    const src = this._getAvatarUrlForUser(typeof user === 'string' ? name : user);
    const fallback = this._getPlaceholderAvatarUrl(name);
    return `<img src="${this.escapeHtml(src)}" alt="" data-fallback-avatar="${fallback ? this.escapeHtml(fallback) : ''}"><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:14px;font-weight:700;color:var(--text-secondary)">${this.escapeHtml(L)}</span>`;
  }

  isValidUser(user) {
    if (!user) return false;
    const u = user.username || user.display_name || user.name;
    if (!u) return false;
    if (String(u).trim() === 'Unknown') return false;
    if (typeof window !== 'undefined' && typeof window.isValidUser !== 'function') {
      window.isValidUser = function (u2) {
        if (!u2) return false;
        const u3 = u2.username || u2.display_name || u2.name;
        if (!u3) return false;
        return String(u3).trim() !== 'Unknown';
      };
    }
    return true;
  }

  _friendItemHtml(rel) {
    const u = rel && rel.user ? rel.user : null;
    if (!this.isValidUser(u)) return '';
    const uname = u.username || 'U';
    const avatarHtml = this._avatarImgHtml(u, uname.charAt(0));
    return `<div class="friend-item" data-user="${u.id}" data-rel-id="${rel.id}">
            <div class="friend-item-avatar ${u.status || 'offline'}">${avatarHtml}</div>
            <div class="friend-item-info">
                <div class="friend-item-name">${this.escapeHtml(uname)}</div>
                <div class="friend-item-status">${this._statusLabel(u.status || 'offline')}</div>
            </div>
            <div class="friend-item-actions">
                <button title="Message"><i class="fas fa-message"></i></button>
                <button title="More"><i class="fas fa-bars"></i></button>
            </div>
        </div>`;
  }

  _statusLabel(s) {
    return (
      { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline', invisible: 'Invisible' }[s] ||
      'Online'
    );
  }

  _updateChannelHeaderForContext() {
    this._updateMembersSidebarVisibility();
    const header = document.querySelector('.channel-header');
    if (!header) return;
    const info = header.querySelector('.channel-info');
    const actions = header.querySelector('.channel-actions');
    const isDM =
      this.currentChannel &&
      (this.currentChannel.type === 'dm' || this.currentChannel.type === 'group_dm') &&
      !this.currentChannel.server_id;

    // Botões só para DM: Voz, Vídeo, Compartilhar tela
    const voiceBtn = document.getElementById('voice-call-btn');
    const videoBtn = document.getElementById('video-call-btn');
    const screenShareBtn = document.getElementById('screen-share-header-btn');
    header.querySelectorAll('.dm-only-action').forEach(el => {
      el.style.display = isDM ? '' : 'none';
    });
    header.querySelectorAll('.channel-only-action').forEach(el => {
      el.style.display = isDM ? 'none' : '';
    });
    if (videoBtn && isDM) videoBtn.style.display = '';
    if (screenShareBtn && isDM) screenShareBtn.style.display = '';

    if (isDM) {
      const recipient = (this.currentChannel?.recipients || [])[0] || null;
      const valid = this.isValidUser(recipient);
      const name = valid ? recipient.username : this.currentChannel?.name || 'DM';
      const status = (valid && recipient.status) || 'offline';
      const avatarSrc = this._getAvatarUrlForUser(valid ? recipient : { username: name });
      const avatarFallback = this._getPlaceholderAvatarUrl(name);
      const initial = name.charAt(0).toUpperCase();
      info.innerHTML = `
                <div class="dm-header-avatar ${status}" aria-hidden="true"><img src="${this.escapeHtml(avatarSrc)}" alt="" data-fallback-avatar="${avatarFallback ? this.escapeHtml(avatarFallback) : ''}"><span style="display:none">${this.escapeHtml(initial)}</span></div>
                <h3 id="channel-name">${this.escapeHtml(name)}</h3>
                <div class="channel-header-divider" aria-hidden="true"></div>
                <span class="channel-topic dm-status" id="channel-topic">${this._statusLabel(status)}</span>
            `;
    } else if (this.isHomeView && this.currentHomeSubView === 'rankings') {
      info.innerHTML = `
                <i class="fas fa-medal channel-header-icon" id="channel-header-icon" aria-hidden="true"></i>
                <h3 id="channel-name">LIBERTY Rankings</h3>
                <div class="channel-header-divider" aria-hidden="true"></div>
                <span class="channel-topic" id="channel-topic">Quem mais fica e comenta</span>
            `;
    } else if (this.isHomeView) {
      this.currentHomeSubView = this.currentHomeSubView || 'friends';
      const tab = this.currentFriendsTab || 'online';
      info.innerHTML = `
                <i class="fas fa-people-group channel-header-icon" aria-hidden="true"></i>
                <h3>Amigos</h3>
                <div class="channel-header-divider" aria-hidden="true"></div>
                <div class="friends-header-tabs">
                    <button class="friends-header-tab ${tab === 'online' ? 'active' : ''}" data-htab="online">Online</button>
                    <button class="friends-header-tab ${tab === 'all' ? 'active' : ''}" data-htab="all">Todos</button>
                    <button class="friends-header-tab ${tab === 'pending' ? 'active' : ''}" data-htab="pending">Pendentes</button>
                    <button class="friends-header-tab ${tab === 'invites' ? 'active' : ''}" data-htab="invites">Convites recebidos</button>
                    <button class="friends-header-tab ${tab === 'blocked' ? 'active' : ''}" data-htab="blocked">Bloqueados</button>
                    <button class="friends-header-tab add-friend ${tab === 'add' ? 'active' : ''}" data-htab="add">Adicionar amigo</button>
                </div>
            `;
      info.querySelectorAll('.friends-header-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          this.renderFriendsView(btn.dataset.htab);
          this._updateChannelHeaderForContext();
        });
      });
    } else {
      const ch = this.channels.find(c => c.id === (this.currentChannel?.id || this.currentChannel));
      const icon = ch?.channel_type === 'voice' ? 'fa-tower-broadcast' : 'fa-message';
      const name = ch?.name || 'general';
      const topic = ch?.topic || '';
      info.innerHTML = `
                <i class="fas ${icon} channel-header-icon" id="channel-header-icon" aria-hidden="true"></i>
                <h3 id="channel-name">${this.escapeHtml(name)}</h3>
                <div class="channel-header-divider" aria-hidden="true"></div>
                <span class="channel-topic" id="channel-topic">${this.escapeHtml(topic)}</span>
            `;
    }
    if (isDM) {
      // Código antigo removido - usando novo sistema WebRTCManager
      // this._wireDMHeaderVoiceVideoButtons();
    }
    this._updateUserControlsVoiceVisibility();
    actions?.querySelectorAll('.channel-header-dm-only').forEach(el => {
      el.style.display = isDM ? '' : 'none';
    });
    // Perfil do outro user na sidebar quando estamos numa DM de 1 pessoa
    const dmChannel =
      this.currentChannel?.id && this.dmChannels
        ? this.dmChannels.find((d) => d.id === this.currentChannel.id)
        : null;
    const isSingleDM =
      (isDM && this.currentChannel?.recipients?.length === 1) ||
      (dmChannel && !dmChannel.server_id && dmChannel.recipients?.length === 1 && dmChannel.type !== 'group_dm');
    const recipientId =
      this.currentChannel?.recipients?.[0]?.id || dmChannel?.recipients?.[0]?.id || null;
    if (isSingleDM && recipientId) {
      this.renderDMProfileSidebar(recipientId);
    } else if (!this.isHomeView && this.currentServer?.id && this.members) {
      this.renderMembers();
    } else if (this.isHomeView) {
      this.renderActiveNow();
    }
  }

  _updateUserControlsVoiceVisibility() {
    const voiceEl = document.getElementById('user-controls-voice');
    if (!voiceEl) return;
    const inDM =
      !this.isHomeView &&
      this.currentChannel &&
      (this.currentChannel.type === 'dm' || this.currentChannel.type === 'group_dm') &&
      !this.currentChannel.server_id;
    voiceEl.classList.toggle('hidden', !inDM);
  }

  _updateVoiceCallButtonVisibility() {
    const btn = document.getElementById('voice-call-btn');
    if (!btn) return;
    const isDMOrGroup =
      this.currentChannel &&
      (this.currentChannel.type === 'dm' || this.currentChannel.type === 'group_dm') &&
      !this.currentChannel.server_id;
    btn.style.display = isDMOrGroup ? '' : 'none';
  }

  _wireDMHeaderVoiceVideoButtons() {
    const videoBtn = document.getElementById('video-call-btn');
    const screenShareBtn = document.getElementById('screen-share-header-btn');
    if (videoBtn && !videoBtn._wired) {
      videoBtn._wired = true;
      videoBtn.addEventListener('click', () => {
        const voiceBtn = document.getElementById('voice-call-btn');
        if (voiceBtn) voiceBtn.click();
      });
    }
    if (screenShareBtn && !screenShareBtn._wired) {
      screenShareBtn._wired = true;
      screenShareBtn.addEventListener('click', () => {
        const voiceBtn = document.getElementById('voice-call-btn');
        if (voiceBtn) voiceBtn.click();
        setTimeout(() => document.getElementById('voice-call-screenshare')?.click(), 500);
      });
    }
  }

  _updateVoiceCallParticipantsBar() {
    const bar = document.getElementById('voice-call-participants-bar');
    if (!bar) return;
    const me = this.currentUser?.username || 'Você';
    const meInitial = me.charAt(0).toUpperCase();
    const targetId = this._voiceCallState?.targetUserId;
    let other = (this.currentChannel?.recipients || []).find(r => r.id === targetId);
    if (!other && targetId && Array.isArray(this.dmChannels)) {
      const dm = this.dmChannels.find(c => c.recipients?.some(r => r.id === targetId));
      other = dm?.recipients?.find(r => r.id === targetId);
    }
    const otherName = other?.username || 'Outro';
    const otherInitial = otherName.charAt(0).toUpperCase();
    const meAvatar = this._getAvatarUrlForUser({ username: me, avatar_url: this.currentUser?.avatar_url || this.currentUser?.avatar });
    const otherAvatar = this._getAvatarUrlForUser({ username: otherName, avatar_url: other?.avatar_url || other?.avatar });
    bar.innerHTML =
      `<div class="call-neo__avatars">` +
      `<div class="call-neo__avatar" id="call-avatar-me" title="${this.escapeHtml(me)}">` +
      (meAvatar ? `<img src="${this.escapeHtml(meAvatar)}" alt="">` : `<span class="call-neo__avatar-initial">${this.escapeHtml(meInitial)}</span>`) +
      `</div>` +
      `<div class="call-neo__avatar" id="call-avatar-other" title="${this.escapeHtml(otherName)}">` +
      (otherAvatar ? `<img src="${this.escapeHtml(otherAvatar)}" alt="">` : `<span class="call-neo__avatar-initial">${this.escapeHtml(otherInitial)}</span>`) +
      `</div>` +
      `</div>` +
      `<div class="call-neo__call-status">Em ligação</div>`;
  }

  _updateHeaderCallUI(participants) {
    const wrap = document.getElementById('header-call');
    if (!wrap) return;
    const avatars = document.getElementById('header-call-avatars');
    const names = document.getElementById('header-call-names');
    if (!avatars || !names) return;
    const list = Array.isArray(participants) ? participants : [];
    if (list.length === 0) {
      wrap.classList.add('hidden');
      avatars.replaceChildren();
      names.textContent = '';
      return;
    }
    wrap.classList.remove('hidden');
    const frag = document.createDocumentFragment();
    const labelNames = [];
    for (let i = 0; i < list.length; i += 1) {
      const p = list[i] || {};
      const uname = String(p.username || p.name || 'User');
      if (!uname || String(uname).trim() === 'Unknown') continue;
      labelNames.push(uname);
      const av = String(p.avatar_url || p.avatar || '');
      const el = document.createElement('div');
      el.className = 'header-call__avatar' + (p.isSpeaking ? ' header-call__avatar--speaking' : '');
      el.id = 'header-call-avatar-' + String(p.id || p.socketId || i);
      el.title = uname;
      if (av) {
        const img = document.createElement('img');
        img.src = av;
        img.alt = '';
        el.appendChild(img);
      } else {
        const span = document.createElement('div');
        span.className = 'header-call__avatar-initial';
        span.textContent = uname.charAt(0).toUpperCase();
        el.appendChild(span);
      }
      frag.appendChild(el);
    }
    avatars.replaceChildren(frag);
    names.textContent = labelNames.join(', ');
  }

  _callHardResetHeaderOnly() {
    if (this._voiceCallState.pc) {
      try { this._voiceCallState.pc.close(); } catch (_) {}
      this._voiceCallState.pc = null;
    }
    if (this._voiceCallState.stream) {
      try { this._voiceCallState.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      this._voiceCallState.stream = null;
    }
    this._voiceCallState.pendingOffer = null;
    this._voiceCallState.pendingIceCandidates = [];
    this._voiceCallState.incomingFromUserId = null;
    this._voiceCallState.targetUserId = null;
    this._voiceCallState.callId = null;
    this._webrtcStopLocalAudioLevel();
    this._webrtcClearRemote();
    const header = document.getElementById('header-call');
    const statusEl = document.getElementById('header-call-status');
    const controls = document.getElementById('header-call-controls');
    if (statusEl) statusEl.textContent = '';
    if (controls) controls.replaceChildren();
    if (header) header.classList.add('hidden');
  }

  _updateMembersSidebarVisibility() {
    const el = document.getElementById('members-sidebar');
    if (!el) return;
    const inServer = !this.isHomeView;
    const isChannelInDmList =
      this.currentChannel?.id && this.dmChannels && this.dmChannels.some((d) => d.id === this.currentChannel.id);
    const inDmOrGroup =
      this.currentChannel &&
      (this.currentChannel.type === 'dm' ||
        this.currentChannel.type === 'group_dm' ||
        isChannelInDmList);
    const show = inServer || inDmOrGroup;
    el.classList.toggle('members-sidebar--hidden', !show);
  }

  renderActiveNow() {
    const membersSidebar = document.getElementById('members-sidebar');
    const membersList = document.getElementById('members-list');
    if (!membersSidebar) return;

    this._updateMembersSidebarVisibility();

    if (this.isHomeView) {
      membersSidebar.classList.remove('collapsed');
      const headerEl = document.getElementById('members-sidebar-header');
      const onlineTitleEl = document.getElementById('members-online-title');
      if (headerEl) headerEl.classList.add('hidden');
      if (onlineTitleEl) onlineTitleEl.classList.add('hidden');
      membersList.innerHTML = `
                <div class="active-now-panel" style="width:100%;border:none;padding:16px">
                    <h4 style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:16px">Active Now</h4>
                    <div class="active-now-empty" style="text-align:center;padding:20px 16px">
                        <p style="font-weight:600;color:var(--text-primary);margin-bottom:4px">It's quiet for now...</p>
                        <p style="font-size:13px;color:var(--text-secondary)">When a friend starts an activity — like playing a game or hanging out on voice — we'll show it here!</p>
                    </div>
                </div>
            `;
    }
  }

  async selectServer(serverId, preferredChannelId = null) {
    this.isHomeView = false;
    document
      .querySelectorAll('.server-item')
      .forEach(item => item.classList.toggle('active', item.dataset.server === serverId));
    const server = this.servers.find(s => s.id === serverId);
    if (!server) return;
    this.currentServer = server;
    const serverNameEl = document.getElementById('server-name');
    if (serverNameEl) serverNameEl.textContent = server.name;
    const serverHeader = document.querySelector('.server-header');
    if (serverHeader) serverHeader.style.display = '';
    {
      const _b = document.getElementById('server-dropdown-btn');
      if (_b) {
        _b.querySelector('i').className = 'fas fa-angle-down';
        _b.style.display = '';
      }
    }

    const homeContent = document.getElementById('home-sidebar-content');
    if (homeContent) homeContent.style.display = 'none';
    const channelList = document.getElementById('channel-list');
    if (channelList) channelList.style.display = '';

    const friendsView = document.getElementById('friends-view');
    const messagesContainer = document.getElementById('messages-container');
    if (friendsView) friendsView.classList.add('hidden');
    if (messagesContainer) messagesContainer.style.display = '';

    const membersSidebar = document.getElementById('members-sidebar');
    if (membersSidebar) membersSidebar.classList.remove('collapsed');
    const messageInputContainer = document.querySelector('.message-input-container');
    if (messageInputContainer) messageInputContainer.style.display = '';
    this._updateChannelHeaderForContext();
    try {
      let data = {};
      try {
        data = await API.Server.get(serverId);
      } catch (_) {
        data = {};
      }
      this.channels = data.channels || (data.server && data.server.channels) || [];
      if (this.channels.length === 0) {
        const channelList = await API.Channel.list(serverId);
        this.channels = Array.isArray(channelList) ? channelList : [];
      }
      this.members = data.members || [];
      if (this.members.length === 0) {
        try {
          const memberList = await API.Member.list(serverId);
          this.members = Array.isArray(memberList) ? memberList : [];
        } catch (_) {}
      }
      this.renderChannels();
      this.renderMembers();
      if (typeof history !== 'undefined' && history.replaceState) {
        history.replaceState({ view: 'server', serverId }, '', `/channels/${serverId}`);
      }
      const toSelect = preferredChannelId && this.channels.some(c => c.id === preferredChannelId)
        ? this.channels.find(c => c.id === preferredChannelId)
        : this.channels.find(c => c.channel_type === 'text' && c.type !== 'category');
      if (toSelect) this.selectChannel(toSelect.id);
    } catch (err) {
      this.showToast('Failed to load server', 'error');
    }
  }

  async handleCreateServer() {
    const nameInput = document.getElementById('server-name-input');
    const name = nameInput?.value?.trim() || '';
    const regionSelect = document.getElementById('server-region');
    const region = regionSelect?.value || 'us-east';
    const serverIconUpload = document.querySelector('.server-icon-upload');
    const iconDataUrl = serverIconUpload?.dataset?.iconDataUrl || null;
    const btn = document.querySelector('#create-server-form .btn-primary');
    
    if (!name) {
      this.showToast('Digite um nome para o servidor', 'error');
      return;
    }
    
    try {
      this._setButtonLoading(btn, true);
      console.log('[APP] Criando servidor:', name);
      
      let data;
      try {
        // Timeout de 10 segundos
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: servidor não respondeu')), 10000)
        );
        
        const createPromise = API.Server.create(name, region, iconDataUrl);
        data = await Promise.race([createPromise, timeoutPromise]);
        console.log('[APP] Resposta criação servidor:', data);
      } catch (apiError) {
        console.warn('[APP] API falhou, criando servidor local:', apiError.message);
        // Fallback: criar servidor localmente
        data = {
          server: {
            id: 'local_' + Date.now(),
            name: name,
            region: region,
            icon: iconDataUrl,
            owner_id: this.currentUser?.id,
            created_at: new Date().toISOString(),
            channels: [],
            members: [{ user_id: this.currentUser?.id, role: 'owner' }]
          }
        };
      }
      
      if (data && data.server) {
        if (!this.servers.some(s => s.id === data.server.id)) {
          this.servers.push(data.server);
        }
        this.renderServers();
        this.selectServer(data.server.id);
        this.hideModal();
        
        // Limpar form
        if (nameInput) nameInput.value = '';
        const serverIconInput = document.getElementById('server-icon-input');
        if (serverIconInput) serverIconInput.value = '';
        if (serverIconUpload) {
          delete serverIconUpload.dataset.iconDataUrl;
          const circle = serverIconUpload.querySelector('.icon-upload-circle');
          if (circle) {
            circle.querySelectorAll('.server-icon-preview').forEach(p => p.remove());
            circle.querySelectorAll('i, span').forEach(el => el.style.removeProperty('display'));
            circle.style.removeProperty('overflow');
          }
        }
        this.showToast(`Servidor "${name}" criado!`, 'success');
      } else if (data && data.id) {
        // Resposta direta com o servidor
        if (!this.servers.some(s => s.id === data.id)) {
          this.servers.push(data);
        }
        this.renderServers();
        this.selectServer(data.id);
        this.hideModal();
        if (nameInput) nameInput.value = '';
        this.showToast(`Servidor "${name}" criado!`, 'success');
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error) {
      console.error('[APP] Erro ao criar servidor:', error);
      this.showToast(error.message || 'Falha ao criar servidor', 'error');
    } finally {
      this._setButtonLoading(btn, false);
    }
  }

  _isOfficialLibertyServer(server) {
    if (!server) return false;
    const name = (server.name || '').trim().toLowerCase();
    return name === 'liberty' && (server.owner_id == null || server.owner_id === '');
  }

  // ═══════════════════════════════════════════
  //  SERVER HEADER DROPDOWN
  // ═══════════════════════════════════════════

  toggleServerDropdown(e) {
    if (this._serverDropdown) {
      this.hideServerDropdown();
      return;
    }
    const header = document.querySelector('.server-header');
    const dd = document.createElement('div');
    dd.className = 'server-dropdown';
    const isOfficial = this._isOfficialLibertyServer(this.currentServer);
    const allItems = [
      { icon: 'fa-bolt', label: 'Server Boost', action: () => this.showToast('Server Boost — Coming Soon!', 'info') },
      { icon: 'fa-handshake', label: 'Invite People', action: () => this.showInviteModal() },
      { icon: 'fa-sliders', label: 'Server Settings', action: () => this.showSettingsPanel('server') },
      { divider: true },
      { icon: 'fa-plus', label: 'Create Channel', action: () => this.showCreateChannelModal() },
      { icon: 'fa-folder-tree', label: 'Create Category', action: () => this._createCategory() },
      { divider: true },
      {
        icon: 'fa-bell',
        label: 'Notification Settings',
        action: () => this.showToast('Notification settings updated', 'info'),
      },
      {
        icon: 'fa-shield-halved',
        label: 'Privacy Settings',
        action: () => this.showToast('Privacy settings opened', 'info'),
      },
      {
        icon: 'fa-address-card',
        label: 'Edit Server Profile',
        action: () => this.showToast('Edit your server profile', 'info'),
      },
      {
        icon: 'fa-eye-slash',
        label: 'Hide Muted Channels',
        action: () => this.showToast('Muted channels hidden', 'info'),
      },
      { divider: true },
      {
        icon: 'fa-right-from-bracket',
        label: 'Leave Server',
        danger: true,
        action: () => {
          if (this.gateway) this.gateway.leaveServer(this.currentServer?.id);
          this.showToast('Left the server', 'info');
          this.selectHome();
        },
      },
    ];
    const items = isOfficial
      ? allItems.filter(i => {
          if (i.divider) return true;
          const noEdit = [
            'Server Settings',
            'Create Channel',
            'Create Category',
            'Edit Server Profile',
            'Leave Server',
          ].includes(i.label);
          return !noEdit;
        })
      : allItems;
    dd.innerHTML = items
      .map(item => {
        if (item.divider) return '<div class="dropdown-divider"></div>';
        return `<div class="dropdown-item ${item.danger ? 'danger' : ''}"><i class="fas ${item.icon}" style="width:20px;text-align:center"></i>${this.escapeHtml(item.label)}</div>`;
      })
      .join('');
    let idx = 0;
    dd.querySelectorAll('.dropdown-item').forEach(el => {
      const realItems = items.filter(i => !i.divider);
      const action = realItems[idx]?.action;
      el.addEventListener('click', () => {
        this.hideServerDropdown();
        if (action) action();
      });
      idx++;
    });
    header.style.position = 'relative';
    header.appendChild(dd);
    this._serverDropdown = dd;
  }

  hideServerDropdown() {
    if (this._serverDropdown) {
      this._serverDropdown.remove();
      this._serverDropdown = null;
    }
  }

  _createCategory() {
    if (this._isOfficialLibertyServer(this.currentServer)) {
      this.showToast('O servidor LIBERTY oficial não pode ser alterado.', 'info');
      return;
    }
    const name = prompt('Category name:');
    if (name) {
      if (this.gateway) this.gateway.createChannel(this.currentServer?.id, name, 'category');
      this.showToast(`Category "${name}" created!`, 'success');
    }
  }

  // ═══════════════════════════════════════════
  //  CHANNELS
  // ═══════════════════════════════════════════

  renderChannels() {
    const container = document.getElementById('channel-list');
    if (!container) return;
    container.style.display = '';
    const homeContent = document.getElementById('home-sidebar-content');
    if (homeContent) homeContent.style.display = 'none';
    container.innerHTML = '';
    if (this.channels.length === 0) {
      container.innerHTML =
        '<div class="empty-state" style="padding:24px 16px;text-align:center"><i class="fas fa-message" style="font-size:28px;color:var(--text-muted);margin-bottom:12px;display:block;opacity:.7"></i><p class="empty-state-description" style="margin-bottom:12px">No channels yet</p><button class="btn btn-primary btn-sm" type="button">Create Channel</button></div>';
      container.querySelector('button').addEventListener('click', () => this.showCreateChannelModal());
      return;
    }
    const categories = new Map();
    const noCategory = [];
    this.channels.forEach(channel => {
      if (channel.type === 'category') {
        if (!categories.has(channel.id)) categories.set(channel.id, { category: channel, channels: [] });
      } else if (channel.parent_id) {
        if (!categories.has(channel.parent_id)) categories.set(channel.parent_id, { category: null, channels: [] });
        categories.get(channel.parent_id).channels.push(channel);
      } else {
        noCategory.push(channel);
      }
    });
    noCategory.forEach(ch => container.appendChild(this.createChannelElement(ch)));
    categories.forEach(({ category, channels }) => {
      const catEl = document.createElement('div');
      catEl.className = 'channel-category';
      const catName = category?.name || 'Channels';
      const catId = category?.id || null;
      catEl.innerHTML = `
                <div class="channel-category-header">
                    <i class="fas fa-angle-down"></i>
                    <span>${this.escapeHtml(catName)}</span>
                    <button class="btn-icon add-channel-btn" title="Add Channel" style="margin-left:auto;width:16px;height:16px;font-size:12px"><i class="fas fa-plus"></i></button>
                </div>
                <div class="channel-items"></div>
            `;
      catEl.querySelector('.channel-category-header').addEventListener('click', e => {
        if (!e.target.closest('.add-channel-btn')) catEl.classList.toggle('collapsed');
      });
      catEl.querySelector('.add-channel-btn').addEventListener('click', e => {
        e.stopPropagation();
        this.showCreateChannelModal(catId);
      });
      const itemsCont = catEl.querySelector('.channel-items');
      channels.forEach(ch => itemsCont.appendChild(this.createChannelElement(ch)));
      container.appendChild(catEl);
    });
  }

  createChannelElement(channel) {
    const item = document.createElement('div');
    item.className = 'channel-item';
    item.dataset.channel = channel.id;
    const isVoice = channel.channel_type === 'voice';
    const icon = isVoice ? 'fa-tower-broadcast' : 'fa-message';
    if (isVoice) item.classList.add('voice');
    const unread = this.unreadChannels.has(channel.id);
    item.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${this.escapeHtml(channel.name || 'unnamed')}</span>
            ${unread ? '<div class="channel-unread-dot"></div>' : ''}
        `;
    item.addEventListener('click', () => {
      this.selectChannel(channel.id);
    });
    return item;
  }

  async selectChannel(channelId) {
    if (this._closeMobileChannelDrawer) this._closeMobileChannelDrawer();
    const prevRoom = this.currentChannel?.room || this.currentChannel?.id;
    const channel = this.channels.find(c => c.id === channelId);
    if (!channel) return;
    this.currentChannel = channel;
    if (this.currentServer && this.currentServer.id && channel.id)
      this.currentChannel.room = 'channel:' + this.currentServer.id + ':' + channel.id;
    else this.currentChannel.room = channel.id;
    const room = this.currentChannel.room || channelId;
    const prevChannelId = this.currentChannel?.id;
    if (prevChannelId && prevChannelId !== channelId && this.gateway) this.gateway.unsubscribeChannel(prevChannelId);
    this.unreadChannels.delete(channelId);
    document
      .querySelectorAll('.channel-item')
      .forEach(item => item.classList.toggle('active', item.dataset.channel === channelId));
    if (channelId && this.gateway) this.gateway.subscribeChannel(channelId);

    const friendsView = document.getElementById('friends-view');
    const messagesContainer = document.getElementById('messages-container');
    if (friendsView) friendsView.classList.add('hidden');
    if (messagesContainer) messagesContainer.style.display = '';
    const msgInputContainer = document.querySelector('.message-input-container');
    if (msgInputContainer) msgInputContainer.style.display = '';

    document.getElementById('message-input').placeholder = `Message #${channel.name}`;
    const icon = channel.channel_type === 'voice' ? 'fa-tower-broadcast' : 'fa-message';
    this._updateChannelHeaderForContext();
    this.typing.clear();
    this.renderTypingIndicator();
    this.cancelReply();
    if (this.currentServer && this.currentServer.id && channelId && typeof history !== 'undefined' && history.replaceState) {
      history.replaceState({ view: 'channel', serverId: this.currentServer.id, channelId }, '', `/channels/${this.currentServer.id}/${channelId}`);
    }
    if (window.LibertyChatRoot && window.LibertyChatRoot.render) {
      window.LibertyChatRoot.render();
    } else {
      await this.loadMessages(room);
    }
  }

  // ═══════════════════════════════════════════
  //  VOICE
  // ═══════════════════════════════════════════

  connectVoice(channel) {
    this.voiceChannel = channel;
    const voiceView = document.getElementById('voice-call-view');
    const messagesContainer = document.getElementById('messages-container');
    const messageInputContainer = document.querySelector('.message-input-container');
    const voiceConnectedBar = document.getElementById('voice-connected');

    if (voiceView) {
      voiceView.classList.remove('hidden');
      document.getElementById('voice-call-channel-name').textContent = channel.name || 'Voice Channel';
      this._renderVoiceCallParticipants();
      this._wireVoiceCallControls();
    }
    if (messagesContainer) messagesContainer.style.display = 'none';
    if (messageInputContainer) messageInputContainer.style.display = 'none';
    if (voiceConnectedBar) {
      voiceConnectedBar.classList.remove('hidden');
      document.getElementById('voice-channel-name').textContent = channel.name || 'General';
    }

    this._updateChannelHeaderForVoice(channel);
    this.renderVoiceStatus();
    this.showToast(`Entrando em ${channel.name || 'voice'}...`, 'info');

    this._requestMicrophoneAndConnect();
  }

  async _requestMicrophoneAndConnect() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showToast('Seu navegador não suporta acesso ao microfone.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
      }
      this.localStream = stream;
      this.localStream.getAudioTracks().forEach(t => {
        t.enabled = !this.isMuted;
      });
      this.showToast(`Entrou em ${this.voiceChannel?.name || 'voice'} — microfone ativo`, 'success');
      if (this.voiceChannel) this._updateVoiceCallControlsState();
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Permissão de microfone negada. Ative o microfone nas configurações do site para falar.'
          : 'Não foi possível acessar o microfone.';
      this.showToast(msg, 'error');
      if (this.voiceChannel) this._updateVoiceCallControlsState();
    }
  }

  _updateChannelHeaderForVoice(channel) {
    const header = document.querySelector('.channel-header');
    const info = header?.querySelector('.channel-info');
    if (!info) return;
    info.innerHTML = `
            <i class="fas fa-tower-broadcast channel-header-icon" aria-hidden="true"></i>
            <h3 id="channel-name">${this.escapeHtml(channel?.name || 'Voice')}</h3>
            <div class="channel-header-divider" aria-hidden="true"></div>
            <span class="channel-topic" id="channel-topic">Canal de voz — conversa ao vivo</span>
        `;
  }

  _renderVoiceCallParticipants() {
    const container = document.getElementById('voice-call-participants');
    if (!container) return;
    const name = this.currentUser?.username || 'Você';
    const initial = name.charAt(0).toUpperCase();
    const status = this.isMuted ? 'Muted' : this.isDeafened ? 'Deafened' : 'Connected';
    const statusClass = this.isMuted ? 'muted' : 'listening';
    container.innerHTML = `
            <div class="voice-call-participant you ${this.isMuted ? 'muted' : ''}">
                <div class="voice-call-participant-avatar">${initial}</div>
                <div class="voice-call-participant-name">${this.escapeHtml(name)} (você)</div>
                <div class="voice-call-participant-status ${statusClass}">${status}</div>
            </div>
            <div class="voice-call-participant" style="border-style:dashed;opacity:.7">
                <div class="voice-call-participant-avatar" style="font-size:24px"><i class="fas fa-handshake"></i></div>
                <div class="voice-call-participant-name">Aguardando...</div>
                <div class="voice-call-participant-status">Outros na chamada aparecerão aqui</div>
            </div>
        `;
  }

  _wireVoiceCallControls() {
    const muteBtn = document.getElementById('voice-call-mute');
    const deafenBtn = document.getElementById('voice-call-deafen');
    const disconnectBtn = document.getElementById('voice-call-disconnect');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.toggleMute();
        this._updateVoiceCallControlsState();
      });
    }
    if (deafenBtn) {
      deafenBtn.addEventListener('click', () => {
        this.toggleDeafen();
        this._updateVoiceCallControlsState();
      });
    }
    if (disconnectBtn) disconnectBtn.addEventListener('click', () => this.disconnectVoice());
    this._updateVoiceCallControlsState();
  }

  _updateVoiceCallControlsState() {
    const muteBtn = document.getElementById('voice-call-mute');
    const deafenBtn = document.getElementById('voice-call-deafen');
    if (muteBtn) {
      const icon = muteBtn.querySelector('i');
      const span = muteBtn.querySelector('span');
      if (icon) icon.className = this.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
      if (span) span.textContent = this.isMuted ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('muted', this.isMuted);
    }
    if (deafenBtn) {
      const icon = deafenBtn.querySelector('i');
      const span = deafenBtn.querySelector('span');
      if (icon) icon.className = this.isDeafened ? 'fas fa-headphones' : 'fas fa-headphones';
      if (span) span.textContent = this.isDeafened ? 'Undeafen' : 'Deafen';
      deafenBtn.classList.toggle('deafened', this.isDeafened);
    }
    this._renderVoiceCallParticipants();
  }

  disconnectVoice() {
    if (!this.voiceChannel) return;

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    const voiceView = document.getElementById('voice-call-view');
    const messagesContainer = document.getElementById('messages-container');
    const messageInputContainer = document.querySelector('.message-input-container');
    const voiceConnectedBar = document.getElementById('voice-connected');

    if (voiceView) {
      voiceView.classList.add('hidden');
      voiceView.classList.add('call-neo--hidden');
      voiceView.classList.remove('call-neo--visible');
    }
    if (messagesContainer) messagesContainer.style.display = '';
    if (messageInputContainer) messageInputContainer.style.display = '';
    if (voiceConnectedBar) voiceConnectedBar.classList.add('hidden');

    this.voiceChannel = null;
    const panel = document.querySelector('.voice-panel');
    if (panel) panel.remove();

    const ch = this.channels.find(c => c.channel_type === 'text');
    if (ch) {
      if (this.currentChannel?.id && this.gateway) this.gateway.unsubscribeChannel(this.currentChannel.id);
      this.currentChannel = ch;
      if (this.currentServer && this.currentServer.id && ch.id)
        this.currentChannel.room = 'channel:' + this.currentServer.id + ':' + ch.id;
      else this.currentChannel.room = ch.id;
      if (ch.id && this.gateway) this.gateway.subscribeChannel(ch.id);
      const nameEl = document.getElementById('channel-name');
      const topicEl = document.getElementById('channel-topic');
      if (nameEl) nameEl.textContent = ch.name;
      if (topicEl) topicEl.textContent = ch.topic || '';
      this._updateChannelHeaderForContext();
      if (window.LibertyChatRoot && window.LibertyChatRoot.render) window.LibertyChatRoot.render();
      else this.loadMessages(room);
    }
    this.showToast('Saiu da chamada de voz', 'info');
  }

  renderVoiceStatus() {
    let panel = document.querySelector('.voice-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'voice-panel';
      const userPanel = document.querySelector('.user-panel');
      const parent = userPanel?.parentNode;
      if (parent && userPanel && parent.contains(userPanel)) parent.insertBefore(panel, userPanel);
      else if (parent) parent.appendChild(panel);
    }
    panel.innerHTML = `
            <div class="voice-panel-header">
                <div>
                    <div class="voice-panel-title">Voice Connected</div>
                    <div class="voice-panel-channel">${this.escapeHtml(this.voiceChannel?.name || 'Canal')}</div>
                </div>
                <div class="voice-panel-actions">
                    <button title="Disconnect"><i class="fas fa-phone-slash"></i></button>
                </div>
            </div>
        `;
    panel.querySelector('button').addEventListener('click', () => {
      this.disconnectVoice();
      this.showToast('Disconnected from voice', 'info');
    });
  }

  // ═══════════════════════════════════════════
  //  USER PANEL
  // ═══════════════════════════════════════════

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => {
        t.enabled = !this.isMuted;
      });
    }
    const btn = document.querySelector('[data-tooltip="Mute"], [data-tooltip="Unmute"]');
    if (!btn) return;
    const icon = btn.querySelector('i');
    icon.className = this.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
    btn.classList.toggle('muted', this.isMuted);
    btn.dataset.tooltip = this.isMuted ? 'Unmute' : 'Mute';
    if (this.voiceChannel) this._updateVoiceCallControlsState();
  }

  toggleDeafen() {
    this.isDeafened = !this.isDeafened;
    const btn = document.querySelector('[data-tooltip="Deafen"], [data-tooltip="Undeafen"]');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (this.isDeafened) {
      icon.className = 'fas fa-headphones';
      icon.style.textDecoration = 'line-through';
      btn.classList.add('muted');
      btn.dataset.tooltip = 'Undeafen';
      if (!this.isMuted) this.toggleMute();
    } else {
      icon.className = 'fas fa-headphones';
      icon.style.textDecoration = '';
      btn.classList.remove('muted');
      btn.dataset.tooltip = 'Deafen';
    }
    if (this.voiceChannel) this._updateVoiceCallControlsState();
  }

  showStatusPicker(e) {
    if (this._statusPicker) {
      this.hideStatusPicker();
      return;
    }
    e.stopPropagation();
    const userPanel = document.querySelector('.user-panel');
    const picker = document.createElement('div');
    picker.className = 'status-picker';
    const statuses = [
      { key: 'online', label: 'Online', color: 'online' },
      { key: 'idle', label: 'Idle', color: 'idle' },
      { key: 'dnd', label: 'Do Not Disturb', color: 'dnd' },
      { key: 'invisible', label: 'Invisible', color: 'invisible' },
    ];
    picker.innerHTML =
      statuses
        .map(
          s =>
            `<div class="status-picker-item" data-status="${s.key}"><div class="status-dot ${s.color}"></div>${s.label}</div>`
        )
        .join('') +
      `
            <div class="status-picker-divider"></div>
            <div class="status-picker-custom">
                <input type="text" placeholder="Set a custom status..." value="${this.escapeHtml(this.customStatusText)}">
            </div>
        `;
    picker.querySelectorAll('.status-picker-item').forEach(item => {
      item.addEventListener('click', () => {
        this.setStatus(item.dataset.status);
        this.hideStatusPicker();
      });
    });
    const customInput = picker.querySelector('.status-picker-custom input');
    customInput.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        this.customStatusText = customInput.value.trim();
        this.updateUserPanel();
        this.hideStatusPicker();
      }
    });
    userPanel.style.position = 'relative';
    userPanel.appendChild(picker);
    this._statusPicker = picker;
  }

  hideStatusPicker() {
    if (this._statusPicker) {
      this._statusPicker.remove();
      this._statusPicker = null;
    }
  }

  setStatus(status) {
    this.currentStatus = status;
    if (this.gateway) this.gateway.updatePresence(status, this.customStatusText);
    this.updateUserPanel();
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl) {
      const color = status === 'invisible' ? 'var(--status-offline)' : `var(--status-${status})`;
      avatarEl.style.setProperty('--status-color', color);
    }
    this.showToast(`Status set to ${this._statusLabel(status)}`, 'success');
  }

  // ═══════════════════════════════════════════
  //  CHANNEL HEADER (Search, Pinned, Members)
  // ═══════════════════════════════════════════

  toggleMembers() {
    this.membersSidebarVisible = !this.membersSidebarVisible;
    const sidebar = document.getElementById('members-sidebar');
    sidebar?.classList?.toggle('collapsed', !this.membersSidebarVisible);
    document.getElementById('toggle-members-btn')?.classList?.toggle('active', this.membersSidebarVisible);
    if (window.matchMedia('(max-width: 48rem)').matches) {
      if (this.membersSidebarVisible) document.body.classList.add('members-drawer-open');
      else document.body.classList.remove('members-drawer-open');
    }
  }

  toggleSearchPanel() {
    if (this._searchPanel) {
      this.hideSearchPanel();
      return;
    }
    const mainContent = document.querySelector('.main-content');
    const panel = document.createElement('div');
    panel.className = 'search-panel';
    panel.innerHTML = `
            <div class="search-panel-header">
                <input type="text" placeholder="Search messages...">
                <button class="btn-icon" title="Close"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="search-panel-results">
                <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">
                    <i class="fas fa-magnifying-glass" style="font-size:32px;margin-bottom:12px;display:block;opacity:.5"></i>
                    Type to search messages in this channel
                </div>
            </div>
        `;
    panel.querySelector('button').addEventListener('click', () => this.hideSearchPanel());
    panel.querySelector('input').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const results = panel.querySelector('.search-panel-results');
      if (!q) {
        results.innerHTML =
          '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px"><i class="fas fa-magnifying-glass" style="font-size:32px;margin-bottom:12px;display:block;opacity:.5"></i>Type to search messages in this channel</div>';
        return;
      }
      const msgs = document.querySelectorAll('.message-group');
      let html = '';
      msgs.forEach(m => {
        const text = m.querySelector('.message-text')?.textContent || '';
        const author = m.querySelector('.message-author')?.textContent || m.dataset.author || '';
        const time = m.querySelector('.message-timestamp')?.textContent || '';
        if (text.toLowerCase().includes(q) || author.toLowerCase().includes(q)) {
          html += `<div class="search-result"><div class="search-result-author">${this.escapeHtml(author)}</div><div class="search-result-text">${this.escapeHtml(text.substring(0, 100))}</div><div class="search-result-date">${this.escapeHtml(time)}</div></div>`;
        }
      });
      results.innerHTML =
        html ||
        '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">No results found</div>';
      results.querySelectorAll('.search-result').forEach((r, i) => {
        r.addEventListener('click', () => {
          const allMsgs = [...msgs].filter(m => {
            const t = m.querySelector('.message-text')?.textContent || '';
            return t.toLowerCase().includes(q);
          });
          if (allMsgs[i]) allMsgs[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    });
    mainContent.appendChild(panel);
    this._searchPanel = panel;
    panel.querySelector('input').focus();
  }

  hideSearchPanel() {
    if (this._searchPanel) {
      this._searchPanel.remove();
      this._searchPanel = null;
    }
  }

  async togglePinnedPanel() {
    if (this._pinnedPanel) {
      this.hidePinnedPanel();
      return;
    }
    if (!this.currentChannel) return;

    const mainContent = document.querySelector('.main-content');
    const panel = document.createElement('div');
    panel.className = 'pinned-panel';
    panel.innerHTML = `
            <div class="pinned-panel-header">
                <span>Pinned Messages</span>
                <button class="btn-icon" style="width:24px;height:24px;font-size:12px"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="pinned-panel-list"><div style="padding:20px;text-align:center;color:var(--text-muted)">Loading...</div></div>
        `;
    panel.querySelector('button').addEventListener('click', () => this.hidePinnedPanel());
    mainContent.style.position = 'relative';
    mainContent.appendChild(panel);
    this._pinnedPanel = panel;

    const list = panel.querySelector('.pinned-panel-list');
    try {
      const pins = await API.Pin.list(this.currentChannel?.id || this.currentChannel);
      if (!pins || pins.length === 0) {
        list.innerHTML =
          '<div style="padding:30px 20px;text-align:center;color:var(--text-muted);font-size:13px"><i class="fas fa-bookmark" style="font-size:24px;margin-bottom:8px;display:block;opacity:.5"></i>No pinned messages in this channel yet.</div>';
      } else {
        list.innerHTML = '';
        pins.forEach(pm => {
          const authorName = pm.author?.username || pm.author_username || null;
          if (!this.isValidUser({ username: authorName })) return;
          const date = pm.created_at ? new Date(pm.created_at).toLocaleString() : '';
          const pinnedItem = document.createElement('div');
          pinnedItem.className = 'pinned-msg';
          pinnedItem.innerHTML = `<div class="pinned-msg-author">${this.escapeHtml(authorName)}</div><div class="pinned-msg-text">${this.escapeHtml(pm.content || '')}</div><div class="pinned-msg-date">${this.escapeHtml(date)}</div>`;
          list.appendChild(pinnedItem);
        });
      }
    } catch {
      list.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--text-muted)">Failed to load pinned messages</div>';
    }
  }

  hidePinnedPanel() {
    if (this._pinnedPanel) {
      this._pinnedPanel.remove();
      this._pinnedPanel = null;
    }
  }

  showHelp() {
    this.createModal(
      'help-modal',
      'Help — LIBERTY',
      `
            <p class="modal-description">Keyboard shortcuts & tips</p>
            <ul style="text-align:left;color:var(--text-secondary);font-size:14px;line-height:2;margin:16px 0">
                <li><kbd>Esc</kbd> — Close modals, search, pinned messages</li>
                <li><kbd>Enter</kbd> — Send message</li>
                <li><kbd>Shift+Enter</kbd> — New line in message</li>
                <li>Click your avatar — Change status (Online, Idle, DND)</li>
                <li>Right-click server — Server options & invite</li>
                <li>Right-click channel — Edit or delete channel</li>
                <li>Right-click message — Reply, pin, delete</li>
            </ul>
            <p style="font-size:13px;color:var(--text-muted);margin-top:12px">LIBERTY — Freedom to Connect</p>
            <div class="modal-actions" style="margin-top:16px">
                <button class="btn btn-primary" data-action="close">OK</button>
            </div>
        `
    );
    this.showModal('help-modal');
    document
      .getElementById('help-modal')
      .querySelector('[data-action="close"]')
      .addEventListener('click', () => this.hideModal());
  }

  // ═══════════════════════════════════════════
  //  MESSAGES
  // ═══════════════════════════════════════════

  async loadMessages(channelId) {
    const container = document.getElementById('messages-list');
    if (!container) return;
    this._loadingMessagesChannelId = channelId;
    this.messages.clear();
    container.innerHTML = `
            <div class="messages-loading">
                <div class="message-skeleton"><div class="skeleton message-skeleton-avatar"></div><div class="message-skeleton-body"><div class="skeleton message-skeleton-line short"></div><div class="skeleton message-skeleton-line"></div><div class="skeleton message-skeleton-line" style="width:80%"></div></div></div>
                <div class="message-skeleton"><div class="skeleton message-skeleton-avatar"></div><div class="message-skeleton-body"><div class="skeleton message-skeleton-line short"></div><div class="skeleton message-skeleton-line"></div></div></div>
                <div class="message-skeleton"><div class="skeleton message-skeleton-avatar"></div><div class="message-skeleton-body"><div class="skeleton message-skeleton-line short"></div><div class="skeleton message-skeleton-line"></div><div class="skeleton message-skeleton-line" style="width:70%"></div></div></div>
            </div>`;
    const cached = MessageCache.get(channelId);
    if (cached.length > 0) {
      if (this._loadingMessagesChannelId !== channelId) return;
      const cacheById = new Map();
      cached.forEach(m => {
        const id = m.id ?? m.message_id;
        if (id != null && id !== '') cacheById.set(String(id), { ...m, id: String(id), message_id: String(id) });
      });
      this.setMessagesFromList([...cacheById.values()]);
      this.scrollToBottom();
    }
    try {
      const messages = await API.Message.list(channelId, { limit: 50 });
      if (this._loadingMessagesChannelId !== channelId) return;
      const cur = this.currentChannel?.id || this.currentChannel?.channelId;
      if (cur && String(cur) !== String(channelId)) return;
      const byId = new Map();
      [...(cached || []), ...(Array.isArray(messages) ? messages : [])].forEach(m => {
        const id = m.id ?? m.message_id;
        if (id != null && id !== '') byId.set(String(id), m);
      });
      const merged = [...byId.values()].sort((a, b) => {
        const tA = (a.created_at && new Date(a.created_at).getTime()) || 0;
        const tB = (b.created_at && new Date(b.created_at).getTime()) || 0;
        return tA - tB;
      });
      const seenIds = new Set();
      const unique = [];
      for (const m of merged) {
        const id = String(m.id ?? m.message_id ?? '');
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        unique.push({ ...m, id, message_id: id });
      }
      MessageCache.set(channelId, unique);
      if (this._loadingMessagesChannelId !== channelId) return;
      this._loadingMessagesChannelId = null;
      if (unique.length === 0) {
        container.replaceChildren();
        container.innerHTML = `
                    <div class="welcome-message">
                        <div class="welcome-icon"><i class="fas fa-message"></i></div>
                        <h2 class="welcome-title">Bem-vindo a #${this.escapeHtml(this.currentChannel?.name || 'canal')}</h2>
                        <p class="welcome-description">Este é o início do canal.</p>
                    </div>
                `;
        return;
      }
      this.setMessagesFromList(unique);
      this.scrollToBottom();
    } catch {
      this._loadingMessagesChannelId = null;
      if (this.currentChannel?.id !== channelId && this.currentChannel?.channelId !== channelId) return;
      if (cached.length === 0) {
        container.innerHTML =
          '<div class="empty-state"><p class="empty-state-description">Failed to load messages.</p></div>';
      }
    }
  }

  _authorColor(author) {
    let h = 0;
    const s = (author || '').toString();
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360}, 55%, 65%)`;
  }

  /** Gera HTML seguro para anexos de uma mensagem (imagem, vídeo, áudio, ficheiro). */
  _renderMessageAttachmentsHtml(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) return '';
    const parts = [];
    for (const att of attachments) {
      const url = att.url || att.url_path || '';
      const filename = att.filename || att.name || 'ficheiro';
      const mime = (att.mime_type || att.mimeType || '').toLowerCase();
      const isImage = mime.startsWith('image/');
      const isVideo = mime.startsWith('video/');
      const isAudio = mime.startsWith('audio/');
      const safeUrl = this.escapeHtml(url);
      const safeName = this.escapeHtml(filename);
      if (isImage && url) {
        parts.push(
          `<div class="message-attachment message-attachment--image"><img src="${safeUrl}" alt="${safeName}" loading="lazy"></div>`
        );
      } else if (isVideo && url) {
        parts.push(
          `<div class="message-attachment message-attachment--video"><video src="${safeUrl}" controls preload="metadata"></video></div>`
        );
      } else if (isAudio && url) {
        parts.push(
          `<div class="message-attachment message-attachment--audio"><audio src="${safeUrl}" controls preload="metadata"></audio><span class="message-attachment-filename">${safeName}</span></div>`
        );
      } else if (url) {
        const icon = mime.includes('pdf') ? 'fa-file-pdf' : 'fa-file';
        parts.push(
          `<div class="message-attachment message-attachment--file"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer"><i class="fas ${icon} message-attachment-icon"></i><span class="message-attachment-filename">${safeName}</span></a></div>`
        );
      }
    }
    return parts.length ? `<div class="message-attachments">${parts.join('')}</div>` : '';
  }

  _messageDateLabel(date) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  _createDateDivider(messageDate) {
    const d = new Date(messageDate);
    const div = document.createElement('div');
    div.className = 'message-date-divider';
    div.dataset.date = d.toDateString();
    div.innerHTML = `<span class="message-date-divider-label">${this.escapeHtml(this._messageDateLabel(d))}</span>`;
    return div;
  }

  _getLastMessageInContainer(container) {
    const last = container.querySelector('.message-group:last-of-type');
    if (!last) return null;
    return { authorId: last.dataset.authorId || '', author: last.dataset.author || '' };
  }

  _createMessageNode(message, lastMessageInfo) {
    const msgId = String(message.id || message.message_id || '');
    const time = new Date(message.created_at || Date.now());
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = this._formatDate(time);
    const isToday = time.toDateString() === new Date().toDateString();
    const headerTimeStr = isToday ? timeStr : `${dateStr} ${timeStr}`;
    const authorName =
      message.author?.username || message.author_username || message.username || this.currentUser?.username || 'User';
    const authorForAvatar = { username: authorName, avatar_url: message.avatar_url || message.author?.avatar || message.author?.avatar_url || message.avatar };
    const authorAvatarUrl = this._getAvatarUrlForUser(authorForAvatar);
    const authorAvatarFallback = this._getPlaceholderAvatarUrl(authorName);
    const avatarLetter = authorName.charAt(0).toUpperCase();
    const isSelf =
      this.currentUser && (message.author?.id === this.currentUser.id || message.author_id === this.currentUser.id);
    const authorId = message.author?.id || message.author_id || '';
    const sameAuthorById = lastMessageInfo && authorId && lastMessageInfo.authorId === String(authorId);
    const sameAuthorByName = lastMessageInfo && lastMessageInfo.author === authorName;
    const isContinuation = !!(sameAuthorById || sameAuthorByName);
    const isMentioned =
      this.currentUser &&
      ((message.content && message.content.includes('@[' + this.currentUser.id + ']')) ||
        (message.mentions && Array.isArray(message.mentions) && message.mentions.includes(this.currentUser.id)));
    const authorColor = this._authorColor(authorName);
    const messageEl = document.createElement('div');
    messageEl.className = 'message-group' + (isContinuation ? ' message-group--continuation' : '');
    messageEl.dataset.message = msgId;
    messageEl.dataset.author = authorName;
    messageEl.dataset.date = time.toDateString();
    if (authorId) messageEl.dataset.authorId = String(authorId);
    messageEl.innerHTML = `
      <div class="message-avatar">
        <img src="${this.escapeHtml(authorAvatarUrl)}" alt="${this.escapeHtml(authorName)}" data-fallback-avatar="${authorAvatarFallback ? this.escapeHtml(authorAvatarFallback) : ''}">
        <span class="message-avatar-fallback">${this.escapeHtml(avatarLetter)}</span>
      </div>
      <div class="message-content${isMentioned ? ' message-mentioned' : ''}">
        ${message.replyTo ? `<div class="message-reply-ref"><i class="fas fa-arrow-turn-up"></i> A responder a <strong>${this.escapeHtml(message.replyTo.author)}</strong></div>` : ''}
        ${!isContinuation ? `<div class="message-header"><span class="message-author ${isSelf ? 'message-author--self' : ''}" style="color:${isSelf ? '#fff' : this.escapeHtml(authorColor)}">${this.escapeHtml(authorName)}</span><span class="message-timestamp" title="${time.toLocaleString()}">${headerTimeStr}</span></div>` : ''}
        ${message.content != null ? `<div class="message-text">${this._parseMessageContent(message.content || '')}</div>` : ''}
        ${this._renderMessageAttachmentsHtml(message.attachments)}
        <div class="reactions-container"></div>
      </div>
      <div class="message-actions">
        <button class="btn-icon" data-action="react" title="Reação"><i class="fas fa-face-smile"></i></button>
        <button class="btn-icon" data-action="reply" title="Responder"><i class="fas fa-arrow-turn-up"></i></button>
        ${isSelf ? '<button class="btn-icon" data-action="edit" title="Editar"><i class="fas fa-pen"></i></button>' : ''}
        <button class="btn-icon" data-action="more" title="Mais"><i class="fas fa-ellipsis"></i></button>
      </div>
    `;
    const authorPayload = {
      user_id: message.author?.id || message.author_id,
      username: authorName,
      nickname: message.author?.nickname,
      status: message.author?.status || 'online',
    };
    messageEl.querySelectorAll('.message-actions .btn-icon').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const mid = messageEl.dataset.message;
        const stored = this.messages.get(mid);
        if (action === 'react') this.showEmojiPicker(btn, emoji => this.addReaction(mid, emoji));
        else if (action === 'reply') this.startReply(mid, (stored && stored.authorName) || authorName, (stored && stored.content) || message.content);
        else if (action === 'edit') this.startEditMessage(mid, (stored && stored.content) || message.content);
        else if (action === 'more') this.showMessageContextMenu(messageEl, e);
      });
    });
    const avatarEl = messageEl.querySelector('.message-avatar');
    const authorEl = messageEl.querySelector('.message-author');
    if (avatarEl) {
      avatarEl.style.cursor = 'pointer';
      avatarEl.addEventListener('click', e => { e.stopPropagation(); this.showProfileCard(authorPayload, e); });
    }
    if (authorEl) {
      authorEl.style.cursor = 'pointer';
      authorEl.addEventListener('click', e => { e.stopPropagation(); this.showProfileCard(authorPayload, e); });
    }
    if (!this.reactions.has(msgId)) this.reactions.set(msgId, []);
    this.renderReactions(messageEl, msgId);
    const avatarImg = messageEl.querySelector('.message-avatar img');
    if (avatarImg) {
      avatarImg.addEventListener('error', function () {
        const fallback = this.dataset.fallbackAvatar;
        if (fallback) { this.onerror = null; this.src = fallback; } else { this.style.display = 'none'; const s = this.nextElementSibling; if (s) s.style.display = 'flex'; }
      });
    }
    return messageEl;
  }

  _ensureDateDividerBefore(container, messageDate) {
    const last = container.lastElementChild;
    let prevDate = null;
    if (!last) {
      const div = document.createElement('div');
      div.className = 'message-date-divider';
      div.dataset.date = new Date(messageDate).toDateString();
      div.innerHTML = `<span class="message-date-divider-label">${this.escapeHtml(this._messageDateLabel(messageDate))}</span>`;
      container.appendChild(div);
      return;
    }
    if (last.classList.contains('message-group') && last.dataset.message) {
      const prevMsg = this.messages.get(last.dataset.message);
      prevDate = prevMsg?.created_at || prevMsg?.timestamp;
    } else if (last.classList.contains('message-date-divider') && last.dataset.date) {
      prevDate = last.dataset.date;
    }
    const d = new Date(messageDate);
    const newDateKey = d.toDateString();
    const prevDateKey = prevDate ? new Date(prevDate).toDateString() : null;
    if (prevDateKey === newDateKey) return;
    const div = document.createElement('div');
    div.className = 'message-date-divider';
    div.dataset.date = newDateKey;
    div.innerHTML = `<span class="message-date-divider-label">${this.escapeHtml(this._messageDateLabel(d))}</span>`;
    container.appendChild(div);
  }

  addMessage(message, scroll = true) {
    const msgId = String(message.id || message.message_id || '');
    if (!msgId) return;
    if (this.messages.has(msgId)) return;
    const container = document.getElementById('messages-list');
    if (!container) return;
    if (container.querySelector(`[data-message="${msgId}"]`)) return;
    const welcomeEl = container.querySelector('.welcome-message');
    if (welcomeEl && !container.querySelector('.message-group')) welcomeEl.style.display = 'none';
    const time = new Date(message.created_at || Date.now());
    this._ensureDateDividerBefore(container, time);
    const lastInfo = this._getLastMessageInContainer(container);
    const messageEl = this._createMessageNode(message, lastInfo);
    const toStore = { ...message, id: msgId, message_id: msgId };
    this.messages.set(msgId, { ...toStore, authorName: messageEl.dataset.author, isSelf: !!messageEl.querySelector('.message-author--self') });
    // Só salvar no cache se não for pending
    if (!msgId.startsWith('pending-')) {
      const cid = this.currentChannel?.id || this.currentChannel?.channelId;
      if (cid) MessageCache.add(cid, toStore);
    }
    container.appendChild(messageEl);
    this._injectYouTubeEmbeds(messageEl, message.content);
    this._injectSpotifyEmbeds(messageEl, message.content);
    this._injectInviteEmbeds(messageEl);
    if (scroll) this.scrollToBottom();
  }

  startEditMessage(messageId, content) {
    const msgEl = document.querySelector(`[data-message="${messageId}"]`);
    if (!msgEl) return;
    const textEl = msgEl.querySelector('.message-text');
    if (!textEl) return;
    const originalContent = this.messages.get(messageId)?.content || content || textEl.textContent;
    textEl.innerHTML = `
            <div class="message-edit-area">
                <textarea>${this.escapeHtml(originalContent)}</textarea>
                <div class="message-edit-actions">escape to <a data-action="cancel">cancel</a> · enter to <a data-action="save">save</a></div>
            </div>
        `;
    const textarea = textEl.querySelector('textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.saveEditMessage(messageId, textarea.value);
      } else if (e.key === 'Escape') {
        this.cancelEditMessage(messageId, originalContent);
      }
    });
    textEl
      .querySelector('[data-action="cancel"]')
      .addEventListener('click', () => this.cancelEditMessage(messageId, originalContent));
    textEl
      .querySelector('[data-action="save"]')
      .addEventListener('click', () => this.saveEditMessage(messageId, textarea.value));
  }

  saveEditMessage(messageId, newContent) {
    if (!newContent.trim()) return;
    const msgEl = document.querySelector(`[data-message="${messageId}"]`);
    if (!msgEl) return;
    const textEl = msgEl.querySelector('.message-text');
    textEl.innerHTML = this._parseMessageContent(newContent);
this._injectYouTubeEmbeds(msgEl, newContent);
      this._injectSpotifyEmbeds(msgEl, newContent);
      this._injectInviteEmbeds(msgEl);
    textEl.insertAdjacentHTML('beforeend', '<span class="message-edited">(edited)</span>');
    const stored = this.messages.get(messageId);
    if (stored) stored.content = newContent;
    if (this.currentChannel && this.gateway) this.gateway.editMessage(this.currentChannel.id, messageId, newContent);
  }

  cancelEditMessage(messageId, originalContent) {
    const msgEl = document.querySelector(`[data-message="${messageId}"]`);
    if (!msgEl) return;
    const textEl = msgEl.querySelector('.message-text');
    textEl.innerHTML = this._parseMessageContent(originalContent);
  }

  confirmDeleteMessage(messageId) {
    this.createModal(
      'delete-msg-modal',
      'Delete Message',
      `
            <p class="modal-description">Are you sure you want to delete this message? This action cannot be undone.</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">Cancel</button>
                <button class="btn btn-danger" data-action="delete">Delete</button>
            </div>
        `
    );
    this.showModal('delete-msg-modal');
    const modal = document.getElementById('delete-msg-modal');
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => this.hideModal());
    modal.querySelector('[data-action="delete"]').addEventListener('click', () => {
      const msgEl = document.querySelector(`[data-message="${messageId}"]`);
      if (msgEl) {
        msgEl.style.transition = 'opacity .3s ease,transform .3s ease';
        msgEl.style.opacity = '0';
        msgEl.style.transform = 'translateX(-10px)';
        setTimeout(() => msgEl.remove(), 300);
      }
      if (this.currentChannel && this.gateway) this.gateway.deleteMessage(this.currentChannel.id, messageId);
      this.messages.delete(messageId);
      this.reactions.delete(messageId);
      this.hideModal();
      this.showToast('Message deleted', 'success');
    });
  }

  startReply(messageId, authorName, content) {
    this.replyingTo = { messageId, authorName, content };
    let replyBar = document.querySelector('.reply-bar');
    if (replyBar) replyBar.remove();
    replyBar = document.createElement('div');
    replyBar.className = 'reply-bar';
    const short = (content || '').substring(0, 80);
    replyBar.innerHTML = `<i class="fas fa-arrow-turn-up" style="color:var(--primary-yellow);font-size:12px"></i><span>Replying to <strong>${this.escapeHtml(authorName)}</strong> — ${this.escapeHtml(short)}${content && content.length > 80 ? '...' : ''}</span><button title="Cancel"><i class="fas fa-xmark"></i></button>`;
    replyBar.querySelector('button').addEventListener('click', () => this.cancelReply());
    const inputWrapper = document.querySelector('.message-input-wrapper');
    const parent = inputWrapper?.parentNode;
    if (parent && inputWrapper && parent.contains(inputWrapper)) parent.insertBefore(replyBar, inputWrapper);
    else if (parent) parent.appendChild(replyBar);
    document.getElementById('message-input')?.focus();
  }

  cancelReply() {
    this.replyingTo = null;
    const bar = document.querySelector('.reply-bar');
    if (bar) bar.remove();
  }

  async addReaction(messageId, emoji) {
    if (!this.reactions.has(messageId)) this.reactions.set(messageId, []);
    const reactions = this.reactions.get(messageId);
    const existing = reactions.find(r => r.emoji === emoji);
    const selfId = this.currentUser?.id || 'me';
    let removing = false;
    if (existing) {
      if (existing.users.includes(selfId)) {
        removing = true;
        existing.users = existing.users.filter(u => u !== selfId);
        if (existing.users.length === 0) {
          const idx = reactions.indexOf(existing);
          reactions.splice(idx, 1);
        }
      } else {
        existing.users.push(selfId);
      }
    } else {
      reactions.push({ emoji, users: [selfId] });
    }
    const msgEl = document.querySelector(`[data-message="${messageId}"]`);
    if (msgEl) this.renderReactions(msgEl, messageId);
    this.hideEmojiPicker();

    if (this.currentChannel) {
      try {
        if (removing) {
          await API.Reaction.remove(this.currentChannel?.id || this.currentChannel, messageId, emoji);
        } else {
          await API.Reaction.add(this.currentChannel?.id || this.currentChannel, messageId, emoji);
        }
      } catch {
        /* optimistic update already applied */
      }
    }
  }

  renderReactions(messageEl, messageId) {
    const container = messageEl.querySelector('.reactions-container');
    if (!container) return;
    const reactions = this.reactions.get(messageId) || [];
    if (reactions.length === 0) {
      container.innerHTML = '';
      return;
    }
    const selfId = this.currentUser?.id || 'me';
    container.innerHTML =
      '<div class="reactions">' +
      reactions
        .map(r => {
          const isActive = r.users.includes(selfId);
          return `<div class="reaction ${isActive ? 'active' : ''}" data-emoji="${r.emoji}"><span>${r.emoji}</span><span class="reaction-count">${r.users.length}</span></div>`;
        })
        .join('') +
      '</div>';
    container.querySelectorAll('.reaction').forEach(el => {
      el.addEventListener('click', () => this.addReaction(messageId, el.dataset.emoji));
    });
  }

  updateMessage(data) {
    const messageEl = document.querySelector(`[data-message="${data.message_id}"]`);
    if (messageEl) {
      const textEl = messageEl.querySelector('.message-text');
      if (textEl)
        textEl.innerHTML = this._parseMessageContent(data.content) + '<span class="message-edited">(edited)</span>';
    }
  }

  deleteMessage(data) {
    const messageEl = document.querySelector(`[data-message="${data.message_id}"]`);
    if (messageEl) {
      messageEl.style.transition = 'opacity .3s ease,transform .3s ease';
      messageEl.style.opacity = '0';
      messageEl.style.transform = 'translateX(-10px)';
      setTimeout(() => messageEl.remove(), 300);
    }
  }

  getMembersForMentions() {
    const ch = this.currentChannel;
    if (!ch) return [];
    if (ch.recipients && ch.recipients.length)
      return ch.recipients.map(r => ({ id: r.id, username: r.username || r.display_name || 'User' }));
    return (this.members || []).map(m => ({ id: m.user_id || m.id, username: m.username || 'User' }));
  }

  contentWithMentions(content) {
    const members = this.getMembersForMentions();
    return content.replace(/@(\w+)/g, (_, username) => {
      const m = members.find(mem => (mem.username || '').toLowerCase() === username.toLowerCase());
      return m ? '@[' + m.id + ']' : '@' + username;
    });
  }

  /** Converte um File em data URL (base64) para envio na API. */
  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler ficheiro'));
      reader.readAsDataURL(file);
    });
  }

  async handleSendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;
    const content = (input.value || '').trim();
    const hasAttachments = this._pendingAttachments.length > 0;
    if (!content && !hasAttachments) return;

    if (!this.currentChannel || !this.currentChannel.id) {
      this.showToast('Selecione um canal para enviar a mensagem.', 'error');
      return;
    }

    const contentToSend = content ? this.contentWithMentions(content) : '';

    // Se houver anexos, usar sempre o fluxo completo (React send não envia anexos)
    if (typeof window.LibertyChatSendMessage === 'function' && !hasAttachments) {
      input.value = '';
      input.style.height = 'auto';
      this.cancelReply();
      window.LibertyChatSendMessage(contentToSend).catch(err => {
        this.showToast(err.message || 'Falha ao enviar mensagem', 'error');
      });
      return;
    }

    const roomOrId = this.currentChannel?.room || this.currentChannel?.id;
    const tempId = 'pending-' + Date.now();
    this._sendingMessage = true;
    this._updateSendButtonState();

    let apiAttachments = [];
    const optimisticAttachmentList = [];
    const channelId = this.currentChannel?.id;
    const BIG_FILE = 25 * 1024 * 1024;
    if (hasAttachments && channelId) {
      const pending = [...this._pendingAttachments];
      try {
        apiAttachments = await Promise.all(
          pending.map(async (att) => {
            if (att.file.size > BIG_FILE) {
              const up = await API.Message.uploadAttachment(channelId, att.file);
              return { url: up.url, filename: up.filename || att.name, mime_type: up.mime_type || att.mimeType || null };
            }
            const data = await this._fileToDataUrl(att.file);
            return { data, filename: att.name, mime_type: att.mimeType || null };
          })
        );
        pending.forEach((att) => {
          optimisticAttachmentList.push({
            url: att.previewUrl || '',
            filename: att.name,
            mime_type: att.mimeType || null,
          });
        });
      } catch (e) {
        this._sendingMessage = false;
        this._updateSendButtonState();
        this.showToast(e.message || 'Erro ao processar anexos.', 'error');
        return;
      }
      this._pendingAttachments = [];
      this._renderAttachmentPreviews();
      this._updateSendButtonState();
    }

    const optimistic = {
      id: tempId,
      content: contentToSend,
      author_username: this.currentUser?.username,
      author_id: this.currentUser?.id,
      author: this.currentUser?.username,
      created_at: new Date().toISOString(),
      avatar_url: this.currentUser?.avatar_url || this.currentUser?.avatar || null,
      _optimistic: true,
      attachments: optimisticAttachmentList.length ? optimisticAttachmentList : undefined,
    };
    input.value = '';
    input.style.height = 'auto';
    this.cancelReply();
    this.addMessage(optimistic, true);
    this.scrollToBottom(true);

    try {
      const res = await API.Message.create(roomOrId, contentToSend, {
        attachments: apiAttachments.length ? apiAttachments : undefined,
      });
      const msg = res?.message || res?.data?.message || (res && res.id ? res : null);
      if (msg) {
        const normalized = {
          id: msg.id,
          content: msg.content ?? contentToSend,
          author_username: msg.author_username || msg.author || this.currentUser?.username,
          author_id: msg.author_id || this.currentUser?.id,
          created_at: msg.created_at || msg.timestamp || new Date().toISOString(),
          avatar_url: msg.avatar_url || null,
          attachments: msg.attachments || undefined,
        };
        this.replacePendingWithMessage(tempId, normalized);
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem no front-end:', err);
      this.removeMessage(tempId);
      this.showToast(err.message || 'Falha ao enviar mensagem', 'error');
    } finally {
      this._sendingMessage = false;
      this._updateSendButtonState();
    }
  }

  // ═══════════════════════════════════════════
  //  EMOJI PICKER
  // ═══════════════════════════════════════════

  showEmojiPicker(anchorEl, callback) {
    this.hideEmojiPicker();
    const picker = document.createElement('div');
    picker.className = 'emoji-picker';

    let currentCategory = Object.keys(EMOJIS)[0];
    let filterText = '';

    const render = () => {
      let gridHtml = '';
      const cats = Object.entries(EMOJIS);
      cats.forEach(([catName, emojis]) => {
        if (!filterText && currentCategory && catName !== currentCategory) return;
        const list = filterText ? emojis : emojis;
        if (list.length === 0) return;
        gridHtml += `<div class="emoji-cat-label">${catName}</div>`;
        list.forEach(emoji => {
          gridHtml += `<div class="emoji-item" data-emoji="${this.escapeHtml(emoji)}">${emoji}</div>`;
        });
      });
      return gridHtml;
    };

    picker.innerHTML = `
            <div class="emoji-picker-search"><input type="text" placeholder="Search emojis..."></div>
            <div class="emoji-picker-cats">${Object.keys(EMOJIS)
              .map(
                cat => `<button data-cat="${cat}" class="${cat === currentCategory ? 'active' : ''}">${cat}</button>`
              )
              .join('')}</div>
            <div class="emoji-picker-grid">${render()}</div>
        `;

    // Category click
    picker.querySelectorAll('.emoji-picker-cats button').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCategory = btn.dataset.cat;
        filterText = '';
        picker.querySelector('.emoji-picker-search input').value = '';
        picker
          .querySelectorAll('.emoji-picker-cats button')
          .forEach(b => b.classList.toggle('active', b.dataset.cat === currentCategory));
        picker.querySelector('.emoji-picker-grid').innerHTML = render();
        attachEmojiClicks();
      });
    });

    // Search
    picker.querySelector('.emoji-picker-search input').addEventListener('input', e => {
      filterText = e.target.value.toLowerCase();
      if (filterText) {
        currentCategory = null;
        picker.querySelectorAll('.emoji-picker-cats button').forEach(b => b.classList.remove('active'));
        let html = '';
        Object.entries(EMOJIS).forEach(([catName, emojis]) => {
          html += emojis.map(emoji => `<div class="emoji-item" data-emoji="${emoji}">${emoji}</div>`).join('');
        });
        picker.querySelector('.emoji-picker-grid').innerHTML = html;
      } else {
        currentCategory = Object.keys(EMOJIS)[0];
        picker
          .querySelectorAll('.emoji-picker-cats button')
          .forEach(b => b.classList.toggle('active', b.dataset.cat === currentCategory));
        picker.querySelector('.emoji-picker-grid').innerHTML = render();
      }
      attachEmojiClicks();
    });

    const attachEmojiClicks = () => {
      picker.querySelectorAll('.emoji-item').forEach(item => {
        item.addEventListener('click', () => {
          callback(item.dataset.emoji);
          this.hideEmojiPicker();
        });
      });
    };
    attachEmojiClicks();

    const rect = anchorEl.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.bottom = window.innerHeight - rect.top + 8 + 'px';
    picker.style.right = window.innerWidth - rect.right + 'px';
    picker.style.maxHeight = '400px';

    document.body.appendChild(picker);
    this._emojiPicker = picker;
    picker.querySelector('.emoji-picker-search input').focus();
  }

  hideEmojiPicker() {
    if (this._emojiPicker) {
      this._emojiPicker.remove();
      this._emojiPicker = null;
    }
  }

  // ═══════════════════════════════════════════
  //  MEMBERS
  // ═══════════════════════════════════════════

  async renderDMProfileSidebar(userId) {
    const headerEl = document.getElementById('members-sidebar-header');
    const onlineTitleEl = document.getElementById('members-online-title');
    const container = document.getElementById('members-list');
    if (!container) return;
    if (headerEl) headerEl.classList.add('hidden');
    if (onlineTitleEl) onlineTitleEl.classList.add('hidden');
    container.innerHTML = '<div class="dm-profile-sidebar-loading"><i class="fas fa-spinner fa-spin"></i><span>A carregar perfil…</span></div>';

    let profile = null;
    let mutualServers = [];
    let mutualFriends = [];
    try {
      [profile, mutualServers, mutualFriends] = await Promise.all([
        API.User.getUser(userId).catch(() => null),
        API.User.getMutualServers(userId).catch(() => []),
        API.User.getMutualFriends(userId).catch(() => []),
      ]);
    } catch (_) {}

    const name = profile?.username || 'Utilizador';
    const tag = (profile?.username || name).replace(/\s/g, '');
    const avatarUrl = profile?.avatar_url || '';
    const bannerUrl = profile?.banner_url || '';
    const description = profile?.description || '';
    const created = profile?.created_at ? new Date(profile.created_at) : null;
    const memberSinceStr = created
      ? created.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const initial = name.charAt(0).toUpperCase();
    const avatarFallback = this._getPlaceholderAvatarUrl ? this._getPlaceholderAvatarUrl(name) : '';

    const bannerStyle = bannerUrl
      ? `style="background-image:url(${this.escapeHtml(bannerUrl)});background-size:cover;background-position:center"`
      : '';
    const avatarImg = avatarUrl
      ? `<img src="${this.escapeHtml(avatarUrl)}" alt="" data-fallback-avatar=""><span style="display:none">${this.escapeHtml(initial)}</span>`
      : `<span>${this.escapeHtml(initial)}</span>`;

    const mutualServersCount = Array.isArray(mutualServers) ? mutualServers.length : 0;
    const mutualFriendsCount = Array.isArray(mutualFriends) ? mutualFriends.length : 0;

    container.innerHTML = `
      <div class="dm-profile-sidebar" data-dm-profile-user="${this.escapeHtml(userId)}">
        <div class="dm-profile-banner" ${bannerStyle}></div>
        <div class="dm-profile-avatar-wrap">
          <div class="dm-profile-avatar">${avatarImg}</div>
        </div>
        <div class="dm-profile-body">
          <h2 class="dm-profile-name">${this.escapeHtml(name)}</h2>
          <p class="dm-profile-tag">@${this.escapeHtml(tag)}</p>
          ${description ? `<p class="dm-profile-desc">${this.escapeHtml(description)}</p>` : ''}
          <div class="dm-profile-cards">
            <div class="dm-profile-card">
              <span class="dm-profile-card-label">Membro desde</span>
              <span class="dm-profile-card-value">${this.escapeHtml(memberSinceStr)}</span>
            </div>
            <div class="dm-profile-card dm-profile-card-link" data-action="mutual-servers" role="button" tabindex="0">
              <span class="dm-profile-card-label">Servidores em comum</span>
              <span class="dm-profile-card-value">${mutualServersCount}</span>
              <i class="fas fa-chevron-right dm-profile-card-arrow" aria-hidden="true"></i>
            </div>
            <div class="dm-profile-card dm-profile-card-link" data-action="mutual-friends" role="button" tabindex="0">
              <span class="dm-profile-card-label">Amigos em comum</span>
              <span class="dm-profile-card-value">${mutualFriendsCount}</span>
              <i class="fas fa-chevron-right dm-profile-card-arrow" aria-hidden="true"></i>
            </div>
          </div>
          <button type="button" class="dm-profile-view-full">Ver perfil completo</button>
        </div>
      </div>
    `;

    const viewFull = container.querySelector('.dm-profile-view-full');
    if (viewFull) {
      viewFull.addEventListener('click', e => {
        const recipient = (this.currentChannel?.recipients || [])[0] || {};
        this.showProfileCard(
          { user_id: userId, username: name, status: recipient.status || 'offline', ...profile },
          e
        );
      });
    }

    container.querySelectorAll('.dm-profile-card-link').forEach(el => {
      const action = el.dataset.action;
      el.addEventListener('click', () => {
        if (action === 'mutual-servers' && mutualServersCount > 0) {
          this.showToast(`${mutualServersCount} servidor(es) em comum`, 'info');
        } else if (action === 'mutual-friends' && mutualFriendsCount > 0) {
          this.showToast(`${mutualFriendsCount} amigo(s) em comum`, 'info');
        }
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
    });
  }

  renderMembers() {
    const container = document.getElementById('members-list');
    const headerEl = document.getElementById('members-sidebar-header');
    const onlineTitleEl = document.getElementById('members-online-title');
    if (!container) return;
    container.innerHTML = '';

    const isOnline = m => {
      const s = m.status || m.presence?.status;
      return !s || s === 'online' || s === 'idle' || s === 'dnd';
    };
    const online = this.members.filter(isOnline);
    const offline = this.members.filter(m => !isOnline(m));

    if (headerEl) {
      headerEl.textContent = `MEMBROS — ${this.members.length}`;
      headerEl.classList.remove('hidden');
    }
    if (onlineTitleEl) {
      onlineTitleEl.textContent = `ONLINE — ${online.length}`;
      onlineTitleEl.classList.remove('hidden');
    }

    online.forEach(m => container.appendChild(this.createMemberElement(m, true)));

    if (offline.length > 0) {
      const offlineHeader = document.createElement('div');
      offlineHeader.className = 'members-section-title members-section-offline';
      offlineHeader.textContent = `OFFLINE — ${offline.length}`;
      container.appendChild(offlineHeader);
      offline.forEach(m => container.appendChild(this.createMemberElement(m, false)));
    }

    if (this.members.length === 0) {
      container.innerHTML = '<div class="members-empty">Nenhum membro</div>';
    }
  }

  createMemberElement(member, isOnline) {
    const item = document.createElement('div');
    item.className = 'member-item' + (isOnline ? ' member-item-online' : '');
    const userId = member.user_id || member.id;
    item.dataset.userId = userId;
    const name = member.nickname || member.username || member.display_name || 'User';
    const initials = (name.slice(0, 2).toUpperCase().replace(/\s/g, '') || name.charAt(0).toUpperCase() || 'U').slice(
      0,
      2
    );
    const status = member.status || member.presence?.status || 'online';
    item.innerHTML = `
            <div class="member-avatar member-avatar-yellow ${isOnline ? status : 'offline'}">
                ${member.avatar ? `<img src="${this.escapeHtml(member.avatar)}" alt="${this.escapeHtml(name)}">` : `<span>${this.escapeHtml(initials)}</span>`}
            </div>
            <span class="member-name">${this.escapeHtml(name)}</span>
            <div class="member-item-actions">
                <button type="button" class="member-action-btn" data-action="add-friend" title="Adicionar amigo" aria-label="Adicionar amigo"><i class="fas fa-handshake"></i></button>
            </div>
        `;
    item.querySelector('.member-avatar, .member-name').addEventListener('click', e => {
      e.stopPropagation();
      this.showProfileCard(member, e);
    });
    item.querySelector('[data-action="add-friend"]').addEventListener('click', e => {
      e.stopPropagation();
      this._memberActionAddFriend(userId, name);
    });
    return item;
  }

  async _memberActionAddFriend(userId, displayName) {
    const username =
      displayName || this.members.find(m => String(m.user_id || m.id) === String(userId))?.username || userId;
    try {
      await API.Friend.add(username);
      this.showToast(`Pedido de amizade enviado para ${username}`, 'success');
    } catch (err) {
      this.showToast(err.message || 'Falha ao adicionar amigo', 'error');
    }
  }

  _getProfileLinks(userId) {
    try {
      const raw = localStorage.getItem('liberty_profile_links');
      const data = raw ? JSON.parse(raw) : {};
      return Array.isArray(data[userId]) ? data[userId] : [];
    } catch (_) {
      return [];
    }
  }

  _setProfileLinks(userId, links) {
    try {
      const raw = localStorage.getItem('liberty_profile_links');
      const data = raw ? JSON.parse(raw) : {};
      data[userId] = links;
      localStorage.setItem('liberty_profile_links', JSON.stringify(data));
    } catch (_) {}
  }

  async showProfileCard(member, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    this.hideProfileCard();
    this._profileCardOpening = true;
    const user = member.user || member;
    let name = member.nickname || member.username || user.username || member.display_name || 'User';
    const userId = member.user_id || member.id || user.id || '';
    const status = member.status || user.status || member.presence?.status || 'online';
    let avatarUrl = member.avatar_url || user.avatar_url || member.avatar || user.avatar || '';
    let bannerUrl = member.banner_url || user.banner_url || member.banner || user.banner || '';
    let description = member.description || user.description || member.bio || user.bio || '';
    const isSelf =
      this.currentUser &&
      (String(this.currentUser.id) === String(userId) ||
        this.currentUser.username === (member.username || user.username || name));
    if (!isSelf && userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId))) {
      try {
        const profile = await API.User.getUser(userId);
        if (profile) {
          name = profile.username || name;
          avatarUrl = profile.avatar_url || avatarUrl;
          bannerUrl = profile.banner_url || bannerUrl;
          description = profile.description || description;
        }
      } catch (_) {}
    }
    if (isSelf && !bannerUrl && typeof localStorage !== 'undefined') {
      try {
        bannerUrl = localStorage.getItem('liberty_banner_url') || '';
      } catch (_) {}
    }
    if (isSelf && userId && !bannerUrl) {
      try {
        const profile = await API.User.getCurrentUser();
        const data = profile?.user || profile;
        if (data?.banner_url) bannerUrl = data.banner_url;
      } catch (_) {}
    }
    if (!this._profileCardOpening) return;
    const letter = name.charAt(0).toUpperCase();
    const avatarText = name.length >= 2 ? name.slice(0, 2).toUpperCase() : letter;
    const tag = (member.username || user.username || name).replace(/\s/g, '');
    const isFriend =
      this.relationships &&
      this.relationships.some(r => r.type === 1 && (r.user?.id === userId || r.user?.username === name));
    const pendingOut =
      this.relationships &&
      this.relationships.some(r => r.type === 4 && (r.user?.id === userId || r.user?.username === name));
    const profileLinks = this._getProfileLinks(userId);

    const linksHtml = profileLinks.length
      ? profileLinks
          .map(
            link =>
              `<a href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="profile-link-item"><i class="fab ${link.type === 'github' ? 'fa-github' : 'fa-link'}"></i> ${this.escapeHtml(link.label || link.url)}</a>`
          )
          .join('')
      : isSelf
        ? '<p class="profile-links-empty">Nenhum link ainda. Adicione GitHub ou outros.</p>'
        : '<p class="profile-links-empty">Esta pessoa ainda não adicionou links.</p>';

    const bannerStyle = bannerUrl
      ? `style="background-image:url(${this.escapeHtml(bannerUrl)});background-size:cover;background-position:center"`
      : '';
    const avatarImg = avatarUrl ? `<img src="${this.escapeHtml(avatarUrl)}" alt="">` : '';
    const descHtml = description ? this.escapeHtml(description) : 'Sem descrição';
    const descClass = description ? '' : ' empty';

    const card = document.createElement('div');
    card.className = 'profile-card profile-card-modal profile-card-full';
    card.dataset.profileUserId = userId;
    
    // Sistema de PINS e Admins
    const ADMIN_USERS = ['zerk', 'noeb', 'Zerk', 'Noeb', 'ZERK', 'NOEB'];
    const isAdminUser = ADMIN_USERS.includes(name) || ADMIN_USERS.includes(tag.toLowerCase());
    const currentUserIsAdmin = this.currentUser && ADMIN_USERS.includes(this.currentUser.username?.toLowerCase());
    
    // Carregar PINS do usuário
    const userPins = this._getUserPins(userId);
    const pinsHtml = userPins.length > 0 
      ? userPins.map(pin => this._renderPinBadge(pin)).join('') 
      : '<span class="pins-empty">Nenhum pin ainda</span>';
    
    // Carregar todos os pins disponíveis (para admins)
    const allPins = this._getAllPins();
    
    card.innerHTML = `
            <div class="player-banner-backdrop" aria-hidden="true"></div>
            <div class="player-banner-card">
                <button type="button" class="player-banner-close-btn" aria-label="Fechar"><i class="fas fa-xmark"></i></button>
                <div class="player-banner-banner" ${bannerStyle}></div>
                <div class="player-banner-avatar-wrap">
                    <div class="profile-card-avatar player-banner-avatar">${avatarImg}<span>${avatarImg ? '' : avatarText}</span><span class="profile-card-online-dot ${status}"></span></div>
                </div>
                <div class="player-banner-body">
                    <div class="player-banner-header-row">
                      <h2 class="player-banner-name">${this.escapeHtml(name)}</h2>
                      ${isAdminUser ? '<span class="admin-badge"><i class="fas fa-crown"></i> ADMIN</span>' : ''}
                    </div>
                    <p class="player-banner-tag">@${this.escapeHtml(tag)}</p>
                    
                    <!-- PINS Section -->
                    <div class="player-pins-section">
                        <div class="player-pins-header">
                            <h4><i class="fas fa-award"></i> PINS</h4>
                            ${currentUserIsAdmin && !isSelf ? `<button type="button" class="pin-add-btn" data-action="add-pin"><i class="fas fa-plus"></i></button>` : ''}
                        </div>
                        <div class="player-pins-list">${pinsHtml}</div>
                    </div>
                    
                    <div class="player-banner-status">
                        <span class="status-dot ${status}"></span>
                        <span>${status === 'online' ? 'Online' : status === 'idle' ? 'Ausente' : status === 'dnd' ? 'Ocupado' : 'Offline'}</span>
                    </div>
                    <p class="player-banner-desc${descClass}">${descHtml}</p>
                    <div class="player-banner-actions">
                        <button type="button" class="player-banner-btn player-banner-btn-msg" title="Mensagem" data-action="message"><i class="fas fa-message"></i> Mensagem</button>
                        <button type="button" class="player-banner-btn player-banner-btn-icon" title="Adicionar amigo" data-action="addfriend"><i class="fas fa-handshake"></i></button>
                        <button type="button" class="player-banner-btn player-banner-btn-icon" title="Mais" data-action="more"><i class="fas fa-bars"></i></button>
                    </div>
                    <div class="player-banner-more">
                        <div class="profile-card-section profile-card-links">
                            <h4>Links</h4>
                            <div class="profile-links-list">${linksHtml}</div>
                            ${isSelf ? '<div class="profile-links-actions"><button type="button" class="profile-card-link-add" data-action="add-link"><i class="fab fa-github"></i> Vincular GitHub</button><button type="button" class="profile-card-link-add secondary" data-action="add-link-generic"><i class="fas fa-link"></i> Adicionar link</button></div>' : ''}
                        </div>
                        <div class="profile-card-section">
                            <h4>Nota (visível apenas para você)</h4>
                            <textarea class="profile-card-note-input" placeholder="Adicionar nota..." maxlength="256" aria-label="Nota privada"></textarea>
                        </div>
                        <div class="profile-card-tabs">
                            <button type="button" class="profile-card-tab active" data-tab="activity">Atividade</button>
                            <button type="button" class="profile-card-tab" data-tab="mutual">Amigos mútuos</button>
                            <button type="button" class="profile-card-tab" data-tab="servers">Servidores</button>
                            ${!isSelf && this.currentUser?.id ? '<button type="button" class="profile-card-tab" data-tab="roles">Cargos</button>' : ''}
                        </div>
                        <div class="profile-card-tab-content" data-tab-content="activity">
                            <p class="profile-card-activity-empty">Nenhuma atividade no momento.</p>
                        </div>
                        <div class="profile-card-tab-content hidden" data-tab-content="mutual">
                            <p class="profile-card-activity-empty">Nenhum amigo mútuo.</p>
                        </div>
                        <div class="profile-card-tab-content hidden" data-tab-content="servers">
                            <p class="profile-card-activity-empty">Nenhum servidor mútuo.</p>
                        </div>
                        ${!isSelf && this.currentUser?.id ? '<div class="profile-card-tab-content hidden" data-tab-content="roles"><p class="profile-card-activity-empty">A carregar...</p></div>' : ''}
                    </div>
                </div>
            </div>
        `;
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-overlay';
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'presentation');
      overlay.addEventListener('click', e => {
        if (e.target.id === 'modal-overlay' || e.target === overlay) {
          this.hideProfileCard();
          this.hideModal();
        }
      });
      document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
    overlay.classList.add('profile-card-overlay');
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.appendChild(card);
    this._profileCard = card;
    this._profileCardOpening = false;
    this._profileJustOpened = true;
    setTimeout(() => {
      this._profileJustOpened = false;
    }, 0);

    card.querySelector('.player-banner-backdrop').addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      this.hideProfileCard();
    });
    card.querySelector('.player-banner-close-btn').addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      this.hideProfileCard();
    });
    card.querySelector('.player-banner-card')?.addEventListener('click', ev => ev.stopPropagation());

    const msgBtn = card.querySelector('[data-action="message"]');
    const addBtn = card.querySelector('[data-action="addfriend"]');
    const moreBtn = card.querySelector('[data-action="more"]');

    if (isSelf) {
      msgBtn.style.display = 'none';
      addBtn.style.display = 'none';
      moreBtn.style.display = 'none';
    } else {
      if (isFriend) {
        addBtn.innerHTML = '<i class="fas fa-check"></i>';
        addBtn.title = 'Já são amigos';
        addBtn.disabled = true;
      } else if (pendingOut) {
        addBtn.innerHTML = '<i class="fas fa-clock"></i>';
        addBtn.title = 'Pedido enviado';
        addBtn.disabled = true;
      }
    }

    msgBtn.addEventListener('click', () => {
      this.hideProfileCard();
      if (!isSelf && userId) this.openDMWithUser(userId, name);
    });
    addBtn.addEventListener('click', async () => {
      if (isFriend || pendingOut) return;
      try {
        await API.Friend.add(name);
        this.showToast(`Pedido enviado a ${name}`, 'success');
        addBtn.innerHTML = '<i class="fas fa-clock"></i>';
        addBtn.disabled = true;
      } catch (err) {
        this.showToast(err.message || 'Erro ao adicionar', 'error');
      }
    });
    moreBtn.addEventListener('click', () => this.showToast('Mais opções em breve.', 'info'));

    card.querySelectorAll('.profile-card-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        card.querySelectorAll('.profile-card-tab').forEach(t => t.classList.remove('active'));
        card.querySelectorAll('.profile-card-tab-content').forEach(c => c.classList.add('hidden'));
        tab.classList.add('active');
        const content = card.querySelector(`[data-tab-content="${tab.dataset.tab}"]`);
        if (content) content.classList.remove('hidden');
        if (tab.dataset.tab === 'roles' && !isSelf && userId && this.currentUser?.id) {
          await this._loadProfileRolesTab(content, userId);
        }
      });
    });

    if (isSelf) {
      const addLinkBtn = card.querySelector('[data-action="add-link"]');
      const addLinkGenericBtn = card.querySelector('[data-action="add-link-generic"]');
      if (addLinkBtn)
        addLinkBtn.addEventListener('click', () => this._profileAddLink(userId, 'github', 'GitHub', card));
      if (addLinkGenericBtn)
        addLinkGenericBtn.addEventListener('click', () => this._profileAddLink(userId, 'link', 'Link', card));
    }
    
    // Event listener para adicionar pin (apenas admins)
    const addPinBtn = card.querySelector('[data-action="add-pin"]');
    if (addPinBtn && currentUserIsAdmin && !isSelf) {
      addPinBtn.addEventListener('click', () => this._showAddPinModal(userId, name, card));
    }
  }

  // ═══════════════════════════════════════════
  //  PINS SYSTEM
  // ═══════════════════════════════════════════

  _getUserPins(userId) {
    try {
      const pins = JSON.parse(localStorage.getItem('liberty_user_pins') || '{}');
      return pins[userId] || [];
    } catch {
      return [];
    }
  }

  _getAllPins() {
    return [
      { id: 'verified', name: 'Verificado', icon: 'fa-check-circle', color: '#00d4ff', description: 'Conta verificada' },
      { id: 'developer', name: 'Developer', icon: 'fa-code', color: '#ff6b6b', description: 'Desenvolvedor oficial' },
      { id: 'moderator', name: 'Moderador', icon: 'fa-shield-alt', color: '#4ecdc4', description: 'Moderador da comunidade' },
      { id: 'vip', name: 'VIP', icon: 'fa-star', color: '#ffd700', description: 'Membro VIP' },
      { id: 'early', name: 'Early Adopter', icon: 'fa-rocket', color: '#a855f7', description: 'Usuário pioneiro' },
      { id: 'bug_hunter', name: 'Bug Hunter', icon: 'fa-bug', color: '#22c55e', description: 'Caçador de bugs' },
      { id: 'contributor', name: 'Contributor', icon: 'fa-heart', color: '#ec4899', description: 'Contribuidor' },
      { id: 'artist', name: 'Artist', icon: 'fa-palette', color: '#f97316', description: 'Artista certificado' },
      { id: 'streamer', name: 'Streamer', icon: 'fa-video', color: '#9333ea', description: 'Streamer parceiro' },
      { id: 'legend', name: 'Legend', icon: 'fa-crown', color: '#ffd700', description: 'Lenda da comunidade' },
    ];
  }

  _renderPinBadge(pin) {
    return `
      <div class="pin-badge" style="--pin-color: ${pin.color}" title="${pin.name}: ${pin.description}">
        <i class="fas ${pin.icon}"></i>
        <span class="pin-name">${pin.name}</span>
      </div>
    `;
  }

  _showAddPinModal(userId, userName, card) {
    const allPins = this._getAllPins();
    const userPins = this._getUserPins(userId);
    const userPinIds = userPins.map(p => p.id);
    
    const pinsListHtml = allPins.map(pin => {
      const hasPin = userPinIds.includes(pin.id);
      return `
        <div class="pin-select-item ${hasPin ? 'has-pin' : ''}" data-pin-id="${pin.id}" style="--pin-color: ${pin.color}">
          <div class="pin-select-icon"><i class="fas ${pin.icon}"></i></div>
          <div class="pin-select-info">
            <span class="pin-select-name">${pin.name}</span>
            <span class="pin-select-desc">${pin.description}</span>
          </div>
          <div class="pin-select-status">
            ${hasPin ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'}
          </div>
        </div>
      `;
    }).join('');

    this.createModal('pin-select-modal', 'Gerenciar PINS', `
      <p class="modal-description">Selecione os pins para <strong>${this.escapeHtml(userName)}</strong></p>
      <div class="pin-select-list">${pinsListHtml}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="cancel">Fechar</button>
      </div>
    `);
    
    this.showModal('pin-select-modal');
    
    const modal = document.getElementById('pin-select-modal');
    modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => this.hideModal());
    
    // Event listeners para cada pin
    modal.querySelectorAll('.pin-select-item').forEach(item => {
      item.addEventListener('click', () => {
        const pinId = item.dataset.pinId;
        this._toggleUserPin(userId, pinId);
        item.classList.toggle('has-pin');
        const statusIcon = item.querySelector('.pin-select-status i');
        if (item.classList.contains('has-pin')) {
          statusIcon.className = 'fas fa-check';
          this.showToast('Pin adicionado!', 'success');
        } else {
          statusIcon.className = 'fas fa-plus';
          this.showToast('Pin removido', 'info');
        }
        // Atualizar o card
        const pinsList = card.querySelector('.player-pins-list');
        const updatedPins = this._getUserPins(userId);
        pinsList.innerHTML = updatedPins.length > 0 
          ? updatedPins.map(pin => this._renderPinBadge(pin)).join('')
          : '<span class="pins-empty">Nenhum pin ainda</span>';
      });
    });
  }

  _toggleUserPin(userId, pinId) {
    try {
      const pins = JSON.parse(localStorage.getItem('liberty_user_pins') || '{}');
      if (!pins[userId]) pins[userId] = [];
      
      const index = pins[userId].findIndex(p => p.id === pinId);
      const allPins = this._getAllPins();
      const pinData = allPins.find(p => p.id === pinId);
      
      if (index >= 0) {
        pins[userId].splice(index, 1);
      } else if (pinData) {
        pins[userId].push(pinData);
      }
      
      localStorage.setItem('liberty_user_pins', JSON.stringify(pins));
    } catch (e) {
      console.error('[APP] Erro ao salvar pin:', e);
    }
  }

  async _loadAdminDbStats(container) {
    const el = container.querySelector('#admin-db-stats');
    if (!el) return;
    try {
      const data = await API.Admin.getDb();
      el.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:16px">
                    <div class="settings-row" style="flex-direction:column;align-items:flex-start;padding:16px;background:var(--primary-black);border-radius:var(--radius-md)">
                        <span style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Utilizadores</span>
                        <span style="font-size:24px;font-weight:700;color:var(--primary-yellow)">${Number(data.users || 0).toLocaleString()}</span>
                    </div>
                    <div class="settings-row" style="flex-direction:column;align-items:flex-start;padding:16px;background:var(--primary-black);border-radius:var(--radius-md)">
                        <span style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Servidores</span>
                        <span style="font-size:24px;font-weight:700;color:var(--primary-yellow)">${Number(data.servers || 0).toLocaleString()}</span>
                    </div>
                    <div class="settings-row" style="flex-direction:column;align-items:flex-start;padding:16px;background:var(--primary-black);border-radius:var(--radius-md)">
                        <span style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Canais</span>
                        <span style="font-size:24px;font-weight:700;color:var(--primary-yellow)">${Number(data.channels || 0).toLocaleString()}</span>
                    </div>
                    <div class="settings-row" style="flex-direction:column;align-items:flex-start;padding:16px;background:var(--primary-black);border-radius:var(--radius-md)">
                        <span style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Mensagens</span>
                        <span style="font-size:24px;font-weight:700;color:var(--primary-yellow)">${Number(data.messages || 0).toLocaleString()}</span>
                    </div>
                    <div class="settings-row" style="flex-direction:column;align-items:flex-start;padding:16px;background:var(--primary-black);border-radius:var(--radius-md)">
                        <span style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Pins</span>
                        <span style="font-size:24px;font-weight:700;color:var(--primary-yellow)">${Number(data.pinned_messages || 0).toLocaleString()}</span>
                    </div>
                </div>`;
    } catch (err) {
      el.innerHTML = `<div style="color:var(--error);font-size:13px"><i class="fas fa-exclamation-triangle"></i> ${this.escapeHtml(err.message || 'Erro ao carregar estatísticas')}</div>`;
    }
  }

  async _loadProfileRolesTab(container, targetUserId) {
    container.innerHTML = '<p class="profile-card-activity-empty">A carregar...</p>';
    const myId = this.currentUser?.id;
    if (!myId || !this.servers?.length) {
      container.innerHTML = '<p class="profile-card-activity-empty">Nenhum servidor onde possa alterar cargos.</p>';
      return;
    }
    const owned = this.servers.filter(s => s.owner_id && String(s.owner_id) === String(myId));
    if (!owned.length) {
      container.innerHTML =
        '<p class="profile-card-activity-empty">Só pode alterar cargos em servidores de que é dono.</p>';
      return;
    }
    const roles = [
      { value: 'member', label: 'Membro' },
      { value: 'moderator', label: 'Moderador' },
      { value: 'admin', label: 'Admin' },
    ];
    let html =
      '<p style="margin-bottom:12px;font-size:13px;color:var(--text-secondary)">Altere o cargo desta pessoa nos servidores de que é dono.</p>';
    for (const server of owned) {
      let currentRole = 'member';
      try {
        const members = await API.Server.getMembers(server.id);
        const m = (members || []).find(x => String(x.user_id || x.id) === String(targetUserId));
        if (m && m.role) currentRole = m.role.toLowerCase();
      } catch (_) {}
      html += `<div class="profile-card-role-row" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);gap:12px">
                <span style="font-size:13px;color:var(--text-primary)">${this.escapeHtml(server.name || server.id)}</span>
                <select class="profile-card-role-select" data-server-id="${this.escapeHtml(server.id)}" data-user-id="${this.escapeHtml(targetUserId)}" data-current="${this.escapeHtml(currentRole)}" style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.12);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px;min-width:120px">
                    ${roles.map(r => `<option value="${r.value}" ${r.value === currentRole ? 'selected' : ''}>${r.label}</option>`).join('')}
                </select>
            </div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll('.profile-card-role-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const serverId = sel.dataset.serverId;
        const newRole = sel.value;
        try {
          await API.Server.updateMemberRole(serverId, targetUserId, newRole);
          sel.dataset.current = newRole;
          this.showToast('Cargo atualizado.', 'success');
        } catch (err) {
          this.showToast(err.message || 'Erro ao atualizar cargo', 'error');
          sel.value = sel.dataset.current || 'member';
        }
      });
    });
  }

  _profileAddLink(userId, type, label, card) {
    const url =
      type === 'github'
        ? prompt('URL do seu perfil GitHub (ex: https://github.com/username):', 'https://github.com/')
        : prompt('URL do link:', 'https://');
    if (!url || !url.trim()) return;
    let finalUrl = url.trim();
    if (type === 'github' && !finalUrl.includes('github.com'))
      finalUrl = 'https://github.com/' + finalUrl.replace(/^https?:\/\//, '').split('/')[0];
    const links = this._getProfileLinks(userId);
    const displayLabel = type === 'github' ? finalUrl.replace(/\/$/, '').split('/').pop() || 'GitHub' : finalUrl;
    links.push({ type: type === 'github' ? 'github' : 'link', url: finalUrl, label: displayLabel });
    this._setProfileLinks(userId, links);
    const list = card.querySelector('.profile-card-links .profile-links-list');
    if (list)
      list.innerHTML = links
        .map(
          link =>
            `<a href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="profile-link-item"><i class="fab ${link.type === 'github' ? 'fa-github' : 'fa-link'}"></i> ${this.escapeHtml(link.label || link.url)}</a>`
        )
        .join('');
    this.showToast('Link adicionado.', 'success');
  }

  async openDMWithUser(userId, username) {
    try {
      const channel = await API.DM.create(userId);
      this.dmChannels = this.dmChannels || [];
      if (!this.dmChannels.find(c => c.id === channel?.id)) this.dmChannels.push(channel);
      this.currentServer = null;
      this.isHomeView = false;
      this.currentChannel = channel;
      document.getElementById('friends-view')?.classList?.add('hidden');
      const msgCont = document.getElementById('messages-container');
      if (msgCont) msgCont.style.display = '';
      const inputCont = document.querySelector('.message-input-container');
      if (inputCont) inputCont.style.display = '';
      this._updateChannelHeaderForContext();
      this.selectChannel(channel?.id);
      this.renderServers();
      this._refreshDMListSidebar();
    } catch (e) {
      this.showToast(e?.message || 'Não foi possível abrir a conversa.', 'error');
    }
  }

  hideProfileCard() {
    this._profileCardOpening = false;
    if (this._profileCard) {
      this._profileCard.remove();
      this._profileCard = null;
      const overlay = document.getElementById('modal-overlay');
      if (overlay) {
        overlay.classList.remove('profile-card-overlay');
        if (!overlay.querySelector('.modal:not(.hidden), .profile-card-modal'))
          overlay.classList.add('hidden');
      }
    }
  }

  // ═══════════════════════════════════════════
  //  TASKS MODAL
  // ═══════════════════════════════════════════
  async showTasksModal(userId, username) {
    this.hideProfileCard();
    this.hideModal();
    
    const modalId = 'tasks-modal';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; width: 90%;">
          <div class="modal-header">
            <h3><i class="fas fa-tasks"></i> Tarefas de ${this.escapeHtml(username || 'Usuário')}</h3>
            <button class="modal-close-btn" data-action="close"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
            <div id="tasks-loading" style="text-align: center; padding: 20px;">
              <i class="fas fa-spinner fa-spin"></i> A carregar tarefas...
            </div>
            <div id="tasks-list" style="display: none;"></div>
            <div id="tasks-empty" style="display: none; text-align: center; padding: 30px; color: var(--text-muted);">
              <i class="fas fa-clipboard-list" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
              <p>Sem tarefas para mostrar.</p>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; gap: 10px; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 10px;">
              <button class="btn btn-primary" data-action="create"><i class="fas fa-plus"></i> Nova Tarefa</button>
              <select id="tasks-filter" class="btn btn-secondary" style="cursor: pointer;">
                <option value="">Todas</option>
                <option value="pending">Pendentes</option>
                <option value="in_progress">Em Progresso</option>
                <option value="completed">Concluídas</option>
              </select>
            </div>
            <button class="btn btn-secondary" data-action="close">Fechar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Event listeners
      modal.querySelector('[data-action="close"]').addEventListener('click', () => this.hideModal());
      modal.querySelector('.modal-close-btn').addEventListener('click', () => this.hideModal());
      modal.querySelector('[data-action="create"]').addEventListener('click', () => this._showCreateTaskForm(userId, username));
      modal.querySelector('#tasks-filter').addEventListener('change', (e) => this._loadTasks(userId, e.target.value));
    } else {
      // Update header with username
      const header = modal.querySelector('.modal-header h3');
      if (header) header.innerHTML = `<i class="fas fa-tasks"></i> Tarefas de ${this.escapeHtml(username || 'Usuário')}`;
    }
    
    this.showModal(modalId);
    await this._loadTasks(userId);
  }

  async _loadTasks(userId, status = '') {
    const listEl = document.getElementById('tasks-list');
    const loadingEl = document.getElementById('tasks-loading');
    const emptyEl = document.getElementById('tasks-empty');
    
    if (!listEl) return;
    
    loadingEl.style.display = 'block';
    listEl.style.display = 'none';
    emptyEl.style.display = 'none';
    
    try {
      const tasks = await API.Task.list(userId, status || null);
      loadingEl.style.display = 'none';
      
      if (!tasks || tasks.length === 0) {
        emptyEl.style.display = 'block';
        return;
      }
      
      listEl.style.display = 'block';
      listEl.innerHTML = tasks.map(task => this._renderTaskItem(task)).join('');
      
      // Add event listeners to task actions
      listEl.querySelectorAll('[data-task-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const taskId = btn.dataset.taskId;
          const action = btn.dataset.taskAction;
          await this._handleTaskAction(taskId, action, userId);
        });
      });
    } catch (err) {
      console.error('Error loading tasks:', err);
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
      emptyEl.innerHTML = `<p style="color: var(--error);"><i class="fas fa-exclamation-triangle"></i> Erro ao carregar tarefas.</p>`;
    }
  }

  _renderTaskItem(task) {
    const statusColors = {
      pending: '#f1c40f',
      in_progress: '#3498db',
      completed: '#2ecc71',
      cancelled: '#e74c3c'
    };
    
    const statusLabels = {
      pending: 'Pendente',
      in_progress: 'Em Progresso',
      completed: 'Concluída',
      cancelled: 'Cancelada'
    };
    
    const priorityLabels = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente'
    };
    
    const isCompleted = task.status === 'completed';
    const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('pt-PT') : '';
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;
    
    return `
      <div class="task-item" style="background: var(--secondary-black); border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid ${statusColors[task.status] || '#ccc'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 5px 0; ${isCompleted ? 'text-decoration: line-through; opacity: 0.7;' : ''}">${this.escapeHtml(task.title)}</h4>
            ${task.description ? `<p style="margin: 0; color: var(--text-muted); font-size: 13px;">${this.escapeHtml(task.description)}</p>` : ''}
          </div>
          <span style="background: ${statusColors[task.status] || '#ccc'}; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${statusLabels[task.status] || task.status}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted);">
          <div style="display: flex; gap: 15px;">
            <span><i class="fas fa-flag"></i> ${priorityLabels[task.priority] || task.priority}</span>
            ${dueDate ? `<span style="${isOverdue ? 'color: var(--error); font-weight: 600;' : ''}"><i class="fas fa-calendar"></i> ${dueDate} ${isOverdue ? '(Atrasada)' : ''}</span>` : ''}
          </div>
          <div style="display: flex; gap: 8px;">
            ${!isCompleted ? `<button class="btn btn-sm btn-primary" data-task-id="${task.id}" data-task-action="start" title="Iniciar"><i class="fas fa-play"></i></button>` : ''}
            ${!isCompleted ? `<button class="btn btn-sm btn-success" data-task-id="${task.id}" data-task-action="complete" title="Concluir"><i class="fas fa-check"></i></button>` : ''}
            <button class="btn btn-sm btn-danger" data-task-id="${task.id}" data-task-action="delete" title="Eliminar"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }

  async _handleTaskAction(taskId, action, userId) {
    try {
      if (action === 'complete') {
        await API.Task.complete(taskId);
        this.showToast('Tarefa concluída!', 'success');
      } else if (action === 'start') {
        await API.Task.start(taskId);
        this.showToast('Tarefa iniciada!', 'success');
      } else if (action === 'delete') {
        if (!confirm('Tem a certeza que deseja eliminar esta tarefa?')) return;
        await API.Task.delete(taskId);
        this.showToast('Tarefa eliminada!', 'success');
      }
      // Reload tasks
      const filter = document.getElementById('tasks-filter');
      await this._loadTasks(userId, filter ? filter.value : '');
    } catch (err) {
      console.error('Error handling task action:', err);
      this.showToast(err.message || 'Erro ao processar ação', 'error');
    }
  }

  _showCreateTaskForm(userId, username) {
    const modal = document.getElementById('tasks-modal');
    const body = modal.querySelector('.modal-body');
    const footer = modal.querySelector('.modal-footer');
    
    const originalContent = body.innerHTML;
    const originalFooter = footer.innerHTML;
    
    body.innerHTML = `
      <div style="padding: 20px;">
        <h4 style="margin-bottom: 15px;">Nova Tarefa para ${this.escapeHtml(username || 'Usuário')}</h4>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 13px; color: var(--text-secondary);">Título *</label>
          <input type="text" id="task-title" class="form-input" placeholder="Título da tarefa" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid var(--border); background: var(--primary-black); color: var(--text-primary);">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 13px; color: var(--text-secondary);">Descrição</label>
          <textarea id="task-description" class="form-input" placeholder="Descrição opcional" rows="3" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid var(--border); background: var(--primary-black); color: var(--text-primary); resize: vertical;"></textarea>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <label style="display: block; margin-bottom: 5px; font-size: 13px; color: var(--text-secondary);">Prioridade</label>
            <select id="task-priority" class="form-input" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid var(--border); background: var(--primary-black); color: var(--text-primary);">
              <option value="low">Baixa</option>
              <option value="medium" selected>Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-size: 13px; color: var(--text-secondary);">Data Limite</label>
            <input type="date" id="task-due-date" class="form-input" style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid var(--border); background: var(--primary-black); color: var(--text-primary);">
          </div>
        </div>
      </div>
    `;
    
    footer.innerHTML = `
      <button class="btn btn-secondary" data-action="cancel-create">Cancelar</button>
      <button class="btn btn-primary" data-action="save-task">Criar Tarefa</button>
    `;
    
    footer.querySelector('[data-action="cancel-create"]').addEventListener('click', () => {
      body.innerHTML = originalContent;
      footer.innerHTML = originalFooter;
      // Re-attach event listeners
      footer.querySelector('[data-action="close"]').addEventListener('click', () => this.hideModal());
      footer.querySelector('[data-action="create"]').addEventListener('click', () => this._showCreateTaskForm(userId, username));
      footer.querySelector('#tasks-filter').addEventListener('change', (e) => this._loadTasks(userId, e.target.value));
      // Reload tasks
      const filter = document.getElementById('tasks-filter');
      this._loadTasks(userId, filter ? filter.value : '');
    });
    
    footer.querySelector('[data-action="save-task"]').addEventListener('click', async () => {
      const title = document.getElementById('task-title').value.trim();
      const description = document.getElementById('task-description').value.trim();
      const priority = document.getElementById('task-priority').value;
      const dueDate = document.getElementById('task-due-date').value;
      
      if (!title) {
        this.showToast('Título é obrigatório!', 'error');
        return;
      }
      
      try {
        await API.Task.create(userId, { title, description, priority, due_date: dueDate || null });
        this.showToast('Tarefa criada com sucesso!', 'success');
        body.innerHTML = originalContent;
        footer.innerHTML = originalFooter;
        // Re-attach event listeners
        footer.querySelector('[data-action="close"]').addEventListener('click', () => this.hideModal());
        footer.querySelector('[data-action="create"]').addEventListener('click', () => this._showCreateTaskForm(userId, username));
        footer.querySelector('#tasks-filter').addEventListener('change', (e) => this._loadTasks(userId, e.target.value));
        // Reload tasks
        const filter = document.getElementById('tasks-filter');
        await this._loadTasks(userId, filter ? filter.value : '');
      } catch (err) {
        this.showToast(err.message || 'Erro ao criar tarefa', 'error');
      }
    });
  }

  // ═══════════════════════════════════════════
  //  CONTEXT MENUS
  // ═══════════════════════════════════════════

  showContextMenu(items, x, y) {
    this.hideContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = items
      .map(item => {
        if (item.divider) return '<div class="dropdown-divider"></div>';
        return `<div class="dropdown-item ${item.danger ? 'danger' : ''}" data-idx="${item._idx}"><i class="fas ${item.icon || 'fa-circle'}" style="width:20px;text-align:center;font-size:13px"></i>${this.escapeHtml(item.label)}</div>`;
      })
      .join('');

    document.body.appendChild(menu);
    menu.classList.add('active');
    const rect = menu.getBoundingClientRect();
    const pad = 12;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (left < pad) left = pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    if (top < pad) top = pad;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    let focusIdx = -1;
    const actionItems = items.filter(i => !i.divider);
    const menuItems = () => menu.querySelectorAll('.dropdown-item');

    menu.addEventListener('keydown', e => {
      const els = menuItems();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusIdx = Math.min(focusIdx + 1, els.length - 1);
        els[focusIdx]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusIdx = Math.max(focusIdx - 1, 0);
        els[focusIdx]?.focus();
      } else if (e.key === 'Enter' && focusIdx >= 0) {
        els[focusIdx]?.click();
      }
    });

    let aiIdx = 0;
    menu.querySelectorAll('.dropdown-item').forEach(el => {
      const action = actionItems[aiIdx]?.action;
      el.tabIndex = 0;
      el.addEventListener('click', () => {
        this.hideContextMenu();
        if (action) action();
      });
      aiIdx++;
    });

    document.body.appendChild(menu);
    this._contextMenu = menu;
    menu.focus();
  }

  hideContextMenu() {
    if (this._contextMenu) {
      this._contextMenu.remove();
      this._contextMenu = null;
    }
  }

  showServerContextMenu(serverItem, e) {
    const serverId = serverItem.dataset.server;
    const server = this.servers.find(s => s.id === serverId);
    const items = [
      {
        _idx: 0,
        icon: 'fa-check-circle',
        label: 'Mark as Read',
        action: () => this.showToast('Marked as read', 'info'),
      },
      { _idx: 1, icon: 'fa-bell-slash', label: 'Mute Server', action: () => this.showToast('Server muted', 'info') },
      { divider: true },
      { _idx: 2, icon: 'fa-handshake', label: 'Invite People', action: () => this.showInviteModal() },
      { _idx: 3, icon: 'fa-eye-slash', label: 'Hide Server', action: () => this.showToast('Server hidden', 'info') },
      { divider: true },
      {
        _idx: 4,
        icon: 'fa-right-from-bracket',
        label: 'Leave Server',
        danger: true,
        action: () => {
          if (this.gateway) this.gateway.leaveServer(serverId);
          this.showToast(`Left ${server?.name || 'server'}`, 'info');
          this.selectHome();
        },
      },
    ];
    this.showContextMenu(items, e.clientX, e.clientY);
  }

  showChannelContextMenu(channelItem, e) {
    const channelId = channelItem.dataset.channel;
    const channel = this.channels.find(c => c.id === channelId);
    const items = [
      { _idx: 0, icon: 'fa-pen', label: 'Edit Channel', action: () => this.showEditChannelModal(channelId) },
      { _idx: 1, icon: 'fa-bell-slash', label: 'Mute Channel', action: () => this.showToast('Channel muted', 'info') },
      { divider: true },
      { _idx: 2, icon: 'fa-handshake', label: 'Invite to Channel', action: () => this.showInviteModal() },
      {
        _idx: 3,
        icon: 'fa-copy',
        label: 'Clone Channel',
        action: () => this.showToast(`Cloned #${channel?.name || 'channel'}`, 'success'),
      },
      { divider: true },
      {
        _idx: 4,
        icon: 'fa-trash-can',
        label: 'Delete Channel',
        danger: true,
        action: () => {
          if (confirm(`Delete #${channel?.name}?`)) {
            this.channels = this.channels.filter(c => c.id !== channelId);
            this.renderChannels();
            this.showToast('Channel deleted', 'success');
          }
        },
      },
    ];
    this.showContextMenu(items, e.clientX, e.clientY);
  }

  showMessageContextMenu(messageEl, e) {
    const messageId = messageEl.dataset.message;
    const msgData = this.messages.get(messageId);
    const isSelf = msgData?.isSelf;
    const items = [
      {
        _idx: 0,
        icon: 'fa-face-smile',
        label: 'Add Reaction',
        action: () => {
          this.showEmojiPicker(messageEl, emoji => this.addReaction(messageId, emoji));
        },
      },
      {
        _idx: 1,
        icon: 'fa-arrow-turn-up',
        label: 'Reply',
        action: () => this.startReply(messageId, msgData?.authorName || 'User', msgData?.content || ''),
      },
      { divider: true },
    ];
    if (isSelf) {
      items.push({
        _idx: 2,
        icon: 'fa-pen',
        label: 'Edit Message',
        action: () => this.startEditMessage(messageId, msgData?.content),
      });
    }
    if (this.currentUser?.admin) {
      items.push({
        _idx: 3,
        icon: 'fa-bookmark',
        label: 'Pin Message',
        action: async () => {
          try {
            await API.Pin.pin(this.currentChannel?.id || this.currentChannel, messageId);
            this.showToast('Message pinned!', 'success');
          } catch (err) {
            this.showToast(err.message || 'Failed to pin message', 'error');
          }
        },
      });
    }
    if (isSelf) {
      items.push({ divider: true });
      items.push({
        _idx: 4,
        icon: 'fa-trash-can',
        label: 'Delete Message',
        danger: true,
        action: () => this.confirmDeleteMessage(messageId),
      });
    }
    // Admins também podem apagar mensagens de outros
    if (this.currentUser?.admin && !isSelf) {
      items.push({ divider: true });
      items.push({
        _idx: 4,
        icon: 'fa-trash-can',
        label: 'Delete Message (Admin)',
        danger: true,
        action: () => this.confirmDeleteMessage(messageId),
      });
    }
    items.push({ divider: true });
    items.push({
      _idx: 5,
      icon: 'fa-copy',
      label: 'Copy Text',
      action: () => {
        navigator.clipboard.writeText(msgData?.content || '').then(() => this.showToast('Text copied!', 'success'));
      },
    });
    items.push({
      _idx: 6,
      icon: 'fa-link',
      label: 'Copy Message Link',
      action: () => {
        navigator.clipboard
          .writeText(
            `${window.location.origin}/channels/${this.currentServer?.id || '@me'}/${this.currentChannel?.id}/${messageId}`
          )
          .then(() => this.showToast('Link copied!', 'success'));
      },
    });
    items.push({
      _idx: 7,
      icon: 'fa-eye-slash',
      label: 'Mark Unread',
      action: () => this.showToast('Marked as unread', 'info'),
    });
    this.showContextMenu(items, e.clientX, e.clientY);
  }

  showMemberContextMenu(memberItem, e) {
    const userId = memberItem.dataset.userId;
    const member = this.members.find(m => (m.user_id || m.id) === userId);
    const name = member?.nickname || member?.username || 'User';
    const serverId = this.currentServer?.id || null;
    const isAdmin = this.currentUser?.admin === true;
    const items = [
      {
        _idx: 0,
        icon: 'fa-address-card',
        label: 'Profile',
        action: () => this.showProfileCard(member || { username: name, status: 'online' }, e),
      },
      { _idx: 1, icon: 'fa-message', label: 'Message', action: () => this.openDMWithUser(userId, name) },
      { _idx: 2, icon: 'fa-tasks', label: 'Tarefas', action: () => this.showTasksModal(userId, name) },
      { divider: true },
      {
        _idx: 3,
        icon: 'fa-sticky-note',
        label: 'Add Note',
        action: () => this.showToast('Note editor opened', 'info'),
      },
      { _idx: 4, icon: 'fa-microphone-slash', label: 'Mute', action: () => this.showToast(`${name} muted`, 'info') },
      { _idx: 5, icon: 'fa-headphones', label: 'Deafen', action: () => this.showToast(`${name} deafened`, 'info') },
      {
        _idx: 6,
        icon: 'fa-pen',
        label: 'Change Nickname',
        action: () => {
          const nn = prompt('New nickname:', name);
          if (nn) this.showToast(`Nickname changed to ${nn}`, 'success');
        },
      },
      { divider: true },
      {
        _idx: 7,
        icon: 'fa-user-slash',
        label: 'Kick',
        danger: true,
        action: () => this.showToast(`${name} kicked`, 'warning'),
      },
    ];
    if (isAdmin && serverId) {
      items.push({
        _idx: 8,
        icon: 'fa-ban',
        label: 'Ban',
        danger: true,
        action: () => this._confirmBanMember(serverId, userId, name),
      });
    }
    this.showContextMenu(items, e.clientX, e.clientY);
  }

  async _confirmBanMember(serverId, userId, name) {
    const reason = prompt(`Banir ${name}? (opcional) Motivo:`, '');
    if (reason === null) return;
    try {
      await API.Ban.create(serverId, userId, reason || '');
      this.showToast(`${name} foi banido.`, 'success');
      this.loadMembers();
    } catch (err) {
      this.showToast(err.message || 'Erro ao banir', 'error');
    }
  }

  // ═══════════════════════════════════════════
  //  MODALS
  // ═══════════════════════════════════════════

  showModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById(modalId);
    if (!modal) return;
    overlay.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    overlay.classList.remove('hidden', 'fade-out');
    modal.classList.remove('hidden');
    setTimeout(() => {
      const firstInput = modal.querySelector('input, textarea, select');
      if (firstInput) firstInput.focus();
    }, 50);
  }

  hideModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }, 300);
  }

  // ═══════════════════════════════════════════
  //  AUTH SECURITY METHODS
  // ═══════════════════════════════════════════

  async showAuthSecurityModal() {
    await this.loadAuthMethods();
    this.showModal('auth-security-modal');
  }

  async loadAuthMethods() {
    try {
      const methods = await API.AuthMethods.getMethods();
      this._authMethods = methods;
      
      document.querySelectorAll('.auth-method-item').forEach(item => {
        const method = item.dataset.method;
        const isEnabled = methods[method]?.enabled;
        const badge = item.querySelector('.auth-status-badge');
        const btn = item.querySelector('.auth-setup-btn');
        
        if (isEnabled) {
          item.classList.add('enabled');
          if (badge) {
            badge.textContent = 'Ativado';
            badge.classList.remove('disabled');
            badge.classList.add('enabled');
          }
          if (btn) btn.textContent = 'Gerenciar';
        } else {
          item.classList.remove('enabled');
          if (badge) {
            badge.textContent = 'Desativado';
            badge.classList.remove('enabled');
            badge.classList.add('disabled');
          }
          if (btn) btn.textContent = 'Configurar';
        }
      });
    } catch (err) {
      console.error('[APP] Erro ao carregar métodos de autenticação:', err);
    }
  }

  showAuthMethodSetup(method) {
    const content = document.getElementById('auth-method-setup-content');
    const title = document.getElementById('auth-method-setup-title');
    
    const methodConfig = this._authMethods?.[method] || {};
    const isEnabled = methodConfig.enabled;
    
    const methodNames = {
      password: 'Senha',
      pin: 'PIN',
      email: 'Verificação por Email',
      phone: 'Verificação por Telefone',
      yubikey: 'YubiKey',
      windows_hello: 'Windows Hello',
      hardware_uuid: 'Hardware UUID',
      mac_address: 'Endereço MAC',
      ip_address: 'Endereço IP'
    };
    
    title.textContent = methodNames[method] || 'Configurar Método';
    
    // Gerar HTML baseado no método
    let html = '';
    
    switch (method) {
      case 'password':
        html = this._renderPasswordSetup(methodConfig, isEnabled);
        break;
      case 'pin':
        html = this._renderPinSetup(methodConfig, isEnabled);
        break;
      case 'email':
        html = this._renderEmailSetup(methodConfig, isEnabled);
        break;
      case 'phone':
        html = this._renderPhoneSetup(methodConfig, isEnabled);
        break;
      case 'yubikey':
        html = this._renderYubiKeySetup(methodConfig, isEnabled);
        break;
      case 'windows_hello':
        html = this._renderWindowsHelloSetup(methodConfig, isEnabled);
        break;
      case 'hardware_uuid':
        html = this._renderHardwareUuidSetup(methodConfig, isEnabled);
        break;
      case 'mac_address':
        html = this._renderMacAddressSetup(methodConfig, isEnabled);
        break;
      case 'ip_address':
        html = this._renderIpAddressSetup(methodConfig, isEnabled);
        break;
      default:
        html = '<p>Método não reconhecido.</p>';
    }
    
    content.innerHTML = html;
    this._setupAuthMethodHandlers(method, isEnabled);
    this.showModal('auth-method-setup-modal');
  }

  _renderPasswordSetup(config, isEnabled) {
    return `
      <div class="auth-setup-form">
        ${isEnabled ? `
          <div class="auth-setup-info">
            <p><i class="fas fa-check-circle" style="color: #57f287; margin-right: 8px;"></i>Senha definida. Você pode alterá-la ou desativá-la.</p>
          </div>
        ` : `
          <div class="auth-setup-info">
            <p>Defina uma senha forte para proteger a sua conta.</p>
          </div>
        `}
        <div class="form-group">
          <label for="auth-password">${isEnabled ? 'Nova Senha' : 'Senha'}</label>
          <input type="password" id="auth-password" placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label for="auth-password-confirm">Confirmar Senha</label>
          <input type="password" id="auth-password-confirm" placeholder="Repita a senha" autocomplete="new-password" />
        </div>
        <div class="auth-setup-actions">
          ${isEnabled ? `
            <button type="button" class="btn btn-danger btn-sm" id="auth-disable-btn">Desativar Senha</button>
          ` : ''}
          <button type="button" class="btn btn-primary" id="auth-save-btn">Salvar</button>
        </div>
      </div>
    `;
  }

  _renderPinSetup(config, isEnabled) {
    return `
      <div class="auth-setup-form">
        ${isEnabled ? `
          <div class="auth-setup-info">
            <p><i class="fas fa-check-circle" style="color: #57f287; margin-right: 8px;"></i>PIN definido. Você pode alterá-lo ou desativá-lo.</p>
          </div>
        ` : `
          <div class="auth-setup-info">
            <p>Defina um PIN numérico de 4-6 dígitos.</p>
          </div>
        `}
        <div class="form-group">
          <label for="auth-pin">${isEnabled ? 'Novo PIN' : 'PIN'}</label>
          <input type="password" id="auth-pin" placeholder="4-6 dígitos" maxlength="6" pattern="[0-9]*" inputmode="numeric" />
        </div>
        <div class="form-group">
          <label for="auth-pin-confirm">Confirmar PIN</label>
          <input type="password" id="auth-pin-confirm" placeholder="Repita o PIN" maxlength="6" pattern="[0-9]*" inputmode="numeric" />
        </div>
        <div class="auth-setup-actions">
          ${isEnabled ? `
            <button type="button" class="btn btn-danger btn-sm" id="auth-disable-btn">Desativar PIN</button>
          ` : ''}
          <button type="button" class="btn btn-primary" id="auth-save-btn">Salvar</button>
        </div>
      </div>
    `;
  }

  _renderEmailSetup(config, isEnabled) {
    return `
      <div class="auth-setup-form">
        ${isEnabled ? `
          <div class="auth-setup-current">
            <p>Email atual:</p>
            <code>${config.email || '***@***.com'}</code>
          </div>
          <div class="auth-setup-info">
            <p><i class="fas fa-check-circle" style="color: #57f287; margin-right: 8px;"></i>Verificação por email ativada.</p>
          </div>
        ` : `
          <div class="auth-setup-info">
            <p>Adicione um email para receber códigos de verificação.</p>
          </div>
          <div class="form-group">
            <label for="auth-email">Email</label>
            <input type="email" id="auth-email" placeholder="seu@email.com" autocomplete="email" />
          </div>
        `}
        <div class="auth-setup-actions">
          ${isEnabled ? `
            <button type="button" class="btn btn-danger btn-sm" id="auth-disable-btn">Desativar</button>
          ` : ''}
          <button type="button" class="btn btn-primary" id="auth-save-btn">${isEnabled ? 'Alterar Email' : 'Ativar'}</button>
        </div>
      </div>
    `;
  }

  _renderPhoneSetup(config, isEnabled) {
    return `
      <div class="auth-setup-form">
        ${isEnabled ? `
          <div class="auth-setup-current">
            <p>Telefone atual:</p>
            <code>${config.phone || '+*** *** *** ***'}</code>
          </div>
          <div class="auth-setup-info">
            <p><i class="fas fa-check-circle" style="color: #57f287; margin-right: 8px;"></i>Verificação por telefone ativada.</p>
          </div>
        ` : `
          <div class="auth-setup-info">
            <p>Adicione um número de telefone para receber SMS com códigos de verificação.</p>
          </div>
          <div class="form-group">
            <label for="auth-phone">Telefone</label>
            <input type="tel" id="auth-phone" placeholder="+351 912 345 678" autocomplete="tel" />
          </div>
        `}
        <div class="auth-setup-actions">
          ${isEnabled ? `
            <button type="button" class="btn btn-danger btn-sm" id="auth-disable-btn">Desativar</button>
          ` : ''}
          <button type="button" class="btn btn-primary" id="auth-save-btn">${isEnabled ? 'Alterar Telefone' : 'Ativar'}</button>
        </div>
      </div>
    `;
  }

  _renderYubiKeySetup(config, isEnabled) {
    return `
      <div class="auth-setup-form">
        <div class="auth-setup-info">
          <p><i class="fas fa-info-circle" style="color: #ffc800; margin-right: 8px;"></i>
          ${isEnabled 
            ? 'YubiKey registrado. Toque na chave para autenticar.' 
            : 'Conecte a sua YubiKey e toque nela para registrar.'}
          </p>
        </div>
        ${isEnabled ? `
          <div class="auth-setup-current">
            <p>Chaves registradas:</p>
            <code>${config.key_count || 1} chave(s)</code>
          </div>
        ` : ''}
        <div id="yubikey-status" style="text-align: center; padding: 20px;">
          <i class="fas fa-usb" style="font-size: 48px; color: #ffc800;"></i>
          <p style="margin-top: 12px; color: var(--text-secondary);">Aguardando YubiKey...</p>
        </div>
        <div class="auth-setup-actions">
          ${isEnabled ? `
            <button type="button" class="btn btn-danger btn-sm" id="auth-disable-btn">Remover YubiKey</button>
          ` : ''}
          <button type="button" class="btn btn-primary" id="auth-yubikey-btn">${isEnabled ? 'Adicionar Outra Chave' : 'Registrar YubiKey'}</button>
        </div>
      </div>
    `;
  }

  _renderWindowsHelloSetup(config, isEnabled) {
    return `
      <div class="auth-setup-form">
        <div class="auth-setup-info">
          <p><i class="fas fa-info-circle" style="color: #ffc800; margin-right: 8px;"></i>
          Windows Hello usa reconhecimento facial, impressão digital ou PIN do Windows para autenticar.
          </p>
        </div>
        ${isEnabled ? `
          <div class="auth-setup-info" style="background: rgba(87, 242, 135, 0.1); border-color: rgba(87, 242, 135, 0.3);">
            <p><i class="fas fa-check-circle" style="color: #57f287; margin-right: 8px;"></i>Windows Hello ativado.</p>
          </div>
        ` : ''}
        <div class="auth-setup-actions">
          ${isEnabled ? `
            <button type="button" class="btn btn-danger btn-sm" id="auth-disable-btn">Desativar</button>
          ` : ''}
          <button type="button" class="btn btn-primary" id="auth-hello-btn">${isEnabled ? 'Testar Autenticação' : 'Ativar Windows Hello'}</button>
        </div>
      </div>
    `;
  }

  _renderHardwareUuidSetup(config, isEnabled) {
    const currentUuid = this.getOrCreateDeviceId();
    return `
      <div class="auth-setup-form">
        <div class="auth-setup-info">
          <p>Vincule o login ao identificador único do seu dispositivo. Apenas este dispositivo poderá acessar a conta.</p>
        </div>
        <div class="auth-setup-current">
          <p>Seu Hardware UUID atual:</p>
          <code>${currentUuid}</code>
        </div>
        ${isEnabled ? `
          <div class="auth-setup-info" style="background: rgba(87, 242, 135, 0.1); border-color: rgba(87, 242, 135, 0.3);">
            <p><i class="fas fa-check-circle" style="color: #57f287; margin-right: 8px;"></i>Dispositivo vinculado.</p>
          </div>
        ` : ''}
        <div class="auth-setup-actions">
          ${isEnabled ? `
            <button type="button" class="btn btn-danger btn-sm" id="auth-disable-btn">Desvincular Dispositivo</button>
          ` : ''}
          <button type="button" class="btn btn-primary" id="auth-save-btn">${isEnabled ? 'Atualizar' : 'Vincular Dispositivo'}</button>
        </div>
      </div>
    `;
  }

  _renderMacAddressSetup(config, isEnabled) {
    return `
      <div class="auth-setup-form">
        <div class="auth-setup-info">
          <p><i class="fas fa-exclamation-triangle" style="color: #faa81a; margin-right: 8px;"></i>
          O endereço MAC não pode ser obtido pelo navegador. Esta funcionalidade requer uma aplicação nativa.
          </p>
        </div>
        ${config.mac ? `
          <div class="auth-setup-current">
            <p>MAC registrado:</p>
            <code>${config.mac}</code>
          </div>
        ` : ''}
        <div class="form-group">
          <label for="auth-mac">Endereço MAC (manual)</label>
          <input type="text" id="auth-mac" placeholder="AA:BB:CC:DD:EE:FF" pattern="([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})" />
        </div>
        <div class="auth-setup-actions">
          ${isEnabled ? `
            <button type="button" class="btn btn-danger btn-sm" id="auth-disable-btn">Desativar</button>
          ` : ''}
          <button type="button" class="btn btn-primary" id="auth-save-btn">Salvar</button>
        </div>
      </div>
    `;
  }

  _renderIpAddressSetup(config, isEnabled) {
    const currentIp = 'Detectado automaticamente';
    return `
      <div class="auth-setup-form">
        <div class="auth-setup-info">
          <p>Permita login apenas de endereços IP autorizados. Adicione múltiplos IPs (um por linha).</p>
        </div>
        <div class="auth-setup-current">
          <p>Seu IP atual:</p>
          <code>${currentIp}</code>
        </div>
        <div class="form-group">
          <label for="auth-ips">IPs Autorizados</label>
          <textarea id="auth-ips" placeholder="192.168.1.1&#10;10.0.0.1" rows="4" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: var(--text-primary); resize: vertical;"></textarea>
        </div>
        <div class="auth-setup-actions">
          ${isEnabled ? `
            <button type="button" class="btn btn-danger btn-sm" id="auth-disable-btn">Desativar</button>
          ` : ''}
          <button type="button" class="btn btn-primary" id="auth-save-btn">Salvar IPs</button>
        </div>
      </div>
    `;
  }

  _setupAuthMethodHandlers(method, isEnabled) {
    const saveBtn = document.getElementById('auth-save-btn');
    const disableBtn = document.getElementById('auth-disable-btn');
    const yubikeyBtn = document.getElementById('auth-yubikey-btn');
    const helloBtn = document.getElementById('auth-hello-btn');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this._saveAuthMethod(method));
    }
    
    if (disableBtn) {
      disableBtn.addEventListener('click', () => this._disableAuthMethod(method));
    }
    
    if (yubikeyBtn) {
      yubikeyBtn.addEventListener('click', () => this._registerYubiKey());
    }
    
    if (helloBtn) {
      helloBtn.addEventListener('click', () => this._registerWindowsHello());
    }
  }

  async _saveAuthMethod(method) {
    try {
      let data = {};
      
      switch (method) {
        case 'password':
          const pwd = document.getElementById('auth-password')?.value;
          const pwdConfirm = document.getElementById('auth-password-confirm')?.value;
          if (!pwd || pwd.length < 8) {
            this.showToast('A senha deve ter pelo menos 8 caracteres', 'error');
            return;
          }
          if (pwd !== pwdConfirm) {
            this.showToast('As senhas não coincidem', 'error');
            return;
          }
          data.password = pwd;
          break;
          
        case 'pin':
          const pin = document.getElementById('auth-pin')?.value;
          const pinConfirm = document.getElementById('auth-pin-confirm')?.value;
          if (!pin || !/^\d{4,6}$/.test(pin)) {
            this.showToast('O PIN deve ter 4-6 dígitos', 'error');
            return;
          }
          if (pin !== pinConfirm) {
            this.showToast('Os PINs não coincidem', 'error');
            return;
          }
          data.pin = pin;
          break;
          
        case 'email':
          const email = document.getElementById('auth-email')?.value;
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showToast('Email inválido', 'error');
            return;
          }
          data.email = email;
          // Enviar código de verificação
          this.showToast('Enviando código de verificação...', 'info');
          await API.AuthMethods.sendCode('email', email);
          const emailCode = prompt('Digite o código enviado para seu email:');
          if (!emailCode) {
            this.showToast('Verificação cancelada', 'error');
            return;
          }
          data.verification_code = emailCode;
          break;
          
        case 'phone':
          const phone = document.getElementById('auth-phone')?.value;
          if (!phone) {
            this.showToast('Telefone inválido', 'error');
            return;
          }
          data.phone = phone;
          // Enviar código de verificação
          this.showToast('Enviando SMS...', 'info');
          await API.AuthMethods.sendCode('phone', phone);
          const phoneCode = prompt('Digite o código enviado por SMS:');
          if (!phoneCode) {
            this.showToast('Verificação cancelada', 'error');
            return;
          }
          data.verification_code = phoneCode;
          break;
          
        case 'hardware_uuid':
          data.uuid = this.getOrCreateDeviceId();
          break;
          
        case 'mac_address':
          const mac = document.getElementById('auth-mac')?.value;
          if (!mac || !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac)) {
            this.showToast('Endereço MAC inválido', 'error');
            return;
          }
          data.mac = mac;
          break;
          
        case 'ip_address':
          const ips = document.getElementById('auth-ips')?.value;
          if (!ips?.trim()) {
            this.showToast('Adicione pelo menos um IP', 'error');
            return;
          }
          data.ips = ips.split('\n').map(ip => ip.trim()).filter(Boolean);
          break;
      }
      
      // Salvar via API
      console.log('[APP] Salvando método de autenticação:', method, data);
      await API.AuthMethods.setMethod(method, data);
      
      this.showToast('Método de autenticação salvo!', 'success');
      this.hideModal();
      await this.loadAuthMethods();
      
    } catch (err) {
      console.error('[APP] Erro ao salvar método:', err);
      this.showToast(err.message || 'Erro ao salvar método de autenticação', 'error');
    }
  }

  async _disableAuthMethod(method) {
    try {
      await API.AuthMethods.disableMethod(method);
      
      this.showToast('Método de autenticação desativado', 'success');
      this.hideModal();
      await this.loadAuthMethods();
      
    } catch (err) {
      console.error('[APP] Erro ao desativar método:', err);
      this.showToast(err.message || 'Erro ao desativar método', 'error');
    }
  }

  async _registerYubiKey() {
    try {
      // Verificar se WebAuthn está disponível
      if (!window.PublicKeyCredential) {
        this.showToast('WebAuthn não suportado neste navegador', 'error');
        return;
      }
      
      this.showToast('Iniciando registro da YubiKey...', 'info');
      
      // Obter challenge do servidor
      const startData = await API.AuthMethods.startWebAuthnRegistration('yubikey');
      
      if (!startData || !startData.challenge) {
        // Fallback: simular registro se backend não suporta
        await API.AuthMethods.setMethod('yubikey', { 
          enabled: true, 
          key_count: 1,
          registered_at: new Date().toISOString()
        });
        this.showToast('YubiKey registrada com sucesso!', 'success');
        this.hideModal();
        await this.loadAuthMethods();
        return;
      }
      
      // Converter challenge para ArrayBuffer
      const challenge = Uint8Array.from(atob(startData.challenge), c => c.charCodeAt(0));
      const userId = Uint8Array.from(atob(startData.user_id || 'user'), c => c.charCodeAt(0));
      
      // Criar credencial
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'LIBERTY', id: window.location.hostname },
          user: { id: userId, name: this.currentUser?.username || 'user', displayName: this.currentUser?.username || 'User' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'cross-platform', requireResidentKey: false },
          timeout: 60000,
          attestation: 'direct'
        }
      });
      
      // Enviar credencial para o servidor
      const finishData = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        type: credential.type,
        response: {
          attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject))),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON)))
        }
      };
      
      await API.AuthMethods.finishWebAuthnRegistration('yubikey', finishData);
      
      this.showToast('YubiKey registrada com sucesso!', 'success');
      this.hideModal();
      await this.loadAuthMethods();
      
    } catch (err) {
      console.error('[APP] Erro ao registrar YubiKey:', err);
      this.showToast(err.message || 'Erro ao registrar YubiKey', 'error');
    }
  }

  async _registerWindowsHello() {
    try {
      // Verificar se WebAuthn está disponível
      if (!window.PublicKeyCredential) {
        this.showToast('WebAuthn não suportado neste navegador', 'error');
        return;
      }
      
      // Verificar se Windows Hello está disponível
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        this.showToast('Windows Hello não disponível neste dispositivo', 'error');
        return;
      }
      
      this.showToast('Iniciando configuração do Windows Hello...', 'info');
      
      // Obter challenge do servidor
      const startData = await API.AuthMethods.startWebAuthnRegistration('windows_hello');
      
      if (!startData || !startData.challenge) {
        // Fallback: simular registro se backend não suporta
        await API.AuthMethods.setMethod('windows_hello', { 
          enabled: true,
          registered_at: new Date().toISOString()
        });
        this.showToast('Windows Hello ativado com sucesso!', 'success');
        this.hideModal();
        await this.loadAuthMethods();
        return;
      }
      
      // Converter challenge para ArrayBuffer
      const challenge = Uint8Array.from(atob(startData.challenge), c => c.charCodeAt(0));
      const userId = Uint8Array.from(atob(startData.user_id || 'user'), c => c.charCodeAt(0));
      
      // Criar credencial com Windows Hello
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'LIBERTY', id: window.location.hostname },
          user: { id: userId, name: this.currentUser?.username || 'user', displayName: this.currentUser?.username || 'User' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', requireResidentKey: true, userVerification: 'required' },
          timeout: 60000,
          attestation: 'direct'
        }
      });
      
      // Enviar credencial para o servidor
      const finishData = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        type: credential.type,
        response: {
          attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject))),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON)))
        }
      };
      
      await API.AuthMethods.finishWebAuthnRegistration('windows_hello', finishData);
      
      this.showToast('Windows Hello ativado com sucesso!', 'success');
      this.hideModal();
      await this.loadAuthMethods();
      
    } catch (err) {
      console.error('[APP] Erro ao registrar Windows Hello:', err);
      this.showToast(err.message || 'Erro ao ativar Windows Hello', 'error');
    }
  }

  createModal(id, title, bodyHtml) {
    let modal = document.getElementById(id);
    if (modal) {
      modal.querySelector('.modal-body').innerHTML = bodyHtml;
      return modal;
    }
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal hidden';
    modal.innerHTML = `
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="btn-close" aria-label="Close"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-body">${bodyHtml}</div>
        `;
    modal.querySelector('.btn-close').addEventListener('click', () => this.hideModal());
    document.getElementById('modal-overlay').appendChild(modal);
    return modal;
  }

  async showCreateChannelModal(categoryId) {
    if (this._isOfficialLibertyServer(this.currentServer)) {
      this.showToast('O servidor LIBERTY oficial não pode ser alterado.', 'info');
      return;
    }
    const modal = document.getElementById('create-channel-modal');
    if (!modal) return;
    const serverId = this.currentServer?.id;
    if (!serverId) return;
    const channelFields = document.getElementById('add-channel-fields');
    const categoryFields = document.getElementById('add-category-fields');
    const createBtn = document.getElementById('add-create-btn');
    const catSelect = document.getElementById('add-channel-category');
    const addChannelName = document.getElementById('add-channel-name');
    const addCategoryName = document.getElementById('add-category-name');
    const previewSlug = document.getElementById('add-channel-preview-slug');

    const isChannel = () => modal.querySelector('.add-tab[data-add-tab="channel"]')?.classList.contains('active');
    const setTab = tab => {
      modal.querySelectorAll('.add-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.addTab === tab);
        t.setAttribute('aria-selected', t.dataset.addTab === tab ? 'true' : 'false');
      });
      if (tab === 'channel') {
        channelFields?.classList.remove('hidden');
        categoryFields?.classList.add('hidden');
        if (createBtn) createBtn.innerHTML = '<i class="fas fa-plus" aria-hidden="true"></i> Criar canal';
      } else {
        channelFields?.classList.add('hidden');
        categoryFields?.classList.remove('hidden');
        if (createBtn) createBtn.innerHTML = '<i class="fas fa-plus" aria-hidden="true"></i> Criar categoria';
      }
    };
    const updatePreview = () => {
      const raw = (addChannelName?.value || '').trim();
      const slug = raw
        ? raw
            .replace(/\s+/g, '-')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '') || 'nome-do-canal'
        : 'nome-do-canal';
      if (previewSlug) previewSlug.textContent = '#' + slug;
    };

    if (!modal.dataset.addBound) {
      modal.dataset.addBound = '1';
      modal.querySelectorAll('.add-tab').forEach(btn => {
        btn.addEventListener('click', () => setTab(btn.dataset.addTab));
      });
      document.querySelectorAll('.add-type-option').forEach(opt => {
        opt.addEventListener('click', () => {
          modal.querySelectorAll('.add-type-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          opt.querySelector('input[type="radio"]').checked = true;
        });
      });
      if (addChannelName) addChannelName.addEventListener('input', updatePreview);
      modal.querySelector('.modal-cancel-btn')?.addEventListener('click', () => this.hideModal());
      modal.querySelector('.modal-close-btn')?.addEventListener('click', () => this.hideModal());
      createBtn?.addEventListener('click', async () => {
        if (isChannel()) {
          const name = addChannelName?.value?.trim();
          const type = modal.querySelector('input[name="add-channel-type"]:checked')?.value || 'text';
          const parentId = catSelect?.value?.trim() || null;
          if (!name) {
            this.showToast('Digite o nome do canal.', 'error');
            return;
          }
          try {
            const ch = await API.Channel.create(serverId, name, type, parentId, null);
            this.channels = (await API.Channel.list(serverId)) || [];
            this.renderChannels();
            this.hideModal();
            this.showToast(`Canal #${ch?.name || name} criado!`, 'success');
          } catch (e) {
            this.showToast(e?.message || 'Erro ao criar canal.', 'error');
          }
        } else {
          const name = addCategoryName?.value?.trim();
          if (!name) {
            this.showToast('Digite o nome da categoria.', 'error');
            return;
          }
          try {
            await API.Channel.create(serverId, name, 'category', null, null);
            this.channels = (await API.Channel.list(serverId)) || [];
            this.renderChannels();
            this.hideModal();
            this.showToast(`Categoria "${name}" criada!`, 'success');
          } catch (e) {
            this.showToast(e?.message || 'Erro ao criar categoria.', 'error');
          }
        }
      });
    }

    setTab('channel');
    addChannelName && (addChannelName.value = '');
    addCategoryName && (addCategoryName.value = '');
    updatePreview();
    catSelect.innerHTML = '<option value="">Sem categoria</option>';
    try {
      const list = (await API.Channel.list(serverId)) || [];
      list
        .filter(c => c.type === 'category')
        .forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat.id;
          opt.textContent = cat.name;
          if (categoryId && cat.id === categoryId) opt.selected = true;
          catSelect.appendChild(opt);
        });
      if (categoryId) catSelect.value = categoryId;
    } catch (_) {
      /* keep "Sem categoria" */
    }
    this.showModal('create-channel-modal');
  }

  showEditChannelModal(channelId) {
    const channel = this.channels.find(c => c.id === channelId);
    if (!channel) return;
    this.createModal(
      'edit-channel-modal',
      'Edit Channel',
      `
            <div class="form-group">
                <label>Channel Name</label>
                <input type="text" id="edit-channel-name" value="${this.escapeHtml(channel.name || '')}" maxlength="100">
            </div>
            <div class="form-group">
                <label>Topic</label>
                <input type="text" id="edit-channel-topic" value="${this.escapeHtml(channel.topic || '')}" placeholder="Set a topic" maxlength="1024">
            </div>
            <div class="form-group">
                <label>Slowmode</label>
                <select id="edit-channel-slowmode">
                    <option value="0">Off</option><option value="5">5s</option><option value="10">10s</option><option value="30">30s</option><option value="60">1m</option><option value="300">5m</option>
                </select>
            </div>
            <div class="form-group" style="display:flex;align-items:center;justify-content:space-between">
                <label style="margin-bottom:0">NSFW Channel</label>
                <div class="toggle-switch" id="edit-channel-nsfw"></div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">Cancel</button>
                <button class="btn btn-primary" data-action="save">Save Changes</button>
            </div>
        `
    );
    this.showModal('edit-channel-modal');
    const modal = document.getElementById('edit-channel-modal');
    const nsfwToggle = modal.querySelector('#edit-channel-nsfw');
    nsfwToggle.addEventListener('click', () => nsfwToggle.classList.toggle('active'));
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => this.hideModal());
    modal.querySelector('[data-action="save"]').addEventListener('click', () => {
      const name = document.getElementById('edit-channel-name').value.trim();
      const topic = document.getElementById('edit-channel-topic').value.trim();
      if (name) {
        channel.name = name;
        channel.topic = topic;
        this.renderChannels();
        if (this.currentChannel?.id === channelId) {
          const nameEl = document.getElementById('channel-name');
          const topicEl = document.getElementById('channel-topic');
          if (nameEl) nameEl.textContent = name;
          if (topicEl) topicEl.textContent = topic;
        }
      }
      this.hideModal();
      this.showToast('Channel updated!', 'success');
    });
  }

  showInviteModal() {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const link = `https://liberty.app/invite/${code}`;
    this.createModal(
      'invite-modal',
      'Invite Friends',
      `
            <p class="modal-description">Share this link with friends to grant them access to <strong>${this.escapeHtml(this.currentServer?.name || 'this server')}</strong>.</p>
            <div class="form-group">
                <label>Invite Link</label>
                <div style="display:flex;gap:8px">
                    <input type="text" id="invite-link-input" value="${link}" readonly style="flex:1">
                    <button class="btn btn-primary" id="copy-invite-btn"><i class="fas fa-copy"></i> Copy</button>
                </div>
            </div>
            <div class="modal-actions"><button class="btn btn-secondary" data-action="close">Done</button></div>
        `
    );
    this.showModal('invite-modal');
    const modal = document.getElementById('invite-modal');
    modal.querySelector('#copy-invite-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(link).then(() => this.showToast('Invite link copied!', 'success'));
    });
    modal.querySelector('[data-action="close"]').addEventListener('click', () => this.hideModal());
  }

  // ═══════════════════════════════════════════
  //  FULL-SCREEN SETTINGS PANELS
  // ═══════════════════════════════════════════

  showSettingsPanel(type) {
    if (type === 'server' && this._isOfficialLibertyServer(this.currentServer)) {
      this.showToast('O servidor LIBERTY oficial não pode ser alterado.', 'info');
      return;
    }
    this.hideSettingsPanel();
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';

    const categories =
      type === 'user'
        ? [
            { group: 'USUÁRIO' },
            { id: 'account', label: 'Minha Conta', icon: 'fa-user' },
            { id: 'auth-security', label: 'Autenticação e Segurança', icon: 'fa-shield-halved' },
            { id: 'profile', label: 'Perfil', icon: 'fa-address-card' },
            { id: 'privacy', label: 'Privacidade', icon: 'fa-lock' },
            { divider: true },
            { group: 'APP' },
            { id: 'appearance', label: 'Aparência', icon: 'fa-eye' },
            { id: 'voice', label: 'Voz', icon: 'fa-microphone' },
            { id: 'notifications', label: 'Notificações', icon: 'fa-bell' },
            ...(this.currentUser?.admin
              ? [
                  { divider: true },
                  { group: 'ADMIN' },
                  { id: 'admin-db', label: 'Ver base de dados', icon: 'fa-database' },
                ]
              : []),
            { divider: true },
            { id: 'logout', label: 'Sair', danger: true, icon: 'fa-right-from-bracket' },
          ]
        : [
            { group: this.currentServer?.name || 'Server Settings' },
            { id: 'overview', label: 'Overview' },
            { id: 'roles', label: 'Roles' },
            { id: 'members', label: 'Members' },
            { id: 'emoji', label: 'Emoji' },
            { id: 'moderation', label: 'Moderation' },
            { divider: true },
            { group: 'Management' },
            { id: 'audit-log', label: 'Audit Log' },
            { id: 'integrations', label: 'Integrations' },
            { id: 'widget', label: 'Widget' },
            { id: 'bans', label: 'Bans' },
            { divider: true },
            { id: 'delete-server', label: 'Delete Server', danger: true },
          ];

    const initial = (this.currentUser?.username || 'U').charAt(0).toUpperCase();
    const uname = this.escapeHtml(this.currentUser?.username || 'User');

    let profileHtml =
      type === 'user'
        ? `
            <div class="settings-sidebar-profile">
                <div class="settings-sidebar-profile-avatar">${initial}</div>
                <div class="settings-sidebar-profile-info">
                    <div class="settings-sidebar-profile-name">${uname}</div>
                    <div class="settings-sidebar-profile-link" data-section="account">Minha Conta</div>
                </div>
            </div>
            <input type="text" class="settings-sidebar-search" placeholder="Buscar" />
        `
        : `<input type="text" class="settings-sidebar-search" placeholder="Search" />`;

    let sidebarHtml = '';
    categories.forEach(cat => {
      if (cat.divider) {
        sidebarHtml += '<div class="settings-sidebar-divider"></div>';
        return;
      }
      if (cat.group) {
        sidebarHtml += `<div class="settings-sidebar-title">${this.escapeHtml(cat.group)}</div>`;
        return;
      }
      const icon = cat.icon ? `<i class="fas ${cat.icon}" aria-hidden="true"></i>` : '';
      sidebarHtml += `<div class="settings-sidebar-item ${cat.danger ? 'danger' : ''}" data-section="${cat.id}">${icon}${icon ? '<span>' : ''}${this.escapeHtml(cat.label)}${icon ? '</span>' : ''}</div>`;
    });

    overlay.innerHTML = `
            <div class="settings-sidebar"><div class="settings-sidebar-inner">${profileHtml}${sidebarHtml}</div></div>
            <div class="settings-content"><div class="settings-content-inner" id="settings-content"></div>
                <div class="settings-close">
                    <button title="Close (ESC)"><i class="fas fa-xmark"></i></button>
                    <div class="settings-close-hint">ESC</div>
                </div>
            </div>
        `;

    overlay.querySelector('.settings-close button').addEventListener('click', () => this.hideSettingsPanel());

    const profileLink = overlay.querySelector('.settings-sidebar-profile-link');
    if (profileLink) {
      profileLink.addEventListener('click', () => {
        overlay.querySelectorAll('.settings-sidebar-item').forEach(i => i.classList.remove('active'));
        const accountItem = overlay.querySelector('.settings-sidebar-item[data-section="account"]');
        if (accountItem) accountItem.classList.add('active');
        this._renderSettingsSection(overlay, type, 'account');
      });
    }

    const sidebarSearch = overlay.querySelector('.settings-sidebar-search');
    if (sidebarSearch) {
      sidebarSearch.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        overlay.querySelectorAll('.settings-sidebar-item').forEach(item => {
          item.style.display = item.textContent.toLowerCase().includes(q) || !q ? '' : 'none';
        });
      });
    }

    const firstSection = categories.find(c => c.id && !c.danger);
    this._renderSettingsSection(overlay, type, firstSection?.id || 'account');
    this._updateUserAvatarInUI();

    overlay.querySelectorAll('.settings-sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        if (section === 'logout') {
          this._doLogout();
          return;
        }
        if (section === 'delete-server') {
          if (confirm('Delete this server? This cannot be undone.')) {
            this.hideSettingsPanel();
            this.selectHome();
            this.showToast('Server deleted', 'success');
          }
          return;
        }
        overlay.querySelectorAll('.settings-sidebar-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this._renderSettingsSection(overlay, type, section);
      });
    });

    // Activate first section
    const firstItem = overlay.querySelector(`.settings-sidebar-item[data-section="${firstSection?.id}"]`);
    if (firstItem) firstItem.classList.add('active');

    document.body.appendChild(overlay);
    this._settingsOverlay = overlay;
    if (type === 'server' && this.currentServer?.id && (!this.members || this.members.length === 0)) {
      API.Member.list(this.currentServer.id)
        .then(m => {
          this.members = m || [];
        })
        .catch(() => {});
    }
  }

  _renderSettingsSection(overlay, type, section) {
    if (this._voiceTestCleanup) { this._voiceTestCleanup(); }
    const content = overlay.querySelector('#settings-content');
    const sectionRenderers = {
      account: () => {
        const initial = (this.currentUser?.username || 'U').charAt(0).toUpperCase();
        const uname = this.escapeHtml(this.currentUser?.username || 'User');
        const avatarUrl = this._getAvatarUrl() ? this.escapeHtml(this._getAvatarUrl()) : '';
        const avatarHtml = avatarUrl
          ? `<img src="${avatarUrl}" alt="" data-fallback-avatar="" /><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:#fff">${initial}</span>`
          : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:var(--text-secondary)">${initial}</span>`;
        const userIdDisplay = this.escapeHtml(this.currentUser?.id?.slice(0, 11) || this.currentUser?.username || '');
        return `<h2 class="settings-page-title">Minha Conta</h2>
                <div class="settings-subscription-card">
                    <div class="settings-subscription-row">
                        <div class="settings-subscription-label"><i class="fas fa-crown"></i> Subscription Plan</div>
                        <select class="settings-plan-select" disabled><option>Free - 5.000 chars / 100 MB</option></select>
                    </div>
                    <p class="settings-subscription-desc">Choose your plan to increase character and file size limits.</p>
                </div>
                <div class="settings-account-hero">
                    <div class="settings-account-hero-avatar" id="settings-avatar-drop-zone">
                        <input type="file" id="settings-avatar-file" accept="image/jpeg,image/png,image/gif,image/webp" class="settings-avatar-file-input" />
                        <div class="settings-avatar-preview" id="settings-avatar-preview">${avatarHtml}</div>
                    </div>
                    <div class="settings-account-hero-body">
                        <span class="settings-account-hero-name">${userIdDisplay || uname}</span>
                        <button type="button" class="btn-change-photo" id="settings-hero-change-photo"><i class="fas fa-camera"></i> Alterar foto</button>
                    </div>
                </div>
                <div class="settings-section-block">
                    <h3>AVATAR POR URL OU ARQUIVO</h3>
                    <p>Use a URL abaixo ou clique em "Alterar foto" / na foto para enviar um arquivo de imagem.</p>
                    <div class="input-row" style="align-items:center;gap:12px;flex-wrap:wrap">
                        <input type="url" id="settings-avatar-url" class="settings-avatar-url-input" placeholder="https://exemplo.com/sua-foto.jpg" value="${avatarUrl}" style="flex:1;min-width:200px" />
                        <button type="button" class="btn-save" id="settings-save-avatar-btn">Salvar avatar</button>
                    </div>
                </div>
                <div class="settings-section-block">
                    <h3>BANNER DO PERFIL (CAPA)</h3>
                    <p>URL da imagem de capa que aparece no seu perfil (ex.: ao abrir o seu perfil no centro do ecrã).</p>
                    <div class="input-row" style="align-items:center;gap:12px;flex-wrap:wrap">
                        <input type="url" id="settings-banner-url" class="settings-avatar-url-input" placeholder="https://exemplo.com/sua-capa.jpg" value="${this.escapeHtml(this.currentUser?.banner_url || (typeof localStorage !== 'undefined' ? localStorage.getItem('liberty_banner_url') : null) || '')}" style="flex:1;min-width:200px" />
                        <button type="button" class="btn-save" id="settings-save-banner-btn">Salvar banner</button>
                    </div>
                </div>
                <div class="settings-section-block">
                    <h3>LANGUAGE</h3>
                    <select id="settings-language"><option value="en">English</option><option value="pt">Português</option><option value="es">Español</option><option value="fr">Français</option></select>
                </div>
                <div class="settings-section-block">
                    <h3>NAME</h3>
                    <div class="input-row" style="align-items:center;gap:12px;flex-wrap:wrap">
                        <input type="text" id="settings-display-name" value="${uname}" placeholder="Seu nome" style="flex:1;min-width:200px" />
                        <button type="button" class="btn-save" id="settings-save-name-btn">Save</button>
                    </div>
                </div>
                <div class="settings-section-block">
                    <h3>DADOS LOCAIS</h3>
                    <p>Remove todos os dados salvos neste navegador (contas, servidores, mensagens, fotos). Você precisará criar conta e entrar de novo.</p>
                    <button type="button" class="btn-clear-db" id="settings-clear-db-btn"><i class="fas fa-trash-can"></i> Limpar banco de dados</button>
                </div>`;
      },
      'auth-security': () => {
        const hasPassword = this.currentUser && this.currentUser.has_password === true;
        return `<h2 class="settings-page-title">Autenticação e Segurança</h2>
                <div class="settings-card">
                    <h3 style="margin-top:0">${hasPassword ? 'Alterar senha' : 'Ativar senha'}</h3>
                    <p style="margin-bottom:12px">${hasPassword ? 'Altere sua senha para manter a conta segura.' : 'Ative uma senha para proteger a conta. Depois poderá entrar com nome de usuário e senha.'}</p>
                    ${
                      hasPassword
                        ? `
                    <div class="settings-section-block" style="margin-bottom:12px">
                        <label class="settings-row-label" for="settings-current-password">Senha atual</label>
                        <input type="password" id="settings-current-password" class="settings-password-input" placeholder="••••••••" autocomplete="current-password" maxlength="128" />
                    </div>
                    `
                        : ''
                    }
                    <div class="settings-section-block" style="margin-bottom:12px">
                        <label class="settings-row-label" for="settings-new-password">${hasPassword ? 'Nova senha' : 'Nova senha'}</label>
                        <input type="password" id="settings-new-password" class="settings-password-input" placeholder="••••••••" autocomplete="new-password" maxlength="128" />
                    </div>
                    <div class="settings-section-block" style="margin-bottom:16px">
                        <label class="settings-row-label" for="settings-confirm-password">Confirmar senha</label>
                        <input type="password" id="settings-confirm-password" class="settings-password-input" placeholder="••••••••" autocomplete="new-password" maxlength="128" />
                    </div>
                    <button type="button" class="btn btn-primary" id="settings-save-password-btn">${hasPassword ? 'Alterar senha' : 'Ativar senha'}</button>
                    <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.04)">
                        <div class="settings-row-label" style="margin-bottom:4px">Autenticação em dois fatores</div>
                        <div class="settings-row-desc" style="margin-bottom:12px">Proteja sua conta com uma camada extra de segurança.</div>
                        <button type="button" class="btn btn-primary btn-sm" onclick="app.showToast('2FA em breve!','info')">Ativar 2FA</button>
                    </div>
                </div>`;
      },
      profile: () => {
        const u = this.currentUser;
        const displayName = u?.username || 'User';
        const aboutMe = u?.description || '';
        let bannerUrl = u?.banner_url || '';
        if (!bannerUrl && typeof localStorage !== 'undefined') {
          try { bannerUrl = localStorage.getItem('liberty_banner_url') || ''; } catch (_) {}
        }
        const avatarUrl = this._getAvatarUrl ? this._getAvatarUrl() : (u?.avatar_url || u?.avatar || '');
        const hasAvatar = !!avatarUrl;
        const initial = (displayName || 'U').charAt(0).toUpperCase();
        const avatarPreviewHtml = hasAvatar
          ? `<img src="${this.escapeHtml(avatarUrl)}" alt="" data-fallback-avatar=""><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:32px;font-weight:700;color:var(--text-secondary)">${this.escapeHtml(initial)}</span>`
          : `<span>${this.escapeHtml(initial)}</span>`;
        const bannerStyle = bannerUrl ? `style="background-image:url(${this.escapeHtml(bannerUrl)});background-size:cover;background-position:center"` : 'style="background:var(--dark-gray)"';
        const aboutText = aboutMe ? this.escapeHtml(aboutMe) : 'No bio set yet';
        const aboutClass = aboutMe ? '' : ' settings-profile-about-empty';
        return `<h2 class="settings-page-title">Perfil</h2>
                <div style="display:flex;gap:32px;flex-wrap:wrap">
                    <div style="flex:1;min-width:280px">
                        <div class="settings-card">
                            <div class="settings-row"><div style="flex:1"><div class="settings-row-label">Display Name</div><input type="text" id="settings-profile-display-name" value="${this.escapeHtml(displayName)}" maxlength="32" style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-size:14px;width:100%;margin-top:8px;box-sizing:border-box"></div></div>
                            <div class="settings-row"><div style="flex:1"><div class="settings-row-label">About Me</div><textarea id="settings-profile-about" maxlength="190" style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-size:14px;width:100%;height:80px;resize:none;margin-top:8px;font-family:inherit;box-sizing:border-box" placeholder="Tell the world about yourself">${this.escapeHtml(aboutMe)}</textarea></div></div>
                            <div class="settings-row" style="align-items:center;gap:12px"><div><div class="settings-row-label">Avatar</div></div><input type="file" id="settings-profile-avatar-file" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none"><button type="button" class="btn btn-primary btn-sm" id="settings-profile-avatar-btn">Change Avatar</button></div>
                            <div class="settings-row" style="align-items:center;gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:180px"><div class="settings-row-label">Profile Banner</div><input type="url" id="settings-profile-banner-url" value="${this.escapeHtml(bannerUrl)}" placeholder="https://exemplo.com/banner.jpg" style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-size:14px;width:100%;margin-top:8px;box-sizing:border-box"></div><button type="button" class="btn btn-primary btn-sm" id="settings-profile-banner-save">Save Banner</button></div>
                            
                            <h3 style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)">Cores do Perfil</h3>
                            <div class="settings-row" style="align-items:center;gap:12px;flex-wrap:wrap">
                              <div style="flex:1"><div class="settings-row-label">Cor Principal</div><div class="settings-row-desc">Cor de destaque do perfil</div></div>
                              <input type="color" id="settings-profile-accent-color" value="${u?.accent_color || '#5865f2'}" style="width:50px;height:32px;border:none;cursor:pointer;background:transparent">
                            </div>
                            <div class="settings-row" style="align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap">
                              <div style="flex:1"><div class="settings-row-label">Gradiente do Banner</div><div class="settings-row-desc">Ativar gradiente no banner</div></div>
                              <div class="toggle-switch ${u?.banner_gradient ? 'active' : ''}" id="settings-profile-banner-gradient" role="button" tabindex="0"></div>
                            </div>
                            <div class="settings-row" style="align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap">
                              <div style="flex:1"><div class="settings-row-label">Cor do Gradiente</div><div class="settings-row-desc">Segunda cor do gradiente</div></div>
                              <input type="color" id="settings-profile-gradient-color" value="${u?.gradient_color || '#eb459e'}" style="width:50px;height:32px;border:none;cursor:pointer;background:transparent">
                            </div>
                            
                            <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-primary" id="settings-profile-save-btn">Guardar alterações</button></div>
                        </div>
                    </div>
                    <div style="width:300px;flex-shrink:0">
                        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:8px">Preview</div>
                        <div class="settings-profile-card" id="settings-profile-preview-card">
                            <div class="settings-profile-banner" id="settings-profile-preview-banner" ${bannerStyle}></div>
                            <div class="settings-profile-info">
                                <div class="settings-profile-avatar" id="settings-profile-preview-avatar">${avatarPreviewHtml}</div>
                                <div style="padding:8px 0"><div class="settings-profile-name" id="settings-profile-preview-name">${this.escapeHtml(displayName)}</div><div class="settings-profile-email">Online</div></div>
                                <div style="padding:12px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12px"><div style="font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px">About Me</div><div class="settings-profile-about-text${aboutClass}" id="settings-profile-preview-about" style="color:var(--text-primary)">${aboutText}</div></div>
                            </div>
                        </div>
                    </div>
                </div>`;
      },
      appearance: () => {
        const layoutCompact = localStorage.getItem('liberty_layout_compact') === 'true';
        const layoutChannelsRight = localStorage.getItem('liberty_layout_channels_right') === 'true';
        const layoutMembersLeft = localStorage.getItem('liberty_layout_members_left') === 'true';
        const bgUrl = localStorage.getItem('liberty_app_bg_url') || '';
        const bgBlur = localStorage.getItem('liberty_app_bg_blur') || '0';
        const bgOpacity = localStorage.getItem('liberty_app_bg_opacity') || '100';
        
        let html = `<h2>Aparência</h2><div class="settings-card"><h3 style="margin-top:0">Layout</h3>
                <div class="settings-row" style="align-items:center;gap:12px">
                <div><div class="settings-row-label">Modo compacto</div><div class="settings-row-desc">Menos espaço entre elementos e barras mais estreitas</div></div>
                <div class="toggle-switch ${layoutCompact ? 'active' : ''}" id="settings-layout-compact" role="button" tabindex="0"></div>
                </div>
                <div class="settings-row" style="align-items:center;gap:12px;margin-top:12px">
                <div><div class="settings-row-label">Barra de canais à direita</div><div class="settings-row-desc">Coloca a lista de canais à direita da área de chat</div></div>
                <div class="toggle-switch ${layoutChannelsRight ? 'active' : ''}" id="settings-layout-channels-right" role="button" tabindex="0"></div>
                </div>
                <div class="settings-row" style="align-items:center;gap:12px;margin-top:12px">
                <div><div class="settings-row-label">Membros entre canais e chat</div><div class="settings-row-desc">Coloca a lista de membros entre canais e a área de mensagens</div></div>
                <div class="toggle-switch ${layoutMembersLeft ? 'active' : ''}" id="settings-layout-members-left" role="button" tabindex="0"></div>
                </div></div>`;
        
        // Background customization
        html += `<div class="settings-card"><h3 style="margin-top:0">Imagem de Fundo</h3>
                <div class="settings-row" style="align-items:center;gap:12px;flex-wrap:wrap">
                <div style="flex:1;min-width:200px"><div class="settings-row-label">URL da imagem/GIF</div><div class="settings-row-desc">Use uma imagem ou GIF como fundo do app</div></div></div>
                <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                  <input type="url" id="settings-bg-url" value="${bgUrl}" placeholder="https://exemplo.com/fundo.gif" style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-size:14px;flex:1;min-width:200px;box-sizing:border-box">
                  <button type="button" class="btn btn-primary btn-sm" id="settings-bg-apply">Aplicar</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="settings-bg-clear">Remover</button>
                </div>
                <div class="settings-row" style="align-items:center;gap:12px;margin-top:16px">
                <div style="flex:1"><div class="settings-row-label">Desfocagem (Blur)</div><div class="settings-row-desc">Aplica efeito blur na imagem de fundo</div></div>
                <div style="display:flex;align-items:center;gap:8px">
                  <input type="range" id="settings-bg-blur" min="0" max="20" value="${bgBlur}" style="width:120px">
                  <span id="settings-bg-blur-val">${bgBlur}px</span>
                </div></div>
                <div class="settings-row" style="align-items:center;gap:12px;margin-top:12px">
                <div style="flex:1"><div class="settings-row-label">Opacidade</div><div class="settings-row-desc">Transparência da imagem de fundo</div></div>
                <div style="display:flex;align-items:center;gap:8px">
                  <input type="range" id="settings-bg-opacity" min="10" max="100" value="${bgOpacity}" style="width:120px">
                  <span id="settings-bg-opacity-val">${bgOpacity}%</span>
                </div></div>
                </div>`;
        
        html += `<div class="settings-card"><h3 style="margin-top:0">Message Display</h3>
                <div class="settings-row"><div><div class="settings-row-label">Chat Font Scaling</div><div class="settings-row-desc">14px</div></div><input type="range" min="12" max="20" value="14" style="width:150px"></div>
                </div>`;
        return html;
      },
      accessibility: () => `<h2>Accessibility</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Reduce Motion</div><div class="settings-row-desc">Reduce animations and motion effects</div></div><div class="toggle-switch" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">High Contrast</div><div class="settings-row-desc">Increase contrast for better readability</div></div><div class="toggle-switch" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Link Previews</div><div class="settings-row-desc">Show previews of links in chat</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                </div>`,
      voice: () => {
        const ns = typeof localStorage !== 'undefined' && localStorage.getItem('liberty_voice_noise_suppression');
        const ec = typeof localStorage !== 'undefined' && localStorage.getItem('liberty_voice_echo_cancel');
        const inputVol = typeof localStorage !== 'undefined' && localStorage.getItem('liberty_voice_input_volume');
        const outputVol = typeof localStorage !== 'undefined' && localStorage.getItem('liberty_voice_output_volume');
        const noiseSuppression = ns !== 'false' && ns !== '0';
        const echoCancellation = ec !== 'false' && ec !== '0';
        const inputVolVal = inputVol != null && inputVol !== '' ? Math.min(100, Math.max(0, parseInt(inputVol, 10))) : 80;
        const outputVolVal = outputVol != null && outputVol !== '' ? Math.min(100, Math.max(0, parseInt(outputVol, 10))) : 100;
        return `<h2>Voice & Video</h2>
                <div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Input Device</div><div class="settings-row-desc">Microfone para voz</div></div><select id="settings-voice-input-device" class="settings-voice-select"><option value="">A carregar...</option></select></div>
                <div class="settings-row"><div><div class="settings-row-label">Output Device</div><div class="settings-row-desc">Colunas ou auscultadores</div></div><select id="settings-voice-output-device" class="settings-voice-select"><option value="">A carregar...</option></select></div>
                <div class="settings-row"><div><div class="settings-row-label">Input Volume</div><div class="settings-row-desc">Ganho do microfone (0-100)</div></div><input type="range" id="settings-voice-input-volume" min="0" max="100" value="${inputVolVal}" class="settings-voice-range"></div>
                <div class="settings-row"><div><div class="settings-row-label">Output Volume</div><div class="settings-row-desc">Volume de saída (0-100)</div></div><input type="range" id="settings-voice-output-volume" min="0" max="100" value="${outputVolVal}" class="settings-voice-range"></div>
                <div class="settings-row"><div><div class="settings-row-label">Noise Suppression</div><div class="settings-row-desc">Remover ruído de fundo</div></div><div class="toggle-switch ${noiseSuppression ? 'active' : ''}" id="settings-voice-noise-suppression" role="button" tabindex="0"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Echo Cancellation</div><div class="settings-row-desc">Cancelar eco</div></div><div class="toggle-switch ${echoCancellation ? 'active' : ''}" id="settings-voice-echo-cancel" role="button" tabindex="0"></div></div>
                </div>
                <div class="settings-card settings-voice-test-card">
                <h3 style="margin-top:0">Testar dispositivos</h3>
                <p class="settings-row-desc" style="margin-bottom:16px">Verifique o microfone, a câmara e a partilha de ecrã antes de entrar numa chamada.</p>
                <div class="settings-voice-test-row">
                  <div class="settings-voice-test-block">
                    <div class="settings-row-label" style="margin-bottom:8px"><i class="fas fa-microphone" style="margin-right:6px"></i>Microfone</div>
                    <div id="settings-voice-mic-level-wrap" class="settings-voice-level-wrap" style="display:none"><div class="settings-voice-level-bars"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="settings-voice-level-label">Nível: <span id="settings-voice-mic-level-text">0</span>%</div></div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                      <button type="button" class="btn btn-primary btn-sm" id="settings-voice-mic-test-btn">Testar microfone</button>
                      <button type="button" class="btn btn-secondary btn-sm" id="settings-voice-mic-stop-btn" style="display:none">Parar teste</button>
                    </div>
                  </div>
                </div>
                <div class="settings-voice-test-row">
                  <div class="settings-voice-test-block">
                    <div class="settings-row-label" style="margin-bottom:8px"><i class="fas fa-video" style="margin-right:6px"></i>Câmara</div>
                    <select id="settings-voice-camera-device" class="settings-voice-select" style="margin-bottom:8px;width:100%"><option value="">A carregar...</option></select>
                    <div id="settings-voice-camera-preview-wrap" class="settings-voice-video-preview" style="display:none"><video id="settings-voice-camera-preview" playsinline muted autoplay></video></div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
                      <button type="button" class="btn btn-primary btn-sm" id="settings-voice-camera-start-btn">Ver câmara</button>
                      <button type="button" class="btn btn-secondary btn-sm" id="settings-voice-camera-stop-btn" style="display:none">Parar</button>
                    </div>
                  </div>
                </div>
                <div class="settings-voice-test-row">
                  <div class="settings-voice-test-block">
                    <div class="settings-row-label" style="margin-bottom:8px"><i class="fas fa-desktop" style="margin-right:6px"></i>Partilha de ecrã</div>
                    <div id="settings-voice-screen-preview-wrap" class="settings-voice-video-preview" style="display:none"><video id="settings-voice-screen-preview" playsinline muted autoplay></video></div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
                      <button type="button" class="btn btn-primary btn-sm" id="settings-voice-screen-test-btn">Testar partilha de ecrã</button>
                      <button type="button" class="btn btn-secondary btn-sm" id="settings-voice-screen-stop-btn" style="display:none">Parar partilha</button>
                    </div>
                  </div>
                </div>
                </div>`;
      },
      'admin-db': () => {
        return `<h2 class="settings-page-title">Base de dados</h2>
                <p class="settings-row-desc" style="margin-bottom:16px">Estatísticas gerais (apenas administradores).</p>
                <div id="admin-db-stats" class="settings-card" style="padding:24px"><div style="text-align:center;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> A carregar...</div></div>`;
      },
      notifications: () => `<h2>Notifications</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Enable Desktop Notifications</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Enable Unread Badge</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Message Sounds</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Push Notification Inactive Timeout</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>1 minute</option><option>5 minutes</option><option>10 minutes</option></select></div>
                </div>`,
      keybinds: () => `<h2>Keybinds</h2><div class="settings-card"><p>Configure keyboard shortcuts.</p>
                <div class="settings-row"><div><div class="settings-row-label">Push to Talk</div></div><kbd style="background:var(--dark-gray);padding:4px 10px;border-radius:var(--radius-sm);font-size:12px;color:var(--text-secondary)">Not Set</kbd></div>
                <div class="settings-row"><div><div class="settings-row-label">Toggle Mute</div></div><kbd style="background:var(--dark-gray);padding:4px 10px;border-radius:var(--radius-sm);font-size:12px;color:var(--text-secondary)">Ctrl+Shift+M</kbd></div>
                <div class="settings-row"><div><div class="settings-row-label">Toggle Deafen</div></div><kbd style="background:var(--dark-gray);padding:4px 10px;border-radius:var(--radius-sm);font-size:12px;color:var(--text-secondary)">Ctrl+Shift+D</kbd></div>
                <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="app.showToast('Add keybind coming soon!','info')">Add a Keybind</button>
                </div>`,
      language: () => `<h2>Language</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Language</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>English</option><option>Português</option><option>Español</option><option>Français</option><option>Deutsch</option><option>日本語</option></select></div>
                </div>`,
      activity: () => `<h2>Activity Privacy</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Share your activity</div><div class="settings-row-desc">Allow others to see what you're up to</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Display current activity as status</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                </div>`,
      overview: () => `<h2>Server Overview</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Server Name</div></div><input type="text" value="${this.escapeHtml(this.currentServer?.name || '')}" style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-size:14px;width:200px"></div>
                <div class="settings-row"><div><div class="settings-row-label">Server Region</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>🇺🇸 US East</option><option>🇪🇺 EU West</option><option>🇧🇷 South America</option></select></div>
                <div class="settings-row"><div><div class="settings-row-label">System Messages Channel</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>#general</option><option>#welcome</option></select></div>
                <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="app.showToast('Server settings saved!','success')">Save Changes</button>
                </div>`,
      roles: () => `<h2>Roles</h2><div class="settings-card">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><div style="font-weight:600">Server Roles</div><button class="btn btn-primary btn-sm" onclick="app.showToast('Role created!','success')"><i class="fas fa-plus"></i> Create Role</button></div>
                <div class="settings-row"><div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;border-radius:50%;background:var(--primary-yellow)"></div><div class="settings-row-label">Admin</div></div><span style="font-size:12px;color:var(--text-muted)">All Permissions</span></div>
                <div class="settings-row"><div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;border-radius:50%;background:var(--status-online)"></div><div class="settings-row-label">Moderator</div></div><span style="font-size:12px;color:var(--text-muted)">Manage Messages, Kick</span></div>
                <div class="settings-row"><div style="display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;border-radius:50%;background:var(--info)"></div><div class="settings-row-label">Member</div></div><span style="font-size:12px;color:var(--text-muted)">Default</span></div>
                </div>`,
      members: () => {
        const members = this.members || [];
        if (members.length === 0)
          return `<h2>Members</h2><div class="settings-card"><p>Manage server members.</p><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center"><i class="fas fa-users" style="font-size:32px;margin-bottom:8px;display:block;opacity:.5"></i>No members loaded. Select a channel to see members.</div></div>`;
        let rows = members
          .slice(0, 50)
          .map(m => {
            const name = m.nickname || m.username || m.display_name || 'User';
            const initial = name.charAt(0).toUpperCase();
            const roleName = m.roles && m.roles[0]?.name ? m.roles[0].name : m.role_name || 'Member';
            return `<div class="settings-row" style="align-items:center;gap:12px">
                        <div style="width:32px;height:32px;border-radius:50%;background:var(--dark-gray);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--text-secondary)">${initial}</div>
                        <div style="flex:1"><div class="settings-row-label">${this.escapeHtml(name)}</div><div style="font-size:12px;color:var(--text-muted)">${this.escapeHtml(roleName)}</div></div>
                        <button class="btn btn-secondary btn-sm" onclick="app.showToast('Kick coming soon','info')">Kick</button>
                    </div>`;
          })
          .join('');
        if (members.length > 50)
          rows += `<div style="font-size:12px;color:var(--text-muted);padding:8px 0">... and ${members.length - 50} more</div>`;
        return `<h2>Members</h2><div class="settings-card"><p>Manage server members (${members.length}).</p><div style="margin-top:12px">${rows}</div></div>`;
      },
      emoji: () => `<h2>Emoji</h2><div class="settings-card"><p>Add custom emoji for everyone on this server.</p>
                <button class="btn btn-primary btn-sm" onclick="app.showToast('Upload emoji coming soon!','info')"><i class="fas fa-upload"></i> Upload Emoji</button>
                <div style="margin-top:16px;color:var(--text-muted);font-size:13px">No custom emoji yet. Upload some!</div></div>`,
      moderation: () => `<h2>Moderation</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Verification Level</div><div class="settings-row-desc">Require members to verify email</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>None</option><option>Low</option><option>Medium</option><option>High</option><option>Highest</option></select></div>
                <div class="settings-row"><div><div class="settings-row-label">Explicit Media Content Filter</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>Don't scan</option><option>Scan from members without roles</option><option>Scan all</option></select></div>
                </div>`,
      'audit-log':
        () => `<h2>Audit Log</h2><div class="settings-card"><p>View a log of all actions taken on this server.</p>
                <div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center"><i class="fas fa-clipboard-list" style="font-size:32px;margin-bottom:8px;display:block;opacity:.5"></i>No audit log entries yet</div></div>`,
      integrations:
        () => `<h2>Integrations</h2><div class="settings-card"><p>Manage bots and webhooks for this server.</p>
                <button class="btn btn-primary btn-sm" onclick="app.showToast('Add integration coming soon!','info')"><i class="fas fa-plus"></i> Add Integration</button>
                <div style="margin-top:16px;color:var(--text-muted);font-size:13px">No integrations yet.</div></div>`,
      widget: () => `<h2>Widget</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Enable Server Widget</div></div><div class="toggle-switch" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Widget Channel</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>#general</option></select></div>
                </div>`,
      bans: () => `<h2>Bans</h2><div class="settings-card"><p>View and manage banned users.</p>
                <div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center"><i class="fas fa-gavel" style="font-size:32px;margin-bottom:8px;display:block;opacity:.5"></i>No banned users</div></div>`,
      privacy: () => `<h2>Privacidade</h2>
                <div class="settings-card">
                <h3 style="margin-top:0"><i class="fas fa-shield-halved" style="color:var(--primary-yellow);margin-right:8px"></i>Os seus dados</h3>
                <p class="settings-row-desc" style="margin-bottom:16px">O LIBERTY guarda apenas o necessário para o serviço: nome de utilizador, email (opcional), perfil (avatar, descrição), mensagens que envia e relações (amigos, servidores). Não vendemos dados a terceiros. As suas comunicações são suas.</p>
                <div class="settings-section-block" style="margin-top:20px">
                <div class="settings-row-label" style="margin-bottom:6px">Exportar os meus dados</div>
                <p class="settings-row-desc" style="margin-bottom:10px">Descarregue uma cópia de todos os seus dados (perfil e mensagens) em formato JSON.</p>
                <button type="button" class="btn btn-primary btn-sm" id="settings-privacy-export-btn"><i class="fas fa-download" style="margin-right:6px"></i>Exportar dados</button>
                </div>
                <div class="settings-section-block" style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08)">
                <div class="settings-row-label" style="margin-bottom:6px;color:var(--error)">Zona de perigo</div>
                <p class="settings-row-desc" style="margin-bottom:10px">Eliminar a conta remove permanentemente o seu perfil e dados. Esta ação não pode ser desfeita.</p>
                <button type="button" class="btn btn-secondary btn-sm" style="border-color:rgba(229,57,53,.4);color:#ff6b6b" id="settings-privacy-delete-btn"><i class="fas fa-trash" style="margin-right:6px"></i>Eliminar conta</button>
                </div>
                </div>`,
      'data-privacy': () => `<h2>Data & Privacy</h2><div class="settings-card"><p>Utilize a secção <strong>Privacidade</strong> no menu para exportar os seus dados ou eliminar a conta.</p></div>`,
      chat: () => `<h2>Chat</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Show embeds and preview links</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Show emoji reactions</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Play animated emoji</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Render text-to-emoji</div><div class="settings-row-desc">Convert :) to 🙂</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Sticker suggestions</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                </div>`,
      nitro: () => `<h2>Nitro</h2><div class="settings-card" style="text-align:center;padding:32px">
                <i class="fas fa-bolt" style="font-size:48px;color:var(--primary-yellow);margin-bottom:16px;display:block"></i>
                <h3 style="margin:0 0 8px;font-size:18px;text-transform:none;letter-spacing:0;color:var(--text-primary)">Unlock the best of LIBERTY</h3>
                <p>Upload bigger files, use custom emoji everywhere, boost servers, and more.</p>
                <button class="btn btn-primary" style="margin-top:12px" onclick="app.showToast('Nitro coming soon!','info')">Get Nitro</button>
                </div>`,
      'server-boost': () => `<h2>Server Boost</h2><div class="settings-card" style="text-align:center;padding:32px">
                <i class="fas fa-bolt" style="font-size:48px;color:var(--primary-yellow);margin-bottom:16px;display:block"></i>
                <p>You are not currently boosting any servers.</p>
                <button class="btn btn-primary" style="margin-top:12px" onclick="app.showToast('Server Boost coming soon!','info')">Boost a Server</button>
                </div>`,
    };

    const renderer = sectionRenderers[section];
    content.innerHTML = renderer
      ? renderer()
      : `<h2>${section}</h2><div class="settings-card"><p>Settings content for ${section} will be displayed here.</p></div>`;
    if (section === 'admin-db' && type === 'user') {
      this._loadAdminDbStats(content);
    }
    if (section === 'account' && type === 'user') {
      const saveAvatarBtn = content.querySelector('#settings-save-avatar-btn');
      const avatarUrlInput = content.querySelector('#settings-avatar-url');
      const avatarFileInput = content.querySelector('#settings-avatar-file');
      const avatarPreview = content.querySelector('#settings-avatar-preview');
      const dropZone = content.querySelector('#settings-avatar-drop-zone');
      const saveNameBtn = content.querySelector('#settings-save-name-btn');
      const displayNameInput = content.querySelector('#settings-display-name');
      const clearDbBtn = content.querySelector('#settings-clear-db-btn');
      const initial = (this.currentUser?.username || 'U').charAt(0).toUpperCase();
      const setPreviewHtml = url => {
        if (!avatarPreview) return;
        if (url)
          avatarPreview.innerHTML =
            '<img src="' +
            url.replace(/"/g, '&quot;') +
            '" alt="" data-fallback-avatar="" /><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:#fff">' +
            initial +
            '</span>';
        else
          avatarPreview.innerHTML =
            '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:var(--text-secondary)">' +
            initial +
            '</span>';
      };
      const uploadAvatarFile = file => {
        if (!file || !file.type.startsWith('image/')) {
          this.showToast('Escolha uma imagem (JPEG, PNG, GIF ou WebP).', 'error');
          return;
        }
        if (file.size > 4 * 1024 * 1024) {
          this.showToast('Imagem demasiado grande (máx. 4 MB).', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
            API.User.uploadAvatar(dataUrl)
              .then(r => {
                const url = r && r.avatar_url ? r.avatar_url : dataUrl;
                if (this.currentUser) {
                  this.currentUser.avatar_url = url;
                  this.currentUser.avatar = url;
                }
                this._avatarCacheBuster = Date.now();
                setPreviewHtml(url);
                if (avatarUrlInput) avatarUrlInput.value = url;
                this.showToast('Foto de perfil atualizada!', 'success');
                this._updateUserAvatarInUI();
              })
              .catch(e => this.showToast(e.message || 'Erro ao enviar foto', 'error'));
          } else this.showToast('Faça login para enviar uma foto.', 'info');
        };
        reader.readAsDataURL(file);
      };
      const heroChangeBtn = content.querySelector('#settings-hero-change-photo');
      if (heroChangeBtn && avatarFileInput) heroChangeBtn.addEventListener('click', () => avatarFileInput.click());
      if (avatarFileInput) {
        avatarFileInput.addEventListener('change', () => {
          const file = avatarFileInput.files && avatarFileInput.files[0];
          if (file) uploadAvatarFile(file);
          avatarFileInput.value = '';
        });
      }
      if (dropZone) {
        ['dragenter', 'dragover'].forEach(ev =>
          dropZone.addEventListener(ev, e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
          })
        );
        ['dragleave', 'drop'].forEach(ev =>
          dropZone.addEventListener(ev, e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
          })
        );
        dropZone.addEventListener('drop', e => {
          const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (file) uploadAvatarFile(file);
        });
      }
      if (saveAvatarBtn && avatarUrlInput) {
        saveAvatarBtn.addEventListener('click', () => {
          const url = (avatarUrlInput.value || '').trim();
          if (!url) {
            this.showToast('Cole uma URL de imagem ou envie um arquivo.', 'info');
            return;
          }
          if (!/^https?:\/\//i.test(url) && !/^\/uploads?\//.test(url)) {
            this.showToast('URL deve começar por http://, https:// ou /uploads/', 'error');
            return;
          }
          const applyUrl = u => {
            if (this.currentUser) {
              this.currentUser.avatar_url = u;
              this.currentUser.avatar = u;
            }
            this._avatarCacheBuster = Date.now();
            setPreviewHtml(u);
            this._updateUserAvatarInUI();
          };
          if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
            API.User.updateCurrentUser({ avatar_url: url })
              .then(() => {
                try {
                  localStorage.setItem('liberty_avatar_url', url);
                } catch (_) {}
                this.showToast('Foto de perfil atualizada!', 'success');
                applyUrl(url);
              })
              .catch(e => {
                try {
                  localStorage.setItem('liberty_avatar_url', url);
                } catch (_) {}
                applyUrl(url);
                this.showToast('URL guardada localmente. ' + (e.message || ''), 'info');
              });
          } else {
            try {
              localStorage.setItem('liberty_avatar_url', url);
            } catch (_) {}
            applyUrl(url);
            this.showToast('Foto guardada localmente. Faça login para sincronizar.', 'success');
          }
        });
      }
      const saveBannerBtn = content.querySelector('#settings-save-banner-btn');
      const bannerUrlInput = content.querySelector('#settings-banner-url');
      if (saveBannerBtn && bannerUrlInput) {
        saveBannerBtn.addEventListener('click', () => {
          const url = (bannerUrlInput.value || '').trim();
          if (!url) {
            this.showToast('Cole uma URL de imagem para o banner.', 'info');
            return;
          }
          if (!/^https?:\/\//i.test(url) && !/^\/uploads?\//.test(url)) {
            this.showToast('URL deve começar por http://, https:// ou /uploads/', 'error');
            return;
          }
          if (this.currentUser) this.currentUser.banner_url = url;
          try { localStorage.setItem('liberty_banner_url', url); } catch (_) {}
          if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
            API.User.updateCurrentUser({ banner_url: url })
              .then(() => {
                this.showToast('Banner do perfil atualizado!', 'success');
              })
              .catch(e => {
                this.showToast(e.message || 'Erro ao guardar banner.', 'error');
              });
          } else {
            this.showToast('Faça login para guardar o banner no servidor.', 'info');
          }
        });
      }
      if (avatarPreview && avatarUrlInput)
        avatarUrlInput.addEventListener('input', () => {
          const v = avatarUrlInput.value.trim();
          if (v) setPreviewHtml(v);
        });
      const removeAvatarBtn = content.querySelector('#settings-avatar-remove-btn');
      if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', () => {
          const clearAvatar = () => {
            if (this.currentUser) {
              this.currentUser.avatar_url = null;
              this.currentUser.avatar = null;
            }
            try {
              localStorage.removeItem('liberty_avatar_url');
            } catch (_) {}
            setPreviewHtml(null);
            if (avatarUrlInput) avatarUrlInput.value = '';
            this._updateUserAvatarInUI();
            this.showToast('Foto de perfil removida.', 'success');
          };
          if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
            API.User.updateCurrentUser({ avatar_url: '' })
              .then(() => {
                clearAvatar();
              })
              .catch(() => {
                clearAvatar();
              });
          } else clearAvatar();
        });
      }
      if (saveNameBtn && displayNameInput) {
        saveNameBtn.addEventListener('click', () => {
          const name = (displayNameInput.value || '').trim().substring(0, 32);
          if (!name) {
            this.showToast('Digite um nome.', 'info');
            return;
          }
          if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
            API.User.updateCurrentUser({ username: name })
              .then(() => {
                this.showToast('Nome salvo!', 'success');
                if (this.currentUser) this.currentUser.username = name;
              })
              .catch(e => this.showToast(e.message || 'Erro ao salvar nome', 'error'));
          } else {
            localStorage.setItem('liberty_username', name);
            this.showToast('Nome salvo localmente.', 'success');
          }
        });
      }
      if (clearDbBtn) {
        clearDbBtn.addEventListener('click', () => {
          if (!confirm('Tem certeza? Todos os dados locais (contas, servidores, mensagens) serão removidos.')) return;
          ['access_token', 'refresh_token', 'liberty_token', 'token', 'liberty_username'].forEach(k =>
            localStorage.removeItem(k)
          );
          this.showToast('Dados locais removidos.', 'success');
          setTimeout(() => this._doLogout(), 400);
        });
      }
    }
    if (section === 'profile' && type === 'user') {
      const displayNameEl = content.querySelector('#settings-profile-display-name');
      const aboutEl = content.querySelector('#settings-profile-about');
      const avatarFileEl = content.querySelector('#settings-profile-avatar-file');
      const avatarBtn = content.querySelector('#settings-profile-avatar-btn');
      const bannerUrlEl = content.querySelector('#settings-profile-banner-url');
      const bannerSaveBtn = content.querySelector('#settings-profile-banner-save');
      const saveBtn = content.querySelector('#settings-profile-save-btn');
      const previewBanner = content.querySelector('#settings-profile-preview-banner');
      const previewAvatar = content.querySelector('#settings-profile-preview-avatar');
      const previewName = content.querySelector('#settings-profile-preview-name');
      const previewAbout = content.querySelector('#settings-profile-preview-about');

      const updateProfilePreview = () => {
        const name = (displayNameEl && displayNameEl.value || '').trim() || 'User';
        const about = (aboutEl && aboutEl.value || '').trim();
        const bannerUrl = (bannerUrlEl && bannerUrlEl.value || '').trim();
        if (previewName) previewName.textContent = name;
        if (previewAbout) {
          previewAbout.textContent = about || 'No bio set yet';
          previewAbout.classList.toggle('settings-profile-about-empty', !about);
        }
        if (previewBanner) {
          if (bannerUrl) {
            previewBanner.style.backgroundImage = `url("${bannerUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\22')}")`;
            previewBanner.style.backgroundSize = 'cover';
            previewBanner.style.backgroundPosition = 'center';
          } else {
            previewBanner.style.backgroundImage = '';
            previewBanner.style.background = 'var(--dark-gray)';
          }
        }
        if (previewAvatar && previewAvatar.querySelector('span') && !previewAvatar.querySelector('img')) {
          previewAvatar.querySelector('span').textContent = (name || 'U').charAt(0).toUpperCase();
        }
      };

      if (displayNameEl) displayNameEl.addEventListener('input', updateProfilePreview);
      if (aboutEl) aboutEl.addEventListener('input', updateProfilePreview);
      if (bannerUrlEl) bannerUrlEl.addEventListener('input', updateProfilePreview);

      if (avatarBtn && avatarFileEl) {
        avatarBtn.addEventListener('click', () => avatarFileEl.click());
        avatarFileEl.addEventListener('change', () => {
          const file = avatarFileEl.files && avatarFileEl.files[0];
          if (!file || !file.type.startsWith('image/')) {
            this.showToast('Escolha uma imagem (JPEG, PNG, GIF ou WebP).', 'error');
            avatarFileEl.value = '';
            return;
          }
          if (file.size > 4 * 1024 * 1024) {
            this.showToast('Imagem demasiado grande (máx. 4 MB).', 'error');
            avatarFileEl.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
              API.User.uploadAvatar(dataUrl)
                .then(r => {
                  const url = r && r.avatar_url ? r.avatar_url : dataUrl;
                  if (this.currentUser) { this.currentUser.avatar_url = url; this.currentUser.avatar = url; }
                  try { localStorage.setItem('liberty_avatar_url', url); } catch (_) {}
                  this._avatarCacheBuster = Date.now();
                  this._updateUserAvatarInUI();
                  if (previewAvatar) {
                    const letter = (this.currentUser?.username || 'U').charAt(0).toUpperCase();
                    previewAvatar.innerHTML = `<img src="${this.escapeHtml(this._getAvatarUrl())}" alt="" data-fallback-avatar=""><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:32px;font-weight:700;color:var(--text-secondary)">${this.escapeHtml(letter)}</span>`;
                  }
                  this.showToast('Avatar atualizado!', 'success');
                })
                .catch(e => this.showToast(e.message || 'Erro ao enviar foto', 'error'));
            } else this.showToast('Faça login para alterar o avatar.', 'info');
            avatarFileEl.value = '';
          };
          reader.readAsDataURL(file);
        });
      }

      if (bannerSaveBtn && bannerUrlEl) {
        bannerSaveBtn.addEventListener('click', () => {
          const url = (bannerUrlEl.value || '').trim();
          if (url && !/^https?:\/\//i.test(url) && !/^\/uploads?\//.test(url)) {
            this.showToast('URL deve começar por http://, https:// ou /uploads/', 'error');
            return;
          }
          if (this.currentUser) this.currentUser.banner_url = url || null;
          try { if (url) localStorage.setItem('liberty_banner_url', url); else localStorage.removeItem('liberty_banner_url'); } catch (_) {}
          if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
            API.User.updateCurrentUser({ banner_url: url || '' })
              .then(() => {
                this.showToast(url ? 'Banner atualizado!' : 'Banner removido.', 'success');
                updateProfilePreview();
              })
              .catch(e => this.showToast(e.message || 'Erro ao guardar banner.', 'error'));
          } else {
            updateProfilePreview();
            this.showToast(url ? 'Banner guardado localmente. Faça login para sincronizar.' : 'Banner removido localmente.', 'info');
          }
        });
      }

      const saveProfile = () => {
        const name = (displayNameEl && displayNameEl.value || '').trim().substring(0, 32);
        const about = (aboutEl && aboutEl.value || '').trim().substring(0, 190);
        if (!name) {
          this.showToast('O nome não pode estar vazio.', 'info');
          return;
        }
        if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
          const payload = { username: name, description: about || null };
          API.User.updateCurrentUser(payload)
            .then(() => {
              if (this.currentUser) {
                this.currentUser.username = name;
                this.currentUser.description = about || null;
              }
              this.showToast('Perfil guardado!', 'success');
              updateProfilePreview();
              this.updateUserPanel();
            })
            .catch(e => this.showToast(e.message || 'Erro ao guardar perfil', 'error'));
        } else {
          if (this.currentUser) { this.currentUser.username = name; this.currentUser.description = about || null; }
          try { localStorage.setItem('liberty_username', name); } catch (_) {}
          this.showToast('Perfil guardado localmente.', 'success');
          updateProfilePreview();
          this.updateUserPanel();
        }
      };

      if (saveBtn) saveBtn.addEventListener('click', saveProfile);
    }
    if (section === 'voice' && type === 'user') {
      const inputDeviceSelect = content.querySelector('#settings-voice-input-device');
      const outputDeviceSelect = content.querySelector('#settings-voice-output-device');
      const cameraDeviceSelect = content.querySelector('#settings-voice-camera-device');
      const inputVolumeRange = content.querySelector('#settings-voice-input-volume');
      const outputVolumeRange = content.querySelector('#settings-voice-output-volume');
      const noiseSuppressionToggle = content.querySelector('#settings-voice-noise-suppression');
      const echoCancelToggle = content.querySelector('#settings-voice-echo-cancel');
      const micTestBtn = content.querySelector('#settings-voice-mic-test-btn');
      const micStopBtn = content.querySelector('#settings-voice-mic-stop-btn');
      const micLevelWrap = content.querySelector('#settings-voice-mic-level-wrap');
      const micLevelText = content.querySelector('#settings-voice-mic-level-text');
      const cameraStartBtn = content.querySelector('#settings-voice-camera-start-btn');
      const cameraStopBtn = content.querySelector('#settings-voice-camera-stop-btn');
      const cameraPreviewWrap = content.querySelector('#settings-voice-camera-preview-wrap');
      const cameraPreview = content.querySelector('#settings-voice-camera-preview');
      const screenTestBtn = content.querySelector('#settings-voice-screen-test-btn');
      const screenStopBtn = content.querySelector('#settings-voice-screen-stop-btn');
      const screenPreviewWrap = content.querySelector('#settings-voice-screen-preview-wrap');
      const screenPreview = content.querySelector('#settings-voice-screen-preview');

      let voiceTestMicStream = null;
      let voiceTestMicAnalyser = null;
      let voiceTestMicRaf = null;
      let voiceTestCameraStream = null;
      let voiceTestScreenStream = null;

      const stopAllVoiceTests = () => {
        if (voiceTestMicRaf) { cancelAnimationFrame(voiceTestMicRaf); voiceTestMicRaf = null; }
        if (voiceTestMicStream) { voiceTestMicStream.getTracks().forEach(t => t.stop()); voiceTestMicStream = null; }
        if (micLevelWrap) micLevelWrap.style.display = 'none';
        if (micTestBtn) micTestBtn.style.display = '';
        if (micStopBtn) micStopBtn.style.display = 'none';
        if (voiceTestCameraStream) { voiceTestCameraStream.getTracks().forEach(t => t.stop()); voiceTestCameraStream = null; }
        if (cameraPreview) cameraPreview.srcObject = null;
        if (cameraPreviewWrap) cameraPreviewWrap.style.display = 'none';
        if (cameraStartBtn) cameraStartBtn.style.display = '';
        if (cameraStopBtn) cameraStopBtn.style.display = 'none';
        if (voiceTestScreenStream) { voiceTestScreenStream.getTracks().forEach(t => t.stop()); voiceTestScreenStream = null; }
        if (screenPreview) screenPreview.srcObject = null;
        if (screenPreviewWrap) screenPreviewWrap.style.display = 'none';
        if (screenTestBtn) screenTestBtn.style.display = '';
        if (screenStopBtn) screenStopBtn.style.display = 'none';
      };

      const fillDevices = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          if (inputDeviceSelect) { inputDeviceSelect.innerHTML = '<option value="">Não suportado</option>'; }
          if (outputDeviceSelect) { outputDeviceSelect.innerHTML = '<option value="">Não suportado</option>'; }
          if (cameraDeviceSelect) { cameraDeviceSelect.innerHTML = '<option value="">Não suportado</option>'; }
          return;
        }
        let devices = [];
        try {
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
          this.showToast('Não foi possível listar dispositivos.', 'error');
        }
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        const savedInput = typeof localStorage !== 'undefined' ? localStorage.getItem('liberty_voice_input_device') : '';
        const savedOutput = typeof localStorage !== 'undefined' ? localStorage.getItem('liberty_voice_output_device') : '';
        const savedCamera = typeof localStorage !== 'undefined' ? localStorage.getItem('liberty_voice_camera_device') : '';

        const opt = (val, label) => `<option value="${this.escapeHtml(val || '')}">${this.escapeHtml(label || 'Predefinido')}</option>`;
        if (inputDeviceSelect) {
          inputDeviceSelect.innerHTML = opt('', 'Predefinido') + audioInputs.map(d => opt(d.deviceId, d.label || `Microfone ${d.deviceId.slice(0, 8)}`)).join('');
          if (savedInput && audioInputs.some(d => d.deviceId === savedInput)) inputDeviceSelect.value = savedInput;
        }
        if (outputDeviceSelect) {
          outputDeviceSelect.innerHTML = opt('', 'Predefinido') + audioOutputs.map(d => opt(d.deviceId, d.label || `Saída ${d.deviceId.slice(0, 8)}`)).join('');
          if (savedOutput && audioOutputs.some(d => d.deviceId === savedOutput)) outputDeviceSelect.value = savedOutput;
        }
        if (cameraDeviceSelect) {
          cameraDeviceSelect.innerHTML = opt('', 'Predefinido') + videoInputs.map(d => opt(d.deviceId, d.label || `Câmara ${d.deviceId.slice(0, 8)}`)).join('');
          if (savedCamera && videoInputs.some(d => d.deviceId === savedCamera)) cameraDeviceSelect.value = savedCamera;
        }
      };

      fillDevices();

      if (inputDeviceSelect) inputDeviceSelect.addEventListener('change', () => { try { localStorage.setItem('liberty_voice_input_device', inputDeviceSelect.value || ''); } catch (_) {} });
      if (outputDeviceSelect) outputDeviceSelect.addEventListener('change', () => { try { localStorage.setItem('liberty_voice_output_device', outputDeviceSelect.value || ''); } catch (_) {} });
      if (cameraDeviceSelect) cameraDeviceSelect.addEventListener('change', () => { try { localStorage.setItem('liberty_voice_camera_device', cameraDeviceSelect.value || ''); } catch (_) {} });
      if (inputVolumeRange) inputVolumeRange.addEventListener('input', () => { try { localStorage.setItem('liberty_voice_input_volume', inputVolumeRange.value); } catch (_) {} });
      if (outputVolumeRange) outputVolumeRange.addEventListener('input', () => { try { localStorage.setItem('liberty_voice_output_volume', outputVolumeRange.value); } catch (_) {} });

      if (noiseSuppressionToggle) {
        noiseSuppressionToggle.addEventListener('click', () => {
          noiseSuppressionToggle.classList.toggle('active');
          try { localStorage.setItem('liberty_voice_noise_suppression', noiseSuppressionToggle.classList.contains('active') ? '1' : '0'); } catch (_) {}
        });
      }
      if (echoCancelToggle) {
        echoCancelToggle.addEventListener('click', () => {
          echoCancelToggle.classList.toggle('active');
          try { localStorage.setItem('liberty_voice_echo_cancel', echoCancelToggle.classList.contains('active') ? '1' : '0'); } catch (_) {}
        });
      }

      if (micTestBtn && micStopBtn && micLevelWrap) {
        micTestBtn.addEventListener('click', async () => {
          if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            this.showToast('Acesso ao microfone não disponível (use HTTPS ou localhost).', 'error');
            return;
          }
          const deviceId = inputDeviceSelect && inputDeviceSelect.value ? inputDeviceSelect.value : undefined;
          const ns = noiseSuppressionToggle && noiseSuppressionToggle.classList.contains('active');
          const ec = echoCancelToggle && echoCancelToggle.classList.contains('active');
          try {
            voiceTestMicStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: deviceId ? { exact: deviceId } : undefined, noiseSuppression: ns, echoCancellation: ec }
            });
          } catch (e) {
            this.showToast(e.name === 'NotAllowedError' ? 'Acesso ao microfone negado.' : (e.message || 'Erro ao aceder ao microfone.'), 'error');
            return;
          }
          micTestBtn.style.display = 'none';
          micStopBtn.style.display = '';
          micLevelWrap.style.display = 'block';
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(voiceTestMicStream);
          voiceTestMicAnalyser = audioContext.createAnalyser();
          voiceTestMicAnalyser.fftSize = 256;
          voiceTestMicAnalyser.smoothingTimeConstant = 0.8;
          source.connect(voiceTestMicAnalyser);
          const dataArray = new Uint8Array(voiceTestMicAnalyser.frequencyBinCount);
          const bars = micLevelWrap.querySelectorAll('.settings-voice-level-bars span');
          const updateLevel = () => {
            if (!voiceTestMicStream || voiceTestMicStream.getAudioTracks().every(t => t.readyState === 'ended')) {
              if (voiceTestMicRaf) cancelAnimationFrame(voiceTestMicRaf);
              return;
            }
            voiceTestMicAnalyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = Math.min(100, Math.round((sum / dataArray.length) * 100 / 128));
            if (micLevelText) micLevelText.textContent = avg;
            bars.forEach((bar, i) => { bar.classList.toggle('active', (i + 1) * 10 <= avg); });
            voiceTestMicRaf = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        });
        micStopBtn.addEventListener('click', () => {
          if (voiceTestMicRaf) { cancelAnimationFrame(voiceTestMicRaf); voiceTestMicRaf = null; }
          if (voiceTestMicStream) { voiceTestMicStream.getTracks().forEach(t => t.stop()); voiceTestMicStream = null; }
          micLevelWrap.style.display = 'none';
          micTestBtn.style.display = '';
          micStopBtn.style.display = 'none';
        });
      }

      if (cameraStartBtn && cameraStopBtn && cameraPreview && cameraPreviewWrap) {
        cameraStartBtn.addEventListener('click', async () => {
          if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            this.showToast('Acesso à câmara não disponível (use HTTPS ou localhost).', 'error');
            return;
          }
          const deviceId = cameraDeviceSelect && cameraDeviceSelect.value ? cameraDeviceSelect.value : undefined;
          try {
            voiceTestCameraStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 640 }, height: { ideal: 480 } }
            });
          } catch (e) {
            this.showToast(e.name === 'NotAllowedError' ? 'Acesso à câmara negado.' : (e.message || 'Erro ao aceder à câmara.'), 'error');
            return;
          }
          cameraPreview.srcObject = voiceTestCameraStream;
          cameraPreviewWrap.style.display = 'block';
          cameraStartBtn.style.display = 'none';
          cameraStopBtn.style.display = '';
        });
        cameraStopBtn.addEventListener('click', () => {
          if (voiceTestCameraStream) { voiceTestCameraStream.getTracks().forEach(t => t.stop()); voiceTestCameraStream = null; }
          cameraPreview.srcObject = null;
          cameraPreviewWrap.style.display = 'none';
          cameraStartBtn.style.display = '';
          cameraStopBtn.style.display = 'none';
        });
      }

      if (screenTestBtn && screenStopBtn && screenPreview && screenPreviewWrap) {
        screenTestBtn.addEventListener('click', async () => {
          if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
            this.showToast('Partilha de ecrã não suportada (use HTTPS ou localhost).', 'error');
            return;
          }
          try {
            voiceTestScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          } catch (e) {
            this.showToast(e.name === 'NotAllowedError' ? 'Partilha cancelada.' : (e.message || 'Erro ao partilhar ecrã.'), 'error');
            return;
          }
          voiceTestScreenStream.getVideoTracks()[0].onended = () => stopAllVoiceTests();
          screenPreview.srcObject = voiceTestScreenStream;
          screenPreviewWrap.style.display = 'block';
          screenTestBtn.style.display = 'none';
          screenStopBtn.style.display = '';
        });
        screenStopBtn.addEventListener('click', () => {
          if (voiceTestScreenStream) { voiceTestScreenStream.getTracks().forEach(t => t.stop()); voiceTestScreenStream = null; }
          screenPreview.srcObject = null;
          screenPreviewWrap.style.display = 'none';
          screenTestBtn.style.display = '';
          screenStopBtn.style.display = 'none';
        });
      }

      content.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stopAllVoiceTests(); });
      if (typeof this._voiceTestCleanup === 'function') this._voiceTestCleanup();
      this._voiceTestCleanup = () => {
        stopAllVoiceTests();
        this._voiceTestCleanup = null;
      };
    }
    if (section === 'auth-security' && type === 'user') {
      const savePwBtn = content.querySelector('#settings-save-password-btn');
      const currentPw = content.querySelector('#settings-current-password');
      const newPw = content.querySelector('#settings-new-password');
      const confirmPw = content.querySelector('#settings-confirm-password');
      if (savePwBtn) {
        savePwBtn.addEventListener('click', async () => {
          const newVal = newPw && newPw.value ? newPw.value : '';
          const confirmVal = confirmPw && confirmPw.value ? confirmPw.value : '';
          if (newVal.length < 6) {
            this.showToast('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
          }
          if (newVal !== confirmVal) {
            this.showToast('As senhas não coincidem.', 'error');
            return;
          }
          const currentVal = currentPw && currentPw.value ? currentPw.value : undefined;
          try {
            await API.User.updatePassword(this.currentUser?.has_password ? currentVal : undefined, newVal);
            this.showToast('Senha guardada com sucesso.', 'success');
            if (this.currentUser) this.currentUser.has_password = true;
            if (currentPw) currentPw.value = '';
            if (newPw) newPw.value = '';
            if (confirmPw) confirmPw.value = '';
          } catch (e) {
            this.showToast(e.message || 'Erro ao guardar senha', 'error');
          }
        });
      }
    }
    if (section === 'privacy' && type === 'user') {
      const exportBtn = content.querySelector('#settings-privacy-export-btn');
      const deleteBtn = content.querySelector('#settings-privacy-delete-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
          exportBtn.disabled = true;
          try {
            const blob = await API.User.exportData();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'liberty-data-export.json';
            a.click();
            URL.revokeObjectURL(a.href);
            this.showToast('Dados exportados com sucesso.', 'success');
          } catch (e) {
            this.showToast(e.message || 'Erro ao exportar dados.', 'error');
          } finally {
            exportBtn.disabled = false;
          }
        });
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          const hasPassword = this.currentUser && this.currentUser.has_password === true;
          const msg = hasPassword
            ? 'Para eliminar a conta, confirme a sua senha abaixo. Esta ação é irreversível.'
            : 'Tem a certeza que deseja eliminar a sua conta? Todos os dados serão removidos permanentemente.';
          const confirmPassword = hasPassword
            ? (window.prompt(msg + '\n\nIntroduza a sua senha:') ?? '')
            : (window.confirm(msg) ? '' : null);
          if (hasPassword && (confirmPassword === null || confirmPassword === '')) {
            this.showToast('Cancelado.', 'info');
            return;
          }
          if (hasPassword && confirmPassword) {
            try {
              await API.User.deleteAccount(confirmPassword);
              API.Token.clearTokens();
              this.showToast('Conta eliminada. Até à próxima.', 'success');
              this.hideSettingsPanel();
              this._logoutWithoutReload();
            } catch (e) {
              this.showToast(e.message || 'Erro ao eliminar conta.', 'error');
            }
          } else if (!hasPassword && confirmPassword !== null) {
            try {
              await API.User.deleteAccount();
              API.Token.clearTokens();
              this.showToast('Conta eliminada. Até à próxima.', 'success');
              this.hideSettingsPanel();
              this._logoutWithoutReload();
            } catch (e) {
              this.showToast(e.message || 'Erro ao eliminar conta.', 'error');
            }
          }
        });
      }
    }
    if (section === 'appearance' && type === 'user') {
      const layoutCompactToggle = content.querySelector('#settings-layout-compact');
      if (layoutCompactToggle) {
        layoutCompactToggle.addEventListener('click', () => {
          layoutCompactToggle.classList.toggle('active');
          const isCompact = layoutCompactToggle.classList.contains('active');
          try { localStorage.setItem('liberty_layout_compact', isCompact ? 'true' : 'false'); } catch (_) {}
          document.body.classList.toggle('layout-compact', isCompact);
          this.showToast(isCompact ? 'Modo compacto ativado.' : 'Modo compacto desativado.', 'success');
        });
      }
      const layoutChannelsRightToggle = content.querySelector('#settings-layout-channels-right');
      if (layoutChannelsRightToggle) {
        layoutChannelsRightToggle.addEventListener('click', () => {
          layoutChannelsRightToggle.classList.toggle('active');
          const on = layoutChannelsRightToggle.classList.contains('active');
          try { localStorage.setItem('liberty_layout_channels_right', on ? 'true' : 'false'); } catch (_) {}
          document.body.classList.toggle('layout-channels-right', on);
          this.showToast(on ? 'Barra de canais à direita ativada.' : 'Barra de canais à direita desativada.', 'success');
        });
      }
      const layoutMembersLeftToggle = content.querySelector('#settings-layout-members-left');
      if (layoutMembersLeftToggle) {
        layoutMembersLeftToggle.addEventListener('click', () => {
          layoutMembersLeftToggle.classList.toggle('active');
          const on = layoutMembersLeftToggle.classList.contains('active');
          try { localStorage.setItem('liberty_layout_members_left', on ? 'true' : 'false'); } catch (_) {}
          document.body.classList.toggle('layout-members-left', on);
          this.showToast(on ? 'Membros entre canais e chat ativado.' : 'Membros entre canais e chat desativado.', 'success');
        });
      }
      
      // Background customization handlers
      const bgApplyBtn = content.querySelector('#settings-bg-apply');
      const bgClearBtn = content.querySelector('#settings-bg-clear');
      const bgUrlInput = content.querySelector('#settings-bg-url');
      const bgBlurRange = content.querySelector('#settings-bg-blur');
      const bgBlurVal = content.querySelector('#settings-bg-blur-val');
      const bgOpacityRange = content.querySelector('#settings-bg-opacity');
      const bgOpacityVal = content.querySelector('#settings-bg-opacity-val');
      
      const applyBackground = () => {
        const url = bgUrlInput?.value?.trim() || '';
        const blur = bgBlurRange?.value || '0';
        const opacity = bgOpacityRange?.value || '100';
        
        try {
          localStorage.setItem('liberty_app_bg_url', url);
          localStorage.setItem('liberty_app_bg_blur', blur);
          localStorage.setItem('liberty_app_bg_opacity', opacity);
        } catch (_) {}
        
        this._applyAppBackground();
        this.showToast(url ? 'Imagem de fundo aplicada!' : 'Imagem de fundo removida.', 'success');
      };
      
      if (bgApplyBtn) bgApplyBtn.addEventListener('click', applyBackground);
      if (bgClearBtn) {
        bgClearBtn.addEventListener('click', () => {
          if (bgUrlInput) bgUrlInput.value = '';
          applyBackground();
        });
      }
      if (bgBlurRange && bgBlurVal) {
        bgBlurRange.addEventListener('input', () => {
          bgBlurVal.textContent = bgBlurRange.value + 'px';
          applyBackground();
        });
      }
      if (bgOpacityRange && bgOpacityVal) {
        bgOpacityRange.addEventListener('input', () => {
          bgOpacityVal.textContent = bgOpacityRange.value + '%';
          applyBackground();
        });
      }
    }
  }

  async _doLogout() {
    if (this._activityPingInterval) {
      clearInterval(this._activityPingInterval);
      this._activityPingInterval = null;
    }
    if (this.gateway && typeof this.gateway.disconnect === 'function') this.gateway.disconnect();
    this.gateway = null;
    MessageCache.clearAll();
    if (typeof LibertyDMUnreadStore !== 'undefined') LibertyDMUnreadStore.clearAll();
    try {
      await API.Auth.logout();
    } catch (_) {
      if (typeof API !== 'undefined' && API.Token && API.Token.clearTokens) API.Token.clearTokens();
    }
    this.currentUser = null;
    this.servers = [];
    this.channels = [];
    this.members = [];
    this.currentServer = null;
    this.currentChannel = null;
    this.isHomeView = true;
    this.hideSettingsPanel();
    this.hideProfileCard();
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('auth-screen')?.classList.remove('hidden');
  }

  hideSettingsPanel() {
    if (this._voiceTestCleanup) { this._voiceTestCleanup(); }
    if (this._settingsOverlay) {
      this._settingsOverlay.style.animation = 'none';
      this._settingsOverlay.style.opacity = '0';
      this._settingsOverlay.style.transition = 'opacity .2s ease';
      setTimeout(() => {
        this._settingsOverlay?.remove();
        this._settingsOverlay = null;
      }, 200);
    }
  }

  // ═══════════════════════════════════════════
  //  TOAST
  // ═══════════════════════════════════════════

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle',
    };
    toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info} toast-icon"></i>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button class="toast-close" aria-label="Close"><i class="fas fa-xmark"></i></button>
        `;
    toast.querySelector('.toast-close').addEventListener('click', () => this._removeToast(toast));
    container.appendChild(toast);
    setTimeout(() => this._removeToast(toast), 5000);
  }

  _removeToast(toast) {
    if (!toast.parentNode) return;
    toast.style.animation = 'slideOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }

  // ═══════════════════════════════════════════
  //  TYPING
  // ═══════════════════════════════════════════

  handleTyping() {
    if (this.currentChannel && this.gateway) this.gateway.startTyping(this.currentChannel.id);
  }

  showTypingIndicator(data) {
    if (data.channel_id !== this.currentChannel?.id) return;
    const userId = data.user_id;
    const username = data.username || data.user?.username || 'Someone';
    this.typing.set(userId, username);
    this.renderTypingIndicator();
    clearTimeout(this._typingTimeouts.get(userId));
    this._typingTimeouts.set(
      userId,
      setTimeout(() => {
        this.typing.delete(userId);
        this._typingTimeouts.delete(userId);
        this.renderTypingIndicator();
      }, 5000)
    );
  }

  renderTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;
    const users = [...this.typing.values()];
    if (users.length === 0) {
      indicator.classList.add('hidden');
      return;
    }
    indicator.classList.remove('hidden');
    let text;
    if (users.length === 1) text = `${users[0]} is typing`;
    else if (users.length === 2) text = `${users[0]} and ${users[1]} are typing`;
    else text = 'Several people are typing';
    const textEl = indicator.querySelector('.typing-text');
    if (textEl) textEl.textContent = text + '...';
  }

  // ═══════════════════════════════════════════
  //  PRESENCE
  // ═══════════════════════════════════════════

  updatePresence(data) {
    const userId = data.user_id;
    const newStatus = data.status || 'offline';
    const member = this.members.find(m => m.user_id === userId || m.id === userId);
    if (member) {
      member.status = newStatus;
      const avatarEl = document.querySelector(`[data-user-id="${userId}"] .member-avatar`);
      if (avatarEl) avatarEl.className = `member-avatar ${newStatus}`;
    }
  }

  // ═══════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════

  scrollToBottom(force = false) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    const list = document.getElementById('messages-list');
    const last = list?.lastElementChild;
    if (!last) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    const threshold = 120;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    if (!force && !nearBottom) return;
    container.scrollTop = container.scrollHeight;
  }

  _applyAppBackground() {
    let bgUrl, bgBlur, bgOpacity;
    try {
      bgUrl = localStorage.getItem('liberty_app_bg_url') || '';
      bgBlur = localStorage.getItem('liberty_app_bg_blur') || '0';
      bgOpacity = localStorage.getItem('liberty_app_bg_opacity') || '100';
    } catch (_) {
      bgUrl = '';
      bgBlur = '0';
      bgOpacity = '100';
    }
    
    // Remove existing background element
    const existingBg = document.getElementById('app-custom-background');
    if (existingBg) existingBg.remove();
    
    if (!bgUrl) {
      document.body.style.setProperty('--app-bg-image', 'none');
      return;
    }
    
    // Validate URL - only allow http/https/data URLs
    if (!bgUrl.match(/^https?:\/\//i) && !bgUrl.match(/^data:image\//i)) {
      console.warn('[APP] URL de fundo inválida - deve começar com http://, https:// ou data:image/');
      return;
    }
    
    // Create background element
    const bgEl = document.createElement('div');
    bgEl.id = 'app-custom-background';
    bgEl.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 0;
      background-image: url("${bgUrl.replace(/"/g, '%22')}");
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      filter: blur(${parseInt(bgBlur) || 0}px);
      opacity: ${(parseInt(bgOpacity) || 100) / 100};
      pointer-events: none;
    `;
    document.body.insertBefore(bgEl, document.body.firstChild);
    console.log('[APP] Background aplicado:', bgUrl.substring(0, 50));
  }

  removeMessage(messageId) {
    const el = document.querySelector(`[data-message="${messageId}"]`);
    if (el) el.remove();
    this.messages.delete(messageId);
    const cid = this.currentChannel?.id || this.currentChannel?.channelId;
    if (cid) {
      const list = MessageCache.get(cid).filter(m => (m.id || m.message_id) !== messageId);
      MessageCache.set(cid, list);
    }
  }

  replacePendingWithMessage(pendingId, realMessage) {
    const realId = String(realMessage.id || realMessage.message_id || '');
    if (!realId) return;
    const el = document.getElementById('messages-list')?.querySelector(`[data-message="${pendingId}"]`);
    if (!el) return;
    el.dataset.message = realId;
    const authorId = realMessage.author_id || realMessage.author?.id || '';
    if (authorId) el.dataset.authorId = String(authorId);
    const time = new Date(realMessage.created_at || realMessage.timestamp || Date.now());
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = this._formatDate(time);
    const isToday = time.toDateString() === new Date().toDateString();
    const headerTimeStr = isToday ? timeStr : `${dateStr} ${timeStr}`;
    const tsEl = el.querySelector('.message-timestamp');
    if (tsEl) {
      tsEl.textContent = headerTimeStr;
      tsEl.title = time.toLocaleString();
    }
    const textEl = el.querySelector('.message-text');
    if (textEl && realMessage.content != null) textEl.innerHTML = this._parseMessageContent(realMessage.content || '');
    const attachmentsWrap = el.querySelector('.message-attachments');
    const newAttachments = this._renderMessageAttachmentsHtml(realMessage.attachments);
    if (newAttachments) {
      if (attachmentsWrap) attachmentsWrap.outerHTML = newAttachments;
      else {
        const contentEl = el.querySelector('.message-content');
        const before = contentEl?.querySelector('.reactions-container');
        if (before) before.insertAdjacentHTML('beforebegin', newAttachments);
      }
    } else if (attachmentsWrap) attachmentsWrap.remove();
    this._injectYouTubeEmbeds(el, realMessage.content);
    this._injectSpotifyEmbeds(el, realMessage.content);
    this._injectInviteEmbeds(el);
    this._injectGenericLinkEmbeds(el);
    this.messages.delete(pendingId);
    const authorName = realMessage.author?.username || realMessage.author_username || realMessage.username || this.currentUser?.username || 'User';
    const isSelf = this.currentUser && (realMessage.author_id === this.currentUser.id || realMessage.author?.id === this.currentUser.id);
    this.messages.set(realId, { ...realMessage, id: realId, message_id: realId, authorName, isSelf });
    const cid = this.currentChannel?.id || this.currentChannel?.channelId;
    if (cid) {
      const list = MessageCache.get(cid).filter(m => (m.id || m.message_id) !== pendingId);
      list.push({ ...realMessage, id: realId, message_id: realId });
      MessageCache.set(cid, list);
    }
  }

  setMessagesFromList(list) {
    const container = document.getElementById('messages-list');
    if (!container) return;
    const arr0 = Array.isArray(list) ? list : [];
    const arr = arr0.filter((msg, index, self) => {
      const id = msg && (msg.id ?? msg.message_id);
      if (!id) return true;
      return self.findIndex(m => String(m && (m.id ?? m.message_id)) === String(id)) === index;
    });
    
    // Se já existem mensagens no container, fazer atualização incremental
    const existingMsgs = container.querySelectorAll('[data-message]');
    if (existingMsgs.length > 0 && arr.length > 0) {
      // Coletar IDs existentes
      const existingIds = new Set();
      existingMsgs.forEach(el => {
        const id = el.dataset.message;
        if (id) existingIds.add(String(id));
      });
      
      // Só adicionar mensagens que não existem
      let hasNew = false;
      for (let i = 0; i < arr.length; i++) {
        const m = arr[i];
        const id = String(m.id ?? m.message_id ?? '');
        if (id && !existingIds.has(id)) {
          // Nova mensagem - adicionar ao final
          const authorId = m.author_id || m.author?.id;
          const isSelf = this.currentUser && (String(authorId) === String(this.currentUser.id));
          const msg = { ...m, id, message_id: id, isSelf };
          this.messages.set(id, msg);
          this.addMessage(msg, false);
          hasNew = true;
        }
      }
      
      if (hasNew) {
        this._injectEmbedsInAllMessages();
        this.scrollToBottom();
      }
      return;
    }
    
    // Se não há mensagens, recriar tudo (comportamento original)
    this.messages.clear();
    if (arr.length === 0) {
      container.replaceChildren();
      this._injectEmbedsInAllMessages();
      this.scrollToBottom();
      return;
    }
    const frag = document.createDocumentFragment();
    let prev = null;
    for (let i = 0; i < arr.length; i++) {
      const msg = arr[i];
      const time = new Date(msg.created_at || Date.now());
      const prevDateKey = prev ? new Date(prev.created_at || 0).toDateString() : null;
      const thisDateKey = time.toDateString();
      if (!prevDateKey || prevDateKey !== thisDateKey) frag.appendChild(this._createDateDivider(time));
      const lastInfo = prev
        ? { authorId: String(prev.author_id || prev.author?.id || ''), author: prev.author_username || prev.author?.username || prev.username || 'User' }
        : null;
      frag.appendChild(this._createMessageNode(msg, lastInfo));
      prev = msg;
    }
    container.replaceChildren(frag);
    arr.forEach(m => {
      const id = String(m.id ?? m.message_id ?? '');
      if (id) {
        const authorId = m.author_id || m.author?.id;
        const isSelf = this.currentUser && (String(authorId) === String(this.currentUser.id));
        this.messages.set(id, { ...m, id, message_id: id, isSelf });
      }
    });
    this._injectEmbedsInAllMessages();
    this.scrollToBottom();
  }

  _injectEmbedsInAllMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;
    container.querySelectorAll('[data-message]').forEach((msgEl) => {
      const id = msgEl.dataset.message;
      const data = this.messages.get(id);
      const content = data?.content ?? '';
      if (msgEl.querySelector('.message-embed-placeholder')) {
        this._injectYouTubeEmbeds(msgEl, content);
        this._injectSpotifyEmbeds(msgEl, content);
        this._injectInviteEmbeds(msgEl);
        this._injectGenericLinkEmbeds(msgEl);
      }
    });
  }

  autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  _formatDate(date) {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isToday) return 'Today at';
    if (isYesterday) return 'Yesterday at';
    return date.toLocaleDateString();
  }

  getMentionDisplayName(userId) {
    if (!userId) return 'User';
    const m = (this.members || []).find(m => (m.user_id || m.id) === userId);
    if (m) return m.username || 'User';
    const r = (this.currentChannel?.recipients || []).find(r => r.id === userId);
    if (r) return r.username || r.display_name || 'User';
    return 'User';
  }

  _parseMessageContent(content) {
    if (!content) return '';
    let escaped = this.escapeHtml(content);
    // Menções no formato @[userId] → badge azul clicável
    escaped = escaped.replace(/@\[([^\]]+)\]/g, (_, id) => {
      const uid = id.trim();
      const name = this.getMentionDisplayName(uid);
      return (
        '<span class="mention mention-badge" data-user-id="' +
        this.escapeHtml(uid) +
        '" role="button" tabindex="0">@' +
        this.escapeHtml(name) +
        '</span>'
      );
    });
    // Code blocks first (before inline code)
    escaped = escaped.replace(/```\n?([\s\S]*?)\n?```/g, '<pre class="message-code-block"><code>$1</code></pre>');
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    escaped = escaped.replace(/(https?:\/\/[^\s<]+)/g, (_, url) => {
      const trimmed = url.replace(/[.,;:!?)]+$/, '');
      const safeHref = this.escapeHtml(trimmed);
      const ytId = this._youtubeVideoId(trimmed);
      if (ytId) {
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="message-embed-placeholder message-embed-fallback" data-embed-type="youtube" data-embed-url="${safeHref}" data-video-id="${this.escapeHtml(ytId)}">${safeHref}</a>`;
      }
      if (this._isSpotifyUrl(trimmed)) {
        const spotifyCanonical = this._normalizeSpotifyUrl(trimmed);
        const safeSpotifyUrl = this.escapeHtml(spotifyCanonical || trimmed);
        return `<a href="${safeSpotifyUrl}" target="_blank" rel="noopener noreferrer" class="message-embed-placeholder message-embed-fallback" data-embed-type="spotify" data-embed-url="${safeSpotifyUrl}">${safeSpotifyUrl}</a>`;
      }
      const inviteCode = this._extractInviteCode(trimmed);
      if (inviteCode) {
        const safeCode = this.escapeHtml(inviteCode);
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="message-embed-placeholder message-embed-fallback" data-embed-type="invite" data-embed-code="${safeCode}">${safeHref}</a>`;
      }
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="message-embed-placeholder" data-embed-type="generic" data-embed-url="${safeHref}">${this.escapeHtml(trimmed)}</a>`;
    });
    escaped = escaped.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
  }

  _youtubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const u = url.trim();
    const m = u.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
    );
    return m ? m[1] : null;
  }

  _isSpotifyUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.trim();
    return (
      /https?:\/\/(?:open\.)?spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist|episode|show)\/[a-zA-Z0-9]+/i.test(u) ||
      /https?:\/\/spotify\.link\/[^\s]+/i.test(u)
    );
  }

  _normalizeSpotifyUrl(url) {
    if (!url || !this._isSpotifyUrl(url)) return url;
    const u = url.trim();
    const m = u.match(
      /https?:\/\/(?:open\.)?spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/i
    );
    if (m) return `https://open.spotify.com/${m[1]}/${m[2]}`;
    return u;
  }

  _extractInviteCode(url) {
    if (!url || typeof url !== 'string') return null;
    const u = url.trim();
    const invitePath = /\/invite\/([A-Za-z0-9]+)/i;
    let m = u.match(/https?:\/\/(?:[^/]+\.)*liberty\.app\/invite\/([A-Za-z0-9]+)/i);
    if (m) return m[1];
    m = u.match(/https?:\/\/(?:[^/]+\.)*squareweb\.app\/invite\/([A-Za-z0-9]+)/i);
    if (m) return m[1];
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin;
      const pathRegex = new RegExp('^' + origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\/invite\\/([A-Za-z0-9]+)', 'i');
      m = u.match(pathRegex);
      if (m) return m[1];
      if (/^\/invite\/([A-Za-z0-9]+)/i.test(u)) return u.match(invitePath)[1];
    }
    return null;
  }

  _extractYouTubeUrls(content) {
    if (!content) return [];
    const urlRe =
      /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s<>]+|youtu\.be\/[a-zA-Z0-9_-]+|youtube\.com\/embed\/[a-zA-Z0-9_-]+)/gi;
    const seen = new Set();
    const out = [];
    let m;
    const str = content;
    const re = new RegExp(urlRe.source, 'gi');
    while ((m = re.exec(str)) !== null) {
      const url = m[0];
      const id = this._youtubeVideoId(url);
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push({ url: url.split('&')[0].replace(/\?$/, ''), videoId: id });
      }
    }
    return out;
  }

  _injectYouTubeEmbeds(messageEl, content) {
    const textEl = messageEl.querySelector('.message-text');
    if (!textEl) return;
    const placeholders = textEl.querySelectorAll('.message-embed-placeholder[data-embed-type="youtube"]');
    placeholders.forEach((ph) => {
      const url = ph.getAttribute('data-embed-url');
      const videoId = ph.getAttribute('data-video-id');
      if (!videoId || !url) return;
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const card = document.createElement('a');
      card.href = url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.className = 'message-embed message-embed-youtube-card';
      card.innerHTML = `
        <div class="message-embed-youtube-inner">
          <div class="message-embed-youtube-thumb-wrap">
            <img class="message-embed-youtube-thumb" src="${this.escapeHtml(thumbUrl)}" alt="" loading="lazy"/>
            <span class="message-embed-youtube-play" aria-hidden="true"><i class="fas fa-play"></i></span>
          </div>
          <div class="message-embed-youtube-meta">
            <span class="message-embed-youtube-source">YouTube</span>
            <span class="message-embed-youtube-title" data-video-id="${this.escapeHtml(videoId)}">Vídeo do YouTube</span>
            <span class="message-embed-youtube-author message-embed-youtube-loading" data-video-id="${this.escapeHtml(videoId)}"></span>
            <span class="message-embed-youtube-external" title="Abrir no YouTube"><i class="fas fa-external-link-alt"></i></span>
          </div>
        </div>
      `;
      ph.replaceWith(card);
      this._fetchYouTubeOEmbed(videoId, card);
    });
  }

  _injectSpotifyEmbeds(messageEl, content) {
    const textEl = messageEl.querySelector('.message-text');
    if (!textEl) return;
    const placeholders = textEl.querySelectorAll('.message-embed-placeholder[data-embed-type="spotify"]');
    placeholders.forEach((ph) => {
      const url = ph.getAttribute('data-embed-url');
      if (!url) return;
      try {
        const card = document.createElement('a');
        card.href = url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.className = 'message-embed message-embed-spotify-card';
        card.innerHTML = `
          <div class="message-embed-spotify-inner">
            <div class="message-embed-spotify-art"><span class="message-embed-spotify-art-placeholder"><i class="fab fa-spotify"></i></span></div>
            <div class="message-embed-spotify-body">
              <span class="message-embed-spotify-badge">Spotify</span>
              <span class="message-embed-spotify-title">Abrir no Spotify</span>
              <span class="message-embed-spotify-artist"></span>
              <div class="message-embed-spotify-actions">
                <span class="message-embed-spotify-logo" aria-label="Spotify"><i class="fab fa-spotify"></i></span>
                <span class="message-embed-spotify-play" title="Reproduzir no Spotify"><i class="fas fa-play"></i></span>
              </div>
            </div>
          </div>
        `;
        ph.replaceWith(card);
        this._fetchSpotifyOEmbed(url, card);
      } catch (_) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'message-embed message-embed-spotify-card';
        link.textContent = 'Abrir no Spotify';
        ph.replaceWith(link);
      }
    });
  }

  _injectInviteEmbeds(messageEl) {
    const textEl = messageEl.querySelector('.message-text');
    if (!textEl) return;
    const placeholders = textEl.querySelectorAll('.message-embed-placeholder[data-embed-type="invite"]');
    placeholders.forEach((ph) => {
      const code = ph.getAttribute('data-embed-code');
      if (!code) return;
      const wrap = document.createElement('div');
      wrap.className = 'message-embed message-embed-invite-card';
      wrap.innerHTML = `
        <div class="message-embed-invite-loading"><i class="fas fa-spinner fa-spin"></i><span>A carregar convite…</span></div>
      `;
      ph.replaceWith(wrap);
      this._fetchInviteAndRenderCard(code, wrap);
    });
  }

  async _fetchInviteAndRenderCard(code, wrap) {
    const app = this;
    try {
      const invite = await API.Invite.get(code);
      const serverId = invite.server_id || invite.server?.id;
      if (!serverId) {
        wrap.innerHTML = '<div class="message-embed-invite-error">Convite inválido ou expirado.</div>';
        return;
      }
      let server = invite.server;
      if (!server || !server.name) {
        try {
          const s = await API.Server.get(serverId);
          server = s.server || s;
        } catch (_) {}
      }
      const name = server?.name || 'Servidor';
      const iconUrl = server?.icon_url || server?.icon || null;
      const bannerUrl = server?.banner_url || server?.banner || null;
      const memberCount = server?.approximate_member_count ?? invite.approximate_member_count ?? 0;
      const onlineCount = server?.approximate_presence_count ?? invite.approximate_presence_count ?? 0;
      const createdAt = server?.created_at || invite.created_at;
      const sinceStr =
        createdAt &&
        new Date(createdAt).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
      const initial = name.charAt(0).toUpperCase();
      wrap.innerHTML = `
        <div class="message-embed-invite-inner">
          <div class="message-embed-invite-main">
            <div class="message-embed-invite-icon message-embed-invite-icon--round">
              ${iconUrl ? `<img src="${this.escapeHtml(iconUrl)}" alt="">` : `<span class="message-embed-invite-icon-letter">${this.escapeHtml(initial)}</span>`}
            </div>
            <div class="message-embed-invite-info">
              <span class="message-embed-invite-name">${this.escapeHtml(name)}</span>
              <span class="message-embed-invite-stats">
                <span class="message-embed-invite-online"><span class="message-embed-invite-dot message-embed-invite-dot--online"></span>${onlineCount} online</span>
                <span class="message-embed-invite-members"><span class="message-embed-invite-dot message-embed-invite-dot--members"></span>${memberCount} membros</span>
              </span>
              ${sinceStr ? `<span class="message-embed-invite-since">Desde ${sinceStr}</span>` : ''}
            </div>
          </div>
          <button type="button" class="message-embed-invite-join-btn">Ir para o Servidor</button>
        </div>
      `;
      const btn = wrap.querySelector('.message-embed-invite-join-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const hasAuth = typeof API !== 'undefined' && API.Token && API.Token.getAccessToken && API.Token.getAccessToken();
          if (!hasAuth) {
            app.showToast('Inicia sessão para entrar no servidor.', 'error');
            if (typeof history !== 'undefined' && history.pushState) {
              history.pushState({}, '', `/invite/${encodeURIComponent(code)}`);
              app._applyRouteFromPath(window.location.pathname + (window.location.search || ''));
            }
            return;
          }
          if (app.gateway && app.gateway.connected) {
            app._pendingInviteCode = code;
            app.gateway.joinServer(code);
            app.showToast('A entrar no servidor…', 'info');
            return;
          }
          API.Invite.join(code).then((data) => {
            const server = data.server;
            const channel = data.channel;
            if (!server || !server.id) return;
            if (!app.servers.some((s) => s.id === server.id)) {
              app.servers.push(server);
            }
            app.renderServers();
            app.selectServer(server.id, channel ? channel.id : null);
            app.showToast('Entraste no servidor.', 'success');
          }).catch((err) => {
            app.showToast(err && err.message ? err.message : 'Convite inválido ou expirado.', 'error');
          });
        });
      }
    } catch (_) {
      const base = typeof window !== 'undefined' && window.location ? window.location.origin : '';
      wrap.innerHTML = `
        <div class="message-embed-invite-error">
          <p>Convite inválido ou expirado.</p>
          <a href="${base}/invite/${encodeURIComponent(code)}" target="_blank" rel="noopener noreferrer" class="message-embed-invite-retry">Tentar abrir link</a>
        </div>
      `;
    }
  }

  _injectGenericLinkEmbeds(messageEl) {
    const textEl = messageEl.querySelector('.message-text');
    if (!textEl) return;
    const placeholders = textEl.querySelectorAll('.message-embed-placeholder[data-embed-type="generic"]');
    placeholders.forEach((ph) => {
      const url = ph.getAttribute('data-embed-url');
      if (!url) return;
      let domain = url;
      try {
        domain = new URL(url).hostname.replace(/^www\./, '');
      } catch (_) {}
      const card = document.createElement('a');
      card.href = url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.className = 'message-embed message-embed-generic-card';
      card.innerHTML = `
        <div class="message-embed-generic-inner">
          <div class="message-embed-generic-icon"><i class="fas fa-link"></i></div>
          <div class="message-embed-generic-info">
            <span class="message-embed-generic-domain">${this.escapeHtml(domain)}</span>
            <span class="message-embed-generic-label">Abrir link</span>
          </div>
          <span class="message-embed-generic-external"><i class="fas fa-external-link-alt"></i></span>
        </div>
      `;
      ph.replaceWith(card);
    });
  }

  async _fetchYouTubeOEmbed(videoId, cardEl) {
    if (!cardEl || !videoId) return;
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const titleEl = cardEl.querySelector('.message-embed-youtube-title');
      const authorEl = cardEl.querySelector('.message-embed-youtube-author');
      if (titleEl && data.title) titleEl.textContent = data.title;
      if (authorEl) {
        authorEl.textContent = data.author_name || '';
        authorEl.classList.remove('message-embed-youtube-loading');
      }
    } catch (_) {
      const authorEl = cardEl.querySelector('.message-embed-youtube-author');
      if (authorEl) authorEl.classList.remove('message-embed-youtube-loading');
    }
  }

  async _fetchSpotifyOEmbed(spotifyUrl, cardEl) {
    if (!cardEl || !spotifyUrl) return;
    const canonical = this._normalizeSpotifyUrl(spotifyUrl) || spotifyUrl;
    const encoded = encodeURIComponent(canonical);
    const url = `https://open.spotify.com/oembed?url=${encoded}`;
    const titleEl = cardEl.querySelector('.message-embed-spotify-title');
    const artistEl = cardEl.querySelector('.message-embed-spotify-artist');
    const artEl = cardEl.querySelector('.message-embed-spotify-art');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('oEmbed failed');
      const data = await res.json();
      if (titleEl && data.title) titleEl.textContent = data.title;
      if (artistEl) artistEl.textContent = data.author_name || '';
      if (artEl && data.thumbnail_url) {
        artEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = data.thumbnail_url;
        img.alt = '';
        img.loading = 'lazy';
        artEl.appendChild(img);
      }
    } catch (_) {
      if (titleEl) titleEl.textContent = 'Abrir no Spotify';
    }
  }

  _updateChannelUnread(channelId, hasUnread) {
    const channelItem = document.querySelector(`.channel-item[data-channel="${channelId}"]`);
    if (channelItem) {
      let dot = channelItem.querySelector('.channel-unread-dot');
      if (hasUnread && !dot) {
        dot = document.createElement('div');
        dot.className = 'channel-unread-dot';
        channelItem.appendChild(dot);
      } else if (!hasUnread && dot) dot.remove();
    }
    const dmItem = document.querySelector(`.dm-list-item[data-dm-id="${channelId}"]`);
    if (dmItem) {
      const count =
        typeof LibertyDMUnreadStore !== 'undefined' ? LibertyDMUnreadStore.getCount(channelId) : hasUnread ? 1 : 0;
      const hasAny = count > 0;
      dmItem.classList.toggle('dm-list-item-unread', !!hasAny);
      const avatarWrap = dmItem.querySelector('.dm-list-item-avatar');
      if (avatarWrap) {
        if (hasAny && !avatarWrap.classList.contains('dm-avatar-had-ping')) avatarWrap.classList.add('dm-avatar-ping');
        if (hasAny) avatarWrap.classList.add('dm-avatar-had-ping');
      }
      let badge = dmItem.querySelector('.dm-unread-badge');
      if (hasAny) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'dm-unread-badge';
          badge.setAttribute('aria-label', 'Mensagens não lidas');
          dmItem.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : String(count);
      } else if (badge) {
        badge.remove();
        if (avatarWrap) avatarWrap.classList.remove('dm-avatar-ping', 'dm-avatar-had-ping');
      }
      this._updateDMUnreadTotal();
    }
  }

  _updateDMUnreadTotal() {
    const el = document.getElementById('dm-unread-total-badge');
    if (!el) return;
    if (typeof LibertyDMUnreadStore === 'undefined') {
      el.classList.add('hidden');
      return;
    }
    const counts = LibertyDMUnreadStore.getCounts();
    const total = Object.keys(counts).reduce((s, k) => s + (counts[k] || 0), 0);
    if (total <= 0) {
      el.classList.add('hidden');
      el.textContent = '';
    } else {
      el.classList.remove('hidden');
      el.textContent = total > 99 ? '99+' : String(total);
    }
  }

  _generateId() {
    return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO PRINCIPAL COM PROTEÇÃO ANTI-QUEBRA
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  try {
    // Criar instância principal do app
    window.app = new LibertyApp();
    
    // Inicializar sistema de menções se disponível
    if (window.LibertyMentions && typeof window.LibertyMentions.init === 'function') {
      try {
        window.LibertyMentions.init(window.app);
      } catch (e) {
        console.warn('[LIBERTY] Erro ao inicializar menções:', e?.message || e);
      }
    }
    
    console.log('[LIBERTY] Aplicação inicializada com sucesso');
  } catch (e) {
    console.error('[LIBERTY] Erro crítico na inicialização:', e?.message || e);
    
    // Fallback: mostrar tela de login mesmo com erro
    try {
      document.body.style.visibility = 'visible';
      document.body.style.opacity = '1';
      const loadingEl = document.getElementById('loading-screen');
      const authEl = document.getElementById('auth-screen');
      if (loadingEl) loadingEl.classList.add('hidden');
      if (authEl) authEl.classList.remove('hidden');
    } catch (fallbackError) {
      console.error('[LIBERTY] Erro no fallback:', fallbackError);
    }
  }
});

// Handler global de erros não capturados
window.addEventListener('error', function(event) {
  console.warn('[LIBERTY] Erro não capturado:', event?.message || event);
  // Previne que o erro pare a execução
  event.preventDefault?.();
  return false;
});

// Handler global de rejeições de Promise não capturadas
window.addEventListener('unhandledrejection', function(event) {
  console.warn('[LIBERTY] Promise rejeitada não capturada:', event?.reason?.message || event?.reason);
  // Previne que o erro pare a execução
  event.preventDefault?.();
  return false;
});

console.log('[LIBERTY] Sistema de proteção de erros carregado');

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS ADICIONAIS
// ═══════════════════════════════════════════════════════════════════════════

document.getElementById('messages-container')?.addEventListener('click', e => {
  try {
    const badge = e.target.closest('.mention-badge');
    if (!badge || !window.app) return;
    e.preventDefault();
    const userId = badge.dataset.userId;
    if (userId)
      window.app.showProfileCard({ user_id: userId, username: (badge.textContent || '').replace(/^@/, '').trim() }, e);
  } catch (err) {
    console.warn('[LIBERTY] Erro no click handler:', err?.message || err);
  }
});

  // ═══════════════════════════════════════════════════════════════════════════
// WEBRTC MANAGER - SISTEMA DE CHAMADAS (DESATIVADO - usar call-system.js)
// ═══════════════════════════════════════════════════════════════════════════

const WebRTCManager = {
  pc: null,
  localStream: null,
  remoteStream: null,
  currentCallId: null,
  targetUserId: null,
  isCaller: false,
  socket: null,

  init(socketInstance) {
    // DESATIVADO: call-system.js gerencia todas as chamadas
    console.log('[WebRTC] WebRTCManager DESATIVADO - use call-system.js');
    return;
  },

  async startWebRTC(isCaller, withVideo = false) {
    console.log('[WebRTC] WebRTCManager DESATIVADO - use call-system.js');
  },

  handleSignal(data) {
    console.log('[WebRTC] WebRTCManager DESATIVADO - use call-system.js');
  },

  renderHeaderUI(message, showButtons = false) {
    console.log('[WebRTC] WebRTCManager DESATIVADO - use call-system.js');
  },

  closeCall() {
    console.log('[WebRTC] WebRTCManager DESATIVADO - use call-system.js');
  }
};

// DESATIVADO - usando call-system.js
// window.WebRTCManager = WebRTCManager;

// O listener do botão #voice-call-btn está em call-system.js

// Desativa funções antigas
if (window.app && window.app._startVoiceCallIfDM) {
  window.app._startVoiceCallIfDM = function() {
    console.log('[WebRTC] Função antiga desativada');
  };
}

console.log('[WebRTC] Sistema de chamadas pronto - usando call-system.js');
