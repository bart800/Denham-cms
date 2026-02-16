const https = require('https');

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://api.filevine.io' + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json', ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    };
    const r = https.request(opts, res => {
      let d = ''; 
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // Try login/session endpoints
  const endpoints = [
    '/auth/v1/login',
    '/auth/login', 
    '/v1/auth/login',
    '/core/v2/session',
    '/session',
    '/v2/session',
    '/authenticate',
    '/api/v1/session',
  ];

  for (const ep of endpoints) {
    try {
      const r = await req('POST', ep, {
        clientId: '85105ea4-32f5-4a4f-ae88-51d0c61b4ba5',
        apiKey: 'bJKHE3o5BeUp8FNw/2wImOEKL4hpUQ10n3jMy0XVog4=',
        orgId: '9152'
      });
      console.log(`${ep}: ${r.status} → ${r.body.substring(0, 500)}`);
    } catch (e) {
      console.log(`${ep}: ERROR ${e.message}`);
    }
  }

  // Also try GET on session
  for (const ep of ['/core/v2/session', '/session']) {
    try {
      const r = await req('GET', ep, null, {
        'x-fv-orgid': '9152',
        'x-fv-clientid': '85105ea4-32f5-4a4f-ae88-51d0c61b4ba5',
        'x-fv-apikey': 'bJKHE3o5BeUp8FNw/2wImOEKL4hpUQ10n3jMy0XVog4='
      });
      console.log(`GET ${ep}: ${r.status} → ${r.body.substring(0, 500)}`);
    } catch (e) {
      console.log(`GET ${ep}: ERROR ${e.message}`);
    }
  }
}

main();
