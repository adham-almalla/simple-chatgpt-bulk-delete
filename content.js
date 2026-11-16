(() => {
  'use strict';

  const ID_RE = /\/c\/([0-9a-f]{8}-[0-9a-f-]{27})/i;
  const LINK_SELECTOR = 'nav a[href*="/c/"]';

  const selected = new Map(); // id -> title
  const gone = new Set(); // ids deleted/archived this session
  let lastClickedId = null;
  let busy = false;
  let statusText = '';

  const idOf = (link) => (link.getAttribute('href') || '').match(ID_RE)?.[1] || null;
  const titleOf = (link) => link.textContent.trim() || 'Untitled chat';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function visibleLinks() {
    return [...document.querySelectorAll(LINK_SELECTOR)].filter((a) => {
      const id = idOf(a);
      return id && !gone.has(id);
    });
  }

  // ---------- Checkboxes ----------

  function makeCheckbox(link) {
    const box = document.createElement('span');
    box.className = 'bcd-check';
    box.setAttribute('role', 'checkbox');
    box.setAttribute('aria-label', 'Select chat');
    box.title = 'Select chat (Shift+click for a range)';

    // Keep the click from reaching the link, so only the title opens the chat.
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'dblclick']) {
      box.addEventListener(type, (e) => {
        e.stopPropagation();
        if (type === 'mousedown') e.preventDefault();
      });
    }
    box.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      const id = idOf(link);
      if (id) toggle(id, link, e.shiftKey);
    });
    return box;
  }

  function scan() {
    for (const link of document.querySelectorAll(LINK_SELECTOR)) {
      const id = idOf(link);
      if (!id) continue;
      link.classList.toggle('bcd-gone', gone.has(id));
      let box = link.querySelector(':scope > .bcd-check');
      if (!box) {
        box = makeCheckbox(link);
        link.prepend(box);
      }
      const want = selected.has(id) ? 'true' : 'false';
      if (box.getAttribute('aria-checked') !== want) box.setAttribute('aria-checked', want);
    }
  }

  function toggle(id, link, range) {
    const turnOn = !selected.has(id);
    if (range && lastClickedId && lastClickedId !== id) {
      const links = visibleLinks();
      const a = links.findIndex((l) => idOf(l) === lastClickedId);
      const b = links.findIndex((l) => idOf(l) === id);
      if (a !== -1 && b !== -1) {
        for (const l of links.slice(Math.min(a, b), Math.max(a, b) + 1)) {
          if (turnOn) selected.set(idOf(l), titleOf(l));
          else selected.delete(idOf(l));
        }
      }
    } else if (turnOn) {
      selected.set(id, titleOf(link));
    } else {
      selected.delete(id);
    }
    lastClickedId = id;
    refresh();
  }

  // ---------- Action bar ----------

  let bar, countEl, buttons;

  function button(label, onClick, extraClass) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bcd-btn' + (extraClass ? ' ' + extraClass : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function buildBar() {
    bar = document.createElement('div');
    bar.id = 'bcd-bar';
    countEl = document.createElement('span');
    countEl.className = 'bcd-count';
    buttons = [
      button('Select all loaded', () => {
        for (const l of visibleLinks()) selected.set(idOf(l), titleOf(l));
        refresh();
      }),
      button('Clear', () => {
        selected.clear();
        refresh();
      }),
      button('Export TXT', () => runExport('txt')),
      button('Export PDF', () => runExport('pdf')),
      button('Archive', () => confirmAndRun('archive')),
      button('Delete', () => confirmAndRun('delete'), 'bcd-danger'),
    ];
    buttons[2].title = 'Download one .txt file per selected chat';
    buttons[3].title = 'Opens the print dialog: choose "Save as PDF" as the destination';
    bar.append(countEl, ...buttons);
    document.body.appendChild(bar);
  }

  function refresh() {
    scan();
    if (!bar || !bar.isConnected) buildBar();
    const n = selected.size;
    bar.classList.toggle('bcd-show', n > 0 || busy || !!statusText);
    countEl.textContent = statusText || `${n} selected`;
    for (const b of buttons) {
      b.disabled = busy;
      b.style.display = statusText && !busy && n === 0 ? 'none' : '';
    }
  }

  function flash(text, ms = 4000) {
    statusText = text;
    refresh();
    setTimeout(() => {
      if (statusText === text) {
        statusText = '';
        refresh();
      }
    }, ms);
  }

  // ---------- Confirmation dialog ----------

  function confirmDialog(action, titles) {
    return new Promise((resolve) => {
      const n = titles.length;
      const noun = n === 1 ? 'chat' : 'chats';
      const overlay = document.createElement('div');
      overlay.id = 'bcd-overlay';
      const dialog = document.createElement('div');
      dialog.id = 'bcd-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');

      const h = document.createElement('h2');
      h.textContent = action === 'delete' ? `Delete ${n} ${noun}?` : `Archive ${n} ${noun}?`;
      const p = document.createElement('p');
      p.textContent =
        action === 'delete'
          ? 'This permanently deletes them from your ChatGPT account and cannot be undone.'
          : 'They move to Archived chats (Settings → Data controls) and can be restored.';
      const ul = document.createElement('ul');
      for (const t of titles) {
        const li = document.createElement('li');
        li.textContent = t;
        li.title = t;
        ul.appendChild(li);
      }

      const close = (answer) => {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        resolve(answer);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close(false);
        }
      };
      const actions = document.createElement('div');
      actions.className = 'bcd-actions';
      const cancel = button('Cancel', () => close(false));
      const ok = button(
        action === 'delete' ? `Delete ${n} ${noun}` : `Archive ${n} ${noun}`,
        () => close(true),
        action === 'delete' ? 'bcd-danger' : ''
      );
      actions.append(cancel, ok);

      dialog.append(h, p, ul, actions);
      overlay.appendChild(dialog);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
      });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(overlay);
      cancel.focus();
    });
  }

  // ---------- ChatGPT requests ----------

  async function getToken() {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) throw new Error('Could not read your ChatGPT session. Are you signed in?');
    const data = await res.json();
    if (!data.accessToken) throw new Error('No session found. Sign in to ChatGPT and try again.');
    return data.accessToken;
  }

  async function patchConversation(id, body, token) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`/backend-api/conversation/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) return true;
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return false;
    }
    return false;
  }

  async function confirmAndRun(action) {
    if (busy || selected.size === 0) return;
    const items = [...selected.entries()];
    const ok = await confirmDialog(action, items.map(([, title]) => title));
    if (!ok) return;

    busy = true;
    const body = action === 'delete' ? { is_visible: false } : { is_archived: true };
    const verb = action === 'delete' ? 'Deleting' : 'Archiving';
    const past = action === 'delete' ? 'Deleted' : 'Archived';
    let done = 0;
    let failed = 0;

    try {
      const token = await getToken();
      for (const [id] of items) {
        statusText = `${verb} ${done + failed + 1} of ${items.length}…`;
        refresh();
        let success = false;
        try {
          success = await patchConversation(id, body, token);
        } catch {
          success = false;
        }
        if (success) {
          done++;
          gone.add(id);
          selected.delete(id);
        } else {
          failed++;
        }
        await sleep(150);
      }
    } catch (err) {
      busy = false;
      flash(err.message || 'Something went wrong.', 6000);
      return;
    }

    busy = false;
    const openId = location.pathname.match(ID_RE)?.[1];
    if (openId && gone.has(openId)) {
      location.assign('/');
      return;
    }
    flash(
      failed
        ? `${past} ${done}, ${failed} failed (still selected, try again)`
        : `${past} ${done} ${done === 1 ? 'chat' : 'chats'}`
    );
  }

  // ---------- Export ----------

  async function fetchConversation(id, token) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`/backend-api/conversation/${id}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return res.json();
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return null;
    }
    return null;
  }

  function messageText(m) {
    const role = m.author?.role;
    if (role !== 'user' && role !== 'assistant') return '';
    if (m.metadata?.is_visually_hidden_from_conversation) return '';
    if (m.recipient && m.recipient !== 'all') return ''; // tool calls
    const c = m.content || {};
    if (c.content_type !== 'text' && c.content_type !== 'multimodal_text') return '';
    return (c.parts || [])
      .map((p) => {
        if (typeof p === 'string') return p;
        if (p && typeof p.content_type === 'string' && p.content_type.includes('image')) return '[image]';
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .replace(/[^]*/g, '') // inline citation markers
      .trim();
  }

  // Follow the visible branch of the conversation from its last message back to the start.
  function extractMessages(conv) {
    const mapping = conv.mapping || {};
    const out = [];
    const seen = new Set();
    let nodeId = conv.current_node;
    while (nodeId && mapping[nodeId] && !seen.has(nodeId)) {
      seen.add(nodeId);
      const m = mapping[nodeId].message;
      const text = m ? messageText(m) : '';
      if (text) out.push({ role: m.author.role, text });
      nodeId = mapping[nodeId].parent;
    }
    return out.reverse();
  }

  const speaker = (role) => (role === 'user' ? 'You' : 'ChatGPT');

  function chatToText(chat) {
    const lines = [chat.title];
    if (chat.created) lines.push(`Created: ${chat.created}`);
    lines.push(`Link: https://chatgpt.com/c/${chat.id}`, '='.repeat(60), '');
    for (const msg of chat.messages) lines.push(`${speaker(msg.role)}:`, msg.text, '');
    return lines.join('\n');
  }

  function safeName(title) {
    return (
      title
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'chat'
    );
  }

  function downloadText(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Builds a print-only copy of the chats and opens the browser's print dialog,
  // where "Save as PDF" produces the file.
  function printChats(chats) {
    document.getElementById('bcd-print')?.remove();
    const root = document.createElement('div');
    root.id = 'bcd-print';
    for (const chat of chats) {
      const section = document.createElement('section');
      section.className = 'bcd-chat';
      const h = document.createElement('h1');
      h.textContent = chat.title;
      h.dir = 'auto';
      section.appendChild(h);
      if (chat.created) {
        const meta = document.createElement('p');
        meta.className = 'bcd-meta';
        meta.textContent = `Created: ${chat.created}`;
        section.appendChild(meta);
      }
      for (const msg of chat.messages) {
        const role = document.createElement('div');
        role.className = 'bcd-role';
        role.textContent = speaker(msg.role);
        const text = document.createElement('div');
        text.className = 'bcd-text';
        text.dir = 'auto';
        text.textContent = msg.text;
        section.append(role, text);
      }
      root.appendChild(section);
    }
    document.body.appendChild(root);
    document.documentElement.classList.add('bcd-printing');

    const oldTitle = document.title;
    document.title = chats.length === 1 ? safeName(chats[0].title) : `ChatGPT export (${chats.length} chats)`;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener('afterprint', cleanup);
      document.documentElement.classList.remove('bcd-printing');
      root.remove();
      document.title = oldTitle;
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      try {
        window.print();
      } finally {
        // Fallback in case afterprint never fires.
        setTimeout(cleanup, 60000);
      }
    }, 100);
  }

  async function runExport(format) {
    if (busy || selected.size === 0) return;
    const items = [...selected.entries()];
    const chats = [];
    let failed = 0;
    busy = true;

    try {
      const token = await getToken();
      for (const [id, fallbackTitle] of items) {
        statusText = `Loading ${chats.length + failed + 1} of ${items.length}…`;
        refresh();
        let conv = null;
        try {
          conv = await fetchConversation(id, token);
        } catch {
          conv = null;
        }
        if (conv) {
          chats.push({
            id,
            title: (conv.title || fallbackTitle || 'Untitled chat').trim(),
            created: conv.create_time ? new Date(conv.create_time * 1000).toLocaleString() : '',
            messages: extractMessages(conv),
          });
        } else {
          failed++;
        }
        await sleep(150);
      }
    } catch (err) {
      busy = false;
      flash(err.message || 'Something went wrong.', 6000);
      return;
    }

    busy = false;
    if (chats.length === 0) {
      flash('Could not load the selected chats.', 6000);
      return;
    }
    if (format === 'txt') {
      for (const chat of chats) {
        downloadText(`${safeName(chat.title)}.txt`, chatToText(chat));
        await sleep(300);
      }
    } else {
      printChats(chats);
    }
    const noun = chats.length === 1 ? 'chat' : 'chats';
    statusText = '';
    refresh();
    if (failed) flash(`Exported ${chats.length} ${noun}, ${failed} failed`);
    else if (format === 'txt') flash(`Exported ${chats.length} ${noun}`, 2500);
  }

  // ---------- Keep in sync with the page ----------

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  refresh();
})();
