-- 009: Add transcript columns to case_calls
ALTER TABLE case_calls ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE case_calls ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE case_calls ADD COLUMN IF NOT EXISTS ai_moments JSONB;
