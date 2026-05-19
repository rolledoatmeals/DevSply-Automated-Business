import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const client = new Anthropic();
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const MANIFEST_PATH = path.join(process.cwd(), '.vercel-manifest.json');

const COLOR_HINTS = {
  'plumber':             'professional blues and white. Trustworthy and reliable.',
  'electrician':         'bold yellows and dark gray. Safety and professionalism.',
  'HVAC contractor':     'cool blues and white. Clean and technical.',
  'roofing contractor':  'sturdy grays, blues, and reds. Reliable and strong.',
  'general contractor':  'professional navy and orange accents. Skilled and dependable.',
  'landscaping company': 'earth greens and warm browns. Natural and fresh.',
  'pest control':        'earthy greens and cream. Outdoorsy and dependable.',
  'auto repair shop':    'dark grays and red accents. Industrial but clean.',
  'locksmith':           'dark charcoal and gold. Secure and professional.',
  'painting contractor': 'vibrant colors with clean white. Creative and precise.',
  'cleaning service':    'fresh light blues and white. Spotless and professional.',
  'handyman':            'warm oranges and dark grays. Friendly and skilled.',
  'moving company':      'bold blues and orange. Energetic and trustworthy.',
  'garage door repair':  'charcoal and orange accents. Industrial and reliable.',
  'fence contractor':    'natural wood browns and forest green. Sturdy and natural.',
};

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45);
}

function loadManifest() {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  }
  return { projectId: null, files: {} };
}

function saveManifest(m) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
}

export async function generateHTML(lead) {
  const colorHint = COLOR_HINTS[lead.category] ?? 'professional blues and white.';
  const phone = lead.phone ?? 'Call for a free quote';
  const ratingText = lead.rating
    ? `${lead.rating}★ on Google (${lead.reviews} reviews)`
    : `${lead.reviews} Google reviews`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: [{
      type: 'text',
      text: (
        'You are an expert web designer specializing in local business websites. ' +
        'Generate complete, self-contained HTML/CSS. No external dependencies, no CDN links, ' +
        'no Google Fonts URLs — everything must be inline or use system fonts. ' +
        'Make websites look genuinely professional, not like templates.'
      ),
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: `Build a complete, beautiful one-page website for this local business.

Business: ${lead.business_name}
Category: ${lead.category}
Location: ${lead.address ?? lead.city}
Phone: ${phone}
Social proof: ${ratingText}

Design brief:
- Color scheme: ${colorHint}
- Sections: Hero → Services (3) → Why Choose Us (3 points) → Contact
- Slim banner at very top: "✦ Website Preview — Built for ${lead.business_name} ✦"
- Mobile-responsive, system fonts only (Arial, Georgia), no external URLs
- Keep CSS minimal — prioritize completing the full HTML over elaborate styling
- All content visible immediately — no opacity:0 or hidden animations
- Professional and clean

Return ONLY the complete HTML document starting with <!DOCTYPE html>. No explanation, no markdown fences.`,
    }],
  });

  let html = message.content[0].text.trim();
  html = html.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '');
  return html;
}

async function ensureProject() {
  const headers = { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
  const manifest = loadManifest();
  if (manifest.projectId) return manifest;

  const resp = await axios.post(
    'https://api.vercel.com/v9/projects',
    { name: 'devsply-previews', framework: null },
    { headers, validateStatus: null }
  );

  manifest.projectId = resp.data.id ?? resp.data.project?.id;
  saveManifest(manifest);
  return manifest;
}

async function deployPage(html, slug) {
  const headers = { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
  const manifest = await ensureProject();

  // Add new file to manifest
  manifest.files[`${slug}.html`] = html;
  saveManifest(manifest);

  // Build file list for deployment (all pages ever generated)
  const files = Object.entries(manifest.files).map(([file, data]) => ({ file, data }));

  const resp = await axios.post(
    'https://api.vercel.com/v13/deployments',
    {
      name: 'devsply-previews',
      files,
      projectSettings: { framework: null },
      target: 'production',
    },
    { headers, validateStatus: null }
  );

  if (resp.status !== 200 && resp.status !== 201) {
    throw new Error(`Vercel deploy failed: ${JSON.stringify(resp.data)}`);
  }

  return `https://pages.devsply.com/${slug}.html`;
}

export async function createLandingPage(lead) {
  try {
    console.log(`    Generating HTML for ${lead.business_name}...`);
    const html = await generateHTML(lead);

    if (VERCEL_TOKEN) {
      console.log('    Deploying to Vercel...');
      const slug = slugify(lead.business_name);
      const url = await deployPage(html, slug);
      if (url) {
        console.log(`    ✓ Live at: ${url}`);
        return url;
      }
    }

    // Fallback: save locally
    const dir = path.join(process.cwd(), 'landing-pages');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${slugify(lead.business_name)}.html`);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`    Saved locally: ${filePath}`);
    return null;

  } catch (err) {
    console.error(`    Landing page failed for ${lead.business_name}:`, err.message);
    return null;
  }
}
