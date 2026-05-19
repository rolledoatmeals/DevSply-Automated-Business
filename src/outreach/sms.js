import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase   = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const API_KEY    = process.env.TELNYX_API_KEY;
const FROM       = process.env.TELNYX_PHONE_NUMBER;
const SENDER     = process.env.SENDER_NAME ?? 'Zach';
const DAILY_LIMIT = parseInt(process.env.DAILY_SMS_LIMIT ?? '40', 10);

export function buildSMS(lead) {
  const reviews = lead.reviews > 0 ? ` You have ${lead.reviews} Google reviews` : '';
  return `Hi! I noticed ${lead.business_name} doesn't have a website.${reviews} — customers searching online can't find you. I build websites for local businesses starting at $500, done in a week. Want a free preview? – ${SENDER}`;
}

export async function sendSMSOutreach(leads) {
  if (!API_KEY || !FROM) {
    console.log('  ⚠  SMS skipped — add TELNYX_API_KEY and TELNYX_PHONE_NUMBER');
    return 0;
  }

  let sent = 0;

  for (const lead of leads.slice(0, DAILY_LIMIT)) {
    if (!lead.phone) continue;
    const digits = lead.phone.replace(/[^\d]/g, '').slice(-10);
    if (digits.length < 10) continue;
    const to = `+1${digits}`;

    console.log(`\n  → ${lead.business_name} (${lead.phone})`);

    try {
      const { data } = await axios.post(
        'https://api.telnyx.com/v2/messages',
        { from: FROM, to, text: buildSMS(lead), webhook_url: 'https://app.devsply.com/api/sms-reply' },
        { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } }
      );

      sent++;
      console.log(`    ✓ Sent (id: ${data.data?.id})`);
      await supabase.from('sms_messages').insert({
        place_id: lead.place_id,
        direction: 'outbound',
        body: buildSMS(lead),
        phone: lead.phone,
      });
    } catch (err) {
      console.error(`    ✗ Failed: ${err.response?.data?.errors?.[0]?.detail ?? err.message}`);
    }

    const delay = 3000 + Math.floor(Math.random() * 4000);
    await new Promise(r => setTimeout(r, delay));
  }

  return sent;
}
