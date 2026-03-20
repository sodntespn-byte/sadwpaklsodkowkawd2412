/**
 * Liberty — Estado de mensagens em React (Hooks)
 * Cache local primeiro, sync com servidor, optimistic UI, scroll to bottom.
 * Deduplicação por ID e por conteúdo/autor/timestamp; client_id para substituir temporária pela oficial.
 */
(function () {
  'use strict';
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') return;

  const { useState, useEffect, useRef } = React;

  function isValidUser(user) {
    if (typeof window !== 'undefined' && typeof window.isValidUser === 'function') return window.isValidUser(user);
    if (!user) return false;
    var u = user.username || user.display_name || user.name;
    if (!u) return false;
    return String(u).trim() !== 'Unknown';
  }

  function tempId() {
    // Sempre usar prefixo 'pending-' para identificar mensagens optimistic
    return 'pending-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function mergeAndSort(cached, apiList) {
    const byId = new Map();
    [...(cached || []), ...(Array.isArray(apiList) ? apiList : [])].forEach(function (m) {
      const id = m.id || m.message_id;
      if (id) byId.set(String(id), m);
    });
    return Array.from(byId.values()).sort(function (a, b) {
      const tA = (a.created_at && new Date(a.created_at).getTime()) || 0;
      const tB = (b.created_at && new Date(b.created_at).getTime()) || 0;
      return tA - tB;
    });
  }

  function sortMessages(list) {
    return list.slice().sort(function (a, b) {
      var tA = (a.created_at && new Date(a.created_at).getTime()) || 0;
      var tB = (b.created_at && new Date(b.created_at).getTime()) || 0;
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
    const currentUserRef = useRef(currentUser);
    currentUserRef.current = currentUser;

    // Carregar canal: cache primeiro, depois API (cache key: para DM é só o id, para canal é room)
    useEffect(
      function () {
        if (!channelId || !app) return;
        setMessages([]);
        app.setMessagesFromList([]);
        var cacheKey = channelId && String(channelId).indexOf('dm:') === 0 ? String(channelId).substring(3) : channelId;
        var cached = MessageCache.get(cacheKey);
        var cachedList = Array.isArray(cached) ? cached : [];
        var seenCacheIds = new Set();
        var cachedUnique = cachedList.filter(function (msg) {
          var id = msg && (msg.id || msg.message_id);
          if (!id) return true;
          var sid = String(id);
          if (seenCacheIds.has(sid)) return false;
          var authorName = msg && (msg.author_username || msg.author);
          if (authorName && !isValidUser({ username: authorName })) return false;
          seenCacheIds.add(sid);
          return true;
        });
        setMessages(cachedUnique);
        app.setMessagesFromList(cachedUnique);
        API.Message.list(channelId, { limit: 50 })
          .then(function (apiList) {
            var merged = mergeAndSort(cachedUnique, apiList);
            var seenMergedIds = new Set();
            merged = merged.filter(function (msg) {
              var id = msg && (msg.id || msg.message_id);
              if (!id) return true;
              var sid = String(id);
              if (seenMergedIds.has(sid)) return false;
              var authorName = msg && (msg.author_username || msg.author);
              if (authorName && !isValidUser({ username: authorName })) return false;
              seenMergedIds.add(sid);
              return true;
            });
            MessageCache.set(cacheKey, merged);
            setMessages(merged);
            app.setMessagesFromList(merged);
          })
          .catch(function () {
            setMessages(cachedUnique);
            app.setMessagesFromList(cachedUnique);
          });
      },
      [channelId, app]
    );

    // WebSocket: uma única inscrição, deduplicação por id e por conteúdo/autor/timestamp, cleanup no return
    useEffect(
      function () {
        if (!gateway) return;
        function handler(msg) {
          var chId = msg.channel_id || msg.channelId || msg.chat_id;
          var appInst = appRef.current;
          
          console.log('[CHAT-REACT] Mensagem recebida:', {
            chId: chId,
            currentChannelId: appInst?.currentChannel?.id,
            currentChannelRoom: appInst?.currentChannel?.room,
            msgId: msg.id || msg.message_id,
            author: msg.author_username || msg.author
          });
          
          if (!chId || !appInst || !appInst.currentChannel) return;
          
          // Comparar com id E room (para DMs e canais)
          var currentId = appInst.currentChannel.id;
          var currentRoom = appInst.currentChannel.room;
          var matches = String(chId) === String(currentId) || 
                       String(chId) === String(currentRoom) ||
                       String(currentRoom).indexOf(String(chId)) !== -1;
          
          if (!matches) {
            console.log('[CHAT-REACT] Mensagem ignorada - canal diferente');
            return;
          }
          
          var normalized = {
            id: msg.id || msg.message_id,
            content: msg.content,
            author_username: msg.author_username || msg.author,
            author_id: msg.author_id,
            created_at: msg.created_at || msg.timestamp,
            avatar_url: msg.avatar_url,
            channel_id: chId,
          };
          if (
            normalized.author_username &&
            !isValidUser({ username: normalized.author_username })
          )
            return;
          setMessages(function (prev) {
            var byId = new Map();
            prev.forEach(function (m) {
              var id = m.id || m.message_id;
              if (id) byId.set(String(id), m);
            });
            var serverId = String(normalized.id);
            
            // Se a mensagem já existe, não adicionar novamente
            if (byId.has(serverId)) return prev;
            
            var fromSelf =
              normalized.author_id &&
              currentUserRef.current &&
              String(normalized.author_id) === String(currentUserRef.current.id);
            
            // Se é do próprio usuário, remover mensagens pending com mesmo conteúdo
            if (fromSelf) {
              var toRemove = [];
              byId.forEach(function (m, mid) {
                if ((mid.startsWith('pending-') || mid.startsWith('temp-') || mid.indexOf('pending-') !== -1) &&
                    m.content === normalized.content &&
                    String(m.author_id) === String(normalized.author_id)) {
                  toRemove.push(mid);
                }
              });
              toRemove.forEach(function (mid) {
                byId.delete(mid);
              });
            }
            
            byId.set(serverId, normalized);
            var next = sortMessages(Array.from(byId.values()));
            if (appRef.current) {
              var cur = appRef.current.currentChannel;
              var cacheKey = cur && (cur.room && cur.room.indexOf('dm:') === 0 ? cur.id : cur.room || cur.id);
              if (cacheKey && typeof MessageCache !== 'undefined' && MessageCache.add) {
                MessageCache.add(cacheKey, normalized);
              }
              appRef.current.messages.set(serverId, normalized);
              appRef.current.addMessage(normalized, true);
            }
            return next;
          });
        }
        gateway.on('message', handler);
        return function () {
          gateway.off('message', handler);
        };
      },
      [gateway]
    );

    // Expor sendMessage para o app (optimistic UI): tempId único, envio de client_id, substituição pela resposta do servidor
    useEffect(
      function () {
        window.LibertyChatSendMessage = function (content) {
          var chId = channelId;
          var appInst = appRef.current;
          var user = currentUserRef.current;
          if (!chId || !appInst || !user) return Promise.reject(new Error('No channel'));
          var tempIdVal = tempId();
          var optimistic = {
            id: tempIdVal,
            content: content,
            author_username: user.username,
            author_id: user.id,
            author: user.username,
            created_at: new Date().toISOString(),
            avatar_url: user.avatar_url || user.avatar || null,
            _optimistic: true,
          };
          setMessages(function (prev) {
            var next = sortMessages(prev.concat([optimistic]));
            // addMessage já adiciona ao Map internamente
            appInst.addMessage(optimistic, true);
            var ck = chId && String(chId).indexOf('dm:') === 0 ? String(chId).substring(3) : chId;
            // Não salvar pending no cache - só manter em memória
            return next;
          });
          var roomOrId = (appInst.currentChannel && (appInst.currentChannel.room || appInst.currentChannel.id)) || chId;
          return API.Message.create(roomOrId, content, false, [], tempIdVal)
            .then(function (res) {
              var msg = (res && (res.message || (res.data && res.data.message))) || (res && res.id ? res : null);
              var clientIdEcho = res && res.client_id;
              setMessages(function (prev) {
                var without = prev.filter(function (m) {
                  var id = m.id || m.message_id;
                  return id !== tempIdVal && id !== clientIdEcho;
                });
                if (msg) {
                  var normalized = {
                    id: msg.id,
                    content: msg.content != null ? msg.content : content,
                    author_username: msg.author_username || msg.author || user.username,
                    author_id: msg.author_id || user.id,
                    created_at: msg.created_at || msg.timestamp || new Date().toISOString(),
                    avatar_url: msg.avatar_url || null,
                  };
                  appInst.replacePendingWithMessage(tempIdVal, normalized);
                  var hasId = normalized.id && without.some(function (m) { return (m.id || m.message_id) === normalized.id; });
                  if (!hasId) without = without.concat([normalized]);
                  var ck = chId && String(chId).indexOf('dm:') === 0 ? String(chId).substring(3) : chId;
                  if (typeof MessageCache !== 'undefined' && MessageCache.add) MessageCache.add(ck, normalized);
                  return sortMessages(without);
                }
                appInst.setMessagesFromList(without);
                return without;
              });
            })
            .catch(function (err) {
              setMessages(function (prev) {
                var next = prev.filter(function (m) {
                  return (m.id || m.message_id) !== tempIdVal;
                });
                appInst.setMessagesFromList(next);
                return next;
              });
              throw err;
            });
        };
        return function () {
          window.LibertyChatSendMessage = null;
        };
      },
      [channelId, currentUser]
    );

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
      root.render(
        React.createElement(ChatMessagesState, {
          channelId: room,
          channel: app.currentChannel,
          gateway: app.gateway,
          currentUser: app.currentUser,
          app: app,
        })
      );
    }
    window.LibertyChatRoot = { render: render };
    return root;
  }

  window.LibertyChatReactInit = initChatReact;
})();
