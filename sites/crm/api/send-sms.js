import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const password = req.headers.authorization?.replace('Bearer ', '');
  const correct = process.env.DASHBOARD_PASSWORD ?? 'devsply2025';
  if (password !== correct) return res.status(401).json({ error: 'Unauthorized' });

  const { place_id, phone, message } = req.body ?? {};
  if (!place_id || !phone || !message) return res.status(400).json({ error: 'Missing place_id, phone, or message' });

  const TEXTBELT_KEY = process.env.TEXTBELT_KEY;
  if (!TEXTBELT_KEY) return res.status(500).json({ error: 'TEXTBELT_KEY not configured' });

  const digits = phone.replace(/[^\d]/g, '').slice(-10);
  if (digits.length < 10) return res.status(400).json({ error: 'Invalid phone number' });

  const { data } = await axios.post('https://textbelt.com/text', {
    phone: digits,
    message,
    key: TEXTBELT_KEY,
    replyWebhookUrl: 'https://app.devsply.com/api/sms-reply',
  });

  if (!data.success) return res.status(500).json({ error: data.error ?? 'TextBelt error' });

  await supabase.from('sms_messages').insert({
    place_id,
    direction: 'outbound',
    body: message,
    phone,
  });

  return res.status(200).json({ ok: true, quotaRemaining: data.quotaRemaining });
}
