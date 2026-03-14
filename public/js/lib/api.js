/**
 * LIBERTY - Cliente da API do servidor (mensagens em canal e DM)
 * Se o site estiver hospedado no mesmo servidor Node, as conversas vão para o banco SQLite.
 */

(function () {
  let _apiAvailable = null;

  function base() {
    return typeof window !== 'undefined' && window.location && window.location.origin ? '' : '';
  }

  function getStoredToken() {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('token') || localStorage.getItem('liberty_token') || localStorage.getItem('access_token') || null;
  }

  function getAuthHeaders() {
    var token = getStoredToken();
    if (!token) return {};
    return { 'Authorization': 'Bearer ' + token, 'X-Auth-Token': token, 'Content-Type': 'application/json' };
  }

  function get(url) {
    return fetch((base() || window.location.origin) + url, {
      credentials: 'include',
      headers: getAuthHeaders()
    }).then(function (r) {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    });
  }

  function post(url, body) {
    var token = getStoredToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
      headers['X-Auth-Token'] = token;
    }
    var payload = body && typeof body === 'object' ? { ...body } : (body || {});
    if (token && payload && typeof payload === 'object' && !payload.token && !payload.access_token) payload.token = token;
    return fetch((base() || window.location.origin) + url, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.status !== 201 && !r.ok) throw new Error(r.statusText);
      return r.json().catch(function () { return {}; });
    });
  }

  function patch(url, body) {
    return fetch((base() || window.location.origin) + url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error(r.statusText);
      return r.json().catch(function () { return {}; });
    });
  }

  function getAuthMe() {
    return get('/api/auth/me');
  }

  function getProfileMe() {
    return get('/api/users/me');
  }

  function updateProfile(avatarUrl) {
    return patch('/api/auth/me', { avatar_url: avatarUrl || null });
  }

  function checkApi() {
    if (_apiAvailable !== null) return Promise.resolve(_apiAvailable);
    return get('/api/health')
      .then(function (data) {
        LibertyAPI._healthData = data || {};
        _apiAvailable = !!(data && data.ok);
        if (_apiAvailable && data.ws && window.LibertyWebSocket) {
          LibertyAPI._useSocketIo = true;
        }
        return _apiAvailable;
      })
      .catch(function () {
        LibertyAPI._healthData = {};
        _apiAvailable = false;
        return false;
      });
  }

  function getChannelMessages(serverId, channelId, limit) {
    var q = limit ? '?limit=' + limit : '';
    return get('/api/servers/' + encodeURIComponent(serverId) + '/channels/' + encodeURIComponent(channelId) + '/messages' + q);
  }

  function getDMMessages(conversationId, limit) {
    var q = limit ? '?limit=' + limit : '';
    return get('/api/dm/' + encodeURIComponent(conversationId) + '/messages' + q);
  }

  function postChannelMessage(serverId, channelId, payload) {
    return post('/api/servers/' + encodeURIComponent(serverId) + '/channels/' + encodeURIComponent(channelId) + '/messages', payload);
  }

  function postDMMessage(conversationId, payload) {
    return post('/api/dm/' + encodeURIComponent(conversationId) + '/messages', payload);
  }

  function postFriendRequest(fromUserId, fromUsername, toUsername) {
    return post('/api/friend-requests', { fromUserId: fromUserId, fromUsername: fromUsername, toUsername: toUsername });
  }

  function getFriendRequestsReceived(username) {
    return get('/api/friend-requests/received/' + encodeURIComponent(username));
  }

  function acceptFriendRequest(requestId, acceptedByUserId, acceptedByUsername) {
    return post('/api/friend-requests/' + encodeURIComponent(requestId) + '/accept', {
      acceptedByUserId: acceptedByUserId,
      acceptedByUsername: acceptedByUsername
    });
  }

  function getFriends(userId) {
    return get('/api/friends/' + encodeURIComponent(userId));
  }

  function friendsRequestNew(identifier) {
    var body = /^[0-9a-f-]{36}$/i.test(String(identifier).trim()) ? { id: identifier } : { username: identifier };
    var token = getStoredToken();
    return fetch((base() || window.location.origin) + '/api/friends/request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || '') },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status !== 201 && !r.ok) {
        return r.json().then(function (data) {
          var err = new Error(data && data.error ? data.error : r.statusText);
          err.status = r.status;
          err.data = data;
          throw err;
        }, function () {
          var err = new Error(r.statusText);
          err.status = r.status;
          throw err;
        });
      }
      return r.json().catch(function () { return {}; });
    });
  }

  function getFriendsPendingNew() {
    return get('/api/friends/pending');
  }

  function friendsAcceptNew(requestId) {
    return patch('/api/friends/accept', { id: requestId });
  }

  function getFriendsListNew() {
    return get('/api/friends/list');
  }

  function deleteMyAccount(userId, username) {
    return fetch((base() || window.location.origin) + '/api/account/delete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ userId: userId, username: username })
    }).then(function (r) {
      if (!r.ok) throw new Error(r.statusText);
      return r.json().catch(function () { return {}; });
    });
  }

  window.LibertyAPI = {
    checkApi: checkApi,
    isAvailable: function () { return _apiAvailable === true; },
    getStoredToken: getStoredToken,
    getAuthHeaders: getAuthHeaders,
    getAuthMe: getAuthMe,
    getProfileMe: getProfileMe,
    updateProfile: updateProfile,
    getChannelMessages: getChannelMessages,
    getDMMessages: getDMMessages,
    postChannelMessage: postChannelMessage,
    postDMMessage: postDMMessage,
    postFriendRequest: postFriendRequest,
    getFriendRequestsReceived: getFriendRequestsReceived,
    acceptFriendRequest: acceptFriendRequest,
    getFriends: getFriends,
    friendsRequestNew: friendsRequestNew,
    getFriendsPendingNew: getFriendsPendingNew,
    friendsAcceptNew: friendsAcceptNew,
    getFriendsListNew: getFriendsListNew,
    deleteMyAccount: deleteMyAccount,
    _ws: null,
    _wsListeners: [],
    _useSocketIo: false,
    _wsReconnectAttempts: 0,
    realtimeConnect: function () {
      if (window.LibertyWebSocket && LibertyAPI._healthData && LibertyAPI._healthData.ws) {
        LibertyAPI._useSocketIo = true;
        if (!LibertyAPI._socketIoForwardRegistered) {
          LibertyAPI._socketIoForwardRegistered = true;
          LibertyWebSocket.connect();
          LibertyWebSocket.onMessage(function (data) {
            LibertyAPI._wsListeners.forEach(function (fn) { fn(data); });
          });
        } else {
          LibertyWebSocket.connect();
        }
        return;
      }
      if (LibertyAPI._healthData && LibertyAPI._healthData.vercel) {
        LibertyAPI._realtimePolling = true;
        LibertyAPI._startPolling();
        return;
      }
      if (this._ws && this._ws.readyState === 1) return;
      var proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      var url = proto + '//' + window.location.host + '/ws';
      try {
        var ws = new WebSocket(url);
        ws.onopen = function () {
          LibertyAPI._ws = ws;
          LibertyAPI._wsReconnectAttempts = 0;
          if (LibertyAPI._lastSubscribedRoom) {
            LibertyAPI._ws.send(JSON.stringify({ type: 'subscribe', room: LibertyAPI._lastSubscribedRoom }));
          }
        };
        ws.onclose = function () {
          LibertyAPI._ws = null;
          var delay = Math.min(1000 * Math.pow(2, LibertyAPI._wsReconnectAttempts || 0), 30000);
          LibertyAPI._wsReconnectAttempts = (LibertyAPI._wsReconnectAttempts || 0) + 1;
          setTimeout(function () { if (LibertyAPI.isAvailable()) LibertyAPI.realtimeConnect(); }, delay);
        };
        ws.onmessage = function (ev) {
          try {
            var data = JSON.parse(ev.data);
            LibertyAPI._wsListeners.forEach(function (fn) { fn(data); });
          } catch (_) {}
        };
        ws.onerror = function () {};
      } catch (_) {}
    },
    _realtimePolling: false,
    _pollIntervalId: null,
    _lastPollRoom: null,
    _lastPollCount: 0,
    _startPolling: function () {
      if (LibertyAPI._pollIntervalId) return;
      var POLL_MS = 2500;
      LibertyAPI._pollIntervalId = setInterval(function () {
        if (!LibertyAPI._lastSubscribedRoom || !LibertyAPI._wsListeners.length) return;
        var room = LibertyAPI._lastSubscribedRoom;
        var isChannel = room.indexOf('channel:') === 0;
        var isDm = room.indexOf('dm:') === 0;
        var url;
        if (isChannel) {
          var parts = room.split(':');
          if (parts.length >= 3) url = '/api/servers/' + encodeURIComponent(parts[1]) + '/channels/' + encodeURIComponent(parts[2]) + '/messages?limit=100';
        } else if (isDm) {
          url = '/api/dm/' + encodeURIComponent(room.slice(3)) + '/messages?limit=100';
        }
        if (!url) return;
        get(url).then(function (list) {
          if (!Array.isArray(list) || LibertyAPI._lastSubscribedRoom !== room) return;
          var count = list.length;
          if (LibertyAPI._lastPollCount === 0 && count > 0) {
            LibertyAPI._lastPollCount = count;
            LibertyAPI._lastPollRoom = room;
            return;
          }
          if (count > LibertyAPI._lastPollCount) {
            var start = LibertyAPI._lastPollCount;
            for (var i = start; i < list.length; i++) {
              var msg = list[i];
              if (msg && msg.id) {
                LibertyAPI._wsListeners.forEach(function (fn) {
                  fn({ type: 'message', room: room, message: msg });
                });
              }
            }
          }
          LibertyAPI._lastPollCount = count;
          LibertyAPI._lastPollRoom = room;
        }).catch(function () {});
      }, POLL_MS);
    },
    realtimeSubscribe: function (room) {
      if (!room) return;
      LibertyAPI._lastSubscribedRoom = room;
      LibertyAPI._lastPollCount = 0;
      if (LibertyAPI._useSocketIo && window.LibertyWebSocket) {
        LibertyWebSocket.subscribe(room);
        return;
      }
      if (LibertyAPI._realtimePolling) return;
      if (!this._ws || this._ws.readyState !== 1) return;
      this._ws.send(JSON.stringify({ type: 'subscribe', room: room }));
    },
    realtimeUnsubscribe: function (room) {
      if (room && LibertyAPI._lastSubscribedRoom === room) LibertyAPI._lastSubscribedRoom = null;
      if (LibertyAPI._useSocketIo && window.LibertyWebSocket) {
        LibertyWebSocket.unsubscribe(room);
        return;
      }
      if (LibertyAPI._realtimePolling) return;
      if (!room || !this._ws || this._ws.readyState !== 1) return;
      this._ws.send(JSON.stringify({ type: 'unsubscribe', room: room }));
    },
    onRealtimeMessage: function (fn) {
      if (typeof fn === 'function' && LibertyAPI._wsListeners.indexOf(fn) === -1) {
        LibertyAPI._wsListeners.push(fn);
      }
    },
    offRealtimeMessage: function (fn) {
      var i = LibertyAPI._wsListeners.indexOf(fn);
      if (i !== -1) LibertyAPI._wsListeners.splice(i, 1);
    }
  };
})();
