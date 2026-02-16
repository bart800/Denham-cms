const http = require('http');
const fs = require('fs');
let body = '';
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      const projects = JSON.parse(body);
      const output = {
        extractedAt: new Date().toISOString(),
        source: 'Filevine Project Hub',
        orgId: 9152,
        total: projects.length,
        propertyCasualty: projects.filter(p => p.type === 'Property Casualty').length,
        personalInjury: projects.filter(p => p.type !== 'Property Casualty').length,
        projects
      };
      fs.writeFileSync('data/filevine-projects.json', JSON.stringify(output, null, 2));
      res.writeHead(200);
      res.end('Saved ' + projects.length + ' projects');
      console.log('Saved ' + projects.length + ' projects!');
      server.close();
    });
  } else if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(204);
    res.end();
  }
});
server.listen(9876, () => console.log('Listening on :9876'));
