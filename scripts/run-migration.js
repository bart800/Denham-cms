const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SQL = `ALTER TABLE cases ADD COLUMN IF NOT EXISTS property_address TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS cause_of_loss TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adjuster_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adjuster_phone TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adjuster_email TEXT;`;

(async () => {
  // Try the pg-meta endpoint
  const res = await fetch(`${URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': KEY,
      'Authorization': 'Bearer ' + KEY,
      'x-connection-encrypted': 'true',
    },
    body: JSON.stringify({ query: SQL }),
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.substring(0, 500));
})().catch(console.error);
