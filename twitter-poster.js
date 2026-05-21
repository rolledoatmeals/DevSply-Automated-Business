import 'dotenv/config';
import fs from 'fs';
import { twitter } from './src/twitter/client.js';
import { generatePost, generatePoll, nextContentType } from './src/twitter/content.js';
import { findNextPair, postBeforeAfter } from './src/twitter/beforeAfter.js';
import { generateCard, cleanupCard } from './src/twitter/imageCard.js';
import { autoFollow } from './src/twitter/autoFollow.js';
import { autoEngage } from './src/twitter/autoEngage.js';
import { autoRetweet } from './src/twitter/autoRetweet.js';

const LOG_FILE = './posts/.twitter-log.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

async function postOnce() {
  const log = loadLog();
  const recentTexts = log.posts.slice(-10).map(p => p.text);
  const recentTypes = log.posts.slice(-6).map(p => p.type);

  let tweetId, tweetText, postType;

  // Before/after takes priority when images are waiting
  const pair = findNextPair();
  if (pair) {
    console.log(`\n📸  Found before/after pair: ${pair.base}`);
    postType = 'before_after';
    try {
      const result = await postBeforeAfter(pair);
      tweetId   = result.id;
      tweetText = result.text;
    } catch (err) {
      console.error('  ✗ Before/after post failed:', err.message);
      return;
    }
  } else {
    postType = nextContentType(recentTypes);

    if (postType === 'poll') {
      console.log('\n📊  Generating poll...');
      let poll;
      try {
        poll = await generatePoll(recentTexts);
      } catch (err) {
        console.error('  ✗ Poll generation failed:', err.message);
        return;
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
        return;
      }
    } else {
      console.log(`\n✍️   Generating ${postType} post...`);

      let post;
      try {
        post = await generatePost(postType, recentTexts);
      } catch (err) {
        console.error('  ✗ Content generation failed:', err.message);
        return;
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
        return;
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
    console.log(`\n[${new Date().toLocaleTimeString()}] Posting to Twitter...`);
    await postOnce();
  }
}

loop();
