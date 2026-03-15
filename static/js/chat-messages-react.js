/**
 * Liberty — Estado de mensagens em React (Hooks)
 * Cache local primeiro, sync com servidor, optimistic UI, scroll to bottom.
 * Requer: React, ReactDOM, MessageCache, API, app (LibertyApp)
 */
(function () {
    'use strict';
    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') return;

    const { useState, useEffect, useRef } = React;

    function mergeAndSort(cached, apiList) {
        const byId = new Map();
        [...(cached || []), ...(Array.isArray(apiList) ? apiList : [])].forEach(function (m) {
            const id = m.id || m.message_id;
            if (id) byId.set(id, m);
        });
        return Array.from(byId.values()).sort(function (a, b) {
            const tA = (a.created_at && new Date(a.created_at).getTime()) || 0;
            const tB = (b.created_at && new Date(b.created_at).getTime()) || 0;
            return tA - tB;
        });
    }

    function ChatMessagesState(props) {
        const { channelId, channel, gateway, currentUser, app } = props;
        const [messages, setMessages] = useState([]);
        const messagesRef = useRef(messages);
        messagesRef.current = messages;
        const appRef = useRef(app);
        appRef.current = app;

        // Carregar canal: cache primeiro, depois API (cache key: para DM é só o id, para canal é room)
        useEffect(function () {
            if (!channelId || !app) return;
            var cacheKey = (channelId && String(channelId).indexOf('dm:') === 0) ? String(channelId).substring(3) : channelId;
            var cached = MessageCache.get(cacheKey);
            setMessages(cached);
            app.setMessagesFromList(cached);
            API.Message.list(channelId, { limit: 50 })
                .then(function (apiList) {
                    var merged = mergeAndSort(cached, apiList);
                    MessageCache.set(cacheKey, merged);
                    setMessages(merged);
                    app.setMessagesFromList(merged);
                })
                .catch(function () {
                    app.setMessagesFromList(cached);
                });
        }, [channelId, app]);

        // WebSocket: nova mensagem em tempo real
        useEffect(function () {
            if (!gateway) return;
            var handler = function (msg) {
                var chId = msg.channel_id || msg.channelId || msg.chat_id;
                if (!chId || !appRef.current || !appRef.current.currentChannel) return;
                if (String(chId) !== String(appRef.current.currentChannel.id)) return;
                var normalized = {
                    id: msg.id || msg.message_id,
                    content: msg.content,
                    author_username: msg.author_username || msg.author,
                    author_id: msg.author_id,
                    created_at: msg.created_at || msg.timestamp,
                    avatar_url: msg.avatar_url,
                    channel_id: chId
                };
                setMessages(function (prev) {
                    var fromSelf = normalized.author_id && currentUser && String(normalized.author_id) === String(currentUser.id);
                    var next = prev.filter(function (m) {
                        if (fromSelf && m.id && m.id.toString().startsWith('pending-') && m.content === normalized.content) return false;
                        return (m.id || m.message_id) !== normalized.id;
                    });
                    next = next.concat([normalized]).sort(function (a, b) {
                        var tA = (a.created_at && new Date(a.created_at).getTime()) || 0;
                        var tB = (b.created_at && new Date(b.created_at).getTime()) || 0;
                        return tA - tB;
                    });
                    if (appRef.current) appRef.current.setMessagesFromList(next);
                    return next;
                });
            };
            gateway.on('message', handler);
            return function () {
                gateway.off('message', handler);
            };
        }, [gateway, currentUser]);

        // Expor sendMessage para o app (optimistic UI)
        useEffect(function () {
            window.LibertyChatSendMessage = function (content) {
                var chId = channelId;
                var appInst = appRef.current;
                if (!chId || !appInst || !currentUser) return Promise.reject(new Error('No channel'));
                var tempId = 'pending-' + Date.now();
                var optimistic = {
                    id: tempId,
                    content: content,
                    author_username: currentUser.username,
                    author_id: currentUser.id,
                    author: currentUser.username,
                    created_at: new Date().toISOString(),
                    avatar_url: currentUser.avatar_url || currentUser.avatar || null,
                    _optimistic: true
                };
                setMessages(function (prev) {
                    var next = prev.concat([optimistic]).sort(function (a, b) {
                        var tA = (a.created_at && new Date(a.created_at).getTime()) || 0;
                        var tB = (b.created_at && new Date(b.created_at).getTime()) || 0;
                        return tA - tB;
                    });
                    appInst.setMessagesFromList(next);
                    return next;
                });
                var roomOrId = appInst.currentChannel && (appInst.currentChannel.room || appInst.currentChannel.id) || chId;
                return API.Message.create(roomOrId, content)
                    .then(function (res) {
                        var msg = res && (res.message || res.data && res.data.message) || (res && res.id ? res : null);
                        setMessages(function (prev) {
                            var without = prev.filter(function (m) { return (m.id || m.message_id) !== tempId; });
                            if (msg) {
                                var normalized = {
                                    id: msg.id,
                                    content: msg.content != null ? msg.content : content,
                                    author_username: msg.author_username || msg.author || currentUser.username,
                                    author_id: msg.author_id || currentUser.id,
                                    created_at: msg.created_at || msg.timestamp || new Date().toISOString(),
                                    avatar_url: msg.avatar_url || null
                                };
                                var hasId = normalized.id && without.some(function (m) { return (m.id || m.message_id) === normalized.id; });
                                if (!hasId) {
                                    without = without.concat([normalized]).sort(function (a, b) {
                                        var tA = (a.created_at && new Date(a.created_at).getTime()) || 0;
                                        var tB = (b.created_at && new Date(b.created_at).getTime()) || 0;
                                        return tA - tB;
                                    });
                                }
                                var ck = (chId && String(chId).indexOf('dm:') === 0) ? String(chId).substring(3) : chId;
                                MessageCache.add(ck, normalized);
                            }
                            appInst.setMessagesFromList(without);
                            return without;
                        });
                    })
                    .catch(function (err) {
                        setMessages(function (prev) {
                            var next = prev.filter(function (m) { return (m.id || m.message_id) !== tempId; });
                            appInst.setMessagesFromList(next);
                            return next;
                        });
                        throw err;
                    });
            };
            return function () {
                window.LibertyChatSendMessage = null;
            };
        }, [channelId, currentUser]);

        return null;
    }

    function initChatReact(app) {
        var container = document.getElementById('chat-react-state-root');
        if (!container) {
            container = document.createElement('div');
            container.id = 'chat-react-state-root';
            container.setAttribute('aria-hidden', 'true');
            container.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
            document.body.appendChild(container);
        }
        var root = ReactDOM.createRoot(container);
        function render() {
            var room = app.currentChannel && (app.currentChannel.room || app.currentChannel.id);
            root.render(React.createElement(ChatMessagesState, {
                channelId: room,
                channel: app.currentChannel,
                gateway: app.gateway,
                currentUser: app.currentUser,
                app: app
            }));
        }
        window.LibertyChatRoot = { render: render };
        return root;
    }

    window.LibertyChatReactInit = initChatReact;
})();
