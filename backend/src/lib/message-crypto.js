import crypto from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = 'AESGCM:';

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw) return null;
  if (Buffer.isBuffer(raw)) return raw.length === 32 ? raw : null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length === 64 && /^[0-9a-fA-F]+$/.test(s)) {
    const b = Buffer.from(s, 'hex');
    return b.length === 32 ? b : null;
  }
  try {
    const b64 = Buffer.from(s, 'base64');
    if (b64.length === 32) return b64;
  } catch {}
  const buf = Buffer.from(s, 'utf8');
  return buf.length === 32 ? buf : null;
}

export function encrypt(plaintext) {
  const key = getKey();
  if (!key) return typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const str = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    JSON.stringify({
      iv: iv.toString('base64'),
      authTag: tag.toString('base64'),
      encryptedData: enc.toString('base64'),
    })
  );
}

export function decrypt(payload) {
  const key = getKey();
  if (!key) return payload;
  if (typeof payload !== 'string' || !payload.startsWith(PREFIX)) return payload;
  try {
    const obj = JSON.parse(payload.slice(PREFIX.length));
    if (!obj || typeof obj !== 'object') return payload;
    const iv = Buffer.from(String(obj.iv || ''), 'base64');
    const tag = Buffer.from(String(obj.authTag || ''), 'base64');
    const enc = Buffer.from(String(obj.encryptedData || ''), 'base64');
    if (iv.length !== IV_LEN || tag.length !== TAG_LEN || !enc.length) return payload;
    const decipher = crypto.createDecipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final('utf8');
  } catch {
    return payload;
  }
}

export function isEncryptionEnabled() {
  return !!getKey();
}
