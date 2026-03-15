/**
 * Configuração centralizada a partir de variáveis de ambiente.
 * Nenhum segredo ou credencial é exposto por este módulo.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = path.join(path.dirname(__dirname), 'static');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 200;

export default {
  PORT,
  STATIC_DIR,
  ALLOWED_ORIGINS,
  RATE_LIMIT_MAX,
  isProduction: process.env.NODE_ENV === 'production',
};
