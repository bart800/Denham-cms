// This script runs INSIDE the Filevine browser tab (injected via console or browser relay)
// It navigates to each project's intake section and extracts field data
// READ-ONLY — does NOT modify any Filevine data

(async function() {
  // Load project IDs (Property Casualty only)
  const projectIds = window._projectIds; // Must be set before running
  if (!projectIds || !projectIds.length) {
    console.error('Set window._projectIds first!');
    return;
  }
  
  const results = [];
  const delay = ms => new Promise(r => setTimeout(r, ms));
  
  for (let i = 0; i < projectIds.length; i++) {
    const pid = projectIds[i];
    console.log(`[${i+1}/${projectIds.length}] Scraping project ${pid}...`);
    
    // Navigate to intake section
    location.hash = `#/project/${pid}/custom/intake33651`;
    await delay(2000); // Wait for page load
    
    try {
      const data = { projectId: pid };
      
      // Extract all form fields
      document.querySelectorAll('input, select, textarea').forEach(el => {
        // Find closest label
        let label = '';
        const parent = el.closest('.form-group, .field-wrapper, .section-field, [class*=field]');
        if (parent) {
          const labelEl = parent.querySelector('label, .field-label, [class*=label]');
          if (labelEl) label = labelEl.textContent.trim();
        }
        if (!label) label = el.name || el.placeholder || el.getAttribute('aria-label') || '';
        
        if (label && el.value && el.value !== 'Unknown' && el.value !== 'on') {
          // Clean up the label
          const key = label.replace(/[0-9/]+\s*$/, '').trim();
          if (key) data[key] = el.value;
        }
      });
      
      // Extract project name from heading
      const heading = document.querySelector('h1');
      if (heading) data.projectName = heading.textContent.trim();
      
      // Extract contact info
      const phoneLink = document.querySelector('a[href^="tel:"]');
      if (phoneLink) data.clientPhone = phoneLink.textContent.trim();
      
      const emailLink = document.querySelector('a[href^="mailto:"]');
      if (emailLink) data.clientEmail = emailLink.textContent.trim();
      
      results.push(data);
      console.log(`  ✓ Got ${Object.keys(data).length} fields`);
    } catch (e) {
      console.error(`  ✗ Error: ${e.message}`);
      results.push({ projectId: pid, error: e.message });
    }
    
    // Rate limit - don't hammer the server
    if (i % 10 === 9) {
      console.log('  (pausing 3s to be nice to the server...)');
      await delay(3000);
    }
  }
  
  // Store results globally
  window._scrapedData = results;
  console.log(`\nDone! ${results.length} projects scraped.`);
  console.log('Access via: window._scrapedData');
  console.log('Copy to clipboard: copy(JSON.stringify(window._scrapedData))');
  
  // Also create downloadable file
  const blob = new Blob([JSON.stringify(results, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'filevine-intake-data.json';
  a.click();
  
  return results;
})();
