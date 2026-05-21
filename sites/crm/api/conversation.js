import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CALL_LABELS = {
  initiated:   { emoji: '📞', text: 'Call placed' },
  answered:    { emoji: '📞', text: 'Call answered' },
  pressed_1:   { emoji: '✅', text: 'Called — pressed 1 (Interested!)' },
  pressed_2:   { emoji: '🚫', text: 'Called — pressed 2 (Opted out)' },
  no_answer:   { emoji: '📵', text: 'Called — no answer' },
  no_response: { emoji: '📞', text: 'Called — no key pressed' },
  opted_out:   { emoji: '🚫', text: 'Called — opted out' },
};

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

  const [smsResult, callResult] = await Promise.all([
    supabase.from('sms_messages').select('*').eq('place_id', place_id).order('created_at', { ascending: true }),
    supabase.from('call_logs').select('*').eq('place_id', place_id).order('created_at', { ascending: true }),
  ]);

  const smsMessages = (smsResult.data ?? []).map(m => ({ ...m, kind: 'sms' }));

  // Only surface the most meaningful call event per call attempt (skip 'initiated', show final status)
  const callMessages = (callResult.data ?? [])
    .filter(c => c.status !== 'initiated' && c.status !== 'answered')
    .map(c => {
      const label = CALL_LABELS[c.status] ?? { emoji: '📞', text: `Call — ${c.status}` };
      return {
        ...c,
        kind:      'call',
        direction: 'outbound',
        body:      `${label.emoji} ${label.text}`,
      };
    });

  const messages = [...smsMessages, ...callMessages]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return res.status(200).json({ messages });
}
