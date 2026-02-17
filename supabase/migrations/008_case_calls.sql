-- Migration: case_calls table for Dialpad call logging
-- Links phone calls to cases by matching phone numbers

CREATE TABLE IF NOT EXISTS case_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  direction TEXT,
  category TEXT,
  external_number TEXT,
  internal_number TEXT,
  date_started TIMESTAMPTZ,
  date_connected TIMESTAMPTZ,
  date_ended TIMESTAMPTZ,
  duration_seconds INT,
  talk_duration_seconds INT,
  caller_name TEXT,
  caller_email TEXT,
  was_recorded BOOLEAN DEFAULT false,
  voicemail BOOLEAN DEFAULT false,
  target_type TEXT,
  target_name TEXT,
  ai_talk_pct NUMERIC,
  ai_listen_pct NUMERIC,
  ai_silent_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index on call_id to prevent duplicates
CREATE UNIQUE INDEX idx_case_calls_call_id ON case_calls(call_id);

-- Index on case_id for fast lookups
CREATE INDEX idx_case_calls_case_id ON case_calls(case_id);

-- Enable RLS
ALTER TABLE case_calls ENABLE ROW LEVEL SECURITY;

-- Authenticated users can do everything
CREATE POLICY "case_calls_authenticated_select" ON case_calls
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "case_calls_authenticated_insert" ON case_calls
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "case_calls_authenticated_update" ON case_calls
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "case_calls_authenticated_delete" ON case_calls
  FOR DELETE TO authenticated USING (true);

-- Anon can read only
CREATE POLICY "case_calls_anon_select" ON case_calls
  FOR SELECT TO anon USING (true);
