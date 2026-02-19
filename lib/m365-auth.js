import crypto from 'crypto';

const TENANT = process.env.M365_TENANT_ID || 'common';
const AUTHORITY = `https://login.microsoftonline.com/${TENANT}`;
const SCOPES = [
  'Mail.Read', 'Mail.Send', 'Mail.ReadWrite',
  'Calendars.Read', 'Calendars.ReadWrite',
  'Contacts.Read', 'User.Read', 'offline_access',
].join(' ');

export const M365_CONFIG = {
  clientId: process.env.M365_CLIENT_ID,
  clientSecret: process.env.M365_CLIENT_SECRET,
  redirectUri: process.env.M365_REDIRECT_URI || 'https://denham-cms.vercel.app/api/auth/m365/callback',
  authorizeUrl: `${AUTHORITY}/oauth2/v2.0/authorize`,
  tokenUrl: `${AUTHORITY}/oauth2/v2.0/token`,
  scopes: SCOPES,
};

export function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function generateState() {
  return crypto.randomBytes(16).toString('hex');
}
