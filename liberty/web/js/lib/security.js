/**
 * LIBERTY - Módulo de Segurança (nível alto)
 * Rate limiting, comparação em tempo constante, validação de dados, sanitização
 */

const LIBERTY_SECURITY = {
    /** Máximo de tentativas de login/verificação por janela */
    RATE_LIMIT_ATTEMPTS: 5,
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
    _attempts: [],
    _lockUntil: 0,

    /**
     * Comparação em tempo constante para evitar timing attacks (códigos, tokens)
     */
    secureCompare(a, b) {
        if (a == null || b == null) return false;
        const sa = String(a);
        const sb = String(b);
        if (sa.length !== sb.length) {
            let dummy = 0;
            for (let i = 0; i < sa.length; i++) dummy |= sa.charCodeAt(i);
            return false;
        }
        let out = 0;
        for (let i = 0; i < sa.length; i++) out |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
        return out === 0;
    },

    /**
     * Rate limiting: retorna true se a ação for permitida, false se bloqueada
     */
    checkRateLimit() {
        const now = Date.now();
        if (now < this._lockUntil) return false;
        this._attempts = this._attempts.filter(t => now - t < this.RATE_LIMIT_WINDOW_MS);
        if (this._attempts.length >= this.RATE_LIMIT_ATTEMPTS) {
            this._lockUntil = now + this.RATE_LIMIT_WINDOW_MS;
            return false;
        }
        this._attempts.push(now);
        return true;
    },

    resetRateLimit() {
        this._attempts = [];
        this._lockUntil = 0;
    },

    getRemainingLockMs() {
        const now = Date.now();
        if (now >= this._lockUntil) return 0;
        return this._lockUntil - now;
    },

    /**
     * Escapa HTML para uso em texto (evita XSS)
     */
    escapeHtml(str) {
        if (str == null) return '';
        const s = String(str);
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    },

    /**
     * Sanitiza string para uso em atributo (evita quebra de aspas)
     */
    escapeAttr(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    /**
     * URL permitida: apenas data:image/ e https: (nunca javascript:, vbscript:, etc.)
     */
    isAllowedUrl(url) {
        if (url == null || typeof url !== 'string') return false;
        const u = url.trim();
        const lower = u.toLowerCase();
        if (lower.startsWith('data:image/')) return true;
        if (lower.startsWith('https:')) return true;
        return false;
    },

    /**
     * Retorna a URL se segura, ou string vazia
     */
    sanitizeUrlStrict(url) {
        if (url == null || typeof url !== 'string') return '';
        const u = url.trim();
        return this.isAllowedUrl(u) ? u : '';
    },

    /**
     * Valida objeto lido do storage: sem __proto__, constructor, ou chaves perigosas
     */
    sanitizeStoredObject(obj, maxDepth = 10) {
        if (obj == null || maxDepth <= 0) return null;
        const dangerous = ['__proto__', 'constructor', 'prototype'];
        if (typeof obj !== 'object') return obj;
        const out = Array.isArray(obj) ? [] : {};
        for (const k of Object.keys(obj)) {
            if (dangerous.includes(k)) continue;
            try {
                const v = obj[k];
                if (typeof v === 'object' && v !== null) {
                    out[k] = this.sanitizeStoredObject(v, maxDepth - 1);
                } else {
                    out[k] = v;
                }
            } catch (_) { /* skip */ }
        }
        return out;
    },

    /**
     * Valida que uma string é um ID seguro (UUID-like ou alfanumérico limitado)
     */
    isSafeId(id) {
        if (id == null || typeof id !== 'string') return false;
        return /^[a-zA-Z0-9_-]{1,128}$/.test(id.trim());
    }
};

if (typeof window !== 'undefined') {
    window.LIBERTY_SECURITY = LIBERTY_SECURITY;
}
