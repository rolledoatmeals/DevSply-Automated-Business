import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).end();

  const password = req.headers.authorization?.replace('Bearer ', '');
  const correct = process.env.DASHBOARD_PASSWORD ?? 'devsply2025';
  if (password !== correct) return res.status(401).json({ error: 'Unauthorized' });

  const { place_id, status, notes, converted, landing_page_url, email } = req.body ?? {};
  if (!place_id) return res.status(400).json({ error: 'Missing place_id' });

  const updates = {};
  if (status !== undefined)           updates.outreach_status = status;
  if (notes !== undefined)            updates.notes = notes;
  if (converted !== undefined)        updates.converted = converted;
  if (landing_page_url !== undefined) updates.landing_page_url = landing_page_url;
  if (email !== undefined)            updates.email = email;

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

  const { error } = await supabase.from('leads').update(updates).eq('place_id', place_id);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
