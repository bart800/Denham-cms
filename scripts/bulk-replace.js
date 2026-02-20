const fs = require('fs');
const path = require('path');

function walk(dir, ext) {
  let results = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory() && !f.name.startsWith('.') && f.name !== 'node_modules') {
      results = results.concat(walk(full, ext));
    } else if (ext.some(e => f.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const root = path.resolve(__dirname, '..');
const dirs = ['app', 'components', 'lib'].map(d => path.join(root, d));
let updated = 0;

for (const dir of dirs) {
  for (const file of walk(dir, ['.js', '.jsx'])) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('"Presuit Demand"') || content.includes("'Presuit Demand'")) {
      content = content.replace(/"Presuit Demand"/g, '"Presuit"').replace(/'Presuit Demand'/g, "'Presuit'");
      fs.writeFileSync(file, content);
      console.log('Updated:', path.relative(root, file));
      updated++;
    }
  }
}
console.log(`\nTotal files updated: ${updated}`);
