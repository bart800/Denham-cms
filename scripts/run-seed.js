const https = require('https');
const fs = require('fs');
const path = require('path');

const ACCESS_TOKEN = process.argv[2];
const PROJECT_REF = 'amyttoowrroajffqubpd';
const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
const sql = fs.readFileSync(seedPath, 'utf8');

console.log(`Seed SQL length: ${sql.length} chars`);

const body = JSON.stringify({ query: sql });

const opts = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(opts, r => {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', () => {
    console.log('Status:', r.statusCode);
    console.log('Response:', d.substring(0, 500));
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();
