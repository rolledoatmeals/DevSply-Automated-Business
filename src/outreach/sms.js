import twilio from 'twilio';

const ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER   = process.env.TWILIO_PHONE_NUMBER;
const SENDER_NAME   = process.env.SENDER_NAME ?? 'Zach';
const DAILY_LIMIT   = parseInt(process.env.DAILY_SMS_LIMIT ?? '20', 10);

function buildSMS(lead) {
  const reviews = lead.reviews > 0 ? ` You have ${lead.reviews} Google reviews` : '';
  return `Hi! I noticed ${lead.business_name} doesn't have a website.${reviews} — customers searching online can't find you.

I build websites for local businesses starting at $500, done in a week. Want a free preview?

– ${SENDER_NAME}

Reply STOP to opt out.`;
}

export async function sendSMSOutreach(leads) {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    console.log('  ⚠  SMS skipped — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
    return 0;
  }

  const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
  let sent = 0;

  for (const lead of leads.slice(0, DAILY_LIMIT)) {
    if (!lead.phone) continue;

    const phone = lead.phone.replace(/[^\d+]/g, '');
    if (phone.length < 10) continue;

    const to = phone.startsWith('+') ? phone : `+1${phone.slice(-10)}`;
    const body = buildSMS(lead);

    console.log(`\n  → ${lead.business_name}`);
    console.log(`    ${to}`);

    try {
      await client.messages.create({ from: FROM_NUMBER, to, body });
      sent++;
      console.log('    ✓ SMS sent');
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
    }
  }

  return sent;
}
