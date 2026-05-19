import axios from 'axios';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const MAX_LEADS = parseInt(process.env.MAX_LEADS_PER_CITY ?? '60', 10);

const CATEGORIES = [
  'plumber',
  'electrician',
  'HVAC contractor',
  'roofing contractor',
  'general contractor',
  'landscaping company',
  'pest control',
  'auto repair shop',
  'locksmith',
  'painting contractor',
  'cleaning service',
  'handyman',
  'moving company',
  'garage door repair',
  'fence contractor',
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

        // Skip if they already have a website
        if (place.websiteUri) continue;

        const phone = place.nationalPhoneNumber ?? null;
        if (!phone) continue;

        leads.push({
          place_id: placeId,
          business_name: place.displayName?.text ?? 'Unknown',
          category,
          city,
          phone,
          address: place.formattedAddress ?? null,
          rating: place.rating ?? null,
          reviews: place.userRatingCount ?? 0,
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
