// Holds exported chats briefly and opens the export page that displays them.
const pending = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'bcd-print') {
    const key = crypto.randomUUID();
    pending.set(key, msg.chats);
    const options = { url: chrome.runtime.getURL('print.html') + '#' + key };
    if (sender.tab) {
      options.index = sender.tab.index + 1;
      options.openerTabId = sender.tab.id;
    }
    chrome.tabs.create(options);
    sendResponse({ ok: true });
  } else if (msg?.type === 'bcd-get') {
    sendResponse({ chats: pending.get(msg.key) || null });
  }
});
