// LIBERTY - App Completo com Todas Funções

class LibertyApp {
    constructor() {
        this.currentUser = null;
        this.servers = [];
        this.currentServer = null;
        this.LIBERTY_SERVER_ID = 'liberty-main-server';
        this.currentChannel = null;
        this.currentDM = null;
        this.friends = [];
        this.pendingFriends = [];
        this.blockedFriends = [];
        this.roles = [
            { id: '0', name: 'Admin', color: '#FFFF00', permissions: ['admin', 'manage', 'roles', 'channels', 'kick', 'ban', 'messages', 'manage-msg'] },
            { id: '1', name: 'Moderador', color: '#FFD700', permissions: ['kick', 'ban', 'messages', 'manage-msg'] },
            { id: '2', name: '@todos', color: '#888888', permissions: ['messages'] }
        ];
        this.messages = {};
        this.dmMessages = {};
        this.settings = this.loadSettings();
        this._storedUsersCache = null;
        this.selectedRole = 0;
        this.micOn = true;
        this.deafened = false;
        this.inVoice = false;
        this._localStream = null;
        this._screenStream = null;
        this._callVideoOn = false;
        this._callStartTime = null;
        this._callDurationTimer = null;
        this._callPeerConnection = null;
        this._callRoom = null;
        this.serverIconData = null;
        
        this.pendingAttachments = [];
        this.LIMITS = {
            free: { chars: 5000, filesBytes: 100 * 1024 * 1024 },
            premium: { chars: 10000, filesBytes: 250 * 1024 * 1024 },
            premium_plus: { chars: 20000, filesBytes: 500 * 1024 * 1024 },
            vip: { chars: 50000, filesBytes: 1024 * 1024 * 1024 },
            mvp: { chars: 100000, filesBytes: 5 * 1024 * 1024 * 1024 }
        };
        this.emojis = {
            smile: ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '🥺', '😤'],
            people: ['👍', '👎', '👋', '🤝', '👏', '🙌', '💪', '🤷', '🙅', '🙆'],
            animals: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯'],
            food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍩', '🍪', '☕', '🍺'],
            activity: ['⚽', '🏀', '🎮', '🎯', '🎲', '🎵', '🎸', '🎤', '🎧', '🎬']
        };
        
        this._activityTimer = null;
        this._translationCache = {};
        this.init();
    }
    
    lang() {
        return this.currentUser?.lang || 'en';
    }
    
    t(key, params = {}) {
        let s = window.t ? window.t(key, this.lang()) : key;
        Object.keys(params).forEach(k => { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]); });
        return s.replace(/#\{(\w+)\}/g, (_, k) => params[k] || '');
    }
    
    applyTranslations(lang) {
        const l = lang || this.lang();
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key && window.t) el.textContent = window.t(key, l);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key && window.t) el.placeholder = window.t(key, l);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key && window.t) el.title = window.t(key, l);
        });
    }
    
    startActivityTracking() {
        this.stopActivityTracking();
        if (!this.currentUser) return;
        this._lastActivitySave = Date.now();
        this._activityTimer = setInterval(() => {
            if (!this.currentUser) return;
            const now = Date.now();
            const elapsedMin = (now - this._lastActivitySave) / 60000;
            this.currentUser.activityMinutes = (this.currentUser.activityMinutes || 0) + elapsedMin;
            this._lastActivitySave = now;
            this.saveUser();
        }, 10000);
    }
    
    stopActivityTracking() {
        if (this._activityTimer) {
            clearInterval(this._activityTimer);
            this._activityTimer = null;
        }
    }

    async _getEncrypted(key) {
        const raw = localStorage.getItem(key);
        if (raw == null || raw === '') return null;
        if (window.LibertyCrypto) {
            const dec = await LibertyCrypto.decryptFromStorage(raw);
            return dec;
        }
        try { return JSON.parse(raw); } catch { return raw; }
    }

    async _setEncrypted(key, value) {
        if (window.LibertyCrypto) {
            const enc = await LibertyCrypto.encryptForStorage(value);
            localStorage.setItem(key, enc);
        } else {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
    }
    
    async loadMessagesFromStorage() {
        try {
            const data = await this._getEncrypted('liberty_messages');
            this.messages = data && typeof data === 'object' ? data : {};
        } catch { this.messages = {}; }
        try {
            const data = await this._getEncrypted('liberty_dm_messages');
            this.dmMessages = data && typeof data === 'object' ? data : {};
        } catch { this.dmMessages = {}; }
    }
    
    async loadFriendsFromStorage() {
        if (!this.currentUser?.id) return;
        try {
            const key = 'liberty_friends_' + this.currentUser.id;
            const data = await this._getEncrypted(key);
            if (data && typeof data === 'object') {
                if (Array.isArray(data.friends)) this.friends = data.friends;
                if (Array.isArray(data.pendingFriends)) this.pendingFriends = data.pendingFriends;
                if (Array.isArray(data.blockedFriends)) this.blockedFriends = data.blockedFriends;
            }
        } catch (_) {}
    }
    
    async saveFriends() {
        if (!this.currentUser?.id) return;
        try {
            const key = 'liberty_friends_' + this.currentUser.id;
            await this._setEncrypted(key, {
                friends: this.friends || [],
                pendingFriends: this.pendingFriends || [],
                blockedFriends: this.blockedFriends || []
            });
        } catch (e) { console.warn('saveFriends:', e); }
    }
    
    async saveMessagesToStorage() {
        try {
            await this._setEncrypted('liberty_messages', this.messages);
            await this._setEncrypted('liberty_dm_messages', this.dmMessages);
        } catch (e) {
            if (e && e.name === 'QuotaExceededError') {
                this.trimMessagesToFitStorage();
                try {
                    await this._setEncrypted('liberty_messages', this.messages);
                    await this._setEncrypted('liberty_dm_messages', this.dmMessages);
                } catch (_) {
                    console.warn('Erro ao salvar mensagens após enxugar histórico.');
                }
            } else {
                console.warn('Erro ao salvar mensagens:', e);
            }
        }
    }

    trimMessagesToFitStorage() {
        const maxPerChannel = 150;
        const maxPerDm = 150;
        if (this.messages && typeof this.messages === 'object') {
            for (const k of Object.keys(this.messages)) {
                const arr = this.messages[k];
                if (Array.isArray(arr) && arr.length > maxPerChannel)
                    this.messages[k] = arr.slice(-maxPerChannel);
            }
        }
        if (this.dmMessages && typeof this.dmMessages === 'object') {
            for (const k of Object.keys(this.dmMessages)) {
                const arr = this.dmMessages[k];
                if (Array.isArray(arr) && arr.length > maxPerDm)
                    this.dmMessages[k] = arr.slice(-maxPerDm);
            }
        }
    }

    setupStorageSync() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'liberty_messages' || e.key === 'liberty_dm_messages') {
                this.loadMessagesFromStorage().then(() => {
                    if (this.currentChannel) this.loadMessages();
                    if (this.currentDM) this.loadDMMessages(this.currentDM.id);
                });
            }
        });
    }
    
    async init() {
        this.bindEvents();
        await this.loadMessagesFromStorage();
        this.setupStorageSync();
        this.applySettings();
        const settingsDecrypted = await this._getEncrypted('liberty_settings');
        if (settingsDecrypted && typeof settingsDecrypted === 'object') {
            this.settings = { ...this.settings, ...settingsDecrypted };
            this.applySettings();
        }
        this.loadEmojis('smile');
        const savedRaw = localStorage.getItem('liberty_user');
        if (savedRaw) {
            try {
                let parsed = null;
                if (window.LibertyCrypto && LibertyCrypto.looksEncrypted(savedRaw)) {
                    parsed = await LibertyCrypto.decryptFromStorage(savedRaw);
                } else {
                    parsed = JSON.parse(savedRaw);
                }
                this.currentUser = this.ensureAuthMethods(parsed);
                if (this.currentUser.password && !this.currentUser.password_hash && window.LibertyCrypto) {
                    this.currentUser.password_hash = await LibertyCrypto.hashPassword(this.currentUser.password);
                    delete this.currentUser.password;
                    await this.saveUser();
                }
                await this.loadAvatarIntoUser(this.currentUser);
                await this.loadFriendsFromStorage();
                const usersRaw = localStorage.getItem('liberty_users');
                if (usersRaw) {
                    if (window.LibertyCrypto && LibertyCrypto.looksEncrypted(usersRaw)) {
                        this._storedUsersCache = await LibertyCrypto.decryptFromStorage(usersRaw);
                    } else {
                        this._storedUsersCache = JSON.parse(usersRaw);
                    }
                }
                if ((!usersRaw || !Object.keys(this._storedUsersCache || {}).length) && window.LibertyDB) {
                    const all = await LibertyDB.getAllUsers();
                    this._storedUsersCache = {};
                    all.forEach(u => { if (u && u.username) this._storedUsersCache[u.username] = u; });
                }
                await this.showApp();
            } catch {
                this.applyTranslations('en');
                document.getElementById('auth-choice-page').classList.remove('hidden');
            }
        } else {
            this.applyTranslations('en');
            document.getElementById('auth-choice-page').classList.remove('hidden');
        }
    }
    
    // Navigation
    async showApp() {
        const appEl = document.getElementById('app');
        if (appEl) {
            appEl.classList.remove('hidden');
        }
        document.getElementById('auth-choice-page')?.classList.add('hidden');
        document.getElementById('login-page')?.classList.add('hidden');
        document.getElementById('register-page')?.classList.add('hidden');
        document.getElementById('mfa-setup-page')?.classList.add('hidden');

        await this.loadServers();
        try {
            await this.ensureLibertyServer();
        } catch (e) {
            console.warn('ensureLibertyServer error:', e);
            this.ensureLibertyServerFallback();
        }
        if (!Array.isArray(this.servers) || this.servers.length === 0) {
            this.ensureLibertyServerFallback();
        }
        this.renderServers();
        this.applyTranslations();
        this.updateUI();
        this.updateCharIndicator();
        this.startActivityTracking();
        const lib = this.servers && this.servers.find(s => s && s.id === this.LIBERTY_SERVER_ID);
        if (lib) {
            this.selectServer(this.LIBERTY_SERVER_ID);
        }
        if (window.LibertyAPI) {
            LibertyAPI.checkApi().then(ok => {
                if (ok) {
                    LibertyAPI.realtimeConnect();
                    LibertyAPI.onRealtimeMessage(this.handleRealtimeMessage.bind(this));
                }
            });
        }
        if (window.LibertyWebSocket) {
            LibertyWebSocket.onWebRTCSignal(this.handleWebRTCSignal.bind(this));
        }
        const hashMatch = typeof window !== 'undefined' && window.location.hash && window.location.hash.match(/^#invite\/([a-zA-Z0-9]{6,12})$/);
        if (hashMatch) {
            await this.showInviteLanding(hashMatch[1]);
            return;
        }
    }

    ensureLibertyServerFallback() {
        if (!Array.isArray(this.servers)) this.servers = [];
        let lib = this.servers.find(s => s && s.id === this.LIBERTY_SERVER_ID);
        if (!lib) {
            lib = {
                id: this.LIBERTY_SERVER_ID,
                name: 'Liberty',
                icon: 'assets/logo.png',
                region: 'br',
                channels: [
                    { id: this.uuid(), name: 'geral', type: 'text' },
                    { id: this.uuid(), name: 'voz', type: 'voice' }
                ],
                roles: JSON.parse(JSON.stringify(this.roles)),
                members: this.currentUser ? [{ ...this.currentUser, serverAvatars: {}, roles: ['Admin'], status: 'online' }] : [],
                invites: []
            };
            this.servers.unshift(lib);
        }
        this.saveServers();
        this.renderServers();
    }
    
    showLogin() {
        document.getElementById('app').classList.add('hidden');
        document.getElementById('mfa-setup-page').classList.add('hidden');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('register-page').classList.add('hidden');
        document.getElementById('auth-choice-page').classList.remove('hidden');
    }
    
    showLoginForm() {
        document.getElementById('auth-choice-page').classList.add('hidden');
        document.getElementById('register-page').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');
    }
    
    showRegisterForm() {
        document.getElementById('auth-choice-page').classList.add('hidden');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('register-page').classList.remove('hidden');
    }
    
    showMfaSetup() {
        document.getElementById('auth-choice-page').classList.add('hidden');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('register-page').classList.add('hidden');
        document.getElementById('app').classList.add('hidden');
        document.getElementById('mfa-setup-page').classList.remove('hidden');
    }
    
    finishMfaSetup() {
        document.getElementById('mfa-setup-page').classList.add('hidden');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('register-page').classList.add('hidden');
        document.getElementById('auth-choice-page').classList.add('hidden');
        this.showApp();
    }
    
    showAdminPage() {
        if (this.currentUser?.username !== 'Zerk') return;
        document.getElementById('app').classList.add('hidden');
        document.getElementById('admin-page').classList.remove('hidden');
        this.loadAdminData();
    }
    
    hideAdminPage() {
        document.getElementById('admin-page').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }
    
    async loadAdminData() {
        let users = [];
        if (window.LibertyDB) {
            users = await LibertyDB.getAllUsers();
        } else {
            const stored = this.getStoredUsers();
            users = Object.values(stored).filter(u => u && typeof u === 'object').map(u => this.ensureAuthMethods(u));
        }
        this._adminUsers = users;
        this.renderAdminUsers(users);
    }
    
    renderAdminUsers(users) {
        const tbody = document.getElementById('admin-users-body');
        const countEl = document.getElementById('admin-user-count');
        if (!tbody) return;
        const fmt = (v) => v || '—';
        const fmtDate = (ts) => ts ? new Date(ts).toLocaleString('pt-BR') : '—';
        tbody.innerHTML = users.map(u => {
            const a = u.auth_methods || {};
            return `
                <tr>
                    <td class="user-cell">${this.escape(fmt(u.username))} ${fmt(u.tag)}</td>
                    <td class="mono">${this.escape(fmt(u.email))}</td>
                    <td class="mono">${this.escape(u.password_hash ? '••••••' : fmt(null))}</td>
                    <td class="mono">${this.escape(fmt(u.hwid || a.hardware_uuid?.value))}</td>
                    <td class="mono">${this.escape(fmt(a.mac_address?.value))}</td>
                    <td class="mono">${this.escape(fmt(a.ip?.value))}</td>
                    <td class="mono">${this.escape(fmt(a.phone_verification?.phone))}</td>
                    <td><span class="badge ${a.pin?.configured ? 'yes' : 'no'}">${a.pin?.configured ? 'Sim' : 'Não'}</span></td>
                    <td>${fmtDate(u.created_at)}</td>
                </tr>
            `;
        }).join('');
        if (countEl) countEl.textContent = `${users.length} usuário${users.length !== 1 ? 's' : ''}`;
    }
    
    filterAdminUsers(query) {
        const q = (query || '').toLowerCase().trim();
        if (!this._adminUsers) return;
        const filtered = q ? this._adminUsers.filter(u =>
            (u.username || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.hwid || '').toLowerCase().includes(q)
        ) : this._adminUsers;
        this.renderAdminUsers(filtered);
    }
    
    // Events
    bindEvents() {
        // Auth - fluxo com login primeiro, depois criar conta
        document.getElementById('btn-login').addEventListener('click', () => this.showLoginForm());
        document.getElementById('btn-register').addEventListener('click', () => this.showRegisterForm());
        document.getElementById('switch-to-register').addEventListener('click', e => {
            e.preventDefault();
            this.showRegisterForm();
        });
        document.getElementById('switch-to-login').addEventListener('click', e => {
            e.preventDefault();
            this.showLoginForm();
        });
        document.getElementById('login-form').addEventListener('submit', e => {
            e.preventDefault();
            this.login();
        });
        document.getElementById('register-form').addEventListener('submit', e => {
            e.preventDefault();
            this.register();
        });
        document.getElementById('mfa-skip').addEventListener('click', () => this.finishMfaSetup());
        document.getElementById('mfa-option-sms').addEventListener('click', () => this.toast('SMS configurado! (demonstração)'));
        document.getElementById('mfa-option-authenticator').addEventListener('click', () => this.toast('App autenticador configurado! (demonstração)'));
        document.getElementById('mfa-option-email').addEventListener('click', () => this.toast('E-mail de verificação configurado! (demonstração)'));
        
        // Servers
        const addServerBtn = document.getElementById('add-server');
        if (addServerBtn) addServerBtn.addEventListener('click', () => {
            this.openCreateServerModal();
        });
        const homeBtn = document.querySelector('.server-icon.home');
        if (homeBtn) homeBtn.addEventListener('click', () => this.goHome());
        const serverForm = document.getElementById('server-form');
        if (serverForm) serverForm.addEventListener('submit', e => {
            e.preventDefault();
            this.createServer();
        });
        
        // Server icon upload
        document.getElementById('server-icon-upload').addEventListener('click', () => {
            document.getElementById('server-icon-input').click();
        });
        
        document.getElementById('server-icon-input').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                this.serverIconData = ev.target.result;
                const upload = document.getElementById('server-icon-upload');
                upload.innerHTML = `<img src="${this.serverIconData}" alt="Icon">`;
            };
            reader.readAsDataURL(file);
        });
        
        // Channels
        document.getElementById('channel-form').addEventListener('submit', e => {
            e.preventDefault();
            this.createChannel();
        });
        document.getElementById('category-form')?.addEventListener('submit', e => {
            e.preventDefault();
            this.createCategory();
        });
        document.getElementById('settings-add-channel-btn')?.addEventListener('click', () => {
            if (!this.canManageChannels()) {
                this.toast('Apenas donos do servidor ou administradores podem adicionar canais.', 'error');
                return;
            }
            this.openAddModal('channel');
        });
        document.getElementById('channel-edit-form')?.addEventListener('submit', e => {
            e.preventDefault();
            this.saveChannelEdit();
        });
        
        document.querySelectorAll('.channel-type').forEach(t => {
            t.addEventListener('click', () => {
                document.querySelectorAll('.channel-type').forEach(x => x.classList.remove('active'));
                t.classList.add('active');
            });
        });
        
        document.getElementById('modal-channel')?.addEventListener('click', e => {
            const tab = e.target.closest('.add-tab');
            if (tab && tab.dataset.tab) this.switchAddModalTab(tab.dataset.tab);
        });
        document.getElementById('channel-name-input')?.addEventListener('input', () => this.updateChannelSlugPreview());
        
        // Friends
        document.getElementById('add-friend-btn').addEventListener('click', () => this.openAddFriendModal());
        document.getElementById('add-friend-empty')?.addEventListener('click', () => this.openAddFriendModal());
        document.getElementById('header-add-friend-btn')?.addEventListener('click', () => this.openAddFriendModal());
        document.getElementById('friends-tab').addEventListener('click', () => this.showFriends());
        document.getElementById('rankings-tab')?.addEventListener('click', () => this.showRankings());
        document.getElementById('shortcut-missoes')?.addEventListener('click', () => this.toast('Em breve', 'info'));
        document.getElementById('shortcut-loja')?.addEventListener('click', () => this.toast('Em breve', 'info'));
        
        document.getElementById('friend-form').addEventListener('submit', e => {
            e.preventDefault();
            this.addFriend();
        });
        
        document.querySelectorAll('.friends-tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.friends-tabs .tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.filterFriends(tab.dataset.tab);
            });
        });
        
        // Settings
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettingsModal('player'));
        document.getElementById('server-settings-btn')?.addEventListener('click', () => this.openSettingsModal('server'));
        document.getElementById('user-avatar')?.addEventListener('click', () => {
            if (this.currentUser) this.openSettingsModal('player');
        });
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        
        // Admin (apenas Zerk)
        document.getElementById('admin-btn')?.addEventListener('click', () => this.showAdminPage());
        document.getElementById('admin-back-btn')?.addEventListener('click', () => this.hideAdminPage());
        document.getElementById('admin-search')?.addEventListener('input', e => this.filterAdminUsers(e.target.value));
        
        document.querySelectorAll('.settings-item').forEach(item => {
            item.addEventListener('click', () => this.switchPanel(item.dataset.panel));
        });
        
        // Avatar upload
        document.getElementById('settings-avatar').addEventListener('click', () => {
            document.getElementById('avatar-input').click();
        });
        
        document.getElementById('btn-avatar-change')?.addEventListener('click', () => {
            document.getElementById('avatar-input').click();
        });
        document.getElementById('avatar-input').addEventListener('change', e => this.uploadAvatar(e));
        document.getElementById('avatar-apply-all')?.addEventListener('change', e => {
            document.getElementById('avatar-server-select')?.classList.toggle('hidden', e.target.checked);
        });
        document.getElementById('avatar-modal-save')?.addEventListener('click', () => this.saveAvatarFromModal());
        document.getElementById('avatar-modal-cancel')?.addEventListener('click', () => { this._pendingAvatarData = null; });
        document.getElementById('clear-database-btn')?.addEventListener('click', () => this.clearAllData());
        document.getElementById('delete-my-account-btn')?.addEventListener('click', () => this.openDeleteAccountModal());
        document.getElementById('delete-account-confirm-btn')?.addEventListener('click', () => this.confirmDeleteMyAccount());
        
        // Banner upload
        document.getElementById('profile-banner').addEventListener('click', () => {
            document.getElementById('banner-input').click();
        });
        
        document.getElementById('banner-input').addEventListener('change', e => this.uploadBanner(e));
        
        // Username
        document.getElementById('save-username').addEventListener('click', async () => {
            const newName = document.getElementById('edit-username').value.trim();
            if (!newName) return this.toast(this.t('toast_name_empty'), 'error');
            const exists = window.LibertyDB ? await LibertyDB.getUserByUsername(newName) : this.getStoredUsers()[newName];
            if (exists && exists.id !== this.currentUser.id) return this.toast(this.t('toast_name_in_use'), 'error');
            const oldName = this.currentUser.username;
            this.currentUser.username = newName;
            if (!window.LibertyDB) {
                const users = this.getStoredUsers();
                delete users[oldName];
                users[newName] = { ...this.currentUser };
                this._storedUsersCache = users;
            }
            await this.saveUser();
            this.toast(this.t('toast_name_saved'));
        });
        
        // Auth - Email
        document.getElementById('save-mfa-email')?.addEventListener('click', () => {
            this.currentUser.email = document.getElementById('mfa-email').value.trim();
            this.saveUser();
            this.toast('Email salvo!');
        });
        
        // Auth - redirecionar para UI de verificação
        document.getElementById('save-auth-password')?.addEventListener('click', () => this.showVerificationModal('password'));
        document.getElementById('save-auth-pin')?.addEventListener('click', () => this.showVerificationModal('pin'));
        document.getElementById('setup-windows-hello')?.addEventListener('click', () => this.showVerificationModal('windows_hello'));
        document.getElementById('setup-yubikey')?.addEventListener('click', () => this.showVerificationModal('yubikey'));
        document.getElementById('link-mac')?.addEventListener('click', () => this.showVerificationModal('mac_address'));
        document.getElementById('link-ip')?.addEventListener('click', () => this.showVerificationModal('ip'));
        document.getElementById('link-hwid')?.addEventListener('click', () => this.showVerificationModal('hardware_uuid'));
        document.getElementById('setup-phone')?.addEventListener('click', () => this.showVerificationModal('phone_verification'));
        document.getElementById('setup-email-verification')?.addEventListener('click', () => this.showVerificationModal('email_verification'));
        
        // Verificação - handlers do modal
        document.getElementById('verify-password-btn')?.addEventListener('click', () => this.verifyPassword());
        document.getElementById('verify-pin-btn')?.addEventListener('click', () => this.verifyPin());
        document.getElementById('verify-password-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); this.verifyPassword(); }
        });
        document.getElementById('verify-pin-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); this.verifyPin(); }
        });
        document.getElementById('verify-windows-hello-btn')?.addEventListener('click', () => this.verifyWebAuthn('platform'));
        document.getElementById('verify-yubikey-btn')?.addEventListener('click', () => this.verifyWebAuthn('cross-platform'));
        document.getElementById('verify-mac-btn')?.addEventListener('click', () => this.verifyDevice('mac_address'));
        document.getElementById('verify-ip-btn')?.addEventListener('click', () => this.verifyDevice('ip'));
        document.getElementById('verify-hwid-btn')?.addEventListener('click', () => this.verifyDevice('hardware_uuid'));
        document.getElementById('verify-phone-sms')?.addEventListener('click', () => this.verifyPhoneRequest('sms'));
        document.getElementById('verify-phone-call')?.addEventListener('click', () => this.verifyPhoneRequest('call'));
        document.getElementById('verify-phone-btn')?.addEventListener('click', () => this.verifyPhoneCode());
        document.getElementById('verify-email-btn')?.addEventListener('click', () => this.verifyEmailCode());
        document.getElementById('verify-email-resend')?.addEventListener('click', () => this.verifyEmailResend());
        document.getElementById('verify-cancel-btn')?.addEventListener('click', () => {
            this._loginPendingUser = false;
            this.closeModal('modal-verify');
        });
        
        // Auth toggles - show/hide config and save state
        const authIdMap = { password:'password', pin:'pin', windows_hello:'windows-hello', yubikey:'yubikey', mac_address:'mac', ip:'ip', hardware_uuid:'hwid', phone_verification:'phone', email_verification:'email-verification' };
        Object.entries(authIdMap).forEach(([method, elId]) => {
            const cb = document.getElementById(`auth-${elId}-enabled`);
            const cfg = document.querySelector(`.auth-${elId}-config`);
            if (cb && cfg) {
                cb.addEventListener('change', async () => {
                    cfg.classList.toggle('visible', cb.checked);
                    if (this.currentUser?.auth_methods) {
                        if (!this.currentUser.auth_methods[method]) this.currentUser.auth_methods[method] = { enabled: false, configured: false };
                        this.currentUser.auth_methods[method].enabled = cb.checked;
                        await this.saveUser();
                    }
                });
            }
        });
        
        document.getElementById('subscription-tier').addEventListener('change', async e => {
            if (!this.currentUser) return;
            this.currentUser.subscription = e.target.value;
            await this.saveUser();
            this.updateCharIndicator();
            this.toast(this.t('toast_premium_updated'));
        });
        document.getElementById('settings-lang').addEventListener('change', async e => {
            if (!this.currentUser) return;
            this.currentUser.lang = e.target.value;
            await this.saveUser();
            this.applyTranslations();
            this.toast(this.t('toast_premium_updated'));
        });
        
        // Bio
        document.getElementById('bio-input').addEventListener('input', e => {
            document.getElementById('bio-count').textContent = e.target.value.length;
            this.currentUser.bio = e.target.value;
            this.saveUser();
        });

        // Profile color: solid vs gradient
        document.querySelectorAll('.profile-color-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.profile-color-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const isGradient = btn.dataset.mode === 'gradient';
                document.getElementById('profile-color-solid')?.classList.toggle('hidden', isGradient);
                document.getElementById('profile-color-gradient')?.classList.toggle('hidden', !isGradient);
                if (isGradient) {
                    this.applyGradientProfileColor();
                } else {
                    const activeSolid = document.querySelector('#profile-color-solid .color-opt.active');
                    if (activeSolid) {
                        this.currentUser.profileColor = activeSolid.dataset.color;
                        this.saveUser();
                        this.applyProfileColorStyle(document.getElementById('profile-banner'), this.currentUser.profileColor);
                        this.applyProfileColorStyle(document.getElementById('profile-avatar-preview'), this.currentUser.profileColor);
                    }
                }
            });
        });
        document.getElementById('profile-gradient-color1')?.addEventListener('input', () => this.applyGradientProfileColor());
        document.getElementById('profile-gradient-color2')?.addEventListener('input', () => this.applyGradientProfileColor());
        document.getElementById('profile-gradient-angle')?.addEventListener('input', e => {
            const v = e.target.value;
            document.getElementById('profile-gradient-angle-value').textContent = v + '°';
            this.applyGradientProfileColor();
        });
        
        // Colors
        document.querySelectorAll('.color-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const parent = btn.closest('.color-options');
                parent.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (btn.closest('.accent-colors')) {
                    this.setAccentColor(btn.dataset.color);
                } else {
                    this.currentUser.profileColor = btn.dataset.color;
                    this.saveUser();
                    const banner = document.getElementById('profile-banner');
                    if (!this.currentUser.banner) this.applyProfileColorStyle(banner, this.currentUser.profileColor);
                    this.applyProfileColorStyle(document.getElementById('profile-avatar-preview'), this.currentUser.profileColor);
                    this.applyProfileColorStyle(document.getElementById('profile-color-preview'), this.currentUser.profileColor);
                }
            });
        });
        
        // Theme
        document.querySelectorAll('input[name="theme"]').forEach(r => {
            r.addEventListener('change', e => this.setTheme(e.target.value));
        });

        // Fundo do chat (Aparência)
        const bgInput = document.getElementById('background-image-input');
        document.getElementById('appearance-bg-choose')?.addEventListener('click', () => bgInput?.click());
        document.getElementById('appearance-bg-clear')?.addEventListener('click', () => {
            this.settings.backgroundUrl = '';
            this.settings.backgroundGradient = null;
            this.saveSettings();
            this.applySettings();
            this.toast('Fundo removido');
        });
        document.getElementById('appearance-bg-gradient-btn')?.addEventListener('click', () => {
            document.getElementById('appearance-bg-gradient-box')?.classList.remove('hidden');
        });
        document.getElementById('appearance-bg-gradient-apply')?.addEventListener('click', () => {
            const c1 = document.getElementById('appearance-gradient-color1')?.value || '#1a1a2e';
            const c2 = document.getElementById('appearance-gradient-color2')?.value || '#16213e';
            const angle = parseInt(document.getElementById('appearance-gradient-angle')?.value || '135', 10);
            this.settings.backgroundGradient = { color1: c1, color2: c2, angle };
            this.settings.backgroundUrl = '';
            this.saveSettings();
            this.applySettings();
            this.toast('Gradiente aplicado');
        });
        bgInput?.addEventListener('change', e => {
            const file = e.target.files?.[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = () => {
                this.settings.backgroundUrl = reader.result;
                this.settings.backgroundGradient = null;
                this.saveSettings();
                this.applySettings();
                this.updateAppearanceBackgroundPreview();
                this.toast('Fundo do chat atualizado');
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        });

        // gif-btn na barra de mensagem abre seletor de imagem/GIF para o fundo
        document.querySelector('.gif-btn')?.addEventListener('click', () => bgInput?.click());
        
        // Roles
        document.getElementById('add-role-btn').addEventListener('click', () => this.addRole());
        document.getElementById('save-role').addEventListener('click', () => this.saveRole());
        document.getElementById('delete-role').addEventListener('click', () => this.deleteRole());
        
        document.getElementById('role-color').addEventListener('input', e => {
            const dot = document.querySelector('.role-item.active .role-dot');
            if (dot) dot.style.background = e.target.value;
        });
        
        // Messages
        document.getElementById('message-input').addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        
        document.getElementById('attach-btn').addEventListener('click', () => document.getElementById('file-input').click());
        document.getElementById('file-input').addEventListener('change', e => this.handleFileSelect(e));
        document.getElementById('message-input').addEventListener('input', () => this.updateCharIndicator());
        
        // Voice
        document.getElementById('mic-btn').addEventListener('click', () => this.toggleMic());
        document.getElementById('headphone-btn').addEventListener('click', () => this.toggleDeafen());
        document.getElementById('call-btn').addEventListener('click', () => this.startCall());
        document.getElementById('video-btn').addEventListener('click', () => this.startCall(true));
        document.getElementById('disconnect-btn').addEventListener('click', () => this.endCall());
        document.getElementById('screen-btn').addEventListener('click', () => this.toggleScreenShare());
        document.getElementById('video-voice-btn').addEventListener('click', () => this.toggleCallVideo());
        document.getElementById('call-control-end')?.addEventListener('click', () => this.endCall());
        document.getElementById('call-control-mic')?.addEventListener('click', () => this.toggleMic());
        document.getElementById('call-control-video')?.addEventListener('click', () => this.toggleCallVideo());
        document.getElementById('call-control-screen')?.addEventListener('click', () => this.toggleScreenShare());
        const callDrag = document.getElementById('call-view-drag');
        if (callDrag) callDrag.addEventListener('mousedown', e => this.callWidgetStartDrag(e));
        
        // Members
        document.getElementById('members-btn').addEventListener('click', () => {
            document.getElementById('member-bar').classList.toggle('hidden');
        });
        
        // Invite
        document.getElementById('invite-btn').addEventListener('click', () => {
            if (this.currentServer) {
                this.generateInvite();
                this.openModal('modal-invite');
            } else {
                this.toast('Selecione um servidor', 'error');
            }
        });
        
        document.getElementById('copy-invite').addEventListener('click', () => {
            const link = document.getElementById('invite-link');
            if (link && link.value) {
                link.select();
                document.execCommand('copy');
                this.toast('Link copiado!');
            }
        });
        
        document.getElementById('create-invite')?.addEventListener('click', () => {
            this.generateInvite();
            this.openModal('modal-invite');
        });
        document.getElementById('copy-invite-settings')?.addEventListener('click', () => {
            const input = document.getElementById('invite-link-settings');
            if (input && input.value) {
                input.select();
                document.execCommand('copy');
                this.toast('Link copiado!');
            }
        });
        document.getElementById('open-invite-modal')?.addEventListener('click', () => {
            this.generateInvite();
            this.openModal('modal-invite');
        });
        
        document.getElementById('messages-area')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.invite-embed-join, .btn-invite-join');
            if (!btn) return;
            const card = btn.closest('.message-embed-invite');
            const code = card && card.dataset.inviteCode;
            if (code) this.joinServerByInvite(code);
        });
        
        // Emoji
        document.getElementById('emoji-btn').addEventListener('click', () => {
            document.getElementById('emoji-picker').classList.toggle('hidden');
        });
        
        document.querySelectorAll('.emoji-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadEmojis(tab.dataset.cat);
            });
        });
        
        document.getElementById('emoji-search').addEventListener('input', e => {
            this.searchEmojis(e.target.value);
        });
        
        // Emoji upload
        document.getElementById('emoji-upload-area')?.addEventListener('click', () => {
            document.getElementById('emoji-file-input')?.click();
        });
        
        // Close modals
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
        document.getElementById('user-profile-send-msg')?.addEventListener('click', () => {
            const id = this._profileModalUserId;
            const user = this._profileModalUser;
            this.closeModals();
            if (!id && !user) return;
            const friend = this.friends?.find(f => f.id === id || (f.username || '').toLowerCase() === (user?.username || '').toLowerCase());
            if (friend) {
                this.goHome();
                setTimeout(() => this.openDM(friend.id), 50);
            } else {
                this.openAddFriendModal(user?.username || '');
                this.toast('Adicione como amigo para enviar mensagem.', 'info');
            }
        });
        document.getElementById('user-profile-add-friend')?.addEventListener('click', () => {
            const user = this._profileModalUser;
            this.closeModals();
            this.openAddFriendModal(user?.username || '');
        });
        document.getElementById('user-profile-add-role-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleProfileRolesDropdown();
        });
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('user-profile-roles-dropdown');
            if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && !document.getElementById('user-profile-add-role-btn')?.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        
        document.querySelectorAll('.modal').forEach(m => {
            m.addEventListener('click', e => {
                if (e.target === m) this.closeModals();
            });
        });
        
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') this.closeModals();
        });
        
        // Context menu
        document.addEventListener('click', () => {
            document.getElementById('context-menu').classList.remove('active');
            document.getElementById('channel-context-menu')?.classList.remove('active');
            document.getElementById('category-context-menu')?.classList.remove('active');
            document.getElementById('channel-item-context-menu')?.classList.remove('active');
        });
        
        document.querySelectorAll('.ctx-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const menu = item.closest('.context-menu');
                const menuId = menu?.id;
                if (menuId === 'channel-context-menu') {
                    document.getElementById('channel-context-menu').classList.remove('active');
                    if (item.dataset.action === 'add-channel') {
                        this.openAddModal('channel');
                    } else if (item.dataset.action === 'add-category') {
                        this.openAddModal('category');
                    }
                    return;
                }
                if (menuId === 'category-context-menu') {
                    const categoryId = document.getElementById('category-context-menu').dataset.categoryId;
                    document.getElementById('category-context-menu').classList.remove('active');
                    if (item.dataset.action === 'add-channel-here') {
                        this.fillChannelCategorySelect();
                        this.openAddModal('channel');
                        const sel = document.getElementById('channel-category-select');
                        if (sel && categoryId) sel.value = categoryId;
                    } else if (item.dataset.action === 'edit-category') {
                        const cat = this.currentServer?.categories?.find(c => c.id === categoryId);
                        if (cat) {
                            const n = prompt('Novo nome da categoria:', cat.name);
                            if (n != null && n.trim()) { cat.name = n.trim(); this.saveServers(); this.renderChannels(); this.toast('Categoria atualizada'); }
                        }
                    } else if (item.dataset.action === 'delete-category') {
                        this.deleteCategory(categoryId);
                    }
                    return;
                }
                if (menuId === 'channel-item-context-menu') {
                    const channelId = document.getElementById('channel-item-context-menu').dataset.channelId;
                    document.getElementById('channel-item-context-menu').classList.remove('active');
                    const ch = this.currentServer?.channels?.find(c => c.id === channelId);
                    if (item.dataset.action === 'edit-channel' && ch) {
                        this.openChannelEditModal(ch);
                    } else if (item.dataset.action === 'move-channel' && ch) {
                        this.showMoveChannelModal(ch);
                    } else if (item.dataset.action === 'delete-channel') {
                        this.deleteChannel(channelId);
                    }
                    return;
                }
                this.handleContextAction(item.dataset.action);
            });
        });
        
        // Search
        const searchInput = document.getElementById('search-input');
        const searchPanel = document.getElementById('search-results-panel');
        let searchDebounceTimer = null;
        searchInput?.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => this.runSearch(searchInput.value), 180);
        });
        searchInput?.addEventListener('focus', () => {
            if (searchInput.value.trim()) this.runSearch(searchInput.value);
        });
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSearchPanel();
                searchInput.blur();
            }
        });
        document.addEventListener('click', (e) => {
            if (searchPanel?.classList.contains('is-open') && !e.target.closest('.search-box-wrapper')) {
                this.closeSearchPanel();
            }
        });
    }
    
    async login() {
        if (window.LIBERTY_SECURITY && !LIBERTY_SECURITY.checkRateLimit()) {
            const min = Math.ceil(LIBERTY_SECURITY.getRemainingLockMs() / 60000);
            this.toast(`Muitas tentativas. Aguarde ${min} minuto(s) e tente novamente.`, 'error');
            return;
        }
        const input = document.getElementById('login-name');
        const name = input?.value?.trim();
        if (!name) {
            this.toast('Digite seu nome', 'error');
            return;
        }
        const passwordInput = document.getElementById('login-password');
        const password = passwordInput?.value?.trim() || null;
        if (window.LibertyAPI) {
            await LibertyAPI.checkApi();
            if (LibertyAPI.isAvailable()) {
                try {
                    const body = { username: name };
                    if (password) body.password = password;
                    const res = await fetch((window.location.origin || '') + '/api/auth/login', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data.user) {
                        this.currentUser = this.ensureAuthMethods({
                            id: data.user.id,
                            username: data.user.username,
                            tag: '#' + String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
                            status: 'online',
                            lang: this.currentUser?.lang || 'en',
                            created_at: Date.now(),
                            last_login_at: Date.now()
                        });
                        await this.loadAvatarIntoUser(this.currentUser);
                        if (window.LIBERTY_SECURITY) LIBERTY_SECURITY.resetRateLimit();
                        await this.saveUser();
                        this.toast(this.t('toast_welcome'));
                        this.showApp();
                        return;
                    }
                    if (res.status === 400 || res.status === 401) {
                        this.toast(data.error || 'Login falhou', 'error');
                        return;
                    }
                } catch (e) {
                    console.warn('API login failed:', e);
                }
            }
        }
        const existing = window.LibertyDB ? await LibertyDB.getUserByUsername(name) : this.getStoredUsers()[name];
        if (existing) {
            this.currentUser = this.ensureAuthMethods(existing);
            await this.loadAvatarIntoUser(this.currentUser);
            const mfaMethod = this.getNextMfaMethod(this.currentUser);
            if (mfaMethod) {
                this._loginPendingUser = true;
                this.showVerificationModal(mfaMethod);
            } else {
                if (window.LIBERTY_SECURITY) LIBERTY_SECURITY.resetRateLimit();
                await this.saveUser();
                this.toast(this.t('toast_welcome'));
                this.showApp();
            }
        } else {
            this.toast(this.t('toast_account_not_found'), 'error');
            document.getElementById('switch-to-register').scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    async register() {
        const input = document.getElementById('register-name');
        const name = input?.value?.trim();
        if (!name) {
            this.toast('Digite um nome', 'error');
            return;
        }
        const passwordInput = document.getElementById('register-password');
        const password = passwordInput?.value?.trim() || null;
        if (window.LibertyAPI) {
            await LibertyAPI.checkApi();
            if (LibertyAPI.isAvailable()) {
                try {
                    const body = { username: name };
                    if (password) body.password = password;
                    const res = await fetch((window.location.origin || '') + '/api/auth/register', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data.user) {
                        const userLang = document.getElementById('register-lang')?.value || 'en';
                        this.currentUser = this.ensureAuthMethods({
                            id: data.user.id,
                            username: data.user.username,
                            tag: '#' + String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
                            status: 'online',
                            lang: userLang,
                            created_at: Date.now(),
                            last_login_at: Date.now()
                        });
                        await this.saveUser();
                        this.applyTranslations(userLang);
                        this.toast(this.t('toast_account_created'));
                        await this.showApp();
                        return;
                    }
                    if (res.status === 400) {
                        this.toast(data.error || 'Nome já em uso', 'error');
                        return;
                    }
                } catch (e) {
                    console.warn('API register failed:', e);
                }
            }
        }
        const exists = window.LibertyDB ? await LibertyDB.getUserByUsername(name) : this.getStoredUsers()[name];
        if (exists) {
            this.toast(this.t('toast_name_taken'), 'error');
            document.getElementById('switch-to-login').scrollIntoView({ behavior: 'smooth' });
            return;
        }
        const userLang = document.getElementById('register-lang')?.value || 'en';
        this.currentUser = this.ensureAuthMethods({
            id: this.uuid(),
            username: name,
            tag: '#' + String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
            email: '',
            password_hash: null,
            password_salt: null,
            pin_hash: null,
            hwid: '',
            avatar: null,
            banner: null,
            bio: '',
            profileColor: '#FFFF00',
            status: 'online',
            subscription: 'free',
            lang: userLang,
            serverAvatars: {},
            activityMinutes: 0,
            contentXP: 0,
            auth_methods: {},
            created_at: Date.now(),
            last_login_at: Date.now()
        });
        await this.saveUser();
        this.applyTranslations(userLang);
        this.toast(this.t('toast_account_created'));
        await this.showApp();
    }
    
    getStoredUsers() {
        if (this._storedUsersCache != null) return this._storedUsersCache;
        try {
            const raw = localStorage.getItem('liberty_users');
            if (raw && window.LibertyCrypto && LibertyCrypto.looksEncrypted(raw)) return {};
            return JSON.parse(raw || '{}');
        } catch { return {}; }
    }
    
    ensureAuthMethods(user) {
        const def = {
            yubikey: { enabled: false, configured: false },
            hardware_uuid: { enabled: false, value: null },
            mac_address: { enabled: false, value: null },
            ip: { enabled: false, value: null },
            phone_verification: { enabled: false, configured: false, phone: null },
            windows_hello: { enabled: false, configured: false },
            email_verification: { enabled: false, configured: false },
            password: { enabled: false, configured: false },
            pin: { enabled: false, configured: false }
        };
        const auth = user.auth_methods || {};
        for (const k of Object.keys(def)) {
            auth[k] = { ...def[k], ...(auth[k] || {}) };
        }
        if (user.password || user.password_hash) auth.password.configured = true;
        if (user.pin_hash) auth.pin.configured = true;
        if (user.email) auth.email_verification.configured = true;
        if (user.hwid) {
            auth.hardware_uuid.enabled = true;
            auth.hardware_uuid.value = user.hwid;
        }
        if (auth.ip?.value) auth.ip.configured = true;
        if (auth.mac_address?.value) auth.mac_address.configured = true;
        if (auth.hardware_uuid?.value || user.hwid) auth.hardware_uuid.configured = true;
        return { ...user, subscription: user.subscription || 'free', lang: user.lang || 'en', serverAvatars: user.serverAvatars || {}, activityMinutes: user.activityMinutes || 0, contentXP: user.contentXP || 0, auth_methods: auth };
    }
    
    getNextMfaMethod(user) {
        const priority = window.MFA_PRIORITY || ['yubikey','hardware_uuid','mac_address','ip','phone_verification','windows_hello','email_verification','password','pin'];
        for (const method of priority) {
            const m = user?.auth_methods?.[method];
            if (m?.enabled && m?.configured) return method;
        }
        return null;
    }
    
    async completeLogin() {
        if (window.LIBERTY_SECURITY) LIBERTY_SECURITY.resetRateLimit();
        this._loginPendingUser = false;
        await this.saveUser();
        this.closeModals();
        document.getElementById('login-page').classList.add('hidden');
        this.toast('Bem-vindo de volta!');
        this.showApp();
    }
    
    logout() {
        this.stopActivityTracking();
        localStorage.removeItem('liberty_user');
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('liberty_session_key');
        this.currentUser = null;
        this.closeModals();
        this.showLogin();
        this.toast(this.t('toast_logout'));
    }
    
    // UI
    updateUI() {
        if (!this.currentUser) return;
        
        document.getElementById('username').textContent = this.currentUser.username;
        document.getElementById('user-tag').textContent = this.currentUser.tag;
        document.getElementById('settings-username').textContent = this.currentUser.username;
        document.getElementById('settings-tag').textContent = this.currentUser.tag;
        document.getElementById('edit-username').value = this.currentUser.username;
        const subSelect = document.getElementById('subscription-tier');
        if (subSelect) subSelect.value = this.currentUser.subscription || 'free';
        const langSelect = document.getElementById('settings-lang');
        if (langSelect) langSelect.value = this.currentUser.lang || 'en';
        this.updateCharIndicator();
        const authEmail = document.getElementById('auth-email-value');
        if (authEmail) authEmail.value = this.currentUser.email || '';
        
        if (this.currentUser.bio) {
            document.getElementById('bio-input').value = this.currentUser.bio;
            document.getElementById('bio-count').textContent = this.currentUser.bio.length;
        }
        
        this.updateAvatar();
        
        if (this.currentUser.banner) {
            const banner = document.getElementById('profile-banner');
            banner.style.backgroundImage = `url(${this.currentUser.banner})`;
            banner.style.backgroundSize = 'cover';
            banner.style.background = '';
        } else {
            const banner = document.getElementById('profile-banner');
            banner.style.backgroundImage = '';
            banner.style.backgroundSize = '';
            this.applyProfileColorStyle(banner, this.currentUser?.profileColor);
        }
        this.applyProfileColorStyle(document.getElementById('profile-avatar-preview'), this.currentUser?.profileColor);
        
        this.renderMembers();
        this.updateMessageInputState();
        
        // Botão Admin apenas para Zerk
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            if (this.currentUser.username === 'Zerk') {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }
    }
    
    getAvatar(user, serverId) {
        if (!user) return null;
        if (serverId && user.serverAvatars?.[serverId]) return user.serverAvatars[serverId];
        return user.avatar || null;
    }

    getInitials(user) {
        if (!user) return '?';
        const name = (user.username || '').trim();
        if (!name) return '?';
        if (name.length >= 2) return name.slice(0, 2).toUpperCase();
        return name.slice(0, 1).toUpperCase();
    }

    avatarPlaceholder(user) {
        const init = this.getInitials(user);
        return `<span class="avatar-initials">${this.escape(init)}</span>`;
    }

    isProfileColorGradient(value) {
        return typeof value === 'string' && (value.startsWith('linear-gradient') || value.startsWith('radial-gradient'));
    }

    applyProfileColorStyle(el, value) {
        if (!el) return;
        const v = value || this.currentUser?.profileColor || '#FFFF00';
        if (this.isProfileColorGradient(v)) {
            el.style.background = '';
            el.style.backgroundImage = v;
            el.style.backgroundSize = 'cover';
        } else {
            el.style.backgroundImage = '';
            el.style.background = v;
        }
    }

    buildGradientString(color1, color2, angle) {
        return `linear-gradient(${Number(angle) || 90}deg, ${color1 || '#FF0080'}, ${color2 || '#7928CA'})`;
    }

    syncProfileColorUI() {
        const val = this.currentUser?.profileColor || '#FFFF00';
        const solidPanel = document.getElementById('profile-color-solid');
        const gradientPanel = document.getElementById('profile-color-gradient');
        const modeSolid = document.querySelector('.profile-color-mode-btn[data-mode="solid"]');
        const modeGradient = document.querySelector('.profile-color-mode-btn[data-mode="gradient"]');
        if (this.isProfileColorGradient(val)) {
            modeSolid?.classList.remove('active');
            modeGradient?.classList.add('active');
            solidPanel?.classList.add('hidden');
            gradientPanel?.classList.remove('hidden');
            const match = val.match(/linear-gradient\(\s*(\d+)deg\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
            if (match) {
                const angle = match[1];
                const c1 = match[2].trim();
                const c2 = match[3].trim();
                const inp1 = document.getElementById('profile-gradient-color1');
                const inp2 = document.getElementById('profile-gradient-color2');
                const angleInp = document.getElementById('profile-gradient-angle');
                const angleVal = document.getElementById('profile-gradient-angle-value');
                if (inp1) inp1.value = c1;
                if (inp2) inp2.value = c2;
                if (angleInp) angleInp.value = angle;
                if (angleVal) angleVal.textContent = angle + '°';
            }
            this.applyProfileColorStyle(document.getElementById('profile-color-preview'), val);
        } else {
            modeGradient?.classList.remove('active');
            modeSolid?.classList.add('active');
            gradientPanel?.classList.add('hidden');
            solidPanel?.classList.remove('hidden');
            solidPanel?.querySelectorAll('.color-opt').forEach(b => {
                b.classList.toggle('active', (b.dataset.color || '').toLowerCase() === (val || '').toLowerCase());
            });
        }
    }

    applyGradientProfileColor() {
        if (!this.currentUser) return;
        const c1 = document.getElementById('profile-gradient-color1')?.value || '#FF0080';
        const c2 = document.getElementById('profile-gradient-color2')?.value || '#7928CA';
        const angle = document.getElementById('profile-gradient-angle')?.value || '90';
        const gradient = this.buildGradientString(c1, c2, angle);
        this.currentUser.profileColor = gradient;
        this.saveUser();
        const banner = document.getElementById('profile-banner');
        if (!this.currentUser.banner) this.applyProfileColorStyle(banner, gradient);
        this.applyProfileColorStyle(document.getElementById('profile-avatar-preview'), gradient);
        this.applyProfileColorStyle(document.getElementById('profile-color-preview'), gradient);
    }
    
    updateAvatar(src) {
        const avatarSrc = src || this.getAvatar(this.currentUser, this.currentServer?.id);
        const safeSrc = avatarSrc ? this.sanitizeUrl(avatarSrc) : '';
        const html = safeSrc ? `<img src="${safeSrc}" alt="Avatar">` : this.avatarPlaceholder(this.currentUser);
        const userAvatar = document.getElementById('user-avatar');
        const settingsAvatar = document.getElementById('settings-avatar');
        if (userAvatar) userAvatar.innerHTML = html;
        if (settingsAvatar) {
            settingsAvatar.innerHTML = (safeSrc ? `<img src="${safeSrc}" alt="Avatar">` : this.avatarPlaceholder(this.currentUser)) + '<div class="avatar-upload" title="Clique para trocar a foto"><i class="fas fa-camera"></i></div>';
        }
        const preview = document.getElementById('profile-avatar-preview');
        if (preview) preview.innerHTML = safeSrc ? `<img src="${safeSrc}" alt="Avatar">` : this.avatarPlaceholder(this.currentUser);
    }
    
    uploadAvatar(e) {
        if (!this.currentUser) {
            this.toast('Faça login para alterar o avatar', 'error');
            e.target.value = '';
            return;
        }
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async ev => {
            let dataUrl = ev.target.result;
            try {
                const resized = await this.resizeImageForAvatar(dataUrl);
                if (resized) dataUrl = resized;
            } catch (err) {
                console.warn('Avatar resize failed, using original:', err);
            }
            this._pendingAvatarData = dataUrl;
            this.showAvatarModal(dataUrl);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    resizeImageForAvatar(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const max = 128;
                let w = img.width;
                let h = img.height;
                if (w <= max && h <= max) {
                    try {
                        const c = document.createElement('canvas');
                        c.width = w;
                        c.height = h;
                        const ctx = c.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve(c.toDataURL('image/jpeg', 0.8));
                    } catch (e) {
                        resolve(dataUrl);
                    }
                    return;
                }
                if (w > h) {
                    h = Math.round((h * max) / w);
                    w = max;
                } else {
                    w = Math.round((w * max) / h);
                    h = max;
                }
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } catch (e) {
                    resolve(dataUrl);
                }
            };
            img.onerror = () => reject(new Error('Invalid image'));
            img.src = dataUrl;
        });
    }

    compressAvatarDataUrl(dataUrl, maxSize = 64, quality = 0.5) {
        if (!dataUrl || !dataUrl.startsWith('data:')) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                try {
                    let w = img.width;
                    let h = img.height;
                    if (w > h) {
                        h = Math.round((h * maxSize) / w);
                        w = maxSize;
                    } else {
                        w = Math.round((w * maxSize) / h);
                        h = maxSize;
                    }
                    const c = document.createElement('canvas');
                    c.width = w;
                    c.height = h;
                    const ctx = c.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(c.toDataURL('image/jpeg', quality));
                } catch (e) {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = dataUrl;
        });
    }
    
    showAvatarModal(dataUrl) {
        const preview = document.getElementById('avatar-modal-preview');
        const applyAll = document.getElementById('avatar-apply-all');
        const serverSelect = document.getElementById('avatar-server-select');
        const serverList = document.getElementById('avatar-server-list');
        
        if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Preview">`;
        if (applyAll) applyAll.checked = true;
        if (serverSelect) serverSelect.classList.add('hidden');
        
        const myServers = this.servers.filter(s => s.members?.some(m => m.id === this.currentUser?.id));
        if (serverList) {
            serverList.innerHTML = myServers.map(s => `
                <label class="avatar-server-item">
                    <input type="checkbox" data-server-id="${s.id}">
                    <div class="server-icon-sm">${s.icon ? `<img src="${s.icon}" alt="">` : '<i class="fas fa-server"></i>'}</div>
                    <span>${this.escape(s.name)}</span>
                </label>
            `).join('');
        }
        
        this.openModal('modal-avatar');
    }
    
    saveAvatarFromModal() {
        const dataUrl = this._pendingAvatarData;
        if (!dataUrl || !this.currentUser) return;
        
        const applyAll = document.getElementById('avatar-apply-all')?.checked;
        
        if (!applyAll) {
            const selected = Array.from(document.querySelectorAll('#avatar-server-list input:checked')).map(cb => cb.dataset.serverId);
            if (!selected.length) {
                this.toast(this.t('avatar_select_one'), 'error');
                return;
            }
        }
        
        if (applyAll) {
            this.currentUser.avatar = dataUrl;
            this.currentUser.serverAvatars = this.currentUser.serverAvatars || {};
        } else {
            const selected = Array.from(document.querySelectorAll('#avatar-server-list input:checked')).map(cb => cb.dataset.serverId);
            this.currentUser.serverAvatars = this.currentUser.serverAvatars || {};
            selected.forEach(sid => { this.currentUser.serverAvatars[sid] = dataUrl; });
        }
        
        this.saveUser();
        this.syncServerMemberAvatars();
        this.updateAvatar();
        this.closeModals();
        this.toast(this.t('toast_avatar_saved'));
        this._pendingAvatarData = null;
    }
    
    syncServerMemberAvatars() {
        this.servers.forEach(server => {
            const member = server.members?.find(m => m.id === this.currentUser?.id);
            if (member) {
                member.avatar = this.currentUser.avatar;
                member.serverAvatars = this.currentUser.serverAvatars;
            }
        });
        this.saveServers();
    }
    
    uploadBanner(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = ev => {
            this.currentUser.banner = ev.target.result;
            this.saveUser();
            
            const banner = document.getElementById('profile-banner');
            banner.style.backgroundImage = `url(${ev.target.result})`;
            banner.style.backgroundSize = 'cover';
            
            this.toast('Banner atualizado!');
        };
        reader.readAsDataURL(file);
    }
    
    // Servers
    goHome() {
        document.querySelectorAll('.server-icon').forEach(s => s.classList.remove('active'));
        document.querySelector('.server-icon.home').classList.add('active');
        
        this.currentServer = null;
        this.currentChannel = null;
        this.currentDM = null;
        
        document.getElementById('server-title').textContent = this.t('dm_title');
        document.getElementById('dm-section').classList.remove('hidden');
        document.getElementById('channel-section').classList.add('hidden');
        document.getElementById('server-settings-btn')?.classList.add('hidden');
        document.getElementById('channel-name').textContent = 'geral';
        document.getElementById('friends-view').classList.add('hidden');
        document.getElementById('messages-area').classList.remove('hidden');
        
        this.renderRanking();
        this.renderMembers();
        this.renderDMList();
        this.updateMessageInputState();
        this.updateAvatar();
        document.querySelectorAll('.dm-shortcut-item').forEach(i => i.classList.remove('active'));
        document.getElementById('rankings-tab')?.classList.add('active');
        document.querySelectorAll('#dm-list .dm-item').forEach(i => i.classList.remove('active'));
    }
    
    async loadServers() {
        const globalKey = 'liberty_servers';
        const userKey = this.currentUser?.id ? `liberty_servers_${this.currentUser.id}` : null;
        try {
            let parsed = null;
            if (userKey) {
                parsed = await this._getEncrypted(userKey);
                if (!parsed && localStorage.getItem(globalKey)) {
                    const globalRaw = await this._getEncrypted(globalKey);
                    if (globalRaw) {
                        await this._setEncrypted(userKey, globalRaw);
                        parsed = globalRaw;
                    }
                }
            }
            if (!parsed) parsed = await this._getEncrypted(globalKey);
            if (parsed) {
                this.servers = Array.isArray(parsed) ? parsed : [];
            } else {
                this.servers = [];
            }
            this.servers.forEach(s => this.ensureServerInviteCode(s));
            this.saveServers();
        } catch {
            this.servers = [];
        }
    }

    generateInviteCode() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    }

    ensureServerInviteCode(server) {
        if (!server || server.id === this.LIBERTY_SERVER_ID) return;
        if (!server.inviteCode || typeof server.inviteCode !== 'string' || server.inviteCode.length < 6) {
            server.inviteCode = this.generateInviteCode();
        }
    }

    async saveServers() {
        const list = Array.isArray(this.servers) ? this.servers : [];
        const globalKey = 'liberty_servers';
        const userKey = this.currentUser?.id ? `liberty_servers_${this.currentUser.id}` : null;
        try {
            if (userKey) {
                await this._setEncrypted(userKey, list);
            }
            await this._setEncrypted(globalKey, list);
            for (const s of list) {
                if (s && s.inviteCode) {
                    try {
                        await this._setEncrypted('liberty_invite_' + s.inviteCode, s);
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('saveServers:', e);
        }
    }

    openCreateServerModal() {
        if (!this.currentUser) {
            this.toast('Faça login para criar um servidor', 'error');
            return;
        }
        this.serverIconData = null;
        const nameEl = document.getElementById('server-name');
        const regionEl = document.getElementById('server-region');
        const uploadEl = document.getElementById('server-icon-upload');
        if (nameEl) nameEl.value = '';
        if (regionEl) regionEl.value = 'br';
        if (uploadEl) uploadEl.innerHTML = '<i class="fas fa-camera"></i><span>Ícone</span>';
        this.openModal('modal-server');
    }

    closeCreateServerModal() {
        document.getElementById('modal-server')?.classList.remove('active');
        const nameEl = document.getElementById('server-name');
        const uploadEl = document.getElementById('server-icon-upload');
        if (nameEl) nameEl.value = '';
        this.serverIconData = null;
        if (uploadEl) uploadEl.innerHTML = '<i class="fas fa-camera"></i><span>Ícone</span>';
    }

    async ensureLibertyServer() {
        if (!Array.isArray(this.servers)) this.servers = [];
        let allUsers = [];
        try {
            if (window.LibertyDB) {
                allUsers = await LibertyDB.getAllUsers();
            } else {
                const stored = this.getStoredUsers();
                allUsers = Object.values(stored).filter(u => u && typeof u === 'object').map(u => this.ensureAuthMethods(u));
            }
        } catch (e) {
            console.warn('ensureLibertyServer: erro ao carregar usuários', e);
        }
        if (!Array.isArray(allUsers)) allUsers = [];
        let lib = this.servers.find(s => s && s.id === this.LIBERTY_SERVER_ID);
        if (!lib) {
            lib = {
                id: this.LIBERTY_SERVER_ID,
                name: 'Liberty',
                icon: 'assets/logo.png',
                region: 'br',
                channels: [
                    { id: this.uuid(), name: 'geral', type: 'text', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } },
                    { id: this.uuid(), name: 'voz', type: 'voice', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } }
                ],
                categories: [],
                roles: JSON.parse(JSON.stringify(this.roles)),
                members: [],
                invites: []
            };
            this.servers.unshift(lib);
        } else {
            lib.name = 'Liberty';
            lib.icon = lib.icon || 'assets/logo.png';
        }
        if (!Array.isArray(lib.members)) lib.members = [];
        if (!Array.isArray(lib.channels)) lib.channels = [{ id: this.uuid(), name: 'geral', type: 'text', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } }, { id: this.uuid(), name: 'voz', type: 'voice', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } }];
        this.ensureServerCategories(lib);
        const memberIds = new Set(lib.members.map(m => m.id));
        for (const u of allUsers) {
            if (!u?.id) continue;
            if (!memberIds.has(u.id)) {
                lib.members.push({
                    ...u,
                    serverAvatars: u.serverAvatars || {},
                    roles: lib.members.length === 0 ? ['Admin'] : ['@todos'],
                    status: u.id === this.currentUser?.id ? 'online' : (u.status || 'offline')
                });
                memberIds.add(u.id);
            } else {
                const m = lib.members.find(mem => mem.id === u.id);
                if (m) {
                    m.username = u.username;
                    m.tag = u.tag;
                    m.avatar = u.avatar;
                    m.serverAvatars = u.serverAvatars;
                    m.profileColor = u.profileColor;
                    m.activityMinutes = u.activityMinutes;
                    m.contentXP = u.contentXP;
                    if (u.id === this.currentUser?.id) m.status = 'online';
                }
            }
        }
        lib.members = lib.members.filter(m => allUsers.some(u => u.id === m.id));
        this.saveServers();
        this.renderServers();
        if (this.currentServer?.id === this.LIBERTY_SERVER_ID) {
            this.renderMembers(this.currentServer.members);
        }
    }

    createServer() {
        if (!this.currentUser) {
            this.toast('Faça login para criar um servidor', 'error');
            return;
        }
        const nameEl = document.getElementById('server-name');
        const name = (nameEl && nameEl.value) ? nameEl.value.trim() : '';
        if (!name) {
            this.toast('Digite um nome para o servidor', 'error');
            return;
        }
        const regionEl = document.getElementById('server-region');
        const region = (regionEl && regionEl.value) ? regionEl.value : 'br';
        const icon = this.serverIconData || null;

        const server = {
            id: this.uuid(),
            name,
            icon,
            region,
            channels: [
                { id: this.uuid(), name: 'geral', type: 'text', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } },
                { id: this.uuid(), name: 'voz', type: 'voice', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } }
            ],
            categories: [],
            roles: JSON.parse(JSON.stringify(this.roles)),
            members: [{ ...this.currentUser, serverAvatars: this.currentUser.serverAvatars || {}, roles: ['Admin'], status: 'online' }],
            inviteCode: this.generateInviteCode(),
            invites: [],
            emojis: [],
            createdAt: Date.now()
        };

        if (!Array.isArray(this.servers)) this.servers = [];
        const libertyIndex = this.servers.findIndex(s => s && s.id === this.LIBERTY_SERVER_ID);
        if (libertyIndex >= 0) {
            this.servers.splice(libertyIndex + 1, 0, server);
        } else {
            this.servers.push(server);
        }
        this.saveServers();
        this.renderServers();
        this.selectServer(server.id);
        this.closeCreateServerModal();
        this.toast(`Servidor "${name}" criado!`);
    }
    
    renderServers() {
        const list = document.getElementById('server-list');
        if (!list) return;
        const servers = Array.isArray(this.servers) ? this.servers : [];
        list.innerHTML = '';
        servers.forEach(s => {
            if (!s || !s.id) return;
            const el = document.createElement('div');
            el.className = 'server-icon';
            el.dataset.id = s.id;
            el.title = s.name || '';
            if (s.icon && this.sanitizeUrl(s.icon)) {
                el.innerHTML = `<img src="${this.sanitizeUrl(s.icon)}" alt="${this.escape(s.name || '')}">`;
            } else {
                el.textContent = (s.name && s.name[0]) ? s.name[0].toUpperCase() : '?';
            }
            el.addEventListener('click', () => this.selectServer(s.id));
            el.addEventListener('contextmenu', e => this.showServerContext(e, s));
            list.appendChild(el);
        });
    }
    
    showServerContext(e, server) {
        e.preventDefault();
        if (server?.id === this.LIBERTY_SERVER_ID) {
            this.toast('O servidor Liberty não possui dono e não pode ser configurado.');
            return;
        }
        // Futuro: abrir menu de contexto (configurações, sair do servidor, etc.)
    }
    
    selectServer(id) {
        if (!this.servers || !Array.isArray(this.servers)) return;
        const server = this.servers.find(s => s && s.id === id);
        if (!server) return;
        
        this.currentServer = server;
        this.currentChannel = null;
        
        document.querySelectorAll('.server-icon').forEach(s => s.classList.remove('active'));
        document.querySelector(`[data-id="${id}"]`)?.classList.add('active');
        
        document.getElementById('server-title').textContent = server.name;
        document.getElementById('dm-section').classList.add('hidden');
        document.getElementById('channel-section').classList.remove('hidden');
        if (server.id === this.LIBERTY_SERVER_ID) {
            document.getElementById('server-settings-btn')?.classList.add('hidden');
        } else {
            document.getElementById('server-settings-btn')?.classList.remove('hidden');
        }
        document.getElementById('friends-view').classList.add('hidden');
        document.getElementById('messages-area').classList.remove('hidden');
        
        this.renderChannels();
        this.renderMembers(server.members);
        this.renderRoles(server.roles);
        this.renderInvites(server.invites);
        
        if (server.id === this.LIBERTY_SERVER_ID) {
            if (!Array.isArray(server.channels) || server.channels.length === 0) {
                server.channels = [
                    { id: this.uuid(), name: 'geral', type: 'text', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } },
                    { id: this.uuid(), name: 'voz', type: 'voice', categoryId: null, permissions: { view: ['@todos'], send: ['@todos'] } }
                ];
                this.ensureServerCategories(server);
                this.saveServers();
                this.renderChannels();
            }
        }
        let ch = server.channels && server.channels.find(c => c.type === 'text');
        if (!ch && server.channels && server.channels.length) ch = server.channels[0];
        if (ch) this.selectChannel(ch.id);
        else this.updateMessageInputState();
    }
    
    // Channels
    renderChannels() {
        const section = document.getElementById('channel-section');
        if (!section) return;
        section.innerHTML = '';
        if (!this.currentServer) return;
        
        this.ensureServerCategories(this.currentServer);
        const channels = this.currentServer.channels || [];
        const categories = this.currentServer.categories || [];
        const me = this.currentServer.members?.find(m => m.id === this.currentUser?.id);
        
        const visibleChannels = channels.filter(c => this.canSeeChannel(me, c));
        const byCategory = new Map();
        visibleChannels.forEach(c => {
            const catId = c.categoryId || null;
            if (!byCategory.has(catId)) byCategory.set(catId, []);
            byCategory.get(catId).push(c);
        });
        
        const sortedCatIds = categories.map(c => c.id);
        const uncategorized = byCategory.get(null) || [];
        const canManage = this.canManageChannels();
        
        if (canManage) {
            const uncatDrop = document.createElement('div');
            uncatDrop.className = 'channel-drop-zone';
            uncatDrop.dataset.categoryId = '';
            uncatDrop.innerHTML = '<i class="fas fa-inbox"></i> Sem categoria';
            section.appendChild(uncatDrop);
        }
        
        uncategorized.forEach(c => {
            const item = document.createElement('div');
            item.className = 'channel-item';
            item.dataset.id = c.id;
            item.innerHTML = `<i class="fas fa-${c.type === 'voice' ? 'volume-up' : 'hashtag'}"></i><span>${this.escape(c.name)}</span>`;
            item.addEventListener('click', () => this.selectChannel(c.id));
            if (canManage) {
                item.addEventListener('contextmenu', e => this.showChannelItemContextMenu(e, c));
                item.draggable = true;
                item.dataset.channelId = c.id;
                item.addEventListener('dragstart', e => this.onChannelDragStart(e, c));
                item.addEventListener('dragend', e => this.onChannelDragEnd(e));
            }
            section.appendChild(item);
        });
        
        sortedCatIds.forEach(catId => {
            const cat = categories.find(c => c.id === catId);
            if (!cat) return;
            const chans = byCategory.get(catId) || [];
            const catEl = document.createElement('div');
            catEl.className = 'category category-drop';
            catEl.dataset.categoryId = cat.id;
            catEl.innerHTML = `<div class="category-header"><i class="fas fa-chevron-down"></i> ${this.escape(cat.name)}</div>`;
            if (canManage) {
                catEl.querySelector('.category-header').addEventListener('contextmenu', e => this.showCategoryContextMenu(e, cat));
                catEl.addEventListener('dragover', e => this.onChannelDragOver(e, catEl));
                catEl.addEventListener('dragleave', e => this.onChannelDragLeave(e, catEl));
                catEl.addEventListener('drop', e => this.onChannelDrop(e, catEl));
            }
            chans.forEach(c => {
                const item = document.createElement('div');
                item.className = 'channel-item';
                item.dataset.id = c.id;
                item.innerHTML = `<i class="fas fa-${c.type === 'voice' ? 'volume-up' : 'hashtag'}"></i><span>${this.escape(c.name)}</span>`;
                item.addEventListener('click', () => this.selectChannel(c.id));
                if (canManage) {
                    item.addEventListener('contextmenu', e => this.showChannelItemContextMenu(e, c));
                    item.draggable = true;
                    item.dataset.channelId = c.id;
                    item.addEventListener('dragstart', e => this.onChannelDragStart(e, c));
                    item.addEventListener('dragend', e => this.onChannelDragEnd(e));
                }
                catEl.appendChild(item);
            });
            section.appendChild(catEl);
        });
        
        if (canManage) {
            const add = document.createElement('div');
            add.className = 'channel-item channel-item-add';
            add.innerHTML = '<i class="fas fa-plus"></i><span>Adicionar</span>';
            add.addEventListener('click', () => this.openAddModal('channel'));
            add.addEventListener('contextmenu', e => this.showChannelListContextMenu(e));
            section.appendChild(add);
            section.addEventListener('contextmenu', e => {
                if (e.target.closest('.channel-item') || e.target.closest('.category-header')) return;
                e.preventDefault();
                this.showChannelListContextMenu(e);
            });
            const uncatDrop = section.querySelector('.channel-drop-zone');
            if (uncatDrop) {
                uncatDrop.addEventListener('dragover', e => this.onChannelDragOver(e, uncatDrop));
                uncatDrop.addEventListener('dragleave', e => this.onChannelDragLeave(e, uncatDrop));
                uncatDrop.addEventListener('drop', e => this.onChannelDrop(e, uncatDrop));
            }
        }
    }
    
    onChannelDragStart(e, channel) {
        e.dataTransfer.setData('text/plain', channel.id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('channel-id', channel.id);
        e.target.classList.add('dragging');
    }
    
    onChannelDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.channel-drop-zone, .category-drop').forEach(el => el.classList.remove('drag-over'));
    }
    
    onChannelDragOver(e, dropEl) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dropEl.classList.add('drag-over');
    }
    
    onChannelDragLeave(e, dropEl) {
        if (!dropEl.contains(e.relatedTarget)) dropEl.classList.remove('drag-over');
    }
    
    onChannelDrop(e, dropEl) {
        e.preventDefault();
        dropEl.classList.remove('drag-over');
        const channelId = e.dataTransfer.getData('channel-id');
        if (!channelId) return;
        const categoryId = (dropEl.dataset.categoryId === '') ? null : (dropEl.dataset.categoryId || null);
        this.moveChannelToCategory(channelId, categoryId);
    }
    
    moveChannelToCategory(channelId, categoryId) {
        if (!this.currentServer?.channels || !this.canManageChannels()) return;
        const ch = this.currentServer.channels.find(c => c.id === channelId);
        if (!ch) return;
        if ((ch.categoryId || null) === categoryId) return;
        ch.categoryId = categoryId || null;
        this.saveServers();
        this.renderChannels();
        this.toast('Canal movido');
    }
    
    showChannelListContextMenu(e) {
        e.preventDefault();
        if (!this.canManageChannels()) return;
        const menu = document.getElementById('channel-context-menu');
        if (!menu) return;
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.add('active');
        menu.dataset.categoryId = '';
    }
    
    showCategoryContextMenu(e, category) {
        e.preventDefault();
        e.stopPropagation();
        if (!this.canManageChannels()) return;
        const menu = document.getElementById('category-context-menu');
        if (!menu) return;
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.add('active');
        menu.dataset.categoryId = category.id;
    }
    
    showChannelItemContextMenu(e, channel) {
        e.preventDefault();
        e.stopPropagation();
        if (!this.canManageChannels()) return;
        const menu = document.getElementById('channel-item-context-menu');
        if (!menu) return;
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.add('active');
        menu.dataset.channelId = channel.id;
    }
    
    selectChannel(id) {
        const ch = this.currentServer?.channels.find(c => c.id === id);
        if (!ch) return;
        
        this.currentChannel = ch;
        this.currentDM = null;
        
        document.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.channel-item[data-id="${id}"]`)?.classList.add('active');
        
        document.getElementById('channel-icon').className = `fas fa-${ch.type === 'voice' ? 'volume-up' : 'hashtag'}`;
        document.getElementById('channel-name').textContent = ch.name;
        this.updateMessageInputState();
        this.updateCharIndicator();
        this.updateAvatar();
        
        document.getElementById('friends-view').classList.add('hidden');
        document.getElementById('messages-area').classList.remove('hidden');
        
        if (ch.type === 'voice') {
            this.joinVoice(ch.name);
        } else {
            this.realtimeUnsubscribeCurrent();
            this._realtimeRoom = 'channel:' + this.currentServer.id + ':' + ch.id;
            if (window.LibertyAPI && LibertyAPI.isAvailable()) LibertyAPI.realtimeSubscribe(this._realtimeRoom);
            this.loadMessages();
        }
    }
    
    createChannel() {
        if (!this.currentServer) return;
        if (!this.canManageChannels()) {
            this.toast('Apenas donos do servidor ou administradores podem criar canais.', 'error');
            return;
        }

        const typeInput = document.querySelector('#channel-form .channel-type.active input');
        const nameInput = document.getElementById('channel-name-input');
        const categorySelect = document.getElementById('channel-category-select');
        const type = typeInput?.value || 'text';
        const rawName = (nameInput?.value || '').trim();
        const name = this.getChannelSlug(rawName);
        const categoryId = (categorySelect && categorySelect.value) || null;

        if (!name) {
            this.toast('Digite um nome para o canal', 'error');
            return;
        }
        if (name.length > 100) {
            this.toast('Nome do canal muito longo', 'error');
            return;
        }
        const exists = this.currentServer.channels?.some(c => 
            (c.categoryId || null) === categoryId && (c.name || '').toLowerCase() === name
        );
        if (exists) {
            this.toast('Já existe um canal com esse nome nesta categoria', 'error');
            return;
        }

        this.currentServer.channels = this.currentServer.channels || [];
        this.ensureServerCategories(this.currentServer);
        const newChannel = {
            id: this.uuid(),
            name,
            type,
            categoryId,
            permissions: { view: ['@todos'], send: ['@todos'] }
        };
        this.currentServer.channels.push(newChannel);
        this.saveServers();
        const serverId = this.currentServer.id;
        this.currentServer = this.servers.find(s => s && s.id === serverId) || this.currentServer;
        this.renderChannels();
        if (document.getElementById('panel-channels')?.classList.contains('active')) {
            this.renderChannelsSettingsPanel();
        }
        document.getElementById('modal-channel')?.classList.remove('active');
        this.toast(`Canal #${name} criado!`);
        if (nameInput) nameInput.value = '';
        this.updateChannelSlugPreview();
        this.selectChannel(newChannel.id);
    }
    
    createCategory() {
        if (!this.currentServer) return;
        if (!this.canManageChannels()) {
            this.toast('Apenas donos do servidor ou administradores podem criar categorias.', 'error');
            return;
        }
        const nameInput = document.getElementById('category-name-input');
        const name = (nameInput?.value || '').trim();
        if (!name) {
            this.toast('Digite um nome para a categoria', 'error');
            return;
        }
        if (name.length > 100) {
            this.toast('Nome da categoria muito longo', 'error');
            return;
        }
        this.ensureServerCategories(this.currentServer);
        const categories = this.currentServer.categories || [];
        const exists = categories.some(c => (c.name || '').trim().toLowerCase() === name.toLowerCase());
        if (exists) {
            this.toast('Já existe uma categoria com esse nome', 'error');
            return;
        }
        this.currentServer.categories = [...categories, { id: this.uuid(), name }];
        this.saveServers();
        this.renderChannels();
        document.getElementById('modal-channel')?.classList.remove('active');
        this.switchAddModalTab('channel');
        if (nameInput) nameInput.value = '';
        this.toast(`Categoria "${name}" criada!`);
    }
    
    deleteCategory(categoryId) {
        if (!this.currentServer?.channels || !categoryId) return;
        if (!this.canManageChannels()) {
            this.toast('Apenas donos do servidor ou administradores podem excluir categorias.', 'error');
            return;
        }
        this.currentServer.channels.forEach(c => { if (c.categoryId === categoryId) c.categoryId = null; });
        this.currentServer.categories = (this.currentServer.categories || []).filter(c => c.id !== categoryId);
        this.saveServers();
        this.renderChannels();
        if (document.getElementById('panel-channels')?.classList.contains('active')) this.renderChannelsSettingsPanel();
        this.toast('Categoria excluída');
    }
    
    openModalChannelWithCategory(categoryId) {
        this.openAddModal('channel');
        const sel = document.getElementById('channel-category-select');
        if (sel && categoryId) sel.value = categoryId;
    }
    
    fillChannelCategorySelect() {
        const sel = document.getElementById('channel-category-select');
        const selEdit = document.getElementById('channel-edit-category');
        if (!this.currentServer) return;
        this.ensureServerCategories(this.currentServer);
        const categories = this.currentServer.categories || [];
        const opts = '<option value="">Sem categoria</option>' + categories.map(c => `<option value="${this.escape(c.id)}">${this.escape(c.name)}</option>`).join('');
        if (sel) sel.innerHTML = opts;
        if (selEdit) selEdit.innerHTML = opts;
    }

    renderChannelsSettingsPanel() {
        const list = document.getElementById('channels-settings-list');
        const addBtn = document.getElementById('settings-add-channel-btn');
        if (!list || !this.currentServer?.channels) return;
        const canManage = this.canManageChannels();
        if (addBtn) addBtn.classList.toggle('hidden', !canManage);
        list.innerHTML = this.currentServer.channels.map(ch => `
            <div class="channel-settings-item" data-id="${this.escape(ch.id)}">
                <i class="fas fa-${ch.type === 'voice' ? 'volume-up' : 'hashtag'}"></i>
                <span class="channel-settings-name">${this.escape(ch.name)}</span>
                ${canManage ? `<button type="button" class="btn-small btn-ghost btn-delete-channel" data-id="${this.escape(ch.id)}" title="Excluir canal"><i class="fas fa-trash"></i></button>` : ''}
            </div>
        `).join('');
        if (canManage) {
            list.querySelectorAll('.btn-delete-channel').forEach(btn => {
                btn.addEventListener('click', () => this.deleteChannel(btn.dataset.id));
            });
        }
    }

    deleteChannel(channelId) {
        if (!this.currentServer?.channels) return;
        if (!this.canManageChannels()) {
            this.toast('Apenas donos do servidor ou administradores podem excluir canais.', 'error');
            return;
        }
        this.currentServer.channels = this.currentServer.channels.filter(c => c.id !== channelId);
        this.saveServers();
        this.renderChannels();
        if (document.getElementById('panel-channels')?.classList.contains('active')) {
            this.renderChannelsSettingsPanel();
        }
        this.toast('Canal excluído');
    }
    
    // Voice
    joinVoice(name) {
        this.inVoice = true;
        document.getElementById('voice-bar').classList.remove('hidden');
        document.getElementById('voice-channel').textContent = name;
    }
    
    startCall(video = false) {
        this.inVoice = true;
        this._callVideoOn = video;
        document.getElementById('voice-bar').classList.remove('hidden');
        document.getElementById('voice-channel').textContent = video ? this.t('voice_video') || 'Voz e Vídeo' : 'Chamada';
        document.getElementById('call-view').classList.remove('hidden');
        this.initCallWidgetPosition();
        this._callStartTime = Date.now();
        this.updateCallDuration();
        this._callDurationTimer = setInterval(() => this.updateCallDuration(), 1000);
        this.updateCallViewParticipant();
        this.requestCallMedia(video);
        this.toast(video ? 'Chamada de vídeo iniciada' : 'Chamada iniciada');
    }
    
    updateCallDuration() {
        const el = document.getElementById('call-view-duration');
        if (!el || !this._callStartTime) return;
        const s = Math.floor((Date.now() - this._callStartTime) / 1000);
        const m = Math.floor(s / 60);
        el.textContent = `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }
    
    updateCallViewParticipant() {
        const avatarEl = document.getElementById('call-you-avatar');
        const nameEl = document.getElementById('call-you-name');
        const statusEl = document.getElementById('call-you-status');
        if (!this.currentUser) return;
        const name = this.currentUser.username || 'Você';
        if (nameEl) nameEl.textContent = name;
        if (avatarEl) avatarEl.innerHTML = this.getAvatar(this.currentUser, this.currentServer?.id) && this.sanitizeUrl(this.getAvatar(this.currentUser, this.currentServer?.id))
            ? `<img src="${this.sanitizeUrl(this.getAvatar(this.currentUser, this.currentServer?.id))}" alt="">` : this.avatarPlaceholder(this.currentUser);
        if (statusEl) {
            if (!this.micOn) statusEl.textContent = 'Mudo';
            else if (this._callVideoOn) statusEl.textContent = 'Vídeo';
            else statusEl.textContent = 'Áudio';
        }
        const callControlMic = document.getElementById('call-control-mic');
        if (callControlMic) {
            callControlMic.classList.toggle('muted', !this.micOn);
            callControlMic.innerHTML = `<i class="fas fa-microphone${this.micOn ? '' : '-slash'}"></i>`;
        }
    }
    
    async requestCallMedia(video) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { width: 640, height: 480 } : false });
            this._localStream = stream;
            const audio = stream.getAudioTracks();
            if (audio.length) audio[0].enabled = this.micOn;
            const videoEl = document.getElementById('call-you-video');
            if (videoEl && stream.getVideoTracks().length) {
                videoEl.srcObject = stream;
                videoEl.classList.add('active');
                document.getElementById('call-you-card').classList.add('with-media');
            }
            const videoBtn = document.getElementById('video-voice-btn');
            if (videoBtn) videoBtn.innerHTML = this._callVideoOn ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
            const callControlVideo = document.getElementById('call-control-video');
            if (callControlVideo) callControlVideo.innerHTML = this._callVideoOn ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
            if (this._realtimeRoom && window.LibertyWebSocket && LibertyWebSocket.isConnected()) {
                this._callRoom = this._realtimeRoom;
                this.startWebRTCOffer();
            }
        } catch (e) {
            console.warn('getUserMedia failed:', e);
            this.toast('Não foi possível acessar câmera/microfone', 'error');
        }
    }

    async startWebRTCOffer() {
        if (!this._localStream || !this._callRoom || !window.LibertyWebSocket) return;
        try {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            this._callPeerConnection = pc;
            this._localStream.getTracks().forEach(t => pc.addTrack(t, this._localStream));
            pc.onicecandidate = (e) => {
                if (e.candidate) LibertyWebSocket.sendWebRTCSignal(this._callRoom, 'ice', e.candidate);
            };
            pc.ontrack = (e) => {
                const remoteVideo = document.getElementById('call-you-video');
                if (remoteVideo && e.streams[0]) remoteVideo.srcObject = e.streams[0];
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            LibertyWebSocket.sendWebRTCSignal(this._callRoom, 'offer', offer);
        } catch (e) {
            console.warn('WebRTC offer failed:', e);
        }
    }

    handleWebRTCSignal(data) {
        if (!data || !data.room) return;
        const room = data.room;
        const event = data.event;
        const payload = data.data;
        if (event === 'offer') {
            this._callRoom = room;
            this.answerWebRTCCall(payload);
        } else if (event === 'answer' && this._callPeerConnection) {
            this._callPeerConnection.setRemoteDescription(new RTCSessionDescription(payload)).catch(() => {});
        } else if (event === 'ice' && this._callPeerConnection && payload) {
            this._callPeerConnection.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
        }
    }

    async answerWebRTCCall(offer) {
        if (!window.LibertyWebSocket || !this._callRoom) return;
        try {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            this._callPeerConnection = pc;
            if (this._localStream) this._localStream.getTracks().forEach(t => pc.addTrack(t, this._localStream));
            pc.onicecandidate = (e) => {
                if (e.candidate) LibertyWebSocket.sendWebRTCSignal(this._callRoom, 'ice', e.candidate);
            };
            pc.ontrack = (e) => {
                const remoteVideo = document.getElementById('call-you-video');
                if (remoteVideo && e.streams[0]) remoteVideo.srcObject = e.streams[0];
            };
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            LibertyWebSocket.sendWebRTCSignal(this._callRoom, 'answer', answer);
            if (!this.inVoice) {
                this.inVoice = true;
                document.getElementById('voice-bar').classList.remove('hidden');
                document.getElementById('call-view').classList.remove('hidden');
                this._callStartTime = Date.now();
                this.updateCallDuration();
                this._callDurationTimer = setInterval(() => this.updateCallDuration(), 1000);
                if (!this._localStream) await this.requestCallMedia(false);
            }
        } catch (e) {
            console.warn('WebRTC answer failed:', e);
        }
    }
    
    toggleCallVideo() {
        if (!this.inVoice) return;
        if (!this._localStream) {
            this._callVideoOn = true;
            this.requestCallMedia(true);
            return;
        }
        const tracks = this._localStream.getVideoTracks();
        if (tracks.length) {
            this._callVideoOn = !tracks[0].enabled;
            tracks[0].enabled = this._callVideoOn;
        } else {
            this._callVideoOn = true;
            this._localStream.getTracks().forEach(t => t.stop());
            this._localStream = null;
            this.requestCallMedia(true);
            return;
        }
        const videoEl = document.getElementById('call-you-video');
        const card = document.getElementById('call-you-card');
        const videoBtn = document.getElementById('video-voice-btn');
        if (videoEl) videoEl.classList.toggle('active', this._callVideoOn);
        if (card) card.classList.toggle('with-media', this._callVideoOn);
        if (videoBtn) videoBtn.innerHTML = this._callVideoOn ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
        const callControlVideo = document.getElementById('call-control-video');
        if (callControlVideo) callControlVideo.innerHTML = this._callVideoOn ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
        this.updateCallViewParticipant();
        this.toast(this._callVideoOn ? 'Vídeo ligado' : 'Vídeo desligado');
    }
    
    async toggleScreenShare() {
        const screenEl = document.getElementById('call-you-screen');
        const card = document.getElementById('call-you-card');
        if (this._screenStream) {
            this._screenStream.getTracks().forEach(t => t.stop());
            this._screenStream = null;
            if (screenEl) screenEl.classList.remove('active');
            if (screenEl && screenEl.srcObject) screenEl.srcObject = null;
            if (card) card.classList.remove('with-screen');
            this.toast('Compartilhamento de tela desligado');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            this._screenStream = stream;
            if (screenEl) {
                screenEl.srcObject = stream;
                screenEl.classList.add('active');
            }
            if (card) card.classList.add('with-screen');
            stream.getVideoTracks()[0].onended = () => this.toggleScreenShare();
            this.toast('Compartilhando tela');
        } catch (e) {
            console.warn('getDisplayMedia failed:', e);
            this.toast('Não foi possível compartilhar tela', 'error');
        }
    }
    
    endCall() {
        this.inVoice = false;
        if (this._callDurationTimer) {
            clearInterval(this._callDurationTimer);
            this._callDurationTimer = null;
        }
        this._callStartTime = null;
        if (this._callPeerConnection) {
            this._callPeerConnection.close();
            this._callPeerConnection = null;
        }
        this._callRoom = null;
        if (this._localStream) {
            this._localStream.getTracks().forEach(t => t.stop());
            this._localStream = null;
        }
        if (this._screenStream) {
            this._screenStream.getTracks().forEach(t => t.stop());
            this._screenStream = null;
        }
        this._callVideoOn = false;
        document.getElementById('voice-bar').classList.add('hidden');
        document.getElementById('call-view').classList.add('hidden');
        const videoEl = document.getElementById('call-you-video');
        const screenEl = document.getElementById('call-you-screen');
        if (videoEl) { videoEl.srcObject = null; videoEl.classList.remove('active'); }
        if (screenEl) { screenEl.srcObject = null; screenEl.classList.remove('active'); }
        document.getElementById('call-you-card')?.classList.remove('with-media', 'with-screen');
        this.toast('Chamada encerrada');
    }
    
    async initCallWidgetPosition() {
        const el = document.getElementById('call-view');
        const card = document.getElementById('call-view-card');
        if (!el || !card) return;
        let x = null, y = null;
        try {
            const saved = await this._getEncrypted('liberty_call_widget_position');
            if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                x = saved.x;
                y = saved.y;
            }
        } catch (_) {}
        if (x == null || y == null) {
            const pad = 8;
            const w = card.offsetWidth || 200;
            const h = card.offsetHeight || 60;
            x = window.innerWidth - w - pad;
            y = pad;
        }
        const pad = 8;
        x = Math.max(pad, Math.min(window.innerWidth - card.offsetWidth - pad, x));
        y = Math.max(pad, Math.min(window.innerHeight - card.offsetHeight - pad, y));
        el.style.right = 'auto';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }
    
    callWidgetStartDrag(e) {
        e.preventDefault();
        const el = document.getElementById('call-view');
        const card = document.getElementById('call-view-card');
        if (!el || !card) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseInt(el.style.left, 10) || 0;
        const startTop = parseInt(el.style.top, 10) || 0;
        const onMove = (e) => {
            let x = startLeft + (e.clientX - startX);
            let y = startTop + (e.clientY - startY);
            const pad = 8;
            x = Math.max(pad, Math.min(window.innerWidth - card.offsetWidth - pad, x));
            y = Math.max(pad, Math.min(window.innerHeight - card.offsetHeight - pad, y));
            el.style.left = x + 'px';
            el.style.top = y + 'px';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const x = parseInt(el.style.left, 10) || 0;
            const y = parseInt(el.style.top, 10) || 0;
            this._setEncrypted('liberty_call_widget_position', { x, y }).catch(() => {});
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    
    toggleMic() {
        this.micOn = !this.micOn;
        if (this._localStream) {
            const audio = this._localStream.getAudioTracks();
            if (audio.length) audio[0].enabled = this.micOn;
        }
        const btn = document.getElementById('mic-btn');
        btn.innerHTML = `<i class="fas fa-microphone${this.micOn ? '' : '-slash'}"></i>`;
        btn.classList.toggle('muted', !this.micOn);
        this.updateCallViewParticipant();
        this.toast(this.micOn ? 'Microfone ligado' : 'Microfone mudo');
    }
    
    toggleDeafen() {
        this.deafened = !this.deafened;
        const btn = document.getElementById('headphone-btn');
        btn.innerHTML = `<i class="fas fa-headphones${this.deafened ? '' : '-alt'}"></i>`;
        btn.classList.toggle('deafened', this.deafened);
        this.toast(this.deafened ? 'Som desligado' : 'Som ligado');
    }
    
    // Friends
    async showFriends() {
        document.querySelectorAll('.dm-shortcut-item').forEach(i => i.classList.remove('active'));
        document.getElementById('friends-tab').classList.add('active');
        document.querySelectorAll('#dm-list .dm-item').forEach(i => i.classList.remove('active'));
        
        document.getElementById('friends-view').classList.remove('hidden');
        this.showWelcomeInMessagesArea('friend');
        
        if (window.LibertyAPI && LibertyAPI.isAvailable() && this.currentUser) {
            try {
                const serverFriends = await LibertyAPI.getFriends(this.currentUser.id);
                if (Array.isArray(serverFriends)) {
                    serverFriends.forEach(sf => {
                        if (sf.id && sf.username && !this.friends.some(f => f.id === sf.id)) {
                            this.friends.push({ id: sf.id, username: sf.username, status: sf.status || 'online', avatar: sf.avatar || null });
                        }
                    });
                    this.saveFriends();
                    this.renderDMList();
                }
            } catch (_) {}
        }
        this.renderFriends();
        this.updateMessageInputState();
    }
    
    showWelcomeInMessagesArea(context) {
        const area = document.getElementById('messages-area');
        if (!area) return;
        area.classList.remove('hidden');
        const msg = context === 'friend'
            ? (this.t('welcome_select_friend') || 'Selecione um amigo à esquerda para abrir a conversa.')
            : (this.t('welcome_select') || 'Selecione um canal ou amigo para começar');
        const welcomeId = document.getElementById('welcome');
        if (welcomeId) {
            welcomeId.querySelector('h2').textContent = context === 'friend' ? (this.t('friends') || 'Amigos') : (this.t('welcome') || 'Bem-vindo');
            welcomeId.querySelector('p').textContent = msg;
        } else {
            area.innerHTML = `
                <div class="welcome" id="welcome">
                    <div class="welcome-icon"><i class="fas fa-comments"></i></div>
                    <h2>${this.escape(context === 'friend' ? (this.t('friends') || 'Amigos') : (this.t('welcome') || 'Bem-vindo'))}</h2>
                    <p>${this.escape(msg)}</p>
                </div>
            `;
        }
    }
    
    openAddFriendModal(prefillUsername) {
        const input = document.getElementById('friend-username');
        if (input) input.value = (prefillUsername || '').trim();
        this.openModal('modal-friend');
    }
    
    showRankings() {
        document.querySelectorAll('.dm-shortcut-item').forEach(i => i.classList.remove('active'));
        document.getElementById('rankings-tab')?.classList.add('active');
        document.querySelectorAll('#dm-list .dm-item').forEach(i => i.classList.remove('active'));
        
        document.getElementById('friends-view').classList.add('hidden');
        document.getElementById('messages-area').classList.remove('hidden');
        this.renderRanking();
    }
    
    renderDMList() {
        const list = document.getElementById('dm-list');
        if (!list) return;
        const friends = this.friends || [];
        if (friends.length === 0) {
            list.innerHTML = `<div class="dm-list-empty">${this.t('dm_empty')}</div>`;
            return;
        }
        list.innerHTML = friends.map(f => {
            const avatar = f.avatar && this.sanitizeUrl(f.avatar) ? `<img src="${this.sanitizeUrl(f.avatar)}" alt="">` : this.avatarPlaceholder(f);
            return `
                <div class="dm-item" data-id="${this.escape(f.id)}">
                    <div class="dm-avatar">${avatar}</div>
                    <span>${this.escape(f.username || '')}</span>
                </div>
            `;
        }).join('');
        list.querySelectorAll('.dm-item').forEach(item => {
            item.addEventListener('click', () => this.openDM(item.dataset.id));
        });
    }
    
    addFriend() {
        const username = document.getElementById('friend-username').value.trim();
        if (!username) return this.toast('Digite o nome', 'error');
        const toUsername = username.split('#')[0];
        
        const friend = {
            id: this.uuid(),
            username: toUsername,
            tag: username.includes('#') ? '#' + username.split('#')[1] : '#0000',
            avatar: null,
            status: 'pending'
        };
        
        this.pendingFriends.push(friend);
        this.saveFriends();
        this.closeModals();
        document.getElementById('friend-username').value = '';
        this.showFriends();
        document.querySelectorAll('.friends-tabs .tab').forEach(t => t.classList.remove('active'));
        const pendingTab = document.querySelector('.friends-tabs .tab[data-tab="pending"]');
        if (pendingTab) pendingTab.classList.add('active');
        this.filterFriends('pending');
        this.toast(`Convite enviado para ${username}`);
        
        if (window.LibertyAPI && LibertyAPI.isAvailable() && this.currentUser) {
            LibertyAPI.postFriendRequest(this.currentUser.id, this.currentUser.username, toUsername).catch(() => {
                this.toast('Servidor indisponível: o outro usuário só verá o convite ao acessar o mesmo site.', 'error');
            });
        }
    }
    
    renderFriends() {
        const list = document.getElementById('friends-list');
        const online = this.friends.filter(f => f.status === 'online');
        
        if (online.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-friends"></i>
                    <p>Nenhum amigo ainda</p>
                    <button class="btn-primary" id="add-friend-empty">Adicionar amigo</button>
                </div>
            `;
            document.getElementById('add-friend-empty')?.addEventListener('click', () => this.openAddFriendModal());
            return;
        }
        
        list.innerHTML = online.map(f => `
            <div class="friend-item" data-id="${f.id}">
                <div class="friend-avatar">${f.avatar ? `<img src="${f.avatar}">` : this.avatarPlaceholder(f)}</div>
                <div class="friend-info">
                    <span class="friend-name">${f.username}</span>
                    <span class="friend-status">Online</span>
                </div>
                <div class="friend-actions">
                    <button class="msg-friend" title="Mensagem"><i class="fas fa-comment"></i></button>
                    <button class="call-friend" title="Ligar"><i class="fas fa-phone"></i></button>
                </div>
            </div>
        `).join('');
        
        list.querySelectorAll('.friend-item').forEach(item => {
            item.addEventListener('click', () => this.openDM(item.dataset.id));
            item.querySelector('.msg-friend').addEventListener('click', e => {
                e.stopPropagation();
                this.openDM(item.dataset.id);
            });
        });
    }
    
    filterFriends(type) {
        const list = document.getElementById('friends-list');
        if (type === 'received') {
            this.renderReceivedRequests(list);
            return;
        }
        let friends = [];
        
        switch(type) {
            case 'online':
                friends = this.friends.filter(f => f.status === 'online');
                break;
            case 'all':
                friends = this.friends;
                break;
            case 'pending':
                friends = this.pendingFriends;
                break;
            case 'blocked':
                friends = this.blockedFriends;
                break;
        }
        
        if (friends.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-friends"></i>
                    <p>Nenhum ${type === 'pending' ? 'convite pendente' : type === 'blocked' ? 'usuário bloqueado' : 'amigo'}</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = friends.map(f => `
            <div class="friend-item" data-id="${f.id}">
                <div class="friend-avatar">${f.avatar ? `<img src="${f.avatar}">` : this.avatarPlaceholder(f)}</div>
                <div class="friend-info">
                    <span class="friend-name">${f.username}</span>
                    <span class="friend-status">${f.status === 'pending' ? 'Pendente' : f.status}</span>
                </div>
            </div>
        `).join('');
    }
    
    async renderReceivedRequests(list) {
        if (!list) return;
        list.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Carregando...</p></div>';
        let received = [];
        if (window.LibertyAPI && LibertyAPI.isAvailable() && this.currentUser) {
            try {
                received = await LibertyAPI.getFriendRequestsReceived(this.currentUser.username);
                if (!Array.isArray(received)) received = [];
            } catch (_) { received = []; }
        }
        if (received.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum convite recebido</p>
                    <p class="friends-hint">Quem acessar o mesmo site e enviar convite para "${this.escape(this.currentUser?.username || '')}" aparecerá aqui.</p>
                </div>
            `;
            return;
        }
        list.innerHTML = received.map(r => `
            <div class="friend-item friend-item-received" data-request-id="${this.escape(r.id)}">
                <div class="friend-avatar">${this.avatarPlaceholder({ username: r.fromUsername })}</div>
                <div class="friend-info">
                    <span class="friend-name">${this.escape(r.fromUsername)}</span>
                    <span class="friend-status">Quer ser seu amigo</span>
                </div>
                <div class="friend-actions">
                    <button class="btn-accept-friend" title="Aceitar"><i class="fas fa-check"></i> Aceitar</button>
                </div>
            </div>
        `).join('');
        list.querySelectorAll('.btn-accept-friend').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.friend-item-received');
                const requestId = item?.dataset?.requestId;
                if (!requestId || !this.currentUser) return;
                btn.disabled = true;
                try {
                    await LibertyAPI.acceptFriendRequest(requestId, this.currentUser.id, this.currentUser.username);
                    const r = received.find(x => x.id === requestId);
                    if (r && !this.friends.some(f => f.id === r.fromUserId)) {
                        this.friends.push({ id: r.fromUserId, username: r.fromUsername, status: 'online', avatar: null });
                        this.saveFriends();
                        this.renderDMList();
                    }
                    this.filterFriends('received');
                    this.toast(`${r?.fromUsername || 'Convite'} aceito!`);
                } catch (_) {
                    this.toast('Erro ao aceitar convite', 'error');
                    btn.disabled = false;
                }
            });
        });
    }
    
    openDM(friendId) {
        const friend = this.friends.find(f => f.id === friendId);
        if (!friend) return;
        
        this.currentDM = friend;
        this.currentChannel = null;
        
        document.getElementById('channel-name').textContent = friend.username;
        document.getElementById('channel-icon').className = 'fas fa-at';
        this.updateMessageInputState();
        this.updateCharIndicator();
        this.updateAvatar();
        
        document.querySelectorAll('.dm-shortcut-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('#dm-list .dm-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`#dm-list .dm-item[data-id="${friendId}"]`)?.classList.add('active');
        
        document.getElementById('friends-view').classList.add('hidden');
        document.getElementById('messages-area').classList.remove('hidden');
        
        this.realtimeUnsubscribeCurrent();
        const conversationId = this.getDmConversationId(this.currentUser?.id, friend.id);
        if (conversationId) {
            this._realtimeRoom = 'dm:' + conversationId;
            if (window.LibertyAPI && LibertyAPI.isAvailable()) LibertyAPI.realtimeSubscribe(this._realtimeRoom);
        }
        this.loadDMMessages(friend.id);
    }
    
    realtimeUnsubscribeCurrent() {
        if (this._realtimeRoom && window.LibertyAPI) LibertyAPI.realtimeUnsubscribe(this._realtimeRoom);
        this._realtimeRoom = null;
    }
    
    handleRealtimeMessage(data) {
        if (!data || data.type !== 'message' || !data.room || !data.message) return;
        const area = document.getElementById('messages-area');
        if (!area) return;
        const msg = data.message;
        let currentRoom = null;
        if (this.currentChannel && this.currentServer) {
            currentRoom = 'channel:' + this.currentServer.id + ':' + this.currentChannel.id;
        } else if (this.currentDM && this.currentUser) {
            const cid = this.getDmConversationId(this.currentUser.id, this.currentDM.id);
            if (cid) currentRoom = 'dm:' + cid;
        }
        if (data.room !== currentRoom) return;
        if (this.currentChannel) {
            const channelId = this.currentChannel.id;
            if (!this.messages[channelId]) this.messages[channelId] = [];
            if (this.messages[channelId].some(m => m.id === msg.id)) return;
            this.messages[channelId].push(msg);
            this.saveMessagesToStorage();
        } else if (this.currentDM) {
            const cid = this.getDmConversationId(this.currentUser?.id, this.currentDM.id);
            if (!cid) return;
            if (!this.dmMessages[cid]) this.dmMessages[cid] = [];
            if (this.dmMessages[cid].some(m => m.id === msg.id)) return;
            this.dmMessages[cid].push(msg);
            this.saveMessagesToStorage();
        }
        const lastMsg = area.querySelector('.message:last-child');
        const lastAuthor = lastMsg?.querySelector('.message-author')?.textContent;
        const isContinuation = lastAuthor && (msg.author === lastAuthor);
        this.createMessageHTML(msg, isContinuation).then(html => {
            area.insertAdjacentHTML('beforeend', html);
            requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
            this.processMessageTranslations();
        });
    }
    
    // Messages
    async loadMessages() {
        const area = document.getElementById('messages-area');
        const msgs = this.messages[this.currentChannel?.id] || [];
        const serverId = this.currentServer?.id;
        const channelId = this.currentChannel?.id;

        if (window.LibertyAPI) {
            const ok = await LibertyAPI.checkApi();
            if (ok && serverId && channelId) {
                try {
                    const list = await LibertyAPI.getChannelMessages(serverId, channelId);
                    if (Array.isArray(list) && list.length >= 0) {
                        this.messages[channelId] = list;
                        this.saveMessagesToStorage();
                        const htmlParts = await Promise.all(list.map((m, i) => this.createMessageHTML(m, i > 0 && list[i - 1].author === m.author)));
                        area.innerHTML = htmlParts.join('');
                        requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
                        this.processMessageTranslations();
                        return;
                    }
                } catch (_) { /* fallback local */ }
            }
        }

        if (!msgs.length) {
            area.innerHTML = `
                <div class="welcome">
                    <div class="welcome-icon"><i class="fas fa-comments"></i></div>
                    <h2>Bem-vindo a #${this.escape(this.currentChannel?.name || 'canal')}</h2>
                    <p>Este é o início do canal</p>
                </div>
            `;
            return;
        }
        
        const htmlParts = await Promise.all(msgs.map((m, i) => this.createMessageHTML(m, i > 0 && msgs[i - 1].author === m.author)));
        area.innerHTML = htmlParts.join('');
        requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
        this.processMessageTranslations();
    }
    
    async loadDMMessages(friendId) {
        const conversationId = this.getDmConversationId(this.currentUser?.id, friendId);
        let msgs = (conversationId && this.dmMessages[conversationId]) ? this.dmMessages[conversationId] : [];
        const area = document.getElementById('messages-area');

        if (window.LibertyAPI && conversationId) {
            const ok = await LibertyAPI.checkApi();
            if (ok) {
                try {
                    const list = await LibertyAPI.getDMMessages(conversationId);
                    if (Array.isArray(list) && list.length >= 0) {
                        this.dmMessages[conversationId] = list;
                        this.saveMessagesToStorage();
                        const htmlParts = await Promise.all(list.map((m, i) => this.createMessageHTML(m, i > 0 && list[i - 1].author === m.author)));
                        area.innerHTML = htmlParts.join('');
                        requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
                        this.processMessageTranslations();
                        return;
                    }
                } catch (_) { /* fallback local */ }
            }
        }

        if (!msgs.length) {
            area.innerHTML = `
                <div class="welcome">
                    <div class="welcome-icon"><i class="fas fa-comments"></i></div>
                    <h2>${this.escape(this.currentDM?.username || 'Conversa')}</h2>
                    <p>Início da conversa</p>
                </div>
            `;
            return;
        }
        
        const htmlParts = await Promise.all(msgs.map((m, i) => this.createMessageHTML(m, i > 0 && msgs[i - 1].author === m.author)));
        area.innerHTML = htmlParts.join('');
        requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
        this.processMessageTranslations();
    }
    
    createMessageHTML(m, isContinuation) {
        const safeAvatar = (m.avatar && this.sanitizeUrl(m.avatar)) ? this.sanitizeUrl(m.avatar) : '';
        const attachmentsHtml = (m.attachments || []).map(a => {
            const safeData = this.sanitizeUrl(a.data);
            if (!safeData) return '';
            if (a.type && a.type.startsWith('image/')) {
                return `<a href="${this.escape(safeData)}" target="_blank" rel="noopener noreferrer" class="msg-attachment msg-attachment-image"><img src="${this.escape(safeData)}" alt="${this.escape(a.name)}"></a>`;
            }
            return `<a href="${this.escape(safeData)}" download="${this.escape(a.name)}" class="msg-attachment msg-attachment-file"><i class="fas fa-file"></i><span>${this.escape(a.name)}</span></a>`;
        }).filter(Boolean).join('');
        const hasText = m.text && m.text !== '(arquivo)' && m.text.trim().length > 0;
        const translateDiv = hasText ? `<div class="message-translation" data-msg-id="${this.escape(m.id)}" data-msg-text="${this.escape(m.text).replace(/"/g, '&quot;')}"></div>` : '';
        const { html: textHtml, youtubeIds } = hasText ? this.formatMessageTextWithEmbeds(m.text) : { html: '', youtubeIds: [] };
        const embedsHtml = youtubeIds.map(id => this.createEmbedHTML('youtube', id)).join('');
        const inviteCodes = hasText ? this.getInviteCodesFromText(m.text) : [];
        const invitePromises = inviteCodes.map(code => this.getInviteServer(code).then(server => server ? this.createInviteEmbedHTML(server, code) : '').catch(() => ''));
        return Promise.all(invitePromises).then(inviteParts => {
            const inviteEmbedsHtml = inviteParts.join('');
            if (isContinuation) {
                return `
            <div class="message message-grouped" data-msg-id="${this.escape(m.id)}">
                <div class="message-avatar message-avatar-placeholder"></div>
                <div class="message-body">
                    <div class="message-header message-header-inline">
                        <span class="message-time">${this.escape(m.time)}</span>
                    </div>
                    ${translateDiv}
                    ${hasText ? `<div class="message-text">${textHtml}</div>` : ''}
                    ${embedsHtml}
                    ${inviteEmbedsHtml}
                    ${attachmentsHtml ? `<div class="message-attachments">${attachmentsHtml}</div>` : ''}
                </div>
            </div>
        `;
            }
            return `
            <div class="message" data-msg-id="${this.escape(m.id)}">
                <div class="message-avatar">${safeAvatar ? `<img src="${this.escape(safeAvatar)}" alt="">` : this.avatarPlaceholder(m)}</div>
                <div class="message-body">
                    <div class="message-header">
                        <span class="message-author">${this.escape(m.author)}</span>
                        <span class="message-time">${this.escape(m.time)}</span>
                    </div>
                    ${translateDiv}
                    ${hasText ? `<div class="message-text">${textHtml}</div>` : ''}
                    ${embedsHtml}
                    ${inviteEmbedsHtml}
                    ${attachmentsHtml ? `<div class="message-attachments">${attachmentsHtml}</div>` : ''}
                </div>
            </div>
        `;
        }).catch(() => `
            <div class="message" data-msg-id="${this.escape(m.id)}">
                <div class="message-body"><span class="message-author">${this.escape(m.author)}</span><span class="message-time">${this.escape(m.time)}</span></div>
            </div>
        `);
    }
    
    async translateMessageText(text, targetLang) {
        const cacheKey = `${text.slice(0, 50)}|${targetLang}`;
        if (this._translationCache[cacheKey]) return this._translationCache[cacheKey];
        try {
            const res = await fetch('https://libretranslate.com/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: text, source: 'auto', target: targetLang === 'pt' ? 'pt' : 'en' })
            });
            const data = await res.json();
            const detected = data.detectedLanguage?.language?.slice(0, 2);
            const target = targetLang?.slice(0, 2);
            if (detected && target && detected === target) return null;
            if (data.translatedText) {
                this._translationCache[cacheKey] = data.translatedText;
                return data.translatedText;
            }
        } catch (e) { console.warn('Translation failed:', e); }
        return null;
    }
    
    async processMessageTranslations() {
        const userLang = this.lang();
        const targets = document.querySelectorAll('.message-translation[data-msg-text]');
        for (const el of targets) {
            const text = el.getAttribute('data-msg-text');
            if (!text) continue;
            const translated = await this.translateMessageText(text, userLang);
            if (translated) {
                el.innerHTML = `<span class="translation-label"><i class="fas fa-language"></i> ${this.t('translated')}</span><div class="translation-text">${this.escape(translated)}</div>`;
                el.classList.add('visible');
            }
            el.removeAttribute('data-msg-text');
        }
    }
    
    getActivityLevel(minutes) {
        const m = minutes || 0;
        if (m < 5) return { level: 0, label: 'UNKNOWN' };
        const level = Math.floor(1 + Math.log(1 + (m - 5) / 50) / Math.log(1.2));
        const lvl = Math.min(99, Math.max(1, level));
        return { level: lvl, label: String(lvl) };
    }
    
    getContentLevel(xp) {
        const x = xp || 0;
        if (x < 500) return { level: 0, label: 'UNKNOWN' };
        const level = Math.floor(1 + Math.log(x / 500) / Math.log(1.2));
        const lvl = Math.min(99, Math.max(1, level));
        return { level: lvl, label: String(lvl) };
    }
    
    async renderRanking() {
        const area = document.getElementById('messages-area');
        if (!area) return;
        let users = [];
        if (window.LibertyDB) users = await LibertyDB.getAllUsers();
        else users = Object.values(this.getStoredUsers()).filter(u => u && typeof u === 'object').map(u => this.ensureAuthMethods(u));
        const byActivity = [...users].sort((a, b) => (b.activityMinutes || 0) - (a.activityMinutes || 0));
        const byContent = [...users].sort((a, b) => (b.contentXP || 0) - (a.contentXP || 0));
        const fmtTime = (m) => {
            if (!m || m < 1) return '0 min';
            if (m < 60) return Math.floor(m) + ' min';
            return (m / 60).toFixed(1) + ' h';
        };
        area.innerHTML = `
            <div class="ranking-view">
                <div class="ranking-header">
                    <i class="fas fa-trophy ranking-icon"></i>
                    <h2>${this.t('ranking_title')}</h2>
                    <p>${this.t('ranking_subtitle')}</p>
                </div>
                <div class="ranking-tables">
                    <div class="ranking-table">
                        <h3><i class="fas fa-clock"></i> ${this.t('ranking_activity')}</h3>
                        <p class="ranking-desc">${this.t('ranking_activity_desc')}</p>
                        <div class="ranking-list">
                            ${byActivity.length === 0 ? `<p class="ranking-empty">${this.t('ranking_empty')}</p>` : byActivity.slice(0, 20).map((u, i) => {
                                const al = this.getActivityLevel(u.activityMinutes);
                                return `
                                <div class="ranking-item ${u.id === this.currentUser?.id ? 'current' : ''}">
                                    <span class="rank">#${i + 1}</span>
                                    <div class="rank-avatar">${u.avatar ? `<img src="${u.avatar}">` : this.avatarPlaceholder(u)}</div>
                                    <div class="rank-info">
                                        <span class="rank-name">${this.escape(u.username || '')} ${u.tag || ''}</span>
                                        <span class="rank-stat">${fmtTime(u.activityMinutes)} · Nível ${al.label}</span>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                    <div class="ranking-table">
                        <h3><i class="fas fa-star"></i> ${this.t('ranking_content')}</h3>
                        <p class="ranking-desc">${this.t('ranking_content_desc')}</p>
                        <div class="ranking-list">
                            ${byContent.length === 0 ? `<p class="ranking-empty">${this.t('ranking_empty')}</p>` : byContent.slice(0, 20).map((u, i) => {
                                const cl = this.getContentLevel(u.contentXP);
                                return `
                                <div class="ranking-item ${u.id === this.currentUser?.id ? 'current' : ''}">
                                    <span class="rank">#${i + 1}</span>
                                    <div class="rank-avatar">${u.avatar ? `<img src="${u.avatar}">` : this.avatarPlaceholder(u)}</div>
                                    <div class="rank-info">
                                        <span class="rank-name">${this.escape(u.username || '')} ${u.tag || ''}</span>
                                        <span class="rank-stat">${(u.contentXP || 0).toLocaleString('pt-BR')} XP · Nível ${cl.label}</span>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
                <p class="ranking-footer">${this.t('ranking_footer')}</p>
            </div>
        `;
    }
    
    canSendMessages() {
        const inTextChannel = this.currentChannel && this.currentChannel.type === 'text';
        const inDM = !!this.currentDM;
        if (inDM) return true;
        if (this.currentServer?.id === this.LIBERTY_SERVER_ID && inTextChannel && this.currentUser) {
            return true;
        }
        if (inTextChannel && this.currentServer && this.currentUser) {
            if (!Array.isArray(this.currentServer.members)) this.currentServer.members = [];
            let me = this.currentServer.members.find(m => m.id === this.currentUser.id);
            if (!me) {
                this.currentServer.members.push({
                    ...this.currentUser,
                    serverAvatars: this.currentUser.serverAvatars || {},
                    roles: ['@todos'],
                    status: 'online'
                });
                this.saveServers();
                me = this.currentServer.members.find(m => m.id === this.currentUser.id);
            }
            return this.canSendInChannel(me, this.currentChannel);
        }
        return inTextChannel;
    }
    
    updateMessageInputState() {
        const wrapper = document.querySelector('.message-input-wrapper');
        const canSend = this.canSendMessages();
        if (wrapper) wrapper.classList.toggle('disabled', !canSend);
        const input = document.getElementById('message-input');
        const attachBtn = document.getElementById('attach-btn');
        const sendBtn = document.getElementById('send-btn');
        if (input) input.disabled = !canSend;
        if (attachBtn) attachBtn.disabled = !canSend;
        if (sendBtn) sendBtn.disabled = !canSend;
        if (input) input.placeholder = canSend ? (this.currentChannel ? this.t('send_message_channel', { channel: this.currentChannel.name }) : this.currentDM ? this.t('send_message_to', { user: this.currentDM.username }) : this.t('send_message')) : this.t('select_channel_friend');
    }
    
    getLimits() {
        const tier = this.currentUser?.subscription || 'free';
        return this.LIMITS[tier] || this.LIMITS.free;
    }
    
    updateCharIndicator() {
        const input = document.getElementById('message-input');
        const countEl = document.getElementById('char-count');
        const limitEl = document.getElementById('char-limit');
        const indicator = document.getElementById('char-indicator');
        if (!input || !countEl || !limitEl || !indicator) return;
        
        const limits = this.getLimits();
        input.maxLength = limits.chars;
        const len = input.value.length;
        countEl.textContent = len;
        limitEl.textContent = limits.chars.toLocaleString('pt-BR');
        indicator.classList.remove('near-limit', 'at-limit');
        if (len >= limits.chars) indicator.classList.add('at-limit');
        else if (len >= limits.chars * 0.9) indicator.classList.add('near-limit');
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        
        const limits = this.getLimits();
        const totalBytes = this.pendingAttachments.reduce((s, a) => s + a.size, 0);
        let added = 0;
        
        for (const file of files) {
            const newTotal = totalBytes + added + file.size;
            if (newTotal > limits.filesBytes) {
                this.toast(`Limite de ${(limits.filesBytes / 1024 / 1024).toFixed(0)}MB excedido. Assine Premium para mais.`, 'error');
                break;
            }
            this.pendingAttachments.push({ file, name: file.name, size: file.size, type: file.type });
            added += file.size;
        }
        
        e.target.value = '';
        this.renderAttachmentsPreview();
    }
    
    removeAttachment(index) {
        this.pendingAttachments.splice(index, 1);
        this.renderAttachmentsPreview();
    }
    
    renderAttachmentsPreview() {
        const container = document.getElementById('attachments-preview');
        if (!container) return;
        
        if (!this.pendingAttachments.length) {
            container.innerHTML = '';
            container.classList.remove('visible');
            return;
        }
        
        container.classList.add('visible');
        const limits = this.getLimits();
        const totalBytes = this.pendingAttachments.reduce((s, a) => s + a.size, 0);
        const fmtSize = (bytes) => {
            const mb = bytes / 1024 / 1024;
            return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb.toFixed(1) + ' MB';
        };
        container.innerHTML = `
            <div class="attachments-header">
                <span><i class="fas fa-paperclip"></i> ${this.pendingAttachments.length} arquivo(s) — ${fmtSize(totalBytes)} / ${fmtSize(limits.filesBytes)}</span>
            </div>
            <div class="attachments-list">
                ${this.pendingAttachments.map((a, i) => `
                    <div class="attachment-preview" data-index="${i}">
                        ${a.type.startsWith('image/') 
                            ? `<img src="${URL.createObjectURL(a.file)}" alt="">` 
                            : `<i class="fas fa-file"></i><span>${this.escape(a.name)}</span>`}
                        <button type="button" class="attachment-remove" data-index="${i}" title="Remover"><i class="fas fa-times"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.querySelectorAll('.attachment-remove').forEach(btn => {
            btn.addEventListener('click', () => this.removeAttachment(parseInt(btn.dataset.index)));
        });
    }
    
    async sendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        const hasAttachments = this.pendingAttachments.length > 0;
        
        if (!text && !hasAttachments) return;
        
        if (!this.currentUser) return;
        
        if (!this.canSendMessages()) {
            this.toast(this.t('toast_select_channel'), 'error');
            return;
        }
        
        const limits = this.getLimits();
        if (text.length > limits.chars) {
            this.toast(this.t('toast_upgrade_plan'), 'error');
            return;
        }
        
        const totalBytes = this.pendingAttachments.reduce((s, a) => s + a.size, 0);
        if (totalBytes > limits.filesBytes) {
            const mb = limits.filesBytes / 1024 / 1024;
            const limitStr = mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb.toFixed(0) + ' MB';
            this.toast(this.t('toast_upgrade_plan'), 'error');
            return;
        }
        
        const attachments = [];
        let fileXP = 0;
        for (const a of this.pendingAttachments) {
            fileXP += (a.size / 1024 / 1024) * 250;
            const data = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res({ name: a.name, type: a.type, data: r.result });
                r.onerror = rej;
                r.readAsDataURL(a.file);
            });
            attachments.push(data);
        }
        this.currentUser.contentXP = (this.currentUser.contentXP || 0) + text.length + Math.floor(fileXP);
        this.saveUser();
        this.pendingAttachments = [];
        this.renderAttachmentsPreview();
        
        const msg = {
            id: this.uuid(),
            author: this.currentUser.username,
            avatar: this.getAvatar(this.currentUser, this.currentServer?.id),
            text: text || '(arquivo)',
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            attachments
        };

        const payload = {
            id: msg.id,
            authorId: this.currentUser.id,
            author: msg.author,
            avatar: msg.avatar,
            text: msg.text,
            attachments: msg.attachments
        };

        if (this.currentDM) {
            const conversationId = this.getDmConversationId(this.currentUser?.id, this.currentDM.id);
            if (conversationId) {
                if (window.LibertyAPI && LibertyAPI.isAvailable()) {
                    try {
                        await LibertyAPI.postDMMessage(conversationId, payload);
                    } catch (_) { /* guardar só local */ }
                }
                if (!this.dmMessages[conversationId]) this.dmMessages[conversationId] = [];
                this.dmMessages[conversationId].push(msg);
            }
            this.loadDMMessages(this.currentDM.id);
        } else if (this.currentChannel) {
            if (window.LibertyAPI && LibertyAPI.isAvailable() && this.currentServer?.id) {
                try {
                    await LibertyAPI.postChannelMessage(this.currentServer.id, this.currentChannel.id, payload);
                } catch (_) { /* guardar só local */ }
            }
            if (!this.messages[this.currentChannel.id]) this.messages[this.currentChannel.id] = [];
            this.messages[this.currentChannel.id].push(msg);
            this.loadMessages();
        }
        
        this.saveMessagesToStorage();
        input.value = '';
        this.updateCharIndicator();
    }
    
    // Members
    renderMembers(members = null) {
        if (!members) members = this.currentUser ? [this.currentUser] : [];
        
        const online = document.getElementById('online-members');
        document.getElementById('online-count').textContent = members.length;
        document.getElementById('member-count').textContent = members.length;
        
        const serverId = this.currentServer?.id;
        const currentUserId = this.currentUser?.id;
        online.innerHTML = members.map(m => {
            const avatar = this.getAvatar(m, serverId);
            const isSelf = m.id === currentUserId;
            const friend = this.friends?.find(f => f.id === m.id || (f.username || '').toLowerCase() === (m.username || '').toLowerCase());
            const canMessage = !isSelf && friend;
            const canAddFriend = !isSelf && !friend;
            return `
            <div class="member-item online" data-id="${m.id}" data-username="${this.escape(m.username || '')}">
                <div class="avatar">${avatar ? `<img src="${this.sanitizeUrl(avatar)}" alt="">` : this.avatarPlaceholder(m)}</div>
                <span class="member-name">${this.escape(m.username || '')}</span>
                ${!isSelf ? `
                <div class="member-item-actions">
                    ${canMessage ? `<button type="button" class="member-action-btn" title="Mensagem" data-action="message"><i class="fas fa-comment"></i></button>` : ''}
                    ${canAddFriend ? `<button type="button" class="member-action-btn" title="Adicionar amigo" data-action="add-friend"><i class="fas fa-user-plus"></i></button>` : ''}
                </div>
                ` : ''}
            </div>
        `}).join('');
        
        online.querySelectorAll('.member-item').forEach(item => {
            const memberId = item.dataset.id;
            const member = members.find(m => m.id === memberId);
            const username = (item.dataset.username || '').trim();
            item.addEventListener('click', (e) => {
                if (e.target.closest('.member-action-btn')) return;
                if (e.button !== 0) return;
                if (member) this.showUserProfile(member);
            });
            item.querySelectorAll('.member-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (btn.dataset.action === 'message' && member) {
                        const fr = this.friends?.find(f => f.id === member.id || (f.username || '').toLowerCase() === (member.username || '').toLowerCase());
                        if (fr) {
                            this.closeModals();
                            this.goHome();
                            setTimeout(() => this.openDM(fr.id), 50);
                        } else {
                            this.openAddFriendModal(member.username);
                            this.toast('Adicione como amigo para enviar mensagem.', 'info');
                        }
                    } else if (btn.dataset.action === 'add-friend' && username) {
                        this.closeModals();
                        this.openAddFriendModal(username);
                    }
                });
            });
            item.addEventListener('contextmenu', e => this.showContextMenu(e, memberId));
        });
    }

    showUserProfile(user) {
        if (!user) return;
        const bannerEl = document.getElementById('user-profile-banner');
        const bannerImg = document.getElementById('user-profile-banner-img');
        const avatarEl = document.getElementById('user-profile-avatar');
        const nameEl = document.getElementById('user-profile-name');
        const tagEl = document.getElementById('user-profile-tag');
        const descEl = document.getElementById('user-profile-desc');
        const statusEl = document.getElementById('user-profile-status');
        const serverId = this.currentServer?.id;
        const avatarSrc = this.getAvatar(user, serverId);
        const bannerSrc = user.banner && this.sanitizeUrl(user.banner) ? user.banner : '';

        if (bannerEl) {
            bannerEl.classList.toggle('no-banner', !bannerSrc);
            if (bannerSrc) {
                bannerImg.src = bannerSrc;
                bannerImg.alt = '';
            } else {
                bannerImg.removeAttribute('src');
                bannerImg.alt = '';
            }
        }
        if (avatarEl) {
            if (avatarSrc && this.sanitizeUrl(avatarSrc)) {
                avatarEl.innerHTML = `<img src="${this.sanitizeUrl(avatarSrc)}" alt="">`;
            } else {
                avatarEl.innerHTML = this.avatarPlaceholder(user);
            }
        }
        if (nameEl) nameEl.textContent = user.username || 'Usuário';
        if (tagEl) tagEl.textContent = user.tag || '#0000';
        if (descEl) {
            descEl.textContent = user.bio || '';
            descEl.classList.toggle('empty', !(user.bio && user.bio.trim()));
        }
        if (statusEl) {
            const status = user.status || 'offline';
            statusEl.className = 'user-profile-status status-' + (status === 'online' ? 'online' : status === 'idle' ? 'idle' : status === 'dnd' ? 'dnd' : 'offline');
        }
        this._profileModalUserId = user.id;
        this._profileModalUser = user;
        const addRoleBtn = document.getElementById('user-profile-add-role-btn');
        const dropdown = document.getElementById('user-profile-roles-dropdown');
        if (addRoleBtn) {
            const inServer = this.currentServer && this.currentServer.id !== this.LIBERTY_SERVER_ID && this.canManageRoles();
            addRoleBtn.classList.toggle('hidden', !inServer);
        }
        if (dropdown) dropdown.classList.add('hidden');
        this.openModal('modal-user-profile');
    }
    
    toggleProfileRolesDropdown() {
        const dropdown = document.getElementById('user-profile-roles-dropdown');
        if (!dropdown) return;
        if (dropdown.classList.contains('hidden')) {
            const list = document.getElementById('user-profile-roles-list');
            const emptyEl = document.getElementById('user-profile-roles-empty');
            const member = this.currentServer?.members?.find(m => m.id === this._profileModalUserId);
            const serverRoles = this.currentServer?.roles || this.roles || [];
            const memberRoles = member?.roles || [];
            const available = serverRoles.filter(r => !memberRoles.includes(r.name));
            if (list) {
                list.innerHTML = available.length === 0 ? '' : available.map((r, i) => `
                    <div class="assign-role-option" data-role-index="${i}">
                        <span class="role-dot" style="background:${this.escape(r.color)}"></span>
                        <span>${this.escape(r.name)}</span>
                    </div>
                `).join('');
                list.querySelectorAll('.assign-role-option').forEach(el => {
                    const idx = parseInt(el.dataset.roleIndex, 10);
                    const role = available[idx];
                    if (role) el.addEventListener('click', () => this.assignRoleToProfileUser(role.name));
                });
            }
            if (emptyEl) {
                emptyEl.classList.toggle('hidden', available.length > 0);
            }
            dropdown.classList.remove('hidden');
        } else {
            dropdown.classList.add('hidden');
        }
    }
    
    assignRoleToProfileUser(roleName) {
        if (!roleName || !this.currentServer || this.currentServer.id === this.LIBERTY_SERVER_ID) return;
        const member = this.currentServer.members?.find(m => m.id === this._profileModalUserId);
        if (!member) {
            this.toast('Membro não encontrado', 'error');
            return;
        }
        if (!member.roles) member.roles = [];
        if (member.roles.includes(roleName)) {
            this.toast('Usuário já possui este cargo');
            document.getElementById('user-profile-roles-dropdown')?.classList.add('hidden');
            return;
        }
        member.roles.push(roleName);
        this.saveServers();
        this.renderMembers(this.currentServer.members);
        document.getElementById('user-profile-roles-dropdown')?.classList.add('hidden');
        this.toast(`Cargo "${roleName}" adicionado!`);
    }
    
    // Roles
    renderRoles(roles) {
        this.roles = roles || this.roles;
        const list = document.getElementById('roles-list');
        if (!list) return;
        
        list.innerHTML = this.roles.map((r, i) => `
            <div class="role-item ${i === 0 ? 'active' : ''}" data-role="${i}">
                <span class="role-dot" style="background:${r.color}"></span>
                <span>${r.name}</span>
            </div>
        `).join('');
        
        list.querySelectorAll('.role-item').forEach(item => {
            item.addEventListener('click', () => this.selectRole(parseInt(item.dataset.role)));
        });
        
        this.selectRole(0);
    }
    
    selectRole(i) {
        this.selectedRole = i;
        const role = this.roles[i];
        if (!role) return;
        
        document.querySelectorAll('.role-item').forEach(r => r.classList.remove('active'));
        document.querySelector(`.role-item[data-role="${i}"]`)?.classList.add('active');
        
        document.getElementById('role-name').value = role.name;
        document.getElementById('role-color').value = role.color;
        
        document.querySelectorAll('.perm-item input').forEach(cb => {
            cb.checked = role.permissions.includes(cb.dataset.perm);
        });
    }
    
    addRole() {
        if (!this.currentServer || this.currentServer.id === this.LIBERTY_SERVER_ID) {
            this.toast('Não é possível adicionar cargo neste servidor', 'error');
            return;
        }
        if (!this.canManageRoles()) {
            this.toast('Você não pode gerenciar cargos neste servidor', 'error');
            return;
        }
        this.roles.push({ id: this.uuid(), name: 'Novo Cargo', color: '#FFFF00', permissions: [] });
        this.renderRoles();
        this.selectRole(this.roles.length - 1);
        if (this.currentServer) {
            this.currentServer.roles = this.roles;
            this.saveServers();
        }
        this.toast('Cargo criado!');
    }
    
    saveRole() {
        const role = this.roles[this.selectedRole];
        if (!role) return;
        role.name = document.getElementById('role-name')?.value || role.name;
        role.color = document.getElementById('role-color')?.value || role.color;
        role.permissions = [];
        document.querySelectorAll('.perm-item input:checked').forEach(cb => {
            role.permissions.push(cb.dataset.perm);
        });
        if (this.currentServer) {
            this.currentServer.roles = this.roles;
            this.saveServers();
        }
        this.renderRoles();
        this.toast('Cargo salvo!');
    }
    
    deleteRole() {
        if (this.roles.length <= 1) return this.toast('Não pode excluir o último cargo', 'error');
        if (!this.currentServer || this.currentServer.id === this.LIBERTY_SERVER_ID) {
            this.toast('Não é possível excluir cargos neste servidor', 'error');
            return;
        }
        if (!this.canManageRoles()) {
            this.toast('Você não pode gerenciar cargos neste servidor', 'error');
            return;
        }
        this.roles.splice(this.selectedRole, 1);
        if (this.currentServer) {
            this.currentServer.roles = this.roles;
            this.saveServers();
        }
        this.renderRoles();
        this.selectRole(Math.min(this.selectedRole, this.roles.length - 1));
        this.toast('Cargo excluído');
    }
    
    updateAddRoleButtonVisibility() {
        const btn = document.getElementById('add-role-btn');
        if (!btn) return;
        const can = this.currentServer && this.currentServer.id !== this.LIBERTY_SERVER_ID && this.canManageRoles();
        btn.classList.toggle('hidden', !can);
    }
    
    isServerOwner() {
        if (!this.currentServer || !this.currentUser) return false;
        const me = this.currentServer.members?.find(m => m.id === this.currentUser.id);
        return !!me?.roles?.includes('Admin');
    }
    
    canManageRoles() {
        if (!this.currentServer || this.currentServer.id === this.LIBERTY_SERVER_ID) return false;
        const me = this.currentServer.members?.find(m => m.id === this.currentUser?.id);
        if (!me || !me.roles?.length) return false;
        const serverRoles = this.currentServer.roles || this.roles;
        return me.roles.some(name => {
            const r = serverRoles.find(role => role.name === name);
            return r && r.permissions && (r.permissions.includes('roles') || r.permissions.includes('admin'));
        });
    }
    
    canManageChannels() {
        if (!this.currentServer || this.currentServer.id === this.LIBERTY_SERVER_ID) return false;
        const me = this.currentServer.members?.find(m => m.id === this.currentUser?.id);
        if (!me || !me.roles?.length) return false;
        const serverRoles = this.currentServer.roles || this.roles;
        return me.roles.some(name => {
            const r = serverRoles.find(role => role.name === name);
            return r && r.permissions && (r.permissions.includes('channels') || r.permissions.includes('admin'));
        });
    }
    
    ensureChannelDefaults(channel) {
        if (!channel) return;
        if (channel.permissions == null) channel.permissions = { view: ['@todos'], send: ['@todos'] };
        if (!Array.isArray(channel.permissions.view)) channel.permissions.view = ['@todos'];
        if (!Array.isArray(channel.permissions.send)) channel.permissions.send = ['@todos'];
        if (channel.categoryId === undefined) channel.categoryId = null;
    }
    
    ensureServerCategories(server) {
        if (!server) return;
        if (!Array.isArray(server.categories)) server.categories = [];
        (server.channels || []).forEach(c => this.ensureChannelDefaults(c));
    }
    
    canSeeChannel(member, channel) {
        if (!channel) return true;
        if (!channel.permissions || !channel.permissions.view || channel.permissions.view.length === 0) return true;
        if (member?.roles?.includes('Admin')) return true;
        if (member && this.memberCanManageChannels(member)) return true;
        const view = channel.permissions.view || ['@todos'];
        if (!member || !member.roles || !member.roles.length) return view.includes('@todos');
        return member.roles.some(r => view.includes(r));
    }
    
    memberCanManageChannels(member) {
        if (!this.currentServer || !member?.roles?.length) return false;
        const serverRoles = this.currentServer.roles || this.roles;
        return member.roles.some(name => {
            const r = serverRoles.find(role => role.name === name);
            return r && r.permissions && (r.permissions.includes('channels') || r.permissions.includes('admin'));
        });
    }
    
    canSendInChannel(member, channel) {
        if (!channel || !channel.permissions) return true;
        const send = channel.permissions.send || ['@todos'];
        if (!member || !member.roles || !member.roles.length) return send.includes('@todos');
        return member.roles.some(r => send.includes(r));
    }
    
    // Invites
    async getInviteServer(code) {
        if (!code || typeof code !== 'string') return null;
        try {
            const data = await this._getEncrypted('liberty_invite_' + code.trim());
            return data && typeof data === 'object' ? data : null;
        } catch {
            return null;
        }
    }

    getInviteLink(server) {
        if (!server || !server.inviteCode) return '';
        const base = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : 'https://liberty.app';
        return base + '/#invite/' + server.inviteCode;
    }

    async showInviteLanding(code) {
        const landing = document.getElementById('invite-landing');
        const linkEl = document.getElementById('invite-landing-link');
        const cardEl = document.getElementById('invite-landing-card');
        const errEl = document.getElementById('invite-landing-error');
        const joinBtn = document.getElementById('invite-landing-join');
        const loginHint = document.getElementById('invite-landing-login-hint');
        if (!landing || !linkEl || !cardEl) return;

        landing.classList.remove('hidden');
        linkEl.href = '#';
        linkEl.textContent = '';
        cardEl.innerHTML = '';
        errEl.classList.add('hidden');
        if (joinBtn) joinBtn.classList.add('hidden');
        if (loginHint) loginHint.classList.add('hidden');

        const server = await this.getInviteServer(code);
        const url = server ? this.getInviteLink(server) : (window.location.origin || '') + '/#invite/' + code;
        linkEl.href = url;
        linkEl.textContent = url;
        linkEl.setAttribute('target', '_blank');
        linkEl.setAttribute('rel', 'noopener noreferrer');

        if (!server) {
            errEl.classList.remove('hidden');
            return;
        }

        cardEl.innerHTML = this.createInviteEmbedHTML(server, code);
        if (this.currentUser) {
            if (joinBtn) {
                joinBtn.classList.remove('hidden');
                joinBtn.onclick = () => {
                    this.joinServerByInvite(code);
                    landing.classList.add('hidden');
                    window.history.replaceState('', document.title, window.location.pathname + window.location.search || '');
                };
            }
            cardEl.querySelector('.btn-invite-join')?.addEventListener('click', () => {
                this.joinServerByInvite(code);
                landing.classList.add('hidden');
                window.history.replaceState('', document.title, window.location.pathname + window.location.search || '');
            });
        } else {
            if (loginHint) loginHint.classList.remove('hidden');
        }
    }

    generateInvite() {
        if (!this.currentServer || this.currentServer.id === this.LIBERTY_SERVER_ID) return;
        this.ensureServerInviteCode(this.currentServer);
        this.saveServers();
        const link = this.getInviteLink(this.currentServer);
        const input = document.getElementById('invite-link');
        if (input) input.value = link;
        const anchor = document.getElementById('invite-link-anchor');
        if (anchor) {
            anchor.href = link;
            anchor.textContent = link;
            anchor.setAttribute('target', '_blank');
        }
        const preview = document.getElementById('invite-modal-preview');
        if (preview) preview.innerHTML = this.createInviteEmbedHTML(this.currentServer, this.currentServer.inviteCode);
        this.renderInvites(this.currentServer.invites);
    }
    
    renderInvites(invites) {
        const list = document.getElementById('invite-list');
        if (!list || !invites) return;
        
        list.innerHTML = invites.map(i => `
            <div class="invite-item">
                <span>${i.code}</span>
                <small>${i.expires == 0 ? 'Nunca expira' : 'Expira em ' + Math.floor(i.expires / 3600) + 'h'}</small>
            </div>
        `).join('');
    }

    renderInvitesPanel() {
        const input = document.getElementById('invite-link-settings');
        const link = document.getElementById('invite-link');
        const anchor = document.getElementById('invite-link-settings-anchor');
        const preview = document.getElementById('invite-settings-preview');
        if (!this.currentServer || this.currentServer.id === this.LIBERTY_SERVER_ID) {
            if (input) input.value = '';
            if (input) input.placeholder = 'O servidor Liberty não usa convites.';
            if (anchor) { anchor.href = '#'; anchor.textContent = ''; anchor.classList.add('hidden'); }
            if (preview) preview.innerHTML = '';
            return;
        }
        this.ensureServerInviteCode(this.currentServer);
        const url = this.getInviteLink(this.currentServer);
        if (input) input.value = url;
        if (link) link.value = url;
        if (anchor) {
            anchor.href = url;
            anchor.textContent = url;
            anchor.classList.remove('hidden');
        }
        if (preview) preview.innerHTML = this.createInviteEmbedHTML(this.currentServer, this.currentServer.inviteCode);
    }
    
    // Emojis
    loadEmojis(cat) {
        const grid = document.getElementById('emoji-grid');
        const emojis = this.emojis[cat] || [];
        
        grid.innerHTML = emojis.map(e => `
            <span class="emoji" data-emoji="${e}">${e}</span>
        `).join('');
        
        grid.querySelectorAll('.emoji').forEach(emoji => {
            emoji.addEventListener('click', () => {
                const input = document.getElementById('message-input');
                input.value += emoji.dataset.emoji;
                input.focus();
                document.getElementById('emoji-picker').classList.add('hidden');
            });
        });
    }
    
    searchEmojis(query) {
        const grid = document.getElementById('emoji-grid');
        const all = Object.values(this.emojis).flat();
        const filtered = all.filter(e => !query || query === '');
        
        grid.innerHTML = all.slice(0, 20).map(e => `
            <span class="emoji" data-emoji="${e}">${e}</span>
        `).join('');
    }
    
    // Context Menu
    showContextMenu(e, userId) {
        e.preventDefault();
        const menu = document.getElementById('context-menu');
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.add('active');
        menu.dataset.userId = userId;
    }
    
    handleContextAction(action) {
        const userId = document.getElementById('context-menu').dataset.userId;
        this.toast(`Ação: ${action}`);
    }
    
    // Search — canais, conversas e mensagens
    closeSearchPanel() {
        const panel = document.getElementById('search-results-panel');
        if (panel) {
            panel.classList.remove('is-open');
            panel.setAttribute('aria-hidden', 'true');
        }
    }
    
    getServerAndChannelByChannelId(channelId) {
        if (!channelId || !Array.isArray(this.servers)) return null;
        for (const server of this.servers) {
            const channel = (server.channels || []).find(c => c && c.id === channelId);
            if (channel) return { server, channel };
        }
        return null;
    }
    
    getFriendByConversationId(conversationId) {
        if (!conversationId || !this.currentUser?.id || !Array.isArray(this.friends)) return null;
        const parts = String(conversationId).split('_');
        if (parts.length !== 2) return null;
        const otherId = parts[0] === this.currentUser.id ? parts[1] : parts[0];
        return this.friends.find(f => f && f.id === otherId) || null;
    }
    
    runSearch(query) {
        const q = (query || '').trim().toLowerCase();
        const panel = document.getElementById('search-results-panel');
        const inner = document.getElementById('search-results-inner');
        if (!panel || !inner) return;
        
        if (!q) {
            panel.classList.remove('is-open');
            panel.setAttribute('aria-hidden', 'true');
            return;
        }
        
        const channels = [];
        const dms = [];
        const messageResults = [];
        const maxMessages = 25;
        
        // Canais (todos os servidores)
        if (Array.isArray(this.servers)) {
            for (const server of this.servers) {
                if (!server || !server.channels) continue;
                for (const ch of server.channels) {
                    if (ch && (ch.name || '').toLowerCase().includes(q)) {
                        channels.push({ server, channel: ch });
                    }
                }
            }
        }
        
        // Conversas DM (amigos)
        if (Array.isArray(this.friends)) {
            for (const f of this.friends) {
                if (f && (f.username || '').toLowerCase().includes(q)) {
                    dms.push(f);
                }
            }
        }
        
        // Mensagens em canais
        if (this.messages && typeof this.messages === 'object') {
            for (const channelId of Object.keys(this.messages)) {
                const pair = this.getServerAndChannelByChannelId(channelId);
                const list = this.messages[channelId];
                if (!Array.isArray(list) || !pair) continue;
                for (const m of list) {
                    if (messageResults.length >= maxMessages) break;
                    const textMatch = (m.text && String(m.text).toLowerCase().includes(q));
                    const authorMatch = (m.author && String(m.author).toLowerCase().includes(q));
                    if (textMatch || authorMatch) {
                        messageResults.push({
                            type: 'channel',
                            server: pair.server,
                            channel: pair.channel,
                            msg: m
                        });
                    }
                }
            }
        }
        
        // Mensagens em DMs
        if (this.dmMessages && typeof this.dmMessages === 'object') {
            for (const conversationId of Object.keys(this.dmMessages)) {
                const friend = this.getFriendByConversationId(conversationId);
                const list = this.dmMessages[conversationId];
                if (!Array.isArray(list) || !friend) continue;
                for (const m of list) {
                    if (messageResults.length >= maxMessages) break;
                    const textMatch = (m.text && String(m.text).toLowerCase().includes(q));
                    const authorMatch = (m.author && String(m.author).toLowerCase().includes(q));
                    if (textMatch || authorMatch) {
                        messageResults.push({
                            type: 'dm',
                            friend,
                            conversationId,
                            msg: m
                        });
                    }
                }
            }
        }
        
        this.renderSearchResults({ channels, dms, messageResults, query: q });
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
    }
    
    renderSearchResults({ channels, dms, messageResults, query }) {
        const inner = document.getElementById('search-results-inner');
        if (!inner) return;
        
        const total = channels.length + dms.length + messageResults.length;
        if (total === 0) {
            inner.innerHTML = `<div class="search-results-empty"><i class="fas fa-search"></i> Nenhum resultado para "${this.escape(query)}"</div>`;
            return;
        }
        
        const escape = (s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
        const snippet = (text, len = 60) => {
            if (!text) return '';
            const t = String(text).trim();
            const idx = t.toLowerCase().indexOf(query);
            if (idx === -1) return escape(t.slice(0, len)) + (t.length > len ? '…' : '');
            const start = Math.max(0, idx - 15);
            const end = Math.min(t.length, idx + query.length + 45);
            return escape(t.slice(start, end)) + (end < t.length ? '…' : '');
        };
        
        let html = '';
        
        if (channels.length > 0) {
            html += '<div class="search-results-section"><div class="search-results-section-title"><i class="fas fa-hashtag"></i> Canais</div>';
            channels.slice(0, 15).forEach(({ server, channel }) => {
                const serverName = escape(server.name || 'Servidor');
                const channelName = escape(channel.name || '');
                html += `<button type="button" class="search-result-item" data-action="channel" data-server-id="${escape(server.id)}" data-channel-id="${escape(channel.id)}">
                    <i class="fas fa-hashtag"></i>
                    <div class="search-result-primary"><strong>#${channelName}</strong></div>
                    <div class="search-result-secondary">${serverName}</div>
                </button>`;
            });
            html += '</div>';
        }
        
        if (dms.length > 0) {
            html += '<div class="search-results-section"><div class="search-results-section-title"><i class="fas fa-at"></i> Conversas</div>';
            dms.slice(0, 15).forEach((f) => {
                const name = escape(f.username || '');
                html += `<button type="button" class="search-result-item" data-action="dm" data-friend-id="${escape(f.id)}">
                    <i class="fas fa-at"></i>
                    <div class="search-result-primary"><strong>${name}</strong></div>
                </button>`;
            });
            html += '</div>';
        }
        
        if (messageResults.length > 0) {
            html += '<div class="search-results-section"><div class="search-results-section-title"><i class="fas fa-comment"></i> Mensagens</div>';
            messageResults.slice(0, 25).forEach((r) => {
                const author = escape(r.msg.author || '');
                const msgSnippet = snippet(r.msg.text || '', 70);
                if (r.type === 'channel') {
                    const serverName = escape(r.server.name || '');
                    const channelName = escape(r.channel.name || '');
                    html += `<button type="button" class="search-result-item search-result-msg-item" data-action="message-channel" data-server-id="${escape(r.server.id)}" data-channel-id="${escape(r.channel.id)}" data-msg-id="${escape(r.msg.id)}">
                        <i class="fas fa-hashtag"></i>
                        <div class="search-result-primary">
                            <strong>${author}</strong> <span class="search-result-secondary">em #${channelName} · ${escape(serverName)}</span>
                            <div class="search-result-msg">${msgSnippet}</div>
                        </div>
                    </button>`;
                } else {
                    const dmName = escape(r.friend.username || '');
                    html += `<button type="button" class="search-result-item search-result-msg-item" data-action="message-dm" data-friend-id="${escape(r.friend.id)}" data-msg-id="${escape(r.msg.id)}">
                        <i class="fas fa-at"></i>
                        <div class="search-result-primary">
                            <strong>${author}</strong> <span class="search-result-secondary">com ${dmName}</span>
                            <div class="search-result-msg">${msgSnippet}</div>
                        </div>
                    </button>`;
                }
            });
            html += '</div>';
        }
        
        inner.innerHTML = html;
        inner.querySelectorAll('.search-result-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSearchResultClick(btn);
            });
        });
    }
    
    handleSearchResultClick(btn) {
        const action = btn.dataset.action;
        this.closeSearchPanel();
        document.getElementById('search-input').value = '';
        
        if (action === 'channel') {
            const serverId = btn.dataset.serverId;
            const channelId = btn.dataset.channelId;
            if (this.currentServer?.id !== serverId) this.selectServer(serverId);
            this.selectChannel(channelId);
            return;
        }
        
        if (action === 'dm') {
            const friendId = btn.dataset.friendId;
            this.goHome();
            setTimeout(() => this.openDM(friendId), 50);
            return;
        }
        
        if (action === 'message-channel') {
            const serverId = btn.dataset.serverId;
            const channelId = btn.dataset.channelId;
            const msgId = btn.dataset.msgId;
            if (this.currentServer?.id !== serverId) this.selectServer(serverId);
            this.selectChannel(channelId);
            if (msgId) this.scrollToMessageId(msgId);
            return;
        }
        
        if (action === 'message-dm') {
            const friendId = btn.dataset.friendId;
            const msgId = btn.dataset.msgId;
            this.goHome();
            setTimeout(() => {
                this.openDM(friendId);
                if (msgId) this.scrollToMessageId(msgId);
            }, 100);
        }
    }
    
    scrollToMessageId(msgId) {
        const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(msgId) : msgId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const scroll = () => {
            const el = document.querySelector(`.message[data-msg-id="${safeId}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('search-highlight');
                setTimeout(() => el.classList.remove('search-highlight'), 2000);
            }
        };
        setTimeout(scroll, 300);
        setTimeout(scroll, 800);
    }
    
    search(query) {
        this.runSearch(query);
    }
    
    // Settings
    openSettingsModal(scope) {
        if (scope === 'server' && this.currentServer?.id === this.LIBERTY_SERVER_ID) {
            this.toast('O servidor Liberty não possui dono e não pode ser configurado.');
            return;
        }
        const container = document.getElementById('settings-container');
        if (container) {
            container.classList.remove('settings-scope-player', 'settings-scope-server');
            container.classList.add(scope === 'server' ? 'settings-scope-server' : 'settings-scope-player');
        }
        this.openModal('modal-settings');
        this.switchPanel(scope === 'server' ? 'roles' : 'account');
    }
    
    switchPanel(panel) {
        document.querySelectorAll('.settings-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.settings-item[data-panel="${panel}"]`)?.classList.add('active');
        
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${panel}`)?.classList.add('active');
        
        if (panel === 'auth') this.loadAuthSettings();
        if (panel === 'roles') {
            if (this.currentServer) {
                if (!this.currentServer.roles || !this.currentServer.roles.length) {
                    this.currentServer.roles = JSON.parse(JSON.stringify(this.roles));
                    this.saveServers();
                }
                this.roles = this.currentServer.roles;
                this.renderRoles(this.roles);
            }
            this.updateAddRoleButtonVisibility();
        }
        if (panel === 'channels') this.renderChannelsSettingsPanel();
        if (panel === 'invites') this.renderInvitesPanel();
        if (panel === 'appearance') this.updateAppearanceBackgroundPreview();
        if (panel === 'profile') this.syncProfileColorUI();
    }
    
    setTheme(theme) {
        document.body.dataset.theme = theme;
        this.settings.theme = theme;
        this.saveSettings();
        this.toast('Tema alterado!');
    }
    
    setAccentColor(color) {
        document.documentElement.style.setProperty('--yellow', color);
        document.documentElement.style.setProperty('--yellow-glow', color + '33');
        document.documentElement.style.setProperty('--yellow-soft', color + '1a');
        this.settings.accent = color;
        this.saveSettings();
        this.toast('Cor alterada!');
    }
    
    loadSettings() {
        const s = localStorage.getItem('liberty_settings');
        const defaults = {
            theme: 'dark',
            accent: '#FFFF00',
            backgroundUrl: '',
            backgroundGradient: null
        };
        if (!s) return defaults;
        try {
            if (window.LibertyCrypto && LibertyCrypto.looksEncrypted(s)) return defaults;
            const parsed = JSON.parse(s);
            return { ...defaults, ...parsed };
        } catch { return defaults; }
    }
    
    async saveSettings() {
        await this._setEncrypted('liberty_settings', this.settings);
    }
    
    applySettings() {
        document.body.dataset.theme = this.settings.theme || 'dark';
        if (this.settings.accent) {
            document.documentElement.style.setProperty('--yellow', this.settings.accent);
            document.documentElement.style.setProperty('--yellow-glow', this.settings.accent + '33');
            document.documentElement.style.setProperty('--yellow-soft', this.settings.accent + '1a');
        }
        const app = document.getElementById('app');
        const layer = document.getElementById('app-bg-layer');
        if (app && layer) {
            const grad = this.settings.backgroundGradient;
            const url = this.settings.backgroundUrl || '';
            if (grad && grad.color1 && grad.color2) {
                const angle = grad.angle != null ? grad.angle : 135;
                layer.style.background = `linear-gradient(${angle}deg, ${grad.color1}, ${grad.color2})`;
                layer.style.backgroundImage = '';
                app.classList.add('app-has-custom-bg');
            } else if (url) {
                layer.style.background = '';
                layer.style.backgroundImage = `url(${url})`;
                app.classList.add('app-has-custom-bg');
            } else {
                layer.style.background = '';
                layer.style.backgroundImage = '';
                app.classList.remove('app-has-custom-bg');
            }
        }
        this.updateAppearanceBackgroundPreview();
    }

    updateAppearanceBackgroundPreview() {
        const el = document.getElementById('appearance-bg-preview');
        if (!el) return;
        const url = this.settings.backgroundUrl || '';
        const grad = this.settings.backgroundGradient;
        el.classList.remove('has-image', 'has-gradient');
        if (grad && grad.color1 && grad.color2) {
            const angle = grad.angle != null ? grad.angle : 135;
            el.style.background = `linear-gradient(${angle}deg, ${grad.color1}, ${grad.color2})`;
            el.style.backgroundImage = '';
            el.classList.add('has-gradient');
        } else if (url) {
            el.style.background = '';
            el.style.backgroundImage = `url(${url})`;
            el.classList.add('has-image');
        } else {
            el.style.background = '';
            el.style.backgroundImage = '';
        }
        const box = document.getElementById('appearance-bg-gradient-box');
        if (box) box.classList.toggle('hidden', !(grad && grad.color1 && grad.color2));
        const c1 = document.getElementById('appearance-gradient-color1');
        const c2 = document.getElementById('appearance-gradient-color2');
        const ang = document.getElementById('appearance-gradient-angle');
        if (c1 && grad?.color1) c1.value = grad.color1;
        if (c2 && grad?.color2) c2.value = grad.color2;
        if (ang && grad?.angle != null) ang.value = String(grad.angle);
    }
    
    loadAuthSettings() {
        if (!this.currentUser || !this.currentUser.auth_methods) return;
        const a = this.currentUser.auth_methods;
        const set = (id, checked) => { const el = document.getElementById(id); if (el) el.checked = !!checked; };
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        const setCfg = (cls, visible) => { const el = document.querySelector(cls); if (el) el.classList.toggle('visible', !!visible); };
        set('auth-password-enabled', a.password.enabled);
        set('auth-pin-enabled', a.pin.enabled);
        set('auth-windows-hello-enabled', a.windows_hello.enabled);
        set('auth-yubikey-enabled', a.yubikey.enabled);
        set('auth-mac-enabled', a.mac_address.enabled);
        set('auth-ip-enabled', a.ip.enabled);
        set('auth-hwid-enabled', a.hardware_uuid.enabled);
        set('auth-phone-enabled', a.phone_verification?.enabled);
        set('auth-email-verification-enabled', a.email_verification?.enabled);
        setCfg('.auth-password-config', a.password.enabled);
        setCfg('.auth-pin-config', a.pin.enabled);
        setCfg('.auth-windows-hello-config', a.windows_hello.enabled);
        setCfg('.auth-yubikey-config', a.yubikey.enabled);
        setCfg('.auth-mac-config', a.mac_address.enabled);
        setCfg('.auth-ip-config', a.ip.enabled);
        setCfg('.auth-hwid-config', a.hardware_uuid.enabled);
        setCfg('.auth-phone-config', a.phone_verification?.enabled);
        setCfg('.auth-email-verification-config', a.email_verification?.enabled);
        setVal('auth-mac-value', a.mac_address.value);
        setVal('auth-ip-value', a.ip.value);
        setVal('auth-hwid-value', a.hardware_uuid.value || this.currentUser.hwid);
        setVal('auth-phone-value', a.phone_verification?.phone);
        setVal('auth-email-value', this.currentUser.email || a.email_verification?.email);
        if (!a.ip.value) {
            this.getCurrentIP().then(ip => {
                const el = document.getElementById('auth-ip-value');
                if (el && !el.value) el.placeholder = `IP atual: ${ip}`;
            });
        }
        if (!a.mac_address.value) {
            this.getDeviceFingerprint().then(fp => {
                const el = document.getElementById('auth-mac-value');
                if (el && !el.value) el.placeholder = `ID do dispositivo: ${fp.slice(0, 12)}...`;
            });
        }
    }
    
    async hashString(str) {
        const enc = new TextEncoder();
        const data = await crypto.subtle.digest('SHA-256', enc.encode(str));
        return Array.from(new Uint8Array(data)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    async getDeviceFingerprint() {
        const parts = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset()
        ].join('|');
        return await this.hashString(parts);
    }
    
    async getCurrentIP() {
        try {
            const r = await fetch('https://api.ipify.org?format=json');
            const j = await r.json();
            return j.ip || 'Desconhecido';
        } catch {
            return 'Desconhecido';
        }
    }
    
    showVerificationModal(method) {
        const config = {
            password: { title: 'Verificação por Senha', subtitle: 'Digite e confirme sua senha', icon: 'fa-key' },
            pin: { title: 'Verificação por PIN', subtitle: 'Digite e confirme seu PIN', icon: 'fa-th-large' },
            windows_hello: { title: 'Windows Hello', subtitle: 'Use o PIN do Windows para autenticar', icon: 'fa-brands fa-windows' },
            yubikey: { title: 'YubiKey', subtitle: 'Insira e toque na chave de segurança', icon: 'fa-usb-drive' },
            mac_address: { title: 'Endereço MAC', subtitle: 'Confirme o identificador do dispositivo', icon: 'fa-network-wired' },
            ip: { title: 'Endereço IP', subtitle: 'Confirme o IP do seu dispositivo', icon: 'fa-globe' },
            hardware_uuid: { title: 'Hardware UUID', subtitle: 'Confirme o UUID do hardware', icon: 'fa-fingerprint' },
            phone_verification: { title: 'Verificação por Telefone', subtitle: 'SMS ou chamada telefônica', icon: 'fa-mobile-alt' },
            email_verification: { title: 'Verificação por E-mail', subtitle: 'Digite o código enviado ao seu e-mail', icon: 'fa-envelope' }
        };
        if (method === 'email_verification') {
            const email = document.getElementById('auth-email-value')?.value?.trim() || this.currentUser?.email || '';
            if (!email) {
                this.toast('Digite seu e-mail na caixa "E-mail" acima e tente novamente.', 'error');
                return;
            }
        }
        if (method === 'phone_verification' && !this._loginPendingUser) {
            const phone = document.getElementById('auth-phone-value')?.value?.trim();
            if (!phone) {
                this.toast('Digite seu número de telefone na caixa acima e tente novamente.', 'error');
                return;
            }
        }
        const c = config[method] || config.password;
        this._verifyMethod = method;
        document.getElementById('verify-title').textContent = c.title;
        document.getElementById('verify-subtitle').textContent = c.subtitle;
        document.getElementById('verify-icon').innerHTML = c.icon.startsWith('fa-brands')
            ? `<i class="${c.icon}"></i>` : `<i class="fas ${c.icon}"></i>`;
        document.getElementById('verify-status').classList.remove('visible', 'success');
        document.getElementById('verify-error').classList.remove('visible');
        document.querySelectorAll('.verify-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(`verify-panel-${method}`);
        if (panel) panel.classList.add('active');
        const isLogin = this._loginPendingUser;
        if (method === 'password') {
            const confirmEl = document.getElementById('verify-password-confirm');
            if (confirmEl) confirmEl.style.display = isLogin ? 'none' : 'block';
        }
        if (method === 'pin') {
            const confirmEl = document.getElementById('verify-pin-confirm');
            if (confirmEl) confirmEl.style.display = isLogin ? 'none' : 'block';
        }
        if (['mac_address', 'ip', 'hardware_uuid'].includes(method)) this.prefillVerifyDevice(method);
        const deviceBtnId = method === 'mac_address' ? 'verify-mac-btn' : method === 'ip' ? 'verify-ip-btn' : method === 'hardware_uuid' ? 'verify-hwid-btn' : null;
        if (deviceBtnId) {
            const deviceBtn = document.getElementById(deviceBtnId);
            if (deviceBtn) deviceBtn.textContent = isLogin ? 'Verificar e entrar' : 'Confirmar e vincular';
        }
        if (method === 'phone_verification') {
            const opts = document.querySelector('.verify-phone-options');
            const codeEl = document.getElementById('verify-phone-code');
            const btnEl = document.getElementById('verify-phone-btn');
            if (isLogin) {
                if (opts) opts.style.display = 'none';
                if (codeEl) codeEl.style.display = 'block';
                if (btnEl) btnEl.style.display = 'block';
            } else {
                if (opts) opts.style.display = 'flex';
                if (codeEl) codeEl.style.display = 'none';
                if (btnEl) btnEl.style.display = 'none';
            }
        }
        if (method === 'email_verification') {
            document.getElementById('verify-email-code').value = '';
            const email = document.getElementById('auth-email-value')?.value?.trim() || this.currentUser?.email;
            if (email) {
                this._pendingEmailCode = String(Math.floor(100000 + Math.random() * 900000));
                this.toast(`Código enviado: ${this._pendingEmailCode} (demonstração)`);
            }
        }
        if (method === 'phone_verification' && isLogin) {
            this._pendingPhoneCode = String(Math.floor(100000 + Math.random() * 900000));
            this.toast(`Código enviado: ${this._pendingPhoneCode} (demonstração)`);
        }
        document.getElementById('verify-password-input').value = '';
        document.getElementById('verify-password-confirm').value = '';
        document.getElementById('verify-pin-input').value = '';
        document.getElementById('verify-pin-confirm').value = '';
        this.applyTranslations();
        this.openModal('modal-verify');
    }
    
    setVerifyStatus(msg, success = false) {
        const el = document.getElementById('verify-status');
        const safe = (msg != null && typeof msg === 'string') ? this.escape(msg) : '';
        el.innerHTML = success ? `<i class="fas fa-check-circle"></i><span>${safe}</span>` : `<i class="fas fa-spinner fa-spin"></i><span>${safe}</span>`;
        el.classList.add('visible');
        if (success) el.classList.add('success');
        else el.classList.remove('success');
    }
    
    setVerifyError(msg) {
        document.getElementById('verify-status').classList.remove('visible');
        const el = document.getElementById('verify-error');
        el.textContent = msg;
        el.classList.add('visible');
    }
    
    clearVerifyFeedback() {
        document.getElementById('verify-status').classList.remove('visible', 'success');
        document.getElementById('verify-error').classList.remove('visible');
    }
    
    async prefillVerifyDevice(method) {
        const inputId = method === 'mac_address' ? 'verify-mac-value' : method === 'ip' ? 'verify-ip-value' : 'verify-hwid-value';
        const el = document.getElementById(inputId);
        if (method === 'ip') {
            this.setVerifyStatus('Obtendo seu IP...');
            const ip = await this.getCurrentIP();
            el.value = ip;
        } else {
            this.setVerifyStatus('Obtendo identificador do dispositivo...');
            const fp = await this.getDeviceFingerprint();
            el.value = method === 'hardware_uuid' ? 'device-' + fp.slice(0, 16) : fp;
        }
        this.clearVerifyFeedback();
    }
    
    async verifyPassword() {
        if (window.LIBERTY_SECURITY && !LIBERTY_SECURITY.checkRateLimit()) {
            const min = Math.ceil(LIBERTY_SECURITY.getRemainingLockMs() / 60000);
            this.setVerifyError(`Muitas tentativas. Aguarde ${min} minuto(s).`);
            return;
        }
        const pwd = document.getElementById('verify-password-input').value;
        const conf = document.getElementById('verify-password-confirm').value;
        this.clearVerifyFeedback();
        if (!pwd) {
            this.setVerifyError('Digite uma senha.');
            return;
        }
        const isLogin = this._loginPendingUser;
        if (!isLogin && pwd !== conf) {
            this.setVerifyError('As senhas não conferem. Tente novamente.');
            return;
        }
        this.setVerifyStatus('Verificando...');
        try {
            if (isLogin) {
                let valid = false;
                if (this.currentUser.password_salt && this.currentUser.password_hash && window.LibertyCrypto?.verifyPasswordWithSalt) {
                    valid = await LibertyCrypto.verifyPasswordWithSalt(pwd, this.currentUser.password_salt, this.currentUser.password_hash);
                } else {
                    const hash = window.LibertyCrypto ? await LibertyCrypto.hashPassword(pwd) : await this.hashString(pwd);
                    const storedHash = this.currentUser.password_hash || null;
                    valid = storedHash && window.LIBERTY_SECURITY ? LIBERTY_SECURITY.secureCompare(hash, storedHash) : (hash === storedHash);
                }
                if (!valid) {
                    this.setVerifyError('Senha incorreta. Tente novamente.');
                    return;
                }
                if (window.LIBERTY_SECURITY) LIBERTY_SECURITY.resetRateLimit();
                this.setVerifyStatus('Autenticação bem-sucedida!', true);
                setTimeout(() => this.completeLogin(), 1200);
            } else {
                if (window.LibertyCrypto?.hashPasswordWithSalt) {
                    const { salt, hash } = await LibertyCrypto.hashPasswordWithSalt(pwd);
                    this.currentUser.password_salt = salt;
                    this.currentUser.password_hash = hash;
                } else {
                    this.currentUser.password_hash = window.LibertyCrypto ? await LibertyCrypto.hashPassword(pwd) : await this.hashString(pwd);
                }
                delete this.currentUser.password;
                this.currentUser.auth_methods.password.configured = true;
                this.currentUser.auth_methods.password.enabled = true;
                await this.saveUser();
                if (window.LIBERTY_SECURITY) LIBERTY_SECURITY.resetRateLimit();
                this.setVerifyStatus('Autenticação bem-sucedida!', true);
                document.getElementById('auth-password').value = '';
                document.getElementById('auth-password-confirm').value = '';
                document.getElementById('auth-password-enabled').checked = true;
                this.loadAuthSettings();
                setTimeout(() => {
                    this.closeModal('modal-verify');
                    this.toast('Senha configurada!');
                }, 1200);
            }
        } catch (e) {
            this.setVerifyError('Erro ao salvar. Tente novamente.');
        }
    }
    
    async verifyPin() {
        if (window.LIBERTY_SECURITY && !LIBERTY_SECURITY.checkRateLimit()) {
            const min = Math.ceil(LIBERTY_SECURITY.getRemainingLockMs() / 60000);
            this.setVerifyError(`Muitas tentativas. Aguarde ${min} minuto(s).`);
            return;
        }
        const pin = document.getElementById('verify-pin-input').value.replace(/\D/g, '');
        const conf = document.getElementById('verify-pin-confirm').value.replace(/\D/g, '');
        this.clearVerifyFeedback();
        if (pin.length < 4 || pin.length > 8) {
            this.setVerifyError('O PIN deve ter entre 4 e 8 dígitos.');
            return;
        }
        const isLogin = this._loginPendingUser;
        if (!isLogin && pin !== conf) {
            this.setVerifyError('Os PINs não conferem. Tente novamente.');
            return;
        }
        this.setVerifyStatus('Verificando...');
        try {
            if (isLogin) {
                const hash = await this.hashString(pin);
                const match = window.LIBERTY_SECURITY ? LIBERTY_SECURITY.secureCompare(hash, this.currentUser.pin_hash) : (hash === this.currentUser.pin_hash);
                if (!match) {
                    this.setVerifyError('PIN incorreto. Tente novamente.');
                    return;
                }
                if (window.LIBERTY_SECURITY) LIBERTY_SECURITY.resetRateLimit();
                this.setVerifyStatus('Autenticação bem-sucedida!', true);
                setTimeout(() => this.completeLogin(), 1200);
            } else {
                this.currentUser.pin_hash = await this.hashString(pin);
                this.currentUser.auth_methods.pin.configured = true;
                this.currentUser.auth_methods.pin.enabled = true;
                await this.saveUser();
                if (window.LIBERTY_SECURITY) LIBERTY_SECURITY.resetRateLimit();
                this.setVerifyStatus('Autenticação bem-sucedida!', true);
                document.getElementById('auth-pin').value = '';
                document.getElementById('auth-pin-confirm').value = '';
                document.getElementById('auth-pin-enabled').checked = true;
                this.loadAuthSettings();
                setTimeout(() => {
                    this.closeModal('modal-verify');
                    this.toast('PIN configurado!');
                }, 1200);
            }
        } catch (e) {
            this.setVerifyError('Erro ao salvar. Tente novamente.');
        }
    }
    
    async verifyWebAuthn(authenticatorType) {
        this.clearVerifyFeedback();
        this.setVerifyStatus('Aguardando autenticação...');
        const isLogin = this._loginPendingUser;
        try {
            if (isLogin) {
                await this.verifyWebAuthnGet(authenticatorType);
                this.setVerifyStatus('Autenticação bem-sucedida!', true);
                setTimeout(() => this.completeLogin(), 1200);
            } else {
                await this.setupWebAuthn(authenticatorType);
                this.setVerifyStatus('Autenticação bem-sucedida!', true);
                this.loadAuthSettings();
                setTimeout(() => {
                    this.closeModal('modal-verify');
                    this.toast(authenticatorType === 'platform' ? 'Windows Hello configurado!' : 'YubiKey registrada!');
                }, 1200);
            }
        } catch (e) {
            this.setVerifyError(e.message || 'Falha na autenticação. Verifique se o dispositivo está disponível e tente novamente.');
        }
    }
    
    async verifyWebAuthnGet(authenticatorType) {
        if (!window.PublicKeyCredential) throw new Error('WebAuthn não suportado.');
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const opts = {
            challenge,
            timeout: 60000,
            userVerification: 'required'
        };
        const cred = await navigator.credentials.get({ publicKey: opts });
        if (!cred) throw new Error('Autenticação cancelada.');
    }
    
    async verifyDevice(method) {
        this.clearVerifyFeedback();
        const inputId = method === 'mac_address' ? 'verify-mac-value' : method === 'ip' ? 'verify-ip-value' : 'verify-hwid-value';
        const value = document.getElementById(inputId)?.value?.trim();
        if (!value || value === 'Carregando...') {
            this.setVerifyError('Aguarde o carregamento do identificador.');
            return;
        }
        const isLogin = this._loginPendingUser;
        if (isLogin) {
            const stored = method === 'hardware_uuid' ? (this.currentUser.hwid || this.currentUser.auth_methods?.hardware_uuid?.value)
                : this.currentUser.auth_methods?.[method]?.value;
            if (value !== stored) {
                this.setVerifyError('Dispositivo não reconhecido. Use outro método de autenticação.');
                return;
            }
            this.setVerifyStatus('Autenticação bem-sucedida!', true);
            setTimeout(() => this.completeLogin(), 1200);
            return;
        }
        this.setVerifyStatus('Vinculando dispositivo...');
        try {
            if (method === 'hardware_uuid') {
                this.currentUser.hwid = value;
                this.currentUser.auth_methods.hardware_uuid.value = value;
            } else if (method === 'mac_address') {
                this.currentUser.auth_methods.mac_address.value = value;
            } else {
                this.currentUser.auth_methods.ip.value = value;
            }
            this.currentUser.auth_methods[method].enabled = true;
            this.currentUser.auth_methods[method].configured = true;
            await this.saveUser();
            this.setVerifyStatus('Dispositivo vinculado com sucesso!', true);
            const fieldId = method === 'mac_address' ? 'auth-mac-value' : method === 'ip' ? 'auth-ip-value' : 'auth-hwid-value';
            document.getElementById(fieldId).value = value;
            this.loadAuthSettings();
            setTimeout(() => {
                this.closeModal('modal-verify');
                this.toast('Dispositivo vinculado!');
            }, 1200);
        } catch (e) {
            this.setVerifyError('Erro ao vincular. Tente novamente.');
        }
    }
    
    async verifyPhoneRequest(type) {
        this.clearVerifyFeedback();
        const phone = document.getElementById('auth-phone-value')?.value?.trim();
        if (!phone) {
            this.setVerifyError('Digite seu número de telefone nas configurações antes de continuar.');
            return;
        }
        this.setVerifyStatus(type === 'sms' ? 'Enviando código por SMS...' : 'Iniciando chamada...');
        this._pendingPhoneCode = String(Math.floor(100000 + Math.random() * 900000));
        await new Promise(r => setTimeout(r, 1500));
        this.clearVerifyFeedback();
        const optsEl = document.querySelector('.verify-phone-options');
        const codeEl = document.getElementById('verify-phone-code');
        const btnEl = document.getElementById('verify-phone-btn');
        if (optsEl) optsEl.style.display = 'none';
        if (codeEl) { codeEl.style.display = 'block'; codeEl.value = ''; }
        if (btnEl) btnEl.style.display = 'block';
        this.toast(`Código de demonstração: ${this._pendingPhoneCode}`);
    }
    
    async verifyPhoneCode() {
        if (window.LIBERTY_SECURITY && !LIBERTY_SECURITY.checkRateLimit()) {
            const min = Math.ceil(LIBERTY_SECURITY.getRemainingLockMs() / 60000);
            this.setVerifyError(`Muitas tentativas. Aguarde ${min} minuto(s).`);
            return;
        }
        this.clearVerifyFeedback();
        const code = document.getElementById('verify-phone-code')?.value?.trim();
        if (!code) {
            this.setVerifyError('Digite o código recebido.');
            return;
        }
        const match = window.LIBERTY_SECURITY ? LIBERTY_SECURITY.secureCompare(code, this._pendingPhoneCode) : (code === this._pendingPhoneCode);
        if (!match) {
            this.setVerifyError('Código incorreto. Verifique e tente novamente.');
            return;
        }
        if (window.LIBERTY_SECURITY) LIBERTY_SECURITY.resetRateLimit();
        this.setVerifyStatus('Autenticação bem-sucedida!', true);
        if (this._loginPendingUser) {
            setTimeout(() => this.completeLogin(), 1200);
        } else {
            this.currentUser.auth_methods.phone_verification.enabled = true;
            this.currentUser.auth_methods.phone_verification.configured = true;
            this.currentUser.auth_methods.phone_verification.phone = document.getElementById('auth-phone-value')?.value?.trim();
            await this.saveUser();
            this.loadAuthSettings();
            setTimeout(() => {
                this.closeModal('modal-verify');
                this.toast('Verificação por telefone configurada!');
            }, 1200);
        }
    }
    
    async verifyEmailCode() {
        if (window.LIBERTY_SECURITY && !LIBERTY_SECURITY.checkRateLimit()) {
            const min = Math.ceil(LIBERTY_SECURITY.getRemainingLockMs() / 60000);
            this.setVerifyError(`Muitas tentativas. Aguarde ${min} minuto(s).`);
            return;
        }
        this.clearVerifyFeedback();
        const code = document.getElementById('verify-email-code')?.value?.trim();
        if (!code) {
            this.setVerifyError('Digite o código recebido por e-mail.');
            return;
        }
        const match = window.LIBERTY_SECURITY ? LIBERTY_SECURITY.secureCompare(code, this._pendingEmailCode) : (code === this._pendingEmailCode);
        if (!match) {
            this.setVerifyError('Código incorreto. Verifique seu e-mail e tente novamente.');
            return;
        }
        if (window.LIBERTY_SECURITY) LIBERTY_SECURITY.resetRateLimit();
        this.setVerifyStatus('Autenticação bem-sucedida!', true);
        if (this._loginPendingUser) {
            setTimeout(() => this.completeLogin(), 1200);
        } else {
            this.currentUser.auth_methods.email_verification.enabled = true;
            this.currentUser.auth_methods.email_verification.configured = true;
            this.currentUser.email = document.getElementById('auth-email-value')?.value?.trim() || this.currentUser.email;
            await this.saveUser();
            this.loadAuthSettings();
            setTimeout(() => {
                this.closeModal('modal-verify');
                this.toast('Verificação por e-mail configurada!');
            }, 1200);
        }
    }
    
    async verifyEmailResend() {
        this.clearVerifyFeedback();
        const email = document.getElementById('auth-email-value')?.value?.trim();
        if (!email) {
            this.setVerifyError('Configure seu e-mail nas configurações antes de continuar.');
            return;
        }
        this.setVerifyStatus('Reenviando código...');
        this._pendingEmailCode = String(Math.floor(100000 + Math.random() * 900000));
        await new Promise(r => setTimeout(r, 1200));
        this.clearVerifyFeedback();
        this.toast(`Código de demonstração: ${this._pendingEmailCode}`);
    }
    
    async setupWebAuthn(authenticatorType) {
        if (!window.PublicKeyCredential) {
            throw new Error('WebAuthn não suportado neste navegador.');
        }
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const opts = {
            challenge,
            rp: { name: 'Liberty' },
            user: {
                id: new TextEncoder().encode(this.currentUser.id),
                name: this.currentUser.username,
                displayName: this.currentUser.username
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: {
                authenticatorAttachment: authenticatorType === 'platform' ? 'platform' : 'cross-platform',
                requireResidentKey: false,
                userVerification: 'preferred'
            }
        };
        const cred = await navigator.credentials.create({ publicKey: opts });
        if (!cred) {
            throw new Error('Autenticação cancelada.');
        }
        const method = authenticatorType === 'platform' ? 'windows_hello' : 'yubikey';
        this.currentUser.auth_methods[method].enabled = true;
        this.currentUser.auth_methods[method].configured = true;
        await this.saveUser();
    }
    
    async saveUser() {
        if (!this.currentUser) return;
        try {
            const toSave = { ...this.currentUser };
            delete toSave.avatar;
            delete toSave.password;
            if (window.LibertyDB) {
                const toDb = { ...toSave };
                delete toDb.password;
                await LibertyDB.saveUser(toDb);
            }
            const avatarData = typeof this.currentUser.avatar === 'string' && this.currentUser.avatar.startsWith('data:') ? this.currentUser.avatar : null;
            if (avatarData) {
                this.trimMessagesToFitStorage();
                try {
                    await this._setEncrypted('liberty_avatar_' + this.currentUser.id, avatarData);
                } catch (avErr) {
                    if (avErr && avErr.name === 'QuotaExceededError') {
                        const smaller = await this.compressAvatarDataUrl(avatarData, 64, 0.5);
                        if (smaller) {
                            try {
                                await this._setEncrypted('liberty_avatar_' + this.currentUser.id, smaller);
                                this.currentUser.avatar = smaller;
                            } catch (_) {}
                        }
                    }
                }
            }
            const userCopy = { ...this.currentUser };
            delete userCopy.avatar;
            delete userCopy.password;
            const users = this.getStoredUsers();
            users[this.currentUser.username] = userCopy;
            this._storedUsersCache = users;
            const toStore = JSON.stringify(toSave);
            const usersStr = JSON.stringify(users);
            if (window.LibertyCrypto) {
                const encryptedUser = await LibertyCrypto.encryptForStorage(toSave);
                const encryptedUsers = await LibertyCrypto.encryptForStorage(users);
                localStorage.setItem('liberty_user', encryptedUser);
                localStorage.setItem('liberty_users', encryptedUsers);
            } else {
                localStorage.setItem('liberty_user', toStore);
                localStorage.setItem('liberty_users', usersStr);
            }
        } catch (e) {
            if (e && e.name === 'QuotaExceededError') {
                this.trimMessagesToFitStorage();
                try {
                    const toSave = { ...this.currentUser };
                    delete toSave.avatar;
                    delete toSave.password;
                    const userCopy = { ...this.currentUser };
                    delete userCopy.avatar;
                    delete userCopy.password;
                    const users = this.getStoredUsers();
                    users[this.currentUser.username] = userCopy;
                    this._storedUsersCache = users;
                    if (window.LibertyCrypto) {
                        const encryptedUser = await LibertyCrypto.encryptForStorage(toSave);
                        const encryptedUsers = await LibertyCrypto.encryptForStorage(users);
                        localStorage.setItem('liberty_user', encryptedUser);
                        localStorage.setItem('liberty_users', encryptedUsers);
                    } else {
                        localStorage.setItem('liberty_user', JSON.stringify(toSave));
                        localStorage.setItem('liberty_users', JSON.stringify(users));
                    }
                } catch (_) {}
            } else {
                console.warn('saveUser failed:', e);
                this.toast('Não foi possível salvar; tente novamente.', 'error');
            }
        }
        this.updateUI();
    }

    async loadAvatarIntoUser(user) {
        if (!user || !user.id) return;
        try {
            const av = await this._getEncrypted('liberty_avatar_' + user.id);
            if (av && typeof av === 'string') user.avatar = av;
        } catch (_) {}
    }

    getDmConversationId(userId1, userId2) {
        if (!userId1 || !userId2) return '';
        const a = String(userId1);
        const b = String(userId2);
        return a < b ? a + '_' + b : b + '_' + a;
    }

    openDeleteAccountModal() {
        if (!this.currentUser) return;
        const modal = document.getElementById('modal-delete-account');
        const input = document.getElementById('delete-account-confirm-input');
        const errEl = document.getElementById('delete-account-error');
        if (!modal || !input) return;
        input.value = '';
        if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
        document.getElementById('delete-account-confirm-phrase').textContent = 'APAGAR MINHA CONTA';
        modal.classList.add('active');
        setTimeout(() => input.focus(), 100);
    }

    confirmDeleteMyAccount() {
        const input = document.getElementById('delete-account-confirm-input');
        const errEl = document.getElementById('delete-account-error');
        const phrase = 'APAGAR MINHA CONTA';
        if (!input || !this.currentUser) return;
        const typed = (input.value || '').trim();
        if (typed !== phrase) {
            if (errEl) {
                errEl.textContent = 'A frase digitada não confere. Digite exatamente: ' + phrase;
                errEl.classList.remove('hidden');
            }
            return;
        }
        if (errEl) errEl.classList.add('hidden');
        this.closeModals();
        this.deleteMyAccountOnly();
    }

    async deleteMyAccountOnly() {
        const user = this.currentUser;
        if (!user || !user.id) return;
        const username = user.username;
        const userId = user.id;
        try {
            if (window.LibertyAPI && LibertyAPI.isAvailable()) {
                try {
                    await LibertyAPI.deleteMyAccount(userId, username);
                } catch (_) {}
            }
            localStorage.removeItem('liberty_user');
            if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('liberty_session_key');
            const users = this.getStoredUsers();
            delete users[username];
            this._storedUsersCache = users;
            if (window.LibertyCrypto) {
                await this._setEncrypted('liberty_users', users);
            } else {
                localStorage.setItem('liberty_users', JSON.stringify(users));
            }
            let messages = await this._getEncrypted('liberty_messages').then(m => m && typeof m === 'object' ? m : {}).catch(() => ({}));
            for (const key of Object.keys(messages || {})) {
                const arr = (messages[key] || []).filter(m => (m.author || '') !== username);
                if (arr.length === 0) delete messages[key];
                else messages[key] = arr;
            }
            await this._setEncrypted('liberty_messages', messages).catch(() => {});
            let dmMessages = await this._getEncrypted('liberty_dm_messages').then(m => m && typeof m === 'object' ? m : {}).catch(() => ({}));
            for (const key of Object.keys(dmMessages || {})) {
                const arr = (dmMessages[key] || []).filter(m => (m.author || '') !== username);
                if (arr.length === 0) delete dmMessages[key];
                else dmMessages[key] = arr;
            }
            await this._setEncrypted('liberty_dm_messages', dmMessages).catch(() => {});
            localStorage.removeItem('liberty_friends_' + userId);
            try {
                const avatarKey = 'liberty_avatar_' + userId;
                const raw = localStorage.getItem(avatarKey);
                if (raw != null) localStorage.removeItem(avatarKey);
            } catch (_) {}
            let servers = await this._getEncrypted('liberty_servers_' + userId).then(s => Array.isArray(s) ? s : null).catch(() => null);
            if (!servers || servers.length === 0) {
                servers = await this._getEncrypted('liberty_servers').then(s => Array.isArray(s) ? s : []).catch(() => []);
            }
            servers = (servers || []).map(s => {
                if (!s || !s.members) return s;
                return { ...s, members: (s.members || []).filter(m => m.id !== userId) };
            });
            if (servers.length > 0) {
                await this._setEncrypted('liberty_servers', servers).catch(() => {});
            }
            try { localStorage.removeItem('liberty_servers_' + userId); } catch (_) {}
            if (window.LibertyDB) {
                try { await LibertyDB.deleteUser(userId); } catch (_) {}
            }
            this.currentUser = null;
            this.servers = [];
            this.currentServer = null;
            this.currentChannel = null;
            this.currentDM = null;
            this.messages = {};
            this.dmMessages = {};
            this.friends = [];
            this.pendingFriends = [];
            this.closeModals();
            document.getElementById('modal-settings')?.classList.remove('active');
            document.getElementById('app')?.classList.add('hidden');
            document.getElementById('auth-choice-page')?.classList.remove('hidden');
            this.toast('Sua conta e seus dados foram removidos.');
        } catch (e) {
            console.warn('deleteMyAccountOnly:', e);
            this.toast('Erro ao apagar conta. Tente novamente.', 'error');
        }
    }

    clearAllData() {
        if (!confirm('Limpar todo o banco de dados? Todas as contas, servidores, mensagens e fotos serão removidos. Você precisará criar uma conta novamente.')) return;
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('liberty_')) keys.push(key);
            }
            keys.forEach(k => localStorage.removeItem(k));
            if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('liberty_session_key');
            if (window.indexedDB && window.indexedDB.deleteDatabase) {
                window.indexedDB.deleteDatabase('LibertyDB');
            }
            this.currentUser = null;
            this.servers = [];
            this.currentServer = null;
            this.currentChannel = null;
            this.currentDM = null;
            this.messages = {};
            this.dmMessages = {};
            this._localStream = null;
            this._screenStream = null;
            this._callVideoOn = false;
            this._callStartTime = null;
            if (this._callDurationTimer) {
                clearInterval(this._callDurationTimer);
                this._callDurationTimer = null;
            }
            document.getElementById('call-view')?.classList.add('hidden');
            document.getElementById('voice-bar')?.classList.add('hidden');
            this.closeModals();
            document.getElementById('modal-settings')?.classList.remove('active');
            document.getElementById('app')?.classList.add('hidden');
            document.getElementById('auth-choice-page')?.classList.remove('hidden');
            document.getElementById('login-page')?.classList.add('hidden');
            document.getElementById('register-page')?.classList.add('hidden');
            this.toast('Banco de dados limpo.');
        } catch (e) {
            console.warn('clearAllData:', e);
            this.toast('Erro ao limpar dados.', 'error');
        }
    }
    
    // Utils
    openModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }
    
    openAddModal(initialTab = 'channel') {
        this.switchAddModalTab(initialTab);
        if (this.currentServer) this.fillChannelCategorySelect();
        this.updateChannelSlugPreview();
        const modal = document.getElementById('modal-channel');
        if (modal) {
            modal.classList.add('active');
            setTimeout(() => {
                if (initialTab === 'channel') {
                    const input = document.getElementById('channel-name-input');
                    if (input) { input.focus(); input.value = ''; this.updateChannelSlugPreview(); }
                } else {
                    const input = document.getElementById('category-name-input');
                    if (input) { input.focus(); input.value = ''; }
                }
            }, 50);
        }
    }
    
    switchAddModalTab(tab) {
        document.querySelectorAll('.add-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.add-tab-panel').forEach(p => p.classList.toggle('active', p.id === 'add-panel-' + tab));
    }
    
    getChannelSlug(text) {
        return (text || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '';
    }
    
    updateChannelSlugPreview() {
        const input = document.getElementById('channel-name-input');
        const preview = document.getElementById('channel-slug-preview');
        if (!preview) return;
        const slug = this.getChannelSlug(input?.value || '');
        preview.textContent = slug ? '#' + slug : '#nome-do-canal';
    }
    
    closeModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }

    closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    }
    
    toast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i><span>${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
    
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
    }
    
    escape(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getYoutubeVideoIds(text) {
        if (!text || typeof text !== 'string') return [];
        const ids = [];
        const patterns = [
            /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?[^&\s]*v=([a-zA-Z0-9_-]{11})/gi,
            /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/gi,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/gi
        ];
        for (const re of patterns) {
            let m;
            re.lastIndex = 0;
            while ((m = re.exec(text)) !== null) {
                if (m[1] && !ids.includes(m[1])) ids.push(m[1]);
            }
        }
        return ids;
    }

    getInviteCodesFromText(text) {
        if (!text || typeof text !== 'string') return [];
        const codes = [];
        const re = /(?:#invite\/|invite\/)([a-zA-Z0-9]{6,12})/gi;
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(text)) !== null) {
            if (m[1] && !codes.includes(m[1])) codes.push(m[1]);
        }
        return codes;
    }

    formatMessageTextWithEmbeds(text) {
        if (!text || typeof text !== 'string') return { html: '', youtubeIds: [] };
        const youtubeIds = this.getYoutubeVideoIds(text);
        const urlRe = /(https?:\/\/[^\s<]+)/g;
        const parts = [];
        let lastIndex = 0;
        let m;
        urlRe.lastIndex = 0;
        while ((m = urlRe.exec(text)) !== null) {
            if (m.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, m.index) });
            parts.push({ type: 'url', value: m[1] });
            lastIndex = m.index + m[0].length;
        }
        if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });
        const html = parts.map(p => {
            if (p.type === 'text') return this.escape(p.value);
            const raw = p.value;
            const allowed = (typeof raw === 'string' && (raw.toLowerCase().startsWith('https:') || raw.toLowerCase().startsWith('http:')));
            const href = allowed ? this.escape(raw.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')) : this.escape(raw);
            return allowed ? `<a href="${href}" target="_blank" rel="noopener noreferrer" class="message-link">${this.escape(p.value)}</a>` : this.escape(raw);
        }).join('');
        return { html, youtubeIds };
    }

    createEmbedHTML(type, id) {
        if (type === 'youtube' && id) {
            const embedUrl = 'https://www.youtube.com/embed/' + this.escape(id) + '?rel=0';
            return `<div class="message-embed message-embed-youtube"><iframe src="${embedUrl}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        }
        return '';
    }

    createInviteEmbedHTML(server, inviteCode) {
        if (!server || !inviteCode) return '';
        const members = server.members || [];
        const onlineCount = members.filter(m => m.status === 'online').length;
        const memberCount = members.length;
        const created = server.createdAt ? new Date(server.createdAt) : null;
        const createdStr = created ? 'Desde ' + created.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '';
        const iconHtml = server.icon && this.sanitizeUrl(server.icon)
            ? `<img src="${this.sanitizeUrl(server.icon)}" alt="">`
            : `<span class="invite-embed-icon-letter">${(server.name && server.name[0]) ? server.name[0].toUpperCase() : '?'}</span>`;
        const name = this.escape(server.name || 'Servidor');
        return `
            <div class="message-embed message-embed-invite" data-invite-code="${this.escape(inviteCode)}">
                <div class="invite-embed-header">
                    <div class="invite-embed-icon">${iconHtml}</div>
                    <span class="invite-embed-name">${name}</span>
                </div>
                <div class="invite-embed-stats">
                    <span class="invite-embed-stat"><i class="fas fa-circle invite-stat-online"></i> ${onlineCount} online</span>
                    <span class="invite-embed-stat"><i class="fas fa-circle invite-stat-member"></i> ${memberCount} membro${memberCount !== 1 ? 's' : ''}</span>
                </div>
                ${createdStr ? `<div class="invite-embed-created">${createdStr}</div>` : ''}
                <button type="button" class="invite-embed-join btn-invite-join"><i class="fas fa-arrow-right"></i> Ir para o Servidor</button>
            </div>`;
    }

    async joinServerByInvite(code) {
        if (!this.currentUser) {
            this.toast('Faça login para entrar no servidor', 'error');
            return;
        }
        const server = await this.getInviteServer(code);
        if (!server) {
            this.toast('Convite inválido ou expirado', 'error');
            return;
        }
        const exists = this.servers.find(s => s && s.id === server.id);
        if (exists) {
            this.selectServer(server.id);
            this.toast('Você já está neste servidor');
            return;
        }
        const member = server.members && server.members.find(m => m.id === this.currentUser.id);
        if (member) {
            if (!this.servers.find(s => s.id === server.id)) {
                this.servers.push(server);
                this.saveServers();
            }
            this.selectServer(server.id);
            this.toast('Entrou no servidor!');
            return;
        }
        const newServer = JSON.parse(JSON.stringify(server));
        newServer.members = newServer.members || [];
        newServer.members.push({
            ...this.currentUser,
            serverAvatars: this.currentUser.serverAvatars || {},
            roles: ['@todos'],
            status: 'online'
        });
        this.servers.push(newServer);
        this.saveServers();
        this.renderServers();
        this.selectServer(newServer.id);
        this.toast('Você entrou no servidor!');
    }

    sanitizeUrl(url) {
        if (url == null || typeof url !== 'string') return '';
        if (window.LIBERTY_SECURITY && LIBERTY_SECURITY.sanitizeUrlStrict) {
            return LIBERTY_SECURITY.sanitizeUrlStrict(url);
        }
        const u = url.trim();
        const lower = u.toLowerCase();
        if (lower.startsWith('data:') || lower.startsWith('https:') || lower.startsWith('http:')) return u;
        return '';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.LibertyDB) await LibertyDB.init();
    window.app = new LibertyApp();
});
