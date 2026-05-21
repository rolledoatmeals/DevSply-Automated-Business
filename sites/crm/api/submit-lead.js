import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const GMAIL_USER  = process.env.SENDER_EMAIL;
const GMAIL_PASS  = process.env.GMAIL_APP_PASSWORD;
const SENDER_NAME = process.env.SENDER_NAME ?? 'Zach';
const SITE_URL    = 'https://devsply.com';

function makeUnsubToken(email) {
  return Buffer.from(email).toString('base64url');
}

function welcomeEmail({ name, business_name, city, interest, unsubUrl }) {
  const interestLine = {
    website:  'a professional website',
    ai_agent: 'a custom AI agent',
    both:     'a website + AI agent package',
    explore:  'more information about what we offer',
  }[interest] ?? 'what we offer';

  const subject = `Got it, ${name} — here's what happens next`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)">

      <!-- Header -->
      <tr>
        <td style="background:#0a1628;padding:28px 36px">
          <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">
            Dev<span style="color:#f59e0b">Sply</span>
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:1px;text-transform:uppercase">Tampa Bay Web Design &amp; AI Agents</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 36px 28px">
          <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3">
            Hey ${name}, we got your info! 🙌
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7">
            I'll be putting together a <strong>free preview</strong> for <strong>${business_name}</strong> and reaching out to you within <strong>24 hours</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7">
            You said you're interested in ${interestLine} — I'll make sure the preview is built around exactly that.
          </p>

          <!-- What happens next -->
          <table width="100%" style="background:#f8fafc;border-radius:12px;padding:20px 24px;border:1px solid #e2e8f0;margin-bottom:28px" cellpadding="0" cellspacing="0">
            <tr><td>
              <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">What happens next</p>
              <p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6">
                <span style="color:#f59e0b;font-weight:700">1.</span>&nbsp; I build a free custom preview of your website — no cookie-cutter templates.
              </p>
              <p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6">
                <span style="color:#f59e0b;font-weight:700">2.</span>&nbsp; I send you the link to review it before you commit to anything.
              </p>
              <p style="margin:0;font-size:14px;color:#334155;line-height:1.6">
                <span style="color:#f59e0b;font-weight:700">3.</span>&nbsp; If you love it, we go live. If not, no hard feelings — zero cost to you.
              </p>
            </td></tr>
          </table>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr>
              <td style="background:#f59e0b;border-radius:10px">
                <a href="mailto:devsply@gmail.com?subject=Question about my preview — ${encodeURIComponent(business_name)}"
                   style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0a1628;text-decoration:none">
                  Reply with any questions →
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:15px;color:#64748b;line-height:1.7">
            Talk soon,<br>
            <strong style="color:#0f172a">Zach</strong><br>
            <span style="font-size:13px;color:#94a3b8">DevSply · Tampa Bay, FL · devsply.com</span>
          </p>
        </td>
      </tr>

      <!-- Footer (CAN-SPAM required) -->
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7;text-align:center">
            You're receiving this because you submitted a request at devsply.com.<br>
            DevSply · Tampa, FL 33602<br>
            <a href="${SITE_URL}/api/unsubscribe?t=${makeUnsubToken(GMAIL_USER)}&e=${makeUnsubToken(name + '|' + business_name)}"
               style="color:#94a3b8;text-decoration:underline">Unsubscribe</a> — we'll remove you immediately and never email you again.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `Hey ${name},

Got your info — I'll be putting together a free preview for ${business_name} and reaching out within 24 hours.

WHAT HAPPENS NEXT:
1. I build a custom free preview — no templates
2. I send you the link to review before you commit
3. If you love it, we go live. If not, no cost to you.

Any questions? Just reply to this email.

— Zach
DevSply · Tampa Bay, FL · devsply.com

---
You're receiving this because you submitted a request at devsply.com.
DevSply · Tampa, FL 33602
Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, business_name, city, business_type, interest, phone, email } = req.body ?? {};

  if (!name || !business_name) {
    return res.status(400).json({ error: 'name and business_name are required' });
  }

  const place_id   = `form_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const source_city = city || 'Tampa, FL';

  const { error: dbErr } = await supabase.from('leads').upsert({
    place_id,
    business_name,
    city:            source_city,
    category:        business_type ?? 'local business',
    phone:           phone ?? null,
    email:           email ?? null,
    website:         null,
    reviews:         0,
    rating:          null,
    outreach_status: 'new',
    contacted:       false,
    converted:       false,
    source:          'website_form',
    notes:           `Inbound lead — ${name} — interested in: ${interest ?? 'website'}`,
    created_at:      new Date().toISOString(),
  }, { onConflict: 'place_id' });

  if (dbErr) {
    console.error('submit-lead db error:', dbErr);
    return res.status(500).json({ error: 'Failed to save lead' });
  }

  // Send welcome email if they provided one
  if (email && GMAIL_USER && GMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: GMAIL_USER, pass: GMAIL_PASS },
      });

      const unsubUrl = `${SITE_URL}/api/unsubscribe?t=${makeUnsubToken(email)}&e=${makeUnsubToken(name + '|' + business_name)}`;
      const { subject, html, text } = welcomeEmail({ name, business_name, city: source_city, interest, unsubUrl });

      await transporter.sendMail({
        from:    `"${SENDER_NAME} at DevSply" <${GMAIL_USER}>`,
        to:      email,
        replyTo: GMAIL_USER,
        subject,
        text,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
    } catch (emailErr) {
      console.error('submit-lead welcome email error:', emailErr.message);
      // Don't fail the request — lead is already saved
    }
  }

  return res.status(200).json({ ok: true });
}
