/**
 * Liberty — Store de mensagens não lidas (DMs), estilo Discord.
 * Persistência em LocalStorage; contagem por canal; subscribe para React/UI.
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'liberty_dm_unread';

    function load() {
        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const o = JSON.parse(raw);
            return typeof o === 'object' && o !== null ? o : {};
        } catch (_) {
            return {};
        }
    }

    function save(counts) {
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
        } catch (_) {}
    }

    let counts = load();
    const listeners = new Set();

    function notify() {
        listeners.forEach(function (fn) {
            try {
                fn(getCounts());
            } catch (e) {
                console.warn('[Liberty DM Unread] listener error', e);
            }
        });
    }

    function getCounts() {
        return { ...counts };
    }

    function getCount(channelId) {
        if (!channelId) return 0;
        const n = counts[String(channelId)];
        return typeof n === 'number' && n > 0 ? n : 0;
    }

    function setUnread(channelId, valueOrIncrement) {
        if (!channelId) return;
        const key = String(channelId);
        const prev = counts[key] || 0;
        const next = typeof valueOrIncrement === 'number' && valueOrIncrement >= 0
            ? valueOrIncrement
            : prev + (typeof valueOrIncrement === 'number' ? valueOrIncrement : 1);
        const newCount = Math.max(0, Math.min(999, Math.floor(next)));
        if (newCount === 0) {
            delete counts[key];
        } else {
            counts[key] = newCount;
        }
        save(counts);
        notify();
        return newCount;
    }

    function increment(channelId) {
        return setUnread(channelId, (counts[String(channelId)] || 0) + 1);
    }

    function clear(channelId) {
        if (!channelId) return;
        const key = String(channelId);
        if (!(key in counts)) return;
        delete counts[key];
        save(counts);
        notify();
    }

    function clearAll() {
        counts = {};
        save(counts);
        notify();
    }

    function subscribe(fn) {
        listeners.add(fn);
        return function unsubscribe() {
            listeners.delete(fn);
        };
    }

    global.LibertyDMUnreadStore = {
        getCounts,
        getCount,
        setUnread,
        increment,
        clear,
        clearAll,
        subscribe,
    };
})(typeof window !== 'undefined' ? window : globalThis);
