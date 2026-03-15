// LIBERTY - Main Application (Complete Rewrite)

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
.profile-card-modal .profile-card-modal-inner{pointer-events:auto;width:320px;background:rgba(24,21,18,.97);backdrop-filter:blur(20px);border:1px solid rgba(255,215,0,.25);border-radius:16px;box-shadow:0 0 40px rgba(255,215,0,.15);padding:24px 20px;text-align:center}
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
.profile-card-full{pointer-events:auto;align-items:center;justify-content:center;padding:24px}
.profile-card-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:0}
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
.settings-overlay{position:fixed;inset:0;background:var(--primary-black);z-index:3500;display:flex;animation:settingsFadeIn .25s var(--ease-out-expo)}
@keyframes settingsFadeIn{from{opacity:0}to{opacity:1}}
.settings-overlay .settings-sidebar{flex:0 0 auto;background:var(--secondary-black);display:flex;justify-content:flex-end;overflow-y:auto;min-width:218px;padding-left:max(20px,calc(50vw - 480px))}
.settings-overlay .settings-sidebar-inner{width:218px;padding:60px 6px 20px 20px;flex-shrink:0}
.settings-overlay .settings-sidebar-profile{display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:4px;border-radius:var(--radius-md);background:rgba(255,255,255,.03)}
.settings-overlay .settings-sidebar-profile-avatar{width:32px;height:32px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,var(--primary-yellow),var(--dark-yellow));display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--primary-black);flex-shrink:0}
.settings-overlay .settings-sidebar-profile-info{min-width:0}
.settings-overlay .settings-sidebar-profile-name{font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.settings-overlay .settings-sidebar-profile-link{font-size:11px;color:var(--primary-yellow);cursor:pointer}
.settings-overlay .settings-sidebar-profile-link:hover{text-decoration:underline}
.settings-overlay .settings-sidebar-search{width:100%;padding:6px 8px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:inherit;margin-bottom:8px}
.settings-overlay .settings-sidebar-search:focus{outline:none;border-color:var(--primary-yellow)}
.settings-overlay .settings-sidebar-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-secondary);padding:6px 10px;margin-top:8px}
.settings-overlay .settings-sidebar-item{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:14px;color:var(--text-secondary);transition:background .15s,color .15s;margin-bottom:1px;white-space:nowrap}
.settings-overlay .settings-sidebar-item i{width:18px;text-align:center;font-size:14px;flex-shrink:0}
.settings-overlay .settings-sidebar-item:hover{background:rgba(255,255,255,.04);color:var(--text-primary)}
.settings-overlay .settings-sidebar-item.active{background:var(--medium-gray);color:var(--text-primary);font-weight:500}
.settings-overlay .settings-content h2.settings-page-title{font-size:24px;font-weight:700;color:var(--primary-yellow);margin-bottom:24px;display:block}
.settings-overlay .settings-account-hero{display:flex;align-items:center;gap:16px;padding:20px 24px;background:linear-gradient(135deg,var(--primary-yellow),var(--dark-yellow));border-radius:var(--radius-lg);margin-bottom:24px}
.settings-overlay .settings-account-hero-avatar{width:64px;height:64px;border-radius:50%;background:var(--secondary-black);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden}
.settings-overlay .settings-account-hero-avatar img{width:100%;height:100%;object-fit:cover}
.settings-overlay .settings-account-hero-name{font-size:18px;font-weight:700;color:var(--primary-black);flex:1}
.settings-overlay .settings-account-hero .btn-change-photo{background:var(--primary-black);color:var(--primary-yellow);border:none;padding:8px 14px;border-radius:var(--radius-md);font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.settings-overlay .settings-account-hero .btn-change-photo:hover{background:rgba(0,0,0,.8)}
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
.settings-overlay .settings-section-block .btn-clear-db{background:var(--error);color:#fff;border:none;padding:10px 18px;border-radius:var(--radius-md);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:8px}
.settings-overlay .settings-section-block .btn-clear-db:hover{background:#c62828}
.settings-overlay .settings-section-block select{padding:10px 12px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit;min-width:200px}
.settings-overlay .settings-section-block select:focus{outline:none;border-color:var(--primary-yellow)}
.settings-overlay .settings-sidebar-item.danger{color:var(--error)}
.settings-overlay .settings-sidebar-item.danger:hover{background:rgba(229,57,53,.12)}
.settings-overlay .settings-sidebar-divider{height:1px;background:rgba(255,255,255,.06);margin:8px 10px}
.settings-overlay .settings-content{flex:1;display:flex;justify-content:flex-start;background:var(--primary-black);position:relative;overflow-y:auto;padding:60px 40px 80px}
.settings-overlay .settings-content-inner{max-width:740px;width:100%}
.settings-overlay .settings-content h2{font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:20px;display:block}
.settings-overlay .settings-content h3{font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.7px;margin:24px 0 8px;display:block}
.settings-overlay .settings-content p{font-size:14px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;display:block}
.settings-overlay .settings-card{background:var(--secondary-black);border:1px solid rgba(255,215,0,.06);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px;display:block}
.settings-overlay .settings-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.settings-overlay .settings-row:last-child{border-bottom:none}
.settings-overlay .settings-row-label{font-size:14px;color:var(--text-primary);font-weight:500}
.settings-overlay .settings-row-desc{font-size:12px;color:var(--text-muted);margin-top:2px}
.settings-overlay .settings-close{position:fixed;top:60px;right:max(20px,calc(50vw - 480px));z-index:3501;display:flex;flex-direction:column;align-items:center}
.settings-overlay .settings-close button{width:36px;height:36px;border-radius:50%;background:transparent;border:2px solid var(--medium-gray);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .15s}
.settings-overlay .settings-close button:hover{border-color:var(--light-gray);color:var(--text-primary)}
.settings-overlay .settings-close-hint{font-size:10px;color:var(--text-muted);text-align:center;margin-top:4px;font-weight:600}
.settings-overlay .settings-profile-card{background:var(--secondary-black);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:16px;border:1px solid rgba(255,215,0,.06)}
.settings-overlay .settings-profile-banner{height:100px;background:linear-gradient(135deg,var(--primary-yellow),var(--dark-yellow))}
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
.dm-list-item-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;position:relative;flex-shrink:0}
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
.friend-item{display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:var(--radius-md);border-top:1px solid rgba(255,255,255,.03);cursor:pointer;transition:background .15s}
.friend-item:hover{background:var(--dark-gray)}
.friend-item-avatar{width:36px;height:36px;border-radius:50%;background:var(--medium-gray);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--text-secondary);position:relative;flex-shrink:0}
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
.friends-header-tabs{display:flex;gap:4px;align-items:center}
.friends-header-tab{padding:4px 10px;border-radius:var(--radius-md);background:transparent;border:none;font-size:13px;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:all .15s;font-family:inherit;white-space:nowrap}
.friends-header-tab:hover{background:var(--dark-gray);color:var(--text-primary)}
.friends-header-tab.active{background:var(--medium-gray);color:var(--text-primary)}
.friends-header-tab.add-friend{background:rgba(67,160,71,.15);color:var(--status-online)}
.friends-header-tab.add-friend:hover{background:rgba(67,160,71,.25)}
.friends-search-wrapper{padding:8px 16px}
.friends-search-wrapper input{width:100%;padding:8px 12px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit}
.friends-search-wrapper input:focus{outline:none;border-color:var(--primary-yellow)}
.friends-search-wrapper i{display:none}
.friends-add-section{padding:20px 16px}
.friends-add-section h2{font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px}
.friends-add-section p{font-size:14px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5}
.friends-add-input-wrapper{display:flex;gap:8px}
.friends-add-input-wrapper input{flex:1;padding:10px 14px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit}
.friends-add-input-wrapper input:focus{outline:none;border-color:var(--primary-yellow)}
.friends-view{display:flex;flex-direction:column;flex:1;overflow:hidden}
.main-content{position:relative}
.member-role-badge{font-size:10px;padding:1px 6px;border-radius:var(--radius-full);margin-left:4px;font-weight:600}
    `;
    document.head.appendChild(s);
})();

const EMOJIS = {
    'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐'],
    'Gestures': ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','👏','🙌','🤝','🙏','💪','🦾'],
    'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝'],
    'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦅','🦆','🦉','🐝','🦋','🐌','🐛'],
    'Food': ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🍍','🥭','🥝','🍅','🥑','🌽','🍕','🍔','🍟','🌭','🍿','🧁','🍩','🍪','🎂','🍰'],
    'Activities': ['⚽','🏀','🏈','⚾','🎾','🏐','🎮','🎯','🎲','🧩','♟️','🎭','🎨','🎬','🎤','🎧','🎵','🎶','🏆','🥇','🥈','🥉','🎖️','🏅'],
    'Objects': ['💡','🔦','🕯️','💰','💎','⚙️','🔧','🔨','🛡️','🔑','🗝️','📱','💻','⌨️','🖥️','🖨️','📷','📹','📺','📻','⏰','🔔','📢','📣'],
    'Symbols': ['❤️','💯','💢','💥','💫','💦','🔥','⭐','✨','🌟','💨','🕳️','💣','🗯️','💤','✅','❌','⭕','🚫','♻️','⚠️','🔴','🟡','🟢','🔵']
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
        this._serverDropdown = null;
        this._searchPanel = null;
        this._pinnedPanel = null;
        this._settingsOverlay = null;

        this.dmChannels = [];
        this.relationships = [];
        this.gateway = null;

        this.init();
    }

    applyBackground() {
        const type = localStorage.getItem('liberty-bg-type') || 'default';
        const body = document.body;
        body.style.backgroundImage = '';
        body.style.backgroundSize = '';
        body.style.backgroundPosition = '';
        body.style.backgroundRepeat = '';
        body.style.backgroundAttachment = '';
        if (type === 'default') {
            body.style.background = '#000';
            body.style.backgroundColor = '#000';
            return;
        }
        if (type === 'solid') {
            const color = localStorage.getItem('liberty-bg-solid') || '#000000';
            body.style.background = color;
            body.style.backgroundColor = color;
            return;
        }
        if (type === 'gradient') {
            try {
                const g = JSON.parse(localStorage.getItem('liberty-bg-gradient') || '{}');
                const angle = g.angle ?? 135;
                const c1 = g.color1 || '#0d0b09';
                const c2 = g.color2 || '#1a1814';
                body.style.background = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
                body.style.backgroundColor = c1;
            } catch (_) { body.style.background = '#000'; body.style.backgroundColor = '#000'; }
            return;
        }
        if (type === 'image') {
            const url = (localStorage.getItem('liberty-bg-image') || '').trim();
            body.style.background = '#000';
            body.style.backgroundColor = '#000';
            if (url) {
                body.style.backgroundImage = `url(${url})`;
                body.style.backgroundSize = 'cover';
                body.style.backgroundPosition = 'center';
                body.style.backgroundRepeat = 'no-repeat';
                body.style.backgroundAttachment = 'fixed';
            }
        }
    }

    applyTheme(themeClass) {
        const body = document.body;
        body.classList.remove('Dark-theme', 'Light-theme', 'Dark-Accent-theme');
        body.classList.add(themeClass);
        localStorage.setItem('liberty-theme', themeClass);
        this.updateThemeButtons();
    }

    updateThemeButtons() {
        const current = localStorage.getItem('liberty-theme') || 'Dark-theme';
        document.querySelectorAll('.theme-option').forEach(el => {
            el.classList.toggle('theme-active', el.dataset.theme === current);
            el.style.borderColor = el.dataset.theme === current ? 'var(--primary-yellow)' : 'transparent';
        });
    }

    async init() {
        try {
            this.applyTheme(localStorage.getItem('liberty-theme') || 'Dark-theme');
            this.applyBackground();
            await this.simulateLoading();
            if (typeof API !== 'undefined' && API.Token && API.Token.isAuthenticated()) {
                try {
                    await Promise.race([
                        this.connect(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
                    ]);
                } catch {
                    if (API.Token.clearTokens) API.Token.clearTokens();
                    this.showAuth();
                }
            } else {
                this.showAuth();
            }
        } catch (e) {
            console.error('Init error:', e);
            this.showAuth();
        }
        this.setupEventListeners();
    }

    async simulateLoading() {
        return new Promise(resolve => setTimeout(resolve, 800));
    }

    async connect() {
        try {
            const me = await API.User.getCurrentUser();
            this.currentUser = me && me.user ? me.user : me;
        } catch (e) {
            console.warn('getCurrentUser failed:', e?.message || e);
            this.currentUser = null;
        }
        if (this.currentUser?.username) {
            try { localStorage.setItem('liberty_username', this.currentUser.username); } catch (_) {}
        }
        if (window.Gateway) {
            this.gateway = window.Gateway;
            try {
                const data = await this.gateway.connect();
                this.servers = data.servers || [];
            } catch (_) {
                this.servers = [];
            }
            try {
                const serverList = await API.Server.list();
                if (Array.isArray(serverList)) this.servers = serverList;
            } catch (_) {}
            this.setupGatewayHandlers();
        } else {
            this.gateway = null;
            try {
                const serverList = await API.Server.list();
                if (Array.isArray(serverList)) this.servers = serverList;
            } catch (_) {}
        }
        this.showApp();
        this.renderServers();
        this.updateUserPanel();
        this.selectHome();
        this.loadFriends().catch(() => {});
        this._startActivityPing();
    }

    _startActivityPing() {
        if (this._activityPingInterval) clearInterval(this._activityPingInterval);
        if (!API.Token?.getAccessToken?.()) return;
        API.Activity?.ping?.();
        this._activityPingInterval = setInterval(() => {
            if (API.Token?.getAccessToken?.()) API.Activity?.ping?.();
        }, 60 * 1000);
    }

    _getAvatarUrl() {
        const u = this.currentUser;
        const fromUser = u && (u.avatar_url || u.avatar);
        if (fromUser) return fromUser;
        try {
            const local = localStorage.getItem('liberty_avatar_url');
            if (local && local.trim()) return local.trim();
        } catch (_) {}
        return null;
    }

    _updateUserAvatarInUI() {
        this.updateUserPanel();
        const sidebarAvatar = document.querySelector('.settings-sidebar-profile-avatar');
        if (sidebarAvatar && this.currentUser) {
            const avatarSrc = this._getAvatarUrl();
            const letter = (this.currentUser.username || 'U').charAt(0).toUpperCase();
            if (avatarSrc) {
                sidebarAvatar.innerHTML = `<img src="${this.escapeHtml(avatarSrc)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:14px;font-weight:700;color:var(--primary-black)">${letter}</span>`;
            } else {
                sidebarAvatar.innerHTML = `<span>${letter}</span>`;
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
            const statusColor = this.currentStatus === 'invisible' ? 'var(--status-offline)' : `var(--status-${this.currentStatus})`;
            avatarEl.style.setProperty('--status-color', statusColor);
            const avatarSrc = this._getAvatarUrl();
            avatarEl.innerHTML = avatarSrc
                ? `<img src="${this.escapeHtml(avatarSrc)}" alt="${this.escapeHtml(this.currentUser.username)}"><span class="user-avatar-status" id="user-avatar-status" data-status="${this.currentStatus}"></span>`
                : `<span>${letter}</span><span class="user-avatar-status" id="user-avatar-status" data-status="${this.currentStatus}"></span>`;
        }
        if (statusEl) {
            const labels = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', invisible: 'Invisible' };
            statusEl.textContent = this.customStatusText || labels[this.currentStatus] || 'Online';
            statusEl.style.color = `var(--status-${this.currentStatus === 'invisible' ? 'offline' : this.currentStatus})`;
        }
    }

    showAuth() {
        const loading = document.getElementById('loading-screen');
        const auth = document.getElementById('auth-screen');
        if (loading) loading.classList.add('fade-out');
        setTimeout(() => {
            if (loading) loading.classList.add('hidden');
            if (auth) auth.classList.remove('hidden');
        }, 250);
    }

    showApp() {
        document.getElementById('loading-screen')?.classList?.add('fade-out');
        document.getElementById('auth-screen')?.classList?.add('hidden');
        setTimeout(() => {
            document.getElementById('loading-screen')?.classList?.add('hidden');
            document.getElementById('app')?.classList?.remove('hidden');
        }, 350);
    }

    // ═══════════════════════════════════════════
    //  EVENT LISTENERS
    // ═══════════════════════════════════════════

    setupEventListeners() {
        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
        });
        document.getElementById('login-form')?.addEventListener('submit', e => { e.preventDefault(); this.handleLogin(); });
        document.getElementById('register-form')?.addEventListener('submit', e => { e.preventDefault(); this.handleRegister(); });

        // Home button
        const homeBtn = document.querySelector('.server-item.home');
        if (homeBtn) homeBtn.addEventListener('click', () => this.selectHome());

        // Add server
        document.getElementById('add-server-btn')?.addEventListener('click', () => this.showModal('create-server-modal'));

        // Modal close
        document.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', () => this.hideModal()));
        document.getElementById('modal-overlay')?.addEventListener('click', e => {
            if (e.target.id === 'modal-overlay') {
                this.hideProfileCard();
                this.hideModal();
            }
        });
        document.getElementById('create-server-form')?.addEventListener('submit', e => { e.preventDefault(); this.handleCreateServer(); });
        document.querySelectorAll('.modal-cancel-btn').forEach(btn => btn.addEventListener('click', () => this.hideModal()));

        // Message input
        const msgInput = document.getElementById('message-input');
        if (msgInput) {
            msgInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSendMessage(); }
            });
            msgInput.addEventListener('input', () => {
                this.autoResizeTextarea(msgInput);
                if (!this._typingDebounce) this.handleTyping();
                clearTimeout(this._typingDebounce);
                this._typingDebounce = setTimeout(() => { this._typingDebounce = null; }, 2000);
            });
        }

        // Members toggle
        document.getElementById('toggle-members-btn')?.addEventListener('click', () => this.toggleMembers());

        // Server header dropdown
        document.querySelector('.server-header')?.addEventListener('click', e => {
            if (!this.isHomeView) this.toggleServerDropdown(e);
        });

        // Mobile: toggle channel sidebar
        const channelSidebarToggle = document.querySelector('.channel-sidebar-toggle');
        if (channelSidebarToggle) {
            channelSidebarToggle.addEventListener('click', () => {
                const sidebar = document.querySelector('.channel-sidebar');
                if (sidebar) sidebar.classList.toggle('mobile-hidden');
            });
        }

        // User panel buttons
        const muteBtn = document.querySelector('[data-tooltip="Mute"]');
        const deafenBtn = document.querySelector('[data-tooltip="Deafen"]');
        const settingsBtn = document.querySelector('.user-controls [data-tooltip="Settings"]');
        if (muteBtn) muteBtn.addEventListener('click', () => this.toggleMute());
        if (deafenBtn) deafenBtn.addEventListener('click', () => this.toggleDeafen());
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.showSettingsPanel('user'));

        // User info -> status picker
        document.querySelector('.user-info').addEventListener('click', e => this.showStatusPicker(e));

        // Voice sidebar (static) Disconnect / Screen Share
        document.querySelector('.voice-connected-actions [data-tooltip="Disconnect"]')?.addEventListener('click', () => this.disconnectVoice());
        document.querySelector('.voice-connected-actions [data-tooltip="Screen Share"]')?.addEventListener('click', () => this.showToast('Screen share — coming in a future update!', 'info'));

        // Channel header buttons
        const pinnedBtn = document.getElementById('pinned-btn');
        if (pinnedBtn) pinnedBtn.addEventListener('click', () => this.togglePinnedPanel());

        const toggleMembersBtn = document.getElementById('toggle-members-btn');
        if (toggleMembersBtn) toggleMembersBtn.addEventListener('click', () => this.toggleMembers());

        // Threads, Notifications, Inbox, Help
        const threadsBtn = document.querySelector('.channel-actions [data-tooltip="Threads"]');
        if (threadsBtn) threadsBtn.addEventListener('click', () => this.showToast('Threads — view conversation threads here. Coming in a future update!', 'info'));
        const notifBtn = document.querySelector('.channel-actions [data-tooltip="Notifications"]');
        if (notifBtn) notifBtn.addEventListener('click', () => this.showToast('Notification settings — mute or highlight this channel.', 'info'));
        const inboxBtn = document.querySelector('.channel-actions [data-tooltip="Inbox"]');
        if (inboxBtn) inboxBtn.addEventListener('click', () => this.showToast('Inbox — your mentions and DMs in one place.', 'info'));
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) helpBtn.addEventListener('click', () => this.showHelp());

        // Search bar: focus opens search panel
        const channelSearchInput = document.getElementById('channel-search-input');
        if (channelSearchInput) {
            channelSearchInput.addEventListener('focus', () => { if (!this._searchPanel) this.toggleSearchPanel(); });
            channelSearchInput.addEventListener('click', (e) => { e.stopPropagation(); if (!this._searchPanel) this.toggleSearchPanel(); });
        }

        // Input action buttons
        const attachBtn = document.getElementById('attach-btn') || document.querySelector('.message-input-wrapper [data-tooltip="Attach"]');
        const giftBtn = document.querySelector('.input-actions [data-tooltip="Gift"]');
        const gifBtn = document.querySelector('.input-actions [data-tooltip="GIF"]');
        const stickersBtn = document.querySelector('.input-actions [data-tooltip="Stickers"]');
        const emojiBtn = document.getElementById('emoji-btn') || document.querySelector('.input-actions [data-tooltip="Emoji"]');
        if (attachBtn) attachBtn.addEventListener('click', () => this._openFilePicker());
        if (giftBtn) giftBtn.addEventListener('click', () => this.showToast('LIBERTY Premium — Unlock gifts and more!', 'info'));
        if (gifBtn) gifBtn.addEventListener('click', () => this.showToast('GIF picker — coming in a future update!', 'info'));
        if (stickersBtn) stickersBtn.addEventListener('click', () => this.showToast('Stickers — coming in a future update!', 'info'));
        if (emojiBtn) emojiBtn.addEventListener('click', e => {
            this.showEmojiPicker(emojiBtn, emoji => {
                const input = document.getElementById('message-input');
                input.value += emoji;
                input.focus();
            });
        });

        // Global click to close popups
        document.addEventListener('click', e => {
            if (this._contextMenu && !this._contextMenu.contains(e.target)) this.hideContextMenu();
            if (this._statusPicker && !this._statusPicker.contains(e.target) && !e.target.closest('.user-info')) this.hideStatusPicker();
            if (this._serverDropdown && !this._serverDropdown.contains(e.target) && !e.target.closest('.server-header')) this.hideServerDropdown();
            if (this._profileCard && !this._profileCard.contains(e.target)) this.hideProfileCard();
            if (this._pinnedPanel && !this._pinnedPanel.contains(e.target) && !e.target.closest('#pinned-btn')) this.hidePinnedPanel();
            if (this._searchPanel && !this._searchPanel.contains(e.target) && !e.target.closest('#channel-search-input') && !e.target.closest('.channel-search-wrapper')) this.hideSearchPanel();
            if (this._emojiPicker && !this._emojiPicker.contains(e.target) && !e.target.closest('[data-tooltip="Emoji"]') && !e.target.closest('.message-actions')) this.hideEmojiPicker();
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
                if (this._settingsOverlay) { this.hideSettingsPanel(); return; }
                if (this._contextMenu) { this.hideContextMenu(); return; }
                if (this._emojiPicker) { this.hideEmojiPicker(); return; }
                if (this._statusPicker) { this.hideStatusPicker(); return; }
                if (this._profileCard) { this.hideProfileCard(); return; }
                if (this._serverDropdown) { this.hideServerDropdown(); return; }
                if (this._pinnedPanel) { this.hidePinnedPanel(); return; }
                if (this._searchPanel) { this.hideSearchPanel(); return; }
                this.hideModal();
            }
        });

        // Security warning modal (after login)
        document.getElementById('security-warning-ignore-btn')?.addEventListener('click', () => this._onSecurityWarningIgnore());
        document.getElementById('security-warning-privacy-btn')?.addEventListener('click', () => this._onSecurityWarningPrivacy());

        // Create server modal: server icon upload
        const serverIconUpload = document.querySelector('.server-icon-upload');
        const serverIconInput = document.getElementById('server-icon-input');
        if (serverIconUpload && serverIconInput) {
            serverIconUpload.addEventListener('click', () => serverIconInput.click());
            serverIconInput.addEventListener('change', () => {
                if (serverIconInput.files?.length) this.showToast(`Icon selected: ${serverIconInput.files[0].name}`, 'success');
            });
        }
    }

    _openFilePicker(accept) {
        const input = document.createElement('input');
        input.type = 'file';
        if (accept) input.accept = accept;
        input.addEventListener('change', () => {
            if (input.files.length > 0) {
                this.showToast(`File "${input.files[0].name}" selected (upload simulated)`, 'success');
            }
        });
        input.click();
    }

    setupGatewayHandlers() {
        if (!this.gateway) return;
        const g = this.gateway;
        g.on('message', msg => {
            const chId = msg.channel_id || msg.channelId;
            const normalized = {
                ...msg,
                author_username: msg.author_username || msg.author,
                created_at: msg.created_at || msg.timestamp,
            };
            if (chId === this.currentChannel?.id) {
                this.addMessage(normalized, true);
                this.scrollToBottom();
            } else {
                this.unreadChannels.add(chId);
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
        });
        g.on('server_delete', data => {
            this.servers = this.servers.filter(s => s.id !== data.server_id);
            this.renderServers();
            if (this.currentServer?.id === data.server_id) this.selectHome();
        });
        g.on('channel_create', data => {
            if (this.currentServer?.id === data.channel?.server_id) { this.channels.push(data.channel); this.renderChannels(); }
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
            if (this.currentServer?.id === data.member?.server_id) { this.members.push(data.member); this.renderMembers(); }
        });
        g.on('member_leave', data => { this.members = this.members.filter(m => m.user_id !== data.user_id); this.renderMembers(); });
        g.on('member_update', data => {
            const idx = this.members.findIndex(m => m.user_id === data.member?.user_id);
            if (idx !== -1) { this.members[idx] = { ...this.members[idx], ...data.member }; this.renderMembers(); }
        });
        g.on('disconnected', () => this.showToast('Disconnected from server. Reconnecting...', 'error'));
        g.on('ready', () => {
            this.showToast('Connected to LIBERTY!', 'success');
            if (this.isHomeView) {
                const dmList = document.getElementById('dm-list');
                const navArea = document.querySelector('.home-nav');
                if (dmList) { dmList.innerHTML = ''; this._loadDMList(dmList, navArea); }
            }
        });
        g.on('friend_added', (data) => {
            this.showToast(`You have a new friend request from ${data.user?.username || 'User'}`, 'success');
            this.loadFriends().catch(() => {});
            if (document.getElementById('friends-view')?.classList.contains('hidden') === false) {
                this.renderFriendsView('pending').catch(() => {});
            }
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
        });
        this._setupVoiceCallHandlers();
        this._setupVoiceCallButton();
    }

    _voiceCallState = { pc: null, stream: null, targetUserId: null, pendingOffer: null, incomingFromUserId: null, displayStream: null, videoEnabled: true, callId: null };

    _webrtcClearRemote() {
        const remoteV = document.getElementById('webrtc-remote-video');
        const remoteS = document.getElementById('webrtc-remote-screen');
        const screenWrap = document.getElementById('webrtc-remote-screen-wrap');
        const placeholder = document.getElementById('webrtc-remote-placeholder');
        const badge = document.getElementById('webrtc-screen-badge');
        if (remoteV) { remoteV.srcObject = null; remoteV.classList.add('hidden'); }
        if (remoteS) { remoteS.srcObject = null; }
        if (screenWrap) screenWrap.classList.add('hidden');
        if (badge) badge.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
    }

    _attachRemoteTrack(e) {
        const stream = e.streams && e.streams[0];
        if (!stream) return;
        const track = e.track;
        if (track.kind === 'audio') {
            const audio = document.createElement('audio');
            audio.autoplay = true;
            audio.srcObject = stream;
            document.getElementById('webrtc-remote-wrap')?.appendChild(audio);
            return;
        }
        if (track.kind === 'video') {
            const isScreen = track.label.toLowerCase().includes('screen');
            const placeholder = document.getElementById('webrtc-remote-placeholder');
            if (placeholder) placeholder.classList.add('hidden');
            if (isScreen) {
                const wrap = document.getElementById('webrtc-remote-screen-wrap');
                const vid = document.getElementById('webrtc-remote-screen');
                const badge = document.getElementById('webrtc-screen-badge');
                if (vid) { vid.srcObject = stream; vid.classList.remove('hidden'); }
                if (wrap) wrap.classList.remove('hidden');
                if (badge) badge.classList.remove('hidden');
            } else {
                const vid = document.getElementById('webrtc-remote-video');
                if (vid) { vid.srcObject = stream; vid.classList.remove('hidden'); }
            }
            track.onended = () => {
                if (isScreen) {
                    const wrap = document.getElementById('webrtc-remote-screen-wrap');
                    const vid = document.getElementById('webrtc-remote-screen');
                    const badge = document.getElementById('webrtc-screen-badge');
                    if (vid) vid.srcObject = null;
                    if (wrap) wrap.classList.add('hidden');
                    if (badge) badge.classList.add('hidden');
                } else {
                    const vid = document.getElementById('webrtc-remote-video');
                    if (vid) { vid.srcObject = null; vid.classList.add('hidden'); }
                }
            };
        }
    }

    _setupVoiceCallHandlers() {
        if (!this.gateway) return;
        const g = this.gateway;
        g.on('webrtc_offer', (d) => {
            const from = d.from_user_id;
            const payload = d.payload;
            if (!payload || !from) return;
            if (this._voiceCallState.pc) return;
            this._voiceCallState.pendingOffer = { from, payload };
            this._voiceCallState.incomingFromUserId = from;
            this._showIncomingCallAlert(from);
        });
        g.on('webrtc_answer', (d) => {
            if (this._voiceCallState.pc && d.payload) this._voiceCallState.pc.setRemoteDescription(new RTCSessionDescription(d.payload)).catch(() => {});
        });
        g.on('webrtc_ice', (d) => {
            if (this._voiceCallState.pc && d.payload) this._voiceCallState.pc.addIceCandidate(new RTCIceCandidate(d.payload)).catch(() => {});
        });
        g.on('webrtc_reject', () => {
            this._voiceCallState.pendingOffer = null;
            this._voiceCallState.incomingFromUserId = null;
            this._hideIncomingCallAlert();
            if (this._voiceCallState.pc) {
                this._voiceCallState.pc.close();
                this._voiceCallState.pc = null;
                if (this._voiceCallState.stream) {
                    this._voiceCallState.stream.getTracks().forEach((t) => t.stop());
                    this._voiceCallState.stream = null;
                }
                this._webrtcClearRemote();
                const voiceView = document.getElementById('voice-call-view');
                if (voiceView) voiceView.classList.add('hidden');
                const localV = document.getElementById('webrtc-local-video');
                if (localV) localV.srcObject = null;
            }
            this.showToast('Chamada recusada.', 'info');
        });
        g.on('stream_started', () => {
            const wrap = document.getElementById('webrtc-remote-screen-wrap');
            if (wrap) wrap.classList.remove('hidden');
        });
        g.on('stream_stopped', () => {
            const wrap = document.getElementById('webrtc-remote-screen-wrap');
            const vid = document.getElementById('webrtc-remote-screen');
            const badge = document.getElementById('webrtc-screen-badge');
            if (vid) vid.srcObject = null;
            if (wrap) wrap.classList.add('hidden');
            if (badge) badge.classList.add('hidden');
        });
    }

    _showIncomingCallAlert(fromUserId) {
        this._hideIncomingCallAlert();
        const overlay = document.createElement('div');
        overlay.className = 'incoming-call-overlay';
        overlay.id = 'incoming-call-overlay';
        const fromName = this.dmChannels.find(c => c.recipients?.[0]?.id === fromUserId)?.recipients?.[0]?.username || 'Alguém';
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
        const from = pendingOffer.from;
        const payload = pendingOffer.payload;
        this._voiceCallState.pendingOffer = null;
        this._voiceCallState.targetUserId = from;
        this._voiceCallState.videoEnabled = true;
        try {
            this._voiceCallState.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch (e) {
            this.showToast('Permissão de câmara/microfone negada.', 'error');
            if (this.gateway) this.gateway.send('webrtc_reject', { target_user_id: from });
            return;
        }
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        this._voiceCallState.pc = pc;
        this._voiceCallState.stream.getTracks().forEach((track) => pc.addTrack(track, this._voiceCallState.stream));
        pc.ontrack = (e) => this._attachRemoteTrack(e);
        pc.onicecandidate = (e) => {
            if (e.candidate && this.gateway) this.gateway.send('webrtc_ice', { target_user_id: from, payload: e.candidate });
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
        pc.setRemoteDescription(new RTCSessionDescription(payload))
            .then(() => pc.createAnswer())
            .then((answer) => pc.setLocalDescription(answer))
            .then(() => { if (this.gateway) this.gateway.send('webrtc_answer', { target_user_id: from, payload: pc.localDescription }); })
            .catch((err) => console.error('Voice answer error', err));
        const voiceView = document.getElementById('voice-call-view');
        if (voiceView) voiceView.classList.remove('hidden');
        this._webrtcClearRemote();
        const localV = document.getElementById('webrtc-local-video');
        if (localV) localV.srcObject = this._voiceCallState.stream;
        const titleEl = document.getElementById('voice-call-channel-name');
        const other = (this.currentChannel?.recipients || []).find((r) => r.id === from) || this.dmChannels.find(c => c.recipients?.[0]?.id === from)?.recipients?.[0];
        if (titleEl) titleEl.textContent = other?.username ? `Chamada com ${other.username}` : 'Chamada';
        this._updateVoiceCallParticipantsBar();
        this._updateWebrtcControlButtons();
    }

    _rejectIncomingCall() {
        const from = this._voiceCallState.incomingFromUserId;
        this._voiceCallState.pendingOffer = null;
        this._voiceCallState.incomingFromUserId = null;
        this._hideIncomingCallAlert();
        if (from && this.gateway) if (this.gateway) this.gateway.send('webrtc_reject', { target_user_id: from });
    }

    _setupVoiceCallButton() {
        const btn = document.getElementById('voice-call-btn');
        const voiceView = document.getElementById('voice-call-view');
        const disconnectBtn = document.getElementById('voice-call-disconnect');
        const muteBtn = document.getElementById('voice-call-mute');
        if (!btn) return;
        const closeVoiceCall = () => {
            if (this._voiceCallState.callId && typeof API !== 'undefined' && API.Call) {
                API.Call.end(this._voiceCallState.callId).catch(() => {});
            }
            if (this._voiceCallState.stream) {
                this._voiceCallState.stream.getTracks().forEach((t) => t.stop());
                this._voiceCallState.stream = null;
            }
            if (this._voiceCallState.displayStream) {
                this._voiceCallState.displayStream.getTracks().forEach((t) => t.stop());
                this._voiceCallState.displayStream = null;
            }
            if (this._voiceCallState.pc) {
                this._voiceCallState.pc.close();
                this._voiceCallState.pc = null;
            }
            this._voiceCallState.targetUserId = null;
            this._voiceCallState.pendingOffer = null;
            this._voiceCallState.callId = null;
            if (voiceView) voiceView.classList.add('hidden');
            this._webrtcClearRemote();
            const localV = document.getElementById('webrtc-local-video');
            if (localV) localV.srcObject = null;
            const screenshareBtn = document.getElementById('voice-call-screenshare');
            if (screenshareBtn) {
                screenshareBtn.classList.remove('active');
                screenshareBtn.querySelector('span').textContent = 'Compartilhar tela';
                screenshareBtn.querySelector('i').className = 'fas fa-desktop';
            }
            const videoBtn = document.getElementById('voice-call-video');
            if (videoBtn) {
                videoBtn.classList.remove('off');
                videoBtn.querySelector('i').className = 'fas fa-video';
                videoBtn.querySelector('span').textContent = 'Vídeo';
            }
        };
        btn.addEventListener('click', async () => {
            if (!this.currentUser?.id) {
                this.showToast('Faça login para iniciar uma chamada.', 'error');
                return;
            }
            const ch = this.currentChannel;
            const isDMOrGroup = ch && (ch.type === 'dm' || ch.type === 'group_dm') && !ch.server_id;
            const others = (ch?.recipients || []).filter((r) => r.id !== this.currentUser.id);
            const targetId = others[0]?.id || null;
            if (!isDMOrGroup || !targetId) {
                this.showToast('Abra uma DM com alguém para ligar.', 'error');
                return;
            }
            try {
                this._voiceCallState.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            } catch (e) {
                this.showToast('Permissão de câmara/microfone negada ou indisponível.', 'error');
                return;
            }
            this._voiceCallState.targetUserId = targetId;
            this._voiceCallState.videoEnabled = true;
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            this._voiceCallState.stream.getTracks().forEach((track) => pc.addTrack(track, this._voiceCallState.stream));
            pc.ontrack = (e) => this._attachRemoteTrack(e);
            pc.onicecandidate = (e) => {
                if (e.candidate && this.gateway) this.gateway.send('webrtc_ice', { target_user_id: this._voiceCallState.targetUserId, payload: e.candidate });
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
            this._voiceCallState.pc = pc;
            pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
                .then(() => { if (this.gateway) this.gateway.send('webrtc_offer', { target_user_id: this._voiceCallState.targetUserId, payload: pc.localDescription }); })
                .catch((err) => console.error('Voice offer error', err));
            if (voiceView) voiceView.classList.remove('hidden');
            this._webrtcClearRemote();
            const localV = document.getElementById('webrtc-local-video');
            if (localV) localV.srcObject = this._voiceCallState.stream;
            const titleEl = document.getElementById('voice-call-channel-name');
            const other = (this.currentChannel?.recipients || []).find((r) => r.id === targetId);
            if (titleEl) titleEl.textContent = other?.username ? `Chamada com ${other.username}` : 'Chamada';
            this._updateVoiceCallParticipantsBar();
            this._updateWebrtcControlButtons();
            if (typeof API !== 'undefined' && API.Call) {
                API.Call.start(targetId, ch?.id).then((r) => { if (r && r.id) this._voiceCallState.callId = r.id; }).catch(() => {});
            }
        });
        if (disconnectBtn) disconnectBtn.addEventListener('click', closeVoiceCall);
        if (muteBtn) muteBtn.addEventListener('click', () => {
            if (this._voiceCallState.stream) {
                this._voiceCallState.stream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
                this._updateWebrtcControlButtons();
            }
        });
        const videoBtn = document.getElementById('voice-call-video');
        if (videoBtn) videoBtn.addEventListener('click', () => {
            if (!this._voiceCallState.stream || !this._voiceCallState.pc) return;
            const videoTracks = this._voiceCallState.stream.getVideoTracks();
            if (videoTracks.length === 0) return;
            this._voiceCallState.videoEnabled = !this._voiceCallState.videoEnabled;
            const track = videoTracks[0];
            track.enabled = this._voiceCallState.videoEnabled;
            const localV = document.getElementById('webrtc-local-video');
            if (localV) localV.style.opacity = this._voiceCallState.videoEnabled ? '1' : '0.3';
            this._updateWebrtcControlButtons();
        });
        const screenshareBtn = document.getElementById('voice-call-screenshare');
        if (screenshareBtn) {
            screenshareBtn.addEventListener('click', async () => {
                const pc = this._voiceCallState.pc;
                if (!pc) return;
                if (this._voiceCallState.displayStream) {
                    this._voiceCallState.displayStream.getTracks().forEach((t) => t.stop());
                    this._voiceCallState.displayStream = null;
                    const senders = pc.getSenders();
                    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
                    if (videoSender) videoSender.replaceTrack(this._voiceCallState.videoEnabled && this._voiceCallState.stream ? this._voiceCallState.stream.getVideoTracks()[0] || null : null);
                    if (this.gateway) this.gateway.send('stream_stopped', { target_user_id: this._voiceCallState.targetUserId });
                    screenshareBtn.classList.remove('active');
                    screenshareBtn.querySelector('span').textContent = 'Compartilhar tela';
                    screenshareBtn.querySelector('i').className = 'fas fa-desktop';
                    return;
                }
                try {
                    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
                    this._voiceCallState.displayStream = displayStream;
                    const videoTrack = displayStream.getVideoTracks()[0];
                    if (!videoTrack) return;
                    const senders = pc.getSenders();
                    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
                    if (videoSender) {
                        await videoSender.replaceTrack(videoTrack);
                    } else {
                        pc.addTrack(videoTrack, displayStream);
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        if (this._voiceCallState.targetUserId && this.gateway) this.gateway.send('webrtc_offer', { target_user_id: this._voiceCallState.targetUserId, payload: pc.localDescription });
                    }
                    if (this._voiceCallState.targetUserId && this.gateway) this.gateway.send('stream_started', { target_user_id: this._voiceCallState.targetUserId });
                    displayStream.getVideoTracks()[0].onended = () => {
                        if (this._voiceCallState.displayStream === displayStream) {
                            this._voiceCallState.displayStream = null;
                            const senders = pc.getSenders();
                            const vs = senders.find((s) => s.track && s.track.kind === 'video');
                            if (vs && this._voiceCallState.stream) vs.replaceTrack(this._voiceCallState.stream.getVideoTracks()[0] || null);
                            if (this.gateway) this.gateway.send('stream_stopped', { target_user_id: this._voiceCallState.targetUserId });
                            screenshareBtn.classList.remove('active');
                            screenshareBtn.querySelector('span').textContent = 'Compartilhar tela';
                            screenshareBtn.querySelector('i').className = 'fas fa-desktop';
                        }
                    };
                    screenshareBtn.classList.add('active');
                    screenshareBtn.querySelector('span').textContent = 'Parar compartilhamento';
                    screenshareBtn.querySelector('i').className = 'fas fa-stop-circle';
                } catch (err) {
                    this.showToast(err.name === 'NotAllowedError' ? 'Compartilhamento de tela cancelado.' : 'Não foi possível compartilhar a tela.', 'error');
                }
            });
        }
    }

    _updateWebrtcControlButtons() {
        const muteBtn = document.getElementById('voice-call-mute');
        const videoBtn = document.getElementById('voice-call-video');
        if (muteBtn && this._voiceCallState.stream) {
            const enabled = this._voiceCallState.stream.getAudioTracks().some((t) => t.enabled);
            muteBtn.classList.toggle('muted', !enabled);
            muteBtn.querySelector('i').className = enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
            muteBtn.querySelector('span').textContent = enabled ? 'Mute' : 'Desmutar';
        }
        if (videoBtn) {
            const on = this._voiceCallState.videoEnabled !== false;
            videoBtn.classList.toggle('off', !on);
            videoBtn.querySelector('i').className = on ? 'fas fa-video' : 'fas fa-video-slash';
            videoBtn.querySelector('span').textContent = on ? 'Vídeo' : 'Ligar vídeo';
        }
    }

    // ═══════════════════════════════════════════
    //  AUTH
    // ═══════════════════════════════════════════

    switchAuthTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === `${tab}-form`));
    }

    getOrCreateDeviceId() {
        const KEY = 'liberty_device_id';
        let id = localStorage.getItem(KEY);
        if (!id) {
            id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            localStorage.setItem(KEY, id);
        }
        return id;
    }

    /** Após login/registo: esconde auth, fecha overlay e conecta (sem modal de aviso que não existe no HTML). */
    showSecurityWarningThenConnect(loginResult) {
        this._pendingLoginResult = loginResult;
        document.getElementById('security-warning-modal')?.classList?.add('hidden');
        document.getElementById('modal-overlay')?.classList?.add('hidden');
        document.getElementById('auth-screen')?.classList?.add('hidden');
        this.connect().catch(() => {
            this.showAuth();
        }).finally(() => {
            this._pendingLoginResult = null;
        });
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
        if (!username) return;
        try {
            this._setButtonLoading(btn, true);
            const deviceId = this.getOrCreateDeviceId();
            const result = await API.Auth.login(username, undefined, deviceId);
            this.showSecurityWarningThenConnect(result);
        } catch (error) {
            this.showToast(error.message || 'Login failed', 'error');
        } finally {
            this._setButtonLoading(btn, false);
        }
    }

    async handleRegister() {
        const usernameEl = document.getElementById('register-username');
        if (!usernameEl) return;
        const username = usernameEl.value.trim();
        const btn = document.querySelector('#register-form .btn-primary');
        if (!username) return;
        try {
            this._setButtonLoading(btn, true);
            const deviceId = this.getOrCreateDeviceId();
            const result = await API.Auth.register(username, null, undefined, deviceId);
            this.showSecurityWarningThenConnect(result);
        } catch (error) {
            this.showToast(error.message || 'Falha ao registrar', 'error');
        } finally {
            this._setButtonLoading(btn, false);
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
            item.innerHTML = `
                <div class="server-icon" title="${this.escapeHtml(server.name)}">
                    ${server.icon ? `<img src="${this.escapeHtml(server.icon)}" alt="${this.escapeHtml(server.name)}">` : `<span>${initial}</span>`}
                </div>
                <span class="server-name">${this.escapeHtml(server.name)}</span>
                <div class="server-indicator"></div>
            `;
            item.addEventListener('click', () => this.selectServer(server.id));
            container.appendChild(item);
        });
    }

    selectHome() {
        this.isHomeView = true;
        this.currentHomeSubView = 'friends';
        this.currentServer = null;
        this.currentChannel = null;
        this.channels = [];
        this.members = [];
        document.querySelectorAll('.server-item').forEach(item => item.classList.toggle('active', item.classList.contains('home')));
        const serverHeader = document.querySelector('.server-header');
        if (serverHeader) serverHeader.style.display = 'none';
        this.renderHomeSidebar();
        this.renderFriendsView('online');
        this.renderActiveNow();
        this._updateChannelHeaderForContext();
        document.querySelector('.message-input-container').style.display = 'none';
    }

    renderHomeSidebar() {
        const homeContainer = document.getElementById('home-sidebar-content');
        const channelContainer = document.getElementById('channel-list');
        homeContainer.style.display = '';
        channelContainer.style.display = 'none';

        const navArea = homeContainer.querySelector('.home-nav');
        const dmList = homeContainer.querySelector('#dm-list');
        const dmSearchInput = homeContainer.querySelector('#dm-search-input');

        if (navArea) {
            navArea.querySelectorAll('.home-nav-item').forEach(btn => {
                btn.onclick = () => {
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
            dmSearchInput.oninput = (e) => {
                const q = e.target.value.toLowerCase();
                if (dmList) dmList.querySelectorAll('.dm-list-item').forEach(item => {
                    item.style.display = item.dataset.name?.toLowerCase().includes(q) || !q ? '' : 'none';
                });
            };
        }

        if (dmList) {
            dmList.innerHTML = '';
            this._loadDMList(dmList, navArea);
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
            const pending = await API.Friend.listPending?.() || [];
            const container = document.getElementById('friends-list-sidebar');
            if (!container) return;
            container.innerHTML = '';
            if (!friends || friends.length === 0) {
                container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px">Nenhum amigo adicionado ainda.</div>';
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
            if (container) container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px">Falha ao carregar amigos.</div>';
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

    async _loadDMList(dmList, navArea) {
        const avatarColors = ['#5865F2','#57F287','#FEE75C','#EB459E','#ED4245','#3BA55D','#FAA61A','#9B59B6','#E67E22','#1ABC9C'];
        let list = [];
        try {
            const raw = await API.DM.list();
            list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.channels) ? raw.channels : []);
            this.dmChannels = list;
        } catch (err) {
            this.dmChannels = [];
            dmList.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">' +
                (err.message && err.message.includes('401') ? 'Faça login para ver suas conversas.' : 'Não foi possível carregar as conversas.') + '</div>';
            return;
        }

        dmList.innerHTML = '';
        this.dmChannels.forEach((dm, idx) => {
            const isGroup = dm.type === 'group_dm';
            const displayName = isGroup ? (dm.name || (dm.recipients || []).map((r) => r.username).join(', ')) : (dm.recipients?.[0]?.username || 'Unknown');
            const recipient = dm.recipients?.[0] || { username: displayName, status: 'offline', id: null };
            const item = document.createElement('div');
            item.className = 'dm-list-item';
            item.dataset.name = displayName;
            item.dataset.dmId = dm.id || '';
            item.dataset.channelType = dm.type || 'dm';
            if (recipient.id) item.dataset.recipientId = recipient.id;
            const letter = displayName.charAt(0).toUpperCase();
            const bgColor = avatarColors[idx % avatarColors.length];
            const hasUnread = dm.id && this.unreadChannels.has(dm.id);
            if (hasUnread) item.classList.add('dm-list-item-unread');
            item.innerHTML = `
                <div class="dm-list-item-avatar ${recipient.status || 'offline'}" style="background:${bgColor}"><span style="color:#fff">${letter}</span></div>
                <div class="dm-list-item-info">
                    <div class="dm-list-item-name">${this.escapeHtml(displayName)}</div>
                    <div class="dm-list-item-msg"></div>
                </div>
                ${hasUnread ? '<span class="dm-unread-dot" aria-label="Não lida"></span>' : ''}
            `;
            item.addEventListener('click', async () => {
                dmList.querySelectorAll('.dm-list-item').forEach(d => d.classList.remove('active'));
                if (navArea) navArea.querySelectorAll('.home-nav-item').forEach(b => b.classList.remove('active'));
                item.classList.add('active');
                const channelNameEl = document.getElementById('channel-name');
                const channelIconEl = document.querySelector('.channel-header .channel-info i');
                if (channelNameEl) channelNameEl.textContent = recipient.username || displayName;
                if (channelIconEl) channelIconEl.className = 'fas fa-at channel-header-icon';

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
                    this._updateChannelUnread(channel.id, false);
                }
                document.getElementById('friends-view')?.classList?.add('hidden');
                document.getElementById('messages-container').style.display = '';
                document.querySelector('.message-input-container').style.display = '';
                if (this.currentChannel?.id && this.currentChannel.id !== channel?.id && this.gateway) this.gateway.unsubscribeChannel(this.currentChannel.id);
                this.currentChannel = channel;
                if (channel?.id && this.gateway) this.gateway.subscribeChannel(channel.id);
                this._renderDMChat(channel);
                this._updateUserControlsVoiceVisibility();
                if (channel.id) try { history.replaceState({}, '', `/channels/@me/${channel.id}`); } catch (_) {}
            });
            dmList.appendChild(item);
        });

        if (this.dmChannels.length === 0) {
            dmList.innerHTML = '<div class="dm-list-empty" id="dm-list-empty">No conversations</div>';
        }

        const pathMatch = typeof location !== 'undefined' && location.pathname && location.pathname.match(/^\/channels\/@me\/([^/]+)$/);
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
                if (channelIconEl) channelIconEl.className = 'fas fa-at channel-header-icon';
                if (this.currentChannel?.id && this.currentChannel.id !== dm?.id && this.gateway) this.gateway.unsubscribeChannel(this.currentChannel.id);
                this.currentChannel = dm;
                if (dm?.id && this.gateway) this.gateway.subscribeChannel(dm.id);
                this._renderDMChat(dm);
            }
        }
    }

    async _renderDMChat(dm) {
        const isGroup = dm.type === 'group_dm';
        const displayName = isGroup ? (dm.name || (dm.recipients || []).map((r) => r.username).join(', ')) : (dm.recipients?.[0]?.username || 'Unknown');
        const recipient = dm.recipients?.[0] || { username: displayName };
        document.getElementById('friends-view')?.classList?.add('hidden');
        const msgCont = document.getElementById('messages-container');
        if (msgCont) msgCont.style.display = '';
        const inputCont = document.querySelector('.message-input-container');
        if (inputCont) inputCont.style.display = '';

        if (this.currentChannel?.id && this.currentChannel.id !== dm?.id && this.gateway) this.gateway.unsubscribeChannel(this.currentChannel.id);
        this.currentChannel = dm;
        if (dm?.id && this.gateway) this.gateway.subscribeChannel(dm.id);

        const container = document.getElementById('messages-list');
        container.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon"><span style="font-size:30px;font-weight:700;color:var(--primary-black)">${displayName.charAt(0).toUpperCase()}</span></div>
                <h2 class="welcome-title">${this.escapeHtml(displayName)}</h2>
                <p class="welcome-description">${isGroup ? 'Group conversation.' : `This is the beginning of your direct message history with <strong>${this.escapeHtml(recipient.username)}</strong>.`}</p>
            </div>
        `;

        if (dm.id) {
            try {
                const messages = await API.DM.getMessages(dm.id, { limit: 50 });
                if (messages && messages.length > 0) {
                    messages.reverse().forEach(m => this.addMessage(m, false));
                }
            } catch { /* empty */ }
        }

        this.scrollToBottom();
        document.getElementById('message-input').placeholder = isGroup ? `Message ${this.escapeHtml(displayName)}` : `Message @${recipient.username}`;
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
                .then((list) => {
                    const accepted = Array.isArray(list) ? list.filter((r) => r.type === 1) : [];
                    if (accepted.length === 0) {
                        noFriendsEl.textContent = 'Add and accept friends first to create a group.';
                        noFriendsEl.classList.remove('hidden');
                        return;
                    }
                    accepted.forEach((r) => {
                        const u = r.user || {};
                        const id = u.id || r.friend_id;
                        const username = u.username || r.username || 'User';
                        const row = document.createElement('label');
                        row.className = 'create-group-friend-row';
                        row.innerHTML = `<input type="checkbox" data-id="${this.escapeHtml(id)}" data-username="${this.escapeHtml(username).replace(/"/g, '&quot;')}"><span>${this.escapeHtml(username)}</span>`;
                        row.addEventListener('click', (e) => { if (e.target.type !== 'checkbox') row.querySelector('input').click(); });
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
            const ids = Array.from(listEl.querySelectorAll('input:checked')).map((c) => c.dataset.id);
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
                const dmList = document.getElementById('dm-list');
                const navArea = document.querySelector('.home-nav');
                if (dmList) {
                    dmList.innerHTML = '';
                    this._loadDMList(dmList, navArea);
                }
                this.showToast('Group created.', 'success');
            } catch (err) {
                this.showToast(err.message || 'Failed to create group.', 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });
        document.querySelectorAll('[data-close="create-group-modal"]').forEach((el) => el.addEventListener('click', closeModal));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    }

    async renderFriendsView(tab) {
        this.currentFriendsTab = tab || 'online';
        tab = this.currentFriendsTab;

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
        const headerStyle = 'padding:8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text-secondary)';

        if (tab === 'online') {
            const online = friends.filter(f => f.user?.status !== 'offline');
            bodyHtml += `<div style="${headerStyle}">Online — ${online.length}</div>`;
            online.forEach(f => { bodyHtml += this._friendItemHtml(f); });
            if (online.length === 0) bodyHtml += '<div style="padding:20px;text-align:center;color:var(--text-muted)">No friends online</div>';
        } else if (tab === 'all') {
            bodyHtml += `<div style="${headerStyle}">All Friends — ${friends.length}</div>`;
            friends.forEach(f => { bodyHtml += this._friendItemHtml(f); });
            if (friends.length === 0) bodyHtml += '<div style="padding:20px;text-align:center;color:var(--text-muted)">No friends yet. Add some!</div>';
        } else if (tab === 'pending') {
            bodyHtml += `<div style="${headerStyle}">Pendentes — ${pending.length}</div>`;
            pending.forEach(p => {
                const u = p.user || { username: 'Unknown' };
                const isIncoming = p.type === 3;
                bodyHtml += `<div class="friend-item" data-user="${u.id}" data-rel-id="${p.id}">
                    <div class="friend-item-avatar offline"><span>${(u.username || 'U').charAt(0)}</span></div>
                    <div class="friend-item-info">
                        <div class="friend-item-name">${this.escapeHtml(u.username)}</div>
                        <div class="friend-item-status">${isIncoming ? 'Convite recebido' : 'Pedido enviado'}</div>
                    </div>
                    <div class="friend-item-actions">
                        ${isIncoming ? '<button title="Accept"><i class="fas fa-check"></i></button><button title="Deny"><i class="fas fa-times"></i></button>' : '<button title="Cancel"><i class="fas fa-times"></i></button>'}
                    </div>
                </div>`;
            });
            if (pending.length === 0) bodyHtml += '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhum pedido pendente</div>';
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
                    const u = p.user || { username: 'Unknown' };
                    bodyHtml += `<div class="friend-item" data-user="${u.id}" data-rel-id="${p.id}">
                        <div class="friend-item-avatar offline"><span>${(u.username || 'U').charAt(0)}</span></div>
                        <div class="friend-item-info">
                            <div class="friend-item-name">${this.escapeHtml(u.username)}</div>
                            <div class="friend-item-status">Convite recebido</div>
                        </div>
                        <div class="friend-item-actions">
                            <button title="Accept"><i class="fas fa-check"></i></button>
                            <button title="Deny"><i class="fas fa-times"></i></button>
                        </div>
                    </div>`;
                });
            }
        } else if (tab === 'blocked') {
            bodyHtml += `<div style="${headerStyle}">Blocked — ${blocked.length}</div>`;
            blocked.forEach(b => {
                const u = b.user || { username: 'Unknown' };
                bodyHtml += `<div class="friend-item" data-user="${u.id}" data-rel-id="${b.id}">
                    <div class="friend-item-avatar offline"><span>${u.username.charAt(0)}</span></div>
                    <div class="friend-item-info"><div class="friend-item-name">${this.escapeHtml(u.username)}</div><div class="friend-item-status">Blocked</div></div>
                    <div class="friend-item-actions"><button title="Unblock"><i class="fas fa-user-slash"></i></button></div>
                </div>`;
            });
        } else if (tab === 'add') {
            bodyHtml = '';
        }

        if (friendsList) friendsList.innerHTML = bodyHtml;

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
                                if (channelIconEl) channelIconEl.className = 'fas fa-at channel-header-icon';
                                if (this.currentChannel?.id && this.currentChannel.id !== channel?.id && this.gateway) this.gateway.unsubscribeChannel(this.currentChannel.id);
                                this.currentChannel = channel;
                                if (channel?.id && this.gateway) this.gateway.subscribeChannel(channel.id);
                                this._renderDMChat(channel);
                                if (channel.id) try { history.replaceState({}, '', `/channels/@me/${channel.id}`); } catch (_) {}
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
                    this.showProfileCard({ user_id: rel.user.id, username: rel.user.username, status: rel.user.status || 'offline' }, e);
                }
            });
        });

        const friendsSearchInput = friendsView.querySelector('#friends-search-input');
        if (friendsSearchInput) {
            friendsSearchInput.oninput = (e) => {
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
        friendsList.innerHTML = '<div class="ranking-loading" style="padding:24px;text-align:center;color:var(--text-muted)">A carregar ranking…</div>';
        this._updateUserControlsVoiceVisibility();
        try {
            const data = await API.Ranking.list(10);
            const byActivity = data?.by_activity || [];
            const byContent = data?.by_content || [];
            const renderRankRow = (row, type) => {
                const name = (row.username || 'User').trim();
                const displayName = name.slice(0, 2).toUpperCase().replace(/\s/g, '') || 'U';
                const progress = type === 'activity' ? this._rankingActivityProgress(row.minutes) : this._rankingXpProgress(row.xp);
                const levelLabel = row.level != null && row.level > 0 ? row.level : 'UNKNOWN';
                const stat = type === 'activity'
                    ? `${this._formatActivityTime(row.minutes || 0)} · Nível ${levelLabel}`
                    : `${row.xp || 0} XP · Nível ${levelLabel}`;
                return `<div class="ranking-item" data-user-id="${this.escapeHtml(row.id)}">
                    <span class="ranking-item-rank">#${row.rank}</span>
                    <div class="ranking-bar-wrap">
                        <div class="ranking-bar-fill" style="width:${Math.max(12, progress)}%">
                            <span class="ranking-bar-name">${this.escapeHtml(displayName)}</span>
                        </div>
                    </div>
                    <div class="ranking-bar-detail">${this.escapeHtml(name)} ${stat}</div>
                </div>`;
            };
            const html = `
                <div class="ranking-view">
                    <div class="ranking-header">
                        <i class="fas fa-trophy ranking-icon" aria-hidden="true"></i>
                        <h2>LIBERTY Ranking</h2>
                        <p>Community activity and levels</p>
                    </div>
                    <div class="ranking-tables">
                        <div class="ranking-table">
                            <h3><i class="fas fa-clock" aria-hidden="true"></i> By Activity</h3>
                            <p class="ranking-desc">Time in app (incl. background). 5 min → Level 1, each level +20%</p>
                            <div class="ranking-list">
                                ${byActivity.length ? byActivity.map(r => renderRankRow(r, 'activity')).join('') : '<div class="ranking-empty">Ainda não há atividade.</div>'}
                            </div>
                        </div>
                        <div class="ranking-table">
                            <h3><i class="fas fa-star" aria-hidden="true"></i> By Content (XP)</h3>
                            <p class="ranking-desc">1 char = 1 XP. Files = 2.5x size. 500 XP → Level 1, each level +20%</p>
                            <div class="ranking-list">
                                ${byContent.length ? byContent.map(r => renderRankRow(r, 'content')).join('') : '<div class="ranking-empty">Ainda não há conteúdo.</div>'}
                            </div>
                        </div>
                    </div>
                    <div class="ranking-footer">
                        <i class="fas fa-lock" aria-hidden="true"></i>
                        <span class="ranking-footer-encryption">End-to-end encryption</span>
                        <span class="ranking-footer-badge">AES-GCM</span>
                    </div>
                </div>`;
            friendsList.innerHTML = html;
            friendsList.classList.add('ranking-container');
        } catch (err) {
            friendsList.innerHTML = '<div class="ranking-empty" style="padding:24px;text-align:center;color:var(--error)">Falha ao carregar ranking.</div>';
            friendsList.classList.remove('ranking-container');
        }
    }

    _friendItemHtml(rel) {
        const u = rel.user || { id: rel.target_id, username: 'Unknown', status: 'offline' };
        return `<div class="friend-item" data-user="${u.id}" data-rel-id="${rel.id}">
            <div class="friend-item-avatar ${u.status || 'offline'}"><span>${u.username.charAt(0)}</span></div>
            <div class="friend-item-info">
                <div class="friend-item-name">${this.escapeHtml(u.username)}</div>
                <div class="friend-item-status">${this._statusLabel(u.status || 'offline')}</div>
            </div>
            <div class="friend-item-actions">
                <button title="Message"><i class="fas fa-comment"></i></button>
                <button title="Voice Call"><i class="fas fa-phone"></i></button>
                <button title="Video Call"><i class="fas fa-video"></i></button>
                <button title="More"><i class="fas fa-ellipsis-v"></i></button>
            </div>
        </div>`;
    }

    _statusLabel(s) {
        return { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline', invisible: 'Invisible' }[s] || 'Online';
    }

    _updateChannelHeaderForContext() {
        const header = document.querySelector('.channel-header');
        if (!header) return;
        const info = header.querySelector('.channel-info');
        const actions = header.querySelector('.channel-actions');
        const isDM = this.currentChannel && (this.currentChannel.type === 'dm' || this.currentChannel.type === 'group_dm') && !this.currentChannel.server_id;

        // Botões só para DM: Voz, Vídeo, Compartilhar tela
        const voiceBtn = document.getElementById('voice-call-btn');
        const videoBtn = document.getElementById('video-call-btn');
        const screenShareBtn = document.getElementById('screen-share-header-btn');
        header.querySelectorAll('.dm-only-action').forEach(el => { el.style.display = isDM ? '' : 'none'; });
        header.querySelectorAll('.channel-only-action').forEach(el => { el.style.display = isDM ? 'none' : ''; });
        if (videoBtn && isDM) videoBtn.style.display = '';
        if (screenShareBtn && isDM) screenShareBtn.style.display = '';

        if (isDM) {
            const recipient = (this.currentChannel?.recipients || [])[0] || {};
            const name = recipient.username || this.currentChannel?.name || 'DM';
            const status = recipient.status || 'offline';
            const avatar = recipient.avatar || null;
            const initial = name.charAt(0).toUpperCase();
            info.innerHTML = `
                <div class="dm-header-avatar ${status}" aria-hidden="true">${avatar ? `<img src="${this.escapeHtml(avatar)}" alt="">` : `<span>${this.escapeHtml(initial)}</span>`}</div>
                <h3 id="channel-name">${this.escapeHtml(name)}</h3>
                <div class="channel-header-divider" aria-hidden="true"></div>
                <span class="channel-topic dm-status" id="channel-topic">${this._statusLabel(status)}</span>
            `;
        } else if (this.isHomeView && this.currentHomeSubView === 'rankings') {
            info.innerHTML = `
                <i class="fas fa-trophy channel-header-icon" id="channel-header-icon" aria-hidden="true"></i>
                <h3 id="channel-name">LIBERTY Rankings</h3>
                <div class="channel-header-divider" aria-hidden="true"></div>
                <span class="channel-topic" id="channel-topic">Quem mais fica e comenta</span>
            `;
        } else if (this.isHomeView) {
            this.currentHomeSubView = this.currentHomeSubView || 'friends';
            const tab = this.currentFriendsTab || 'online';
            info.innerHTML = `
                <i class="fas fa-user-friends channel-header-icon" aria-hidden="true"></i>
                <h3>Amigos</h3>
                <div class="channel-header-divider" aria-hidden="true"></div>
                <div class="friends-header-tabs">
                    <button class="friends-header-tab ${tab === 'online' ? 'active' : ''}" data-htab="online">Online</button>
                    <button class="friends-header-tab ${tab === 'all' ? 'active' : ''}" data-htab="all">Todos</button>
                    <button class="friends-header-tab ${tab === 'pending' ? 'active' : ''}" data-htab="pending">Pendentes</button>
                    <button class="friends-header-tab ${tab === 'invites' ? 'active' : ''}" data-htab="invites">Convites recebidos</button>
                    <button class="friends-header-tab ${tab === 'blocked' ? 'active' : ''}" data-htab="blocked">Bloqueados</button>
                    <button class="friends-header-tab add-friend ${tab === 'add' ? 'active' : ''}" data-htab="add">Add Friend</button>
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
            const icon = ch?.channel_type === 'voice' ? 'fa-volume-up' : 'fa-hashtag';
            const name = ch?.name || 'general';
            const topic = ch?.topic || '';
            info.innerHTML = `
                <i class="fas ${icon} channel-header-icon" id="channel-header-icon" aria-hidden="true"></i>
                <h3 id="channel-name">${this.escapeHtml(name)}</h3>
                <div class="channel-header-divider" aria-hidden="true"></div>
                <span class="channel-topic" id="channel-topic">${this.escapeHtml(topic)}</span>
            `;
        }
        if (isDM) this._wireDMHeaderVoiceVideoButtons();
        this._updateUserControlsVoiceVisibility();
    }

    _updateUserControlsVoiceVisibility() {
        const voiceEl = document.getElementById('user-controls-voice');
        if (!voiceEl) return;
        const inDM = !this.isHomeView && this.currentChannel && (this.currentChannel.type === 'dm' || this.currentChannel.type === 'group_dm') && !this.currentChannel.server_id;
        voiceEl.classList.toggle('hidden', !inDM);
    }

    _updateVoiceCallButtonVisibility() {
        const btn = document.getElementById('voice-call-btn');
        if (!btn) return;
        const isDMOrGroup = this.currentChannel && (this.currentChannel.type === 'dm' || this.currentChannel.type === 'group_dm') && !this.currentChannel.server_id;
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
        let other = (this.currentChannel?.recipients || []).find((r) => r.id === targetId);
        if (!other && targetId && Array.isArray(this.dmChannels)) {
            const dm = this.dmChannels.find((c) => c.recipients?.some((r) => r.id === targetId));
            other = dm?.recipients?.find((r) => r.id === targetId);
        }
        const otherName = other?.username || 'Outro';
        const otherInitial = otherName.charAt(0).toUpperCase();
        bar.innerHTML = `
            <span class="participant-avatar you" title="${this.escapeHtml(me)}">${this.escapeHtml(meInitial)}</span>
            <span class="participant-avatar" title="${this.escapeHtml(otherName)}">${this.escapeHtml(otherInitial)}</span>
        `;
    }

    renderActiveNow() {
        const membersSidebar = document.getElementById('members-sidebar');
        const membersList = document.getElementById('members-list');
        if (!membersSidebar) return;

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

    async selectServer(serverId) {
        this.isHomeView = false;
        document.querySelectorAll('.server-item').forEach(item => item.classList.toggle('active', item.dataset.server === serverId));
        const server = this.servers.find(s => s.id === serverId);
        if (!server) return;
        this.currentServer = server;
        const serverNameEl = document.getElementById('server-name');
        if (serverNameEl) serverNameEl.textContent = server.name;
        const serverHeader = document.querySelector('.server-header');
        if (serverHeader) serverHeader.style.display = '';
        { const _b = document.getElementById('server-dropdown-btn'); if (_b) { _b.querySelector('i').className = 'fas fa-chevron-down'; _b.style.display = ''; } }

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
        this.disconnectVoice();
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
            const textChannel = this.channels.find(c => c.channel_type === 'text' && c.type !== 'category');
            if (textChannel) this.selectChannel(textChannel.id);
        } catch (err) {
            this.showToast('Failed to load server', 'error');
        }
    }

    async handleCreateServer() {
        const name = document.getElementById('server-name-input').value.trim();
        const region = document.getElementById('server-region').value;
        const btn = document.querySelector('#create-server-form .btn-primary');
        if (!name) return;
        try {
            this._setButtonLoading(btn, true);
            const data = await API.Server.create(name, region);
            if (data.server) {
                if (!this.servers.some(s => s.id === data.server.id)) {
                    this.servers.push(data.server);
                }
                this.renderServers();
                this.selectServer(data.server.id);
            }
            this.hideModal();
            this.showToast(`Server "${name}" created!`, 'success');
        } catch (error) {
            this.showToast(error.message || 'Failed to create server', 'error');
        } finally {
            this._setButtonLoading(btn, false);
        }
    }

    // ═══════════════════════════════════════════
    //  SERVER HEADER DROPDOWN
    // ═══════════════════════════════════════════

    toggleServerDropdown(e) {
        if (this._serverDropdown) { this.hideServerDropdown(); return; }
        const header = document.querySelector('.server-header');
        const dd = document.createElement('div');
        dd.className = 'server-dropdown';
        const items = [
            { icon: 'fa-rocket', label: 'Server Boost', action: () => this.showToast('Server Boost — Coming Soon!', 'info') },
            { icon: 'fa-user-plus', label: 'Invite People', action: () => this.showInviteModal() },
            { icon: 'fa-cog', label: 'Server Settings', action: () => this.showSettingsPanel('server') },
            { divider: true },
            { icon: 'fa-plus', label: 'Create Channel', action: () => this.showCreateChannelModal() },
            { icon: 'fa-folder-plus', label: 'Create Category', action: () => this._createCategory() },
            { divider: true },
            { icon: 'fa-bell', label: 'Notification Settings', action: () => this.showToast('Notification settings updated', 'info') },
            { icon: 'fa-shield-alt', label: 'Privacy Settings', action: () => this.showToast('Privacy settings opened', 'info') },
            { icon: 'fa-id-badge', label: 'Edit Server Profile', action: () => this.showToast('Edit your server profile', 'info') },
            { icon: 'fa-eye-slash', label: 'Hide Muted Channels', action: () => this.showToast('Muted channels hidden', 'info') },
            { divider: true },
            { icon: 'fa-sign-out-alt', label: 'Leave Server', danger: true, action: () => { if (this.gateway) this.gateway.leaveServer(this.currentServer?.id); this.showToast('Left the server', 'info'); this.selectHome(); } },
        ];
        dd.innerHTML = items.map(item => {
            if (item.divider) return '<div class="dropdown-divider"></div>';
            return `<div class="dropdown-item ${item.danger ? 'danger' : ''}"><i class="fas ${item.icon}" style="width:20px;text-align:center"></i>${this.escapeHtml(item.label)}</div>`;
        }).join('');
        let idx = 0;
        dd.querySelectorAll('.dropdown-item').forEach(el => {
            const realItems = items.filter(i => !i.divider);
            const action = realItems[idx]?.action;
            el.addEventListener('click', () => { this.hideServerDropdown(); if (action) action(); });
            idx++;
        });
        header.style.position = 'relative';
        header.appendChild(dd);
        this._serverDropdown = dd;
    }

    hideServerDropdown() {
        if (this._serverDropdown) { this._serverDropdown.remove(); this._serverDropdown = null; }
    }

    _createCategory() {
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
            container.innerHTML = '<div class="empty-state" style="padding:24px 16px;text-align:center"><i class="fas fa-hashtag" style="font-size:28px;color:var(--text-muted);margin-bottom:12px;display:block;opacity:.7"></i><p class="empty-state-description" style="margin-bottom:12px">No channels yet</p><button class="btn btn-primary btn-sm" type="button">Create Channel</button></div>';
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
                    <i class="fas fa-chevron-down"></i>
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
        const icon = isVoice ? 'fa-volume-up' : 'fa-hashtag';
        if (isVoice) item.classList.add('voice');
        const unread = this.unreadChannels.has(channel.id);
        item.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${this.escapeHtml(channel.name || 'unnamed')}</span>
            ${unread ? '<div class="channel-unread-dot"></div>' : ''}
        `;
        item.addEventListener('click', () => {
            if (isVoice) { this.connectVoice(channel); }
            else { this.selectChannel(channel.id); }
        });
        return item;
    }

    async selectChannel(channelId) {
        const prevId = this.currentChannel?.id;
        if (prevId && prevId !== channelId && this.gateway) this.gateway.unsubscribeChannel(prevId);
        this.unreadChannels.delete(channelId);
        document.querySelectorAll('.channel-item').forEach(item => item.classList.toggle('active', item.dataset.channel === channelId));
        const channel = this.channels.find(c => c.id === channelId);
        if (!channel) return;
        this.currentChannel = channel;
        if (channelId && this.gateway) this.gateway.subscribeChannel(channelId);

        const friendsView = document.getElementById('friends-view');
        const messagesContainer = document.getElementById('messages-container');
        if (friendsView) friendsView.classList.add('hidden');
        if (messagesContainer) messagesContainer.style.display = '';
        document.querySelector('.message-input-container').style.display = '';

        document.getElementById('message-input').placeholder = `Message #${channel.name}`;
        const icon = channel.channel_type === 'voice' ? 'fa-volume-up' : 'fa-hashtag';
        this._updateChannelHeaderForContext();
        this.typing.clear();
        this.renderTypingIndicator();
        this.cancelReply();
        await this.loadMessages(channelId);
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
            this.localStream.getAudioTracks().forEach(t => { t.enabled = !this.isMuted; });
            this.showToast(`Entrou em ${this.voiceChannel?.name || 'voice'} — microfone ativo`, 'success');
            if (this.voiceChannel) this._updateVoiceCallControlsState();
        } catch (err) {
            const msg = err.name === 'NotAllowedError'
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
            <i class="fas fa-volume-up channel-header-icon" aria-hidden="true"></i>
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
        const status = this.isMuted ? 'Muted' : (this.isDeafened ? 'Deafened' : 'Connected');
        const statusClass = this.isMuted ? 'muted' : 'listening';
        container.innerHTML = `
            <div class="voice-call-participant you ${this.isMuted ? 'muted' : ''}">
                <div class="voice-call-participant-avatar">${initial}</div>
                <div class="voice-call-participant-name">${this.escapeHtml(name)} (você)</div>
                <div class="voice-call-participant-status ${statusClass}">${status}</div>
            </div>
            <div class="voice-call-participant" style="border-style:dashed;opacity:.7">
                <div class="voice-call-participant-avatar" style="font-size:24px"><i class="fas fa-user-plus"></i></div>
                <div class="voice-call-participant-name">Aguardando...</div>
                <div class="voice-call-participant-status">Outros na chamada aparecerão aqui</div>
            </div>
        `;
    }

    _wireVoiceCallControls() {
        const muteBtn = document.getElementById('voice-call-mute');
        const deafenBtn = document.getElementById('voice-call-deafen');
        const disconnectBtn = document.getElementById('voice-call-disconnect');
        if (muteBtn) muteBtn.onclick = () => { this.toggleMute(); this._updateVoiceCallControlsState(); };
        if (deafenBtn) deafenBtn.onclick = () => { this.toggleDeafen(); this._updateVoiceCallControlsState(); };
        if (disconnectBtn) disconnectBtn.onclick = () => this.disconnectVoice();
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
            if (icon) icon.className = this.isDeafened ? 'fas fa-headphones-alt' : 'fas fa-headphones';
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

        if (voiceView) voiceView.classList.add('hidden');
        if (messagesContainer) messagesContainer.style.display = '';
        if (messageInputContainer) messageInputContainer.style.display = '';
        if (voiceConnectedBar) voiceConnectedBar.classList.add('hidden');

        this.voiceChannel = null;
        const panel = document.querySelector('.voice-panel');
        if (panel) panel.remove();

        const ch = this.channels.find(c => c.channel_type === 'text');
        if (ch) {
            if (this.currentChannel?.id && this.currentChannel.id !== ch.id && this.gateway) this.gateway.unsubscribeChannel(this.currentChannel.id);
            this.currentChannel = ch;
            if (ch.id && this.gateway) this.gateway.subscribeChannel(ch.id);
            const nameEl = document.getElementById('channel-name');
            const topicEl = document.getElementById('channel-topic');
            if (nameEl) nameEl.textContent = ch.name;
            if (topicEl) topicEl.textContent = ch.topic || '';
            this._updateChannelHeaderForContext();
            this.loadMessages(ch.id);
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
                    <div class="voice-panel-channel">${this.escapeHtml(this.voiceChannel?.name || 'Unknown')}</div>
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
            this.localStream.getAudioTracks().forEach(t => { t.enabled = !this.isMuted; });
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
            icon.className = 'fas fa-headphones-alt';
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
        if (this._statusPicker) { this.hideStatusPicker(); return; }
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
        picker.innerHTML = statuses.map(s =>
            `<div class="status-picker-item" data-status="${s.key}"><div class="status-dot ${s.color}"></div>${s.label}</div>`
        ).join('') + `
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
        if (this._statusPicker) { this._statusPicker.remove(); this._statusPicker = null; }
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
        document.getElementById('members-sidebar')?.classList?.toggle('collapsed', !this.membersSidebarVisible);
        document.getElementById('toggle-members-btn')?.classList?.toggle('active', this.membersSidebarVisible);
    }

    toggleSearchPanel() {
        if (this._searchPanel) { this.hideSearchPanel(); return; }
        const mainContent = document.querySelector('.main-content');
        const panel = document.createElement('div');
        panel.className = 'search-panel';
        panel.innerHTML = `
            <div class="search-panel-header">
                <input type="text" placeholder="Search messages...">
                <button class="btn-icon" title="Close"><i class="fas fa-times"></i></button>
            </div>
            <div class="search-panel-results">
                <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">
                    <i class="fas fa-search" style="font-size:32px;margin-bottom:12px;display:block;opacity:.5"></i>
                    Type to search messages in this channel
                </div>
            </div>
        `;
        panel.querySelector('button').addEventListener('click', () => this.hideSearchPanel());
        panel.querySelector('input').addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            const results = panel.querySelector('.search-panel-results');
            if (!q) {
                results.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px"><i class="fas fa-search" style="font-size:32px;margin-bottom:12px;display:block;opacity:.5"></i>Type to search messages in this channel</div>';
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
            results.innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">No results found</div>';
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
        if (this._searchPanel) { this._searchPanel.remove(); this._searchPanel = null; }
    }

    async togglePinnedPanel() {
        if (this._pinnedPanel) { this.hidePinnedPanel(); return; }
        if (!this.currentChannel) return;

        const mainContent = document.querySelector('.main-content');
        const panel = document.createElement('div');
        panel.className = 'pinned-panel';
        panel.innerHTML = `
            <div class="pinned-panel-header">
                <span>Pinned Messages</span>
                <button class="btn-icon" style="width:24px;height:24px;font-size:12px"><i class="fas fa-times"></i></button>
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
                list.innerHTML = '<div style="padding:30px 20px;text-align:center;color:var(--text-muted);font-size:13px"><i class="fas fa-thumbtack" style="font-size:24px;margin-bottom:8px;display:block;opacity:.5"></i>No pinned messages in this channel yet.</div>';
            } else {
                list.innerHTML = '';
                pins.forEach(pm => {
                    const authorName = pm.author?.username || 'Unknown';
                    const date = pm.created_at ? new Date(pm.created_at).toLocaleString() : '';
                    list.innerHTML += `<div class="pinned-msg"><div class="pinned-msg-author">${this.escapeHtml(authorName)}</div><div class="pinned-msg-text">${this.escapeHtml(pm.content || '')}</div><div class="pinned-msg-date">${this.escapeHtml(date)}</div></div>`;
                });
            }
        } catch {
            list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Failed to load pinned messages</div>';
        }
    }

    hidePinnedPanel() {
        if (this._pinnedPanel) { this._pinnedPanel.remove(); this._pinnedPanel = null; }
    }

    showHelp() {
        this.createModal('help-modal', 'Help — LIBERTY', `
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
        `);
        this.showModal('help-modal');
        document.getElementById('help-modal').querySelector('[data-action="close"]').addEventListener('click', () => this.hideModal());
    }

    // ═══════════════════════════════════════════
    //  MESSAGES
    // ═══════════════════════════════════════════

    async loadMessages(channelId) {
        const container = document.getElementById('messages-list');
        container.innerHTML = `
            <div class="messages-loading">
                <div class="message-skeleton"><div class="skeleton message-skeleton-avatar"></div><div class="message-skeleton-body"><div class="skeleton message-skeleton-line short"></div><div class="skeleton message-skeleton-line"></div><div class="skeleton message-skeleton-line" style="width:80%"></div></div></div>
                <div class="message-skeleton"><div class="skeleton message-skeleton-avatar"></div><div class="message-skeleton-body"><div class="skeleton message-skeleton-line short"></div><div class="skeleton message-skeleton-line"></div></div></div>
                <div class="message-skeleton"><div class="skeleton message-skeleton-avatar"></div><div class="message-skeleton-body"><div class="skeleton message-skeleton-line short"></div><div class="skeleton message-skeleton-line"></div><div class="skeleton message-skeleton-line" style="width:70%"></div></div></div>
            </div>`;
        try {
            const messages = await API.Message.list(channelId, { limit: 50 });
            container.innerHTML = '';
            if (!messages || messages.length === 0) {
                container.innerHTML = `
                    <div class="welcome-message">
                        <div class="welcome-icon"><i class="fas fa-hashtag"></i></div>
                        <h2 class="welcome-title">Bem-vindo a #${this.escapeHtml(this.currentChannel?.name || 'canal')}</h2>
                        <p class="welcome-description">Este é o início do canal.</p>
                        <p class="welcome-encryption"><i class="fas fa-lock"></i> End-to-end encryption AES-GCM</p>
                    </div>
                `;
                return;
            }
            // O backend já retorna as mensagens em ordem cronológica (mais antiga -> mais recente),
            // inclusive quando vem do cache em memória. Basta renderizar na ordem recebida.
            messages.forEach(msg => this.addMessage(msg, false));
            this.scrollToBottom();
        } catch {
            container.innerHTML = '<div class="empty-state"><p class="empty-state-description">Failed to load messages.</p></div>';
        }
    }

    _authorColor(author) {
        let h = 0;
        const s = (author || '').toString();
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return `hsl(${h % 360}, 55%, 65%)`;
    }

    addMessage(message, scroll = true) {
        const container = document.getElementById('messages-list');
        const welcomeEl = container.querySelector('.welcome-message');
        if (welcomeEl && !container.querySelector('.message-group')) welcomeEl.style.display = 'none';

        const time = new Date(message.created_at || Date.now());
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = this._formatDate(time);
        const isToday = time.toDateString() === new Date().toDateString();
        const headerTimeStr = isToday ? timeStr : `${dateStr} ${timeStr}`;
        const authorName = message.author?.username || message.author_username || message.username || this.currentUser?.username || 'User';
        const authorAvatar = message.author?.avatar || message.avatar || null;
        const avatarLetter = authorName.charAt(0).toUpperCase();
        const isSelf = this.currentUser && (message.author?.id === this.currentUser.id || message.author_id === this.currentUser.id);

        const authorId = message.author?.id || message.author_id || '';
        const lastGroup = container.querySelector('.message-group:last-of-type');
        const sameAuthorById = authorId && lastGroup?.dataset.authorId === String(authorId);
        const sameAuthorByName = lastGroup && lastGroup.dataset.author === authorName;
        const isContinuation = lastGroup && (sameAuthorById || sameAuthorByName);

        const messageEl = document.createElement('div');
        messageEl.className = 'message-group' + (isContinuation ? ' message-group--continuation' : '');
        messageEl.dataset.message = message.id;
        messageEl.dataset.author = authorName;
        if (authorId) messageEl.dataset.authorId = String(authorId);

        messageEl.innerHTML = `
            <div class="message-avatar">
                ${authorAvatar ? `<img src="${this.escapeHtml(authorAvatar)}" alt="${this.escapeHtml(authorName)}">` : `<span>${avatarLetter}</span>`}
            </div>
            <div class="message-content">
                ${message.replyTo ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:2px;display:flex;align-items:center;gap:4px"><i class="fas fa-reply" style="font-size:10px"></i> Replying to <strong style="color:var(--primary-yellow)">${this.escapeHtml(message.replyTo.author)}</strong></div>` : ''}
                ${!isContinuation ? `<div class="message-header">
                    <span class="message-author ${isSelf ? 'self' : ''}">${this.escapeHtml(authorName)}</span>
                    <span class="message-timestamp" title="${time.toLocaleString()}">${headerTimeStr}</span>
                </div>` : ''}
                <div class="message-text">${this._parseMessageContent(message.content)}</div>
                <div class="reactions-container"></div>
            </div>
            <div class="message-actions">
                <button class="btn-icon" data-action="react" title="Add Reaction" style="width:28px;height:28px"><i class="fas fa-smile"></i></button>
                <button class="btn-icon" data-action="reply" title="Reply" style="width:28px;height:28px"><i class="fas fa-reply"></i></button>
                ${isSelf ? '<button class="btn-icon" data-action="edit" title="Edit" style="width:28px;height:28px"><i class="fas fa-pencil-alt"></i></button>' : ''}
                <button class="btn-icon" data-action="more" title="More" style="width:28px;height:28px"><i class="fas fa-ellipsis-h"></i></button>
            </div>
        `;

        // Message action button handlers
        messageEl.querySelectorAll('.message-actions .btn-icon').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const action = btn.dataset.action;
                if (action === 'react') {
                    this.showEmojiPicker(btn, emoji => this.addReaction(message.id, emoji));
                } else if (action === 'reply') {
                    this.startReply(message.id, authorName, message.content);
                } else if (action === 'edit') {
                    this.startEditMessage(message.id, message.content);
                } else if (action === 'more') {
                    this.showMessageContextMenu(messageEl, e);
                }
            });
        });

        // Open profile card when clicking avatar or author name
        const authorPayload = { user_id: message.author?.id || message.author_id, username: authorName, nickname: message.author?.nickname, status: message.author?.status || 'online' };
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

        // Store message data
        this.messages.set(message.id, { ...message, authorName, isSelf });

        // Init reactions
        if (!this.reactions.has(message.id)) this.reactions.set(message.id, []);
        this.renderReactions(messageEl, message.id);

        container.appendChild(messageEl);
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
        textEl.querySelector('[data-action="cancel"]').addEventListener('click', () => this.cancelEditMessage(messageId, originalContent));
        textEl.querySelector('[data-action="save"]').addEventListener('click', () => this.saveEditMessage(messageId, textarea.value));
    }

    saveEditMessage(messageId, newContent) {
        if (!newContent.trim()) return;
        const msgEl = document.querySelector(`[data-message="${messageId}"]`);
        if (!msgEl) return;
        const textEl = msgEl.querySelector('.message-text');
        textEl.innerHTML = this._parseMessageContent(newContent) + '<span class="message-edited">(edited)</span>';
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
        this.createModal('delete-msg-modal', 'Delete Message', `
            <p class="modal-description">Are you sure you want to delete this message? This action cannot be undone.</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">Cancel</button>
                <button class="btn btn-danger" data-action="delete">Delete</button>
            </div>
        `);
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
        replyBar.innerHTML = `<i class="fas fa-reply" style="color:var(--primary-yellow);font-size:12px"></i><span>Replying to <strong>${this.escapeHtml(authorName)}</strong> — ${this.escapeHtml(short)}${content && content.length > 80 ? '...' : ''}</span><button title="Cancel"><i class="fas fa-times"></i></button>`;
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
            } catch { /* optimistic update already applied */ }
        }
    }

    renderReactions(messageEl, messageId) {
        const container = messageEl.querySelector('.reactions-container');
        if (!container) return;
        const reactions = this.reactions.get(messageId) || [];
        if (reactions.length === 0) { container.innerHTML = ''; return; }
        const selfId = this.currentUser?.id || 'me';
        container.innerHTML = '<div class="reactions">' + reactions.map(r => {
            const isActive = r.users.includes(selfId);
            return `<div class="reaction ${isActive ? 'active' : ''}" data-emoji="${r.emoji}"><span>${r.emoji}</span><span class="reaction-count">${r.users.length}</span></div>`;
        }).join('') + '</div>';
        container.querySelectorAll('.reaction').forEach(el => {
            el.addEventListener('click', () => this.addReaction(messageId, el.dataset.emoji));
        });
    }

    updateMessage(data) {
        const messageEl = document.querySelector(`[data-message="${data.message_id}"]`);
        if (messageEl) {
            const textEl = messageEl.querySelector('.message-text');
            if (textEl) textEl.innerHTML = this._parseMessageContent(data.content) + '<span class="message-edited">(edited)</span>';
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

    async handleSendMessage() {
        const input = document.getElementById('message-input');
        if (!input) return;
        const content = input.value.trim();
        if (!content) return;

        if (!this.currentChannel || !this.currentChannel.id) {
            this.showToast('Selecione um canal para enviar a mensagem.', 'error');
            return;
        }

        const channelId = this.currentChannel.id;
        input.value = '';
        input.style.height = 'auto';
        this.cancelReply();
        try {
            const res = await API.Message.create(channelId, content);
            const msg = res?.message;
            if (msg) {
                const normalized = {
                    id: msg.id,
                    content: msg.content,
                    author_username: msg.author_username || msg.author,
                    author_id: msg.author_id,
                    created_at: msg.created_at || msg.timestamp,
                };
                this.addMessage(normalized, true);
                this.scrollToBottom();
            } else {
                await this.loadMessages(channelId);
                this.scrollToBottom();
            }
        } catch (err) {
            console.error('Erro ao enviar mensagem no front-end:', err);
            this.showToast(err.message || 'Failed to send message', 'error');
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
            <div class="emoji-picker-cats">${Object.keys(EMOJIS).map(cat => `<button data-cat="${cat}" class="${cat === currentCategory ? 'active' : ''}">${cat}</button>`).join('')}</div>
            <div class="emoji-picker-grid">${render()}</div>
        `;

        // Category click
        picker.querySelectorAll('.emoji-picker-cats button').forEach(btn => {
            btn.addEventListener('click', () => {
                currentCategory = btn.dataset.cat;
                filterText = '';
                picker.querySelector('.emoji-picker-search input').value = '';
                picker.querySelectorAll('.emoji-picker-cats button').forEach(b => b.classList.toggle('active', b.dataset.cat === currentCategory));
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
                picker.querySelectorAll('.emoji-picker-cats button').forEach(b => b.classList.toggle('active', b.dataset.cat === currentCategory));
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
        picker.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        picker.style.right = (window.innerWidth - rect.right) + 'px';
        picker.style.maxHeight = '400px';

        document.body.appendChild(picker);
        this._emojiPicker = picker;
        picker.querySelector('.emoji-picker-search input').focus();
    }

    hideEmojiPicker() {
        if (this._emojiPicker) { this._emojiPicker.remove(); this._emojiPicker = null; }
    }

    // ═══════════════════════════════════════════
    //  MEMBERS
    // ═══════════════════════════════════════════

    renderMembers() {
        const container = document.getElementById('members-list');
        const headerEl = document.getElementById('members-sidebar-header');
        const onlineTitleEl = document.getElementById('members-online-title');
        if (!container) return;
        container.innerHTML = '';

        const isOnline = m => { const s = m.status || m.presence?.status; return !s || s === 'online' || s === 'idle' || s === 'dnd'; };
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
        const initials = (name.slice(0, 2).toUpperCase().replace(/\s/g, '') || name.charAt(0).toUpperCase() || 'U').slice(0, 2);
        const status = member.status || member.presence?.status || 'online';
        item.innerHTML = `
            <div class="member-avatar member-avatar-yellow ${isOnline ? status : 'offline'}">
                ${member.avatar ? `<img src="${this.escapeHtml(member.avatar)}" alt="${this.escapeHtml(name)}">` : `<span>${this.escapeHtml(initials)}</span>`}
            </div>
            <span class="member-name">${this.escapeHtml(name)}</span>
            <div class="member-item-actions">
                <button type="button" class="member-action-btn" data-action="call" title="Chamar" aria-label="Chamar"><i class="fas fa-phone"></i></button>
                <button type="button" class="member-action-btn" data-action="add-friend" title="Adicionar amigo" aria-label="Adicionar amigo"><i class="fas fa-user-plus"></i></button>
            </div>
        `;
        item.querySelector('.member-avatar, .member-name').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showProfileCard(member, e);
        });
        item.querySelector('[data-action="call"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this._memberActionCall(userId, name);
        });
        item.querySelector('[data-action="add-friend"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this._memberActionAddFriend(userId, name);
        });
        return item;
    }

    async _memberActionCall(userId, username) {
        if (!userId) return;
        try {
            const channel = await API.DM.create(userId);
            this.showToast(`Abrir conversa com ${username} para chamada.`, 'info');
            if (this.currentChannel?.id !== channel?.id) {
                document.getElementById('friends-view')?.classList?.add('hidden');
                document.getElementById('messages-container').style.display = '';
                document.querySelector('.message-input-container').style.display = '';
                this.currentChannel = channel;
                if (channel?.id && this.gateway) this.gateway.subscribeChannel(channel.id);
                this._renderDMChat(channel);
                this._updateChannelHeaderForContext();
            }
        } catch (err) {
            this.showToast(err.message || 'Não foi possível abrir conversa', 'error');
        }
    }

    async _memberActionAddFriend(userId, displayName) {
        const username = displayName || (this.members.find(m => String(m.user_id || m.id) === String(userId))?.username) || userId;
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
        } catch (_) { return []; }
    }

    _setProfileLinks(userId, links) {
        try {
            const raw = localStorage.getItem('liberty_profile_links');
            const data = raw ? JSON.parse(raw) : {};
            data[userId] = links;
            localStorage.setItem('liberty_profile_links', JSON.stringify(data));
        } catch (_) {}
    }

    showProfileCard(member, e) {
        this.hideProfileCard();
        const name = member.nickname || member.username || member.display_name || 'User';
        const userId = member.user_id || member.id || '';
        const status = member.status || member.presence?.status || 'online';
        const letter = name.charAt(0).toUpperCase();
        const avatarText = name.length >= 2 ? name.slice(0, 2).toUpperCase() : letter;
        const tag = (member.username || name).replace(/\s/g, '');
        const isSelf = this.currentUser && (String(this.currentUser.id) === String(userId) || this.currentUser.username === name);
        const isFriend = this.relationships && this.relationships.some(r => r.type === 1 && (r.user?.id === userId || r.user?.username === name));
        const pendingOut = this.relationships && this.relationships.some(r => r.type === 4 && (r.user?.id === userId || r.user?.username === name));
        const profileLinks = this._getProfileLinks(userId);

        const linksHtml = profileLinks.length
            ? profileLinks.map((link) => `<a href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="profile-link-item"><i class="fab ${link.type === 'github' ? 'fa-github' : 'fa-link'}"></i> ${this.escapeHtml(link.label || link.url)}</a>`).join('')
            : (isSelf ? '<p class="profile-links-empty">Nenhum link ainda. Adicione GitHub ou outros.</p>' : '<p class="profile-links-empty">Esta pessoa ainda não adicionou links.</p>');

        const overlay = document.getElementById('modal-overlay');
        const card = document.createElement('div');
        card.className = 'profile-card profile-card-modal profile-card-full';
        card.dataset.profileUserId = userId;
        card.innerHTML = `
            <div class="profile-card-backdrop" aria-hidden="true"></div>
            <div class="profile-card-modal-inner profile-card-two-panels">
                <button type="button" class="profile-card-close-btn" aria-label="Fechar"><i class="fas fa-times"></i></button>
                <div class="profile-card-left">
                    <div class="profile-card-banner-full"></div>
                    <div class="profile-card-avatar-wrap-full">
                        <div class="profile-card-avatar profile-card-avatar-full"><span>${avatarText}</span><span class="profile-card-online-dot ${status}"></span></div>
                    </div>
                    <h2 class="profile-card-display-name">${this.escapeHtml(name)}</h2>
                    <p class="profile-card-tag">${this.escapeHtml(tag)}</p>
                    <div class="profile-card-actions profile-card-actions-row">
                        <button type="button" class="profile-card-btn profile-card-btn-msg" title="Mensagem" data-action="message"><i class="fas fa-comment"></i> Mensagem</button>
                        <button type="button" class="profile-card-btn profile-card-btn-icon" title="Adicionar amigo" data-action="addfriend"><i class="fas fa-user-plus"></i></button>
                        <button type="button" class="profile-card-btn profile-card-btn-icon" title="Mais" data-action="more"><i class="fas fa-ellipsis-h"></i></button>
                    </div>
                    <div class="profile-card-section profile-card-links">
                        <h4>Links</h4>
                        <div class="profile-links-list">${linksHtml}</div>
                        ${isSelf ? '<div class="profile-links-actions"><button type="button" class="profile-card-link-add" data-action="add-link"><i class="fab fa-github"></i> Vincular GitHub</button><button type="button" class="profile-card-link-add secondary" data-action="add-link-generic"><i class="fas fa-link"></i> Adicionar link</button></div>' : ''}
                    </div>
                    <div class="profile-card-section">
                        <h4>Nota (visível apenas para você)</h4>
                        <textarea class="profile-card-note-input" placeholder="Adicionar nota..." maxlength="256" aria-label="Nota privada"></textarea>
                    </div>
                </div>
                <div class="profile-card-right">
                    <div class="profile-card-tabs">
                        <button type="button" class="profile-card-tab active" data-tab="activity">Atividade</button>
                        <button type="button" class="profile-card-tab" data-tab="mutual">Amigos mútuos</button>
                        <button type="button" class="profile-card-tab" data-tab="servers">Servidores mútuos</button>
                    </div>
                    <div class="profile-card-tab-content" data-tab-content="activity">
                        <h4>Atividade atual</h4>
                        <p class="profile-card-activity-empty">Nenhuma atividade no momento.</p>
                    </div>
                    <div class="profile-card-tab-content hidden" data-tab-content="mutual">
                        <h4>Amigos em comum</h4>
                        <p class="profile-card-activity-empty">Nenhum amigo mútuo.</p>
                    </div>
                    <div class="profile-card-tab-content hidden" data-tab-content="servers">
                        <h4>Servidores em comum</h4>
                        <p class="profile-card-activity-empty">Nenhum servidor mútuo.</p>
                    </div>
                </div>
            </div>
        `;
        if (!overlay) return;
        overlay.classList.remove('hidden');
        overlay.appendChild(card);
        this._profileCard = card;

        card.querySelector('.profile-card-backdrop').addEventListener('click', () => this.hideProfileCard());
        card.querySelector('.profile-card-close-btn').addEventListener('click', () => this.hideProfileCard());

        const msgBtn = card.querySelector('[data-action="message"]');
        const addBtn = card.querySelector('[data-action="addfriend"]');
        const moreBtn = card.querySelector('[data-action="more"]');

        if (isSelf) {
            msgBtn.closest('.profile-card-actions-row').querySelector('[data-action="message"]').style.display = 'none';
            addBtn.style.display = 'none';
            moreBtn.style.display = 'none';
        } else {
            if (isFriend) { addBtn.innerHTML = '<i class="fas fa-check"></i>'; addBtn.title = 'Já são amigos'; addBtn.disabled = true; }
            else if (pendingOut) { addBtn.innerHTML = '<i class="fas fa-clock"></i>'; addBtn.title = 'Pedido enviado'; addBtn.disabled = true; }
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
                addBtn.innerHTML = '<i class="fas fa-clock"></i>'; addBtn.disabled = true;
            } catch (err) {
                this.showToast(err.message || 'Erro ao adicionar', 'error');
            }
        });
        moreBtn.addEventListener('click', () => this.showToast('Mais opções em breve.', 'info'));

        card.querySelectorAll('.profile-card-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                card.querySelectorAll('.profile-card-tab').forEach(t => t.classList.remove('active'));
                card.querySelectorAll('.profile-card-tab-content').forEach(c => c.classList.add('hidden'));
                tab.classList.add('active');
                const content = card.querySelector(`[data-tab-content="${tab.dataset.tab}"]`);
                if (content) content.classList.remove('hidden');
            });
        });

        if (isSelf) {
            card.querySelector('[data-action="add-link"]').addEventListener('click', () => this._profileAddLink(userId, 'github', 'GitHub', card));
            card.querySelector('[data-action="add-link-generic"]').addEventListener('click', () => this._profileAddLink(userId, 'link', 'Link', card));
        }
    }

    _profileAddLink(userId, type, label, card) {
        const url = type === 'github'
            ? prompt('URL do seu perfil GitHub (ex: https://github.com/username):', 'https://github.com/')
            : prompt('URL do link:', 'https://');
        if (!url || !url.trim()) return;
        let finalUrl = url.trim();
        if (type === 'github' && !finalUrl.includes('github.com')) finalUrl = 'https://github.com/' + finalUrl.replace(/^https?:\/\//, '').split('/')[0];
        const links = this._getProfileLinks(userId);
        const displayLabel = type === 'github' ? (finalUrl.replace(/\/$/, '').split('/').pop() || 'GitHub') : finalUrl;
        links.push({ type: type === 'github' ? 'github' : 'link', url: finalUrl, label: displayLabel });
        this._setProfileLinks(userId, links);
        const list = card.querySelector('.profile-card-links .profile-links-list');
        if (list) list.innerHTML = links.map((link) => `<a href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="profile-link-item"><i class="fab ${link.type === 'github' ? 'fa-github' : 'fa-link'}"></i> ${this.escapeHtml(link.label || link.url)}</a>`).join('');
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
        } catch (e) {
            this.showToast(e?.message || 'Não foi possível abrir a conversa.', 'error');
        }
    }

    hideProfileCard() {
        if (this._profileCard) {
            this._profileCard.remove();
            this._profileCard = null;
            const overlay = document.getElementById('modal-overlay');
            if (overlay && !overlay.querySelector('.modal:not(.hidden), .profile-card-modal')) overlay.classList.add('hidden');
        }
    }

    // ═══════════════════════════════════════════
    //  CONTEXT MENUS
    // ═══════════════════════════════════════════

    showContextMenu(items, x, y) {
        this.hideContextMenu();
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = items.map(item => {
            if (item.divider) return '<div class="dropdown-divider"></div>';
            return `<div class="dropdown-item ${item.danger ? 'danger' : ''}" data-idx="${item._idx}"><i class="fas ${item.icon || 'fa-circle'}" style="width:20px;text-align:center;font-size:13px"></i>${this.escapeHtml(item.label)}</div>`;
        }).join('');

        const maxX = window.innerWidth - 200;
        const maxY = window.innerHeight - (items.length * 36);
        menu.style.left = Math.min(x, maxX) + 'px';
        menu.style.top = Math.min(y, maxY) + 'px';

        let focusIdx = -1;
        const actionItems = items.filter(i => !i.divider);
        const menuItems = () => menu.querySelectorAll('.dropdown-item');

        menu.addEventListener('keydown', e => {
            const els = menuItems();
            if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(focusIdx + 1, els.length - 1); els[focusIdx]?.focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx = Math.max(focusIdx - 1, 0); els[focusIdx]?.focus(); }
            else if (e.key === 'Enter' && focusIdx >= 0) { els[focusIdx]?.click(); }
        });

        let aiIdx = 0;
        menu.querySelectorAll('.dropdown-item').forEach(el => {
            const action = actionItems[aiIdx]?.action;
            el.tabIndex = 0;
            el.addEventListener('click', () => { this.hideContextMenu(); if (action) action(); });
            aiIdx++;
        });

        document.body.appendChild(menu);
        this._contextMenu = menu;
        menu.focus();
    }

    hideContextMenu() {
        if (this._contextMenu) { this._contextMenu.remove(); this._contextMenu = null; }
    }

    showServerContextMenu(serverItem, e) {
        const serverId = serverItem.dataset.server;
        const server = this.servers.find(s => s.id === serverId);
        const items = [
            { _idx: 0, icon: 'fa-check-circle', label: 'Mark as Read', action: () => this.showToast('Marked as read', 'info') },
            { _idx: 1, icon: 'fa-bell-slash', label: 'Mute Server', action: () => this.showToast('Server muted', 'info') },
            { divider: true },
            { _idx: 2, icon: 'fa-user-plus', label: 'Invite People', action: () => this.showInviteModal() },
            { _idx: 3, icon: 'fa-eye-slash', label: 'Hide Server', action: () => this.showToast('Server hidden', 'info') },
            { divider: true },
            { _idx: 4, icon: 'fa-sign-out-alt', label: 'Leave Server', danger: true, action: () => { if (this.gateway) this.gateway.leaveServer(serverId); this.showToast(`Left ${server?.name || 'server'}`, 'info'); this.selectHome(); } },
        ];
        this.showContextMenu(items, e.clientX, e.clientY);
    }

    showChannelContextMenu(channelItem, e) {
        const channelId = channelItem.dataset.channel;
        const channel = this.channels.find(c => c.id === channelId);
        const items = [
            { _idx: 0, icon: 'fa-edit', label: 'Edit Channel', action: () => this.showEditChannelModal(channelId) },
            { _idx: 1, icon: 'fa-bell-slash', label: 'Mute Channel', action: () => this.showToast('Channel muted', 'info') },
            { divider: true },
            { _idx: 2, icon: 'fa-user-plus', label: 'Invite to Channel', action: () => this.showInviteModal() },
            { _idx: 3, icon: 'fa-clone', label: 'Clone Channel', action: () => this.showToast(`Cloned #${channel?.name || 'channel'}`, 'success') },
            { divider: true },
            { _idx: 4, icon: 'fa-trash', label: 'Delete Channel', danger: true, action: () => {
                if (confirm(`Delete #${channel?.name}?`)) {
                    this.channels = this.channels.filter(c => c.id !== channelId);
                    this.renderChannels();
                    this.showToast('Channel deleted', 'success');
                }
            }},
        ];
        this.showContextMenu(items, e.clientX, e.clientY);
    }

    showMessageContextMenu(messageEl, e) {
        const messageId = messageEl.dataset.message;
        const msgData = this.messages.get(messageId);
        const isSelf = msgData?.isSelf;
        const items = [
            { _idx: 0, icon: 'fa-smile', label: 'Add Reaction', action: () => {
                this.showEmojiPicker(messageEl, emoji => this.addReaction(messageId, emoji));
            }},
            { _idx: 1, icon: 'fa-reply', label: 'Reply', action: () => this.startReply(messageId, msgData?.authorName || 'User', msgData?.content || '') },
            { divider: true },
        ];
        if (isSelf) {
            items.push({ _idx: 2, icon: 'fa-pencil-alt', label: 'Edit Message', action: () => this.startEditMessage(messageId, msgData?.content) });
        }
        items.push({ _idx: 3, icon: 'fa-thumbtack', label: 'Pin Message', action: async () => {
            try {
                await API.Pin.pin(this.currentChannel?.id || this.currentChannel, messageId);
                this.showToast('Message pinned!', 'success');
            } catch (err) {
                this.showToast(err.message || 'Failed to pin message', 'error');
            }
        }});
        if (isSelf) {
            items.push({ divider: true });
            items.push({ _idx: 4, icon: 'fa-trash', label: 'Delete Message', danger: true, action: () => this.confirmDeleteMessage(messageId) });
        }
        items.push({ divider: true });
        items.push({ _idx: 5, icon: 'fa-copy', label: 'Copy Text', action: () => {
            navigator.clipboard.writeText(msgData?.content || '').then(() => this.showToast('Text copied!', 'success'));
        }});
        items.push({ _idx: 6, icon: 'fa-link', label: 'Copy Message Link', action: () => {
            navigator.clipboard.writeText(`${window.location.origin}/channels/${this.currentServer?.id || '@me'}/${this.currentChannel?.id}/${messageId}`).then(() => this.showToast('Link copied!', 'success'));
        }});
        items.push({ _idx: 7, icon: 'fa-eye-slash', label: 'Mark Unread', action: () => this.showToast('Marked as unread', 'info') });
        this.showContextMenu(items, e.clientX, e.clientY);
    }

    showMemberContextMenu(memberItem, e) {
        const userId = memberItem.dataset.userId;
        const member = this.members.find(m => (m.user_id || m.id) === userId);
        const name = member?.nickname || member?.username || 'User';
        const items = [
            { _idx: 0, icon: 'fa-id-card', label: 'Profile', action: () => this.showProfileCard(member || { username: name, status: 'online' }, e) },
            { _idx: 1, icon: 'fa-comment', label: 'Message', action: () => this.showToast(`Opening DM with ${name}...`, 'info') },
            { _idx: 2, icon: 'fa-phone', label: 'Call', action: () => this.showToast(`Calling ${name}...`, 'info') },
            { divider: true },
            { _idx: 3, icon: 'fa-sticky-note', label: 'Add Note', action: () => this.showToast('Note editor opened', 'info') },
            { _idx: 4, icon: 'fa-microphone-slash', label: 'Mute', action: () => this.showToast(`${name} muted`, 'info') },
            { _idx: 5, icon: 'fa-headphones-alt', label: 'Deafen', action: () => this.showToast(`${name} deafened`, 'info') },
            { _idx: 6, icon: 'fa-pen', label: 'Change Nickname', action: () => { const nn = prompt('New nickname:', name); if (nn) this.showToast(`Nickname changed to ${nn}`, 'success'); } },
            { divider: true },
            { _idx: 7, icon: 'fa-user-slash', label: 'Kick', danger: true, action: () => this.showToast(`${name} kicked`, 'warning') },
            { _idx: 8, icon: 'fa-ban', label: 'Ban', danger: true, action: () => this.showToast(`${name} banned`, 'warning') },
        ];
        this.showContextMenu(items, e.clientX, e.clientY);
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
                <button class="btn-close" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">${bodyHtml}</div>
        `;
        modal.querySelector('.btn-close').addEventListener('click', () => this.hideModal());
        document.getElementById('modal-overlay').appendChild(modal);
        return modal;
    }

    async showCreateChannelModal(categoryId) {
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
        const setTab = (tab) => {
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
            const slug = raw ? raw.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'nome-do-canal' : 'nome-do-canal';
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
                    if (!name) { this.showToast('Digite o nome do canal.', 'error'); return; }
                    try {
                        const ch = await API.Channel.create(serverId, name, type, parentId, null);
                        this.channels = await API.Channel.list(serverId) || [];
                        this.renderChannels();
                        this.hideModal();
                        this.showToast(`Canal #${ch?.name || name} criado!`, 'success');
                    } catch (e) {
                        this.showToast(e?.message || 'Erro ao criar canal.', 'error');
                    }
                } else {
                    const name = addCategoryName?.value?.trim();
                    if (!name) { this.showToast('Digite o nome da categoria.', 'error'); return; }
                    try {
                        await API.Channel.create(serverId, name, 'category', null, null);
                        this.channels = await API.Channel.list(serverId) || [];
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
            const list = await API.Channel.list(serverId) || [];
            list.filter(c => c.type === 'category').forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                if (categoryId && cat.id === categoryId) opt.selected = true;
                catSelect.appendChild(opt);
            });
            if (categoryId) catSelect.value = categoryId;
        } catch (_) { /* keep "Sem categoria" */ }
        this.showModal('create-channel-modal');
    }

    showEditChannelModal(channelId) {
        const channel = this.channels.find(c => c.id === channelId);
        if (!channel) return;
        this.createModal('edit-channel-modal', 'Edit Channel', `
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
        `);
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
        this.createModal('invite-modal', 'Invite Friends', `
            <p class="modal-description">Share this link with friends to grant them access to <strong>${this.escapeHtml(this.currentServer?.name || 'this server')}</strong>.</p>
            <div class="form-group">
                <label>Invite Link</label>
                <div style="display:flex;gap:8px">
                    <input type="text" id="invite-link-input" value="${link}" readonly style="flex:1">
                    <button class="btn btn-primary" id="copy-invite-btn"><i class="fas fa-copy"></i> Copy</button>
                </div>
            </div>
            <div class="modal-actions"><button class="btn btn-secondary" data-action="close">Done</button></div>
        `);
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
        this.hideSettingsPanel();
        const overlay = document.createElement('div');
        overlay.className = 'settings-overlay';

        const categories = type === 'user' ? [
            { group: 'USUÁRIO' },
            { id: 'account', label: 'Minha Conta', icon: 'fa-user' },
            { id: 'auth-security', label: 'Autenticação e Segurança', icon: 'fa-shield-alt' },
            { id: 'profile', label: 'Perfil', icon: 'fa-id-card' },
            { id: 'privacy', label: 'Privacidade', icon: 'fa-lock' },
            { divider: true },
            { group: 'APP' },
            { id: 'appearance', label: 'Aparência', icon: 'fa-eye' },
            { id: 'voice', label: 'Voz', icon: 'fa-microphone' },
            { id: 'notifications', label: 'Notificações', icon: 'fa-bell' },
            { divider: true },
            { id: 'logout', label: 'Sair', danger: true, icon: 'fa-sign-out-alt' },
        ] : [
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

        let profileHtml = type === 'user' ? `
            <div class="settings-sidebar-profile">
                <div class="settings-sidebar-profile-avatar">${initial}</div>
                <div class="settings-sidebar-profile-info">
                    <div class="settings-sidebar-profile-name">${uname}</div>
                    <div class="settings-sidebar-profile-link" data-section="account">Minha Conta</div>
                </div>
            </div>
            <input type="text" class="settings-sidebar-search" placeholder="Buscar" />
        ` : `<input type="text" class="settings-sidebar-search" placeholder="Search" />`;

        let sidebarHtml = '';
        categories.forEach(cat => {
            if (cat.divider) { sidebarHtml += '<div class="settings-sidebar-divider"></div>'; return; }
            if (cat.group) { sidebarHtml += `<div class="settings-sidebar-title">${this.escapeHtml(cat.group)}</div>`; return; }
            const icon = cat.icon ? `<i class="fas ${cat.icon}" aria-hidden="true"></i>` : '';
            sidebarHtml += `<div class="settings-sidebar-item ${cat.danger ? 'danger' : ''}" data-section="${cat.id}">${icon}${icon ? '<span>' : ''}${this.escapeHtml(cat.label)}${icon ? '</span>' : ''}</div>`;
        });

        overlay.innerHTML = `
            <div class="settings-sidebar"><div class="settings-sidebar-inner">${profileHtml}${sidebarHtml}</div></div>
            <div class="settings-content"><div class="settings-content-inner" id="settings-content"></div>
                <div class="settings-close">
                    <button title="Close (ESC)"><i class="fas fa-times"></i></button>
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
            sidebarSearch.addEventListener('input', (e) => {
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
                    if (this._activityPingInterval) {
                        clearInterval(this._activityPingInterval);
                        this._activityPingInterval = null;
                    }
                    API.Auth.logout();
                    window.location.reload();
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
            API.Member.list(this.currentServer.id).then(m => { this.members = m || []; }).catch(() => {});
        }
    }

    _renderSettingsSection(overlay, type, section) {
        const content = overlay.querySelector('#settings-content');
        const sectionRenderers = {
            account: () => {
                const initial = (this.currentUser?.username || 'U').charAt(0).toUpperCase();
                const uname = this.escapeHtml(this.currentUser?.username || 'User');
                const avatarUrl = this._getAvatarUrl() ? this.escapeHtml(this._getAvatarUrl()) : '';
                const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:#fff">${initial}</span>` : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:var(--text-secondary)">${initial}</span>`;
                return `<h2 class="settings-page-title">Minha Conta</h2>
                <div class="settings-subscription-row">
                    <div class="settings-subscription-label"><i class="fas fa-crown"></i> Subscription Plan</div>
                    <div><select class="settings-plan-select" disabled><option>Free - 5.000 chars / 100 MB</option></select></div>
                </div>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">Choose your plan to increase character and file size limits.</p>
                <div class="settings-avatar-card settings-avatar-card-improved">
                    <h3 class="settings-avatar-card-title"><i class="fas fa-user-circle"></i> Foto de perfil</h3>
                    <p class="settings-avatar-card-desc">Envie uma imagem do seu computador ou use um link. JPEG, PNG, GIF ou WebP (máx. 4 MB).</p>
                    <div class="settings-avatar-preview-wrap" id="settings-avatar-drop-zone">
                        <input type="file" id="settings-avatar-file" accept="image/jpeg,image/png,image/gif,image/webp" class="settings-avatar-file-input" />
                        <div class="settings-avatar-preview" id="settings-avatar-preview">${avatarHtml}</div>
                        <div class="settings-avatar-overlay"><i class="fas fa-camera"></i><span>Clique ou arraste uma foto aqui</span></div>
                    </div>
                    <div class="settings-avatar-actions">
                        <label for="settings-avatar-file" class="btn btn-primary settings-avatar-btn-file"><i class="fas fa-upload"></i> Enviar arquivo</label>
                        <span class="settings-avatar-divider">ou</span>
                        <div class="settings-avatar-url-row">
                            <input type="url" id="settings-avatar-url" class="settings-avatar-url-input" placeholder="https://exemplo.com/sua-foto.jpg ou .png" value="${avatarUrl}" />
                            <button type="button" class="btn-save" id="settings-save-avatar-btn"><i class="fas fa-link"></i> Usar URL</button>
                        </div>
                        <button type="button" class="settings-avatar-remove-btn" id="settings-avatar-remove-btn"><i class="fas fa-trash-alt"></i> Remover foto</button>
                    </div>
                </div>
                <div class="settings-section-block">
                    <h3>LANGUAGE</h3>
                    <select id="settings-language"><option value="en">English</option><option value="pt">Português</option><option value="es">Español</option><option value="fr">Français</option></select>
                </div>
                <div class="settings-section-block">
                    <h3>NAME</h3>
                    <div class="input-row">
                        <input type="text" id="settings-display-name" value="${uname}" placeholder="Seu nome" />
                        <button type="button" class="btn-save" id="settings-save-name-btn">Save</button>
                    </div>
                </div>
                <div class="settings-section-block">
                    <h3>DADOS LOCAIS</h3>
                    <p>Remove todos os dados salvos neste navegador (contas, servidores, mensagens, fotos). Você precisará criar conta e entrar de novo.</p>
                    <button type="button" class="btn-clear-db" id="settings-clear-db-btn">Limpar banco de dados</button>
                </div>`;
            },
            'auth-security': () => {
                const hasPassword = this.currentUser && this.currentUser.has_password === true;
                return `<h2 class="settings-page-title">Autenticação e Segurança</h2>
                <div class="settings-card">
                    <h3 style="margin-top:0">${hasPassword ? 'Alterar senha' : 'Ativar senha'}</h3>
                    <p style="margin-bottom:12px">${hasPassword ? 'Altere sua senha para manter a conta segura.' : 'Ative uma senha para proteger a conta. Depois poderá entrar com nome de usuário e senha.'}</p>
                    ${hasPassword ? `
                    <div class="settings-section-block" style="margin-bottom:12px">
                        <label class="settings-row-label" for="settings-current-password">Senha atual</label>
                        <input type="password" id="settings-current-password" class="settings-password-input" placeholder="••••••••" autocomplete="current-password" maxlength="128" />
                    </div>
                    ` : ''}
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
            profile: () => `<h2 class="settings-page-title">Perfil</h2>
                <div style="display:flex;gap:32px;flex-wrap:wrap">
                    <div style="flex:1;min-width:280px">
                        <div class="settings-card">
                            <div class="settings-row"><div style="flex:1"><div class="settings-row-label">Display Name</div><input type="text" value="${this.escapeHtml(this.currentUser?.username || 'User')}" style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-size:14px;width:100%;margin-top:8px"></div></div>
                            <div class="settings-row"><div style="flex:1"><div class="settings-row-label">About Me</div><textarea style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-size:14px;width:100%;height:80px;resize:none;margin-top:8px;font-family:inherit" placeholder="Tell the world about yourself"></textarea></div></div>
                            <div class="settings-row"><div><div class="settings-row-label">Avatar</div></div><button class="btn btn-primary btn-sm" onclick="app.showToast('Avatar upload coming soon!','info')">Change Avatar</button></div>
                            <div class="settings-row"><div><div class="settings-row-label">Profile Banner</div></div><button class="btn btn-primary btn-sm" onclick="app.showToast('Banner upload coming soon!','info')">Change Banner</button></div>
                            <div class="settings-row"><div><div class="settings-row-label">Profile Color</div></div><input type="color" value="#FFD700" style="width:40px;height:30px;border:none;background:transparent;cursor:pointer"></div>
                        </div>
                    </div>
                    <div style="width:300px;flex-shrink:0">
                        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:8px">Preview</div>
                        <div class="settings-profile-card">
                            <div class="settings-profile-banner"></div>
                            <div class="settings-profile-info">
                                <div class="settings-profile-avatar"><span>${(this.currentUser?.username || 'U').charAt(0).toUpperCase()}</span></div>
                                <div style="padding:8px 0"><div class="settings-profile-name">${this.escapeHtml(this.currentUser?.username || 'User')}</div><div class="settings-profile-email">Online</div></div>
                                <div style="padding:12px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12px"><div style="font-weight:700;text-transform:uppercase;color:var(--text-secondary);margin-bottom:4px">About Me</div><div style="color:var(--text-primary)">No bio set yet</div></div>
                            </div>
                        </div>
                    </div>
                </div>`,
            appearance: () => {
                const current = localStorage.getItem('liberty-theme') || 'Dark-theme';
                const border = (t) => (t === current ? 'var(--primary-yellow)' : 'transparent');
                const bgType = localStorage.getItem('liberty-bg-type') || 'default';
                const bgSolid = localStorage.getItem('liberty-bg-solid') || '#000000';
                let bgGrad = { color1: '#0d0b09', color2: '#1a1814', angle: 135 };
                try { const g = localStorage.getItem('liberty-bg-gradient'); if (g) bgGrad = { ...bgGrad, ...JSON.parse(g) }; } catch (_) {}
                const bgImage = localStorage.getItem('liberty-bg-image') || '';
                let html = `<h2>Aparência</h2>
                <div class="settings-card"><h3 style="margin-top:0">Tema</h3>
                <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
                    <div class="theme-option" data-theme="Dark-theme" style="width:80px;height:60px;background:var(--primary-black);border:2px solid ${border('Dark-theme')};border-radius:var(--radius-md);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-primary);font-weight:600" onclick="app.applyTheme('Dark-theme')">Dark</div>
                    <div class="theme-option" data-theme="Light-theme" style="width:80px;height:60px;background:#f5f2eb;border:2px solid ${border('Light-theme')};border-radius:var(--radius-md);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;color:#1a1814;font-weight:600" onclick="app.applyTheme('Light-theme')">Light</div>
                    <div class="theme-option" data-theme="Dark-Accent-theme" style="width:80px;height:60px;background:linear-gradient(135deg,#1a1814,#2a2520);border:2px solid ${border('Dark-Accent-theme')};border-radius:var(--radius-md);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-primary);font-weight:600;text-align:center;padding:4px" onclick="app.applyTheme('Dark-Accent-theme')">Dark<br>Accent</div>
                </div></div>
                <div class="settings-card settings-bg-card"><h3 style="margin-top:0">Fundo do site</h3>
                <p class="settings-row-desc" style="margin-bottom:12px">Escolha cor sólida, gradiente ou imagem/GIF como fundo da aplicação.</p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
                    <label class="settings-bg-type-opt" data-bg-type="default" style="padding:10px 16px;border-radius:var(--radius-md);border:2px solid ${bgType==='default'?'var(--primary-yellow)':'rgba(255,255,255,.1)'};background:${bgType==='default'?'rgba(255,215,0,.1)':'transparent'};cursor:pointer;font-size:13px;font-weight:600;color:var(--text-primary)"><i class="fas fa-square-full" style="font-size:10px;margin-right:6px"></i>Preto</label>
                    <label class="settings-bg-type-opt" data-bg-type="solid" style="padding:10px 16px;border-radius:var(--radius-md);border:2px solid ${bgType==='solid'?'var(--primary-yellow)':'rgba(255,255,255,.1)'};background:${bgType==='solid'?'rgba(255,215,0,.1)':'transparent'};cursor:pointer;font-size:13px;font-weight:600;color:var(--text-primary)"><i class="fas fa-fill-drip" style="margin-right:6px"></i>Cor sólida</label>
                    <label class="settings-bg-type-opt" data-bg-type="gradient" style="padding:10px 16px;border-radius:var(--radius-md);border:2px solid ${bgType==='gradient'?'var(--primary-yellow)':'rgba(255,255,255,.1)'};background:${bgType==='gradient'?'rgba(255,215,0,.1)':'transparent'};cursor:pointer;font-size:13px;font-weight:600;color:var(--text-primary)"><i class="fas fa-fill" style="margin-right:6px"></i>Gradiente</label>
                    <label class="settings-bg-type-opt" data-bg-type="image" style="padding:10px 16px;border-radius:var(--radius-md);border:2px solid ${bgType==='image'?'var(--primary-yellow)':'rgba(255,255,255,.1)'};background:${bgType==='image'?'rgba(255,215,0,.1)':'transparent'};cursor:pointer;font-size:13px;font-weight:600;color:var(--text-primary)"><i class="fas fa-image" style="margin-right:6px"></i>Imagem / GIF</label>
                </div>
                <div id="settings-bg-solid-wrap" class="settings-bg-pane" style="display:${bgType==='solid'?'block':'none'}">
                    <div class="settings-section-block" style="margin-bottom:0">
                        <h3 style="margin-top:0">Cor</h3>
                        <div class="input-row" style="align-items:center;gap:12px">
                            <input type="color" id="settings-bg-solid-color" value="${bgSolid}" style="width:48px;height:36px;padding:2px;border:none;border-radius:var(--radius-sm);cursor:pointer;background:transparent" />
                            <input type="text" id="settings-bg-solid-hex" value="${bgSolid}" placeholder="#000000" maxlength="7" style="flex:1;min-width:100px;padding:10px 12px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit" />
                        </div>
                    </div>
                </div>
                <div id="settings-bg-gradient-wrap" class="settings-bg-pane" style="display:${bgType==='gradient'?'block':'none'}">
                    <div class="settings-section-block" style="margin-bottom:0">
                        <h3 style="margin-top:0">Gradiente</h3>
                        <div class="input-row" style="flex-wrap:wrap;gap:12px;margin-bottom:10px">
                            <div style="display:flex;align-items:center;gap:8px"><label style="font-size:12px;color:var(--text-secondary)">Cor 1</label><input type="color" id="settings-bg-grad-color1" value="${bgGrad.color1}" style="width:40px;height:28px;padding:2px;border:none;border-radius:4px;cursor:pointer" /><input type="text" id="settings-bg-grad-hex1" value="${bgGrad.color1}" maxlength="7" style="width:80px;padding:6px 8px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px" /></div>
                            <div style="display:flex;align-items:center;gap:8px"><label style="font-size:12px;color:var(--text-secondary)">Cor 2</label><input type="color" id="settings-bg-grad-color2" value="${bgGrad.color2}" style="width:40px;height:28px;padding:2px;border:none;border-radius:4px;cursor:pointer" /><input type="text" id="settings-bg-grad-hex2" value="${bgGrad.color2}" maxlength="7" style="width:80px;padding:6px 8px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px" /></div>
                            <div style="display:flex;align-items:center;gap:8px"><label style="font-size:12px;color:var(--text-secondary)">Ângulo</label><input type="number" id="settings-bg-grad-angle" value="${bgGrad.angle}" min="0" max="360" style="width:70px;padding:6px 8px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px" /></div>
                        </div>
                    </div>
                </div>
                <div id="settings-bg-image-wrap" class="settings-bg-pane" style="display:${bgType==='image'?'block':'none'}">
                    <div class="settings-section-block" style="margin-bottom:0">
                        <h3 style="margin-top:0">URL da imagem ou GIF</h3>
                        <p class="settings-row-desc" style="margin-bottom:8px">Cole o link de uma imagem ou GIF. Será redimensionada para cobrir o fundo.</p>
                        <input type="url" id="settings-bg-image-url" value="${this.escapeHtml(bgImage)}" placeholder="https://exemplo.com/imagem.jpg ou .gif" style="width:100%;padding:10px 12px;background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;font-family:inherit;box-sizing:border-box" />
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
                    <button type="button" class="btn-save" id="settings-bg-apply">Aplicar fundo</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="settings-bg-reset">Restaurar preto</button>
                </div>
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
            voice: () => `<h2>Voice & Video</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Input Device</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>Default</option><option>Microphone (HD Audio)</option></select></div>
                <div class="settings-row"><div><div class="settings-row-label">Output Device</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>Default</option><option>Speakers (HD Audio)</option></select></div>
                <div class="settings-row"><div><div class="settings-row-label">Input Volume</div></div><input type="range" min="0" max="100" value="80" style="width:150px"></div>
                <div class="settings-row"><div><div class="settings-row-label">Output Volume</div></div><input type="range" min="0" max="100" value="100" style="width:150px"></div>
                <div class="settings-row"><div><div class="settings-row-label">Noise Suppression</div><div class="settings-row-desc">Automatically remove background noise</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Echo Cancellation</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                </div>`,
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
                if (members.length === 0) return `<h2>Members</h2><div class="settings-card"><p>Manage server members.</p><div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center"><i class="fas fa-users" style="font-size:32px;margin-bottom:8px;display:block;opacity:.5"></i>No members loaded. Select a channel to see members.</div></div>`;
                let rows = members.slice(0, 50).map(m => {
                    const name = m.nickname || m.username || m.display_name || 'User';
                    const initial = name.charAt(0).toUpperCase();
                    const roleName = (m.roles && m.roles[0]?.name) ? m.roles[0].name : (m.role_name || 'Member');
                    return `<div class="settings-row" style="align-items:center;gap:12px">
                        <div style="width:32px;height:32px;border-radius:50%;background:var(--dark-gray);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--text-secondary)">${initial}</div>
                        <div style="flex:1"><div class="settings-row-label">${this.escapeHtml(name)}</div><div style="font-size:12px;color:var(--text-muted)">${this.escapeHtml(roleName)}</div></div>
                        <button class="btn btn-secondary btn-sm" onclick="app.showToast('Kick coming soon','info')">Kick</button>
                    </div>`;
                }).join('');
                if (members.length > 50) rows += `<div style="font-size:12px;color:var(--text-muted);padding:8px 0">... and ${members.length - 50} more</div>`;
                return `<h2>Members</h2><div class="settings-card"><p>Manage server members (${members.length}).</p><div style="margin-top:12px">${rows}</div></div>`;
            },
            emoji: () => `<h2>Emoji</h2><div class="settings-card"><p>Add custom emoji for everyone on this server.</p>
                <button class="btn btn-primary btn-sm" onclick="app.showToast('Upload emoji coming soon!','info')"><i class="fas fa-upload"></i> Upload Emoji</button>
                <div style="margin-top:16px;color:var(--text-muted);font-size:13px">No custom emoji yet. Upload some!</div></div>`,
            moderation: () => `<h2>Moderation</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Verification Level</div><div class="settings-row-desc">Require members to verify email</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>None</option><option>Low</option><option>Medium</option><option>High</option><option>Highest</option></select></div>
                <div class="settings-row"><div><div class="settings-row-label">Explicit Media Content Filter</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>Don't scan</option><option>Scan from members without roles</option><option>Scan all</option></select></div>
                </div>`,
            'audit-log': () => `<h2>Audit Log</h2><div class="settings-card"><p>View a log of all actions taken on this server.</p>
                <div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center"><i class="fas fa-clipboard-list" style="font-size:32px;margin-bottom:8px;display:block;opacity:.5"></i>No audit log entries yet</div></div>`,
            integrations: () => `<h2>Integrations</h2><div class="settings-card"><p>Manage bots and webhooks for this server.</p>
                <button class="btn btn-primary btn-sm" onclick="app.showToast('Add integration coming soon!','info')"><i class="fas fa-plus"></i> Add Integration</button>
                <div style="margin-top:16px;color:var(--text-muted);font-size:13px">No integrations yet.</div></div>`,
            widget: () => `<h2>Widget</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Enable Server Widget</div></div><div class="toggle-switch" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Widget Channel</div></div><select style="background:var(--dark-gray);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-md);padding:6px 10px;color:var(--text-primary);font-size:13px"><option>#general</option></select></div>
                </div>`,
            bans: () => `<h2>Bans</h2><div class="settings-card"><p>View and manage banned users.</p>
                <div style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center"><i class="fas fa-gavel" style="font-size:32px;margin-bottom:8px;display:block;opacity:.5"></i>No banned users</div></div>`,
            privacy: () => `<h2>Content & Social</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Allow direct messages from server members</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Allow message requests from server members</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Filter all direct messages</div><div class="settings-row-desc">Automatically scan and delete DMs that contain explicit content</div></div><div class="toggle-switch" onclick="this.classList.toggle('active')"></div></div>
                </div>`,
            'data-privacy': () => `<h2>Data & Privacy</h2><div class="settings-card"><p>Control how your data is used.</p>
                <div class="settings-row"><div><div class="settings-row-label">Use data to improve LIBERTY</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Use data to customize experience</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <button class="btn btn-secondary btn-sm" style="margin-top:12px" onclick="app.showToast('Data request coming soon!','info')">Request all of my Data</button>
                </div>`,
            chat: () => `<h2>Chat</h2><div class="settings-card">
                <div class="settings-row"><div><div class="settings-row-label">Show embeds and preview links</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Show emoji reactions</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Play animated emoji</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Render text-to-emoji</div><div class="settings-row-desc">Convert :) to 🙂</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                <div class="settings-row"><div><div class="settings-row-label">Sticker suggestions</div></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"></div></div>
                </div>`,
            nitro: () => `<h2>Nitro</h2><div class="settings-card" style="text-align:center;padding:32px">
                <i class="fas fa-rocket" style="font-size:48px;color:var(--primary-yellow);margin-bottom:16px;display:block"></i>
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
        content.innerHTML = renderer ? renderer() : `<h2>${section}</h2><div class="settings-card"><p>Settings content for ${section} will be displayed here.</p></div>`;
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
            const setPreviewHtml = (url) => {
                if (!avatarPreview) return;
                if (url) avatarPreview.innerHTML = '<img src="' + url.replace(/"/g, '&quot;') + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';" /><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:#fff">' + initial + '</span>';
                else avatarPreview.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;font-weight:700;color:var(--text-secondary)">' + initial + '</span>';
            };
            const uploadAvatarFile = (file) => {
                if (!file || !file.type.startsWith('image/')) { this.showToast('Escolha uma imagem (JPEG, PNG, GIF ou WebP).', 'error'); return; }
                if (file.size > 4 * 1024 * 1024) { this.showToast('Imagem demasiado grande (máx. 4 MB).', 'error'); return; }
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = reader.result;
                    if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
                        API.User.uploadAvatar(dataUrl).then((r) => {
                            const url = (r && r.avatar_url) ? r.avatar_url : dataUrl;
                            if (this.currentUser) { this.currentUser.avatar_url = url; this.currentUser.avatar = url; }
                            setPreviewHtml(url);
                            if (avatarUrlInput) avatarUrlInput.value = url;
                            this.showToast('Foto de perfil atualizada!', 'success');
                            this._updateUserAvatarInUI();
                        }).catch(e => this.showToast(e.message || 'Erro ao enviar foto', 'error'));
                    } else this.showToast('Faça login para enviar uma foto.', 'info');
                };
                reader.readAsDataURL(file);
            };
            if (avatarFileInput) {
                avatarFileInput.addEventListener('change', () => {
                    const file = avatarFileInput.files && avatarFileInput.files[0];
                    if (file) uploadAvatarFile(file);
                    avatarFileInput.value = '';
                });
            }
            if (dropZone) {
                ['dragenter', 'dragover'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over'); }));
                ['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); }));
                dropZone.addEventListener('drop', (e) => {
                    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                    if (file) uploadAvatarFile(file);
                });
            }
            if (saveAvatarBtn && avatarUrlInput) {
                saveAvatarBtn.addEventListener('click', () => {
                    const url = (avatarUrlInput.value || '').trim();
                    if (!url) { this.showToast('Cole uma URL de imagem ou envie um arquivo.', 'info'); return; }
                    if (!/^https?:\/\//i.test(url) && !/^\/uploads?\//.test(url)) { this.showToast('URL deve começar por http://, https:// ou /uploads/', 'error'); return; }
                    const applyUrl = (u) => {
                        if (this.currentUser) { this.currentUser.avatar_url = u; this.currentUser.avatar = u; }
                        setPreviewHtml(u);
                        this._updateUserAvatarInUI();
                    };
                    if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
                        API.User.updateCurrentUser({ avatar_url: url }).then(() => {
                            try { localStorage.setItem('liberty_avatar_url', url); } catch (_) {}
                            this.showToast('Foto de perfil atualizada!', 'success');
                            applyUrl(url);
                        }).catch((e) => {
                            try { localStorage.setItem('liberty_avatar_url', url); } catch (_) {}
                            applyUrl(url);
                            this.showToast('URL guardada localmente. ' + (e.message || ''), 'info');
                        });
                    } else {
                        try { localStorage.setItem('liberty_avatar_url', url); } catch (_) {}
                        applyUrl(url);
                        this.showToast('Foto guardada localmente. Faça login para sincronizar.', 'success');
                    }
                });
            }
            if (avatarPreview && avatarUrlInput) avatarUrlInput.addEventListener('input', () => { const v = avatarUrlInput.value.trim(); if (v) setPreviewHtml(v); });
            const removeAvatarBtn = content.querySelector('#settings-avatar-remove-btn');
            if (removeAvatarBtn) {
                removeAvatarBtn.addEventListener('click', () => {
                    const clearAvatar = () => {
                        if (this.currentUser) { this.currentUser.avatar_url = null; this.currentUser.avatar = null; }
                        try { localStorage.removeItem('liberty_avatar_url'); } catch (_) {}
                        setPreviewHtml(null);
                        if (avatarUrlInput) avatarUrlInput.value = '';
                        this._updateUserAvatarInUI();
                        this.showToast('Foto de perfil removida.', 'success');
                    };
                    if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
                        API.User.updateCurrentUser({ avatar_url: '' }).then(() => { clearAvatar(); }).catch(() => { clearAvatar(); });
                    } else clearAvatar();
                });
            }
            if (saveNameBtn && displayNameInput) {
                saveNameBtn.addEventListener('click', () => {
                    const name = (displayNameInput.value || '').trim().substring(0, 32);
                    if (!name) { this.showToast('Digite um nome.', 'info'); return; }
                    if (typeof API !== 'undefined' && API.User && API.Token.getAccessToken()) {
                        API.User.updateCurrentUser({ username: name }).then(() => { this.showToast('Nome salvo!', 'success'); if (this.currentUser) this.currentUser.username = name; }).catch(e => this.showToast(e.message || 'Erro ao salvar nome', 'error'));
                    } else { localStorage.setItem('liberty_username', name); this.showToast('Nome salvo localmente.', 'success'); }
                });
            }
            if (clearDbBtn) {
                clearDbBtn.addEventListener('click', () => {
                    if (!confirm('Tem certeza? Todos os dados locais (contas, servidores, mensagens) serão removidos.')) return;
                    ['access_token', 'refresh_token', 'liberty_token', 'token', 'liberty_username'].forEach(k => localStorage.removeItem(k));
                    this.showToast('Dados locais removidos.', 'success');
                    this.hideSettingsPanel();
                    setTimeout(() => window.location.reload(), 800);
                });
            }
        }
        if (section === 'auth-security' && type === 'user') {
            const savePwBtn = content.querySelector('#settings-save-password-btn');
            const currentPw = content.querySelector('#settings-current-password');
            const newPw = content.querySelector('#settings-new-password');
            const confirmPw = content.querySelector('#settings-confirm-password');
            if (savePwBtn) {
                savePwBtn.addEventListener('click', async () => {
                    const newVal = (newPw && newPw.value) ? newPw.value : '';
                    const confirmVal = (confirmPw && confirmPw.value) ? confirmPw.value : '';
                    if (newVal.length < 6) { this.showToast('A senha deve ter pelo menos 6 caracteres.', 'error'); return; }
                    if (newVal !== confirmVal) { this.showToast('As senhas não coincidem.', 'error'); return; }
                    const currentVal = (currentPw && currentPw.value) ? currentPw.value : undefined;
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
        if (section === 'appearance' && type === 'user') {
            const bgTypeOpts = content.querySelectorAll('.settings-bg-type-opt');
            const solidWrap = content.querySelector('#settings-bg-solid-wrap');
            const gradientWrap = content.querySelector('#settings-bg-gradient-wrap');
            const imageWrap = content.querySelector('#settings-bg-image-wrap');
            const applyBtn = content.querySelector('#settings-bg-apply');
            const resetBtn = content.querySelector('#settings-bg-reset');
            const setBgType = (type) => {
                [solidWrap, gradientWrap, imageWrap].forEach((el) => { if (el) el.style.display = 'none'; });
                if (type === 'solid' && solidWrap) solidWrap.style.display = 'block';
                if (type === 'gradient' && gradientWrap) gradientWrap.style.display = 'block';
                if (type === 'image' && imageWrap) imageWrap.style.display = 'block';
                bgTypeOpts.forEach((opt) => {
                    const t = opt.dataset.bgType;
                    opt.style.borderColor = t === type ? 'var(--primary-yellow)' : 'rgba(255,255,255,.1)';
                    opt.style.background = t === type ? 'rgba(255,215,0,.1)' : 'transparent';
                });
            };
            bgTypeOpts.forEach((opt) => {
                opt.addEventListener('click', () => {
                    const t = opt.dataset.bgType;
                    localStorage.setItem('liberty-bg-type', t);
                    setBgType(t);
                });
            });
            const solidColor = content.querySelector('#settings-bg-solid-color');
            const solidHex = content.querySelector('#settings-bg-solid-hex');
            if (solidColor && solidHex) {
                solidColor.addEventListener('input', () => { solidHex.value = solidColor.value; });
                solidHex.addEventListener('input', () => { const v = solidHex.value.trim(); if (/^#[0-9A-Fa-f]{6}$/.test(v)) solidColor.value = v; });
            }
            const gradC1 = content.querySelector('#settings-bg-grad-color1');
            const gradH1 = content.querySelector('#settings-bg-grad-hex1');
            const gradC2 = content.querySelector('#settings-bg-grad-color2');
            const gradH2 = content.querySelector('#settings-bg-grad-hex2');
            if (gradC1 && gradH1) { gradC1.addEventListener('input', () => { gradH1.value = gradC1.value; }); gradH1.addEventListener('input', () => { const v = gradH1.value.trim(); if (/^#[0-9A-Fa-f]{6}$/.test(v)) gradC1.value = v; }); }
            if (gradC2 && gradH2) { gradC2.addEventListener('input', () => { gradH2.value = gradC2.value; }); gradH2.addEventListener('input', () => { const v = gradH2.value.trim(); if (/^#[0-9A-Fa-f]{6}$/.test(v)) gradC2.value = v; }); }
            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    const type = localStorage.getItem('liberty-bg-type') || 'default';
                    if (type === 'solid' && solidColor) {
                        const hex = (solidHex && solidHex.value.trim()) || solidColor.value;
                        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) { localStorage.setItem('liberty-bg-solid', hex); this.applyBackground(); this.showToast('Fundo aplicado.', 'success'); } else this.showToast('Cor inválida. Use #RRGGBB.', 'error');
                    } else if (type === 'gradient') {
                        const c1 = (gradH1 && gradH1.value.trim()) || gradC1?.value || '#0d0b09';
                        const c2 = (gradH2 && gradH2.value.trim()) || gradC2?.value || '#1a1814';
                        const angle = parseInt(content.querySelector('#settings-bg-grad-angle')?.value, 10) || 135;
                        if (/^#[0-9A-Fa-f]{6}$/.test(c1) && /^#[0-9A-Fa-f]{6}$/.test(c2)) {
                            localStorage.setItem('liberty-bg-gradient', JSON.stringify({ color1: c1, color2: c2, angle }));
                            this.applyBackground();
                            this.showToast('Gradiente aplicado.', 'success');
                        } else this.showToast('Cores inválidas. Use #RRGGBB.', 'error');
                    } else if (type === 'image') {
                        const url = content.querySelector('#settings-bg-image-url')?.value?.trim() || '';
                        if (url) {
                            localStorage.setItem('liberty-bg-image', url);
                            this.applyBackground();
                            this.showToast('Imagem de fundo aplicada.', 'success');
                        } else this.showToast('Cole a URL da imagem ou GIF.', 'error');
                    } else {
                        localStorage.setItem('liberty-bg-type', 'default');
                        this.applyBackground();
                        this.showToast('Fundo preto aplicado.', 'success');
                    }
                });
            }
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    localStorage.setItem('liberty-bg-type', 'default');
                    localStorage.removeItem('liberty-bg-solid');
                    localStorage.removeItem('liberty-bg-gradient');
                    localStorage.removeItem('liberty-bg-image');
                    this.applyBackground();
                    setBgType('default');
                    if (solidHex) solidHex.value = '#000000';
                    if (solidColor) solidColor.value = '#000000';
                    if (gradH1) gradH1.value = '#0d0b09';
                    if (gradC1) gradC1.value = '#0d0b09';
                    if (gradH2) gradH2.value = '#1a1814';
                    if (gradC2) gradC2.value = '#1a1814';
                    const angleEl = content.querySelector('#settings-bg-grad-angle');
                    if (angleEl) angleEl.value = '135';
                    const imgUrl = content.querySelector('#settings-bg-image-url');
                    if (imgUrl) imgUrl.value = '';
                    this.showToast('Fundo preto restaurado.', 'success');
                });
            }
        }
    }

    hideSettingsPanel() {
        if (this._settingsOverlay) {
            this._settingsOverlay.style.animation = 'none';
            this._settingsOverlay.style.opacity = '0';
            this._settingsOverlay.style.transition = 'opacity .2s ease';
            setTimeout(() => { this._settingsOverlay?.remove(); this._settingsOverlay = null; }, 200);
        }
    }

    // ═══════════════════════════════════════════
    //  TOAST
    // ═══════════════════════════════════════════

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info} toast-icon"></i>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button class="toast-close" aria-label="Close"><i class="fas fa-times"></i></button>
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
        this._typingTimeouts.set(userId, setTimeout(() => {
            this.typing.delete(userId);
            this._typingTimeouts.delete(userId);
            this.renderTypingIndicator();
        }, 5000));
    }

    renderTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (!indicator) return;
        const users = [...this.typing.values()];
        if (users.length === 0) { indicator.classList.add('hidden'); return; }
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

    scrollToBottom() {
        const container = document.getElementById('messages-container');
        if (container) container.scrollTop = container.scrollHeight;
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

    _parseMessageContent(content) {
        if (!content) return '';
        let escaped = this.escapeHtml(content);
        // Code blocks first (before inline code)
        escaped = escaped.replace(/```\n?([\s\S]*?)\n?```/g, '<pre class="message-code-block"><code>$1</code></pre>');
        escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
        escaped = escaped.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        escaped = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        escaped = escaped.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
        escaped = escaped.replace(/\n/g, '<br>');
        return escaped;
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
            dmItem.classList.toggle('dm-list-item-unread', !!hasUnread);
            let redDot = dmItem.querySelector('.dm-unread-dot');
            if (hasUnread && !redDot) {
                redDot = document.createElement('span');
                redDot.className = 'dm-unread-dot';
                redDot.setAttribute('aria-label', 'Não lida');
                dmItem.appendChild(redDot);
            } else if (!hasUnread && redDot) redDot.remove();
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

document.addEventListener('DOMContentLoaded', () => {
    window.app = new LibertyApp();
});











