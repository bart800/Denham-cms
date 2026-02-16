#!/usr/bin/env node
// Create Supabase Auth users and link them to team_members via email
// Uses Supabase Management API (same approach as run-seed.js)

const SUPABASE_REF = "amyttoowrroajffqubpd";

// Team members with their auth emails and passwords
const USERS = [
  { name: "Bart Denham", email: "bart@denham.law", password: "Skrt2024!" },
  { name: "Joey", email: "joey@denham.law", password: "DenhamLaw2024!" },
  { name: "Chad", email: "chad@denham.law", password: "DenhamLaw2024!" },
  { name: "Daniel Kwiatkowski", email: "daniel@denham.law", password: "DenhamLaw2024!" },
  { name: "Eliza", email: "eliza@denham.law", password: "DenhamLaw2024!" },
  { name: "Kristen", email: "kristen@denham.law", password: "DenhamLaw2024!" },
  { name: "Shelby", email: "shelby@denham.law", password: "DenhamLaw2024!" },
  { name: "Kami", email: "kami@denham.law", password: "DenhamLaw2024!" },
];

async function run() {
  // Get auth token from cookie file (same as run-seed.js)
  const fs = require("fs");
  const cookiePath = require("path").join(require("os").homedir(), ".openclaw", "media", "browser", "supabase-cookies.json");
  
  // Try to get token from environment or prompt
  let token = process.env.SUPABASE_ACCESS_TOKEN;
  
  if (!token) {
    // Use the Management API with the dashboard session
    // First, let's try using the Supabase Auth Admin API via the service_role key
    // We need to get it from the dashboard API settings
    console.log("Getting service_role key from Management API...");
    
    const resp = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_REF}/api-keys`, {
      headers: {
        "Authorization": `Bearer ${process.env.SB_TOKEN}`,
      },
    });
    
    if (!resp.ok) {
      console.error("Failed to get API keys. Set SB_TOKEN env var with your Supabase dashboard access token.");
      console.error("Status:", resp.status, await resp.text());
      process.exit(1);
    }
    
    const keys = await resp.json();
    const serviceKey = keys.find(k => k.name === "service_role");
    if (!serviceKey) {
      console.error("service_role key not found in API keys response:", keys);
      process.exit(1);
    }
    
    token = serviceKey.api_key;
    console.log("Got service_role key");
  }

  const SUPABASE_URL = `https://${SUPABASE_REF}.supabase.co`;
  
  for (const user of USERS) {
    console.log(`Creating auth user: ${user.email}...`);
    
    // Create auth user via Supabase Auth Admin API
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { name: user.name },
      }),
    });
    
    if (resp.ok) {
      const data = await resp.json();
      console.log(`  ✓ Created: ${data.id}`);
      
      // Update team_members with email
      const updateResp = await fetch(
        `${SUPABASE_URL}/rest/v1/team_members?name=eq.${encodeURIComponent(user.name)}`,
        {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "apikey": token,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ email: user.email }),
        }
      );
      
      if (updateResp.ok) {
        console.log(`  ✓ Updated team_member email`);
      } else {
        console.error(`  ✗ Failed to update team_member:`, await updateResp.text());
      }
    } else {
      const err = await resp.text();
      if (err.includes("already been registered")) {
        console.log(`  → Already exists, skipping`);
        // Still update team_member email
        await fetch(
          `${SUPABASE_URL}/rest/v1/team_members?name=eq.${encodeURIComponent(user.name)}`,
          {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${token}`,
              "apikey": token,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ email: user.email }),
          }
        );
      } else {
        console.error(`  ✗ Failed:`, err);
      }
    }
  }
  
  console.log("\nDone! Users can now sign in with email/password.");
}

run().catch(e => { console.error(e); process.exit(1); });
