import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const WIDTH  = 1200;
const HEIGHT = 675;
const PAD    = 96;
const TEMP_DIR = './posts/temp';

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Hashtags stay in the tweet text but clutter the card — strip them.
function cleanText(text) {
  return String(text ?? '').replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxChars) current = test;
    else { if (current) lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateCard(headline, subtitle) {
  headline = cleanText(headline);
  subtitle = cleanText(subtitle);

  const FONT = "'Liberation Sans','Arial',sans-serif";
  const availW = WIDTH - PAD * 2;

  // Headline: size scales down as it gets longer, then wraps.
  const hLen  = headline.length;
  const hSize = hLen <= 22 ? 88 : hLen <= 42 ? 74 : hLen <= 66 ? 62 : 54;
  const hLines  = wrapText(headline, Math.floor(availW / (hSize * 0.55)));
  const hLineH  = Math.round(hSize * 1.15);

  const sSize  = 31;
  const sLines = subtitle ? wrapText(subtitle, Math.floor(availW / (sSize * 0.52))) : [];
  const sLineH = Math.round(sSize * 1.4);
  const subGap = 42;

  // Vertically center the headline + subtitle block in the middle region.
  const blockH    = hLines.length * hLineH + (sLines.length ? subGap + sLines.length * sLineH : 0);
  const regionTop = 196, regionBot = 548;
  const top = regionTop + Math.max(0, (regionBot - regionTop - blockH) / 2);

  const hFirst = top + hSize;
  const headlineSvg = hLines.map((ln, i) =>
    `<text x="${PAD}" y="${hFirst + i * hLineH}" font-family="${FONT}" font-size="${hSize}" font-weight="700" letter-spacing="-1.2" fill="#ffffff">${escapeXml(ln)}</text>`
  ).join('\n  ');

  let subtitleSvg = '';
  if (sLines.length) {
    const sFirst = top + hLines.length * hLineH + subGap + sSize;
    subtitleSvg = sLines.map((ln, i) =>
      `<text x="${PAD}" y="${sFirst + i * sLineH}" font-family="${FONT}" font-size="${sSize}" font-weight="400" fill="#9fb4ca">${escapeXml(ln)}</text>`
    ).join('\n  ');
  }

  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1628"/>
      <stop offset="100%" stop-color="#11233f"/>
    </linearGradient>
    <radialGradient id="glow" cx="84%" cy="12%" r="60%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.17"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <rect x="0" y="0" width="10" height="${HEIGHT}" fill="#f59e0b"/>

  <!-- eyebrow -->
  <text x="${PAD}" y="128" font-family="${FONT}" font-size="23" font-weight="700" letter-spacing="3">
    <tspan fill="#f59e0b">DEVSPLY</tspan><tspan fill="#5e7591">&#160;&#160;&#183;&#160;&#160;WEB DESIGN + AI AGENTS</tspan>
  </text>

  ${headlineSvg}
  ${subtitleSvg}

  <!-- footer -->
  <rect x="${PAD}" y="588" width="46" height="4" rx="2" fill="#f59e0b"/>
  <text x="${PAD}" y="634" font-family="${FONT}" font-size="27" font-weight="700" fill="#ffffff">devsply.com</text>
  <text x="${WIDTH - PAD}" y="634" font-family="${FONT}" font-size="21" font-weight="400" fill="#7d93ab" text-anchor="end">Tampa Bay, FL</text>
</svg>`;

  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const filepath = path.join(TEMP_DIR, `card-${crypto.randomBytes(6).toString('hex')}.png`);
  await sharp(Buffer.from(svg)).png().toFile(filepath);
  return filepath;
}

export function cleanupCard(filepath) {
  try { fs.unlinkSync(filepath); } catch {}
}
