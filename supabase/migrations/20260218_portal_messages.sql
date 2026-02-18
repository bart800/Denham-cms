CREATE TABLE IF NOT EXISTS portal_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id) NOT NULL,
  sender_type text CHECK (sender_type IN ('client', 'firm')) NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_messages_case ON portal_messages(case_id, created_at);
