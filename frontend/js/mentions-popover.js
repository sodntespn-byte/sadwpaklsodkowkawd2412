/**
 * Liberty — Popover de menções @ no input de mensagem.
 * Lista membros online, filtro em tempo real, seleção com Enter/clique.
 */
(function (global) {
  'use strict';

  const MENTION_TRIGGER = '@';
  const POPOVER_ID = 'liberty-mentions-popover';
  const MAX_ITEMS = 8;

  function getCaretCoordinates(element, position) {
    const div = document.createElement('div');
    const style = getComputedStyle(element);
    document.body.appendChild(div);
    div.style.cssText =
      'position:absolute;white-space:pre-wrap;word-wrap:break-word;top:0;left:0;visibility:hidden;font:' +
      style.font +
      ';padding:' +
      style.padding +
      ';border:' +
      style.border +
      ';line-height:' +
      style.lineHeight +
      ';width:' +
      element.offsetWidth +
      'px;';
    div.textContent = element.value.substring(0, position);
    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);
    const rect = element.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    document.body.removeChild(div);
    return {
      top: spanRect.top - rect.top + element.scrollTop,
      left: spanRect.left - rect.left,
    };
  }

  function createPopover() {
    let el = document.getElementById(POPOVER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = POPOVER_ID;
    el.className = 'mentions-popover';
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', 'Mencionar utilizador');
    el.innerHTML = '<div class="mentions-popover-list"></div>';
    document.body.appendChild(el);
    return el;
  }

  function hidePopover() {
    const el = document.getElementById(POPOVER_ID);
    if (el) {
      el.classList.remove('mentions-popover-visible');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  function showPopover(input, list, selectedIndex, onSelect) {
    const popover = createPopover();
    const listEl = popover.querySelector('.mentions-popover-list');
    listEl.innerHTML = '';
    if (!list.length) {
      hidePopover();
      return;
    }
    const rect = input.getBoundingClientRect();
    const pos = input.selectionStart;
    const coords = getCaretCoordinates(input, pos);
    popover.style.top = rect.top + coords.top - popover.offsetHeight - 4 + 'px';
    popover.style.left = rect.left + coords.left + 'px';
    list.slice(0, MAX_ITEMS).forEach((member, i) => {
      const item = document.createElement('div');
      item.className = 'mentions-popover-item' + (i === selectedIndex ? ' mentions-popover-item-selected' : '');
      item.setAttribute('role', 'option');
      item.dataset.index = String(i);
      item.dataset.userId = member.id || '';
      item.dataset.username = member.username || '';
      const avatar =
        member.avatar_url || member.avatar ? `<img src="${member.avatar_url || member.avatar}" alt="">` : '';
      const letter = (member.username || 'U').charAt(0).toUpperCase();
      item.innerHTML = `<span class="mentions-popover-avatar">${avatar || letter}</span><span class="mentions-popover-name">${escapeHtml(member.username || 'User')}</span>`;
      item.addEventListener('click', () => {
        onSelect(member);
        hidePopover();
      });
      listEl.appendChild(item);
    });
    popover.classList.add('mentions-popover-visible');
    popover.setAttribute('aria-hidden', 'false');
    popover.dataset.selectedIndex = String(selectedIndex);
    listEl.querySelectorAll('.mentions-popover-item').forEach((item, i) => {
      item.classList.toggle('mentions-popover-item-selected', i === selectedIndex);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getQueryAndStartPos(text, caretPos) {
    let start = caretPos - 1;
    while (start >= 0 && text[start] !== MENTION_TRIGGER && /\S/.test(text[start])) start--;
    if (start < 0 || text[start] !== MENTION_TRIGGER) return { query: null, startPos: -1 };
    const query = text
      .substring(start + 1, caretPos)
      .trim()
      .toLowerCase();
    return { query, startPos: start };
  }

  global.LibertyMentions = {
    init(app) {
      const input = document.getElementById('message-input');
      if (!input) return;
      let members = [];
      let selectedIndex = 0;
      let lastQuery = null;

      function getMembers() {
        const ch = app.currentChannel;
        if (!ch) return [];
        if (ch.recipients && ch.recipients.length) {
          return ch.recipients.map(r => ({
            id: r.id,
            username: r.username || r.display_name || 'User',
            avatar_url: r.avatar_url || r.avatar,
          }));
        }
        return (app.members || []).map(m => ({
          id: m.user_id || m.id,
          username: m.username || 'User',
          avatar_url: m.avatar_url || m.avatar,
        }));
      }

      function filterMembers(query) {
        const list = getMembers().filter(m => m.id !== app.currentUser?.id);
        if (!query) return list;
        const q = query.toLowerCase();
        return list.filter(m => (m.username || '').toLowerCase().includes(q));
      }

      function openMentionPopover() {
        members = filterMembers(lastQuery || '');
        selectedIndex = 0;
        showPopover(input, members, 0, member => selectMember(member));
      }

      function selectMember(member) {
        const text = input.value;
        const caret = input.selectionStart;
        const { startPos } = getQueryAndStartPos(text, caret);
        if (startPos < 0) return;
        const before = text.substring(0, startPos);
        const after = text.substring(caret);
        const insert = '@' + (member.username || 'User') + ' ';
        input.value = before + insert + after;
        input.selectionStart = input.selectionEnd = before.length + insert.length;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        hidePopover();
      }

      input.addEventListener('input', () => {
        const text = input.value;
        const caret = input.selectionStart;
        const { query, startPos } = getQueryAndStartPos(text, caret);
        if (startPos < 0) {
          hidePopover();
          return;
        }
        lastQuery = query;
        members = filterMembers(query);
        selectedIndex = Math.min(selectedIndex, Math.max(0, members.length - 1));
        if (members.length === 0) {
          hidePopover();
          return;
        }
        showPopover(input, members, selectedIndex, selectMember);
      });

      input.addEventListener('keydown', e => {
        const popover = document.getElementById(POPOVER_ID);
        if (!popover || !popover.classList.contains('mentions-popover-visible')) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, members.length - 1);
          showPopover(input, members, selectedIndex, selectMember);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          showPopover(input, members, selectedIndex, selectMember);
          return;
        }
        if (e.key === 'Enter' && members.length > 0) {
          e.preventDefault();
          selectMember(members[selectedIndex]);
          return;
        }
        if (e.key === 'Escape') {
          hidePopover();
        }
      });

      document.addEventListener('click', e => {
        if (!e.target.closest('.mentions-popover') && e.target !== input) hidePopover();
      });
    },
    hide: hidePopover,
  };
})(typeof window !== 'undefined' ? window : globalThis);
