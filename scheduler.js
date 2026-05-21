import 'dotenv/config';
import { runCity } from './src/pipeline.js';
import { nextCity, markCityDone } from './src/db/supabase.js';

// Minutes to wait between city runs — tune this to control API usage
const INTERVAL_MINUTES = parseInt(process.env.PIPELINE_INTERVAL_MINUTES ?? '60', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log('\n══════════════════════════════════════════');
console.log('  DevSply Scheduler — Running');
console.log(`  Interval: every ${INTERVAL_MINUTES} min between cities`);
console.log('  Press Ctrl+C to stop.\n');

async function runNext() {
  const city = await nextCity();
  if (!city) {
    console.log('\n✅  All cities processed. Reset city_queue in Supabase to restart.');
    return false;
  }
  console.log(`\n🗺️   [${new Date().toLocaleTimeString()}] Starting pipeline for: ${city}`);
  try {
    await runCity(city);
    await markCityDone(city);
    console.log(`\n✓ ${city} complete.`);
  } catch (err) {
    console.error(`\n✗ Pipeline failed for ${city}:`, err.message);
  }
  return true;
}

async function loop() {
  while (true) {
    const hasMore = await runNext();
    if (!hasMore) break;
    console.log(`\n⏳  Waiting ${INTERVAL_MINUTES} min before next city…`);
    await sleep(INTERVAL_MINUTES * 60 * 1000);
  }
}

loop();
