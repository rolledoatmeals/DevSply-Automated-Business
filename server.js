import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStats, getRecentLeads, getPipelineRuns, cityProgress } from './src/db/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard')));

// ── API ───────────────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    const [stats, progress] = await Promise.all([getStats(), cityProgress()]);
    res.json({ ...stats, cities_done: progress.done, cities_total: progress.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leads', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);
    const leads = await getRecentLeads(limit);
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/runs', async (req, res) => {
  try {
    const runs = await getPipelineRuns(20);
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve dashboard for all other routes ──────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  DevSply dashboard → http://localhost:${PORT}\n`);
});
