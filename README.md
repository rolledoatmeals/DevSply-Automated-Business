# DevSply — Automated Lead Generation & Outreach

Finds local businesses (plumbers, electricians, contractors, etc.) with no website, generates a custom landing page for each one using Claude AI, and sends cold emails via Instantly — fully automated on a daily schedule.

## How it works

1. **Scrape** — Google Places API finds businesses without websites in a US city
2. **Store** — All leads saved to Supabase (PostgreSQL)
3. **Generate** — Claude builds a custom HTML landing page per business, deployed live to Netlify
4. **Outreach** — Lead added to your Instantly campaign with a personalized email: "I already built your website — click to see it"
5. **Dashboard** — Live stats at `localhost:3000`

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/rolledoatmeals/DevSply-Automated-Business.git
cd DevSply-Automated-Business
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Key | Where to get it |
|-----|----------------|
| `GOOGLE_PLACES_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com) → Enable "Places API" → Credentials |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `SUPABASE_URL` | [app.supabase.com](https://app.supabase.com) → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Same page — use the **service_role** key (not anon) |
| `INSTANTLY_API_KEY` | [app.instantly.ai](https://app.instantly.ai) → Settings → API |
| `NETLIFY_TOKEN` | [app.netlify.com](https://app.netlify.com) → User Settings → Personal access tokens _(optional)_ |

### 3. Set up Supabase database

Open your Supabase project → SQL Editor → paste the contents of `schema.sql` and run it.
This creates the `leads`, `city_queue`, and `pipeline_runs` tables and seeds 180+ US cities.

### 4. Create your Instantly campaign

```bash
npm run setup-campaign
```

Copy the printed `campaign_id` into your `.env` as `INSTANTLY_CAMPAIGN_ID`.
Then go to [app.instantly.ai](https://app.instantly.ai) → your campaign → connect a sending email account.

---

## Running

### Run the pipeline once (one city)

```bash
node src/pipeline.js "Miami FL"
```

### Auto-pick the next city from the queue

```bash
node src/pipeline.js
```

### Start the dashboard

```bash
npm start
# Open http://localhost:3000
```

### Start the automated daily scheduler

```bash
node scheduler.js
```

Runs the pipeline at **9 AM Monday–Friday** and immediately on first launch.

---

## Project structure

```
DevSply-Automated-Business/
├── src/
│   ├── db/
│   │   └── supabase.js          # All database queries
│   ├── scraper/
│   │   └── googlePlaces.js      # Google Maps lead scraping
│   ├── generator/
│   │   └── landingPage.js       # Claude AI HTML + Netlify deploy
│   ├── outreach/
│   │   ├── instantly.js         # Instantly API integration
│   │   └── setup.js             # One-time campaign setup script
│   └── pipeline.js              # Main orchestrator
├── dashboard/
│   ├── index.html               # Dashboard UI
│   ├── style.css
│   └── app.js
├── landing-pages/               # Local fallback if no Netlify token
├── server.js                    # Express server + API
├── scheduler.js                 # node-cron daily automation
├── schema.sql                   # Supabase table definitions
├── .env.example                 # Environment variable template
└── package.json
```

---

## Categories targeted

Plumber · Electrician · HVAC · Roofing · General contractor · Landscaping · Pest control · Auto repair · Locksmith · Painting · Cleaning · Handyman · Moving · Garage door · Fence contractor

---

## Tips

- **Start with one city manually** before enabling the scheduler to verify your API keys work
- **Instantly warmup** — make sure your sending email has been warming up for at least 2 weeks before blasting
- **Landing pages** dramatically increase reply rates — always set up `NETLIFY_TOKEN`
- Keep `MAX_LEADS_PER_CITY` at 60 or less to stay within Google Places API free tier limits
