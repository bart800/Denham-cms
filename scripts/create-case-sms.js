const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS case_sms (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      case_id UUID NOT NULL,
      direction TEXT NOT NULL DEFAULT 'outbound',
      phone_number TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      twilio_sid TEXT,
      sent_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_case_sms_case_id ON case_sms(case_id);
  `);
  console.log("case_sms table created");
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
