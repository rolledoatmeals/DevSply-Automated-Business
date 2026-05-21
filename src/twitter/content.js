import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const TYPE_DESCRIPTIONS = {
  web_tip:     'Share one specific, actionable tip about web design, local SEO, or AEO (Answer Engine Optimization for ChatGPT/Perplexity). Keep it broad — applicable to any small business owner, not location-specific.',
  stat:        'Share a surprising stat about small businesses, websites, or local search. Make it visceral — tie it to lost money or missed customers. Keep it broad and relatable to any business owner.',
  ai_agent:    'Explain one concrete, specific thing an AI agent can do for a small business (auto-qualify leads, book appointments, answer after-hours questions, follow up automatically). Be specific, not vague. Broad audience.',
  tampa_local: 'One post out of eight — make this one Tampa Bay specific. Reference the Tampa Bay area naturally, not forced. Could be a local shoutout, a local stat, or calling out Florida small businesses.',
  engagement:  'Ask a pointed question aimed at small business owners that makes them want to reply. About how they get customers, what stops them from getting a website, or what they think about AI. Conversational, no location. Replies are the #1 growth signal — make the question genuinely easy and tempting to answer.',
  story:       'Share a short transformation result. 1-2 sentences, real-feeling, specific numbers. Keep it broad — no specific city needed. Example: "Built a site for a local plumber last week. 4 new calls in 7 days from Google. He\'d been word-of-mouth only for 9 years."',
  fun_fact:    'Share a genuinely surprising or little-known fact about websites, the internet, SEO, or tech. Make it feel like trivia someone would want to share. Examples: "The first website ever made is still live today." or "A 1-second delay in page load cuts conversions by 7%." Keep it light and interesting.',
  hot_take:    'Post a bold, slightly controversial opinion about websites, AI, automation, or digital marketing that will make people want to agree OR argue. Examples: "Your logo doesn\'t matter. Your load speed does." or "Social media followers are worthless if you don\'t own a website. You\'re building on rented land." or "Most $5,000 websites are a scam." Be direct and confident — not rude, just opinionated.',
  behind_scenes: 'A build-in-public update — what you actually worked on, a problem you solved, your process, a small win or frustration from building sites/AI tools today. Real and human. Behind-the-scenes posts get ~4x the engagement of promo posts because they make people feel they know the person.',
};

// Weighted toward replies (worth 27x a like) and value — promo-style posts perform worst.
const CYCLE = ['engagement', 'web_tip', 'hot_take', 'behind_scenes', 'stat', 'story', 'engagement', 'ai_agent', 'fun_fact', 'tampa_local'];

export function nextContentType(recentTypes = []) {
  for (const type of CYCLE) {
    if (!recentTypes.slice(-3).includes(type)) return type;
  }
  return CYCLE[0];
}

export async function generatePost(type, recentPosts = []) {
  const recentBlock = recentPosts.length
    ? `Recent posts (do NOT repeat these themes or phrases):\n${recentPosts.map(p => `- ${p}`).join('\n')}`
    : '';

  const prompt = `You write Twitter posts for Zach Shepelsky — 24, runs DevSply in Tampa, builds websites and AI tools for local businesses.

Voice: Casual, direct, occasionally opinionated. Sounds like someone who actually does this work, not a marketing account. Mix of lowercase and normal casing is fine. Short punchy sentences. No fluff.

Services (never mention prices directly):
- Websites for local businesses, done in about a week
- Custom AI tools that automate customer follow-up, answering inquiries, scheduling

Audience: Small business owners broadly — only use Tampa Bay flavor for the "tampa_local" post type.

Post type: ${type}
Task: ${TYPE_DESCRIPTIONS[type]}

${recentBlock}

Engagement note: on X, a reply is worth ~27x a like — replies are what grow the account. Where it feels natural (tips, takes, stats), end with a short genuine question that invites people to reply. Never force it.

Return ONLY valid JSON (no markdown):
{
  "tweet": "under 260 chars. 1-2 hashtags max at the end, or none if it flows better. Write like a real person — no corporate speak, no fluff. For engagement posts, ask something that feels genuine not poll-y.",
  "headline": "3-6 words — the single punchiest thing. For stats just the number. For stories/tips a short punchy phrase. No question marks.",
  "subtitle": "one line of context, under 60 chars, no hashtags"
}`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { tweet: raw, headline: 'DevSply', subtitle: 'Tampa Bay Web Design + AI Agents' };
  }
}

export async function generateBeforeAfterCaption(businessName, city, category, reviews) {
  const reviewLine = reviews > 0 ? `${reviews} Google reviews` : 'no website, no online presence';

  const prompt = `You write Twitter posts for DevSply, a Tampa Bay web design agency.

Write a caption for a before/after website transformation post.

Business: ${businessName}
Location: ${city}, Tampa Bay area
Type: ${category ?? 'local business'}
Before: ${reviewLine}, no website
After: Professional SEO-optimized website, live in 1 week, $500

Caption rules:
- Lead with the transformation or result
- Mention it's a real Tampa Bay business (use the city name)
- End with a subtle call to action
- Under 220 characters (images take space in the tweet)
- Include 2 hashtags (#TampaBay and one other relevant one)
- Write ONLY the caption, nothing else`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });

  return msg.content[0].text.trim();
}
