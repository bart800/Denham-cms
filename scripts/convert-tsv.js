const fs = require('fs');
const tsv = fs.readFileSync('data/filevine-projects.tsv', 'utf8');
const lines = tsv.trim().split('\n').slice(1); // skip header
const projects = lines.map(line => {
  const [name, id, phase, primary, lastActivity, created, type] = line.split('\t');
  return { name, id, phase, primary, lastActivity, created, type };
});
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
console.log(`Saved ${projects.length} projects (${output.propertyCasualty} PC, ${output.personalInjury} PI)`);
