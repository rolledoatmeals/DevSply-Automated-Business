import 'dotenv/config';
import { scrapeLeads } from './scraper/googlePlaces.js';
import { findEmail } from './scraper/emailFinder.js';
import { createLandingPage } from './generator/landingPage.js';
import { sendOutreach, nextFollowUpDate } from './outreach/gmail.js';
import {
  saveLead,
  updateLead,
  getLeadsNeedingPages,
  getLeadsNeedingEmails,
  getLeadsNeedingOutreach,
  getLeadsNeedingFollowUp,
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
  let leadsScraped = 0, pagesGenerated = 0, emailsSent = 0;

  try {
    // ── Step 1: Scrape ──────────────────────────────────────────
    console.log('\nSTEP 1 — Find businesses without websites');
    const leads = await scrapeLeads(city);
    leadsScraped = leads.length;

    for (const lead of leads) {
      await saveLead(lead);
    }
    console.log(`  Saved ${leads.length} new leads to Supabase.`);

    // ── Step 2: Find emails ─────────────────────────────────────
    console.log('\nSTEP 2 — Find contact emails');
    if (!process.env.GOOGLE_SEARCH_API_KEY) {
      console.log('  ⚠  Skipped — add GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX to enable');
    } else {
      // Pull ALL leads missing emails from DB (not just today's scrape)
      const needEmails = await getLeadsNeedingEmails();
      console.log(`  ${needEmails.length} leads need an email...`);
      let found = 0;
      for (const lead of needEmails) {
        const email = await findEmail(lead.business_name, lead.city, lead.phone);
        if (email) {
          await updateLead(lead.place_id, { email });
          found++;
          console.log(`  ✓ ${lead.business_name} → ${email}`);
        }
      }
      console.log(`  Found emails for ${found}/${needEmails.length} leads.`);
    }

    // ── Step 3: Generate landing pages ─────────────────────────
    console.log('\nSTEP 3 — Generate landing pages with Claude');
    const needPages = await getLeadsNeedingPages();
    if (!needPages.length) {
      console.log('  No leads need a landing page right now.');
    } else {
      console.log(`  Building pages for ${needPages.length} leads...`);
      for (const lead of needPages) {
        console.log(`\n  [${lead.business_name}]`);
        const url = await createLandingPage(lead);
        if (url) {
          await updateLead(lead.place_id, { landing_page_url: url });
          pagesGenerated++;
        }
      }
    }

    // ── Step 4: Send outreach ───────────────────────────────────
    console.log('\nSTEP 4 — Send cold emails via Gmail');
    const needOutreach = await getLeadsNeedingOutreach();
    if (!needOutreach.length) {
      console.log('  No leads ready for outreach.');
    } else {
      console.log(`  ${needOutreach.length} leads with emails queued...`);
      const results = await sendOutreach(needOutreach);
      emailsSent = results;
      // Mark sent leads in DB
      for (const lead of needOutreach.slice(0, emailsSent)) {
        if (!lead.email) continue;
        await updateLead(lead.place_id, {
          outreach_status: 'sent',
          contacted: true,
          follow_up_count: 0,
          last_contacted_at: new Date().toISOString(),
          next_follow_up_at: nextFollowUpDate(0),
        });
      }
      console.log(`\n  ✉  ${emailsSent} email${emailsSent !== 1 ? 's' : ''} sent.`);
    }

    // ── Step 5: Follow-ups ──────────────────────────────────────
    console.log('\nSTEP 5 — Send follow-ups');
    const needFollowUp = await getLeadsNeedingFollowUp();
    if (!needFollowUp.length) {
      console.log('  No follow-ups due.');
    } else {
      console.log(`  ${needFollowUp.length} follow-up(s) due...`);
      const fuSent = await sendOutreach(needFollowUp, true);
      for (const lead of needFollowUp.slice(0, fuSent)) {
        if (!lead.email) continue;
        const newCount = (lead.follow_up_count ?? 0) + 1;
        await updateLead(lead.place_id, {
          follow_up_count: newCount,
          last_contacted_at: new Date().toISOString(),
          next_follow_up_at: newCount >= 3 ? null : nextFollowUpDate(newCount),
          outreach_status: newCount >= 3 ? 'unresponsive' : 'sent',
        });
      }
      console.log(`\n  ✉  ${fuSent} follow-up${fuSent !== 1 ? 's' : ''} sent.`);
    }

    // ── Done ────────────────────────────────────────────────────
    if (runId) {
      await updatePipelineRun(runId, {
        leads_scraped: leadsScraped,
        pages_generated: pagesGenerated,
        emails_sent: emailsSent,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    }

    const prog = await cityProgress();
    console.log(`\n  City progress: ${prog.done}/${prog.total} US cities done`);

    const stats = await getStats();
    console.log('\n── Stats ──────────────────────────────────────────────');
    console.log(`  Total leads   : ${stats.total}`);
    console.log(`  With pages    : ${stats.with_page}`);
    console.log(`  Emails sent   : ${stats.emails_sent}`);
    console.log(`  Converted     : ${stats.converted}`);

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
