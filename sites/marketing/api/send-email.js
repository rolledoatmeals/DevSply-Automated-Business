import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GMAIL_USER  = process.env.SENDER_EMAIL;
const GMAIL_PASS  = process.env.GMAIL_APP_PASSWORD;
const SENDER_NAME = process.env.SENDER_NAME ?? 'Zach';
const SITE_URL    = 'https://devsply.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const password = req.headers.authorization?.replace('Bearer ', '');
  const correct  = process.env.DASHBOARD_PASSWORD ?? 'devsply2025';
  if (password !== correct) return res.status(401).json({ error: 'Unauthorized' });

  const { place_id, to_email, subject, body } = req.body ?? {};
  if (!to_email || !subject || !body) {
    return res.status(400).json({ error: 'to_email, subject and body are required' });
  }
  if (!GMAIL_USER || !GMAIL_PASS) {
    return res.status(500).json({ error: 'Email not configured (SENDER_EMAIL / GMAIL_APP_PASSWORD)' });
  }

  const unsubUrl = `${SITE_URL}/api/unsubscribe?t=${Buffer.from(to_email).toString('base64url')}`;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });

    await transporter.sendMail({
      from:    `"${SENDER_NAME} at DevSply" <${GMAIL_USER}>`,
      to:      to_email,
      replyTo: GMAIL_USER,
      subject,
      text: `${body}\n\n—\nDevSply · Tampa, FL 33602\nUnsubscribe: ${unsubUrl}`,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  } catch (err) {
    console.error('send-email error:', err.message);
    return res.status(500).json({ error: 'Failed to send email' });
  }

  // Mark the lead as contacted
  if (place_id) {
    await supabase.from('leads')
      .update({ outreach_status: 'sent', contacted: true, last_contacted_at: new Date().toISOString() })
      .eq('place_id', place_id)
      .eq('outreach_status', 'new');
  }

  return res.status(200).json({ ok: true });
}
