import 'dotenv/config';
import { createCampaign, getCampaigns } from './instantly.js';

console.log('\n══════════════════════════════════════════');
console.log('  DevSply — Instantly Campaign Setup');
console.log('══════════════════════════════════════════\n');

const existing = await getCampaigns();
if (existing.length > 0) {
  console.log('Existing campaigns:\n');
  existing.forEach(c => {
    console.log(`  ID: ${c.id}`);
    console.log(`  Name: ${c.name}`);
    console.log(`  Status: ${c.status ?? 'unknown'}\n`);
  });
  console.log('If you want to use one of these, add its ID to .env as INSTANTLY_CAMPAIGN_ID\n');
}

const campaignName = `DevSply Local Business Outreach — ${new Date().toLocaleDateString()}`;
console.log(`Creating campaign: "${campaignName}"...`);

try {
  const campaign = await createCampaign(campaignName);
  console.log('\n✓ Campaign created!\n');
  console.log(`  Campaign ID: ${campaign.id}`);
  console.log(`  Name: ${campaign.name}`);
  console.log('\nAdd this to your .env file:');
  console.log(`  INSTANTLY_CAMPAIGN_ID=${campaign.id}\n`);
  console.log('Then connect a sending email in the Instantly dashboard:');
  console.log('  app.instantly.ai → your campaign → Settings → Email Accounts\n');
} catch (err) {
  console.error('Failed to create campaign:', err.message);
  process.exit(1);
}
