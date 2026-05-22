import { twitter } from './client.js';
import { tgSend }  from './telegram.js';

// In-memory store of drafted replies awaiting the owner's approval.
//   id -> { tweetId, replyText }
const pending = new Map();
let seq = 0;

export function pendingCount() {
  return pending.size;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Called by autoEngage: queue an AI-drafted reply and send it to Telegram with
// Post / Skip buttons. Nothing is posted to X until the owner taps "Post it".
export async function queueReplyDraft({ tweetId, tweetText, replyText }) {
  // Cap the queue so an ignored backlog can't grow without bound.
  if (pending.size > 50) {
    pending.delete(pending.keys().next().value);
  }

  const id = String(++seq);
  pending.set(id, { tweetId, replyText });

  const url = `https://x.com/i/status/${tweetId}`;
  await tgSend(
    `💬 <b>Drafted reply</b>\n\n` +
    `<b>Their post:</b>\n${escapeHtml(tweetText.slice(0, 260))}\n\n` +
    `<b>Suggested reply:</b>\n${escapeHtml(replyText)}\n\n` +
    `<a href="${url}">View the tweet ↗</a>`,
    [[
      { text: '✅ Post it', callback_data: `r:${id}:post` },
      { text: '🗑 Skip',    callback_data: `r:${id}:skip` },
    ]],
  );
}

// Called by the Telegram callback handler when a Post/Skip button is pressed.
export async function handleReplyCallback(data) {
  const [, id, action] = data.split(':');
  const draft = pending.get(id);
  if (!draft) return 'That draft has expired.';
  pending.delete(id);

  if (action === 'skip') {
    await tgSend('🗑 Reply skipped.');
    return 'Skipped.';
  }

  try {
    await twitter.v2.tweet({
      text:  draft.replyText,
      reply: { in_reply_to_tweet_id: draft.tweetId },
    });
    await tgSend('✅ Reply posted.');
    return 'Posted!';
  } catch (err) {
    console.error('  Reply post failed:', err.code ?? '', err.message);
    if (err.code === 403) {
      await tgSend('⚠️ Couldn’t post that reply — X blocked it (that tweet likely limits who can reply). Skipped, no harm done.');
      return 'Skipped — reply restricted.';
    }
    await tgSend(`❌ Reply failed: ${err.message}`);
    return 'Failed — see chat.';
  }
}
