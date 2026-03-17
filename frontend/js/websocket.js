(function () {
  'use strict';

  class LibertyGateway {
    constructor() {
      this.ws = null;
      this.socket = null;
      this.connected = false;
      this.authenticated = false;
      this.sessionId = null;
      this.seq = 0;
      this.heartbeatInterval = null;
      this.eventHandlers = new Map();
      this.messageQueue = [];
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 50;
      this.reconnectDelay = 1000;
      this.reconnectMaxDelay = 30000;
      this._connectResolve = null;
      this._connectReject = null;
      this._reconnectTimeout = null;
      this._connectIntent = false;
      this._disconnectRequested = false;
      this._subscribedChannels = new Set();
      this._hasConnectedOnce = false;
      this._helloTimeout = null;
    }

    connect() {
      this._connectIntent = true;
      this._disconnectRequested = false;
      this._clearReconnect();
      this._clearHelloTimeout();
      return new Promise((resolve, reject) => {
        this._connectResolve = resolve;
        this._connectReject = reject;
        this._doConnect();
      });
    }

    _resolveConnect(data) {
      if (typeof this._connectResolve !== 'function') return;
      const resolveFn = this._connectResolve;
      const rejectFn = this._connectReject;
      this._connectResolve = null;
      this._connectReject = null;
      this._connectIntent = false;
      this._clearHelloTimeout();
      const wasReconnected = this._hasConnectedOnce;
      this._hasConnectedOnce = true;
      this._resubscribeAll();
      this._flushQueue();
      if (typeof resolveFn === 'function') {
        try {
          resolveFn({ ...(data || {}), reconnected: wasReconnected });
        } catch (_) {}
      }
      this.emit('ready', { ...(data || {}), reconnected: wasReconnected });
    }

    _clearHelloTimeout() {
      if (this._helloTimeout) {
        clearTimeout(this._helloTimeout);
        this._helloTimeout = null;
      }
    }

    _resubscribeAll() {
      this._subscribedChannels.forEach((channelId) => {
        if (this.socket && this.socket.connected) {
          this.socket.emit('subscribe', { chat_id: channelId, chatId: channelId });
        } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'subscribe', chat_id: channelId }));
        }
      });
    }

    _flushQueue() {
      while (this.messageQueue.length > 0) {
        const { op, data } = this.messageQueue.shift();
        this.send(op, data);
      }
    }

    _doConnect() {
      const token =
        typeof API !== 'undefined' && API.Token
          ? API.Token.getAccessToken()
          : localStorage.getItem('access_token') || localStorage.getItem('token') || '';
      this.socket = null;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = token
        ? `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`
        : `${protocol}//${window.location.host}/ws`;
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        if (this._connectIntent) this._rejectConnect(new Error('WebSocket failed'));
        this._scheduleReconnect();
        return;
      }
      this.ws.onopen = () => {
        this.connected = true;
        this._clearHelloTimeout();
      };
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          if (typeof console !== 'undefined' && console.error) console.error('[Gateway] Parse error:', err);
        }
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.authenticated = false;
        this.stopHeartbeat();
        this._clearHelloTimeout();
        if (this._connectResolve && this._connectIntent) this._rejectConnect(new Error('Conexão fechada'));
        this._scheduleReconnect();
      };
      this.ws.onerror = () => {
        this._clearHelloTimeout();
        if (this._connectResolve && this._connectIntent) this._rejectConnect(new Error('Erro de conexão'));
      };
    }

    _rejectConnect(err) {
      const rejectFn = this._connectReject;
      this._connectResolve = null;
      this._connectReject = null;
      this._connectIntent = false;
      this._clearHelloTimeout();
      if (typeof rejectFn === 'function') rejectFn(err);
    }

    _clearReconnect() {
      if (this._reconnectTimeout) {
        clearTimeout(this._reconnectTimeout);
        this._reconnectTimeout = null;
      }
    }

    _scheduleReconnect() {
      if (this._disconnectRequested) return;
      if (this.reconnectAttempts === 0) this.reconnectAttempts = 1;
      const base = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.reconnectMaxDelay
      );
      const jitter = Math.random() * 1000;
      const delay = Math.min(base + jitter, this.reconnectMaxDelay);
      this.reconnectAttempts++;
      if (this.maxReconnectAttempts > 0 && this.reconnectAttempts > this.maxReconnectAttempts) return;
      this._reconnectTimeout = setTimeout(() => {
        this._reconnectTimeout = null;
        this._doConnect();
      }, delay);
    }

    handleMessage(message) {
      const { op, type, d, t, data, s } = message;
      if (type === 'message' && data) {
        this.emit('message', data);
        return;
      }
      if (type === 'server_created' && message.server) {
        this.emit('server_create', { server: message.server, channel_id: message.channel_id || null });
        return;
      }
      if (type === 'invite_error') {
        this.emit('invite_error', { message: message.message || 'Convite inválido ou expirado' });
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
      if (type && ['webrtc_offer', 'webrtc_answer', 'webrtc_ice', 'webrtc_reject', 'webrtc_hangup'].includes(type)) {
        this.emit(type, { from_user_id: message.from_user_id, payload: message.payload });
        return;
      }

      if (s !== undefined) this.seq = s;

      switch (op) {
        case 'hello': {
          this._clearHelloTimeout();
          this.startHeartbeat(d && d.heartbeat_interval ? d.heartbeat_interval : 45000);
          const tok =
            typeof API !== 'undefined' && API.Token ? API.Token.getAccessToken() : localStorage.getItem('access_token') || localStorage.getItem('token') || '';
          if (tok) this.send('authenticate', { token: tok });
          break;
        }

        case 'authenticated': {
          this._clearHelloTimeout();
          this.authenticated = true;
          this.sessionId = (d && d.session_id) || null;
          this._resolveConnect(d || {});
          break;
        }

        case 'auth_failed': {
          this._clearHelloTimeout();
          this.emit('auth_failed', d || {});
          const rejectFn = this._connectReject;
          this._connectResolve = null;
          this._connectReject = null;
          this._connectIntent = false;
          if (typeof rejectFn === 'function') rejectFn(new Error((d && d.reason) || 'Auth failed'));
          break;
        }

        case 'heartbeat_ack':
          this.emit('heartbeat_ack', d || {});
          break;

        case 'message_created':
          this.emit('message', (d && d.message) || d);
          break;

        case 'message_updated':
          this.emit('message_update', d || {});
          break;

        case 'message_deleted':
          this.emit('message_delete', d || {});
          break;

        case 'typing_started':
          this.emit('typing', d || {});
          break;

        case 'presence_update':
          this.emit('presence', d || {});
          break;

        case 'server_created':
          this.emit('server_create', d || {});
          break;

        case 'server_updated':
          this.emit('server_update', d || {});
          break;

        case 'server_deleted':
          this.emit('server_delete', d || {});
          break;

        case 'channel_created':
          this.emit('channel_create', d || {});
          break;

        case 'channel_updated':
          this.emit('channel_update', d || {});
          break;

        case 'channel_deleted':
          this.emit('channel_delete', d || {});
          break;

        case 'member_joined':
          this.emit('member_join', d || {});
          break;

        case 'member_left':
          this.emit('member_leave', d || {});
          break;

        case 'member_updated':
          this.emit('member_update', d || {});
          break;

        case 'role_created':
          this.emit('role_create', d || {});
          break;

        case 'role_updated':
          this.emit('role_update', d || {});
          break;

        case 'role_deleted':
          this.emit('role_delete', d || {});
          break;

        case 'reaction_added':
          this.emit('reaction_add', d || {});
          break;

        case 'reaction_removed':
          this.emit('reaction_remove', d || {});
          break;

        case 'error':
          if (typeof console !== 'undefined' && console.error) console.error('[Gateway] Server error:', d);
          this.emit('error', d || {});
          break;

        default:
          if (t) this.emit(t.toLowerCase(), d || {});
      }
    }

    send(op, data) {
      const message = typeof op === 'string' ? { op, d: data || {} } : op;
      if (this.socket && this.socket.connected) {
        this.socket.emit(typeof op === 'string' ? op : message.op, typeof op === 'string' ? data : message.d);
        return;
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
        return;
      }
      this.messageQueue.push({ op: typeof op === 'string' ? op : message.op, data: typeof op === 'string' ? data : message.d });
    }

    startHeartbeat(interval) {
      this.stopHeartbeat();
      if (!interval || interval < 5000) interval = 45000;
      this.heartbeatInterval = setInterval(() => {
        if (this.connected) this.send('heartbeat', { seq: this.seq });
      }, interval);
    }

    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    }

    on(event, handler) {
      if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
      this.eventHandlers.get(event).push(handler);
    }

    off(event, handler) {
      if (!this.eventHandlers.has(event)) return;
      const list = this.eventHandlers.get(event);
      const i = list.indexOf(handler);
      if (i > -1) list.splice(i, 1);
    }

    emit(event, data) {
      if (!this.eventHandlers.has(event)) return;
      this.eventHandlers.get(event).forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          if (typeof console !== 'undefined' && console.error) console.error('[Gateway] Handler error:', err);
        }
      });
    }

    updatePresence(status, customStatus) {
      this.send('update_presence', { status, custom_status: customStatus });
    }

    startTyping(channelId) {
      this.send('start_typing', { channel_id: channelId });
    }

    sendMessage(channelId, content, tts, embeds) {
      this.send('send_message', { channel_id: channelId, content, tts: !!tts, embeds: embeds || [] });
    }

    editMessage(channelId, messageId, content) {
      this.send('edit_message', { channel_id: channelId, message_id: messageId, content });
    }

    deleteMessage(channelId, messageId) {
      this.send('delete_message', { channel_id: channelId, message_id: messageId });
    }

    createServer(name, region, icon) {
      this.send('create_server', { name, region, icon });
    }

    createChannel(serverId, name, type, parentId, topic) {
      this.send('create_channel', {
        server_id: serverId,
        name,
        channel_type: type,
        parent_id: parentId || null,
        topic: topic || null,
      });
    }

    createInvite(channelId, maxUses, maxAge, temporary) {
      this.send('create_invite', { channel_id: channelId, max_uses: maxUses, max_age: maxAge, temporary: !!temporary });
    }

    joinServer(inviteCode) {
      const code = String(inviteCode || '').trim().toUpperCase();
      if (!code) return;
      this.send('join_server', { invite_code: code });
    }

    leaveServer(serverId) {
      this.send('leave_server', { server_id: serverId });
    }

    subscribeChannel(channelId) {
      if (!channelId) return;
      this._subscribedChannels.add(String(channelId));
      if (this.socket && this.socket.connected) {
        this.socket.emit('subscribe', { chat_id: channelId, chatId: channelId });
        return;
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'subscribe', chat_id: channelId }));
      }
    }

    unsubscribeChannel(channelId) {
      if (!channelId) return;
      this._subscribedChannels.delete(String(channelId));
      if (this.socket && this.socket.connected) {
        this.socket.emit('unsubscribe', { chat_id: channelId, chatId: channelId });
        return;
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'unsubscribe', chat_id: channelId }));
      }
    }

    disconnect() {
      this._connectIntent = false;
      this._disconnectRequested = true;
      this._clearReconnect();
      this._clearHelloTimeout();
      this.stopHeartbeat();
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      if (this.ws) {
        try {
          this.ws.close(1000, 'Client disconnect');
        } catch (_) {}
        this.ws = null;
      }
      this.connected = false;
      this.authenticated = false;
      this._connectResolve = null;
      this._connectReject = null;
    }
  }

  if (typeof window !== 'undefined') window.Gateway = new LibertyGateway();
})();



