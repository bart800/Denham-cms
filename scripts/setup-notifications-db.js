const { Client } = require('pg');
const c = new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');

(async () => {
  await c.connect();
  
  await c.query(`
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
  `);
  console.log('portal_notifications table created');

  await c.query('ALTER TABLE cases ADD COLUMN IF NOT EXISTS portal_notifications_enabled boolean DEFAULT true');
  console.log('toggle column added to cases');

  await c.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text text');
  await c.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_category text');
  await c.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_metadata jsonb');
  await c.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS analyzed_at timestamptz');
  console.log('AI columns added to documents');

  await c.query('CREATE INDEX IF NOT EXISTS idx_portal_notifications_case_id ON portal_notifications(case_id)');
  await c.query('CREATE INDEX IF NOT EXISTS idx_portal_notifications_sent_at ON portal_notifications(sent_at DESC)');
  await c.query('CREATE INDEX IF NOT EXISTS idx_documents_analyzed_at ON documents(analyzed_at)');
  console.log('indexes created');

  await c.end();
  console.log('Done!');
})().catch(e => { console.error(e.message); process.exit(1); });
