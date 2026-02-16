const https = require('https');

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.filevine.io', path, method,
      headers: { 'Content-Type': 'application/json', ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    };
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // /session endpoint wants userId and orgId in body
  const variations = [
    { orgId: '9152', key: 'bJKHE3o5BeUp8FNw/2wImOEKL4hpUQ10n3jMy0XVog4=', clientId: '85105ea4-32f5-4a4f-ae88-51d0c61b4ba5' },
    { orgId: 9152, key: 'bJKHE3o5BeUp8FNw/2wImOEKL4hpUQ10n3jMy0XVog4=', clientId: '85105ea4-32f5-4a4f-ae88-51d0c61b4ba5' },
    { orgId: '9152', apiKey: 'bJKHE3o5BeUp8FNw/2wImOEKL4hpUQ10n3jMy0XVog4=', clientId: '85105ea4-32f5-4a4f-ae88-51d0c61b4ba5' },
    { orgId: '9152', apiKey: '7E717675B169167D09723A5EB3D57AF50D1558FCC0F3AB83F75A6B555870E5BD', clientId: '85105ea4-32f5-4a4f-ae88-51d0c61b4ba5' },
  ];

  for (const body of variations) {
    const r = await req('POST', '/session', body);
    console.log(`Body: ${JSON.stringify(body)}`);
    console.log(`→ ${r.status}: ${r.body.substring(0, 500)}\n`);
  }

  // Try with headers instead
  const r2 = await req('POST', '/session', {}, {
    'x-fv-orgid': '9152',
    'x-fv-apikey': 'bJKHE3o5BeUp8FNw/2wImOEKL4hpUQ10n3jMy0XVog4=',
    'x-fv-clientid': '85105ea4-32f5-4a4f-ae88-51d0c61b4ba5'
  });
  console.log(`Headers approach → ${r2.status}: ${r2.body.substring(0, 500)}`);
}

main();
