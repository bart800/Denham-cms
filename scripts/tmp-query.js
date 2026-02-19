const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const apiKey = env.match(/MATON_API_KEY=(.+)/)[1].trim();

async function run() {
  // Get the connection to find the OAuth URL
  const res = await fetch("https://ctrl.maton.ai/connections/2f98118b-97fa-4009-9e47-f22fc375418b", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}
run().catch(console.error);
