# Register Azure AD App for Denham CMS

## Steps

1. Go to [Azure App Registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **"New registration"**
3. Fill in:
   - **Name:** `Denham CMS`
   - **Supported account types:** "Accounts in this organizational directory only"
   - **Redirect URI:** Leave blank
4. Click **Register**
5. On the overview page, copy:
   - **Application (client) ID** → paste into `.env.local` as `MS_GRAPH_CLIENT_ID`
   - **Directory (tenant) ID** → paste into `.env.local` as `MS_GRAPH_TENANT_ID`
6. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
   - Add: `Files.Read.All`, `Sites.Read.All`
   - Click **Grant admin consent** (optional but recommended)
7. Go to **Authentication** → scroll to **Advanced settings** → set **Allow public client flows** to **Yes** → **Save**

## After Registration

```bash
cd denham-cms
node scripts/graph-login.js
```

Follow the on-screen instructions to authenticate. The script will save your refresh token automatically.
