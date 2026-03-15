/**
 * Liberty — React Context + Hook para estado de DMs não lidas (pings).
 * Qualquer componente React pode usar useDMUnread() para ler/limpar.
 * Requer: React, LibertyDMUnreadStore
 */
(function () {
    'use strict';
    if (typeof React === 'undefined' || typeof LibertyDMUnreadStore === 'undefined') return;

    var useState = React.useState;
    var useEffect = React.useEffect;
    var useCallback = React.useCallback;
    var createContext = React.createContext;

    var defaultValue = { counts: {}, getCount: function () { return 0; }, clear: function () {} };
    var DMUnreadContext = createContext(defaultValue);

    function DMUnreadProvider(props) {
        var children = props.children;
        var _a = useState(function () { return LibertyDMUnreadStore.getCounts(); }), counts = _a[0], setCounts = _a[1];
        useEffect(function () {
            return LibertyDMUnreadStore.subscribe(function (next) { return setCounts(next); });
        }, []);
        var clear = useCallback(function (channelId) {
            LibertyDMUnreadStore.clear(channelId);
        }, []);
        var getCount = useCallback(function (id) {
            return counts[id] || 0;
        }, [counts]);
        return React.createElement(DMUnreadContext.Provider, {
            value: { counts: counts, getCount: getCount, clear: clear }
        }, children);
    }

    function useDMUnread() {
        var ctx = React.useContext(DMUnreadContext);
        if (ctx) return ctx;
        var _a = useState(function () { return LibertyDMUnreadStore.getCounts(); }), counts = _a[0], setCounts = _a[1];
        useEffect(function () {
            return LibertyDMUnreadStore.subscribe(function (next) { return setCounts(next); });
        }, []);
        return {
            counts: counts,
            getCount: function (id) { return counts[id] || 0; },
            clear: function (id) { LibertyDMUnreadStore.clear(id); }
        };
    }

    window.LibertyDMUnreadReact = {
        DMUnreadContext: DMUnreadContext,
        DMUnreadProvider: DMUnreadProvider,
        useDMUnread: useDMUnread
    };
})();
