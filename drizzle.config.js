/**
 * Drizzle Kit — configuração para push/generate/introspect
 * DATABASE_URL carregada via dotenv (definir no .env ou ambiente).
 */

import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.js',
  out: './drizzle',
  dbCredentials: {
    url: process.env.BANCO_DADOS || process.env.DATABASE_URL || process.env.DB_URL || '',
  },
});
