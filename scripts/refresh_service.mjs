#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT_DIR = path.resolve('.');
const SITE_DIR = path.resolve('site');
const LOG_PATH = path.resolve('data/service.log');

const HOST = process.env.RECIPE_SERVICE_HOST || '127.0.0.1';
const PORT = Number(process.env.RECIPE_SERVICE_PORT || 8789);
const INTERVAL_MINUTES = Number(process.env.RECIPE_REFRESH_INTERVAL_MINUTES || 30);
const AUTO_REFRESH = process.env.RECIPE_AUTO_REFRESH !== '0';
const RUN_ON_START = process.env.RECIPE_RUN_ON_START !== '0';
const SERVICE_TOKEN = String(process.env.RECIPE_SERVICE_TOKEN || '').trim();
const DOC_IDS = String(process.env.RECIPE_DOC_IDS || '').trim();
const ENV_FILE = String(process.env.RECIPE_ENV_FILE || '').trim();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const state = {
  running: false,
  lastTrigger: '',
  lastRunAt: '',
  lastSuccessAt: '',
  lastDurationMs: 0,
  lastError: '',
  runCount: 0,
  nextRunAt: '',
  lastOutput: []
};

let timer = null;

function nowIso() {
  return new Date().toISOString();
}

function pushOutput(line) {
  const clean = String(line || '').replace(/\r/g, '').trimEnd();
  if (!clean) return;

  const stamped = `[${nowIso()}] ${clean}`;
  state.lastOutput.push(stamped);
  if (state.lastOutput.length > 120) {
    state.lastOutput = state.lastOutput.slice(-120);
  }

  process.stdout.write(`${stamped}\n`);
  void fsp.mkdir(path.dirname(LOG_PATH), { recursive: true }).then(() => fsp.appendFile(LOG_PATH, `${stamped}\n`, 'utf8')).catch(() => {});
}

function commandArgsForRefresh() {
  const args = ['scripts/refresh_from_doc_ids.mjs'];
  if (DOC_IDS) {
    args.push('--doc-ids', DOC_IDS);
  }
  if (ENV_FILE) {
    args.push('--env-file', ENV_FILE);
  }
  return args;
}

async function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (buf) => {
      pushOutput(`${cmd} ${args.join(' ')} | ${buf.toString()}`);
    });

    child.stderr.on('data', (buf) => {
      pushOutput(`${cmd} ${args.join(' ')} | ${buf.toString()}`);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function runRefreshPipeline(trigger) {
  if (state.running) {
    return { started: false, reason: 'already_running' };
  }

  state.running = true;
  state.lastTrigger = trigger;
  state.lastRunAt = nowIso();
  state.lastError = '';

  const started = Date.now();
  pushOutput(`Refresh pipeline started (${trigger})`);

  try {
    await runCommand('node', commandArgsForRefresh());
    await runCommand('node', ['scripts/build-site.mjs']);

    state.runCount += 1;
    state.lastSuccessAt = nowIso();
    state.lastDurationMs = Date.now() - started;

    pushOutput(`Refresh pipeline finished in ${state.lastDurationMs}ms`);
    return { started: true, ok: true };
  } catch (error) {
    state.runCount += 1;
    state.lastDurationMs = Date.now() - started;
    state.lastError = error?.message || 'unknown error';

    pushOutput(`Refresh pipeline failed: ${state.lastError}`);
    return { started: true, ok: false, error: state.lastError };
  } finally {
    state.running = false;
    scheduleNextRun();
  }
}

function scheduleNextRun() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  if (!AUTO_REFRESH || !Number.isFinite(INTERVAL_MINUTES) || INTERVAL_MINUTES <= 0) {
    state.nextRunAt = '';
    return;
  }

  const delayMs = Math.max(10_000, Math.floor(INTERVAL_MINUTES * 60_000));
  const next = Date.now() + delayMs;
  state.nextRunAt = new Date(next).toISOString();

  timer = setTimeout(async () => {
    await runRefreshPipeline('scheduled');
  }, delayMs);
}

function authOk(reqUrl, req) {
  if (!SERVICE_TOKEN) return true;

  const tokenFromHeader = String(req.headers['x-service-token'] || '').trim();
  const tokenFromQuery = String(reqUrl.searchParams.get('token') || '').trim();
  return tokenFromHeader === SERVICE_TOKEN || tokenFromQuery === SERVICE_TOKEN;
}

function sendJson(res, code, payload) {
  const raw = JSON.stringify(payload, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(raw);
}

function serviceStatus() {
  return {
    ok: true,
    service: 'chief-fafa-recipe-refresh',
    host: HOST,
    port: PORT,
    autoRefresh: AUTO_REFRESH,
    intervalMinutes: INTERVAL_MINUTES,
    docsConfigured: DOC_IDS || 'default-list',
    running: state.running,
    lastTrigger: state.lastTrigger,
    lastRunAt: state.lastRunAt,
    lastSuccessAt: state.lastSuccessAt,
    lastDurationMs: state.lastDurationMs,
    lastError: state.lastError,
    runCount: state.runCount,
    nextRunAt: state.nextRunAt,
    logPath: LOG_PATH,
    outputTail: state.lastOutput.slice(-30)
  };
}

function safePathFromUrl(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const normalized = path.posix.normalize(decoded);
  const withoutLeadingSlash = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const finalPath = withoutLeadingSlash || 'index.html';
  const absolutePath = path.resolve(SITE_DIR, finalPath);

  if (!absolutePath.startsWith(SITE_DIR)) {
    return '';
  }
  return absolutePath;
}

async function serveStatic(reqUrl, res) {
  let target = safePathFromUrl(reqUrl.pathname);
  if (!target) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad path');
    return;
  }

  try {
    const stat = await fsp.stat(target);
    if (stat.isDirectory()) {
      target = path.join(target, 'index.html');
    }
  } catch {
    if (!path.extname(target)) {
      const htmlCandidate = `${target}.html`;
      try {
        await fsp.access(htmlCandidate);
        target = htmlCandidate;
      } catch {
        // leave target unchanged
      }
    }
  }

  try {
    const stat = await fsp.stat(target);
    if (!stat.isFile()) {
      throw new Error('Not file');
    }

    const ext = path.extname(target).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
    });

    fs.createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

async function handleRequest(req, res) {
  const base = `http://${req.headers.host || `${HOST}:${PORT}`}`;
  const reqUrl = new URL(req.url || '/', base);

  if (reqUrl.pathname === '/api/health' || reqUrl.pathname === '/api/status') {
    sendJson(res, 200, serviceStatus());
    return;
  }

  if (reqUrl.pathname === '/api/refresh') {
    if (!authOk(reqUrl, req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
      return;
    }

    const outcome = await runRefreshPipeline('api');
    if (!outcome.started) {
      sendJson(res, 409, { ok: false, error: outcome.reason, status: serviceStatus() });
      return;
    }

    sendJson(res, outcome.ok ? 200 : 500, {
      ok: Boolean(outcome.ok),
      error: outcome.error || '',
      status: serviceStatus()
    });
    return;
  }

  if (reqUrl.pathname === '/api/logs') {
    if (!authOk(reqUrl, req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }
    sendJson(res, 200, { ok: true, logs: state.lastOutput.slice(-100) });
    return;
  }

  await serveStatic(reqUrl, res);
}

const server = http.createServer((req, res) => {
  void handleRequest(req, res).catch((error) => {
    pushOutput(`HTTP handler error: ${error?.message || error}`);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  });
});

server.listen(PORT, HOST, async () => {
  pushOutput(`Service listening on http://${HOST}:${PORT}`);
  pushOutput(`Auto refresh: ${AUTO_REFRESH ? `enabled (${INTERVAL_MINUTES}m)` : 'disabled'}`);

  if (RUN_ON_START) {
    await runRefreshPipeline('startup');
  } else {
    scheduleNextRun();
  }
});

function shutdown(signal) {
  pushOutput(`Received ${signal}, shutting down`);
  if (timer) clearTimeout(timer);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
