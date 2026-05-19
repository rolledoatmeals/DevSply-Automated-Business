-- Run this in your Supabase SQL editor to set up the database

-- ── Leads table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id              BIGSERIAL PRIMARY KEY,
    place_id        TEXT UNIQUE NOT NULL,
    business_name   TEXT NOT NULL,
    category        TEXT,
    city            TEXT,
    phone           TEXT,
    email           TEXT,
    address         TEXT,
    rating          NUMERIC(2,1),
    reviews         INTEGER DEFAULT 0,
    landing_page_url TEXT,
    contacted       BOOLEAN DEFAULT FALSE,
    converted       BOOLEAN DEFAULT FALSE,
    outreach_status TEXT DEFAULT 'pending',   -- pending | sent | replied | unsubscribed
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_city           ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_outreach_status ON leads(outreach_status);
CREATE INDEX IF NOT EXISTS idx_leads_contacted       ON leads(contacted);

-- ── City queue ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS city_queue (
    city        TEXT PRIMARY KEY,
    processed   BOOLEAN DEFAULT FALSE,
    last_run    TIMESTAMPTZ
);

-- ── Pipeline runs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id              BIGSERIAL PRIMARY KEY,
    city            TEXT,
    leads_scraped   INTEGER DEFAULT 0,
    pages_generated INTEGER DEFAULT 0,
    emails_sent     INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'running',   -- running | completed | failed
    error           TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ── Seed US cities ────────────────────────────────────────────────────────────
INSERT INTO city_queue (city) VALUES
  ('New York NY'), ('Los Angeles CA'), ('Chicago IL'), ('Houston TX'), ('Phoenix AZ'),
  ('Philadelphia PA'), ('San Antonio TX'), ('San Diego CA'), ('Dallas TX'), ('San Jose CA'),
  ('Austin TX'), ('Jacksonville FL'), ('Fort Worth TX'), ('Columbus OH'), ('Charlotte NC'),
  ('Indianapolis IN'), ('San Francisco CA'), ('Seattle WA'), ('Denver CO'), ('Nashville TN'),
  ('Oklahoma City OK'), ('El Paso TX'), ('Washington DC'), ('Boston MA'), ('Memphis TN'),
  ('Louisville KY'), ('Portland OR'), ('Las Vegas NV'), ('Milwaukee WI'), ('Albuquerque NM'),
  ('Tucson AZ'), ('Fresno CA'), ('Sacramento CA'), ('Mesa AZ'), ('Kansas City MO'),
  ('Atlanta GA'), ('Omaha NE'), ('Colorado Springs CO'), ('Raleigh NC'), ('Long Beach CA'),
  ('Virginia Beach VA'), ('Minneapolis MN'), ('Tampa FL'), ('New Orleans LA'), ('Arlington TX'),
  ('Bakersfield CA'), ('Honolulu HI'), ('Anaheim CA'), ('Aurora CO'), ('Santa Ana CA'),
  ('Corpus Christi TX'), ('Riverside CA'), ('St. Louis MO'), ('Lexington KY'), ('Pittsburgh PA'),
  ('Stockton CA'), ('Anchorage AK'), ('Cincinnati OH'), ('St. Paul MN'), ('Greensboro NC'),
  ('Toledo OH'), ('Newark NJ'), ('Plano TX'), ('Henderson NV'), ('Orlando FL'),
  ('Lincoln NE'), ('Jersey City NJ'), ('Chandler AZ'), ('St. Petersburg FL'), ('Laredo TX'),
  ('Norfolk VA'), ('Madison WI'), ('Durham NC'), ('Lubbock TX'), ('Winston-Salem NC'),
  ('Garland TX'), ('Glendale AZ'), ('Hialeah FL'), ('Reno NV'), ('Baton Rouge LA'),
  ('Irvine CA'), ('Chesapeake VA'), ('Irving TX'), ('Scottsdale AZ'), ('North Las Vegas NV'),
  ('Fremont CA'), ('Gilbert AZ'), ('San Bernardino CA'), ('Boise ID'), ('Birmingham AL'),
  ('Rochester NY'), ('Richmond VA'), ('Spokane WA'), ('Des Moines IA'), ('Montgomery AL'),
  ('Modesto CA'), ('Fayetteville NC'), ('Tacoma WA'), ('Shreveport LA'), ('Akron OH'),
  ('Aurora IL'), ('Yonkers NY'), ('Huntington Beach CA'), ('Little Rock AR'), ('Glendale CA'),
  ('Columbus GA'), ('Grand Rapids MI'), ('Amarillo TX'), ('Salt Lake City UT'), ('Huntsville AL'),
  ('Knoxville TN'), ('Worcester MA'), ('Brownsville TX'), ('Santa Clarita CA'), ('Providence RI'),
  ('Garden Grove CA'), ('Oceanside CA'), ('Chattanooga TN'), ('Fort Lauderdale FL'), ('Rancho Cucamonga CA'),
  ('Santa Rosa CA'), ('Port Arthur TX'), ('Tempe AZ'), ('Cape Coral FL'), ('Oxnard CA'),
  ('Eugene OR'), ('Peoria IL'), ('Corona CA'), ('Salem OR'), ('Lancaster CA'),
  ('Palmdale CA'), ('McKinney TX'), ('Fort Collins CO'), ('Springfield MO'), ('Hayward CA'),
  ('Frisco TX'), ('Rockford IL'), ('Pomona CA'), ('Escondido CA'), ('Sunnyvale CA'),
  ('Surprise AZ'), ('Kansas City KS'), ('Torrance CA'), ('Bridgeport CT'), ('Alexandria VA'),
  ('Paterson NJ'), ('Savannah GA'), ('Lakewood CO'), ('Salinas CA'), ('Macon GA'),
  ('Syracuse NY'), ('Pasadena TX'), ('Hollywood FL'), ('Pomona CA'), ('Mesquite TX'),
  ('Dayton OH'), ('Clarksville TN'), ('Killeen TX'), ('Orange CA'), ('Fullerton CA'),
  ('Augusta GA'), ('Murfreesboro TN'), ('Waco TX'), ('Warren MI'), ('West Valley City UT'),
  ('Hampton VA'), ('Columbia SC'), ('Sterling Heights MI'), ('Sioux Falls SD'), ('Olathe KS'),
  ('Tallahassee FL'), ('McAllen TX'), ('Concord CA'), ('Hartford CT'), ('Thousand Oaks CA'),
  ('Visalia CA'), ('Simi Valley CA'), ('Elizabeth NJ'), ('Roseville CA'), ('Carrollton TX'),
  ('Bellevue WA'), ('Gainesville FL'), ('Thornton CO'), ('Peoria AZ'), ('Columbia MO'),
  ('Coral Springs FL'), ('Cedar Rapids IA'), ('Stamford CT'), ('Denton TX'), ('Midland TX')
ON CONFLICT (city) DO NOTHING;
