#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_EXTERNAL_ENV = '/Users/felixlee/Documents/ChiefFaFaBot/.env';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DOCS_API_BASE = 'https://docs.googleapis.com/v1/documents';
const GOOGLE_DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const IMAGE_STATIC_DIR = path.resolve('static/assets/recipe-images');
const OUTPUT_RECIPES = path.resolve('data/recipes.json');
const OUTPUT_REPORT = path.resolve('data/doc-assets.json');

const LEGACY_DOC_IDS = [
  '1Mo5_kUFujPDgS51MdEop7ViWZrvHSf7-ZO-W6fcwOmM',
  '1V9vLKCcP4VEsEetxe-5VeSKMa4-OtyQwcwfdG0C78oE',
  '1lqDjFzd2mHd4NT2MvGaF9q5YytSEReRkr9cYL0hHukk',
  '1KB5JMvCIwpBot3oxUmAhuUUEO7OiI8MSExHrGoRrDkI',
  '1vm3jQSwK0gQzl2HTW_8XzDECNLLLbXQj4dglB75hlbM',
  '1Ie9ulO_9KDm19rpwVo1-maxRm_xfoU371T_7A4KjBc0',
  '11lASfhSpQPKzApjziA9zPFROvcfhNYuDqsG_ZZ9j0k4',
  '1vcIKTOgG5zmorL6kb6ZhwQZCvQltcTHH-Xdrj6knYBE'
];

const CUISINE_KEYWORDS = {
  Filipino: ['adobo', 'calamansi', 'patis', 'sinigang', 'tocino', 'longganisa', 'pandesal', 'atchara', 'ginisang'],
  Italian: ['pasta', 'parmesan', 'risotto', 'basil', 'oregano', 'mozzarella', 'marinara', 'gnocchi'],
  Japanese: ['miso', 'mirin', 'dashi', 'onigiri', 'sushi', 'teriyaki', 'nori', 'shoyu', '日式', '和風', '和风'],
  Chinese: ['soy sauce', 'five spice', 'hoisin', 'bok choy', 'sichuan', 'scallion', 'shaoxing', '中式', '港式'],
  Thai: ['lemongrass', 'fish sauce', 'coconut milk', 'thai basil', 'galangal', 'red curry', '泰式'],
  Korean: ['gochujang', 'kimchi', 'sesame oil', 'gochugaru', 'bulgogi', '韓式', '韩式'],
  Indian: ['garam masala', 'turmeric', 'coriander', 'ghee', 'paneer', 'tikka', '印度'],
  Mexican: ['tortilla', 'jalapeno', 'pico de gallo', 'black beans', 'queso', 'chipotle', '墨西哥'],
  Mediterranean: ['tahini', 'chickpea', 'feta', 'zaatar', 'olive oil', 'hummus', '地中海'],
  American: ['bbq', 'ranch', 'coleslaw', 'burger', 'mac and cheese', 'cornbread'],
  French: ['beurre', 'veloute', 'herbes de provence', 'ratatouille', 'dijon', '法式']
};

const TYPE_KEYWORDS = {
  Breakfast: ['breakfast', 'omelet', 'oatmeal', 'pancake', 'toast', 'granola', 'scramble', 'morning', '早餐'],
  Lunch: ['lunch', 'sandwich', 'rice bowl', 'bento', 'wrap', '午餐'],
  Dinner: ['dinner', 'main', 'entree', 'stew', 'braise', 'roast', 'curry', 'adobo', '晚餐'],
  Dessert: ['dessert', 'cake', 'cookie', 'brownie', 'pudding', 'sweet', 'ice cream', '甜點', '甜品', '蛋糕'],
  Snack: ['snack', 'bite', 'onigiri', 'bar', 'chips', '點心', '点心'],
  Appetizer: ['appetizer', 'starter', 'dip', 'canape', 'small plate', '前菜'],
  Soup: ['soup', 'broth', 'ramen', 'bisque', 'sinigang', '湯', '汤'],
  Salad: ['salad', 'greens', 'vinaigrette', 'slaw', '沙拉'],
  Beverage: ['drink', 'smoothie', 'juice', 'latte', 'tea', 'coffee', '飲品', '饮品']
};

const URL_RE = /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g;
const COOK_TIME_HINT_RE = /\b(?:bake|roast|boil|simmer|fry|steam|grill|cook|preheat|烤|煮|炸|蒸|炒|焗|炆|煎)\b/i;
const REST_TIME_HINT_RE = /\b(?:rest|chill(?:ed|ing)?|cool|freeze|marinate|proof|soak|steep|overnight|refrigerate|fridge|冷藏|冷凍|冷冻|放涼|放凉|靜置|静置|浸泡|醃|腌|發酵|发酵)\b/i;
const DURATION_RANGE_RE =
  /(\d+(?:\.\d+)?)\s*(?:-|–|—|to|~|～)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|分鐘|分钟|小時|小时|鐘頭|钟头)\b/gi;
const DURATION_SINGLE_RE = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|分鐘|分钟|小時|小时|鐘頭|钟头)\b/gi;
const FIELD_PATTERNS = {
  prepTime: [
    /(?:^|\b)prep(?:aration)?(?:\s*time)?\s*[:：\-]?\s*([^|;\n]+?)(?=\b(?:cook(?:ing)?(?:\s*time)?|total(?:\s*time)?|servings?|yield|serves?)\b|$)/i,
    /(?:^|[\s(（])(?:準備時間|准备时间|備料時間|备料时间|預備時間|预备时间)\s*[:：\-]?\s*([^|;\n]+?)(?=(?:烹調時間|烹调时间|總時間|总时间|份量|人份|食用人數|食用人数)|$)/i
  ],
  cookTime: [
    /(?:^|\b)cook(?:ing)?(?:\s*time)?\s*[:：\-]?\s*([^|;\n]+?)(?=\b(?:total(?:\s*time)?|servings?|yield|serves?)\b|$)/i,
    /(?:^|[\s(（])(?:烹調時間|烹调时间|料理時間|調理時間|烹飪時間|烹饪时间)\s*[:：\-]?\s*([^|;\n]+?)(?=(?:總時間|总时间|份量|人份|食用人數|食用人数)|$)/i
  ],
  totalTime: [
    /(?:^|\b)total(?:\s*time)?\s*[:：\-]?\s*([^|;\n]+?)(?=\b(?:servings?|yield|serves?)\b|$)/i,
    /(?:^|[\s(（])(?:總時間|总时间|所需時間|所需时间|全程時間|全程时间)\s*[:：\-]?\s*([^|;\n]+?)(?=(?:份量|人份|食用人數|食用人数)|$)/i
  ],
  servings: [
    /(?:^|\b)(?:servings?|yield|portion(?:s)?|makes?)\s*[:：\-]?\s*([^|;\n]+)$/i,
    /(?:^|\b)serves?\s+([0-9]+(?:\s*(?:-|–|—|~|to)\s*[0-9]+)?(?:\s*(?:people|persons|servings?))?)/i,
    /(?:^|[\s(（])(?:份量|份數|份数|人份|可供|食用人數|食用人数)\s*[:：\-]?\s*([^|;\n]+)$/i,
    /\b([0-9]+(?:\s*(?:-|–|—|~)\s*[0-9]+)?\s*(?:servings?|people|persons|人份|位份|人))\b/i
  ]
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [key, inlineValue] = token.split('=');
    const cleanKey = key.slice(2);
    if (inlineValue !== undefined) {
      args[cleanKey] = inlineValue;
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[cleanKey] = next;
        i += 1;
      } else {
        args[cleanKey] = true;
      }
    }
  }
  return args;
}

function parseDocIdList(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function uniqueById(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function parsePositiveInt(value, fallback = 0) {
  const n = Number(String(value || '').trim());
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseEnv(raw) {
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadEnv(args) {
  const loaded = {};
  const candidates = [];
  if (args['env-file']) {
    candidates.push(path.resolve(String(args['env-file'])));
  } else {
    candidates.push(DEFAULT_EXTERNAL_ENV);
    candidates.push(path.resolve('.env'));
  }

  for (const file of candidates) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      Object.assign(loaded, parseEnv(raw));
    } catch {
      // optional
    }
  }
  return loaded;
}

function pickEnv(loaded, keys) {
  for (const key of keys) {
    const processVal = String(process.env[key] || '').trim();
    if (processVal) return processVal;
    const loadedVal = String(loaded[key] || '').trim();
    if (loadedVal) return loadedVal;
  }
  return '';
}

async function resolveDocsAccessToken(loaded) {
  const refreshToken = pickEnv(loaded, ['GOOGLE_DOCS_REFRESH_TOKEN', 'GOOGLE_KEEP_REFRESH_TOKEN']);
  const directToken = pickEnv(loaded, ['GOOGLE_DOCS_ACCESS_TOKEN', 'GOOGLE_KEEP_ACCESS_TOKEN']);
  const clientId = pickEnv(loaded, ['GOOGLE_DOCS_CLIENT_ID', 'GOOGLE_KEEP_CLIENT_ID']);
  const clientSecret = pickEnv(loaded, ['GOOGLE_DOCS_CLIENT_SECRET', 'GOOGLE_KEEP_CLIENT_SECRET']);

  if (refreshToken && clientId && clientSecret) {
    const payload = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body && typeof body === 'object' && body.access_token) {
      return String(body.access_token);
    }
  }

  if (directToken) return directToken;
  throw new Error('Missing Google Docs OAuth token configuration');
}

async function listGoogleDocsFromDrive(token, options = {}) {
  const query = String(options.query || '').trim() || "mimeType='application/vnd.google-apps.document' and trashed=false";
  const pageSize = Math.min(1000, Math.max(1, parsePositiveInt(options.pageSize, 200)));
  const maxDocs = parsePositiveInt(options.maxDocs, 0);

  const docs = [];
  let pageToken = '';
  let stop = false;

  while (!stop) {
    const params = new URLSearchParams({
      q: query,
      fields: 'nextPageToken,files(id,name,modifiedTime,createdTime)',
      orderBy: 'modifiedTime desc',
      pageSize: String(pageSize),
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
      corpora: 'allDrives'
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`${GOOGLE_DRIVE_FILES_API}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = body?.error?.message || `drive api error (${response.status})`;
      if (response.status === 403 && /scope|insufficient/i.test(detail)) {
        throw new Error(
          `Insufficient Google OAuth scope for Drive listing. Re-authorize with scopes: ` +
            `https://www.googleapis.com/auth/documents.readonly and https://www.googleapis.com/auth/drive.metadata.readonly`
        );
      }
      throw new Error(`Failed to list Google Docs from Drive: ${detail}`);
    }

    const files = Array.isArray(body?.files) ? body.files : [];
    for (const file of files) {
      const id = String(file?.id || '').trim();
      if (!id) continue;
      docs.push({
        id,
        name: String(file?.name || '').trim(),
        modifiedTime: String(file?.modifiedTime || '').trim(),
        createdTime: String(file?.createdTime || '').trim()
      });
      if (maxDocs > 0 && docs.length >= maxDocs) {
        stop = true;
        break;
      }
    }

    if (stop) break;
    pageToken = String(body?.nextPageToken || '').trim();
    if (!pageToken) break;
  }

  return uniqueById(docs);
}

async function resolveDocEntries(args, loadedEnv, token) {
  const explicitIds = parseDocIdList(args['doc-ids']);
  if (explicitIds.length > 0) {
    return {
      source: 'explicit',
      entries: uniqueById(explicitIds.map((id) => ({ id })))
    };
  }

  if (String(args['use-legacy-doc-ids'] || '').trim() === '1') {
    return {
      source: 'legacy',
      entries: uniqueById(LEGACY_DOC_IDS.map((id) => ({ id })))
    };
  }

  const driveQuery = String(args['drive-query'] || process.env.GOOGLE_DOCS_DRIVE_QUERY || loadedEnv.GOOGLE_DOCS_DRIVE_QUERY || '').trim();
  const maxDocs = parsePositiveInt(args['max-docs'] || process.env.GOOGLE_DOCS_MAX_DOCS || loadedEnv.GOOGLE_DOCS_MAX_DOCS, 0);
  const pageSize = parsePositiveInt(args['drive-page-size'] || process.env.GOOGLE_DOCS_DRIVE_PAGE_SIZE || loadedEnv.GOOGLE_DOCS_DRIVE_PAGE_SIZE, 200);

  const entries = await listGoogleDocsFromDrive(token, {
    query: driveQuery,
    maxDocs,
    pageSize
  });

  if (entries.length === 0) {
    throw new Error('No Google Docs returned from Drive listing. Check OAuth account and query filters.');
  }

  return {
    source: 'drive',
    entries
  };
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTextAndImageRefs(docJson) {
  const chunks = [];
  const imageRefs = [];

  function walk(content) {
    if (!Array.isArray(content)) return;

    for (const node of content) {
      if (node?.paragraph?.elements) {
        for (const el of node.paragraph.elements) {
          const text = el?.textRun?.content;
          if (text) chunks.push(text);
          const inlineId = el?.inlineObjectElement?.inlineObjectId;
          if (inlineId) imageRefs.push(inlineId);
        }
      }

      if (Array.isArray(node?.table?.tableRows)) {
        for (const row of node.table.tableRows) {
          for (const cell of row.tableCells || []) {
            walk(cell.content || []);
          }
        }
      }

      if (node?.tableOfContents?.content) {
        walk(node.tableOfContents.content);
      }
    }
  }

  walk(docJson?.body?.content || []);
  return { text: normalizeText(chunks.join('')), imageRefs };
}

function getImageUri(docJson, inlineObjectId) {
  const obj = docJson?.inlineObjects?.[inlineObjectId]?.inlineObjectProperties?.embeddedObject;
  const props = obj?.imageProperties;
  return String(props?.contentUri || props?.sourceUri || '').trim();
}

function mimeToExt(mime, url) {
  const clean = String(mime || '').split(';')[0].trim().toLowerCase();
  if (clean === 'image/jpeg' || clean === 'image/jpg') return '.jpg';
  if (clean === 'image/png') return '.png';
  if (clean === 'image/webp') return '.webp';
  if (clean === 'image/gif') return '.gif';

  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      return ext === '.jpeg' ? '.jpg' : ext;
    }
  } catch {
    // noop
  }

  return '.jpg';
}

async function downloadImage(url, token) {
  let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) response = await fetch(url);
  if (!response.ok) throw new Error(`image download failed (${response.status})`);

  const bytes = Buffer.from(await response.arrayBuffer());
  const mime = response.headers.get('content-type') || '';
  return { bytes, mime };
}

async function extractImagesForDoc(docId, docJson, token) {
  await fs.mkdir(IMAGE_STATIC_DIR, { recursive: true });

  const refs = [];
  const seen = new Set();
  const extracted = extractTextAndImageRefs(docJson);
  for (const ref of extracted.imageRefs) {
    if (!seen.has(ref)) {
      seen.add(ref);
      refs.push(ref);
    }
  }

  const images = [];

  for (let i = 0; i < refs.length; i += 1) {
    const uri = getImageUri(docJson, refs[i]);
    if (!uri) continue;

    try {
      const { bytes, mime } = await downloadImage(uri, token);
      const ext = mimeToExt(mime, uri);
      const filename = `${docId}-${String(i + 1).padStart(2, '0')}${ext}`;
      const outPath = path.join(IMAGE_STATIC_DIR, filename);
      await fs.writeFile(outPath, bytes);
      images.push(`/assets/recipe-images/${filename}`);
    } catch (error) {
      process.stderr.write(`Warning: ${docId} image ${i + 1} skipped (${error.message})\n`);
    }
  }

  return { images, text: extracted.text };
}

function canonicalDocUrl(docId) {
  return `https://docs.google.com/document/d/${docId}/edit`;
}

function extractUrls(text) {
  const matches = text.match(URL_RE) || [];
  const normalized = matches
    .map((url) => url.replace(/[),.;!?]+$/g, ''))
    .filter(Boolean);

  return [...new Set(normalized)];
}

function pickOriginalUrl(urls) {
  const blockedHosts = ['docs.google.com', 'drive.google.com', 'accounts.google.com', 'lh3.googleusercontent.com', 'blogger.googleusercontent.com'];

  const preferred = urls.filter((url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return !blockedHosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
    } catch {
      return false;
    }
  });

  return preferred[0] || urls[0] || '';
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function inferCategory(text, dictionary, fallback) {
  let best = fallback;
  let scoreBest = 0;
  for (const [category, words] of Object.entries(dictionary)) {
    let score = 0;
    for (const word of words) {
      if (text.includes(word)) score += 1;
    }
    if (score > scoreBest) {
      scoreBest = score;
      best = category;
    }
  }
  return best;
}

function titleFromDocName(name, text) {
  const cleanName = String(name || '').trim().replace(/^Chief Fafa\s*-\s*/i, '').trim();
  if (cleanName) return cleanName;

  const firstLine = String(text || '').split('\n').map((line) => line.trim()).find(Boolean);
  return firstLine || 'Untitled Recipe';
}

function summaryFromText(text) {
  const firstParagraph = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !/^https?:\/\//i.test(line));

  if (!firstParagraph) return 'Recipe imported from Google Doc.';
  return firstParagraph.slice(0, 600);
}

function stripListPrefix(line) {
  return String(line || '')
    .replace(/^\s*[-*•]+\s*/, '')
    .replace(/^\s*\(?[0-9]{1,3}\)?[.)、:：]\s+/, '')
    .trim();
}

function cleanFieldValue(value) {
  return String(value || '')
    .replace(/^[\s:：\-–—]+/, '')
    .replace(/[|｜]+$/g, '')
    .replace(/[，,;；。.\s]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80);
}

function firstFieldMatch(candidates, patterns) {
  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const match = candidate.match(pattern);
      if (!match || !match[1]) continue;
      const value = cleanFieldValue(match[1]);
      if (value) return value;
    }
  }
  return '';
}

function extractRecipeFields(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => stripListPrefix(line))
    .filter(Boolean);

  const candidates = [];
  const seen = new Set();
  const pushCandidate = (value) => {
    const clean = cleanFieldValue(value);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(clean);
  };

  for (const line of lines) {
    pushCandidate(line);
    for (const segment of line.split(/[|｜•●]/)) {
      pushCandidate(segment);
    }
  }
  pushCandidate(String(text || '').replace(/\n+/g, ' | '));

  const prepTime = firstFieldMatch(candidates, FIELD_PATTERNS.prepTime);
  const cookTime = firstFieldMatch(candidates, FIELD_PATTERNS.cookTime);
  const totalTime = firstFieldMatch(candidates, FIELD_PATTERNS.totalTime);
  const servings = firstFieldMatch(candidates, FIELD_PATTERNS.servings);

  return { prepTime, cookTime, totalTime, servings };
}

function durationToMinutes(amount, unit) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const u = String(unit || '').toLowerCase();
  if (u.includes('hour') || u === 'hr' || u === 'hrs' || u === 'h' || u.includes('小時') || u.includes('小时') || u.includes('鐘頭') || u.includes('钟头')) {
    return Math.round(n * 60);
  }
  return Math.round(n);
}

function extractLineDurationMinutes(line) {
  const text = String(line || '');
  let total = 0;
  let matched = false;

  for (const match of text.matchAll(DURATION_RANGE_RE)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    const unit = match[3];
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const avg = (start + end) / 2;
    total += durationToMinutes(avg, unit);
    matched = true;
  }

  // Prevent double counting ranges when single-value regex also matches their tail.
  const scrubbed = text.replace(DURATION_RANGE_RE, ' ');
  for (const match of scrubbed.matchAll(DURATION_SINGLE_RE)) {
    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount)) continue;
    total += durationToMinutes(amount, unit);
    matched = true;
  }

  if (/\bovernight\b/i.test(text)) {
    total += 8 * 60;
    matched = true;
  }

  return matched ? total : 0;
}

function formatDuration(minutes) {
  const rounded = Math.max(0, Math.round(minutes / 5) * 5);
  if (rounded <= 0) return '';
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

function inferTimeFields(text, instructions) {
  const lines = [];
  const seen = new Set();

  const pushLine = (value) => {
    const clean = String(value || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(clean);
  };

  const instructionLines = Array.isArray(instructions)
    ? instructions.filter((item) => {
        const clean = String(item || '').trim();
        return clean && !/^see source url for full method\.?$/i.test(clean);
      })
    : [];

  if (instructionLines.length > 0) {
    for (const item of instructionLines) {
      pushLine(item);
    }
  } else {
    for (const line of String(text || '').split('\n')) {
      const clean = stripListPrefix(line);
      if (!clean) continue;
      if (clean.length > 220) continue;
      if (/\d/.test(clean) && /(min|minute|hour|hr|分鐘|分钟|小時|小时|overnight)/i.test(clean)) {
        pushLine(clean);
      }
    }
  }

  let prepMinutes = 0;
  let cookMinutes = 0;
  let restMinutes = 0;

  for (const line of lines) {
    const minutes = extractLineDurationMinutes(line);
    if (minutes <= 0) continue;

    if (COOK_TIME_HINT_RE.test(line)) {
      cookMinutes += minutes;
      continue;
    }
    if (REST_TIME_HINT_RE.test(line)) {
      restMinutes += minutes;
      continue;
    }
    prepMinutes += minutes;
  }

  if (prepMinutes === 0 && lines.length > 0 && (cookMinutes > 0 || restMinutes > 0)) {
    const estimated = Math.min(40, Math.max(10, Math.round((lines.length * 2) / 5) * 5));
    prepMinutes = estimated;
  }

  const totalMinutes = prepMinutes + cookMinutes + restMinutes;

  return {
    prepTime: formatDuration(prepMinutes),
    cookTime: formatDuration(cookMinutes),
    totalTime: formatDuration(totalMinutes)
  };
}

function ingredientsFromText(text) {
  const lines = String(text || '').split('\n').map((line) => line.trim());
  const out = [];
  let inSection = false;

  for (const line of lines) {
    if (/^(ingredients?|材料|食材)(?:\s*[:：]|\s+|$)/i.test(line)) {
      inSection = true;
      continue;
    }
    if (/^(instructions?|method|steps?|directions?|做法|作法|手順|作り方)(?:\s*[:：]|\s+|$)/i.test(line)) {
      if (inSection) break;
      continue;
    }
    if (!inSection) continue;

    const cleaned = stripListPrefix(line);
    if (cleaned) out.push(cleaned);
    if (out.length >= 60) break;
  }

  if (out.length === 0) return ['See source URL for full ingredients list.'];
  return out;
}

function instructionsFromText(text) {
  const lines = String(text || '').split('\n').map((line) => line.trim());
  const out = [];
  let inSection = false;

  for (const line of lines) {
    if (/^(instructions?|method|steps?|directions?|做法|作法|手順|作り方)(?:\s*[:：]|\s+|$)/i.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;

    const cleaned = stripListPrefix(line);
    if (cleaned) out.push(cleaned);
    if (out.length >= 60) break;
  }

  if (out.length === 0) return ['See source URL for full method.'];
  return out;
}

async function fetchDoc(docId, token) {
  const url = `${GOOGLE_DOCS_API_BASE}/${encodeURIComponent(docId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message || `docs api error (${response.status})`;
    throw new Error(detail);
  }
  return body;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loadedEnv = await loadEnv(args);
  const token = await resolveDocsAccessToken(loadedEnv);

  const resolved = await resolveDocEntries(args, loadedEnv, token);
  const docEntries = resolved.entries;
  const docIds = docEntries.map((entry) => entry.id);
  process.stdout.write(`Discovered ${docIds.length} Google Docs (source: ${resolved.source}).\n`);

  const report = [];
  const recipes = [];

  for (let index = 0; index < docEntries.length; index += 1) {
    const entry = docEntries[index];
    const docId = entry.id;
    process.stdout.write(`Processing ${index + 1}/${docEntries.length}: ${docId}...\n`);

    try {
      const docJson = await fetchDoc(docId, token);
      const { images, text } = await extractImagesForDoc(docId, docJson, token);
      const urls = extractUrls(text);
      const originalUrl = pickOriginalUrl(urls);

      const title = titleFromDocName(docJson.title, text);
      const summary = summaryFromText(text);
      const searchable = `${title} ${summary} ${text}`.toLowerCase();
      const fields = extractRecipeFields(text);
      const instructions = instructionsFromText(text);
      const inferredTimes = inferTimeFields(text, instructions);

      report.push({
        status: 'ok',
        docId,
        listedName: entry.name || '',
        listedModifiedTime: entry.modifiedTime || '',
        title: docJson.title || '',
        googleDocUrl: canonicalDocUrl(docId),
        originalUrl,
        images,
        candidateUrls: urls.slice(0, 30)
      });

      recipes.push({
        title,
        slug: slugify(title) || docId.toLowerCase(),
        summary,
        cuisine: inferCategory(searchable, CUISINE_KEYWORDS, 'Global'),
        type: inferCategory(searchable, TYPE_KEYWORDS, 'Main Course'),
        prepTime: fields.prepTime || inferredTimes.prepTime || 'TBD',
        cookTime: fields.cookTime || inferredTimes.cookTime || 'TBD',
        totalTime: fields.totalTime || inferredTimes.totalTime || 'TBD',
        servings: fields.servings || 'TBD',
        ingredients: ingredientsFromText(text),
        instructions,
        tags: [],
        image: images[0] || '',
        sourceUrl: originalUrl,
        googleDocUrl: canonicalDocUrl(docId)
      });
    } catch (error) {
      const message = error?.message || 'unknown error';
      process.stderr.write(`Warning: ${docId} skipped (${message})\n`);
      report.push({
        status: 'error',
        docId,
        listedName: entry.name || '',
        listedModifiedTime: entry.modifiedTime || '',
        googleDocUrl: canonicalDocUrl(docId),
        error: message
      });
    }
  }

  if (recipes.length === 0) {
    throw new Error('No recipe documents were processed successfully.');
  }

  const recipePayload = {
    site: {
      title: "Chief Fafa's Recipe",
      description: 'Modern, searchable recipe collection with auto-categorized cuisine and meal types.',
      generatedAt: new Date().toISOString(),
      source: `google-doc-${resolved.source}:${docIds.length}`,
      sourceType: resolved.source === 'drive' ? 'docs-api-drive-list' : 'docs-api-batch',
      discoveredDocCount: docIds.length,
      processedDocCount: recipes.length,
      skippedDocCount: report.filter((item) => item.status === 'error').length,
      locales: ['en', 'zh-Hant', 'ja']
    },
    recipes
  };

  await fs.mkdir(path.dirname(OUTPUT_REPORT), { recursive: true });
  await fs.writeFile(OUTPUT_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  await fs.mkdir(path.dirname(OUTPUT_RECIPES), { recursive: true });
  await fs.writeFile(OUTPUT_RECIPES, `${JSON.stringify(recipePayload, null, 2)}\n`, 'utf8');

  process.stdout.write(`Wrote ${report.length} doc records to ${OUTPUT_REPORT}\n`);
  process.stdout.write(`Wrote ${recipes.length} recipes to ${OUTPUT_RECIPES}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
