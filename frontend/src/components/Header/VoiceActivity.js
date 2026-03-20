(function () {
  class VoiceActivity {
    constructor(opts) {
      this._root = document.getElementById(opts.rootId);
      this._avatarsEl = document.getElementById(opts.avatarsId);
      this._statusEl = document.getElementById(opts.statusId);
      this._avatarById = new Map();
      if (this._avatarsEl && this._avatarsEl.getAttribute) this._avatarsEl.setAttribute('aria-label', 'Membros em ligação');
    }

    setActive(active) {
      if (!this._root) return;
      if (active) this._root.classList.remove('hidden');
      else this._root.classList.add('hidden');
    }

    setMembers(members) {
      if (!this._avatarsEl) return;
      this._avatarById = new Map();
      this._avatarsEl.replaceChildren();

      const arr = Array.isArray(members) ? members : [];
      for (let i = 0; i < arr.length; i += 1) {
        const m = arr[i] || {};
        const id = String(m.id || m.userId || i);
        const el = document.createElement('div');
        el.className = 'voice-activity__avatar';
        el.id = 'voice-activity-avatar-' + id;

        if (m.avatar_url || m.avatar) {
          const img = document.createElement('img');
          img.src = String(m.avatar_url || m.avatar || '');
          img.alt = '';
          el.appendChild(img);
        } else {
          const span = document.createElement('div');
          span.className = 'voice-activity__avatar-initial';
          const name = String(m.username || m.name || '').trim() || 'U';
          span.textContent = name.charAt(0).toUpperCase();
          el.appendChild(span);
        }

        this._avatarsEl.appendChild(el);
        this._avatarById.set(id, el);
      }
    }

    setSpeaking(memberId, isSpeaking) {
      const id = String(memberId);
      const el = this._avatarById.get(id) || document.getElementById('voice-activity-avatar-' + id);
      if (!el) return;
      if (isSpeaking) el.classList.add('speaking');
      else el.classList.remove('speaking');
    }

    setStatus(text) {
      if (this._statusEl) this._statusEl.textContent = String(text || 'Em ligação');
    }
  }

  window.LibertyVoiceActivity = {
    create: function (opts) {
      const rootId = opts && opts.rootId ? opts.rootId : 'voice-activity';
      const avatarsId = opts && opts.avatarsId ? opts.avatarsId : 'voice-activity-avatars';
      const statusId = opts && opts.statusId ? opts.statusId : 'voice-activity-status';
      return new VoiceActivity({ rootId, avatarsId, statusId });
    },
  };
})();

