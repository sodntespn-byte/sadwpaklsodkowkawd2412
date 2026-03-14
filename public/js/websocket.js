/**
 * LIBERTY - Gateway em tempo real com Socket.io
 * Conecta ao servidor Node e entrega mensagens instantâneas sem F5.
 */

(function () {
  let socket = null;
  let _userId = null;
  let _username = null;
  const listeners = [];
  const webrtcListeners = [];
  const friendRequestListeners = [];
  const friendAcceptedListeners = [];
  const userOnlineListeners = [];
  const userOfflineListeners = [];
  const userListListeners = [];
  const userJoinedListeners = [];
  const userLeftListeners = [];
  const profileUpdatedListeners = [];
  const incomingCallListeners = [];
  const callAnswerListeners = [];
  const callIceCandidateListeners = [];
  const callEndedListeners = [];

  function connect() {
    if (socket && socket.connected) return;
    if (typeof io === 'undefined') return;
    var host = typeof window !== 'undefined' && window.location && window.location.hostname ? window.location.hostname : '';
    if (host.indexOf('squareweb.app') !== -1) {
      return;
    }
    const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('liberty_token')) : null;
    socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      upgrade: true,
      withCredentials: true,
      auth: token ? { token: token } : {}
    });
    socket.on('connect', function () {
      if (window.LibertyAPI) LibertyAPI._wsReconnectAttempts = 0;
      if (_userId) socket.emit('auth', { userId: _userId, username: _username || '' });
      if (window.LibertyAPI && LibertyAPI._lastSubscribedRoom) {
        socket.emit('subscribe', { room: LibertyAPI._lastSubscribedRoom });
      }
    });
    socket.on('user_list', function (list) {
      userListListeners.forEach(function (fn) {
        try { fn(list); } catch (_) {}
      });
    });
    socket.on('user-joined', function (data) {
      userJoinedListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('user-left', function (data) {
      userLeftListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('profile-updated', function (data) {
      profileUpdatedListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('message', function (data) {
      listeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('webrtc-signal', function (data) {
      webrtcListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('friend:request', function (data) {
      friendRequestListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('friend:accepted', function (data) {
      friendAcceptedListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('user:online', function (data) {
      userOnlineListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('user:offline', function (data) {
      userOfflineListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('incoming-call', function (data) {
      incomingCallListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('call-answer', function (data) {
      callAnswerListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('call-ice-candidate', function (data) {
      callIceCandidateListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('call-ended', function (data) {
      callEndedListeners.forEach(function (fn) {
        try { fn(data); } catch (_) {}
      });
    });
    socket.on('disconnect', function () {
      if (!window.LibertyAPI) return;
      var delay = Math.min(1000 * Math.pow(2, LibertyAPI._wsReconnectAttempts || 0), 30000);
      LibertyAPI._wsReconnectAttempts = (LibertyAPI._wsReconnectAttempts || 0) + 1;
      setTimeout(function () {
        if (window.LibertyAPI && LibertyAPI.isAvailable()) LibertyAPI.realtimeConnect();
      }, delay);
    });
    socket.on('connect_error', function () {});
  }

  function subscribe(room) {
    if (!room) return;
    if (window.LibertyAPI) window.LibertyAPI._lastSubscribedRoom = room;
    if (socket && socket.connected) {
      socket.emit('subscribe', { room: room });
    }
  }

  function unsubscribe(room) {
    if (window.LibertyAPI && window.LibertyAPI._lastSubscribedRoom === room) {
      window.LibertyAPI._lastSubscribedRoom = null;
    }
    if (room && socket && socket.connected) {
      socket.emit('unsubscribe', { room: room });
    }
  }

  function onMessage(fn) {
    if (typeof fn === 'function' && listeners.indexOf(fn) === -1) {
      listeners.push(fn);
    }
  }

  function offMessage(fn) {
    var i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  }

  function sendWebRTCSignal(room, event, data) {
    if (socket && socket.connected && room && event) {
      socket.emit('webrtc-signal', { room: room, event: event, data: data });
    }
  }

  function sendCallUser(toUserId, offer, fromUsername) {
    if (socket && socket.connected && toUserId && offer) {
      socket.emit('call-user', { toUserId: toUserId, offer: offer, fromUsername: fromUsername || '' });
    }
  }
  function sendMakeAnswer(toUserId, answer) {
    if (socket && socket.connected && toUserId && answer) {
      socket.emit('make-answer', { toUserId: toUserId, answer: answer });
    }
  }
  function sendIceCandidates(toUserId, candidate) {
    if (socket && socket.connected && toUserId && candidate) {
      socket.emit('ice-candidates', { toUserId: toUserId, candidate: candidate });
    }
  }
  function sendCallEnded(toUserId) {
    if (socket && socket.connected && toUserId) {
      socket.emit('call-ended', { toUserId: toUserId });
    }
  }
  function onIncomingCall(fn) {
    if (typeof fn === 'function' && incomingCallListeners.indexOf(fn) === -1) incomingCallListeners.push(fn);
  }
  function onCallAnswer(fn) {
    if (typeof fn === 'function' && callAnswerListeners.indexOf(fn) === -1) callAnswerListeners.push(fn);
  }
  function onCallIceCandidate(fn) {
    if (typeof fn === 'function' && callIceCandidateListeners.indexOf(fn) === -1) callIceCandidateListeners.push(fn);
  }
  function onCallEnded(fn) {
    if (typeof fn === 'function' && callEndedListeners.indexOf(fn) === -1) callEndedListeners.push(fn);
  }

  function onWebRTCSignal(fn) {
    if (typeof fn === 'function' && webrtcListeners.indexOf(fn) === -1) {
      webrtcListeners.push(fn);
    }
  }

  function setUserId(userId, username) {
    _userId = userId || null;
    _username = (username !== undefined && username !== null) ? String(username) : (_username || '');
    if (socket && socket.connected && _userId) {
      socket.emit('auth', { userId: _userId, username: _username || '' });
    }
  }
  function onUserList(fn) {
    if (typeof fn === 'function' && userListListeners.indexOf(fn) === -1) userListListeners.push(fn);
  }
  function onUserJoined(fn) {
    if (typeof fn === 'function' && userJoinedListeners.indexOf(fn) === -1) userJoinedListeners.push(fn);
  }
  function onUserLeft(fn) {
    if (typeof fn === 'function' && userLeftListeners.indexOf(fn) === -1) userLeftListeners.push(fn);
  }
  function onProfileUpdated(fn) {
    if (typeof fn === 'function' && profileUpdatedListeners.indexOf(fn) === -1) profileUpdatedListeners.push(fn);
  }

  function onFriendRequest(fn) {
    if (typeof fn === 'function' && friendRequestListeners.indexOf(fn) === -1) friendRequestListeners.push(fn);
  }
  function onFriendAccepted(fn) {
    if (typeof fn === 'function' && friendAcceptedListeners.indexOf(fn) === -1) friendAcceptedListeners.push(fn);
  }
  function onUserOnline(fn) {
    if (typeof fn === 'function' && userOnlineListeners.indexOf(fn) === -1) userOnlineListeners.push(fn);
  }
  function onUserOffline(fn) {
    if (typeof fn === 'function' && userOfflineListeners.indexOf(fn) === -1) userOfflineListeners.push(fn);
  }

  window.LibertyWebSocket = {
    connect: connect,
    setUserId: setUserId,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    onMessage: onMessage,
    offMessage: offMessage,
    sendWebRTCSignal: sendWebRTCSignal,
    onWebRTCSignal: onWebRTCSignal,
    sendCallUser: sendCallUser,
    sendMakeAnswer: sendMakeAnswer,
    sendIceCandidates: sendIceCandidates,
    sendCallEnded: sendCallEnded,
    onIncomingCall: onIncomingCall,
    onCallAnswer: onCallAnswer,
    onCallIceCandidate: onCallIceCandidate,
    onCallEnded: onCallEnded,
    onFriendRequest: onFriendRequest,
    onFriendAccepted: onFriendAccepted,
    onUserOnline: onUserOnline,
    onUserOffline: onUserOffline,
    onUserList: onUserList,
    onUserJoined: onUserJoined,
    onUserLeft: onUserLeft,
    onProfileUpdated: onProfileUpdated,
    isConnected: function () { return socket && socket.connected; }
  };
})();
