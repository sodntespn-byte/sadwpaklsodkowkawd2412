import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

/**
 * Cria um wrapper de base de dados (Neon/Postgres) com reconexão e SSL.
 * @param {{ logger: any, rootDir: string, isProduction: boolean }} opts
 * @returns {{ query: Function, connect: Function, ensureConnected: Function, isConfigured: Function, isConnected: Function, getPool: Function, getUrl: Function }}
 */
export function createDatabase(opts) {
  const logger = opts && opts.logger ? opts.logger : console;
  const rootDir = opts && opts.rootDir ? opts.rootDir : process.cwd();
  const isProduction = !!(opts && opts.isProduction);

  const DB_ENV_KEYS = [
    'DATABASE_URL',
    'BANCO_DADOS',
    'DB_URL',
    'Database',
    'DATABASE',
    'database_url',
    'Database_URL',
    'DatabaseUrl',
    'POSTGRES_URL',
    'POSTGRESQL_URL',
    'POSTGRES_CONNECTION',
    'SQL_DATABASE_URL',
    'NEON_DATABASE_URL',
    'DB_CONNECTION_STRING',
    'DATABASE_CONNECTION',
    'CONNECTION_STRING',
    'PG_URL',
    'POSTGRESQL_URI',
  ];

  const FALLBACK_URL =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    '';

  function getUrl() {
    for (let i = 0; i < DB_ENV_KEYS.length; i += 1) {
      const k = DB_ENV_KEYS[i];
      const v = process.env[k];
      if (v && typeof v === 'string' && v.trim().toLowerCase().startsWith('postgres')) return v.trim();
    }
    if (FALLBACK_URL && typeof FALLBACK_URL === 'string') return FALLBACK_URL.trim();
    for (const v of Object.values(process.env)) {
      if (v && typeof v === 'string' && v.trim().toLowerCase().startsWith('postgresql://')) return v.trim();
    }
    return '';
  }

  function loadMtlsOptions() {
    try {
      const certPath = path.join(rootDir, 'backend', 'certificate.pem');
      const raw = fs.readFileSync(certPath, 'utf8');
      const keyMatch = raw.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/);
      const certMatch = raw.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
      if (!keyMatch || !certMatch) return null;
      return { rejectUnauthorized: false, key: keyMatch[0], cert: certMatch[0] };
    } catch {
      return null;
    }
  }

  let pool = null;
  let connected = false;

  async function connect() {
    let rawUrl = getUrl();
    if (!rawUrl || !rawUrl.startsWith('postgres')) {
      if (isProduction) logger.error('LIBERTY', 'DATABASE_URL é obrigatória em produção. Defina no ambiente.');
      connected = false;
      return null;
    }

    if (rawUrl.includes('channel_binding=require')) {
      rawUrl = rawUrl
        .replace(/&channel_binding=require/g, '')
        .replace(/\?channel_binding=require&?/g, '?')
        .replace(/\?&/, '?');
    }
    if (rawUrl.includes('sslmode=require') && !rawUrl.includes('uselibpqcompat')) {
      rawUrl = rawUrl.includes('?') ? rawUrl + '&uselibpqcompat=true' : rawUrl + '?uselibpqcompat=true';
    }

    if (!pool) {
      const isLocalhost = /@localhost[\s:]|@127\.0\.0\.1[\s:]/.test(rawUrl);
      const isNeon = /\.neon\.tech\//.test(rawUrl);
      const poolConfig = {
        connectionString: rawUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      };
      if (!isLocalhost) {
        const mtls = loadMtlsOptions();
        poolConfig.ssl = mtls || (isNeon ? { rejectUnauthorized: false } : { rejectUnauthorized: true });
      }
      pool = new Pool(poolConfig);
    }

    const tryConnect = async () => {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
    };

    try {
      await tryConnect();
      connected = true;
      logger.info('[LIBERTY] PostgreSQL conectado');
      return pool;
    } catch (err) {
      logger.warn('[LIBERTY] PostgreSQL primeira tentativa:', err.message);
      connected = false;
      await new Promise(r => setTimeout(r, 2500));
      try {
        await tryConnect();
        connected = true;
        logger.info('[LIBERTY] PostgreSQL conectado (2ª tentativa)');
        return pool;
      } catch (err2) {
        logger.warn('[LIBERTY] PostgreSQL indisponível:', err2.message);
        connected = false;
        return null;
      }
    }
  }

  return {
    getUrl,
    getPool: () => pool,
    isConfigured: () => Boolean(getUrl()),
    isConnected: () => connected && pool,
    connect,
    async ensureConnected() {
      if (!getUrl()) return false;
      if (connected && pool) return true;
      await connect();
      return connected && pool;
    },
    query(text, params) {
      if (!pool) throw new Error('Banco não configurado. Defina DATABASE_URL.');
      return pool.query(text, params);
    },
  };
}

import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { logger } from '../src/lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _dbPool = null;
let _dbConnected = false;

/**
 * @returns {string}
 */
function getDatabaseUrl() {
  const raw = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || '';
  return String(raw || '').trim();
}

/**
 * @returns {{rejectUnauthorized: boolean, key: string, cert: string} | null}
 */
function loadMtlsOptions() {
  try {
    const CERT_PATH = path.join(__dirname, '..', 'certificate.pem');
    const raw = fs.readFileSync(CERT_PATH, 'utf8');
    const keyMatch = raw.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/);
    const certMatch = raw.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
    if (!keyMatch || !certMatch) return null;
    return { rejectUnauthorized: false, key: keyMatch[0], cert: certMatch[0] };
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<Pool|null>}
 */
async function connect() {
  let rawUrl = getDatabaseUrl();
  if (!rawUrl || !rawUrl.startsWith('postgres')) return null;
  if (rawUrl.includes('channel_binding=require')) {
    rawUrl = rawUrl
      .replace(/&channel_binding=require/g, '')
      .replace(/\?channel_binding=require&?/g, '?')
      .replace(/\?&/, '?');
  }
  if (rawUrl.includes('sslmode=require') && !rawUrl.includes('uselibpqcompat')) {
    rawUrl = rawUrl.includes('?') ? rawUrl + '&uselibpqcompat=true' : rawUrl + '?uselibpqcompat=true';
  }
  if (!_dbPool) {
    const isLocalhost = /@localhost[\s:]|@127\.0\.0\.1[\s:]/.test(rawUrl);
    const isNeon = /\.neon\.tech\//.test(rawUrl);
    const poolConfig = { connectionString: rawUrl, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 };
    if (!isLocalhost) {
      const mtls = loadMtlsOptions();
      poolConfig.ssl = mtls || (isNeon ? { rejectUnauthorized: false } : { rejectUnauthorized: true });
    }
    _dbPool = new Pool(poolConfig);
  }
  try {
    const client = await _dbPool.connect();
    await client.query('SELECT 1');
    client.release();
    _dbConnected = true;
    return _dbPool;
  } catch (err) {
    _dbConnected = false;
    logger.warn('[DB] connect:', err.message);
    return null;
  }
}

/**
 * @param {string} text
 * @param {any[]} [params]
 * @returns {Promise<any>}
 */
function query(text, params) {
  if (!_dbPool) throw new Error('Banco não configurado. Defina DATABASE_URL.');
  return _dbPool.query(text, params);
}

/**
 * @returns {Promise<boolean>}
 */
async function ensureConnected() {
  if (!getDatabaseUrl()) return false;
  if (_dbConnected && _dbPool) return true;
  await connect();
  return _dbConnected && !!_dbPool;
}

export default {
  query,
  connect,
  ensureConnected,
  isConfigured: () => Boolean(getDatabaseUrl()),
  isConnected: () => _dbConnected && _dbPool,
  getPool: () => _dbPool,
};

