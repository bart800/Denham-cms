-- Portal Notifications table
CREATE TABLE IF NOT EXISTS portal_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id),
  type text NOT NULL DEFAULT 'general',
  subject text NOT NULL,
  body text,
  sent_to text,
  sent_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Notification toggle per case
ALTER TABLE cases ADD COLUMN IF NOT EXISTS portal_notifications_enabled boolean DEFAULT true;

-- Document AI analysis columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_category text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_metadata jsonb;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_notifications_case_id ON portal_notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_portal_notifications_sent_at ON portal_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_analyzed_at ON documents(analyzed_at);
