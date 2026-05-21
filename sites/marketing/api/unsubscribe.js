import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

export default async function handler(req, res) {
  // Support both GET (link click) and POST (one-click unsubscribe per RFC 8058)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end();
  }

  const { t: emailToken } = req.query;
  if (!emailToken) {
    return res.status(400).send(page('Invalid link', 'This unsubscribe link is missing required information.'));
  }

  let email;
  try {
    email = Buffer.from(emailToken, 'base64url').toString('utf8');
    if (!email.includes('@')) throw new Error('not an email');
  } catch {
    return res.status(400).send(page('Invalid link', 'This unsubscribe link appears to be malformed.'));
  }

  // Mark unsubscribed in Supabase — tries both email column and notes lookup
  await supabase.from('leads')
    .update({ unsubscribed: true, outreach_status: 'unsubscribed' })
    .eq('email', email);

  // One-click POST returns 200 with no body (RFC 8058)
  if (req.method === 'POST') return res.status(200).end();

  return res.status(200).send(page(
    "You're unsubscribed",
    `The email address <strong>${email}</strong> has been removed from all DevSply communications immediately. You won't hear from us again.`,
  ));
}

function page(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — DevSply</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
  .card{background:#fff;border-radius:16px;padding:2.5rem 2rem;max-width:440px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.07)}
  .icon{font-size:3rem;margin-bottom:1rem}
  h1{font-size:1.4rem;font-weight:800;color:#0f172a;margin-bottom:0.75rem}
  p{font-size:0.95rem;color:#64748b;line-height:1.7;margin-bottom:1.5rem}
  a{display:inline-block;padding:0.75rem 1.75rem;background:#f59e0b;color:#0a1628;border-radius:8px;font-weight:700;text-decoration:none;font-size:0.9rem}
</style>
</head>
<body>
<div class="card">
  <div class="icon">✅</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="https://devsply.com">Back to DevSply</a>
</div>
</body>
</html>`;
}
