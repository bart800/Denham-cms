/**
 * Run SQL migration against Supabase using pg-meta API or Management API.
 * Usage: node scripts/run-migration.js <migration-file> [access-token]
 * 
 * If access-token provided, uses Management API.
 * Otherwise, tries direct connection via service role key.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const migrationFile = process.argv[2];
const accessToken = process.argv[3];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <sql-file> [supabase-access-token]');
  process.exit(1);
}

const sqlPath = path.resolve(migrationFile);
const sql = fs.readFileSync(sqlPath, 'utf8');
console.log(`📄 Migration: ${path.basename(sqlPath)} (${sql.length} chars)`);

const PROJECT_REF = 'amyttoowrroajffqubpd';

// Split SQL into individual statements and run them one by one
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`📝 ${statements.length} statements to execute\n`);

async function runViaManagementAPI(token) {
  // Run all at once
  const body = JSON.stringify({ query: sql });
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        console.log('Status:', r.statusCode);
        if (r.statusCode >= 200 && r.statusCode < 300) {
          console.log('✅ Migration complete');
          resolve();
        } else {
          console.error('❌ Error:', d.substring(0, 500));
          reject(new Error('Migration failed'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runViaServiceRole() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = new URL(supaUrl);
  
  let ok = 0, fail = 0;
  for (const stmt of statements) {
    const body = JSON.stringify({ query: stmt + ';' });
    const result = await new Promise((resolve) => {
      const opts = {
        hostname: url.hostname,
        path: '/rest/v1/rpc/exec_sql',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const req = https.request(opts, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve({ status: r.statusCode, body: d }));
      });
      req.on('error', e => resolve({ status: 0, body: e.message }));
      req.write(body);
      req.end();
    });
    
    if (result.status >= 200 && result.status < 300) {
      ok++;
    } else {
      console.error(`❌ Statement failed (${result.status}): ${stmt.substring(0, 80)}...`);
      console.error(`   ${result.body.substring(0, 200)}`);
      fail++;
    }
  }
  console.log(`\n✅ ${ok} succeeded, ❌ ${fail} failed`);
}

async function main() {
  if (accessToken) {
    console.log('Using Management API...');
    await runViaManagementAPI(accessToken);
  } else {
    // Try to get access token from browser or use management API with stored token
    console.log('No access token provided.');
    console.log('Attempting via Management API with browser session...\n');
    
    // Actually, let's just try the management API approach
    // We need the access token. Let me try to get it.
    console.log('❌ Need Supabase access token to run DDL.');
    console.log('');
    console.log('Option 1: Get token from Supabase dashboard:');
    console.log('  1. Go to https://supabase.com/dashboard');
    console.log('  2. Open browser dev tools → Application → Cookies');
    console.log('  3. Copy the "sb-access-token" value');
    console.log('  4. Run: node scripts/run-migration.js <file> <token>');
    console.log('');
    console.log('Option 2: Use Supabase CLI:');
    console.log('  npx supabase db push');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
