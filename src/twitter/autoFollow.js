import { twitter } from './client.js';

// Random 1–5 per day to look organic
function getDailyFollowLimit() {
  const min = parseInt(process.env.TWITTER_FOLLOW_MIN ?? '1', 10);
  const max = parseInt(process.env.TWITTER_FOLLOW_MAX ?? '5', 10);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const SEARCHES = [
  // Web / small business
  '#smallbusiness #marketing -is:retweet lang:en',
  '"local business" website -is:retweet lang:en',
  '#entrepreneur #webdesign -is:retweet lang:en',
  '#smallbiz owner -is:retweet lang:en',
  // AI / tech
  '#AIagent small business -is:retweet lang:en',
  '"AI automation" -is:retweet lang:en',
  '#buildinpublic -is:retweet lang:en',
  '#indiedev -is:retweet lang:en',
  // Broader entrepreneurship
  '#sidehustle -is:retweet lang:en',
  '#startuplife -is:retweet lang:en',
  '#solopreneur -is:retweet lang:en',
  // Tampa / Florida local
  '#Tampa -is:retweet lang:en',
  '#Florida entrepreneur -is:retweet lang:en',
  // General interest
  '#productivity -is:retweet lang:en',
  '#techtwitter -is:retweet lang:en',
];

export async function autoFollow(log) {
  if (!log.followed) log.followed = [];

  const today = new Date().toDateString();
  const todayCount = log.followed.filter(f => new Date(f.at).toDateString() === today).length;
  const DAILY_LIMIT = getDailyFollowLimit();

  if (todayCount >= DAILY_LIMIT) {
    console.log(`  Already followed ${todayCount} accounts today (limit: ${DAILY_LIMIT}), skipping.`);
    return 0;
  }

  const remaining = DAILY_LIMIT - todayCount;
  const followedIds = new Set(log.followed.map(f => f.id));

  // Get our own ID once
  const me = await twitter.v2.me();
  const myId = me.data.id;

  // Pick a random search query
  const query = SEARCHES[Math.floor(Math.random() * SEARCHES.length)];
  console.log(`\n  🔍 Searching: ${query}`);

  let results;
  try {
    results = await twitter.v2.search(query, {
      max_results: 20,
      expansions: ['author_id'],
      'user.fields': ['public_metrics', 'username'],
    });
  } catch (err) {
    console.error('  Search failed:', err.message);
    return 0;
  }

  const users = results.includes?.users ?? [];
  let count = 0;

  for (const user of users) {
    if (count >= remaining) break;
    if (user.id === myId) continue;
    if (followedIds.has(user.id)) continue;

    const followers = user.public_metrics?.followers_count ?? 0;
    const following = user.public_metrics?.following_count ?? 0;
    // Skip obvious bots: less than 10 followers, or following way more than followers
    if (followers < 10) continue;
    if (following > 5000 && followers < 100) continue;

    try {
      await twitter.v2.follow(myId, user.id);
      log.followed.push({ id: user.id, username: user.username, at: new Date().toISOString() });
      followedIds.add(user.id);
      count++;
      console.log(`  ➕ Followed @${user.username} (${followers} followers)`);
      await new Promise(r => setTimeout(r, 2500));
    } catch (err) {
      console.error(`  ✗ Could not follow @${user.username}: ${err.message}`);
    }
  }

  // Keep log from growing forever
  log.followed = log.followed.slice(-1000);
  return count;
}
