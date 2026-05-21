import axios from 'axios';

const API_KEY   = process.env.GOOGLE_PLACES_API_KEY;
const MAX_LEADS = parseInt(process.env.MAX_LEADS_PER_CITY ?? '25', 10);

// Minimum Google reviews a business must have to be worth contacting.
// Too few = might be fake/dead. Too many = already established, won't pay $500.
const MIN_REVIEWS = parseInt(process.env.MIN_REVIEWS ?? '3', 10);
const MAX_REVIEWS = parseInt(process.env.MAX_REVIEWS ?? '150', 10);

// Minimum rating — don't chase dying businesses
const MIN_RATING = parseFloat(process.env.MIN_RATING ?? '3.5');

// Ordered by cold-outreach conversion rate for web design in Tampa Bay:
// Trades that rely heavily on phone calls from Google rank first.
const CATEGORIES = [
  'plumber',              // #1 — urgent need, Google is how they're found
  'electrician',          // #2 — licensed, credibility matters
  'HVAC contractor',      // #3 — Florida essential, hot summers
  'roofing contractor',   // #4 — post-storm surge, high ticket
  'pest control',         // #5 — Florida staple, high search volume
  'landscaping company',  // #6 — recurring, losing word-of-mouth to search
  'painting contractor',  // #7 — visual trade, benefits most from gallery page
  'cleaning service',     // #8 — very active owners, strong conversion
  'auto repair shop',     // #9 — local mechanics need to stand out
  'handyman',             // #10 — broad services, phone call is how they book
  'fence contractor',     // #11 — high-ticket, infrequent referrals
  'moving company',       // #12 — seasonal spikes, need visibility
];

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.primaryTypeDisplayName',
].join(',');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchPlaces(query, pageToken = null) {
  const body = { textQuery: query, pageSize: 20 };
  if (pageToken) body.pageToken = pageToken;

  const { data } = await axios.post(
    'https://places.googleapis.com/v1/places:searchText',
    body,
    {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': FIELD_MASK + (pageToken ? ',nextPageToken' : ',nextPageToken'),
        'Content-Type': 'application/json',
      },
    }
  );
  return data;
}

export async function scrapeLeads(city, maxLeads = MAX_LEADS) {
  const leads = [];
  const seen = new Set();

  for (const category of CATEGORIES) {
    if (leads.length >= maxLeads) break;

    const query = `${category} in ${city}`;
    console.log(`  Searching: ${query}`);

    let pageToken = null;
    let pages = 0;

    do {
      if (pageToken) await sleep(2000);

      let result;
      try {
        result = await searchPlaces(query, pageToken);
      } catch (err) {
        console.log(`    ⚠ Skipped (${err.response?.status ?? err.message})`);
        await sleep(3000);
        break;
      }

      const places = result.places ?? [];

      for (const place of places) {
        if (leads.length >= maxLeads) break;

        const placeId = place.id;
        if (seen.has(placeId)) continue;
        seen.add(placeId);

        // Must not already have a website
        if (place.websiteUri) continue;

        // Must have a phone number (we can actually reach them)
        const phone = place.nationalPhoneNumber ?? null;
        if (!phone) continue;

        const reviews = place.userRatingCount ?? 0;
        const rating  = place.rating ?? 0;

        // Must be an active, established business (not brand-new or inactive)
        if (reviews < MIN_REVIEWS) continue;

        // Skip very large businesses — they already have marketing budgets and staff
        if (reviews > MAX_REVIEWS) continue;

        // Skip low-rated businesses — hard to convert, risky portfolio
        if (rating > 0 && rating < MIN_RATING) continue;

        leads.push({
          place_id: placeId,
          business_name: place.displayName?.text ?? 'Unknown',
          category,
          city,
          phone,
          address: place.formattedAddress ?? null,
          rating,
          reviews,
          email: null,
          outreach_status: 'pending',
          contacted: false,
          converted: false,
        });

        console.log(`    ✓ ${place.displayName?.text}  (${place.userRatingCount ?? 0} reviews)`);
        await sleep(200);
      }

      pageToken = result.nextPageToken ?? null;
      pages++;
    } while (pageToken && pages < 3 && leads.length < maxLeads);

    await sleep(1000); // pause between categories to avoid rate limits
  }

  console.log(`  Total leads found in ${city}: ${leads.length}`);
  return leads;
}
