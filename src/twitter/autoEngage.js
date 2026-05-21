import Anthropic from '@anthropic-ai/sdk';
import { twitter } from './client.js';

const anthropic = new Anthropic();

const LIKE_SEARCHES = [
  '#smallbusiness website -is:retweet lang:en',
  '#webdesign tips -is:retweet lang:en',
  '#SEO local business -is:retweet lang:en',
  '#AItools business -is:retweet lang:en',
  '#entrepreneur website -is:retweet lang:en',
  '"AI agent" business -is:retweet lang:en',
  '#smallbiz marketing -is:retweet lang:en',
  '"ChatGPT" business owner -is:retweet lang:en',
];

const REPLY_SEARCHES = [
  '"do I need a website" -is:retweet lang:en',
  '"no website" small business -is:retweet lang:en',
  '"how do I get more customers" -is:retweet lang:en',
  '"AI agent" how does it work -is:retweet lang:en',
  '"website worth it" business -is:retweet lang:en',
  '"Google ranking" small business -is:retweet lang:en',
];

// Ramp up gradually based on days since first post
function getDailyLimits(daysSinceStart) {
  const likes   = Math.min(Math.floor(daysSinceStart * 3), 35);
  // No replies for first 2 weeks — let the account build history first
  const replies = daysSinceStart < 14 ? 0 : Math.min(Math.floor((daysSinceStart - 14) * 0.6), 8);
  return { likes, replies };
}

function daysSince(isoDate) {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
}

export async function autoEngage(log) {
  if (!log.likes)   log.likes   = [];
  if (!log.replies) log.replies = [];

  const firstPost = log.posts[0]?.posted_at ?? new Date().toISOString();
  const days = daysSince(firstPost);
  const { likes: likeLimit, replies: replyLimit } = getDailyLimits(days);

  const today = new Date().toDateString();
  const todayLikes   = log.likes.filter(l => new Date(l.at).toDateString() === today).length;
  const todayReplies = log.replies.filter(r => new Date(r.at).toDateString() === today).length;

  console.log(`\n  Day ${days} of posting — limits today: ${likeLimit} likes, ${replyLimit} replies`);
  console.log(`  Used today: ${todayLikes} likes, ${todayReplies} replies`);

  const likedIds   = new Set(log.likes.map(l => l.id));
  const repliedIds = new Set(log.replies.map(r => r.id));

  const me = await twitter.v2.me();
  const myId = me.data.id;

  // ── LIKES ────────────────────────────────────────────────
  if (todayLikes < likeLimit) {
    const toLike = likeLimit - todayLikes;
    const query = LIKE_SEARCHES[Math.floor(Math.random() * LIKE_SEARCHES.length)];

    try {
      const results = await twitter.v2.search(query, {
        max_results: 20,
        'tweet.fields': ['author_id'],
      });
      const tweets = results.data?.data ?? [];
      let liked = 0;

      for (const tweet of tweets) {
        if (liked >= toLike) break;
        if (likedIds.has(tweet.id)) continue;
        if (tweet.author_id === myId) continue;

        try {
          await twitter.v2.like(myId, tweet.id);
          log.likes.push({ id: tweet.id, at: new Date().toISOString() });
          likedIds.add(tweet.id);
          liked++;
          await new Promise(r => setTimeout(r, 3000));
        } catch { /* skip if already liked or restricted */ }
      }

      if (liked > 0) console.log(`  ❤️  Liked ${liked} posts`);
    } catch (err) {
      console.error('  Like search failed:', err.message);
    }
  }

  // ── REPLIES ──────────────────────────────────────────────
  if (replyLimit > 0 && todayReplies < replyLimit) {
    const toReply = replyLimit - todayReplies;
    const query = REPLY_SEARCHES[Math.floor(Math.random() * REPLY_SEARCHES.length)];

    try {
      const results = await twitter.v2.search(query, {
        max_results: 10,
        'tweet.fields': ['author_id', 'text'],
      });
      const tweets = results.data?.data ?? [];
      let replied = 0;

      for (const tweet of tweets) {
        if (replied >= toReply) break;
        if (repliedIds.has(tweet.id)) continue;
        if (tweet.author_id === myId) continue;

        const replyText = await generateReply(tweet.text);
        if (!replyText) continue;

        try {
          await twitter.v2.tweet({
            text: replyText,
            reply: { in_reply_to_tweet_id: tweet.id },
          });
          log.replies.push({ id: tweet.id, text: replyText, at: new Date().toISOString() });
          repliedIds.add(tweet.id);
          replied++;
          console.log(`  💬 Replied: "${replyText}"`);
          await new Promise(r => setTimeout(r, 8000));
        } catch (err) {
          console.error('  Reply failed:', err.message);
        }
      }
    } catch (err) {
      console.error('  Reply search failed:', err.message);
    }
  }

  // Keep logs from growing forever
  log.likes   = log.likes.slice(-2000);
  log.replies = log.replies.slice(-500);
}

async function generateReply(tweetText) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `You are Zach — 24, builds websites and AI tools for small businesses. Casual, direct, occasionally blunt. You've seen a lot of business owners make the same mistakes online.

Someone tweeted this:
"${tweetText}"

Write a reply. Make it sound like something you'd actually type on your phone — short, natural, a little rough around the edges. Not polished. Not corporate.

Good reply styles:
- A quick real-world observation ("yeah this is way more common than people think")
- A specific tip that sounds like experience talking ("the fix is usually just [x]")
- A genuine question back that shows you're curious
- A light contrarian take if you actually disagree
- A short relatable story ("built one for a client last month, same issue")

Bad reply styles (never do these):
- "Great point!" or any empty validation
- Anything that sounds like an ad or a pitch
- Starting with "I"
- Hashtags
- Anything over 200 characters

If the tweet has nothing to do with websites, business, AI, or entrepreneurship — respond with just the word: null

Write ONLY the reply text or null.`,
      }],
    });

    const text = msg.content[0].text.trim();
    if (text.toLowerCase() === 'null' || text.length < 5) return null;
    return text;
  } catch {
    return null;
  }
}
