#!/usr/bin/env node
// Device code flow login for Microsoft Graph API
// Usage: node scripts/graph-login.js

const msal = require("@azure/msal-node");
const fs = require("fs");
const path = require("path");
const { Client } = require("@microsoft/microsoft-graph-client");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const envVars = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}

const clientId = envVars.MS_GRAPH_CLIENT_ID || process.env.MS_GRAPH_CLIENT_ID;
const tenantId = envVars.MS_GRAPH_TENANT_ID || process.env.MS_GRAPH_TENANT_ID;

if (!clientId || !tenantId) {
  console.error("❌ Missing MS_GRAPH_CLIENT_ID or MS_GRAPH_TENANT_ID in .env.local");
  console.error("   Follow scripts/register-graph-app.md first.");
  process.exit(1);
}

const app = new msal.PublicClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
  },
});

const scopes = ["Files.Read.All", "Sites.Read.All", "offline_access"];

async function main() {
  console.log("🔐 Starting Microsoft Graph authentication...\n");

  const result = await app.acquireTokenByDeviceCode({
    scopes,
    deviceCodeCallback: (response) => {
      console.log("━".repeat(60));
      console.log(response.message);
      console.log("━".repeat(60));
    },
  });

  console.log(`\n✅ Authenticated as: ${result.account.username}`);

  // Extract refresh token from MSAL cache
  const cache = app.getTokenCache().serialize();
  const cacheObj = JSON.parse(cache);
  const refreshTokens = cacheObj.RefreshToken || {};
  const rtKey = Object.keys(refreshTokens)[0];
  const refreshToken = rtKey ? refreshTokens[rtKey].secret : null;

  if (!refreshToken) {
    console.error("❌ Could not extract refresh token from cache");
    process.exit(1);
  }

  // Save to .env.local
  let newEnv = envContent;
  if (newEnv.includes("MS_GRAPH_REFRESH_TOKEN=")) {
    newEnv = newEnv.replace(/MS_GRAPH_REFRESH_TOKEN=.*/, `MS_GRAPH_REFRESH_TOKEN=${refreshToken}`);
  } else {
    newEnv += `\nMS_GRAPH_REFRESH_TOKEN=${refreshToken}\n`;
  }
  fs.writeFileSync(envPath, newEnv);
  console.log("💾 Refresh token saved to .env.local");

  // Test by listing OneDrive root
  console.log("\n📂 Testing - listing OneDrive root...");
  const graphClient = Client.init({
    authProvider: (done) => done(null, result.accessToken),
  });

  const driveRoot = await graphClient.api("/me/drive/root/children").top(10).get();
  for (const item of driveRoot.value) {
    const icon = item.folder ? "📁" : "📄";
    console.log(`  ${icon} ${item.name}`);
  }

  console.log("\n🎉 Done! Graph API is ready to use.");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
