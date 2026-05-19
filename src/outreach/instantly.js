import axios from 'axios';

const BASE = 'https://api.instantly.ai/api/v2';
const API_KEY = process.env.INSTANTLY_API_KEY;
const CAMPAIGN_ID = process.env.INSTANTLY_CAMPAIGN_ID;
const SENDER_NAME = process.env.SENDER_NAME ?? 'Your Name';
const SENDER_EMAIL = process.env.SENDER_EMAIL ?? '';

function api(path, method = 'GET', body = null) {
  return axios({
    method,
    url: `${BASE}${path}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    data: body ?? undefined,
    validateStatus: null,
  });
}

export async function createCampaign(name) {
  const resp = await api('/campaigns', 'POST', {
    name,
    campaign_schedule: {
      schedules: [{
        name: 'Default',
        timing: { from: '08:00', to: '18:00' },
        days: { '1': true, '2': true, '3': true, '4': true, '5': true },
        timezone: 'America/New_York (UTC-05:00)',
      }],
    },
  });
  if (resp.status !== 200 && resp.status !== 201) {
    throw new Error(`Campaign create failed: ${JSON.stringify(resp.data)}`);
  }
  return resp.data;
}

export async function getCampaigns() {
  const resp = await api('/campaigns?limit=20');
  return resp.data?.items ?? resp.data?.data ?? [];
}

export async function getAnalytics() {
  if (!CAMPAIGN_ID) return null;
  const resp = await api(`/analytics/campaigns?campaignId=${CAMPAIGN_ID}`);
  return resp.data ?? null;
}

export async function addLeadToCampaign(lead) {
  if (!CAMPAIGN_ID) throw new Error('INSTANTLY_CAMPAIGN_ID not set in .env');
  if (!lead.email) return false;

  const landingPageLine = lead.landing_page_url
    ? `\n\nI already built a preview of your site: ${lead.landing_page_url}\nClick the link — took me about an hour.`
    : '';

  const subject = lead.landing_page_url
    ? `I built a preview of your website, ${lead.business_name}`
    : `${lead.business_name} — your customers can't find you online`;

  const resp = await api('/leads', 'POST', {
    campaign_id: CAMPAIGN_ID,
    email: lead.email,
    first_name: lead.business_name,
    company_name: lead.business_name,
    phone: lead.phone ?? '',
    variables: {
      city: lead.city ?? '',
      category: lead.category ?? '',
      reviews: String(lead.reviews ?? 0),
      landing_page_url: lead.landing_page_url ?? '',
      subject,
      landing_page_line: landingPageLine,
    },
  });

  if (resp.status !== 200 && resp.status !== 201) {
    console.error(`    Instantly add lead failed: ${JSON.stringify(resp.data)}`);
    return false;
  }
  return true;
}
