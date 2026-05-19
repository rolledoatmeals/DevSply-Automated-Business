import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fromNumber, text } = req.body ?? {};
  if (!fromNumber) return res.status(400).json({ error: 'Missing fromNumber' });

  const digits = fromNumber.replace(/[^\d]/g, '').slice(-10);

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .ilike('phone', `%${digits}%`)
    .limit(1);

  const lead = leads?.[0];

  if (lead) {
    await Promise.all([
      supabase.from('leads').update({ outreach_status: 'replied' }).eq('place_id', lead.place_id),
      supabase.from('sms_messages').insert({
        place_id: lead.place_id,
        direction: 'inbound',
        body: text,
        phone: fromNumber,
      }),
    ]);
    console.log(`SMS reply from ${lead.business_name}: "${text}"`);
  }

  return res.status(200).json({ success: true });
}
