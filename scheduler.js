import 'dotenv/config';
import cron from 'node-cron';
import { runCity } from './src/pipeline.js';
import { nextCity, markCityDone } from './src/db/supabase.js';

console.log('\n══════════════════════════════════════════');
console.log('  DevSply Scheduler — Running');
console.log('══════════════════════════════════════════');
console.log('  Schedule: 9 AM every day (Mon–Fri)');
console.log('  Press Ctrl+C to stop.\n');

async function runNext() {
  const city = await nextCity();
  if (!city) {
    console.log('✅  All cities processed. Reset city_queue in Supabase to restart.');
    return;
  }
  console.log(`\n🗺️   Starting pipeline for: ${city}`);
  try {
    await runCity(city);
    await markCityDone(city);
    console.log(`\n✓ ${city} complete.`);
  } catch (err) {
    console.error(`\n✗ Pipeline failed for ${city}:`, err.message);
  }
}

// Schedule daily at 9:00 AM Monday–Friday (UTC)
// Does NOT run on startup — Railway restarts would otherwise trigger the pipeline
cron.schedule('0 9 * * 1-5', async () => {
  console.log(`\n[${new Date().toLocaleString()}] Scheduled trigger fired.`);
  await runNext();
});

console.log('  Waiting for next scheduled run (9 AM Mon–Fri UTC).\n');
