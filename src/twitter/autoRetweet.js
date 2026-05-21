import { twitter } from './client.js';

// Ramp up retweeets slowly — none for first 3 days, then 1-3/day up to 5
function getDailyRetweetLimit(daysSinceStart) {
  if (daysSinceStart < 3) return 0;
  return Math.min(Math.floor((daysSinceStart - 3) * 0.4) + 1, 5);
}

const RETWEET_SEARCHES = [
  '#webdesign tips -is:retweet lang:en',
  '#smallbusiness growth -is:retweet lang:en',
  '#AI tools business -is:retweet lang:en',
  '#buildinpublic -is:retweet lang:en',
  '#entrepreneur mindset -is:retweet lang:en',
  '#SEO local -is:retweet lang:en',
  '#solopreneur -is:retweet lang:en',
  '#techtwitter productivity -is:retweet lang:en',
];

function daysSince(isoDate) {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
}

export async function autoRetweet(log) {
  if (!log.retweets) log.retweets = [];

  const firstPost = log.posts[0]?.posted_at ?? new Date().toISOString();
  const days = daysSince(firstPost);
  const limit = getDailyRetweetLimit(days);

  if (limit === 0) {
    console.log(`  Day ${days} — retweeting not started yet (starts day 3)`);
    return 0;
  }

  const today = new Date().toDateString();
  const todayCount = log.retweets.filter(r => new Date(r.at).toDateString() === today).length;

  if (todayCount >= limit) {
    console.log(`  Already retweeted ${todayCount} today (limit: ${limit}), skipping.`);
    return 0;
  }

  const retweetedIds = new Set(log.retweets.map(r => r.id));
  const me = await twitter.v2.me();
  const myId = me.data.id;

  const toRetweet = limit - todayCount;
  const query = RETWEET_SEARCHES[Math.floor(Math.random() * RETWEET_SEARCHES.length)];

  let results;
  try {
    results = await twitter.v2.search(query, {
      max_results: 15,
      'tweet.fields': ['author_id', 'public_metrics', 'text'],
    });
  } catch (err) {
    console.error('  Retweet search failed:', err.message);
    return 0;
  }

  const tweets = results.data?.data ?? [];
  let count = 0;

  for (const tweet of tweets) {
    if (count >= toRetweet) break;
    if (retweetedIds.has(tweet.id)) continue;
    if (tweet.author_id === myId) continue;

    const likes = tweet.public_metrics?.like_count ?? 0;
    const rts   = tweet.public_metrics?.retweet_count ?? 0;
    // Only retweet content that has at least some engagement — looks natural
    if (likes < 3 && rts < 1) continue;

    try {
      await twitter.v2.retweet(myId, tweet.id);
      log.retweets.push({ id: tweet.id, at: new Date().toISOString() });
      retweetedIds.add(tweet.id);
      count++;
      console.log(`  🔁 Retweeted: "${tweet.text.slice(0, 60)}..."`);
      await new Promise(r => setTimeout(r, 4000));
    } catch (err) {
      console.error('  Retweet failed:', err.message);
    }
  }

  log.retweets = log.retweets.slice(-500);
  return count;
}
