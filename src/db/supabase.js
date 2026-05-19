import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default supabase;

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function saveLead(lead) {
  const { error } = await supabase
    .from('leads')
    .upsert(lead, { onConflict: 'place_id', ignoreDuplicates: true });
  if (error) console.error('saveLead error:', error.message);
}

export async function updateLead(placeId, fields) {
  const { error } = await supabase
    .from('leads')
    .update(fields)
    .eq('place_id', placeId);
  if (error) console.error('updateLead error:', error.message);
}

export async function getLeadsNeedingEmails() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .is('email', null)
    .eq('outreach_status', 'pending');
  if (error) console.error('getLeadsNeedingEmails error:', error.message);
  return data ?? [];
}

export async function getLeadsNeedingPages() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .or('landing_page_url.is.null,landing_page_url.eq.')
    .eq('outreach_status', 'pending')
    .order('reviews', { ascending: false });
  if (error) console.error('getLeadsNeedingPages error:', error.message);
  return data ?? [];
}

export async function getLeadsNeedingFollowUp() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('outreach_status', 'sent')
    .not('email', 'is', null)
    .lt('follow_up_count', 3)
    .lte('next_follow_up_at', new Date().toISOString());
  if (error) console.error('getLeadsNeedingFollowUp error:', error.message);
  return data ?? [];
}

export async function getLeadsNeedingOutreach() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .not('email', 'is', null)
    .eq('outreach_status', 'pending')
    .order('reviews', { ascending: false });
  if (error) console.error('getLeadsNeedingOutreach error:', error.message);
  return data ?? [];
}

export async function getStats() {
  const { data, error } = await supabase.rpc('get_lead_stats');
  if (error) {
    // Fallback: manual count queries
    const [total, contacted, converted] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('contacted', true),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('converted', true),
    ]);
    const withPage = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('landing_page_url', 'is', null);
    const emailSent = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('outreach_status', ['sent', 'replied', 'unresponsive']);
    const replied = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('outreach_status', 'replied');

    return {
      total: total.count ?? 0,
      with_page: withPage.count ?? 0,
      contacted: contacted.count ?? 0,
      converted: converted.count ?? 0,
      emails_sent: emailSent.count ?? 0,
      replied: replied.count ?? 0,
    };
  }
  return data;
}

export async function getRecentLeads(limit = 50) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('getRecentLeads error:', error.message);
  return data ?? [];
}

// ── City queue ────────────────────────────────────────────────────────────────

export async function nextCity() {
  const { data, error } = await supabase
    .from('city_queue')
    .select('city')
    .eq('processed', false)
    .order('city')
    .limit(1);
  if (error) console.error('nextCity error:', error.message);
  return data?.[0]?.city ?? null;
}

export async function markCityDone(city) {
  const { error } = await supabase
    .from('city_queue')
    .update({ processed: true, last_run: new Date().toISOString() })
    .eq('city', city);
  if (error) console.error('markCityDone error:', error.message);
}

export async function cityProgress() {
  const [total, done] = await Promise.all([
    supabase.from('city_queue').select('city', { count: 'exact', head: true }),
    supabase.from('city_queue').select('city', { count: 'exact', head: true }).eq('processed', true),
  ]);
  return { total: total.count ?? 0, done: done.count ?? 0 };
}

// ── Pipeline runs ─────────────────────────────────────────────────────────────

export async function createPipelineRun(city) {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({ city, status: 'running' })
    .select()
    .single();
  if (error) console.error('createPipelineRun error:', error.message);
  return data;
}

export async function updatePipelineRun(id, fields) {
  const { error } = await supabase
    .from('pipeline_runs')
    .update(fields)
    .eq('id', id);
  if (error) console.error('updatePipelineRun error:', error.message);
}

export async function getPipelineRuns(limit = 20) {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) console.error('getPipelineRuns error:', error.message);
  return data ?? [];
}
