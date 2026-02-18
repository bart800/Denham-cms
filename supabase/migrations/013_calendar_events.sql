CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  outlook_id TEXT UNIQUE,
  subject TEXT NOT NULL,
  body_preview TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_all_day BOOLEAN DEFAULT false,
  event_type TEXT, -- deadline, hearing, deposition, meeting, sol, other
  matched_by TEXT, -- how we linked to a case
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_case ON calendar_events(case_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_outlook ON calendar_events(outlook_id);
CREATE TRIGGER calendar_events_updated BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON calendar_events FOR ALL USING (true);
CREATE POLICY "Allow read for anon" ON calendar_events FOR SELECT USING (true);
