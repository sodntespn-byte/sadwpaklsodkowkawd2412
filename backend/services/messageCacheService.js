import { encrypt, decrypt } from '../src/lib/message-crypto.js';

const cache = new Map();

/**
 * @param {string} chatId
 * @returns {any[]}
 */
function list(chatId) {
  const raw = cache.get(String(chatId)) || null;
  if (!raw) return [];
  const decoded = decrypt(raw);
  try {
    const list = JSON.parse(typeof decoded === 'string' ? decoded : '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} chatId
 * @param {any} message
 * @param {number} max
 * @returns {any[]}
 */
function push(chatId, message, max) {
  const key = String(chatId);
  let list0 = list(key);
  const id = message && (message.id || message.message_id);
  if (id != null) list0 = list0.filter(m => String(m.id || m.message_id) !== String(id));
  list0.push(message);
  if (list0.length > max) list0 = list0.slice(-max);
  cache.set(key, encrypt(JSON.stringify(list0)));
  return list0;
}

/**
 * @param {string} chatId
 * @param {string} id
 * @returns {any|null}
 */
function getById(chatId, id) {
  if (!id) return null;
  const list0 = list(chatId);
  for (let i = list0.length - 1; i >= 0; i -= 1) {
    const m = list0[i];
    const mid = m && (m.id || m.message_id);
    if (mid != null && String(mid) === String(id)) return m;
  }
  return null;
}

/**
 * @returns {void}
 */
function clear() {
  cache.clear();
}

export default {
  cache,
  list,
  push,
  getById,
  clear,
};

