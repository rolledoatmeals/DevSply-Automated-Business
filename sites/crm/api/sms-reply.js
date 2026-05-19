import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fromNumber, text, textId } = req.body ?? {};
  if (!fromNumber) return res.status(400).json({ error: 'Missing fromNumber' });

  // Normalize phone to match how we store it
  const digits = fromNumber.replace(/[^\d]/g, '').slice(-10);

  // Find the lead by phone number
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .ilike('phone', `%${digits}%`)
    .limit(1);

  const lead = leads?.[0];

  if (lead) {
    // Mark as replied
    await supabase
      .from('leads')
      .update({ outreach_status: 'replied' })
      .eq('place_id', lead.place_id);

    console.log(`SMS reply from ${lead.business_name} (${fromNumber}): "${text}"`);
  } else {
    console.log(`SMS reply from unknown number ${fromNumber}: "${text}"`);
  }

  return res.status(200).json({ success: true });
}
