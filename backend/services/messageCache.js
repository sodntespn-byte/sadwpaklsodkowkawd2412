/**
 * Cache de mensagens em memória (por chatId) com criptografia AES-256-GCM.
 * Armazena a lista inteira criptografada por canal, com limite fixo.
 * @param {{ encrypt: Function, decrypt: Function, maxPerChannel: number }} opts
 * @returns {{ clear: Function, push: Function, list: Function, last: Function }}
 */
export function createMessageCache(opts) {
  const encrypt = opts.encrypt;
  const decrypt = opts.decrypt;
  const maxPerChannel = Math.max(1, Number(opts.maxPerChannel) || 100);
  const store = new Map();

  function _read(chatId) {
    const raw = store.get(String(chatId)) || null;
    if (!raw) return [];
    const decoded = decrypt(raw);
    try {
      const list = JSON.parse(typeof decoded === 'string' ? decoded : '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  return {
    clear() {
      store.clear();
    },
    push(chatId, message) {
      if (!chatId || !message) return;
      const key = String(chatId);
      let list = _read(key);
      const id = message.id || message.message_id;
      if (id != null) list = list.filter(m => String(m.id || m.message_id) !== String(id));
      list.push(message);
      if (list.length > maxPerChannel) list = list.slice(-maxPerChannel);
      store.set(key, encrypt(JSON.stringify(list)));
    },
    list(chatId) {
      if (!chatId) return [];
      return _read(String(chatId));
    },
    last(chatId, id) {
      if (!chatId) return null;
      const list = _read(String(chatId));
      if (!list.length) return null;
      if (id == null) return list[list.length - 1] || null;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const m = list[i];
        if (String(m.id || m.message_id) === String(id)) return m;
      }
      return null;
    },
  };
}

