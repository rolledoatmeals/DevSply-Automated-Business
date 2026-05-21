import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const WIDTH  = 1200;
const HEIGHT = 675;
const TEMP_DIR = './posts/temp';

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Strip hashtags — they stay in the tweet text but clutter the card
function cleanText(text) {
  return text.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fontConfig(len) {
  if (len < 80)  return { size: 54, perLine: 34 };
  if (len < 140) return { size: 46, perLine: 40 };
  if (len < 200) return { size: 38, perLine: 48 };
  return { size: 32, perLine: 56 };
}

export async function generateCard(headline, subtitle) {
  // Determine font size based on headline length
  const hlSize = headline.length <= 6 ? 160 : headline.length <= 20 ? 100 : 72;
  const hlY = subtitle ? HEIGHT / 2 - 20 : HEIGHT / 2 + hlSize / 3;

  const subtitleEl = subtitle ? `<text
    x="${WIDTH / 2}" y="${hlY + 60}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="34"
    fill="#94a3b8"
    text-anchor="middle">${escapeXml(subtitle)}</text>` : '';

  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1929"/>
      <stop offset="100%" stop-color="#162947"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <rect x="0" y="0" width="7" height="${HEIGHT}" fill="#2563eb"/>

  <text
    x="${WIDTH / 2}" y="${hlY}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${hlSize}"
    font-weight="bold"
    fill="#ffffff"
    text-anchor="middle">${escapeXml(headline)}</text>

  ${subtitleEl}

  <text
    x="80" y="${HEIGHT - 38}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="24"
    font-weight="bold"
    fill="#2563eb">DevSply</text>

  <text
    x="${WIDTH - 80}" y="${HEIGHT - 38}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="18"
    fill="#4b5563"
    text-anchor="end">Tampa Bay Web Design + AI Agents · devsply.com</text>
</svg>`;

  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const filepath = path.join(TEMP_DIR, `card-${crypto.randomBytes(6).toString('hex')}.png`);
  await sharp(Buffer.from(svg)).png().toFile(filepath);
  return filepath;
}

export function cleanupCard(filepath) {
  try { fs.unlinkSync(filepath); } catch {}
}
