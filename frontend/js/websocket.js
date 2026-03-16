// LIBERTY - WebSocket Gateway

class LibertyGateway {
    constructor() {
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
        this._connectResolve = null;
        this._connectReject = null;
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this._connectResolve = resolve;
            this._connectReject = reject;
            this._doConnect();
        });
    }

    _resolveConnect(data) {
        if (typeof this._connectResolve !== 'function') return;
        const resolveFn = this._connectResolve;
        this._connectResolve = null;
        this._connectReject = null;
        if (typeof resolveFn === 'function') {
            try {
                resolveFn(data != null ? data : {});
            } catch (_) {}
        }
    }

    _doConnect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = typeof API !== 'undefined' && API.Token ? API.Token.getAccessToken() : (localStorage.getItem('access_token') || '');
        const wsUrl = token ? `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}` : `${protocol}//${window.location.host}/ws`;
        
        try {
            this.ws = new WebSocket(wsUrl);
        } catch (e) {
            this._scheduleReconnect();
            return;
        }
        
        this.ws.onopen = () => {
            this.connected = true;
            this.reconnectAttempts = 0;
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('[Gateway] Parse error:', error);
            }
        };
        
        this.ws.onclose = () => {
            this.connected = false;
            this.authenticated = false;
            this.stopHeartbeat();
            this._scheduleReconnect();
        };
        
        this.ws.onerror = () => {
            // Silencioso: reconexão será feita em onclose
        };
    }

    _scheduleReconnect() {
        if (this.reconnectAttempts === 0) {
            this.reconnectAttempts = 1;
        }
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.reconnectMaxDelay
        );
        this.reconnectAttempts++;
        setTimeout(() => {
            this._doConnect();
        }, delay);
    }
    
    handleMessage(message) {
        const { op, type, d, t, data, s } = message;
        const msgId = message.id || message.s || op || type || 'unknown';
        if (type === 'message' && data) {
            this.emit('message', data);
            return;
        }
        if (type === 'stream_started' && message.from_user_id) {
            this.emit('stream_started', { from_user_id: message.from_user_id, stream_type: message.stream_type });
            return;
        }
        if (type === 'stream_stopped' && message.from_user_id) {
            this.emit('stream_stopped', { from_user_id: message.from_user_id });
            return;
        }
        
        if (s !== undefined) this.seq = s;
        
        switch (op) {
            case 'hello':
                // Server hello - start heartbeat
                this.startHeartbeat(d.heartbeat_interval);
                console.log('[Gateway] Server version:', d.server_version);
                
                // Send authentication
                const token = API.Token.getAccessToken();
                if (token) {
                    this.send('authenticate', { token });
                }
                break;
                
            case 'authenticated':
                this.authenticated = true;
                this.sessionId = d.session_id;
                console.log('[Gateway] Authenticated as', d.user.username);
                this.emit('ready', d);
                this._resolveConnect(d);
                break;
                
            case 'auth_failed':
                console.error('[Gateway] Auth failed:', d.reason);
                this.emit('auth_failed', d);
                if (typeof this._connectReject === 'function') {
                    const rejectFn = this._connectReject;
                    this._connectResolve = null;
                    this._connectReject = null;
                    rejectFn(new Error(d.reason));
                } else {
                    console.warn('[Gateway] auth_failed sem Promise pendente. op=', op, 'msgId=', msgId);
                }
                break;
                
            case 'heartbeat_ack':
                // Heartbeat acknowledged
                this.emit('heartbeat_ack', d);
                break;
                
            case 'message_created':
                this.emit('message', d.message);
                break;
                
            case 'message_updated':
                this.emit('message_update', d);
                break;
                
            case 'message_deleted':
                this.emit('message_delete', d);
                break;
                
            case 'typing_started':
                this.emit('typing', d);
                break;
                
            case 'presence_update':
                this.emit('presence', d);
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
                
            case 'error':
                console.error('[Gateway] Server error:', d);
                this.emit('error', d);
                break;
                
            default:
                // Handle event-based messages
                if (t) {
                    this.emit(t.toLowerCase(), d);
                }
        }
    }
    
    send(op, data = {}) {
        if (!this.connected) {
            console.warn('[Gateway] Not connected, queuing message');
            this.messageQueue.push({ op, data });
            return;
        }
        
        const message = typeof op === 'string' ? { op, d: data } : op;
        this.ws.send(JSON.stringify(message));
    }
    
    startHeartbeat(interval) {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.connected) {
                this.send('heartbeat', { seq: this.seq });
            }
        }, interval);
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    // Event handling
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`[Gateway] Handler error for ${event}:`, error);
                }
            });
        }
    }
    
    // Gateway actions
    updatePresence(status, customStatus) {
        this.send('update_presence', { status, custom_status: customStatus });
    }
    
    startTyping(channelId) {
        this.send('start_typing', { channel_id: channelId });
    }
    
    sendMessage(channelId, content, tts = false, embeds = []) {
        this.send('send_message', {
            channel_id: channelId,
            content,
            tts,
            embeds
        });
    }
    
    editMessage(channelId, messageId, content) {
        this.send('edit_message', {
            channel_id: channelId,
            message_id: messageId,
            content
        });
    }
    
    deleteMessage(channelId, messageId) {
        this.send('delete_message', {
            channel_id: channelId,
            message_id: messageId
        });
    }
    
    createServer(name, region, icon) {
        this.send('create_server', { name, region, icon });
    }
    
    createChannel(serverId, name, type, parentId, topic) {
        this.send('create_channel', {
            server_id: serverId,
            name,
            channel_type: type,
            parent_id: parentId,
            topic
        });
    }
    
    createInvite(channelId, maxUses, maxAge, temporary) {
        this.send('create_invite', {
            channel_id: channelId,
            max_uses: maxUses,
            max_age: maxAge,
            temporary
        });
    }
    
    joinServer(inviteCode) {
        this.send('join_server', { invite_code: inviteCode });
    }
    
    leaveServer(serverId) {
        this.send('leave_server', { server_id: serverId });
    }
    
    disconnect() {
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
        this.connected = false;
        this.authenticated = false;
    }
}

// Create global gateway instance
window.Gateway = new LibertyGateway();

