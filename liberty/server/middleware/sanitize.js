/**
 * Sanitização de entradas para prevenir XSS e injeção
 * Uso: strings de texto (nomes, conteúdo de mensagem)
 */

const xss = require('xss');

const options = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style']
};

function sanitizeString(str) {
  if (str == null || typeof str !== 'string') return '';
  return xss(str.trim(), options).slice(0, 50000);
}

function sanitizeUsername(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.trim().replace(/[<>'"&]/g, '').slice(0, 100);
}

function sanitizeObject(obj, keysToSanitize) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const key of keysToSanitize) {
    if (out[key] != null && typeof out[key] === 'string') {
      out[key] = sanitizeString(out[key]);
    }
  }
  return out;
}

module.exports = { sanitizeString, sanitizeUsername, sanitizeObject };
