import crypto from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = 'AES:';

function getKey() {
  const raw = process.env.MESSAGE_ENCRYPTION_KEY || process.env.LIBERTY_MESSAGE_KEY || '';
  if (!raw || raw.length < 32) return null;
  if (Buffer.isBuffer(raw)) return raw.length === 32 ? raw : null;
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) return Buffer.from(raw, 'hex');
  const buf = Buffer.from(raw, 'utf8');
  return buf.length >= 32 ? crypto.createHash('sha256').update(buf).digest() : null;
}

export function encrypt(plaintext) {
  const key = getKey();
  if (!key) return typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const str = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(payload) {
  const key = getKey();
  if (!key) return payload;
  if (typeof payload !== 'string' || !payload.startsWith(PREFIX)) return payload;
  try {
    const buf = Buffer.from(payload.slice(PREFIX.length), 'base64');
    if (buf.length < IV_LEN + TAG_LEN) return payload;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
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
