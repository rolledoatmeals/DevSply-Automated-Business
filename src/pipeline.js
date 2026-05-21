import 'dotenv/config';
import { scrapeLeads } from './scraper/googlePlaces.js';
import { placeCallOutreach } from './outreach/call.js';
import {
  saveLead,
  updateLead,
  getLeadsNeedingPhoneOutreach,
  nextCity,
  markCityDone,
  cityProgress,
  createPipelineRun,
  updatePipelineRun,
  getStats,
} from './db/supabase.js';

function line(title) {
  const w = 58;
  console.log(`\n${'═'.repeat(w)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(w));
}

function checkEnv() {
  const required = {
    GOOGLE_PLACES_API_KEY: 'console.cloud.google.com → Enable Places API',
    ANTHROPIC_API_KEY:     'console.anthropic.com → API Keys',
    SUPABASE_URL:          'app.supabase.com → Project Settings → API',
    SUPABASE_SERVICE_KEY:  'app.supabase.com → Project Settings → API (service_role key)',
    SENDER_EMAIL:          'Your Gmail address',
    GMAIL_APP_PASSWORD:    'myaccount.google.com → Security → App Passwords',
  };
  const missing = Object.entries(required).filter(([k]) => !process.env[k]);
  if (missing.length) {
    console.error('\n❌  Missing required env vars — add them to .env:\n');
    missing.forEach(([k, hint]) => console.error(`   ${k}\n   └─ ${hint}\n`));
    process.exit(1);
  }

  const optional = [];
  if (!process.env.NETLIFY_TOKEN)
    optional.push('NETLIFY_TOKEN — landing pages will save locally, not hosted online');
  if (optional.length) {
    console.log('⚠️   Optional features disabled:');
    optional.forEach(o => console.log(`   ${o}`));
    console.log();
  }
}

export async function runCity(city) {
  const ts = new Date().toLocaleString();
  line(`Pipeline — ${city}  |  ${ts}`);

  const run = await createPipelineRun(city);
  const runId = run?.id;
  let leadsScraped = 0, callsPlaced = 0;

  try {
    // ── Step 1: Scrape ──────────────────────────────────────────
    console.log('\nSTEP 1 — Find businesses without websites');
    const leads = await scrapeLeads(city);
    leadsScraped = leads.length;
    for (const lead of leads) await saveLead(lead);
    console.log(`  Saved ${leads.length} new leads to Supabase.`);

    // ── Step 2: Call leads ──────────────────────────────────────
    console.log('\nSTEP 2 — AI calls to businesses with phone numbers');
    const needPhone = await getLeadsNeedingPhoneOutreach();
    if (!needPhone.length) {
      console.log('  No leads to call right now.');
    } else {
      console.log(`  ${needPhone.length} leads queued for calls...`);
      callsPlaced = await placeCallOutreach(needPhone);
      for (const lead of needPhone.slice(0, callsPlaced)) {
        await updateLead(lead.place_id, {
          outreach_status: 'sent',
          contacted: true,
          follow_up_count: 0,
          last_contacted_at: new Date().toISOString(),
        });
      }
      if (callsPlaced > 0) console.log(`\n  📞 ${callsPlaced} call${callsPlaced !== 1 ? 's' : ''} placed.`);
    }

    // ── Done ────────────────────────────────────────────────────
    if (runId) {
      await updatePipelineRun(runId, {
        leads_scraped: leadsScraped,
        emails_sent: callsPlaced,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    }

    const prog = await cityProgress();
    console.log(`\n  City progress: ${prog.done}/${prog.total} cities done`);

    const stats = await getStats();
    console.log('\n── Stats ──────────────────────────────────────────────');
    console.log(`  Total leads : ${stats.total}`);
    console.log(`  Contacted   : ${stats.emails_sent}`);
    console.log(`  Converted   : ${stats.converted}`);

  } catch (err) {
    console.error('\n  Pipeline error:', err.message);
    if (runId) {
      await updatePipelineRun(runId, {
        status: 'failed',
        error: err.message,
        completed_at: new Date().toISOString(),
      });
    }
    throw err;
  }
}

// ── CLI entry point ────────────────────────────────────────────────────────────
if (process.argv[1].endsWith('pipeline.js')) {
  checkEnv();

  const cityArg = process.argv[2];

  if (cityArg) {
    await runCity(cityArg);
  } else {
    // Auto-pick next city from queue
    const city = await nextCity();
    if (!city) {
      console.log('✅  All cities processed! Reset city_queue to start over.');
      process.exit(0);
    }
    console.log(`🗺️   Auto-selected: ${city}`);
    await runCity(city);
    await markCityDone(city);
  }
}
