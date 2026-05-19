import axios from 'axios';

const SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const SKIP_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'aol.com', 'sampleemail.com', 'example.com',
  'domain.com', 'email.com', 'yourcompany.com', 'wix.com',
  'squarespace.com', 'godaddy.com', 'yelp.com', 'google.com',
  'facebook.com', 'instagram.com', 'twitter.com',
]);

function extractEmails(text) {
  const matches = text.match(EMAIL_RE) ?? [];
  return matches.filter(e => {
    const domain = e.split('@')[1].toLowerCase();
    return !SKIP_DOMAINS.has(domain);
  });
}

async function searchGoogle(q) {
  try {
    const { data } = await axios.get(
      'https://www.googleapis.com/customsearch/v1',
      {
        params: { key: SEARCH_API_KEY, cx: SEARCH_CX, q, num: 5 },
        timeout: 8000,
      }
    );
    return data.items ?? [];
  } catch {
    return [];
  }
}

export async function findEmail(businessName, city, phone) {
  if (!SEARCH_API_KEY || !SEARCH_CX) return null;

  // Try multiple search strategies
  const queries = [
    `"${businessName}" "${city}" email contact`,
    `"${businessName}" ${city} "@"`,
    phone ? `"${phone}" email` : null,
    `"${businessName}" site:yelp.com OR site:facebook.com OR site:yellowpages.com`,
  ].filter(Boolean);

  for (const q of queries) {
    const items = await searchGoogle(q);
    for (const item of items) {
      const text = [item.title, item.snippet, item.link].join(' ');
      const found = extractEmails(text);
      if (found.length) return found[0];
    }
  }

  return null;
}
