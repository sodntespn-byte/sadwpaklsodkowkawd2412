/**
 * Liberty — Conexão PostgreSQL (Neon / Square Cloud) — ESM
 * URL lida apenas dentro de funções. Square Cloud: BANCO_DADOS. Local: DATABASE_URL ou .env.
 */

import { Pool } from 'pg';

function getUrl() {
  return process.env.BANCO_DADOS || process.env.DATABASE_URL || process.env.DB_URL || '';
}

let pool = null;
let _connected = false;

async function connect() {
  const rawUrl = getUrl();
  if (!rawUrl || !rawUrl.startsWith('postgres')) {
    console.warn('[LIBERTY] BANCO_DADOS/DATABASE_URL não definida ou não é PostgreSQL — banco desativado');
    return null;
  }
  if (!pool) {
    const useSsl = /sslmode=require|channel_binding|neon\.tech/i.test(rawUrl);
    const poolConfig = {
      connectionString: rawUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    };
    if (useSsl) poolConfig.ssl = true;
    pool = new Pool(poolConfig);
  }
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    _connected = true;
    console.log('[LIBERTY] PostgreSQL conectado');
    return pool;
  } catch (err) {
    console.warn('[LIBERTY] PostgreSQL indisponível:', err.message);
    return null;
  }
}

function isConfigured() {
  return Boolean(getUrl());
}

function isConnected() {
  return _connected && pool;
}

async function query(text, params) {
  if (!pool) throw new Error('Banco não configurado (BANCO_DADOS ou DATABASE_URL)');
  return pool.query(text, params);
}

export default {
  query,
  connect,
  isConfigured,
  isConnected,
  getPool: () => pool,
};
