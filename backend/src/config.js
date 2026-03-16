/**
 * Configuração centralizada a partir de variáveis de ambiente.
 * Nenhum segredo ou credencial é exposto por este módulo.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
// Frontend está na pasta frontend/ (irmã de backend/)
const STATIC_DIR = path.join(path.dirname(__dirname), '..', 'frontend');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 200;

const MAX_UPLOAD_BYTES = process.env.MAX_UPLOAD_MB
  ? Math.min(Number(process.env.MAX_UPLOAD_MB) * 1024 * 1024, 1024 * 1024 * 1024)
  : 100 * 1024 * 1024;

const FORCE_HTTPS = process.env.FORCE_HTTPS !== 'false' && process.env.NODE_ENV === 'production';

export default {
  PORT,
  STATIC_DIR,
  ALLOWED_ORIGINS,
  RATE_LIMIT_MAX,
  MAX_UPLOAD_BYTES,
  FORCE_HTTPS,
  isProduction: process.env.NODE_ENV === 'production',
};
