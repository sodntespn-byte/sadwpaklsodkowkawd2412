/**
 * Camada ESM que expõe lib/db para o server.js.
 * Usa o mesmo pool que lib/db; server.js depende de db/init.js para criar as tabelas (chats, servers, messages, users, etc.).
 */

import libDb from '../lib/db.js';

const pool = libDb.pool;

export default {
  isConfigured() {
    return !!pool;
  },
  isConnected() {
    return !!pool;
  },
  async connect() {
    if (pool && typeof libDb.ensureTables === 'function') {
      await libDb.ensureTables();
    }
  },
  query(sql, params) {
    if (!pool) return Promise.reject(new Error('No database'));
    return pool.query(sql, params);
  },
};
