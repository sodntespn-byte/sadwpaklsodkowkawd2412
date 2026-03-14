/**
 * LIBERTY - Gateway em tempo real com Socket.io
 * Conecta ao servidor Node e entrega mensagens instantâneas sem F5.
 */

(function () {
  let socket = null;
  const listeners = [];
  const webrtcListeners = [];

  function connect() {
    if (socket && socket.connected) return;
    if (typeof io === 'undefined') {
      console.warn('Socket.io client não carregado.');
      return;
    }
    const origin = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '';
    socket = io(origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    socket.on('connect', function () {
      if (window.LibertyAPI) LibertyAPI._wsReconnectAttempts = 0;
      if (window.LibertyAPI && LibertyAPI._lastSubscribedRoom) {
        socket.emit('subscribe', { room: LibertyAPI._lastSubscribedRoom });
      }
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

  function onWebRTCSignal(fn) {
    if (typeof fn === 'function' && webrtcListeners.indexOf(fn) === -1) {
      webrtcListeners.push(fn);
    }
  }

  window.LibertyWebSocket = {
    connect: connect,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    onMessage: onMessage,
    offMessage: offMessage,
    sendWebRTCSignal: sendWebRTCSignal,
    onWebRTCSignal: onWebRTCSignal,
    isConnected: function () { return socket && socket.connected; }
  };
})();
