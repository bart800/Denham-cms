const fs = require('fs');
const d = require('../data/filevine-projects.json');
const ids = d.projects.filter(p => p.type === 'Property Casualty').map(p => p.id);

const script = `// 🐩 Filevine Data Extractor — paste this in the Filevine browser console
// READ-ONLY: Does NOT modify any Filevine data
(async function() {
  const IDS = ${JSON.stringify(ids)};
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const results = [];
  
  for (let i = 0; i < IDS.length; i++) {
    const pid = IDS[i];
    console.log('[' + (i+1) + '/' + IDS.length + '] Scraping ' + pid + '...');
    
    location.hash = '#/project/' + pid + '/custom/intake33651';
    await delay(2500);
    
    try {
      const data = { projectId: pid };
      
      document.querySelectorAll('input, select, textarea').forEach(el => {
        let label = '';
        const p = el.closest('[class*=field], .form-group');
        if (p) { const l = p.querySelector('label, [class*=label]'); if (l) label = l.textContent.trim(); }
        if (!label) label = el.name || el.placeholder || '';
        if (label && el.value && el.value !== 'Unknown' && el.value !== 'on' && el.value !== '') {
          const key = label.replace(/[0-9\\/]+\\s*$/, '').trim();
          if (key && key.length < 100) data[key] = el.value;
        }
      });
      
      const h1 = document.querySelector('h1');
      if (h1) data.projectName = h1.textContent.trim();
      const ph = document.querySelector('a[href^="tel:"]');
      if (ph) data.clientPhone = ph.textContent.trim();
      const em = document.querySelector('a[href^="mailto:"]');
      if (em) data.clientEmail = em.textContent.trim();
      
      results.push(data);
      console.log('  ✓ ' + (data.projectName || pid) + ': ' + Object.keys(data).length + ' fields');
    } catch(e) {
      console.error('  ✗ ' + e.message);
      results.push({projectId: pid, error: e.message});
    }
    
    if (i % 10 === 9) await delay(2000);
  }
  
  window._scrapedData = results;
  console.log('Done! ' + results.length + ' cases. Access: window._scrapedData');
  
  // Auto-download
  const blob = new Blob([JSON.stringify(results, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'filevine-detailed-data.json';
  a.click();
})();
`;

fs.writeFileSync(__dirname + '/console-scraper.js', script);
console.log('Wrote console-scraper.js (' + script.length + ' bytes, ' + ids.length + ' project IDs)');
