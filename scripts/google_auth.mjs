#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createSign } from 'node:crypto';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_DOCS_SCOPE = 'https://www.googleapis.com/auth/documents.readonly';
export const GOOGLE_DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
export const GOOGLE_DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const GOOGLE_DOCS_DEFAULT_SCOPE = [
  GOOGLE_DOCS_SCOPE,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_DRIVE_READONLY_SCOPE
].join(' ');

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function pickEnvValue(loadedEnv, key) {
  const processValue = String(process.env[key] || '').trim();
  if (processValue) return processValue;
  return String(loadedEnv?.[key] || '').trim();
}

async function loadServiceAccountPayload(loadedEnv = {}) {
  const rawJson =
    pickEnvValue(loadedEnv, 'GOOGLE_SERVICE_ACCOUNT_JSON') ||
    pickEnvValue(loadedEnv, 'GOOGLE_DOCS_SERVICE_ACCOUNT_JSON');
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const rawBase64 =
    pickEnvValue(loadedEnv, 'GOOGLE_SERVICE_ACCOUNT_JSON_B64') ||
    pickEnvValue(loadedEnv, 'GOOGLE_DOCS_SERVICE_ACCOUNT_JSON_B64');
  if (rawBase64) {
    return JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8'));
  }

  const filePath =
    pickEnvValue(loadedEnv, 'GOOGLE_SERVICE_ACCOUNT_FILE') ||
    pickEnvValue(loadedEnv, 'GOOGLE_DOCS_SERVICE_ACCOUNT_FILE');
  if (filePath) {
    const raw = await fs.readFile(path.resolve(filePath), 'utf8');
    return JSON.parse(raw);
  }

  return null;
}

function validateServiceAccount(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (String(payload.type || '').trim() !== 'service_account') return null;

  const clientEmail = String(payload.client_email || '').trim();
  const privateKey = String(payload.private_key || '').trim();
  const tokenUri = String(payload.token_uri || GOOGLE_TOKEN_URL).trim() || GOOGLE_TOKEN_URL;
  const projectId = String(payload.project_id || '').trim();

  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey, tokenUri, projectId };
}

export async function loadGoogleServiceAccount(loadedEnv = {}) {
  const payload = await loadServiceAccountPayload(loadedEnv);
  return validateServiceAccount(payload);
}

export async function exchangeServiceAccountAccessToken(serviceAccount, options = {}) {
  if (!serviceAccount?.clientEmail || !serviceAccount?.privateKey) {
    throw new Error('Invalid Google service account credentials');
  }

  const scope = String(options.scope || GOOGLE_DOCS_DEFAULT_SCOPE).trim() || GOOGLE_DOCS_DEFAULT_SCOPE;
  const subject = String(options.subject || '').trim();
  const now = Math.floor(Date.now() / 1000);
  const audience = String(serviceAccount.tokenUri || GOOGLE_TOKEN_URL).trim() || GOOGLE_TOKEN_URL;
  const claims = {
    iss: serviceAccount.clientEmail,
    scope,
    aud: audience,
    iat: now,
    exp: now + 3600
  };
  if (subject) {
    claims.sub = subject;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(serviceAccount.privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const assertion = `${unsigned}.${signature}`;

  const payload = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const response = await fetch(audience, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || !body?.access_token) {
    const detail =
      body?.error_description ||
      body?.error ||
      `service account token exchange failed (${response.status || 'unknown status'})`;
    throw new Error(`Failed to get Google service account access token: ${detail}`);
  }

  return String(body.access_token);
}
