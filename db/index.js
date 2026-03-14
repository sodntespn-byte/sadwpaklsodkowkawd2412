/**
 * Conexão PostgreSQL com mTLS (Neon / Square Cloud) — ESM
 * URL: process.env.DATABASE_URL. Certificado de cliente: certificate.pem na raiz do projeto.
 * Carregue dotenv no ponto de entrada (server.js com dotenv.config()).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const CERT_PATH = path.join(PROJECT_ROOT, 'certificate.pem');

function getUrl() {
  return process.env.DATABASE_URL || '';
}

/** Lê certificate.pem e extrai PRIVATE KEY e CERTIFICATE para mTLS */
function loadMtlsOptions() {
  try {
    const raw = fs.readFileSync(CERT_PATH, 'utf8');
    const keyMatch = raw.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/);
    const certMatch = raw.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
    if (!keyMatch || !certMatch) {
      console.warn('[DB] certificate.pem não contém PRIVATE KEY e CERTIFICATE válidos');
      return null;
    }
    return {
      rejectUnauthorized: false,
      key: keyMatch[0],
      cert: certMatch[0],
    };
  } catch (err) {
    console.warn('[DB] Erro ao carregar certificate.pem:', err.message);
    return null;
  }
}

let pool = null;
let _connected = false;

async function connect() {
  const rawUrl = getUrl();
  if (!rawUrl || !rawUrl.startsWith('postgres')) {
    console.warn('[DB] DATABASE_URL não definida ou não é PostgreSQL — banco desativado');
    return null;
  }
  if (!pool) {
    const isLocalhost = /@localhost[\s:]|@127\.0\.0\.1[\s:]/.test(rawUrl);
    const needsSsl = !isLocalhost || /sslmode=require|squareweb\.app|neon\.tech/i.test(rawUrl);
    const poolConfig = {
      connectionString: rawUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    };
    if (needsSsl) {
      const sslOptions = loadMtlsOptions();
      poolConfig.ssl = sslOptions || { rejectUnauthorized: false };
    }
    pool = new Pool(poolConfig);
  }
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    _connected = true;
    console.log('[DB] PostgreSQL conectado (mTLS)');
    return pool;
  } catch (err) {
    console.warn('[DB] PostgreSQL indisponível:', err.message);
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
  if (!pool) throw new Error('Banco não configurado. Defina DATABASE_URL no .env.');
  return pool.query(text, params);
}

export default {
  query,
  connect,
  isConfigured,
  isConnected,
  getPool: () => pool,
};

