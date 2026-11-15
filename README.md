# Simple ChatGPT Bulk Delete

A simple Chrome extension for deleting or archiving many ChatGPT chats at once, without losing the ability to open them.

Most bulk-delete extensions turn the whole chat row into a checkbox, so you can no longer click a chat to see what is in it. This one adds a small checkbox *beside* each chat title. Click the checkbox to select a chat; click the title to open it as usual. You can review a chat, come back, and your selection is still there.

## Features

- Checkbox next to every chat in the sidebar; chat titles stay clickable
- Selection is kept while you open and review chats
- Shift+click to select a range
- Select all loaded chats in one click
- Bulk **Delete** (permanent) or **Archive** (reversible)
- Confirmation dialog listing the chats before anything happens
- No extra permissions, no tracking, nothing sent anywhere except chatgpt.com

## Install

1. Download the zip from the [latest release](../../releases/latest) and unzip it (or clone this repository).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the extension folder.
5. Reload your chatgpt.com tab.

## Use

1. Tick the checkbox beside the chats you want to remove. Click any title to open and check a chat first.
2. A bar appears at the bottom of the page with **Select all loaded**, **Clear**, **Archive** and **Delete**.
3. Choose an action and confirm.

"Select all loaded" covers only the chats the sidebar has loaded so far; scroll the sidebar down to load more.

## Notes

- Deleting is permanent and cannot be undone. Archived chats can be restored from ChatGPT's settings.
- The extension uses the same internal request the ChatGPT website sends when you delete a chat, using your signed-in session in your own browser. This is not an official API, so a ChatGPT update may break it.
- Not affiliated with or endorsed by OpenAI.
