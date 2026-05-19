-- Run this in your Supabase SQL editor
-- Adds the call_logs table for Telnyx AI calling

CREATE TABLE IF NOT EXISTS call_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id        TEXT REFERENCES leads(place_id) ON DELETE CASCADE,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'initiated',
  -- status values: initiated | answered | pressed_1 | pressed_2 | no_answer | no_response | opted_out
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS call_logs_place_id_idx ON call_logs(place_id);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
