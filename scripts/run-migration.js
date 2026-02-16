// Run a SQL migration against Supabase using the Management API
const https = require('https');
const fs = require('fs');
const path = require('path');

const ACCESS_TOKEN = process.argv[2];
const PROJECT_REF = 'amyttoowrroajffqubpd';
const sqlFile = process.argv[3] || path.join(__dirname, '..', 'supabase', 'migrations', '003_documents.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

console.log(`Running migration: ${path.basename(sqlFile)} (${sql.length} chars)`);

const body = JSON.stringify({ query: sql });

const opts = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = https.request(opts, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    if (res.statusCode === 201 || res.statusCode === 200) {
      console.log('Migration successful!');
    } else {
      console.log('Response:', data.slice(0, 500));
    }
  });
});

req.on('error', e => console.error('Request failed:', e.message));
req.write(body);
req.end();
