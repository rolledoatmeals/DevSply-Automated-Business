import axios from 'axios';

const TEXTBELT_KEY  = process.env.TEXTBELT_KEY;
const SENDER_NAME   = process.env.SENDER_NAME ?? 'Zach';
const DAILY_LIMIT   = parseInt(process.env.DAILY_SMS_LIMIT ?? '40', 10);

function buildSMS(lead) {
  const reviews = lead.reviews > 0 ? ` You have ${lead.reviews} Google reviews` : '';
  return `Hi! I noticed ${lead.business_name} doesn't have a website.${reviews} — customers searching online can't find you. I build websites for local businesses starting at $500, done in a week. Want a free preview? – ${SENDER_NAME}`;
}

export async function sendSMSOutreach(leads) {
  if (!TEXTBELT_KEY) {
    console.log('  ⚠  SMS skipped — add TEXTBELT_KEY to env vars');
    return 0;
  }

  let sent = 0;

  for (const lead of leads.slice(0, DAILY_LIMIT)) {
    if (!lead.phone) continue;

    const phone = lead.phone.replace(/[^\d]/g, '').slice(-10);
    if (phone.length < 10) continue;

    console.log(`\n  → ${lead.business_name}`);
    console.log(`    ${lead.phone}`);

    try {
      const { data } = await axios.post('https://textbelt.com/text', {
        phone,
        message: buildSMS(lead),
        key: TEXTBELT_KEY,
        replyWebhookUrl: 'https://app.devsply.com/api/sms-reply',
      });

      if (data.success) {
        sent++;
        console.log(`    ✓ Sent (${data.quotaRemaining} texts remaining)`);
      } else {
        console.error(`    ✗ Failed: ${data.error}`);
      }
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
    }

    // Random 3–7 second gap to avoid carrier filtering
    const delay = 3000 + Math.floor(Math.random() * 4000);
    await new Promise(r => setTimeout(r, delay));
  }

  return sent;
}
