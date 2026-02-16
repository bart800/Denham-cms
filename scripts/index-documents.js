// Index documents from Clio/OneDrive into Supabase
// Reads the local file system and stores metadata in the documents table

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://amyttoowrroajffqubpd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQwOTYsImV4cCI6MjA4NjY3MDA5Nn0.tp97U9MmMG1Lz6-XaYg5WIqbaUrbC7V2LcqlJXgw1jM';
const CLIO_BASE = 'C:\\Users\\bart\\OneDrive - Bart Denham Law\\Clio';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Get all cases from Supabase
  const { data: cases, error: cErr } = await supabase.from('cases').select('id, ref, client_name');
  if (cErr) { console.error('Failed to fetch cases:', cErr); return; }
  console.log(`Loaded ${cases.length} cases from Supabase`);

  // Read Clio directory
  const clients = fs.readdirSync(CLIO_BASE, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  console.log(`Found ${clients.length} client folders in Clio`);

  const allDocs = [];
  let matchedCases = 0;
  let totalFiles = 0;

  for (const clientFolder of clients) {
    const clientPath = path.join(CLIO_BASE, clientFolder);
    
    // Match to a Supabase case by client name
    const clientLast = clientFolder.split(',')[0].trim().toLowerCase();
    const matchedCase = cases.find(c => {
      const caseName = c.client_name.toLowerCase();
      return caseName.includes(clientLast) || clientLast.includes(caseName.split(' ')[0].toLowerCase());
    });

    // Get all subfolders (case number folders like "00224-")
    let caseFolders;
    try {
      caseFolders = fs.readdirSync(clientPath, { withFileTypes: true }).filter(d => d.isDirectory());
    } catch { continue; }

    if (matchedCase) matchedCases++;

    for (const caseDir of caseFolders) {
      const casePath = path.join(clientPath, caseDir.name);
      
      // Get category folders
      let categoryDirs;
      try {
        categoryDirs = fs.readdirSync(casePath, { withFileTypes: true }).filter(d => d.isDirectory());
      } catch { continue; }

      for (const catDir of categoryDirs) {
        const catPath = path.join(casePath, catDir.name);
        
        // Recursively get all files
        function walkFiles(dir, category) {
          let entries;
          try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walkFiles(fullPath, category);
            } else {
              try {
                const stats = fs.statSync(fullPath);
                allDocs.push({
                  case_id: matchedCase?.id || null,
                  client_folder: clientFolder,
                  case_folder: caseDir.name,
                  category: category,
                  filename: entry.name,
                  file_ext: path.extname(entry.name).toLowerCase(),
                  file_size: stats.size,
                  file_modified: stats.mtime.toISOString(),
                  file_path: fullPath.replace(CLIO_BASE + '\\', ''),
                });
                totalFiles++;
              } catch {}
            }
          }
        }
        
        walkFiles(catPath, catDir.name);
      }
      
      // Also get files directly in the case folder (not in a category)
      try {
        const rootFiles = fs.readdirSync(casePath, { withFileTypes: true }).filter(f => !f.isDirectory());
        for (const f of rootFiles) {
          try {
            const stats = fs.statSync(path.join(casePath, f.name));
            allDocs.push({
              case_id: matchedCase?.id || null,
              client_folder: clientFolder,
              case_folder: caseDir.name,
              category: '_root',
              filename: f.name,
              file_ext: path.extname(f.name).toLowerCase(),
              file_size: stats.size,
              file_modified: stats.mtime.toISOString(),
              file_path: path.join(clientFolder, caseDir.name, f.name),
            });
            totalFiles++;
          } catch {}
        }
      } catch {}
    }

    // Files directly under client folder (not in case subfolder)
    try {
      const rootFiles = fs.readdirSync(clientPath, { withFileTypes: true }).filter(f => !f.isDirectory());
      for (const f of rootFiles) {
        try {
          const stats = fs.statSync(path.join(clientPath, f.name));
          allDocs.push({
            case_id: matchedCase?.id || null,
            client_folder: clientFolder,
            case_folder: null,
            category: '_root',
            filename: f.name,
            file_ext: path.extname(f.name).toLowerCase(),
            file_size: stats.size,
            file_modified: stats.mtime.toISOString(),
            file_path: path.join(clientFolder, f.name),
          });
          totalFiles++;
        } catch {}
      }
    } catch {}
  }

  console.log(`\nIndexed ${totalFiles} files from ${matchedCases} matched cases`);
  console.log(`Total docs to insert: ${allDocs.length}`);

  // Insert in batches of 500
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < allDocs.length; i += BATCH) {
    const batch = allDocs.slice(i, i + BATCH);
    const { error } = await supabase.from('documents').insert(batch);
    if (error) {
      console.error(`Batch ${i}-${i+batch.length} failed:`, error.message);
      // Try smaller batch if it fails
      for (const doc of batch) {
        const { error: e2 } = await supabase.from('documents').insert(doc);
        if (!e2) inserted++;
      }
    } else {
      inserted += batch.length;
      console.log(`  Inserted ${inserted}/${allDocs.length}...`);
    }
  }

  console.log(`\nDone! ${inserted} documents indexed in Supabase`);
  
  // Show stats
  const categories = {};
  allDocs.forEach(d => { categories[d.category] = (categories[d.category] || 0) + 1; });
  console.log('\nDocuments by category:');
  Object.entries(categories).sort((a,b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
}

main().catch(console.error);
