import fs from 'fs';
import path from 'path';
import { twitter } from './client.js';
import { generateBeforeAfterCaption } from './content.js';

const PENDING_DIR = './posts/pending';
const DONE_DIR    = './posts/done';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export function findNextPair() {
  if (!fs.existsSync(PENDING_DIR)) return null;

  const files = fs.readdirSync(PENDING_DIR);
  const beforeFiles = files.filter(f => f.toLowerCase().includes('-before.'));

  for (const beforeFile of beforeFiles) {
    const ext = path.extname(beforeFile);
    if (!IMAGE_EXTS.includes(ext.toLowerCase())) continue;

    const base = beforeFile.replace(/-before\.[^.]+$/i, '');
    const afterFile = files.find(f =>
      f.toLowerCase() === `${base.toLowerCase()}-after${ext.toLowerCase()}`
    );

    if (afterFile) {
      return {
        base,
        beforePath: path.join(PENDING_DIR, beforeFile),
        afterPath:  path.join(PENDING_DIR, afterFile),
        beforeFile,
        afterFile,
      };
    }
  }

  return null;
}

// Parses "tampa-plumbing-co" → { businessName: "Tampa Plumbing Co", city: "Tampa" }
function parseFilename(base) {
  const words = base.replace(/-/g, ' ').replace(/_/g, ' ').split(' ');
  const businessName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const CITIES = ['tampa', 'clearwater', 'brandon', 'riverview', 'stpete', 'st pete',
    'lakeland', 'wesley chapel', 'palm harbor', 'bradenton', 'sarasota', 'largo',
    'lutz', 'plant city', 'land o lakes', 'valrico', 'dunedin', 'tarpon springs'];

  const lower = base.toLowerCase();
  const city = CITIES.find(c => lower.includes(c.replace(' ', ''))) ?? 'Tampa';

  return { businessName, city };
}

export async function postBeforeAfter(pair) {
  const { base, beforePath, afterPath, beforeFile, afterFile } = pair;
  const { businessName, city } = parseFilename(base);

  console.log(`  Uploading images for: ${businessName}`);

  const [beforeId, afterId] = await Promise.all([
    twitter.v1.uploadMedia(beforePath),
    twitter.v1.uploadMedia(afterPath),
  ]);

  const caption = await generateBeforeAfterCaption(businessName, city, null, 0);
  console.log(`  Caption: ${caption}`);

  const tweet = await twitter.v2.tweet({
    text: caption,
    media: { media_ids: [beforeId, afterId] },
  });

  // Move files to done/
  if (!fs.existsSync(DONE_DIR)) fs.mkdirSync(DONE_DIR, { recursive: true });
  fs.renameSync(beforePath, path.join(DONE_DIR, beforeFile));
  fs.renameSync(afterPath,  path.join(DONE_DIR, afterFile));

  return tweet.data;
}
