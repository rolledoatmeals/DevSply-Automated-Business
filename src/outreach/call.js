import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const API_KEY        = process.env.TELNYX_API_KEY;
const FROM           = process.env.TELNYX_PHONE_NUMBER;
const CONNECTION_ID  = process.env.TELNYX_CONNECTION_ID;
const SENDER         = process.env.SENDER_NAME ?? 'Zach';
const DAILY_LIMIT    = parseInt(process.env.DAILY_CALL_LIMIT ?? '10', 10);
const CALL_GAP_MS    = parseInt(process.env.CALL_GAP_SECONDS ?? '300', 10) * 1000; // 5 min between calls

function buildScript(lead) {
  const reviews = lead.reviews > 0
    ? `You already have ${lead.reviews} Google reviews, so people are finding you there — `
    : '';
  return (
    `Hi, this is ${SENDER} calling from DevSply. ` +
    `I noticed ${lead.business_name} doesn't have a website yet. ` +
    `${reviews}` +
    `We build professional websites for local businesses starting at just 500 dollars, ` +
    `done in 7 days, with a free preview before you pay anything. ` +
    `Press 1 if you'd like to see a free preview of your website. ` +
    `Press 2 to be removed from our list. ` +
    `Again, press 1 for a free preview, or press 2 to opt out.`
  );
}

export async function placeCallOutreach(leads) {
  if (!API_KEY || !FROM || !CONNECTION_ID) {
    console.log('  ⚠  Calls skipped — add TELNYX_API_KEY, TELNYX_PHONE_NUMBER, TELNYX_CONNECTION_ID');
    return 0;
  }

  let placed = 0;

  for (const lead of leads.slice(0, DAILY_LIMIT)) {
    if (!lead.phone) continue;
    const digits = lead.phone.replace(/[^\d]/g, '').slice(-10);
    if (digits.length < 10) continue;
    const to = `+1${digits}`;

    const clientState = Buffer.from(JSON.stringify({
      place_id: lead.place_id,
      script: buildScript(lead),
    })).toString('base64');

    try {
      await axios.post(
        'https://api.telnyx.com/v2/calls',
        {
          connection_id: CONNECTION_ID,
          to,
          from: FROM,
          webhook_url: 'https://devsply.com/api/call-webhook',
          client_state: clientState,
        },
        { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } }
      );

      placed++;
      console.log(`    📞 Calling ${lead.business_name} (${lead.phone})`);

      await supabase.from('call_logs').insert({
        place_id: lead.place_id,
        phone: lead.phone,
        status: 'initiated',
      });
    } catch (err) {
      console.error(`    ✗ Call failed: ${err.response?.data?.errors?.[0]?.detail ?? err.message}`);
    }

    await new Promise(r => setTimeout(r, CALL_GAP_MS));
  }

  return placed;
}
