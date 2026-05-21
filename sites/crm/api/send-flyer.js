import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GMAIL_USER  = process.env.SENDER_EMAIL;
const GMAIL_PASS  = process.env.GMAIL_APP_PASSWORD;
const SENDER_NAME = process.env.SENDER_NAME ?? 'Zach at DevSply';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const password = req.headers.authorization?.replace('Bearer ', '');
  const correct  = process.env.DASHBOARD_PASSWORD ?? 'devsply2025';
  if (password !== correct) return res.status(401).json({ error: 'Unauthorized' });

  const { place_id, preview_url, to_email, business_name, city } = req.body ?? {};
  if (!place_id || !preview_url || !to_email) {
    return res.status(400).json({ error: 'Missing place_id, preview_url, or to_email' });
  }

  const subject = `Your free website preview is ready — ${business_name ?? 'your business'}`;

  const body = `Hi,

I put together a free website preview for ${business_name ?? 'your business'} — take a look:

  ${preview_url}

──────────────────────────────────────
WHY THIS MATTERS
──────────────────────────────────────

📍 SEO (Search Engine Optimization)
Your new site is built to rank on Google for searches like "${business_name ?? 'your business'} ${city ?? 'Tampa'}" and nearby variations. Every page has proper titles, descriptions, and structured content so Google understands exactly what you do and where you're located.

🤖 AEO (Answer Engine Optimization)
AI tools like ChatGPT, Perplexity, and Google's AI Overview are now answering search questions directly. Your site includes structured data (FAQ schema, business schema) so when someone asks an AI "who's the best [your service] near ${city ?? 'Tampa'}?" — your business is positioned to be the answer.

📊 Google Analytics
We install Google Analytics on every site so you can see exactly how many people visit, where they come from, and what they do. You'll know if your Google Business Profile is sending traffic, which pages people read most, and whether people are clicking your phone number or contact form.

📧 Email Capture
Your site includes a contact form that lands directly in your inbox. No missed calls, no lost leads — every inquiry goes straight to you.

──────────────────────────────────────

The preview is fully built — it just needs to go live. I can have it published and ranking in under a week for $500 flat. No monthly fees, no hidden costs.

Reply to this email or just call me if you have questions.

– ${SENDER_NAME}

---
To unsubscribe, reply "unsubscribe". ${SENDER_NAME} | ${GMAIL_USER}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });

  try {
    await transporter.sendMail({
      from: `${SENDER_NAME} <${GMAIL_USER}>`,
      to: to_email,
      subject,
      text: body,
    });
  } catch (err) {
    return res.status(500).json({ error: `Email failed: ${err.message}` });
  }

  // Update lead in Supabase
  const updates = {
    landing_page_url: preview_url,
    email: to_email,
    outreach_status: 'sent',
    contacted: true,
    follow_up_count: 0,
    last_contacted_at: new Date().toISOString(),
  };

  const { error: dbErr } = await supabase
    .from('leads')
    .update(updates)
    .eq('place_id', place_id);

  if (dbErr) {
    return res.status(500).json({ error: `DB update failed: ${dbErr.message}` });
  }

  return res.status(200).json({ ok: true });
}
