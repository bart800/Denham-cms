// Save the Filevine project data
// Run this with the JSON piped in: echo <json> | node scripts/save-fv-data.js
const fs = require('fs');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const data = JSON.parse(input);
  const property = data.filter(p => p.type === 'Property Casualty');
  const output = {
    extractedAt: new Date().toISOString(),
    source: 'Filevine Project Hub - denhamlaw.filevineapp.com',
    orgId: 9152,
    total: data.length,
    propertyCasualty: property.length,
    personalInjury: data.length - property.length,
    projects: data
  };
  fs.writeFileSync('data/filevine-projects.json', JSON.stringify(output, null, 2));
  console.log(`Saved ${data.length} projects (${property.length} property, ${data.length - property.length} PI)`);
});
