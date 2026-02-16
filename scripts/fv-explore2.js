const https = require('https');
const querystring = require('querystring');

const CONFIG = {
  apiKey: 'bJKHE3o5BeUp8FNw/2wImOEKL4hpUQ10n3jMy0XVog4=',
  clientId: '85105ea4-32f5-4a4f-ae88-51d0c61b4ba5',
  orgId: '9152',
  prevApiKey: '7E717675B169167D09723A5EB3D57AF50D1558FCC0F3AB83F75A6B555870E5BD'
};

function post(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { console.log(`POST ${path} (${res.statusCode}):`, d.substring(0, 2000)); resolve(d); });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path, method: 'GET', headers };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { console.log(`GET ${path} (${res.statusCode}):`, d.substring(0, 2000)); resolve(d); });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Approach 1: OAuth2 client_credentials
  console.log('\n--- OAuth2 client_credentials ---');
  await post('api.filevine.io', '/oauth2/token',
    JSON.stringify({ grant_type: 'client_credentials', client_id: CONFIG.clientId, client_secret: CONFIG.apiKey }),
    { 'Content-Type': 'application/json' }
  );

  // Approach 2: Try with x-fv-userid = orgId (some orgs use this)
  console.log('\n--- With userid=orgId ---');
  await get('api.filevine.io', '/core/v2/org', {
    'x-fv-orgid': CONFIG.orgId,
    'x-fv-userid': CONFIG.orgId,
    'x-fv-apikey': CONFIG.apiKey,
    'x-fv-clientid': CONFIG.clientId
  });

  // Approach 3: Bearer token with API key
  console.log('\n--- Bearer token ---');
  await get('api.filevine.io', '/core/v2/org', {
    'Authorization': `Bearer ${CONFIG.apiKey}`,
    'x-fv-orgid': CONFIG.orgId
  });

  // Approach 4: Try the older API key as a session token
  console.log('\n--- Older key as session ---');
  await get('api.filevine.io', '/core/v2/org', {
    'x-fv-orgid': CONFIG.orgId,
    'x-fv-sessionid': CONFIG.prevApiKey
  });

  // Approach 5: Form-encoded OAuth
  console.log('\n--- OAuth2 form-encoded ---');
  const formData = querystring.stringify({
    grant_type: 'client_credentials',
    client_id: CONFIG.clientId,
    client_secret: CONFIG.apiKey
  });
  await post('api.filevine.io', '/oauth2/token', formData, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formData)
  });
}

main().catch(console.error);
