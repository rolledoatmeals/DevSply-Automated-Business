import 'dotenv/config';
import fs from 'fs';
import { twitter } from './src/twitter/client.js';
import { generatePost, generatePoll, nextContentType } from './src/twitter/content.js';
import { findNextPair, postBeforeAfter } from './src/twitter/beforeAfter.js';
import { generateCard, cleanupCard } from './src/twitter/imageCard.js';
import { autoFollow } from './src/twitter/autoFollow.js';
import { autoEngage } from './src/twitter/autoEngage.js';
import { autoRetweet } from './src/twitter/autoRetweet.js';
import { startTelegramListener, tgSend, setMyCommands } from './src/twitter/telegram.js';
import { handleReplyCallback, pendingCount } from './src/twitter/replyQueue.js';

const LOG_FILE = './posts/.twitter-log.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Toggled by the /pause and /resume Telegram commands.
let paused = false;
// Content types accepted by /postnow.
const POSTNOW_TYPES = ['web_tip', 'stat', 'ai_agent', 'tampa_local', 'engagement',
                       'story', 'fun_fact', 'hot_take', 'behind_scenes', 'poll'];

// Post 3x/day at these Eastern-time hours — business hours, when owners are online.
const POST_SLOTS_ET = [10, 13, 16];

function msUntilNextSlot() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date());
  let h = 0, m = 0;
  for (const p of parts) {
    if (p.type === 'hour')   h = parseInt(p.value, 10) % 24;
    if (p.type === 'minute') m = parseInt(p.value, 10);
  }
  const nowMin = h * 60 + m;
  let targetMin = POST_SLOTS_ET.map(s => s * 60).find(sm => sm > nowMin);
  if (targetMin == null) targetMin = POST_SLOTS_ET[0] * 60 + 1440; // tomorrow's first slot
  return (targetMin - nowMin) * 60000;
}

function loadLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch {
    return { posts: [] };
  }
}

function saveLog(log) {
  fs.mkdirSync('./posts', { recursive: true });
  // Keep only last 50 posts
  log.posts = log.posts.slice(-50);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

function checkEnv() {
  const required = ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_TOKEN_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('\n❌  Missing Twitter env vars:\n');
    missing.forEach(k => console.error(`   ${k}`));
    process.exit(1);
  }
}

async function postOnce(forcedType = null) {
  const log = loadLog();
  const recentTexts = log.posts.slice(-10).map(p => p.text);
  const recentTypes = log.posts.slice(-6).map(p => p.type);

  let tweetId, tweetText, postType;

  // Before/after takes priority when images are waiting — unless a type was forced.
  const pair = forcedType ? null : findNextPair();
  if (pair) {
    console.log(`\n📸  Found before/after pair: ${pair.base}`);
    postType = 'before_after';
    try {
      const result = await postBeforeAfter(pair);
      tweetId   = result.id;
      tweetText = result.text;
    } catch (err) {
      console.error('  ✗ Before/after post failed:', err.message);
      return { ok: false, error: 'Before/after failed: ' + err.message };
    }
  } else {
    postType = forcedType || nextContentType(recentTypes);

    if (postType === 'poll') {
      console.log('\n📊  Generating poll...');
      let poll;
      try {
        poll = await generatePoll(recentTexts);
      } catch (err) {
        console.error('  ✗ Poll generation failed:', err.message);
        return { ok: false, error: 'Poll generation failed: ' + err.message };
      }
      tweetText = poll.tweet;
      console.log(`\n  Poll:    "${tweetText}"`);
      console.log(`  Options: ${poll.options.join('  |  ')}\n`);
      try {
        const result = await twitter.v2.tweet({
          text: tweetText,
          poll: { duration_minutes: 1440, options: poll.options },
        });
        tweetId = result.data.id;
      } catch (err) {
        console.error('  ✗ Poll tweet failed:', err.message);
        return { ok: false, error: 'Poll tweet failed: ' + err.message };
      }
    } else {
      console.log(`\n✍️   Generating ${postType} post...`);

      let post;
      try {
        post = await generatePost(postType, recentTexts);
      } catch (err) {
        console.error('  ✗ Content generation failed:', err.message);
        return { ok: false, error: 'Content generation failed: ' + err.message };
      }

      tweetText = post.tweet;
      console.log(`\n  Tweet:    "${tweetText}"`);
      console.log(`  Headline: "${post.headline}"`);
      console.log(`  Subtitle: "${post.subtitle}"\n`);

      let cardPath = null;
      try {
        cardPath = await generateCard(post.headline, post.subtitle);
        const mediaId = await twitter.v1.uploadMedia(cardPath);
        const result = await twitter.v2.tweet({ text: tweetText, media: { media_ids: [mediaId] } });
        tweetId = result.data.id;
      } catch (err) {
        console.error('  ✗ Tweet failed:', err.message);
        return { ok: false, error: 'Tweet failed: ' + err.message };
      } finally {
        if (cardPath) cleanupCard(cardPath);
      }
    }
  }

  log.posts.push({
    id:        tweetId,
    text:      tweetText,
    type:      postType,
    posted_at: new Date().toISOString(),
  });

  // Auto-follow relevant accounts
  console.log('\n  Following relevant accounts...');
  try {
    const followed = await autoFollow(log);
    if (followed > 0) console.log(`  ✓ Followed ${followed} new accounts`);
  } catch (err) {
    console.error('  Auto-follow error:', err.message);
  }

  // Retweet relevant content
  console.log('\n  Retweeting relevant posts...');
  try {
    const retweeted = await autoRetweet(log);
    if (retweeted > 0) console.log(`  ✓ Retweeted ${retweeted} posts`);
  } catch (err) {
    console.error('  Retweet error:', err.message);
  }

  // Like and reply to relevant posts
  try {
    await autoEngage(log);
  } catch (err) {
    console.error('  Engage error:', err.message);
  }

  saveLog(log);
  console.log(`\n  ✓ Posted [${postType}] — tweet ID: ${tweetId}`);
  return { ok: true, type: postType, tweetId };
}

// Post once, then report the result to Telegram.
async function runPost(forcedType = null) {
  const r = await postOnce(forcedType);
  if (r?.ok) {
    await tgSend(`✅ Posted <b>${r.type}</b>\nhttps://x.com/i/status/${r.tweetId}`);
  } else {
    await tgSend(`❌ Post failed: ${r?.error ?? 'unknown error'}`);
  }
  return r;
}

// ── Telegram button GUI ──────────────────────────────────────
function mainMenuButtons() {
  return [
    [{ text: '📊 Status', callback_data: 'm:status' }],
    [{ text: '✍️ Post now', callback_data: 'm:postmenu' }],
    [{ text: '⏸ Pause', callback_data: 'm:pause' },
     { text: '▶️ Resume', callback_data: 'm:resume' }],
  ];
}

function postMenuButtons() {
  const rows = [];
  for (let i = 0; i < POSTNOW_TYPES.length; i += 2) {
    rows.push(POSTNOW_TYPES.slice(i, i + 2).map(t => ({ text: t, callback_data: 'p:' + t })));
  }
  rows.push([{ text: '🎲 Auto-pick', callback_data: 'p:auto' }]);
  rows.push([{ text: '« Back', callback_data: 'm:menu' }]);
  return rows;
}

async function sendMenu() {
  await tgSend('🤖 <b>DevSply bot</b> — pick an action:', mainMenuButtons());
}

async function sendPostMenu() {
  await tgSend('✍️ <b>Post now</b> — choose a type:', postMenuButtons());
}

async function sendStatus() {
  const log = loadLog();
  const today = new Date().toDateString();
  const posts = log.posts ?? [];
  const todayPosts = posts.filter(p => new Date(p.posted_at).toDateString() === today);
  const last = posts[posts.length - 1];
  const waitH = (msUntilNextSlot() / 3600000).toFixed(1);
  await tgSend([
    '📊 <b>Status</b>',
    `State: ${paused ? '⏸ paused' : '▶️ active'}`,
    `Posts today: ${todayPosts.length}`,
    `Last post: ${last ? `${last.type} — ${new Date(last.posted_at).toLocaleString()}` : '—'}`,
    `Next post: in ${waitH}h`,
    `Reply drafts awaiting you: ${pendingCount()}`,
  ].join('\n'), mainMenuButtons());
}

// Handle a typed command from Telegram.
async function onCommand(text) {
  const [cmd, ...args] = text.split(/\s+/);
  switch (cmd.toLowerCase()) {
    case '/start':
    case '/menu':
    case '/help':
      await sendMenu();
      break;

    case '/status':
      await sendStatus();
      break;

    case '/pause':
      paused = true;
      await tgSend('⏸ Scheduled posting paused.', mainMenuButtons());
      break;

    case '/resume':
      paused = false;
      await tgSend('▶️ Scheduled posting resumed.', mainMenuButtons());
      break;

    case '/postnow': {
      const type = args[0]?.toLowerCase();
      if (!type) { await sendPostMenu(); break; }
      if (!POSTNOW_TYPES.includes(type)) {
        await tgSend(`Unknown type "${type}".`, postMenuButtons());
        break;
      }
      await tgSend(`✍️ Posting a ${type}…`);
      await runPost(type);
      break;
    }

    default:
      await sendMenu();
  }
}

// Handle an inline-button press from Telegram.
async function onCallback(data) {
  if (data.startsWith('r:')) return handleReplyCallback(data);

  if (data === 'm:status')   { await sendStatus();    return ''; }
  if (data === 'm:menu')     { await sendMenu();       return ''; }
  if (data === 'm:postmenu') { await sendPostMenu();   return ''; }
  if (data === 'm:pause')    { paused = true;  await tgSend('⏸ Paused.',  mainMenuButtons()); return 'Paused'; }
  if (data === 'm:resume')   { paused = false; await tgSend('▶️ Resumed.', mainMenuButtons()); return 'Resumed'; }

  if (data.startsWith('p:')) {
    const type = data.slice(2);
    const forced = type === 'auto' ? null : type;
    await tgSend(`✍️ Posting ${forced ? `a ${forced}` : '(auto-pick)'}…`);
    runPost(forced);   // run in background — don't make the button spin through a full post cycle
    return 'Posting…';
  }

  return 'Unknown action.';
}

async function loop() {
  checkEnv();

  console.log('\n══════════════════════════════════════════');
  console.log('  DevSply Twitter Poster — Running');
  console.log(`  Posting daily at ${POST_SLOTS_ET.map(h => h + ':00').join(', ')} ET`);
  console.log('  Press Ctrl+C to stop.\n');

  // Wait for the next slot before posting — a restart/redeploy never fires an extra tweet.
  while (true) {
    const wait = msUntilNextSlot();
    console.log(`\n⏳  Next post in ${(wait / 3600000).toFixed(1)}h`);
    await sleep(wait);
    if (paused) {
      console.log('  ⏸ Paused — skipping this slot.');
      await tgSend('⏸ Skipped a scheduled post — bot is paused. /resume to restart.');
      continue;
    }
    console.log(`\n[${new Date().toLocaleTimeString()}] Posting to Twitter...`);
    await runPost();
  }
}

// Telegram control listener runs alongside the posting loop in the same process.
setMyCommands([
  { command: 'menu',    description: 'Open the control menu' },
  { command: 'status',  description: 'What the bot is doing now' },
  { command: 'postnow', description: 'Post now — pick a type' },
  { command: 'pause',   description: 'Pause scheduled posting' },
  { command: 'resume',  description: 'Resume scheduled posting' },
]);
startTelegramListener({ onCommand, onCallback })
  .catch(err => console.error('  Telegram listener crashed:', err.message));
loop();
