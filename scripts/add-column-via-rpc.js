// Create exec_sql function and add the column
const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA';

async function run() {
  // Use the Supabase pg-meta API to run SQL
  const baseUrl = 'https://amyttoowrroajffqubpd.supabase.co';
  
  // Try the pg-meta query endpoint (used by Supabase Studio)
  const resp = await fetch(`${baseUrl}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': SK,
      'Authorization': `Bearer ${SK}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: "ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS depends_on_tasks text[] DEFAULT '{}'" })
  });
  console.log('pg/query:', resp.status);
  if (resp.ok) {
    console.log(await resp.json());
  } else {
    console.log(await resp.text());
    
    // Try alternate path
    const resp2 = await fetch(`${baseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': SK,
        'Authorization': `Bearer ${SK}`,
        'Content-Type': 'application/json',
        'X-Supabase-Api-Key': SK
      },
      body: JSON.stringify({})
    });
    console.log('rpc root:', resp2.status, await resp2.text());
  }
}
run();
