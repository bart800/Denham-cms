CREATE TABLE IF NOT EXISTS portal_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid REFERENCES cases(id),
  client_name text NOT NULL,
  code text,
  code_expires_at timestamptz,
  token text UNIQUE,
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
