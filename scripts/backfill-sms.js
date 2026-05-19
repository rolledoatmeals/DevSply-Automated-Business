#!/usr/bin/env node
// One-time script: insert sms_messages records for leads that were texted
// before the sms_messages table existed.
// Run: node scripts/backfill-sms.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SENDER_NAME = process.env.SENDER_NAME ?? 'Zach';

function buildSMS(lead) {
  const reviews = lead.reviews > 0 ? ` You have ${lead.reviews} Google reviews` : '';
  return `Hi! I noticed ${lead.business_name} doesn't have a website.${reviews} — customers searching online can't find you. I build websites for local businesses starting at $500, done in a week. Want a free preview? – ${SENDER_NAME}`;
}

const { data: leads, error } = await supabase
  .from('leads')
  .select('*')
  .in('outreach_status', ['sent', 'replied', 'unresponsive'])
  .is('email', null)
  .not('phone', 'is', null);

if (error) { console.error('Error fetching leads:', error.message); process.exit(1); }

console.log(`Found ${leads.length} texted leads. Checking for missing sms_messages records...`);

let inserted = 0;
for (const lead of leads) {
  const { count } = await supabase
    .from('sms_messages')
    .select('id', { count: 'exact', head: true })
    .eq('place_id', lead.place_id)
    .eq('direction', 'outbound');

  if (count > 0) {
    console.log(`  skip ${lead.business_name} — already has outbound message`);
    continue;
  }

  const sentAt = lead.last_contacted_at ?? new Date().toISOString();
  const { error: insertErr } = await supabase.from('sms_messages').insert({
    place_id: lead.place_id,
    direction: 'outbound',
    body: buildSMS(lead),
    phone: lead.phone,
    created_at: sentAt,
  });

  if (insertErr) {
    console.error(`  ✗ ${lead.business_name}: ${insertErr.message}`);
  } else {
    inserted++;
    console.log(`  ✓ ${lead.business_name} (${lead.phone})`);
  }
}

console.log(`\nDone. Inserted ${inserted} backfilled records.`);
