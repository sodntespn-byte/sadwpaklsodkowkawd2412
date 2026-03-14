/**
 * Sanitização de strings para evitar XSS em mensagens e entradas — ESM
 */

import xss from 'xss';

const options = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style']
};

export function sanitizeString(str) {
  if (str == null || typeof str !== 'string') return '';
  return xss(str.trim(), options).slice(0, 50000);
}

export function sanitizeUsername(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.trim().replace(/[<>'"&]/g, '').slice(0, 100);
}
