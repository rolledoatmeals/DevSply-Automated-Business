import axios from 'axios';

const SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const SEARCH_CX     = process.env.GOOGLE_SEARCH_CX;

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const SKIP_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'sampleemail.com', 'example.com', 'domain.com', 'email.com',
  'yourcompany.com', 'wix.com', 'squarespace.com', 'godaddy.com',
  'yelp.com', 'google.com', 'facebook.com', 'instagram.com', 'twitter.com',
  'bbb.org', 'yellowpages.com', 'mapquest.com', 'foursquare.com',
  'manta.com', 'angieslist.com', 'homeadvisor.com', 'thumbtack.com',
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
    const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: { key: SEARCH_API_KEY, cx: SEARCH_CX, q, num: 5 },
      timeout: 8000,
    });
    return data.items ?? [];
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message ?? err.message;
    if (status === 429) console.log('    ⚠ Google Search quota hit');
    else if (status === 400) console.log(`    ⚠ Google Search bad request: ${msg}`);
    return [];
  }
}

// Fetch a page and extract emails from its HTML
async function scrapePageForEmail(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 6000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; emailbot/1.0)' },
      maxContentLength: 200_000,
    });
    const emails = extractEmails(data);
    return emails[0] ?? null;
  } catch {
    return null;
  }
}

export async function findEmail(businessName, city, phone) {
  if (!SEARCH_API_KEY || !SEARCH_CX) return null;

  const queries = [
    `"${businessName}" "${city}" contact email`,
    `"${businessName}" ${city} site:yelp.com`,
    `"${businessName}" ${city} site:facebook.com`,
    `"${businessName}" ${city} site:yellowpages.com`,
    phone ? `"${phone}" contact` : null,
  ].filter(Boolean);

  const visitedUrls = new Set();

  for (const q of queries) {
    const items = await searchGoogle(q);

    for (const item of items) {
      // 1. Check snippet/title text first (fast)
      const snippetText = [item.title, item.snippet, item.link].join(' ');
      const snippetEmails = extractEmails(snippetText);
      if (snippetEmails.length) return snippetEmails[0];

      // 2. Scrape the actual page for emails (Yelp, Facebook, YP listings)
      const link = item.link;
      if (!visitedUrls.has(link) && isContactPage(link)) {
        visitedUrls.add(link);
        const pageEmail = await scrapePageForEmail(link);
        if (pageEmail) return pageEmail;
      }
    }
  }

  return null;
}

function isContactPage(url) {
  return (
    url.includes('yelp.com/biz/') ||
    url.includes('facebook.com/') ||
    url.includes('yellowpages.com/') ||
    url.includes('manta.com/') ||
    url.includes('bbb.org/') ||
    url.includes('mapquest.com/') ||
    url.includes('superpages.com/')
  );
}
