(function () {
  function getToken() {
    try {
      return localStorage.getItem('access_token') || localStorage.getItem('token') || '';
    } catch (_) {
      return '';
    }
  }

  function randId() {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch (_) {}
    return 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  window.LibertyVoiceChat = {
    create: function (opts) {
      const getCurrentUser = opts && opts.getCurrentUser ? opts.getCurrentUser : function () { return window.app && window.app.currentUser ? window.app.currentUser : null; };
      const tokenProvider = opts && opts.getAccessToken ? opts.getAccessToken : getToken;

      const activity = window.LibertyVoiceActivity && window.LibertyVoiceActivity.create
        ? window.LibertyVoiceActivity.create({
          rootId: opts && opts.rootId ? opts.rootId : 'voice-activity',
          avatarsId: opts && opts.avatarsId ? opts.avatarsId : 'voice-activity-avatars',
          statusId: opts && opts.statusId ? opts.statusId : 'voice-activity-status',
        })
        : null;

      const stun = [{ urls: 'stun:stun.l.google.com:19302' }];

      const state = {
        inCall: false,
        callId: null,
        localUserId: null,
        localStream: null,
        pc: null,
        pendingIce: [],
        remoteUserId: null,
        remoteUserInfo: null,
        localSpeaking: false,
        vadRaf: null,
        audioCtx: null,
        analyser: null,
        vadData: null,
        remoteAudioEl: null,
        socket: null,
        remoteSpeakingMemberId: null,
      };

      function cleanup(shouldEmitEnd) {
        if (state.vadRaf) cancelAnimationFrame(state.vadRaf);
        state.vadRaf = null;
        state.localSpeaking = false;

        if (state.audioCtx && state.audioCtx.close) {
          try { state.audioCtx.close(); } catch (_) {}
        }
        state.audioCtx = null;
        state.analyser = null;
        state.vadData = null;

        if (state.localStream) {
          state.localStream.getTracks().forEach(t => {
            try { t.stop(); } catch (_) {}
          });
        }
        state.localStream = null;

        if (state.pc) {
          try { state.pc.close(); } catch (_) {}
        }
        state.pc = null;

        state.pendingIce = [];
        state.inCall = false;
        state.callId = null;
        state.remoteUserId = null;
        state.remoteUserInfo = null;
        state.remoteSpeakingMemberId = null;

        if (activity) {
          if (state.localUserId) activity.setSpeaking(state.localUserId, false);
          activity.setStatus('Em ligação');
          activity.setActive(false);
        }
        state.localUserId = null;

        if (state.remoteAudioEl && state.remoteAudioEl.srcObject) {
          try { state.remoteAudioEl.srcObject = null; } catch (_) {}
        }
        state.remoteAudioEl = null;

        if (shouldEmitEnd && state.socket && state.callId) {
          try { state.socket.emit('voice:call-end', { callId: state.callId }); } catch (_) {}
        }
      }

      function ensureRemoteAudioEl() {
        if (state.remoteAudioEl) return state.remoteAudioEl;
        const el = document.createElement('audio');
        el.autoplay = true;
        el.playsInline = true;
        el.id = 'voice-remote-audio';
        el.style.display = 'none';
        document.body.appendChild(el);
        state.remoteAudioEl = el;
        return el;
      }

      function startVAD(localStream) {
        if (!localStream) return;
        try {
          state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const src = state.audioCtx.createMediaStreamSource(localStream);
          state.analyser = state.audioCtx.createAnalyser();
          state.analyser.fftSize = 2048;
          state.analyser.smoothingTimeConstant = 0.6;
          src.connect(state.analyser);
          state.vadData = new Uint8Array(state.analyser.fftSize);
        } catch (_) {
          state.analyser = null;
          state.vadData = null;
          return;
        }

        const sendSpeaking = speaking => {
          if (!state.socket || !state.inCall || !state.callId || !state.remoteUserId) return;
          if (state.localSpeaking === speaking) return;
          state.localSpeaking = speaking;
          if (activity && state.localUserId) activity.setSpeaking(state.localUserId, speaking);
          try { state.socket.emit('voice:speaking', { callId: state.callId, isSpeaking: speaking }); } catch (_) {}
        };

        let lastEmitAt = 0;
        const loop = () => {
          if (!state.analyser || !state.vadData) return;
          state.analyser.getByteTimeDomainData(state.vadData);
          let sum = 0;
          for (let i = 0; i < state.vadData.length; i += 1) {
            const v = (state.vadData[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / state.vadData.length);
          const speaking = rms > 0.05;
          const now = Date.now();
          if (speaking !== state.localSpeaking && now - lastEmitAt > 120) {
            lastEmitAt = now;
            sendSpeaking(speaking);
          }
          state.vadRaf = requestAnimationFrame(loop);
        };

        state.vadRaf = requestAnimationFrame(loop);
      }

      function createPeerConnection() {
        const pc = new RTCPeerConnection({ iceServers: stun });
        pc.onicecandidate = e => {
          if (!e || !e.candidate) return;
          if (!state.socket || !state.inCall || !state.callId || !state.remoteUserId) return;
          const cand = e.candidate.toJSON ? e.candidate.toJSON() : e.candidate;
          try { state.socket.emit('voice:call-ice', { callId: state.callId, candidate: cand }); } catch (_) {}
        };
        pc.ontrack = ev => {
          try {
            const stream = ev.streams && ev.streams[0] ? ev.streams[0] : null;
            const audio = ensureRemoteAudioEl();
            if (!stream) return;
            audio.srcObject = stream;
            const p = audio.play && audio.play();
            if (p && p.catch) p.catch(() => {});
          } catch (_) {}
        };
        return pc;
      }

      function drainIce() {
        if (!state.pc || !state.pc.remoteDescription) return;
        const q = state.pendingIce || [];
        state.pendingIce = [];
        for (let i = 0; i < q.length; i += 1) {
          const cand = q[i];
          try {
            state.pc.addIceCandidate(cand).catch(() => {});
          } catch (_) {}
        }
      }

      function handleRemoteIce(candidate) {
        if (!state.pc) {
          state.pendingIce.push(candidate);
          return;
        }
        if (!state.pc.remoteDescription || !state.pc.remoteDescription.type) {
          state.pendingIce.push(candidate);
          return;
        }
        try {
          state.pc.addIceCandidate(candidate).catch(() => {});
        } catch (_) {}
      }

      function emitMembers(meInfo, remoteInfo) {
        if (!activity) return;
        const list = [meInfo, remoteInfo].filter(Boolean);
        activity.setStatus('Em ligação');
        activity.setMembers(list.map(m => ({ id: m.id, username: m.username, avatar_url: m.avatar_url || m.avatar_url || m.avatar || '' })));
        activity.setActive(true);
        activity.setSpeaking(meInfo.id, false);
        activity.setSpeaking(String(remoteInfo.id), false);
      }

      function meInfoFromCurrent() {
        const me = getCurrentUser ? getCurrentUser() : null;
        const id = me && me.id ? String(me.id) : 'me';
        return {
          id: id,
          username: (me && me.username) || 'Você',
          avatar_url: (me && (me.avatar_url || me.avatar)) || null,
        };
      }

      function acceptIncomingCall(payload) {
        const fromId = payload && (payload.fromId || payload.from);
        if (!payload || !payload.callId || !fromId || !payload.offer) return;
        cleanup(false);
        const me = meInfoFromCurrent();

        state.inCall = true;
        state.callId = String(payload.callId);
        state.localUserId = me.id;
        state.remoteUserId = String(fromId);
        state.remoteUserInfo = payload.fromInfo || { id: fromId, username: 'User', avatar_url: null };
        state.remoteSpeakingMemberId = state.remoteUserId;

        emitMembers(me, {
          id: state.remoteUserId,
          username: state.remoteUserInfo.username || 'User',
          avatar_url: state.remoteUserInfo.avatar_url || null,
        });

        if (!state.socket) return;

        navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .then(stream => {
            state.localStream = stream;
            startVAD(stream);
            state.pc = createPeerConnection();
            stream.getTracks().forEach(t => {
              try { state.pc.addTrack(t, stream); } catch (_) {}
            });

            state.pc
              .setRemoteDescription(new RTCSessionDescription(payload.offer))
              .then(() => {
                drainIce();
                return state.pc.createAnswer();
              })
              .then(answer => state.pc.setLocalDescription(answer).then(() => answer))
              .then(answer => {
                const ans = answer;
                try {
                  state.socket.emit('voice:call-answer', {
                    callId: state.callId,
                    answer: ans && ans.toJSON ? ans.toJSON() : ans,
                    fromInfo: { id: me.id, username: me.username, avatar_url: me.avatar_url || null },
                  });
                } catch (_) {}
              })
              .catch(() => {});
          })
          .catch(() => {
            cleanup(false);
          });
      }

      function startCall(target) {
        const me = meInfoFromCurrent();
        if (!target || !target.id) return;
        if (state.inCall) return;
        cleanup(false);

        const callId = randId();
        state.inCall = true;
        state.callId = callId;
        state.localUserId = me.id;
        state.remoteUserId = String(target.id);
        state.remoteUserInfo = target.info || target;
        state.remoteSpeakingMemberId = state.remoteUserId;

        emitMembers(me, {
          id: state.remoteUserId,
          username: (state.remoteUserInfo && state.remoteUserInfo.username) || target.username || 'User',
          avatar_url: (state.remoteUserInfo && (state.remoteUserInfo.avatar_url || state.remoteUserInfo.avatar)) || null,
        });

        navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .then(stream => {
            state.localStream = stream;
            startVAD(stream);
            state.pc = createPeerConnection();
            stream.getTracks().forEach(t => {
              try { state.pc.addTrack(t, stream); } catch (_) {}
            });
            return state.pc
              .createOffer()
              .then(offer => state.pc.setLocalDescription(offer).then(() => offer));
          })
          .then(offer => {
            const offerPayload = offer && offer.toJSON ? offer.toJSON() : offer;
            try {
              state.socket.emit('request-voice-call', {
                callId: state.callId,
                to: state.remoteUserId,
                offer: offerPayload,
                fromId: me.id,
                fromInfo: { id: me.id, username: me.username, avatar_url: me.avatar_url || null },
              });
            } catch (_) {}
          })
          .catch(() => {
            cleanup(false);
          });
      }

      function initSocket() {
        if (!window.io) return;
        if (state.socket) return;
        const token = tokenProvider ? tokenProvider() : getToken();
        try {
          state.socket = window.io(window.location.origin, {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            auth: { token },
          });
        } catch (_) {
          state.socket = null;
          return;
        }

        state.socket.on('voice:call-incoming', payload => acceptIncomingCall(payload));
        state.socket.on('voice:call-answered', payload => {
          if (!state.inCall || !payload || String(payload.callId) !== String(state.callId)) return;
          if (!payload.answer) return;
          const ans = payload.answer && payload.answer.sdp ? payload.answer : payload.answer;
          try {
            state.pc
              .setRemoteDescription(new RTCSessionDescription(ans))
              .then(() => drainIce())
              .catch(() => {});
          } catch (_) {}
        });
        state.socket.on('voice:call-ice', payload => {
          if (!state.inCall || !payload || String(payload.callId) !== String(state.callId)) return;
          if (!payload.candidate) return;
          handleRemoteIce(payload.candidate);
        });
        state.socket.on('voice:call-ended', payload => {
          if (!payload || !payload.callId || String(payload.callId) !== String(state.callId)) return;
          cleanup(false);
        });
        state.socket.on('voice:speaking', payload => {
          if (!payload || !state.inCall || String(payload.callId) !== String(state.callId)) return;
          const from = payload.fromId ? String(payload.fromId) : payload.from ? String(payload.from) : '';
          if (!from) return;
          if (activity) activity.setSpeaking(from, !!payload.isSpeaking);
        });
      }

      initSocket();

      return {
        startCall: function (target) {
          if (!state.socket) initSocket();
          startCall(target);
        },
        endCall: function () {
          // Limpa localmente e termina no par (via servidor).
          const callId = state.callId;
          cleanup(false);
          if (!callId) return;
          if (state.socket) {
            try { state.socket.emit('voice:call-end', { callId: callId }); } catch (_) {}
          }
        },
        isInCall: function () {
          return !!state.inCall;
        },
      };
    },
  };
})();

