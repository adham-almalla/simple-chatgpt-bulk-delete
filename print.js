(async () => {
  const info = document.getElementById('info');
  const save = document.getElementById('save');
  const content = document.getElementById('content');
  const speaker = (role) => (role === 'user' ? 'You' : 'ChatGPT');
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  let chats = null;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'bcd-get', key: location.hash.slice(1) });
    chats = res?.chats || null;
  } catch {
    chats = null;
  }
  if (!chats || chats.length === 0) {
    info.textContent = 'This export is no longer available. Go back to ChatGPT and click Export PDF again.';
    return;
  }

  for (const chat of chats) {
    const section = el('section', 'chat');
    const h = el('h1', '', chat.title);
    h.dir = 'auto';
    section.appendChild(h);
    section.appendChild(el('p', 'meta', chat.created ? `Created: ${chat.created}` : ''));
    if (!chat.messages || chat.messages.length === 0) {
      section.appendChild(el('p', 'empty', 'No text messages found in this chat.'));
    }
    for (const msg of chat.messages || []) {
      section.appendChild(el('div', 'role', speaker(msg.role)));
      const text = el('div', 'text', msg.text);
      text.dir = 'auto';
      section.appendChild(text);
    }
    content.appendChild(section);
  }

  const name = (chats[0].title || 'chat').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  document.title = chats.length === 1 ? name.slice(0, 80) || 'chat' : `ChatGPT export (${chats.length} chats)`;
  info.textContent =
    (chats.length === 1 ? '1 chat' : `${chats.length} chats`) +
    ' ready. In the print dialog, choose "Save as PDF" as the destination.';
  save.hidden = false;
  save.addEventListener('click', () => window.print());
  setTimeout(() => window.print(), 400);
})();
