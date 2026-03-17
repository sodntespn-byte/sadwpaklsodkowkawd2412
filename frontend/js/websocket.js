(function () {
    'use strict';

    var getToken = function () {
        if (typeof API !== 'undefined' && API.Token && API.Token.getAccessToken) return API.Token.getAccessToken();
        return localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('liberty_token') || '';
    };

    function LibertyGateway() {
        this.ws = null;
        this.connected = false;
        this.authenticated = false;
        this.sessionId = null;
        this.seq = 0;
        this.heartbeatInterval = null;
        this.eventHandlers = new Map();
        this.messageQueue = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.reconnectMaxDelay = 30000;
        this._intentionalClose = false;
        this._connectResolve = null;
        this._connectReject = null;
    }

    LibertyGateway.prototype.connect = function () {
        var self = this;
        this._intentionalClose = false;
        return new Promise(function (resolve, reject) {
            self._connectResolve = resolve;
            self._connectReject = typeof reject === 'function' ? reject : function () {};
            self._doConnect();
        });
    };

    LibertyGateway.prototype._resolveConnect = function (data) {
        var fulfill = this._connectResolve;
        this._connectResolve = null;
        this._connectReject = null;
        if (typeof fulfill !== 'function') return;
        var payload = data != null && typeof data === 'object' ? data : {};
        try { fulfill(payload); } catch (_) {}
    };

    LibertyGateway.prototype._rejectConnect = function (err) {
        var reject = this._connectReject;
        this._connectResolve = null;
        this._connectReject = null;
        if (typeof reject !== 'function') return;
        try { reject(err instanceof Error ? err : new Error(String(err))); } catch (_) {}
    };

    LibertyGateway.prototype._doConnect = function () {
        var self = this;
        var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        var token = getToken();
        var wsUrl = token ? protocol + '//' + window.location.host + '/ws?token=' + encodeURIComponent(token) : protocol + '//' + window.location.host + '/ws';

        try {
            this.ws = new WebSocket(wsUrl);
        } catch (e) {
            this._scheduleReconnect();
            return;
        }

        this.ws.onopen = function () {
            self.connected = true;
            self.reconnectAttempts = 0;
            self._flushQueue();
        };

        this.ws.onmessage = function (event) {
            try {
                var raw = event.data;
                if (typeof raw !== 'string') return;
                var message = JSON.parse(raw);
                self.handleMessage(message);
            } catch (_) {}
        };

        this.ws.onclose = function () {
            self.connected = false;
            self.authenticated = false;
            self.stopHeartbeat();
            self.ws = null;
            if (!self._intentionalClose) {
                self.emit('disconnected', null);
                self._scheduleReconnect();
            }
        };

        this.ws.onerror = function () {};
    };

    LibertyGateway.prototype._flushQueue = function () {
        var q = this.messageQueue;
        this.messageQueue = [];
        for (var i = 0; i < q.length; i++) {
            var item = q[i];
            this.send(item.op, item.d);
        }
    };

    LibertyGateway.prototype._scheduleReconnect = function () {
        if (this._intentionalClose || this.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.maxReconnectAttempts) return;
        if (this.reconnectAttempts === 0) this.reconnectAttempts = 1;
        var delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.reconnectMaxDelay);
        this.reconnectAttempts++;
        var self = this;
        setTimeout(function () { self._doConnect(); }, delay);
    };

    LibertyGateway.prototype.handleMessage = function (message) {
        var op = message.op;
        var d = message.d != null && typeof message.d === 'object' ? message.d : {};
        if (message.s !== undefined) this.seq = message.s;

        switch (op) {
            case 'hello':
                this.startHeartbeat(d.heartbeat_interval || 45000);
                if (getToken()) this.send('authenticate', { token: getToken() });
                break;
            case 'authenticated':
                this.authenticated = true;
                this.sessionId = d.session_id || null;
                this.emit('ready', d);
                this._resolveConnect(d);
                this._flushQueue();
                break;
            case 'auth_failed':
                this.emit('auth_failed', d);
                this._rejectConnect(new Error(d.reason || 'Auth failed'));
                break;
            case 'heartbeat_ack':
                if (d.seq !== undefined) this.seq = d.seq;
                this.emit('heartbeat_ack', d);
                break;
            case 'message_created':
                this.emit('message', d.message != null ? d.message : d);
                break;
            case 'message_updated':
                this.emit('message_update', d);
                break;
            case 'message_deleted':
                this.emit('message_delete', d);
                break;
            case 'messages_list':
                this.emit('messages_list', d);
                break;
            case 'typing_started':
                this.emit('typing', d);
                break;
            case 'presence_update':
                this.emit('presence', d);
                break;
            case 'server_list':
                this.emit('server_list', d);
                break;
            case 'server_info':
                this.emit('server_info', d);
                break;
            case 'server_created':
                this.emit('server_create', d);
                break;
            case 'server_updated':
                this.emit('server_update', d);
                break;
            case 'server_deleted':
                this.emit('server_delete', d);
                break;
            case 'channel_created':
                this.emit('channel_create', d);
                break;
            case 'channel_updated':
                this.emit('channel_update', d);
                break;
            case 'channel_deleted':
                this.emit('channel_delete', d);
                break;
            case 'member_joined':
                this.emit('member_join', d);
                break;
            case 'member_left':
                this.emit('member_leave', d);
                break;
            case 'member_updated':
                this.emit('member_update', d);
                break;
            case 'member_banned':
                this.emit('member_banned', d);
                break;
            case 'role_created':
                this.emit('role_create', d);
                break;
            case 'role_updated':
                this.emit('role_update', d);
                break;
            case 'role_deleted':
                this.emit('role_delete', d);
                break;
            case 'reaction_added':
                this.emit('reaction_add', d);
                break;
            case 'reaction_removed':
                this.emit('reaction_remove', d);
                break;
            case 'user_info':
                this.emit('user_info', d);
                break;
            case 'user_updated':
                this.emit('user_update', d);
                break;
            case 'invite_created':
                this.emit('invite_created', d);
                break;
            case 'error':
                this.emit('error', d);
                break;
            default:
                if (message.t) this.emit(String(message.t).toLowerCase(), d);
        }
    };

    LibertyGateway.prototype.send = function (op, data) {
        if (!this.connected) {
            this.messageQueue.push({ op: op, d: data != null ? data : {} });
            return;
        }
        var payload = typeof op === 'string' ? { op: op, d: data != null ? data : {} } : op;
        try {
            this.ws.send(JSON.stringify(payload));
        } catch (_) {
            this.messageQueue.push({ op: payload.op, d: payload.d || {} });
        }
    };

    LibertyGateway.prototype.startHeartbeat = function (intervalMs) {
        this.stopHeartbeat();
        var self = this;
        this.heartbeatInterval = setInterval(function () {
            if (self.connected) self.send('heartbeat', { seq: self.seq });
        }, intervalMs);
    };

    LibertyGateway.prototype.stopHeartbeat = function () {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    };

    LibertyGateway.prototype.on = function (event, handler) {
        if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
        this.eventHandlers.get(event).push(handler);
    };

    LibertyGateway.prototype.off = function (event, handler) {
        if (!this.eventHandlers.has(event)) return;
        var list = this.eventHandlers.get(event);
        var i = list.indexOf(handler);
        if (i > -1) list.splice(i, 1);
    };

    LibertyGateway.prototype.emit = function (event, data) {
        if (!this.eventHandlers.has(event)) return;
        var list = this.eventHandlers.get(event);
        for (var i = 0; i < list.length; i++) {
            try { list[i](data); } catch (_) {}
        }
    };

    LibertyGateway.prototype.updatePresence = function (status, customStatus) {
        var s = status === 'dnd' ? 'do_not_disturb' : (status === 'invisible' ? 'offline' : (status || 'online'));
        this.send('update_presence', { status: s, custom_status: customStatus || null });
    };

    LibertyGateway.prototype.startTyping = function (channelId) {
        this.send('start_typing', { channel_id: channelId });
    };

    LibertyGateway.prototype.sendMessage = function (channelId, content, tts, embeds) {
        this.send('send_message', { channel_id: channelId, content: content || '', tts: !!tts, embeds: Array.isArray(embeds) ? embeds : [] });
    };

    LibertyGateway.prototype.editMessage = function (channelId, messageId, content) {
        this.send('edit_message', { channel_id: channelId, message_id: messageId, content: content || '' });
    };

    LibertyGateway.prototype.deleteMessage = function (channelId, messageId) {
        this.send('delete_message', { channel_id: channelId, message_id: messageId });
    };

    LibertyGateway.prototype.requestServers = function () {
        this.send('request_servers', {});
    };

    LibertyGateway.prototype.requestServer = function (serverId) {
        this.send('request_server', { server_id: serverId });
    };

    LibertyGateway.prototype.requestMessages = function (channelId, before, limit) {
        this.send('request_messages', { channel_id: channelId, before: before || null, after: null, limit: limit != null ? limit : 50 });
    };

    LibertyGateway.prototype.createServer = function (name, region, icon) {
        this.send('create_server', { name: name || '', region: region || null, icon: icon || null });
    };

    LibertyGateway.prototype.createChannel = function (serverId, name, type, parentId, topic) {
        var ct = type || 'text';
        this.send('create_channel', { server_id: serverId, name: name || '', channel_type: ct, parent_id: parentId || null, topic: topic || null });
    };

    LibertyGateway.prototype.updateChannel = function (channelId, name, topic, position) {
        this.send('update_channel', { channel_id: channelId, name: name || null, topic: topic || null, position: position != null ? position : null });
    };

    LibertyGateway.prototype.deleteChannel = function (channelId) {
        this.send('delete_channel', { channel_id: channelId });
    };

    LibertyGateway.prototype.createInvite = function (channelId, maxUses, maxAge, temporary) {
        this.send('create_invite', { channel_id: channelId, max_uses: maxUses != null ? maxUses : null, max_age: maxAge != null ? maxAge : null, temporary: !!temporary });
    };

    LibertyGateway.prototype.joinServer = function (inviteCode) {
        this.send('join_server', { invite_code: String(inviteCode) });
    };

    LibertyGateway.prototype.leaveServer = function (serverId) {
        this.send('leave_server', { server_id: serverId });
    };

    LibertyGateway.prototype.addReaction = function (channelId, messageId, emojiName) {
        this.send('add_reaction', { channel_id: channelId, message_id: messageId, emoji: { id: null, name: String(emojiName || ''), animated: false } });
    };

    LibertyGateway.prototype.removeReaction = function (channelId, messageId, emojiName) {
        this.send('remove_reaction', { channel_id: channelId, message_id: messageId, emoji: { id: null, name: String(emojiName || ''), animated: false } });
    };

    LibertyGateway.prototype.kickMember = function (serverId, userId, reason) {
        this.send('kick_member', { server_id: serverId, user_id: userId, reason: reason || null });
    };

    LibertyGateway.prototype.banMember = function (serverId, userId, reason, deleteMessageDays) {
        this.send('ban_member', { server_id: serverId, user_id: userId, reason: reason || null, delete_message_days: deleteMessageDays != null ? deleteMessageDays : null });
    };

    LibertyGateway.prototype.requestUser = function (userId) {
        this.send('request_user', { user_id: userId });
    };

    LibertyGateway.prototype.subscribeChannel = function () {};
    LibertyGateway.prototype.unsubscribeChannel = function () {};

    LibertyGateway.prototype.disconnect = function () {
        this._intentionalClose = true;
        this.stopHeartbeat();
        if (this.ws) {
            try { this.ws.close(1000, 'Client disconnect'); } catch (_) {}
            this.ws = null;
        }
        this.connected = false;
        this.authenticated = false;
    };

    window.Gateway = new LibertyGateway();
})();

