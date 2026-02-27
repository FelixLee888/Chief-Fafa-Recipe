#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DOCS_SCOPE = 'https://www.googleapis.com/auth/documents.readonly';
const DEFAULT_REDIRECT = 'http://127.0.0.1:8788/callback';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [key, inlineValue] = token.split('=');
    const cleanKey = key.slice(2);
    if (inlineValue !== undefined) {
      args[cleanKey] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[cleanKey] = next;
      i += 1;
    } else {
      args[cleanKey] = true;
    }
  }
  return args;
}

async function loadClientSecret(clientSecretFile) {
  const abs = path.resolve(clientSecretFile);
  const raw = JSON.parse(await fs.readFile(abs, 'utf8'));
  const block = typeof raw.installed === 'object' ? raw.installed : raw.web;
  if (!block || typeof block !== 'object') {
    throw new Error('Invalid client secret JSON: expected `installed` or `web` block');
  }

  const clientId = String(block.client_id || '').trim();
  const clientSecret = String(block.client_secret || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('client_id/client_secret missing in client secret JSON');
  }

  return { clientId, clientSecret };
}

function buildAuthUrl({ clientId, redirectUri, scope, loginHint }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent'
  });
  if (loginHint) {
    params.set('login_hint', loginHint);
  }
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
  const payload = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && body.error_description
        ? String(body.error_description)
        : `token exchange failed (${response.status})`;
    throw new Error(detail);
  }

  return body;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const clientSecretFile = String(args['client-secret-file'] || '').trim();
  if (!clientSecretFile) {
    throw new Error('Missing --client-secret-file <path>');
  }

  const redirectUri = String(args['redirect-uri'] || DEFAULT_REDIRECT).trim();
  const scope = String(args.scope || DOCS_SCOPE).trim();
  const loginHint = String(args['login-hint'] || '').trim();
  const code = String(args.code || '').trim();

  const { clientId, clientSecret } = await loadClientSecret(clientSecretFile);

  if (!code) {
    process.stdout.write('Open this URL and authorize access:\n');
    process.stdout.write(`${buildAuthUrl({ clientId, redirectUri, scope, loginHint })}\n\n`);
    process.stdout.write('Then rerun this command with --code "<authorization_code>".\n');
    return;
  }

  const tokenData = await exchangeCode({ clientId, clientSecret, redirectUri, code });
  const refreshToken = String(tokenData.refresh_token || '').trim();
  const accessToken = String(tokenData.access_token || '').trim();

  if (!refreshToken) {
    process.stdout.write('No refresh_token returned. Re-run consent flow and use a fresh code.\n');
    if (accessToken) {
      process.stdout.write('An access token was returned, but it is temporary.\n');
      process.stdout.write(`GOOGLE_DOCS_ACCESS_TOKEN=${accessToken}\n`);
    }
    return;
  }

  process.stdout.write('Add these values to your .env:\n');
  process.stdout.write(`GOOGLE_DOCS_CLIENT_ID=${clientId}\n`);
  process.stdout.write(`GOOGLE_DOCS_CLIENT_SECRET=${clientSecret}\n`);
  process.stdout.write(`GOOGLE_DOCS_REFRESH_TOKEN=${refreshToken}\n`);
  if (accessToken) {
    process.stdout.write(`GOOGLE_DOCS_ACCESS_TOKEN=${accessToken}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
