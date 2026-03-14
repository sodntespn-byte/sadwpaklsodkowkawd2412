/**
 * LIBERTY - Módulo de criptografia (AES-GCM + PBKDF2)
 * Segurança adicional para dados em repouso e derivação de chaves
 */

const AES_GCM_IV_LENGTH = 12;
const AES_GCM_TAG_LENGTH = 128;
const PBKDF2_ITERATIONS = 310000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 256;

/**
 * Gera bytes aleatórios (CSPRNG)
 */
function getRandomBytes(length) {
    const arr = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
    }
    return arr;
}

/**
 * Converte ArrayBuffer para Base64
 */
function bufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

/**
 * Converte Base64 para Uint8Array
 */
function base64ToBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/**
 * Deriva chave AES a partir de senha usando PBKDF2
 */
async function deriveKey(password, salt) {
    if (!password || typeof password !== 'string') throw new Error('Password inválida');
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    const saltBuf = salt instanceof Uint8Array ? salt : new Uint8Array(salt);
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBuf,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Cifra dados com AES-GCM
 */
async function aesGcmEncrypt(plaintext, key) {
    const iv = getRandomBytes(AES_GCM_IV_LENGTH);
    const enc = new TextEncoder();
    const data = enc.encode(typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext));
    const cipher = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv,
            tagLength: AES_GCM_TAG_LENGTH
        },
        key,
        data
    );
    const combined = new Uint8Array(iv.length + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.length);
    return bufferToBase64(combined);
}

/**
 * Decifra dados com AES-GCM
 */
async function aesGcmDecrypt(ciphertextBase64, key) {
    const combined = base64ToBuffer(ciphertextBase64);
    if (combined.length < AES_GCM_IV_LENGTH + 16) throw new Error('Dados cifrados inválidos');
    const iv = combined.slice(0, AES_GCM_IV_LENGTH);
    const cipher = combined.slice(AES_GCM_IV_LENGTH);
    const dec = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv,
            tagLength: AES_GCM_TAG_LENGTH
        },
        key,
        cipher
    );
    const decStr = new TextDecoder().decode(dec);
    try {
        return JSON.parse(decStr);
    } catch {
        return decStr;
    }
}

/**
 * Obtém ou gera chave de sessão para cifrar dados em repouso (localStorage)
 */
const SESSION_KEY_STORAGE = 'liberty_session_key';

async function getOrCreateSessionKey() {
    if (typeof sessionStorage === 'undefined') return null;
    let keyB64 = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (keyB64) {
        const keyBytes = base64ToBuffer(keyB64);
        return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }
    const keyBytes = getRandomBytes(32);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    sessionStorage.setItem(SESSION_KEY_STORAGE, bufferToBase64(keyBytes));
    return key;
}

/**
 * Verifica se uma string parece ser payload cifrado (base64 com IV+tag)
 */
function looksEncrypted(str) {
    if (typeof str !== 'string' || str.length < 40) return false;
    try {
        const decoded = base64ToBuffer(str);
        return decoded.length >= AES_GCM_IV_LENGTH + 16;
    } catch {
        return false;
    }
}

/**
 * Cifra objeto/string para armazenamento seguro (usa chave de sessão)
 */
async function encryptForStorage(data) {
    const key = await getOrCreateSessionKey();
    if (!key) return typeof data === 'string' ? data : JSON.stringify(data);
    return aesGcmEncrypt(data, key);
}

/**
 * Decifra dado armazenado (detecta se está cifrado)
 */
async function decryptFromStorage(raw) {
    if (raw == null || raw === '') return null;
    if (!looksEncrypted(raw)) {
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    }
    const key = await getOrCreateSessionKey();
    if (!key) return null;
    try {
        return await aesGcmDecrypt(raw, key);
    } catch {
        return null;
    }
}

/**
 * Hash seguro para senha com salt único (PBKDF2-SHA256)
 * Retorna { salt (base64), hash (hex) } para armazenar; use verifyPassword para verificar
 */
async function hashPasswordWithSalt(password) {
    const salt = getRandomBytes(SALT_LENGTH);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        256
    );
    const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return { salt: bufferToBase64(salt), hash };
}

/**
 * Verifica senha contra salt + hash armazenados (compara em tempo constante via caller)
 */
async function verifyPasswordWithSalt(password, saltBase64, expectedHash) {
    const salt = base64ToBuffer(saltBase64);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        256
    );
    const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hash === expectedHash;
}

/**
 * Hash legado (sem salt) - apenas para migração; preferir hashPasswordWithSalt
 */
async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = await crypto.subtle.digest('SHA-256', enc.encode(password));
    return Array.from(new Uint8Array(data)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const LibertyCrypto = {
    getRandomBytes,
    bufferToBase64,
    base64ToBuffer,
    deriveKey,
    aesGcmEncrypt,
    aesGcmDecrypt,
    getOrCreateSessionKey,
    encryptForStorage,
    decryptFromStorage,
    looksEncrypted,
    hashPassword,
    hashPasswordWithSalt,
    verifyPasswordWithSalt,
    AES_GCM_IV_LENGTH,
    PBKDF2_ITERATIONS
};

if (typeof window !== 'undefined') {
    window.LibertyCrypto = LibertyCrypto;
}
