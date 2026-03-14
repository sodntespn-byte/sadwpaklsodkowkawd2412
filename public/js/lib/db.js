/**
 * LIBERTY - IndexedDB Database Layer
 * Armazena usuários, preferências e configurações de autenticação
 */

const DB_NAME = 'LibertyDB';
const DB_VERSION = 1;
const STORE_USERS = 'users';
const STORE_SETTINGS = 'settings';
const INDEX_USERNAME = 'username';

/** Ordem de prioridade do MFA (1 = mais alta) */
const MFA_PRIORITY = ['yubikey', 'hardware_uuid', 'mac_address', 'ip', 'phone_verification', 'windows_hello', 'email_verification', 'password', 'pin'];

/** Schema padrão de métodos de autenticação */
const DEFAULT_AUTH_METHODS = {
    yubikey: { enabled: false, configured: false },
    hardware_uuid: { enabled: false, value: null },
    mac_address: { enabled: false, value: null },
    ip: { enabled: false, value: null },
    phone_verification: { enabled: false, configured: false, phone: null },
    windows_hello: { enabled: false, configured: false },
    email_verification: { enabled: false, configured: false },
    password: { enabled: false, configured: false },
    pin: { enabled: false, configured: false }
};

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_USERS)) {
                const usersStore = db.createObjectStore(STORE_USERS, { keyPath: 'id' });
                usersStore.createIndex(INDEX_USERNAME, 'username', { unique: true });
            }
            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
            }
        };
    });
}

async function migrateFromLocalStorage() {
    const usersJson = localStorage.getItem('liberty_users');
    if (!usersJson) return false;
    let users;
    try {
        if (typeof window !== 'undefined' && window.LibertyCrypto && LibertyCrypto.looksEncrypted(usersJson)) {
            users = await LibertyCrypto.decryptFromStorage(usersJson);
        } else {
            users = JSON.parse(usersJson);
        }
    } catch (e) {
        console.warn('Migration from localStorage failed:', e);
        return false;
    }
    if (!users || typeof users !== 'object') return false;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_USERS, 'readwrite');
        const store = tx.objectStore(STORE_USERS);
        for (const [username, user] of Object.entries(users)) {
            if (!user || typeof user !== 'object') continue;
            const normalized = normalizeUser(user);
            store.put(normalized);
        }
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        localStorage.removeItem('liberty_users');
        return true;
    } catch (e) {
        console.warn('Migration from localStorage failed:', e);
        return false;
    }
}

function normalizeUser(user) {
    const auth = user.auth_methods || {};
    const methods = { ...DEFAULT_AUTH_METHODS };
    for (const k of Object.keys(DEFAULT_AUTH_METHODS)) {
        if (auth[k]) methods[k] = { ...DEFAULT_AUTH_METHODS[k], ...auth[k] };
    }
    if (user.password || user.password_hash) methods.password.configured = true;
    if (user.pin_hash) methods.pin.configured = true;
    if (user.email) methods.email_verification.configured = true;
    if (user.hwid) {
        methods.hardware_uuid.enabled = true;
        methods.hardware_uuid.value = user.hwid;
    }
    if (methods.ip?.value) methods.ip.configured = true;
    if (methods.mac_address?.value) methods.mac_address.configured = true;
    if (methods.hardware_uuid?.value || user.hwid) methods.hardware_uuid.configured = true;
    return {
        id: user.id || crypto.randomUUID(),
        username: user.username || '',
        tag: user.tag || '',
        email: user.email || '',
        password: '', // nunca persistir senha em claro
        password_hash: user.password_hash || null,
        password_salt: user.password_salt || null,
        pin_hash: user.pin_hash || null,
        hwid: user.hwid || '',
        avatar: user.avatar || null,
        serverAvatars: user.serverAvatars || {},
        banner: user.banner || null,
        bio: user.bio || '',
        profileColor: user.profileColor || '#FFFF00',
        status: user.status || 'online',
        subscription: user.subscription || 'free',
        lang: user.lang || 'en',
        activityMinutes: user.activityMinutes || 0,
        contentXP: user.contentXP || 0,
        auth_methods: methods,
        created_at: user.created_at || Date.now(),
        last_login_at: user.last_login_at || Date.now()
    };
}

const LibertyDB = {
    async init() {
        await migrateFromLocalStorage();
        return openDB();
    },

    async getUserByUsername(username) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_USERS, 'readonly');
            const idx = tx.objectStore(STORE_USERS).index(INDEX_USERNAME);
            const req = idx.get(username);
            req.onsuccess = () => {
                db.close();
                resolve(req.result ? normalizeUser(req.result) : null);
            };
            req.onerror = () => {
                db.close();
                reject(req.error);
            };
        });
    },

    async getUserById(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_USERS, 'readonly');
            const req = tx.objectStore(STORE_USERS).get(id);
            req.onsuccess = () => {
                db.close();
                resolve(req.result ? normalizeUser(req.result) : null);
            };
            req.onerror = () => {
                db.close();
                reject(req.error);
            };
        });
    },

    async saveUser(user) {
        const normalized = normalizeUser(user);
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_USERS, 'readwrite');
            tx.objectStore(STORE_USERS).put(normalized);
            tx.oncomplete = () => {
                db.close();
                resolve(normalized);
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        });
    },

    async getAllUsernames() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_USERS, 'readonly');
            const req = tx.objectStore(STORE_USERS).getAll();
            req.onsuccess = () => {
                db.close();
                resolve((req.result || []).map(u => u.username));
            };
            req.onerror = () => {
                db.close();
                reject(req.error);
            };
        });
    },

    async getAllUsers() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_USERS, 'readonly');
            const req = tx.objectStore(STORE_USERS).getAll();
            req.onsuccess = () => {
                db.close();
                resolve((req.result || []).map(u => normalizeUser(u)));
            };
            req.onerror = () => {
                db.close();
                reject(req.error);
            };
        });
    },

    async deleteUser(id) {
        if (!id) return;
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_USERS, 'readwrite');
            tx.objectStore(STORE_USERS).delete(id);
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        });
    },

    async getSetting(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_SETTINGS, 'readonly');
            const req = tx.objectStore(STORE_SETTINGS).get(key);
            req.onsuccess = () => {
                db.close();
                resolve(req.result ? req.result.value : null);
            };
            req.onerror = () => {
                db.close();
                reject(req.error);
            };
        });
    },

    async setSetting(key, value) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_SETTINGS, 'readwrite');
            tx.objectStore(STORE_SETTINGS).put({ key, value });
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        });
    }
};

if (typeof window !== 'undefined') {
    window.LibertyDB = LibertyDB;
    window.MFA_PRIORITY = MFA_PRIORITY;
}
