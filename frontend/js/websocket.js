(function () {
  'use strict';

  var WEBRTC_STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

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
      this._connectFulfillRef = null;
      this._connectRejectRef = null;
      this._reconnectTimeout = null;
      this._connectIntent = false;
      this._disconnectRequested = false;
      this._subscribedChannels = new Set();
      this._hasConnectedOnce = false;
      this._helloTimeout = null;
      this.peers = new Map();
      this.pendingOffers = new Map();
    }

    _getIceConfig() {
      return { iceServers: WEBRTC_STUN_SERVERS };
    }

    _createPeer(targetId) {
      var self = this;
      var pc = new RTCPeerConnection(this._getIceConfig());
      var entry = { pc: pc, localStream: null };
      this.peers.set(targetId, entry);
      pc.onicecandidate = function (e) {
        if (!e.candidate) return;
        if (self.send) self.send('webrtc_ice', { target_user_id: targetId, payload: e.candidate });
      };
      pc.ontrack = function (e) {
        var stream = e.streams && e.streams[0] ? e.streams[0] : e.stream;
        if (stream && self.emit) self.emit('webrtc_remote_stream', { targetId: targetId, stream: stream });
      };
      pc.oniceconnectionstatechange = function () {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
          if (self.emit) self.emit('webrtc_connection_state', { targetId: targetId, state: pc.iceConnectionState });
        }
      };
      return pc;
    }

    _getOrCreatePeer(targetId) {
      var entry = this.peers.get(targetId);
      return entry ? entry.pc : null;
    }

    initiateCall(targetId, options) {
      var self = this;
      targetId = String(targetId);
      if (this.peers.has(targetId)) {
        if (this.emit) this.emit('webrtc_error', { code: 'already_in_call', targetId: targetId });
        return Promise.reject(new Error('Already in call with this user'));
      }
      var opts = options && typeof options === 'object' ? options : {};
      var audio = opts.audio !== false;
      var video = opts.video !== false;
      return navigator.mediaDevices.getUserMedia({ audio: audio, video: video }).then(function (stream) {
        var pc = self._createPeer(targetId);
        var entry = self.peers.get(targetId);
        if (entry) entry.localStream = stream;
        stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
        return pc.createOffer();
      }).then(function (offer) {
        var pc = self._getOrCreatePeer(targetId);
        if (!pc) return Promise.reject(new Error('Peer lost'));
        return pc.setLocalDescription(offer);
      }).then(function () {
        var pc = self._getOrCreatePeer(targetId);
        if (!pc || !pc.localDescription) return;
        self.send('webrtc_offer', { target_user_id: targetId, payload: pc.localDescription });
        if (self.emit) self.emit('webrtc_call_initiated', { targetId: targetId });
      }).catch(function (err) {
        self.endCall(targetId);
        if (self.emit) self.emit('webrtc_error', { error: err, targetId: targetId });
        throw err;
      });
    }

    acceptCall(targetId) {
      var self = this;
      targetId = String(targetId);
      var pending = this.pendingOffers.get(targetId);
      if (!pending) {
        var err = new Error('No pending offer from this user');
        if (this.emit) this.emit('webrtc_error', { error: err, targetId: targetId });
        return Promise.reject(err);
      }
      var opts = { audio: true, video: true };
      return navigator.mediaDevices.getUserMedia(opts).then(function (stream) {
        var pc = self._createPeer(targetId);
        var entry = self.peers.get(targetId);
        if (entry) entry.localStream = stream;
        stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
        return pc.setRemoteDescription(new RTCSessionDescription(pending));
      }).then(function () {
        var pc = self._getOrCreatePeer(targetId);
        if (!pc) return Promise.reject(new Error('Peer lost'));
        return pc.createAnswer();
      }).then(function (answer) {
        var pc = self._getOrCreatePeer(targetId);
        if (!pc) return Promise.reject(new Error('Peer lost'));
        return pc.setLocalDescription(answer);
      }).then(function () {
        var pc = self._getOrCreatePeer(targetId);
        if (!pc || !pc.localDescription) return;
        self.pendingOffers.delete(targetId);
        self.send('webrtc_answer', { target_user_id: targetId, payload: pc.localDescription });
        if (self.emit) self.emit('webrtc_call_accepted', { targetId: targetId });
      }).catch(function (err) {
        self.endCall(targetId);
        self.pendingOffers.delete(targetId);
        if (self.emit) self.emit('webrtc_error', { error: err, targetId: targetId });
        throw err;
      });
    }

    endCall(targetId) {
      targetId = String(targetId);
      var entry = this.peers.get(targetId);
      if (!entry) return;
      if (entry.localStream && typeof entry.localStream.getTracks === 'function') {
        entry.localStream.getTracks().forEach(function (t) { t.stop(); });
      }
      if (entry.pc) {
        try { entry.pc.close(); } catch (_) {}
      }
      this.peers.delete(targetId);
      this.send('webrtc_hangup', { target_user_id: targetId });
      if (this.emit) this.emit('webrtc_call_ended', { targetId: targetId });
    }

    rejectCall(targetId) {
      targetId = String(targetId);
      this.pendingOffers.delete(targetId);
      this.send('webrtc_reject', { target_user_id: targetId });
      if (this.emit) this.emit('webrtc_call_rejected', { targetId: targetId });
    }

    connect() {
      var self = this;
      this._connectIntent = true;
      this._disconnectRequested = false;
      this._clearReconnect();
      this._clearHelloTimeout();
      return new Promise(function (fulfill, reject) {
        self._connectFulfillRef = { current: fulfill };
        self._connectRejectRef = { current: reject };
        self._doConnect();
      });
    }

    _resolveConnect(data) {
      var ref = this._connectFulfillRef;
      this._connectFulfillRef = null;
      this._connectRejectRef = null;
      this._connectIntent = false;
      this._clearHelloTimeout();
      var doneFn = ref && ref.current;
      if (typeof doneFn !== 'function') return;
      var wasReconnected = this._hasConnectedOnce;
      this._hasConnectedOnce = true;
      if (typeof this._resubscribeAll === 'function') this._resubscribeAll();
      if (typeof this._flushQueue === 'function') this._flushQueue();
      var payload = Object.assign({}, data && typeof data === 'object' ? data : {}, { reconnected: wasReconnected });
      try { doneFn(payload); } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('[Gateway] resolveConnect callback error:', e); }
      if (typeof this.emit === 'function') this.emit('ready', payload);
    }

    _clearHelloTimeout() {
      if (this._helloTimeout != null) {
        try { clearTimeout(this._helloTimeout); } catch (_) {}
        this._helloTimeout = null;
      }
    }

    _resubscribeAll() {
      if (!this._subscribedChannels || typeof this._subscribedChannels.forEach !== 'function') return;
      try {
        this._subscribedChannels.forEach(function (channelId) {
          if (!channelId) return;
          var id = String(channelId);
          if (this.socket && typeof this.socket.connected === 'boolean' && this.socket.connected && typeof this.socket.emit === 'function') {
            this.socket.emit('subscribe', { chat_id: id, chatId: id });
          } else if (this.ws && this.ws.readyState === 1 && typeof this.ws.send === 'function') {
            this.ws.send(JSON.stringify({ type: 'subscribe', chat_id: id }));
          }
        }.bind(this));
      } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('[Gateway] resubscribe error:', e); }
    }

    _flushQueue() {
      if (!this.messageQueue || !Array.isArray(this.messageQueue)) return;
      while (this.messageQueue.length > 0) {
        var item = this.messageQueue.shift();
        if (item && item.op != null && typeof this.send === 'function') this.send(item.op, item.data);
      }
    }

    _doConnect() {
      var token = '';
      try {
        token = typeof API !== 'undefined' && API && API.Token && typeof API.Token.getAccessToken === 'function' ? API.Token.getAccessToken() : (typeof localStorage !== 'undefined' && localStorage.getItem ? (localStorage.getItem('access_token') || localStorage.getItem('token') || '') : '');
      } catch (_) {}
      this.socket = null;
      var protocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
      var host = (typeof window !== 'undefined' && window.location && window.location.host) ? window.location.host : '';
      var wsUrl = host ? (token ? protocol + '//' + host + '/ws?token=' + encodeURIComponent(token) : protocol + '//' + host + '/ws') : '';
      if (!wsUrl) {
        if (this._connectIntent && typeof this._rejectConnect === 'function') this._rejectConnect(new Error('Invalid WebSocket URL'));
        return;
      }
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        if (this._connectIntent && typeof this._rejectConnect === 'function') this._rejectConnect(new Error('WebSocket failed'));
        if (typeof this._scheduleReconnect === 'function') this._scheduleReconnect();
        return;
      }
      this.ws.onopen = () => {
        this.connected = true;
        this._clearHelloTimeout();
      };
      this.ws.onmessage = (function (self) {
        return function (event) {
          if (!event || event.data == null) return;
          try {
            var raw = typeof event.data === 'string' ? event.data : String(event.data);
            var message = JSON.parse(raw);
            if (message && typeof message === 'object' && typeof self.handleMessage === 'function') self.handleMessage(message);
          } catch (err) {
            if (typeof console !== 'undefined' && console.error) console.error('[Gateway] Parse error:', err);
          }
        };
      })(this);
      this.ws.onclose = () => {
        this.connected = false;
        this.authenticated = false;
        this.stopHeartbeat();
        this._clearHelloTimeout();
        if (this._connectFulfillRef && this._connectIntent) this._rejectConnect(new Error('Conexão fechada'));
        this._scheduleReconnect();
      };
      this.ws.onerror = () => {
        this._clearHelloTimeout();
        if (this._connectFulfillRef && this._connectIntent) this._rejectConnect(new Error('Erro de conexão'));
      };
    }

    _rejectConnect(err) {
      var ref = this._connectRejectRef;
      this._connectFulfillRef = null;
      this._connectRejectRef = null;
      this._connectIntent = false;
      this._clearHelloTimeout();
      var failFn = ref && ref.current;
      if (typeof failFn !== 'function') return;
      try { failFn(err instanceof Error ? err : new Error(err && (err.message || String(err)) || 'Connection failed')); } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('[Gateway] rejectConnect callback error:', e); }
    }

    _clearReconnect() {
      if (this._reconnectTimeout != null) {
        try { clearTimeout(this._reconnectTimeout); } catch (_) {}
        this._reconnectTimeout = null;
      }
    }

    _scheduleReconnect() {
      if (this._disconnectRequested) return;
      if (this.reconnectAttempts === 0) this.reconnectAttempts = 1;
      var base = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.reconnectMaxDelay
      );
      var jitter = (typeof Math.random === 'function') ? Math.random() * 1000 : 0;
      var delay = Math.min(base + jitter, this.reconnectMaxDelay);
      this.reconnectAttempts++;
      if (this.maxReconnectAttempts > 0 && this.reconnectAttempts > this.maxReconnectAttempts) return;
      var self = this;
      try {
        this._reconnectTimeout = setTimeout(function () {
          self._reconnectTimeout = null;
          if (typeof self._doConnect === 'function') self._doConnect();
        }, delay);
      } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('[Gateway] scheduleReconnect error:', e); }
    }

    handleMessage(message) {
      if (!message || typeof message !== 'object') return;
      var op = message.op;
      var type = message.type;
      var d = message.d;
      var t = message.t;
      var data = message.data;
      var s = message.s;
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
        var fromId = message.from_user_id != null ? String(message.from_user_id) : null;
        var payload = message.payload;
        if (type === 'webrtc_offer' && fromId) {
          this.pendingOffers.set(fromId, payload);
          this.emit(type, { from_user_id: fromId, payload: payload });
          this.emit('webrtc_incoming_call', { from_user_id: fromId, payload: payload });
          return;
        }
        if (type === 'webrtc_answer' && fromId) {
          var peerEntry = this.peers.get(fromId);
          if (peerEntry && peerEntry.pc) {
            peerEntry.pc.setRemoteDescription(new RTCSessionDescription(payload)).catch(function (err) {
              if (typeof console !== 'undefined' && console.error) console.error('[Gateway] setRemoteDescription(answer) error:', err);
            });
          }
          this.emit(type, { from_user_id: fromId, payload: payload });
          return;
        }
        if (type === 'webrtc_ice' && fromId && payload) {
          var peerEntryIce = this.peers.get(fromId);
          if (peerEntryIce && peerEntryIce.pc) {
            peerEntryIce.pc.addIceCandidate(new RTCIceCandidate(payload)).catch(function (err) {
              if (typeof console !== 'undefined' && console.error) console.error('[Gateway] addIceCandidate error:', err);
            });
          }
          this.emit(type, { from_user_id: fromId, payload: payload });
          return;
        }
        if (type === 'webrtc_reject' && fromId) {
          this.pendingOffers.delete(fromId);
          this.emit(type, { from_user_id: fromId });
          this.emit('webrtc_call_rejected', { from_user_id: fromId });
          return;
        }
        if (type === 'webrtc_hangup' && fromId) {
          var entry = this.peers.get(fromId);
          if (entry) {
            if (entry.localStream && typeof entry.localStream.getTracks === 'function') entry.localStream.getTracks().forEach(function (t) { t.stop(); });
            if (entry.pc) try { entry.pc.close(); } catch (_) {}
            this.peers.delete(fromId);
          }
          this.emit(type, { from_user_id: fromId });
          this.emit('webrtc_call_ended', { from_user_id: fromId });
          return;
        }
        this.emit(type, { from_user_id: message.from_user_id, payload: message.payload });
        return;
      }

      if (s !== undefined && typeof s === 'number') this.seq = s;
      var safeD = d != null && typeof d === 'object' ? d : {};
      try {
      switch (op) {
        case 'hello': {
          this._clearHelloTimeout();
          var hiInterval = (d && typeof d.heartbeat_interval === 'number' && d.heartbeat_interval >= 5000) ? d.heartbeat_interval : 45000;
          if (typeof this.startHeartbeat === 'function') this.startHeartbeat(hiInterval);
          var tok = typeof API !== 'undefined' && API && typeof API.Token !== 'undefined' && API.Token && typeof API.Token.getAccessToken === 'function' ? API.Token.getAccessToken() : (typeof localStorage !== 'undefined' && localStorage.getItem ? (localStorage.getItem('access_token') || localStorage.getItem('token') || '') : '');
          if (tok && typeof this.send === 'function') this.send('authenticate', { token: tok });
          break;
        }
        case 'authenticated': {
          this._clearHelloTimeout();
          this.authenticated = true;
          this.sessionId = (d && d.session_id != null) ? d.session_id : null;
          if (this._connectFulfillRef != null) this._resolveConnect(d && typeof d === 'object' ? d : {});
          break;
        }
        case 'auth_failed': {
          this._clearHelloTimeout();
          this.emit('auth_failed', d && typeof d === 'object' ? d : {});
          var refAuth = this._connectRejectRef;
          this._connectFulfillRef = null;
          this._connectRejectRef = null;
          this._connectIntent = false;
          if (refAuth && typeof refAuth.current === 'function') {
            try { refAuth.current(new Error((d && d.reason != null) ? String(d.reason) : 'Auth failed')); } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('[Gateway] auth_failed callback error:', e); }
          }
          break;
        }

        case 'heartbeat_ack':
          this.emit('heartbeat_ack', safeD);
          break;
        case 'message_created':
          this.emit('message', (d && d.message != null) ? d.message : safeD);
          break;
        case 'message_updated':
          this.emit('message_update', safeD);
          break;
        case 'message_deleted':
          this.emit('message_delete', safeD);
          break;
        case 'typing_started':
          this.emit('typing', safeD);
          break;
        case 'presence_update':
          this.emit('presence', safeD);
          break;
        case 'server_created':
          this.emit('server_create', safeD);
          break;
        case 'server_updated':
          this.emit('server_update', safeD);
          break;
        case 'server_deleted':
          this.emit('server_delete', safeD);
          break;
        case 'channel_created':
          this.emit('channel_create', safeD);
          break;
        case 'channel_updated':
          this.emit('channel_update', safeD);
          break;
        case 'channel_deleted':
          this.emit('channel_delete', safeD);
          break;
        case 'member_joined':
          this.emit('member_join', safeD);
          break;
        case 'member_left':
          this.emit('member_leave', safeD);
          break;
        case 'member_updated':
          this.emit('member_update', safeD);
          break;
        case 'role_created':
          this.emit('role_create', safeD);
          break;
        case 'role_updated':
          this.emit('role_update', safeD);
          break;
        case 'role_deleted':
          this.emit('role_delete', safeD);
          break;
        case 'reaction_added':
          this.emit('reaction_add', safeD);
          break;
        case 'reaction_removed':
          this.emit('reaction_remove', safeD);
          break;
        case 'error':
          if (typeof console !== 'undefined' && console.error) console.error('[Gateway] Server error:', safeD);
          this.emit('error', safeD);
          break;
        default:
          if (t != null && typeof t === 'string' && typeof this.emit === 'function') this.emit(t.toLowerCase(), safeD);
      }
      } catch (handleErr) { if (typeof console !== 'undefined' && console.error) console.error('[Gateway] handleMessage error:', handleErr); }
    }

    send(op, data) {
      if (op == null) return;
      var isStringOp = typeof op === 'string';
      var message = isStringOp ? { op: op, d: data != null && typeof data === 'object' ? data : {} } : (op && typeof op === 'object' ? op : { op: 'unknown', d: {} });
      var opName = isStringOp ? op : (message.op != null ? message.op : 'unknown');
      var opData = isStringOp ? (data != null ? data : {}) : (message.d != null ? message.d : {});
      if (this.socket && typeof this.socket.connected === 'boolean' && this.socket.connected && typeof this.socket.emit === 'function') {
        try { this.socket.emit(opName, opData); } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('[Gateway] socket.emit error:', e); }
        return;
      }
      if (this.ws && this.ws.readyState === 1 && typeof this.ws.send === 'function') {
        try { this.ws.send(JSON.stringify(message)); } catch (e) { if (typeof console !== 'undefined' && console.error) console.error('[Gateway] ws.send error:', e); }
        return;
      }
      if (Array.isArray(this.messageQueue)) this.messageQueue.push({ op: opName, data: opData });
    }

    startHeartbeat(interval) {
      if (typeof this.stopHeartbeat === 'function') this.stopHeartbeat();
      var ms = (typeof interval === 'number' && interval >= 5000) ? interval : 45000;
      var self = this;
      this.heartbeatInterval = setInterval(function () {
        if (self.connected && typeof self.send === 'function') self.send('heartbeat', { seq: self.seq });
      }, ms);
    }

    stopHeartbeat() {
      if (this.heartbeatInterval != null) {
        try { clearInterval(this.heartbeatInterval); } catch (_) {}
        this.heartbeatInterval = null;
      }
    }

    on(event, handler) {
      if (event == null || typeof handler !== 'function') return;
      if (!this.eventHandlers || !(this.eventHandlers instanceof Map)) return;
      if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
      var list = this.eventHandlers.get(event);
      if (Array.isArray(list)) list.push(handler);
    }

    off(event, handler) {
      if (event == null || !this.eventHandlers || !this.eventHandlers.has(event)) return;
      var list = this.eventHandlers.get(event);
      if (!Array.isArray(list)) return;
      var i = list.indexOf(handler);
      if (i > -1) list.splice(i, 1);
    }

    emit(event, data) {
      if (event == null || !this.eventHandlers || !this.eventHandlers.has(event)) return;
      var list = this.eventHandlers.get(event);
      if (!Array.isArray(list) || list.length === 0) return;
      var self = this;
      list.forEach(function (fn) {
        if (typeof fn !== 'function') return;
        try { fn(data); } catch (err) { if (typeof console !== 'undefined' && console.error) console.error('[Gateway] Handler error:', err); }
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
      if (typeof this._clearReconnect === 'function') this._clearReconnect();
      if (typeof this._clearHelloTimeout === 'function') this._clearHelloTimeout();
      if (typeof this.stopHeartbeat === 'function') this.stopHeartbeat();
      if (this.socket && typeof this.socket.disconnect === 'function') {
        try { this.socket.disconnect(); } catch (_) {}
        this.socket = null;
      }
      if (this.ws) {
        try { this.ws.close(1000, 'Client disconnect'); } catch (_) {}
        this.ws = null;
      }
      this.connected = false;
      this.authenticated = false;
      this._connectFulfillRef = null;
      this._connectRejectRef = null;
    }
  }

  if (typeof window !== 'undefined') window.Gateway = new LibertyGateway();
})();






