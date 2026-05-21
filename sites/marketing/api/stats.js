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

  const head = { count: 'exact', head: true };
  const [total, fresh, contacted, replied, converted, recent] = await Promise.all([
    supabase.from('leads').select('id', head),
    supabase.from('leads').select('id', head).in('outreach_status', ['new', 'pending']),
    supabase.from('leads').select('id', head).in('outreach_status', ['sent', 'replied', 'converted']),
    supabase.from('leads').select('id', head).eq('outreach_status', 'replied'),
    supabase.from('leads').select('id', head).eq('converted', true),
    supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(8),
  ]);

  return res.status(200).json({
    stats: {
      total:     total.count ?? 0,
      new:       fresh.count ?? 0,
      contacted: contacted.count ?? 0,
      replied:   replied.count ?? 0,
      converted: converted.count ?? 0,
    },
    recent: recent.data ?? [],
  });
}
