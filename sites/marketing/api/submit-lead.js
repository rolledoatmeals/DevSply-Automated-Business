import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, business_name, city, business_type, interest, phone, email } = req.body ?? {};

  if (!name || !business_name) {
    return res.status(400).json({ error: 'name and business_name are required' });
  }

  // Build a synthetic place_id so it doesn't collide with Google Places IDs
  const place_id = `form_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const source_city = city || 'Tampa, FL';

  const { error } = await supabase.from('leads').upsert({
    place_id,
    business_name,
    city:            source_city,
    category:        business_type ?? 'local business',
    phone:           phone ?? null,
    email:           email ?? null,
    website:         null,
    reviews:         0,
    rating:          null,
    outreach_status: 'new',
    contacted:       false,
    converted:       false,
    source:          'website_form',
    notes:           `Inbound lead — ${name} — interested in: ${interest ?? 'website'}`,
    created_at:      new Date().toISOString(),
  }, { onConflict: 'place_id' });

  if (error) {
    console.error('submit-lead error:', error);
    return res.status(500).json({ error: 'Failed to save lead' });
  }

  return res.status(200).json({ ok: true });
}
