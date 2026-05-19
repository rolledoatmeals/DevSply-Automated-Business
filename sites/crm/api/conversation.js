import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const password = req.headers.authorization?.replace('Bearer ', '');
  const correct = process.env.DASHBOARD_PASSWORD ?? 'devsply2025';
  if (password !== correct) return res.status(401).json({ error: 'Unauthorized' });

  const { place_id } = req.query;
  if (!place_id) return res.status(400).json({ error: 'Missing place_id' });

  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('place_id', place_id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ messages: data ?? [] });
}
