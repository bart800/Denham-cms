const { createClient } = require('@supabase/supabase-js');
const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA';
const s = createClient('https://amyttoowrroajffqubpd.supabase.co', SK);

async function run() {
  // Add depends_on_tasks column using raw SQL via management API
  const resp = await fetch('https://amyttoowrroajffqubpd.supabase.co/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: {
      'apikey': SK,
      'Authorization': `Bearer ${SK}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: "ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS depends_on_tasks text[] DEFAULT '{}'" })
  });
  console.log('exec_sql attempt:', resp.status, await resp.text());

  // If exec_sql doesn't exist, try creating it first
  if (resp.status === 404) {
    console.log('exec_sql RPC not found. Creating it...');
    // We can't create functions via REST either. Let's try a different approach.
    // Use the Supabase Management API
    const mgmtResp = await fetch('https://api.supabase.com/v1/projects/amyttoowrroajffqubpd/database/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || ''}`
      },
      body: JSON.stringify({ query: "ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS depends_on_tasks text[] DEFAULT '{}'" })
    });
    console.log('mgmt API:', mgmtResp.status, await mgmtResp.text());
  }

  // Seed dependencies on workflow_templates
  const deps = [
    // Property: "Complaint filed" depends on "Complaint reviewed & approved"
    { id: '98027326-14b6-477a-a3c6-be3db205d497', depends_on: ['75188d79-0f42-4853-88e1-f7015aa96f65'] },
    // Property: "Complaint reviewed" depends on "Complaint drafted"
    { id: '75188d79-0f42-4853-88e1-f7015aa96f65', depends_on: ['92f01706-42e7-44a5-927e-50b656cef290'] },
    // Property: "Service confirmed" depends on "Complaint filed"
    { id: 'ea045151-25d2-46e9-b544-7b3c3e579375', depends_on: ['98027326-14b6-477a-a3c6-be3db205d497'] },
    // Property: "Demand served" depends on "Demand reviewed & approved"
    { id: '92b38e99-ff60-436a-8aa3-8c375c6601f6', depends_on: ['2edba235-4c1d-4c62-bdf2-b8f5240022ea'] },
    // Property: "Demand reviewed" depends on "Demand letter drafted"
    { id: '2edba235-4c1d-4c62-bdf2-b8f5240022ea', depends_on: ['bf64a011-d46d-442e-ab94-b15d28d8c2ae'] },
    // Property: "Distribution statement sent" depends on "Costs verified & distribution prepared"
    { id: 'd854a1ee-2656-4752-a6cd-daf5e9505844', depends_on: ['0ba1b336-0b2e-4be1-b978-381189a538e7'] },
    // PI: "Demand served" depends on "Demand reviewed"
    { id: 'e2c178b4-8da7-4140-9d33-2a4ed987160c', depends_on: ['f3d41790-30d8-4cbd-ac8c-74f1a3756a4c'] },
    // PI: "Demand reviewed" depends on "Demand prepared"
    { id: 'f3d41790-30d8-4cbd-ac8c-74f1a3756a4c', depends_on: ['1506a305-b8cc-4c87-96e7-60f7be0c2d2c'] },
    // PI: "Checks written" depends on "Disbursement authorization prepared"
    { id: '9ec32525-1e09-4448-8764-e62261204414', depends_on: ['5fe56799-ae8d-4dfc-bd4b-f6da6e6ca0b5'] },
    // PI: "Client signs release & disbursement" depends on "Disbursement authorization prepared"
    { id: 'bc8b33f1-db53-4d5c-8a82-a627e29567ff', depends_on: ['5fe56799-ae8d-4dfc-bd4b-f6da6e6ca0b5'] },
  ];

  for (const d of deps) {
    const { error } = await s.from('workflow_templates').update({ depends_on: d.depends_on }).eq('id', d.id);
    if (error) console.log('Error updating', d.id, error.message);
    else console.log('Updated deps for', d.id);
  }

  // Test if column exists now
  const { data, error } = await s.from('case_tasks').select('id, depends_on_tasks').limit(1);
  console.log('case_tasks depends_on_tasks test:', data ? 'EXISTS' : error?.message);
}
run();
