import 'dotenv/config';
import fs from 'fs';
import { twitter } from './src/twitter/client.js';
import { generatePost, nextContentType } from './src/twitter/content.js';
import { findNextPair, postBeforeAfter } from './src/twitter/beforeAfter.js';
import { generateCard, cleanupCard } from './src/twitter/imageCard.js';
import { autoFollow } from './src/twitter/autoFollow.js';
import { autoEngage } from './src/twitter/autoEngage.js';
import { autoRetweet } from './src/twitter/autoRetweet.js';

const LOG_FILE = './posts/.twitter-log.json';
const POST_INTERVAL_HOURS = parseFloat(process.env.TWITTER_POST_INTERVAL_HOURS ?? '24');
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  console.log(`  Interval: every ${POST_INTERVAL_HOURS}h`);
  console.log('  Press Ctrl+C to stop.\n');

  while (true) {
    console.log(`\n[${new Date().toLocaleTimeString()}] Posting to Twitter...`);
    await postOnce();
    console.log(`\n⏳  Next post in ${POST_INTERVAL_HOURS}h`);
    await sleep(POST_INTERVAL_HOURS * 60 * 60 * 1000);
  }
}

loop();
