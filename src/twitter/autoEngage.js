import Anthropic from '@anthropic-ai/sdk';
import { twitter } from './client.js';
import { queueReplyDraft } from './replyQueue.js';

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

// Ramp up gradually based on days since first post.
function getDailyLimits(daysSinceStart) {
  const likes = Math.min(Math.floor(daysSinceStart * 3), 35);
  // Replies are now drafted for manual approval (not auto-posted), so they're
  // safe from day one — this just caps how many drafts you get to review per day.
  const replies = Math.min(5 + Math.floor(daysSinceStart / 3), 12);
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

  console.log(`\n  Day ${days} of posting — limits today: ${likeLimit} likes, ${replyLimit} reply drafts`);
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

  // ── REPLIES (drafted, not auto-posted) ───────────────────
  // Keyword-search replies are sent to Telegram as Post/Skip drafts for the
  // owner to approve. Automated keyword replies violate X's rules — a human
  // tapping "Post it" keeps the value without the suspension risk.
  if (replyLimit > 0 && todayReplies < replyLimit) {
    const toDraft = replyLimit - todayReplies;
    const query = REPLY_SEARCHES[Math.floor(Math.random() * REPLY_SEARCHES.length)];

    try {
      const results = await twitter.v2.search(query, {
        max_results: 10,
        'tweet.fields': ['author_id', 'text'],
      });
      const tweets = results.data?.data ?? [];
      let drafted = 0;

      for (const tweet of tweets) {
        if (drafted >= toDraft) break;
        if (repliedIds.has(tweet.id)) continue;
        if (tweet.author_id === myId) continue;

        const replyText = await generateReply(tweet.text);
        if (!replyText) continue;

        await queueReplyDraft({ tweetId: tweet.id, tweetText: tweet.text, replyText });
        log.replies.push({ id: tweet.id, text: replyText, at: new Date().toISOString(), status: 'drafted' });
        repliedIds.add(tweet.id);
        drafted++;
        console.log(`  📨 Drafted reply for approval: "${replyText.slice(0, 60)}..."`);
      }

      if (drafted > 0) console.log(`  📨 Sent ${drafted} reply draft(s) to Telegram for approval`);
    } catch (err) {
      console.error('  Reply search failed:', err.message);
    }
  }

  // Keep logs from growing forever
  log.likes   = log.likes.slice(-2000);
  log.replies = log.replies.slice(-500);
}

const REPLY_PERSONAS = [
  `You are Zach — 24, Tampa-based, builds websites and AI automations for small businesses. You spend a lot of time on Twitter between client work. You type like a normal person on your phone — lowercase sometimes, the occasional typo you don't fix, short sentences. You're direct and you've got opinions. You don't pitch yourself.`,
  `You are Zach — mid-20s, web dev who does a lot of local business sites. You're scrolling Twitter between projects. You type casually — not trying to sound smart, just saying what you think. Honest and sometimes a little blunt.`,
  `You are Zach, runs a small web design shop in Tampa. You see a lot of the same business owner mistakes and sometimes can't help but weigh in. You write like you text — conversational, short, real.`,
];

async function generateReply(tweetText) {
  try {
    const persona = REPLY_PERSONAS[Math.floor(Math.random() * REPLY_PERSONAS.length)];

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `${persona}

Someone posted this on Twitter:
"${tweetText}"

Write a reply. Keep it under 180 characters. Sound like a real person — not a marketer, not a bot. Vary your style:
- Sometimes just a short reaction ("yeah honestly" / "this is so real" / "same thing happened with a client")
- Sometimes a quick real take ("the issue is usually just [x]")
- Sometimes a genuine question ("wait what were they charging for hosting?")
- Sometimes a light pushback if you disagree

NEVER:
- Start with "I"
- Use hashtags
- Sound like a pitch or an ad
- Use phrases like "Great point" or "Totally agree"
- Be overly enthusiastic

If the tweet has nothing to do with business, tech, websites, AI, entrepreneurship, or money — reply with just: null

Write ONLY the reply text. No quotes, no explanation.`,
      }],
    });

    const text = msg.content[0].text.trim().replace(/^["']|["']$/g, '');
    if (text.toLowerCase() === 'null' || text.length < 4) return null;
    return text;
  } catch {
    return null;
  }
}
