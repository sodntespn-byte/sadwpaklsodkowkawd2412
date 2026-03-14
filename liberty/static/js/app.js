// VERSION: FRONT_POLLING_V1

(function () {
    const API_BASE = '/api/v1';
    const USERNAME_KEY = 'liberty_username';

    let currentChannelId = null;
    let pollingTimer = null;
    let realtimeWs = null;
    let defaultChatId = null;
    let currentDMRecipient = null;

    function getStoredUsername() {
        const raw = localStorage.getItem(USERNAME_KEY);
        if (!raw) return null;
        const trimmed = String(raw).trim();
        return trimmed.length ? trimmed : null;
    }

    function applyUsername(username) {
        const name = String(username).trim().substring(0, 32) || 'User';
        localStorage.setItem(USERNAME_KEY, name);

        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = name;
        }
    }

    function getAuthHeaders() {
        const token = localStorage.getItem('access_token');
        if (!token) return {};
        return { 'Authorization': 'Bearer ' + token };
    }

    async function fetchJSON(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...(options.headers || {})
        };

        const res = await fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        if (!res.ok) {
            let msg = 'Request failed';
            try {
                const data = await res.json();
                msg = data.message || msg;
            } catch (_) {}
            throw new Error(msg);
        }
        return res.json();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function authorColor(author) {
        let h = 0;
        for (let i = 0; i < (author || '').length; i++) h = (h * 31 + author.charCodeAt(i)) >>> 0;
        const hue = h % 360;
        return `hsl(${hue}, 55%, 65%)`;
    }

    function renderMessages(messages) {
        const list = document.getElementById('messages-list');
        if (!list) return;

        list.innerHTML = '';
        if (!Array.isArray(messages) || messages.length === 0) {
            const container = document.getElementById('messages-container');
            if (container) container.scrollTop = 0;
            return;
        }

        const groups = [];
        let current = { author: null, messages: [] };
        messages.forEach((m) => {
            const author = m.author_username || 'User';
            if (current.author !== author) {
                if (current.messages.length) groups.push({ ...current });
                current = { author, messages: [] };
            }
            current.messages.push(m);
        });
        if (current.messages.length) groups.push(current);

        groups.forEach((group) => {
            const color = authorColor(group.author);
            group.messages.forEach((m, i) => {
                const isFirst = i === 0;
                const isContinuation = !isFirst;
                const item = document.createElement('div');
                item.className = 'message-group' + (isContinuation ? ' message-group--continuation' : '');
                item.setAttribute('data-author', group.author);
                const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString() : '';
                item.innerHTML =
                    `<div class="message-group-bar" style="background-color:${color}" aria-hidden="true"></div>` +
                    `<div class="message-group-avatar" style="background-color:${color}" aria-hidden="true">` +
                    `<span>${escapeHtml((group.author || 'U').charAt(0).toUpperCase())}</span></div>` +
                    `<div class="message-group-body">` +
                    (isFirst
                        ? `<div class="message-header"><span class="message-username">${escapeHtml(group.author)}</span><span class="message-timestamp" title="${escapeHtml(dateStr)}">${escapeHtml(timeStr)}</span></div>`
                        : '') +
                    `<div class="message-content">${escapeHtml(String(m.content || ''))}</div>` +
                    `</div>`;
                list.appendChild(item);
            });
        });

        const container = document.getElementById('messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    async function loadMessages() {
        try {
            const data = await fetchJSON('/api/messages');
            renderMessages(data);
        } catch (err) {
            console.error('Erro ao carregar mensagens:', err.message);
        }
    }

    function getDefaultChatIdViaApi() {
        const token = localStorage.getItem('access_token');
        if (!token) return Promise.resolve(null);
        return fetch('/api/v1/default-chat', { headers: { 'Authorization': 'Bearer ' + token } })
            .then((r) => r.ok ? r.json() : null)
            .then((data) => data && data.chat_id ? data.chat_id : null)
            .catch(() => null);
    }

    function connectRealtimeWs() {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        function connect() {
            getDefaultChatIdViaApi().then((chatId) => {
                if (!chatId) return;
                defaultChatId = chatId;
                // Mesma origem (localhost ou Square Cloud): window.location.host
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const url = protocol + '//' + window.location.host + '/ws?token=' + encodeURIComponent(token);
                const ws = new WebSocket(url);
                realtimeWs = ws;
                ws.onopen = () => {
                    ws.send(JSON.stringify({ type: 'subscribe', chat_id: chatId }));
                };
                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === 'message' && msg.data) {
                            loadMessages();
                        }
                    } catch (_) {}
                };
                ws.onclose = () => {
                    realtimeWs = null;
                    setTimeout(connect, 2000);
                };
                ws.onerror = () => {};
            });
        }
        connect();
    }

    async function fetchMessages() {
        // Mantido para compatibilidade: agora delega para loadMessages()
        return loadMessages();
    }

    async function sendMessage(content) {
        const trimmed = String(content || '').trim();
        if (!trimmed) return;
        try {
            const author = getStoredUsername() || 'User';
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: trimmed, author }),
            });

            if (!res.ok) {
                let msg = 'Falha ao enviar mensagem';
                try {
                    const data = await res.json();
                    msg = data.message || msg;
                } catch (_) {}
                throw new Error(msg);
            }

            // Aguarda a confirmação do servidor antes de recarregar as mensagens
            await res.json();
            await loadMessages();
        } catch (err) {
            console.error('Erro ao enviar mensagem:', err.message);
            alert(err.message || 'Falha ao enviar mensagem');
        }
    }

    function setupMessageInput() {
        const textarea = document.getElementById('message-input');
        if (!textarea) return;

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const content = textarea.value;
                textarea.value = '';
                sendMessage(content);
            }
        });
    }

    function setupDefaultChannel() {
        // Para o fluxo simplificado /api/messages, usamos um canal lógico único.
        currentChannelId = 'default-channel';
    }

    function startPolling() {
        if (pollingTimer) clearInterval(pollingTimer);
        pollingTimer = setInterval(loadMessages, 5000);
    }

    function updateChannelHeaderForDM(recipient) {
        const nameEl = document.getElementById('channel-name');
        const iconEl = document.getElementById('channel-header-icon');
        const topicEl = document.getElementById('channel-topic');
        if (!recipient) return;
        if (nameEl) nameEl.textContent = recipient.username || 'DM';
        if (iconEl) { iconEl.className = 'fas fa-user channel-header-icon'; }
        if (topicEl) topicEl.textContent = recipient.status === 'online' ? 'Online' : recipient.status === 'idle' ? 'Idle' : 'Offline';
        topicEl.classList.remove('status-online', 'status-idle', 'status-offline');
        topicEl.classList.add(recipient.status === 'online' ? 'status-online' : recipient.status === 'idle' ? 'status-idle' : 'status-offline');
    }

    function updateChannelHeaderForChannel() {
        const nameEl = document.getElementById('channel-name');
        const iconEl = document.getElementById('channel-header-icon');
        const topicEl = document.getElementById('channel-topic');
        if (nameEl) nameEl.textContent = 'general';
        if (iconEl) iconEl.className = 'fas fa-hashtag channel-header-icon';
        if (topicEl) { topicEl.textContent = 'Welcome to LIBERTY!'; topicEl.className = 'channel-topic'; }
    }

    function initChat() {
        setupDefaultChannel();
        setupMessageInput();
        loadMessages();
        connectRealtimeWs();
        startPolling();
        updateChannelHeaderForChannel();
    }

    function showAppAndStart(username) {
        const loading = document.getElementById('loading-screen');
        const auth = document.getElementById('auth-screen');
        const app = document.getElementById('app');

        if (username) {
            applyUsername(username);
        }

        if (loading) {
            loading.classList.add('fade-out');
            loading.classList.add('hidden');
        }
        if (auth) {
            auth.classList.add('hidden');
        }
        if (app) {
            app.classList.remove('hidden');
        }

        initChat();
    }

    function setupSimpleAuth() {
        const token = localStorage.getItem('access_token');
        const auth = document.getElementById('auth-screen');
        const app = document.getElementById('app');

        if (token && typeof API !== 'undefined' && API.Auth) {
            API.Auth.refresh().then((data) => {
                if (data && data.user) {
                    applyUsername(data.user.username);
                    showAppAndStart(data.user.username);
                } else {
                    if (auth) auth.classList.remove('hidden');
                    if (app) app.classList.add('hidden');
                }
            }).catch(() => {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                if (auth) auth.classList.remove('hidden');
                if (app) app.classList.add('hidden');
            });
            if (auth) auth.classList.add('hidden');
            if (app) app.classList.remove('hidden');
            return;
        }

        const existingUsername = getStoredUsername();
        if (existingUsername && !token) {
            showAppAndStart(existingUsername);
            return;
        }

        if (auth) auth.classList.remove('hidden');
        if (app) app.classList.add('hidden');

        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const loginUsername = document.getElementById('login-username');
        const loginPassword = document.getElementById('login-password');
        const registerUsername = document.getElementById('register-username');
        const registerPassword = document.getElementById('register-password');

        function handleLogin(event) {
            event.preventDefault();
            const name = String(loginUsername?.value || '').trim();
            const pass = String(loginPassword?.value || '').trim();
            if (!name) { loginUsername?.focus(); return; }
            if (typeof API !== 'undefined' && API.Auth) {
                API.Auth.login(name, pass || undefined).then((data) => {
                    applyUsername(data.user?.username || name);
                    showAppAndStart(data.user?.username || name);
                }).catch((err) => alert(err.message || 'Erro ao entrar'));
                return;
            }
            showAppAndStart(name);
        }

        function handleRegister(event) {
            event.preventDefault();
            const name = String(registerUsername?.value || '').trim();
            const pass = String(registerPassword?.value || '').trim();
            if (!name) { registerUsername?.focus(); return; }
            if (typeof API !== 'undefined' && API.Auth) {
                API.Auth.register(name, null, pass || undefined).then((data) => {
                    applyUsername(data.user?.username || name);
                    showAppAndStart(data.user?.username || name);
                }).catch((err) => alert(err.message || 'Erro ao registrar'));
                return;
            }
            showAppAndStart(name);
        }

        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        if (registerForm) registerForm.addEventListener('submit', handleRegister);
    }

    let voiceCallWs = null;
    let voiceCallPc = null;
    let voiceCallStream = null;
    let voiceCallRemoteUserId = null;

    function getVoiceCallWs() {
        const token = localStorage.getItem('access_token');
        if (!token) return null;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = protocol + '//' + window.location.host + '/ws?token=' + encodeURIComponent(token);
        const ws = new WebSocket(url);
        return ws;
    }

    function setupVoiceCall() {
        const btn = document.getElementById('voice-call-btn');
        const voiceView = document.getElementById('voice-call-view');
        const voiceDisconnect = document.getElementById('voice-call-disconnect');
        const voiceMute = document.getElementById('voice-call-mute');
        const voiceParticipants = document.getElementById('voice-call-participants');

        function closeVoiceCall() {
            if (voiceCallStream) {
                voiceCallStream.getTracks().forEach((t) => t.stop());
                voiceCallStream = null;
            }
            if (voiceCallPc) {
                voiceCallPc.close();
                voiceCallPc = null;
            }
            voiceCallRemoteUserId = null;
            if (voiceView) voiceView.classList.add('hidden');
            if (voiceParticipants) voiceParticipants.innerHTML = '';
        }

        function addRemoteAudio(stream) {
            if (!voiceParticipants) return;
            const el = document.createElement('audio');
            el.autoplay = true;
            el.srcObject = stream;
            voiceParticipants.appendChild(el);
        }

        function showRemoteStreamLive() {
            if (!voiceParticipants) return;
            let el = document.getElementById('voice-call-remote-stream');
            if (!el) {
                el = document.createElement('div');
                el.id = 'voice-call-remote-stream';
                el.className = 'voice-call-remote-stream-live';
                el.innerHTML = '<span class="voice-call-live-badge"><i class="fas fa-circle"></i> LIVE</span><div class="voice-call-remote-video"></div>';
                voiceParticipants.insertBefore(el, voiceParticipants.firstChild);
            }
            el.classList.remove('hidden');
        }

        function hideRemoteStreamLive() {
            const el = document.getElementById('voice-call-remote-stream');
            if (el) el.classList.add('hidden');
        }

        function handleVoiceMessage(msg) {
            if (msg.type === 'stream_started') {
                showRemoteStreamLive();
                return;
            }
            if (msg.type === 'stream_stopped') {
                hideRemoteStreamLive();
                return;
            }
            if (msg.type === 'webrtc_offer' && msg.payload) {
                const from = msg.from_user_id;
                voiceCallRemoteUserId = from;
                if (voiceCallPc) return;
                voiceCallPc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                if (voiceCallStream) voiceCallStream.getTracks().forEach((t) => voiceCallPc.addTrack(t, voiceCallStream));
                voiceCallPc.ontrack = (e) => {
                    addRemoteAudio(e.streams[0]);
                    if (e.track.kind === 'video') showRemoteStreamLive();
                };
                voiceCallPc.onicecandidate = (e) => {
                    if (e.candidate && voiceCallWs && voiceCallWs.readyState === WebSocket.OPEN)
                        voiceCallWs.send(JSON.stringify({ type: 'webrtc_ice', target_user_id: from, payload: e.candidate }));
                };
                voiceCallPc.setRemoteDescription(new RTCSessionDescription(msg.payload)).then(() => voiceCallPc.createAnswer()).then((answer) => voiceCallPc.setLocalDescription(answer)).then(() => {
                    if (voiceCallWs && voiceCallWs.readyState === WebSocket.OPEN)
                        voiceCallWs.send(JSON.stringify({ type: 'webrtc_answer', target_user_id: from, payload: voiceCallPc.localDescription }));
                }).catch((err) => console.error('Voice answer error', err));
                if (voiceView) voiceView.classList.remove('hidden');
            } else if (msg.type === 'webrtc_answer' && msg.payload && voiceCallPc) {
                voiceCallPc.setRemoteDescription(new RTCSessionDescription(msg.payload)).catch((err) => console.error('Voice setRemoteDesc', err));
            } else if (msg.type === 'webrtc_ice' && msg.payload && voiceCallPc) {
                voiceCallPc.addIceCandidate(new RTCIceCandidate(msg.payload)).catch((err) => console.error('Voice addIceCandidate', err));
            }
        }

        function ensureVoiceWs() {
            if (voiceCallWs && voiceCallWs.readyState === WebSocket.OPEN) return voiceCallWs;
            voiceCallWs = getVoiceCallWs();
            voiceCallWs.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    handleVoiceMessage(msg);
                } catch (_) {}
            };
            voiceCallWs.onclose = () => { voiceCallWs = null; };
            voiceCallWs.onerror = () => {};
            return voiceCallWs;
        }

        if (btn) {
            btn.addEventListener('click', async () => {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    alert('Faça login para iniciar uma chamada de voz.');
                    return;
                }
                const targetId = prompt('ID do usuário para ligar (UUID):', '');
                if (!targetId || !targetId.trim()) return;
                try {
                    voiceCallStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (e) {
                    alert('Permissão de microfone negada ou indisponível.');
                    return;
                }
                voiceCallRemoteUserId = targetId.trim();
                voiceCallPc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                voiceCallPc.addTrack(voiceCallStream.getTracks()[0], voiceCallStream);
                voiceCallPc.ontrack = (e) => addRemoteAudio(e.streams[0]);
                voiceCallPc.onicecandidate = (e) => {
                    if (e.candidate && voiceCallWs && voiceCallWs.readyState === WebSocket.OPEN)
                        voiceCallWs.send(JSON.stringify({ type: 'webrtc_ice', target_user_id: voiceCallRemoteUserId, payload: e.candidate }));
                };
                const ws = ensureVoiceWs();
                if (ws.readyState === WebSocket.OPEN) {
                    voiceCallPc.createOffer().then((offer) => voiceCallPc.setLocalDescription(offer)).then(() => {
                        ws.send(JSON.stringify({ type: 'webrtc_offer', target_user_id: voiceCallRemoteUserId, payload: voiceCallPc.localDescription }));
                    }).catch((err) => console.error('Voice offer error', err));
                } else {
                    ws.onopen = () => {
                        voiceCallPc.createOffer().then((offer) => voiceCallPc.setLocalDescription(offer)).then(() => {
                            ws.send(JSON.stringify({ type: 'webrtc_offer', target_user_id: voiceCallRemoteUserId, payload: voiceCallPc.localDescription }));
                        }).catch((err) => console.error('Voice offer error', err));
                    };
                }
                if (voiceView) voiceView.classList.remove('hidden');
                if (voiceParticipants) voiceParticipants.innerHTML = '<p class="voice-call-subtitle">Conectando...</p>';
            });
        }
        const screenshareBtn = document.querySelector('.voice-connected-actions .fa-desktop') && document.querySelector('.voice-connected-actions .fa-desktop').closest('button');
        if (screenshareBtn) {
            screenshareBtn.addEventListener('click', async () => {
                if (!voiceCallWs || voiceCallWs.readyState !== WebSocket.OPEN || !voiceCallRemoteUserId) return;
                try {
                    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
                    const videoTrack = stream.getVideoTracks()[0];
                    if (voiceCallPc && videoTrack) {
                        const senders = voiceCallPc.getSenders();
                        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
                        if (videoSender) videoSender.replaceTrack(videoTrack);
                        else voiceCallPc.addTrack(videoTrack, stream);
                        voiceCallWs.send(JSON.stringify({ type: 'stream_started', target_user_id: voiceCallRemoteUserId }));
                    }
                } catch (err) {
                    if (err.name !== 'NotAllowedError') console.error('Screen share:', err);
                }
            });
        }
        if (localStorage.getItem('access_token')) ensureVoiceWs();
        if (voiceDisconnect) voiceDisconnect.addEventListener('click', () => { closeVoiceCall(); });
        if (voiceMute) voiceMute.addEventListener('click', () => { if (voiceCallStream) voiceCallStream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; }); });
    }

    function setupDmAddButton() {
        const btn = document.getElementById('dm-add-btn');
        const overlay = document.getElementById('modal-overlay');
        const groupModal = document.getElementById('create-group-modal');
        const groupFriendsList = document.getElementById('create-group-friends-list');
        const groupNameInput = document.getElementById('group-name-input');
        const noFriendsEl = document.getElementById('create-group-no-friends');
        const submitBtn = document.getElementById('create-group-submit-btn');

        function openGroupModal() {
            if (!window.API || !window.API.DM || !window.API.DM.createGroup) return;
            const token = localStorage.getItem('access_token');
            if (!token) {
                alert('Faça login para criar um grupo.');
                return;
            }
            groupNameInput.value = '';
            groupFriendsList.innerHTML = '';
            noFriendsEl.classList.add('hidden');
            fetch('/api/v1/users/@me/relationships', {
                headers: { 'Authorization': 'Bearer ' + token }
            })
                .then((r) => r.ok ? r.json() : [])
                .then((friends) => {
                    if (!friends.length) {
                        noFriendsEl.classList.remove('hidden');
                        noFriendsEl.textContent = 'Adicione amigos antes de criar um grupo.';
                        return;
                    }
                    friends.forEach((f) => {
                        const row = document.createElement('label');
                        row.className = 'create-group-friend-row';
                        row.innerHTML = `<input type="checkbox" data-id="${f.id}" data-username="${(f.username || '').replace(/"/g, '&quot;')}"><span>${escapeHtml(f.username || 'User')}</span>`;
                        row.addEventListener('click', (e) => { if (e.target.type !== 'checkbox') row.querySelector('input').click(); });
                        groupFriendsList.appendChild(row);
                    });
                })
                .catch(() => {
                    noFriendsEl.classList.remove('hidden');
                    noFriendsEl.textContent = 'Não foi possível carregar a lista de amigos.';
                });
            if (overlay) overlay.classList.remove('hidden');
            if (groupModal) groupModal.classList.remove('hidden');
        }

        function closeGroupModal() {
            if (overlay) overlay.classList.add('hidden');
            if (groupModal) groupModal.classList.add('hidden');
        }

        if (btn) btn.addEventListener('click', openGroupModal);
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const token = localStorage.getItem('access_token');
                if (!token || !window.API?.DM?.createGroup) return;
                const ids = Array.from(groupFriendsList.querySelectorAll('input:checked')).map((c) => c.dataset.id);
                if (ids.length < 2) {
                    alert('Selecione pelo menos 2 amigos para criar o grupo.');
                    return;
                }
                const name = (groupNameInput.value || '').trim() || null;
                try {
                    submitBtn.disabled = true;
                    await window.API.DM.createGroup(name, ids);
                    closeGroupModal();
                    if (typeof loadMessages === 'function') loadMessages();
                } catch (err) {
                    alert(err.message || 'Erro ao criar grupo.');
                } finally {
                    submitBtn.disabled = false;
                }
            });
        }
        document.querySelectorAll('[data-close="create-group-modal"]').forEach((el) => el.addEventListener('click', closeGroupModal));
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeGroupModal(); });
    }

    function init() {
        setupSimpleAuth();
        setupDmAddButton();
        setupVoiceCall();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // expõe para depuração manual, se necessário
    window.fetchMessages = fetchMessages;
})();

