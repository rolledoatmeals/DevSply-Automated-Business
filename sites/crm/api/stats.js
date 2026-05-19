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

  const [total, withPage, emailSent, replied, converted, runs] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('leads').select('id', { count: 'exact', head: true }).not('landing_page_url', 'is', null),
    supabase.from('leads').select('id', { count: 'exact', head: true }).in('outreach_status', ['sent', 'replied', 'unresponsive']),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('outreach_status', 'replied'),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('converted', true),
    supabase.from('pipeline_runs').select('*').order('started_at', { ascending: false }).limit(10),
  ]);

  return res.status(200).json({
    stats: {
      total: total.count ?? 0,
      with_page: withPage.count ?? 0,
      emails_sent: emailSent.count ?? 0,
      replied: replied.count ?? 0,
      converted: converted.count ?? 0,
    },
    runs: runs.data ?? [],
  });
}
