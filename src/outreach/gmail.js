import nodemailer from 'nodemailer';

const GMAIL_USER  = process.env.SENDER_EMAIL;
const GMAIL_PASS  = process.env.GMAIL_APP_PASSWORD;
const SENDER_NAME = process.env.SENDER_NAME ?? 'Zach';
const DAILY_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT ?? '40', 10);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
});

// Days to wait before each follow-up
const FOLLOW_UP_DAYS = [3, 14, 30];

export function nextFollowUpDate(followUpCount) {
  const days = FOLLOW_UP_DAYS[followUpCount] ?? 30;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function buildEmail(lead, isFollowUp = false) {
  const hasPage = !!lead.landing_page_url;
  const reviews = lead.reviews > 0 ? `${lead.reviews} Google reviews` : 'a Google listing';
  const count = lead.follow_up_count ?? 0;

  if (isFollowUp) {
    const subject = hasPage
      ? `Re: Website preview for ${lead.business_name}`
      : `Re: ${lead.business_name} — still no website?`;

    const body = count >= 2
      ? `Hi,

Last follow-up from me — I built a free website preview for ${lead.business_name}${hasPage ? ` at ${lead.landing_page_url}` : ''}.

If the timing isn't right, no worries at all. The offer stands whenever you're ready.

– ${SENDER_NAME}

---
To unsubscribe reply "unsubscribe". ${SENDER_NAME} | ${GMAIL_USER}`
      : `Hi,

Just wanted to make sure my last email didn't get buried. I built a free website preview for ${lead.business_name}${hasPage ? `:\n${lead.landing_page_url}` : ''}.

${lead.reviews > 0 ? `You have ${reviews} — customers are looking for you but can't find you online.` : 'Customers are searching for you online but can\'t find you.'}

Takes a week to build, starts at $500. Worth a quick look?

– ${SENDER_NAME}

---
To unsubscribe reply "unsubscribe". ${SENDER_NAME} | ${GMAIL_USER}`;

    return { subject, body };
  }

  const subject = hasPage
    ? `I built a free website preview for ${lead.business_name}`
    : `${lead.business_name} — your customers can't find you online`;

  const body = hasPage
    ? `Hi,

I was looking for a ${lead.category} in ${lead.city} and noticed ${lead.business_name} has ${reviews} but no website.

I already built you a free preview — take a look:
${lead.landing_page_url}

Customers are searching for you online and can't find you. I can turn this into a real website for $500, done in a week.

Interested? Just reply or call me.

– ${SENDER_NAME}

---
To unsubscribe reply "unsubscribe". ${SENDER_NAME} | ${GMAIL_USER}`
    : `Hi,

I was looking for a ${lead.category} in ${lead.city} and noticed ${lead.business_name} has ${reviews} but no website.

Customers searching for you online can't find you — that's lost business every day.

I build websites for local businesses starting at $500, done in a week. Want me to put together a free preview?

– ${SENDER_NAME}

---
To unsubscribe reply "unsubscribe". ${SENDER_NAME} | ${GMAIL_USER}`;

  return { subject, body };
}

export async function sendOutreach(leads, isFollowUp = false) {
  let sent = 0;
  const label = isFollowUp ? 'follow-up' : 'outreach';

  for (const lead of leads.slice(0, DAILY_LIMIT)) {
    if (!lead.email) continue;

    const { subject, body } = buildEmail(lead, isFollowUp);
    const hasPage = !!lead.landing_page_url;

    console.log(`\n  → ${lead.business_name}${hasPage ? ' [+page]' : ''} [${label} #${(lead.follow_up_count ?? 0) + (isFollowUp ? 1 : 0)}]`);
    console.log(`    ${lead.email}`);

    try {
      await transporter.sendMail({
        from: `${SENDER_NAME} <${GMAIL_USER}>`,
        to: lead.email,
        subject,
        text: body,
      });
      sent++;
      console.log('    ✓ Sent');
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
    }
  }

  return sent;
}
