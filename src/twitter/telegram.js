import 'dotenv/config';

const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API     = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

export function tgEnabled() {
  return Boolean(TOKEN && CHAT_ID);
}

async function call(method, body) {
  const res  = await fetch(`${API}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

// Send a message to the owner. `buttons` is an inline_keyboard array (rows of buttons).
export async function tgSend(text, buttons) {
  if (!tgEnabled()) return;
  const body = {
    chat_id:                  CHAT_ID,
    text,
    parse_mode:               'HTML',
    disable_web_page_preview: false,
  };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  try {
    return await call('sendMessage', body);
  } catch (err) {
    console.error('  Telegram send failed:', err.message);
  }
}

// Long-poll Telegram for incoming commands and button presses.
// Everything is locked to the owner's chat ID — messages from anyone else are ignored.
export async function startTelegramListener({ onCommand, onCallback }) {
  if (!tgEnabled()) {
    console.log('  📲 Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — control layer off.');
    return;
  }

  let offset = 0;
  // Drain anything that arrived while the bot was offline so old commands don't replay.
  try {
    const backlog = await call('getUpdates', { timeout: 0 });
    if (backlog.length) offset = backlog[backlog.length - 1].update_id + 1;
  } catch { /* ignore */ }

  console.log('  📲 Telegram control listener active.');
  await tgSend('🤖 DevSply bot online — send /help for controls.');

  while (true) {
    let updates;
    try {
      updates = await call('getUpdates', {
        offset,
        timeout: 50,
        allowed_updates: ['message', 'callback_query'],
      });
    } catch (err) {
      console.error('  Telegram poll error:', err.message);
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    for (const u of updates) {
      offset = u.update_id + 1;
      try {
        if (u.message?.text) {
          if (String(u.message.chat.id) !== String(CHAT_ID)) continue; // owner only
          await onCommand(u.message.text.trim());
        } else if (u.callback_query) {
          const cq = u.callback_query;
          if (String(cq.from.id) !== String(CHAT_ID)) {                // owner only
            await call('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {});
            continue;
          }
          let note;
          try { note = await onCallback(cq.data); } catch (e) { note = 'Error: ' + e.message; }
          await call('answerCallbackQuery', {
            callback_query_id: cq.id,
            text:              note || undefined,
          }).catch(() => {});
        }
      } catch (err) {
        console.error('  Telegram handler error:', err.message);
      }
    }
  }
}
