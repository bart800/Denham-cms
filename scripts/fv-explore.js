// Filevine API explorer
// Auth: HMAC-SHA256 signed requests
const crypto = require('crypto');
const https = require('https');

const CONFIG = {
  baseUrl: 'https://api.filevine.io',
  apiKey: 'bJKHE3o5BeUp8FNw/2wImOEKL4hpUQ10n3jMy0XVog4=',
  clientId: '85105ea4-32f5-4a4f-ae88-51d0c61b4ba5',
  orgId: '9152'
};

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.baseUrl + path);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Filevine HMAC: sign "method\npath\ntimestamp" with the API key
    const message = `${method.toUpperCase()}\n${path}\n${timestamp}`;
    const hmac = crypto.createHmac('sha256', Buffer.from(CONFIG.apiKey, 'base64'));
    hmac.update(message);
    const signature = hmac.digest('base64');

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'x-fv-orgid': CONFIG.orgId,
        'x-fv-clientid': CONFIG.clientId,
        'x-fv-timestamp': timestamp,
        'x-fv-signature': signature,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n=== ${method} ${path} === (${res.statusCode})`);
        try { console.log(JSON.stringify(JSON.parse(data), null, 2)); }
        catch { console.log(data); }
        resolve(data);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Try various auth approaches and endpoints
  
  // 1. Try org info
  await makeRequest('GET', '/core/v2/org');
  
  // 2. Try project types (this tells us what case templates exist)
  await makeRequest('GET', '/core/v2/projecttypes');
  
  // 3. Try contacts
  await makeRequest('GET', '/core/v2/contacts?requestedCount=1');
}

main().catch(console.error);
