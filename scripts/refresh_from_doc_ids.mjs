#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_EXTERNAL_ENV = '/Users/felixlee/Documents/ChiefFaFaBot/.env';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DOCS_API_BASE = 'https://docs.googleapis.com/v1/documents';
const GOOGLE_DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DRIVE_EXPORT_API = 'https://www.googleapis.com/drive/v3/files';
const OPENAI_CHAT_COMPLETIONS_API = 'https://api.openai.com/v1/chat/completions';
const IMAGE_STATIC_DIR = path.resolve('static/assets/recipe-images');
const OUTPUT_RECIPES = path.resolve('data/recipes.json');
const OUTPUT_REPORT = path.resolve('data/doc-assets.json');
const SUPPORTED_LOCALES = ['en', 'zh-Hant', 'ja'];

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
const YOUTUBE_HOST_RE = /(?:^|\.)youtube\.com$|(?:^|\.)youtu\.be$/i;
const INSTAGRAM_HOST_RE = /(?:^|\.)instagram\.com$/i;
const COOK_TIME_HINT_RE = /\b(?:bake|roast|boil|simmer|fry|steam|grill|cook|preheat|烤|煮|炸|蒸|炒|焗|炆|煎)\b/i;
const REST_TIME_HINT_RE = /\b(?:rest|chill(?:ed|ing)?|cool|freeze|marinate|proof|soak|steep|overnight|refrigerate|fridge|冷藏|冷凍|冷冻|放涼|放凉|靜置|静置|浸泡|醃|腌|發酵|发酵)\b/i;
const COMMENT_SECTION_START_RE =
  /(?:^\s*\d+\s+comments?\s*$|\b(?:leave a comment|post a comment|view comments?)\b|(?:發佈留言|发表评论|留言|評論|评论|回覆|回應|回应))/i;
const SOCIAL_SHARE_RE =
  /(?:blogthis|share this|share on|share to|email this|pin(?:terest)?|facebook|twitter|分享至|分享到|以電子郵件傳送這篇文章|回覆\s*刪除|回复\s*删除)/i;
const SOURCE_PROMO_LINE_RE =
  /(?:\b(?:facebook|instagram|tiktok|twitter|x\.com|pinterest|wechat|whatsapp|telegram|patreon|subscribe|follow|support my|recipe book|sponsor(?:ed)?|special thanks|learn more|social media)\b|(?:歡迎合作|合作洽詢|聯絡方式|联系方式))/i;
const COMMENT_AUTHOR_RE =
  /^[\w\u3400-\u9fff][\w\u3400-\u9fff .,'’\-]{0,48}\s+\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日.*$/u;
const COMMENT_BODY_RE = /\b(?:thanks for sharing|great post|anonymous said|留下評論|发表留言)\b/i;
const INGREDIENT_SECTION_ANY_RE = /(?:ingredients?|材料|食材)(?:\s*\([^)]*\))?\s*[:：]?/i;
const INGREDIENT_SECTION_LINE_RE = /^(ingredients?|材料|食材)(?:\s*\([^)]*\))?\s*[:：]?/i;
const INSTRUCTION_SECTION_LINE_RE = /^(instructions?|method|steps?|directions?|做法|作法|手順|作り方)(?:\s*[:：]|\s+|$)/i;
const INGREDIENT_STOP_INLINE_RE = /(?:\b(?:instructions?|method|steps?|directions?)\b|做法|作法|手順|作り方|https?:\/\/|#[\p{L}\p{N}_-]+)/iu;
const INGREDIENT_INLINE_ITEM_RE =
  /([A-Za-z\u00C0-\u024F\u3400-\u9fff][A-Za-z0-9\u00C0-\u024F\u3400-\u9fff'’()\/,&.+\- ]{0,72}?)\s*(\d+(?:\.\d+)?)\s*(kg|g|mg|ml|l|cc|oz|lb|lbs|tbsp|tsp|cups?|pcs?|pc|克|公斤|毫升|公升|茶匙|湯匙|汤匙|大匙|小匙|條|条|隻|只|個|个|片|塊|块|顆|颗|粒)/giu;
const INGREDIENT_PLACEHOLDER_RE =
  /^(?:not clearly detected from source\.?|see source url for full ingredients list\.?|n\/a|none|tbd)$/i;
const METHOD_PLACEHOLDER_RE = /^(?:see source url for full method\.?|n\/a|none|tbd)$/i;
const TITLE_PLACEHOLDER_RE =
  /(?:<\s*image[^>]*>|image[_\s-]*attachment(?:_here)?|__\s*chief[_\s-]*fafa[_\s-]*payload\s*__|chief[_\s-]*fafa[_\s-]*payload|\[\[image:[^\]]+\]\]|["']?__\w+__["']?)/i;
const TITLE_LABEL_RE =
  /^(?:recipe\s*title|title|dish\s*name|recipe\s*name|recipe\s*heading|食譜標題|食谱标题|標題|标题)\s*[:：]\s*/i;
const TITLE_STOP_RE =
  /^(?:chief\s*fafa\s*recipe\s*note|recipe\s*note|untitled\s*recipe|video\s*(?:title|description)|see source url.*|not clearly detected from source.*|ingredients?|instructions?|method|steps?|\(?not provided.*\)?|recipe submitted as text|direct text input|source type|input source|text input|n\/a|none)$/i;
const TITLE_STEP_LINE_RE = /^(?:\(?[0-9]{1,3}\)?[.)、:：]|step\s*[0-9]+|第\s*[0-9]+\s*步)/i;
const TITLE_META_LINE_RE =
  /^(?:original\s*page\s*url|source\s*url|page\s*url|google\s*doc(?:ument)?\s*url|reference\s*url|video\s*url|media\s*url|recipe\s*title|author|description|caption|source\s*type|input\s*source|language|lang|cuisine|type|category)(?:\s*[:：].*)?$/i;
const TITLE_META_VALUE_RE =
  /^(?:global|chinese|japanese|korean|thai|filipino|indian|italian|french|mexican|mediterranean|american|dessert|dinner|lunch|breakfast|snack|appetizer|soup|salad|beverage|main course|english|en|ja|zh(?:-hant)?|繁體中文|日本語)$/i;
const TITLE_INGREDIENT_MEASURE_RE =
  /\b[0-9]+(?:\.[0-9]+)?\s*(?:kg|g|mg|ml|l|cc|oz|lb|lbs|tbsp|tsp|cups?|pcs?|pc|克|公斤|毫升|公升|茶匙|湯匙|汤匙|大匙|小匙|條|条|隻|只|個|个|片|塊|块|顆|颗|粒)\b/i;
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
const INGREDIENT_MEASURE_TOKEN_RE =
  /\b(?:kg|g|mg|ml|l|cc|oz|lb|lbs|tbsp|tsp|cups?|pcs?|pc|克|公斤|毫升|公升|茶匙|湯匙|汤匙|大匙|小匙|條|条|隻|只|個|个|片|塊|块|顆|颗|粒)\b/i;

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

function normalizeLocale(value, fallback = 'en') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;

  if (raw === 'en' || raw.startsWith('en-') || raw.includes('english')) return 'en';
  if (raw === 'ja' || raw.startsWith('ja-') || raw.includes('japanese') || raw.includes('日本')) return 'ja';
  if (
    raw === 'zh' ||
    raw.startsWith('zh-') ||
    raw.includes('chinese') ||
    raw.includes('繁體') ||
    raw.includes('繁体') ||
    raw.includes('traditional chinese')
  ) {
    return 'zh-Hant';
  }

  return fallback;
}

function parseBoolean(value, fallback = false) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
  return fallback;
}

function scriptCounts(text) {
  const sample = String(text || '').slice(0, 8000);
  const hiraKata = (sample.match(/[\u3040-\u30ff]/g) || []).length;
  const cjk = (sample.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  return { hiraKata, cjk, latin };
}

function detectRecipeLanguage({ title = '', summary = '', ingredients = [], instructions = [], rawText = '' }) {
  const sample = [title, summary, ...ingredients.slice(0, 20), ...instructions.slice(0, 20), rawText.slice(0, 3000)]
    .join('\n')
    .trim();

  if (!sample) return 'en';

  const counts = scriptCounts(sample);
  if (counts.hiraKata >= 3) return 'ja';

  if (counts.cjk > 0) {
    const jpHints = (sample.match(/(?:の|です|ます|ません|材料|作り方|手順|しょうゆ|みりん|ごま|にんにく|ねぎ|レシピ|料理)/g) || []).length;
    const zhHints = (sample.match(/(?:的|了|和|在|把|做法|步驟|步骤|食材|醬|酱|蔥|葱|雞|鸡|豬|猪|分鐘|分钟|小時|小时|料理)/g) || []).length;
    if (jpHints > zhHints) return 'ja';
    return 'zh-Hant';
  }

  if (counts.latin > 0) return 'en';
  return 'en';
}

function resolveTranslationConfig(args, loadedEnv) {
  const explicit = args.translate;
  const enabled =
    explicit === undefined
      ? parseBoolean(process.env.RECIPE_TRANSLATE_ENABLED || loadedEnv.RECIPE_TRANSLATE_ENABLED, true)
      : parseBoolean(explicit, true);

  const apiKey = pickEnv(loadedEnv, ['OPENAI_API_KEY']);
  const model =
    String(args['translate-model'] || process.env.RECIPE_TRANSLATE_MODEL || loadedEnv.RECIPE_TRANSLATE_MODEL || 'gpt-4.1-mini').trim();
  const ocrModel =
    String(args['ocr-model'] || process.env.RECIPE_OCR_MODEL || loadedEnv.RECIPE_OCR_MODEL || model || 'gpt-4.1-mini').trim();

  return {
    enabled,
    apiKey,
    model,
    ocrModel,
    cache: new Map()
  };
}

function localeLabel(locale) {
  if (locale === 'ja') return 'Japanese';
  if (locale === 'zh-Hant') return 'Traditional Chinese';
  return 'English';
}

function safeString(value, fallback = '') {
  const out = String(value || '').trim();
  return out || fallback;
}

function normalizeLineArray(value, fallback = []) {
  if (Array.isArray(value)) {
    const out = value.map((item) => String(item || '').trim()).filter(Boolean);
    if (out.length > 0) return out;
  }
  if (typeof value === 'string') {
    const out = value
      .split(/\r?\n/)
      .map((line) => stripListPrefix(line))
      .map((line) => String(line || '').trim())
      .filter(Boolean);
    if (out.length > 0) return out;
  }
  return Array.isArray(fallback) ? fallback : [];
}

function parseAssistantJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function siteAssetToLocalPath(assetPath) {
  const normalized = String(assetPath || '').trim();
  if (!normalized.startsWith('/assets/')) return '';
  const relative = normalized.replace(/^\//, '');
  return path.resolve(relative.startsWith('assets/') ? `static/${relative}` : `static/assets/${relative}`);
}

async function extractRecipeFromImageWithOpenAI(localImagePath, translationConfig) {
  const apiKey = String(translationConfig?.apiKey || '').trim();
  if (!apiKey || !localImagePath) return null;

  let bytes;
  try {
    bytes = await fs.readFile(localImagePath);
  } catch {
    return null;
  }

  const ext = path.extname(localImagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const dataUri = `data:${mime};base64,${bytes.toString('base64')}`;

  const prompt = [
    'Extract recipe information from this image.',
    'Return ONLY JSON with keys: title, summary, ingredients, instructions.',
    'ingredients and instructions must be arrays of strings.',
    'Do not invent missing content.',
    'If text is not visible, return empty arrays.'
  ].join(' ');

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: translationConfig.ocrModel || translationConfig.model || 'gpt-4.1-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUri } }
          ]
        }
      ]
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message || `ocr request failed (${response.status})`;
    throw new Error(detail);
  }

  const content = body?.choices?.[0]?.message?.content;
  const parsed = parseAssistantJson(content);
  if (!parsed || typeof parsed !== 'object') return null;

  const ingredients = normalizeLineArray(parsed.ingredients, []);
  const instructions = normalizeLineArray(parsed.instructions, []);
  return {
    title: safeString(parsed.title),
    summary: safeString(parsed.summary),
    ingredients,
    instructions
  };
}

async function translateRecipeContent(source, sourceLocale, targetLocale, translationConfig) {
  const sourcePayload = {
    title: safeString(source.title),
    summary: safeString(source.summary),
    ingredients: Array.isArray(source.ingredients) ? source.ingredients.slice(0, 120) : [],
    instructions: Array.isArray(source.instructions) ? source.instructions.slice(0, 120) : []
  };

  if (targetLocale === sourceLocale) {
    return sourcePayload;
  }

  if (!translationConfig.enabled || !translationConfig.apiKey) {
    return sourcePayload;
  }

  const cacheKey = JSON.stringify({ s: sourceLocale, t: targetLocale, p: sourcePayload });
  if (translationConfig.cache.has(cacheKey)) {
    return translationConfig.cache.get(cacheKey);
  }

  const systemPrompt = [
    'You are an expert recipe translator.',
    `Translate from ${localeLabel(sourceLocale)} to ${localeLabel(targetLocale)}.`,
    'Preserve numbers, units, ingredient amounts, and cooking times exactly.',
    'Keep ingredients and instructions as arrays with the same order as input.',
    'Do not invent missing details.',
    'Return ONLY valid JSON with keys: title, summary, ingredients, instructions.'
  ].join(' ');

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${translationConfig.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: translationConfig.model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            source_language: sourceLocale,
            target_language: targetLocale,
            recipe: sourcePayload
          })
        }
      ]
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message || `translation request failed (${response.status})`;
    throw new Error(detail);
  }

  const content = body?.choices?.[0]?.message?.content;
  const parsed = parseAssistantJson(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('translation response is not valid JSON');
  }

  const translated = {
    title: safeString(parsed.title, sourcePayload.title),
    summary: safeString(parsed.summary, sourcePayload.summary),
    ingredients: normalizeLineArray(parsed.ingredients, sourcePayload.ingredients),
    instructions: normalizeLineArray(parsed.instructions, sourcePayload.instructions)
  };

  if (!translated.title) translated.title = sourcePayload.title;
  if (!translated.summary) translated.summary = sourcePayload.summary;
  if (translated.ingredients.length === 0) translated.ingredients = sourcePayload.ingredients;
  if (translated.instructions.length === 0) translated.instructions = sourcePayload.instructions;

  translationConfig.cache.set(cacheKey, translated);
  return translated;
}

async function buildRecipeTranslations(recipe, sourceLocale, translationConfig) {
  const normalizedSource = normalizeLocale(sourceLocale, 'en');
  const sourcePayload = {
    title: safeString(recipe.title),
    summary: safeString(recipe.summary),
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    instructions: Array.isArray(recipe.instructions) ? recipe.instructions : []
  };

  const translations = {};
  for (const locale of SUPPORTED_LOCALES) {
    try {
      translations[locale] = await translateRecipeContent(sourcePayload, normalizedSource, locale, translationConfig);
    } catch (error) {
      process.stderr.write(
        `Warning: translation failed (${normalizedSource} -> ${locale}): ${error?.message || 'unknown error'}\n`
      );
      translations[locale] = sourcePayload;
    }
  }
  return translations;
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

function isCommentOrSocialLine(line) {
  const clean = String(line || '').trim();
  if (!clean) return false;
  if (SOCIAL_SHARE_RE.test(clean)) return true;
  if (COMMENT_AUTHOR_RE.test(clean)) return true;
  if (COMMENT_BODY_RE.test(clean)) return true;
  if (/^(?:匿名|anonymous)$/i.test(clean)) return true;
  if (/^(?:reply|delete|回覆|回复|刪除|删除)$/i.test(clean)) return true;
  return false;
}

function isPromoLine(line) {
  const clean = String(line || '').trim();
  if (!clean) return false;
  return SOURCE_PROMO_LINE_RE.test(clean);
}

function isCommentSectionStart(line) {
  const clean = String(line || '').trim();
  if (!clean) return false;
  if (SOCIAL_SHARE_RE.test(clean)) return true;
  return COMMENT_SECTION_START_RE.test(clean);
}

function sanitizeDocumentText(rawText) {
  const lines = normalizeText(rawText).split('\n');
  const out = [];
  let inCommentZone = false;

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line) {
      if (!inCommentZone && out.length > 0 && out[out.length - 1] !== '') {
        out.push('');
      }
      continue;
    }

    if (inCommentZone) continue;
    if (isCommentSectionStart(line)) {
      inCommentZone = true;
      continue;
    }
    if (isCommentOrSocialLine(line)) continue;
    out.push(line);
  }

  return normalizeText(out.join('\n'));
}

function normalizeIngredientName(value) {
  let out = String(value || '')
    .replace(/^\s*[:：,，;；.\-–—()（）\[\]]+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:ingredients?|material)\b/gi, '')
    .replace(/(?:材料|食材)\s*$/u, '');

  // Keep only the ingredient token when a previous note leaks before ")".
  if (out.includes(')')) {
    const tail = out.split(')').pop()?.trim();
    if (tail) out = tail;
  }

  out = out.replace(/^\([^)]*\)\s*/, '').trim();
  return out;
}

function extractIngredientItemsFromSegment(segment) {
  const clean = String(segment || '')
    .replace(/\r?\n/g, ' ')
    .replace(URL_RE, ' ')
    .replace(/#[\p{L}\p{N}_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];

  const out = [];
  const seen = new Set();

  for (const match of clean.matchAll(INGREDIENT_INLINE_ITEM_RE)) {
    const rawName = normalizeIngredientName(match[1]);
    const qty = String(match[2] || '').trim();
    const unit = String(match[3] || '').trim();

    if (!rawName || !qty || !unit) continue;
    if (rawName.length > 80) continue;
    if (isCommentOrSocialLine(rawName)) continue;
    if (INGREDIENT_PLACEHOLDER_RE.test(rawName)) continue;

    const item = `${rawName} ${qty}${unit}`.replace(/\s+/g, ' ').trim();
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
    if (out.length >= 80) break;
  }

  return out;
}

function extractIngredientSegment(text) {
  const raw = String(text || '');
  const start = raw.match(INGREDIENT_SECTION_ANY_RE);
  if (!start || start.index === undefined) return '';

  let segment = raw.slice(start.index + start[0].length);
  const stop = segment.search(INGREDIENT_STOP_INLINE_RE);
  if (stop >= 0) {
    segment = segment.slice(0, stop);
  }

  return segment.trim();
}

function extractTextAndImageRefs(docJson) {
  const chunks = [];
  const imageRefs = [];
  const inlineObjectMaps = [];
  const contentBlocks = [];

  function addDocumentContent(docNode) {
    const content = docNode?.body?.content;
    if (Array.isArray(content) && content.length > 0) {
      contentBlocks.push(content);
    }
    if (docNode?.inlineObjects && typeof docNode.inlineObjects === 'object') {
      inlineObjectMaps.push(docNode.inlineObjects);
    }
  }

  function walkTabs(tabs) {
    if (!Array.isArray(tabs)) return;
    for (const tab of tabs) {
      const docTab = tab?.documentTab;
      if (docTab) addDocumentContent(docTab);
      if (Array.isArray(tab?.childTabs) && tab.childTabs.length > 0) {
        walkTabs(tab.childTabs);
      }
    }
  }

  const hasTabs = Array.isArray(docJson?.tabs) && docJson.tabs.length > 0;
  if (hasTabs) {
    walkTabs(docJson.tabs);
    if (contentBlocks.length === 0) {
      addDocumentContent(docJson);
    }
  } else {
    addDocumentContent(docJson);
  }

  if (Array.isArray(docJson?.__extraTabDocs) && docJson.__extraTabDocs.length > 0) {
    for (const extraDoc of docJson.__extraTabDocs) {
      const extraHasTabs = Array.isArray(extraDoc?.tabs) && extraDoc.tabs.length > 0;
      if (extraHasTabs) {
        walkTabs(extraDoc.tabs);
      } else {
        addDocumentContent(extraDoc);
      }
    }
  }

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

  for (const block of contentBlocks) {
    walk(block);
  }

  return { text: normalizeText(chunks.join('')), imageRefs, inlineObjectMaps };
}

function getImageUri(inlineObjectMaps, inlineObjectId) {
  for (const map of inlineObjectMaps || []) {
    const obj = map?.[inlineObjectId]?.inlineObjectProperties?.embeddedObject;
    const props = obj?.imageProperties;
    const uri = String(props?.contentUri || props?.sourceUri || '').trim();
    if (uri) return uri;
  }
  return '';
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

async function exportDocPlainText(docId, token) {
  const mimeType = encodeURIComponent('text/plain');
  const url = `${GOOGLE_DRIVE_EXPORT_API}/${encodeURIComponent(docId)}/export?mimeType=${mimeType}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const detail = body ? body.slice(0, 240) : `export api error (${response.status})`;
    throw new Error(detail);
  }

  return normalizeText(await response.text());
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
    const uri = getImageUri(extracted.inlineObjectMaps, refs[i]);
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

function extractDocIdFromUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return match ? match[1] : '';
}

async function loadExistingRecipeByDocId() {
  try {
    const raw = await fs.readFile(OUTPUT_RECIPES, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.recipes) ? parsed.recipes : [];
    const map = new Map();
    for (const item of list) {
      const docId = extractDocIdFromUrl(item?.googleDocUrl);
      if (!docId) continue;
      map.set(docId, item);
    }
    return map;
  } catch {
    return new Map();
  }
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

function isYoutubeUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    return YOUTUBE_HOST_RE.test(host);
  } catch {
    return false;
  }
}

function isInstagramUrl(url) {
  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    return INSTAGRAM_HOST_RE.test(host);
  } catch {
    return false;
  }
}

function normalizeInstagramUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!isInstagramUrl(u.href)) return String(url || '').trim();
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/+$/, '/');
  } catch {
    return String(url || '').trim();
  }
}

function decodeJsonEscaped(value) {
  const raw = String(value || '');
  if (!raw) return '';
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

function extractYoutubeDescriptionFromHtml(html) {
  const raw = String(html || '');
  if (!raw) return '';

  const shortDescMatch = raw.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  if (shortDescMatch && shortDescMatch[1]) {
    return decodeJsonEscaped(shortDescMatch[1]).trim();
  }

  const descMatch = raw.match(/"description"\s*:\s*\{"simpleText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (descMatch && descMatch[1]) {
    return decodeJsonEscaped(descMatch[1]).trim();
  }

  return '';
}

function extractInstagramCaptionFromOembed(raw) {
  const body = String(raw || '').trim();
  if (!body) return '';

  try {
    const parsed = JSON.parse(body);
    const title = String(parsed?.title || '').trim();
    if (title) return title;
  } catch {
    // Fallback: sometimes the payload may be prefixed/noisy.
  }

  const titleMatch = body.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (titleMatch && titleMatch[1]) {
    return decodeJsonEscaped(titleMatch[1]).trim();
  }

  return '';
}

async function fetchInstagramDescription(sourceUrl) {
  const normalized = normalizeInstagramUrl(sourceUrl);
  if (!normalized) return '';

  const endpoint = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(normalized)}`;
  const response = await fetch(endpoint, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*'
    }
  });
  if (!response.ok) {
    throw new Error(`instagram oembed request failed (${response.status})`);
  }
  const payload = await response.text();
  const caption = extractInstagramCaptionFromOembed(payload);
  return normalizeText(
    caption
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t')
  );
}

async function fetchSourceDescription(sourceUrl) {
  if (isInstagramUrl(sourceUrl)) {
    return fetchInstagramDescription(sourceUrl);
  }
  if (!isYoutubeUrl(sourceUrl)) return '';

  const response = await fetch(sourceUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(`source page request failed (${response.status})`);
  }

  const html = await response.text();
  return normalizeText(
    extractYoutubeDescriptionFromHtml(html)
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t')
  );
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

function cleanTitleCandidate(value) {
  return String(value || '')
    .replace(/^Chief Fafa\s*-\s*/i, '')
    .replace(/^#{1,3}\s+/, '')
    .replace(TITLE_LABEL_RE, '')
    .replace(/^\s*[-*•]+\s*/, '')
    .replace(/^\s*["'“”‘’`]+|["'“”‘’`]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isUsableRecipeTitle(title) {
  const clean = cleanTitleCandidate(title);
  if (!clean) return false;
  if (clean.length < 3 || clean.length > 140) return false;
  if (!/[\p{L}\p{N}]/u.test(clean)) return false;
  if (/^https?:\/\//i.test(clean)) return false;
  if (TITLE_PLACEHOLDER_RE.test(clean)) return false;
  if (TITLE_STOP_RE.test(clean)) return false;
  if (looksLikeMetadataValue(clean)) return false;
  if (TITLE_STEP_LINE_RE.test(clean)) return false;
  if (isCommentOrSocialLine(clean) || isCommentSectionStart(clean)) return false;
  if (INGREDIENT_SECTION_LINE_RE.test(clean) || INSTRUCTION_SECTION_LINE_RE.test(clean)) return false;
  if (TITLE_INGREDIENT_MEASURE_RE.test(clean) && /\d/.test(clean)) return false;
  return true;
}

function looksLikeMetadataValue(value) {
  const clean = cleanTitleCandidate(value);
  if (!clean) return true;
  if (TITLE_META_LINE_RE.test(clean)) return true;
  if (TITLE_META_VALUE_RE.test(clean)) return true;
  if (/^\(?.{0,56}(?:not provided|unavailable|missing|n\/a).{0,56}\)?$/i.test(clean)) return true;
  if (/^[\p{L}\p{N}\s/-]{1,48}[:：]$/u.test(clean)) return true;
  if (/\b(?:source|url|language|cuisine|category|type|image|attachment|payload|detected|input)\b/i.test(clean) && clean.split(/\s+/).length <= 8) {
    return true;
  }
  return false;
}

function titleFromText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (TITLE_STEP_LINE_RE.test(line)) continue;
    const clean = cleanTitleCandidate(line.replace(/^\s*[-*•]+\s*/, ''));
    if (isUsableRecipeTitle(clean)) return clean;
  }
  return '';
}

function inferTitleFromIngredients(ingredients, text) {
  const textBlob = `${String(text || '')} ${Array.isArray(ingredients) ? ingredients.join(' ') : ''}`;
  const lowerBlob = textBlob.toLowerCase();

  const knownDishes = [
    { re: /sea\s*cucumber|海參/iu, label: 'Sea Cucumber' },
    { re: /turnip\s*cake|蘿蔔糕|萝卜糕/iu, label: 'Turnip Cake' },
    { re: /cheesecake|芝士蛋糕|起司蛋糕/iu, label: 'Cheesecake' },
    { re: /sponge\s*cake|棉花蛋糕|海綿蛋糕|海绵蛋糕/iu, label: 'Sponge Cake' },
    { re: /fried\s*noodles?|炒麵|炒面/iu, label: 'Fried Noodles' }
  ];

  for (const dish of knownDishes) {
    if (dish.re.test(textBlob)) {
      if (/\bbrais(?:e|ed|ing)\b|炆|燜|焖/iu.test(textBlob)) {
        return `Braised ${dish.label}`;
      }
      return `${dish.label} Recipe`;
    }
  }

  const genericIngredients = new Set([
    'salt',
    'sugar',
    'water',
    'oil',
    'soy sauce',
    'dark soy sauce',
    'light soy sauce',
    'stock',
    'chicken stock',
    'pepper',
    'white pepper',
    'black pepper',
    'wine',
    'ginger',
    'garlic',
    'scallion',
    'spring onion',
    'cornstarch',
    'flour',
    'lard',
    'butter',
    'milk',
    'cream',
    'egg',
    'eggs',
    '鹽',
    '盐',
    '糖',
    '水',
    '油',
    '胡椒',
    '黑胡椒',
    '白胡椒',
    '薑',
    '姜',
    '蒜'
  ]);

  let best = '';
  let bestScore = 0;
  for (const item of Array.isArray(ingredients) ? ingredients : []) {
    const clean = cleanTitleCandidate(item)
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!clean || clean.length > 60) continue;
    if (TITLE_PLACEHOLDER_RE.test(clean)) continue;
    if (TITLE_STEP_LINE_RE.test(clean)) continue;
    if (TITLE_INGREDIENT_MEASURE_RE.test(clean) && /\d/.test(clean)) continue;

    const key = clean.toLowerCase();
    if (genericIngredients.has(key)) continue;

    let score = 1;
    if (/sea\s*cucumber|海參|turnip|蘿蔔|萝卜|cake|noodle|麵|面|chicken|beef|pork|shrimp|fish|tofu/iu.test(clean)) {
      score += 4;
    }
    if (lowerBlob.includes(key)) score += 1;
    if (/[A-Za-z]/.test(clean) || /[\u3400-\u9fff]/u.test(clean)) score += 1;
    if (clean.length >= 4 && clean.length <= 32) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = clean;
    }
  }

  if (best) {
    const english = /^[A-Za-z][A-Za-z\s'’\-]+$/.test(best) ? best.replace(/\b\w/g, (c) => c.toUpperCase()) : best;
    if (/\bbrais(?:e|ed|ing)\b|炆|燜|焖/iu.test(textBlob) && /^[A-Za-z]/.test(english)) {
      return `Braised ${english}`;
    }
    return /^[A-Za-z]/.test(english) ? `${english} Recipe` : `${english} 食譜`;
  }

  return '';
}

function titleFromDocName(name, text, ingredients = []) {
  const cleanName = cleanTitleCandidate(name);
  if (isUsableRecipeTitle(cleanName)) return cleanName;

  const fromText = titleFromText(text);
  if (fromText) {
    const ingredientKeys = new Set(
      (Array.isArray(ingredients) ? ingredients : [])
        .map((item) => cleanTitleCandidate(item).toLowerCase())
        .filter(Boolean)
    );
    if (!ingredientKeys.has(fromText.toLowerCase())) {
      return fromText;
    }
  }

  const fromIngredients = inferTitleFromIngredients(ingredients, text);
  if (fromIngredients) return fromIngredients;

  return 'Untitled Recipe';
}

function summaryFromText(text, ingredients = [], title = '') {
  const ingredientKeys = new Set(
    (Array.isArray(ingredients) ? ingredients : [])
      .map((item) => cleanTitleCandidate(item).toLowerCase())
      .filter(Boolean)
  );
  const titleKey = cleanTitleCandidate(title).toLowerCase();

  const firstParagraph = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => {
      if (!line) return false;
      if (/^https?:\/\//i.test(line)) return false;
      if (isCommentOrSocialLine(line)) return false;
      if (isPromoLine(line)) return false;
      if (TITLE_PLACEHOLDER_RE.test(line) || TITLE_STOP_RE.test(line)) return false;
      if (looksLikeMetadataValue(line) || TITLE_STEP_LINE_RE.test(line)) return false;

      const cleaned = cleanTitleCandidate(stripListPrefix(line)).toLowerCase();
      if (!cleaned) return false;
      if (cleaned === titleKey) return false;
      if (ingredientKeys.has(cleaned)) return false;
      return true;
    });

  if (!firstParagraph) return 'Recipe imported from Google Doc.';
  return firstParagraph.slice(0, 600);
}

function stripListPrefix(line) {
  return String(line || '')
    .replace(/^\s*[-*•]+\s*/, '')
    .replace(/^\s*\(?[0-9]{1,3}\)?[.)、:：]\s+/, '')
    .trim();
}

function normalizeSectionLine(line) {
  return String(line || '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[\s\-*•·▪▫►▶◆◇🔸🔹🔶🔷]+/u, '')
    .replace(/\s+/g, ' ')
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
    .filter((line) => line && !isCommentOrSocialLine(line));

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
      if (isCommentOrSocialLine(item)) continue;
      pushLine(item);
    }
  } else {
    for (const line of String(text || '').split('\n')) {
      const clean = stripListPrefix(line);
      if (!clean) continue;
      if (isCommentOrSocialLine(clean)) continue;
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
  const lines = String(text || '')
    .split('\n')
    .map((line) => normalizeSectionLine(line));
  const out = [];
  const seen = new Set();
  let inSection = false;
  const pushOut = (value) => {
    const clean = stripListPrefix(String(value || '').trim());
    if (!clean || isCommentOrSocialLine(clean)) return;
    if (INGREDIENT_PLACEHOLDER_RE.test(clean)) return;
    if (TITLE_PLACEHOLDER_RE.test(clean)) return;
    if (TITLE_STOP_RE.test(clean)) return;
    if (TITLE_STEP_LINE_RE.test(clean)) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };

  for (const line of lines) {
    if (isCommentSectionStart(line) || isCommentOrSocialLine(line)) {
      if (inSection) break;
      continue;
    }

    if (INGREDIENT_SECTION_LINE_RE.test(line)) {
      inSection = true;
      const remainder = line.replace(INGREDIENT_SECTION_LINE_RE, '').trim();
      if (remainder) {
        const parsedInline = extractIngredientItemsFromSegment(remainder);
        if (parsedInline.length > 0) {
          for (const item of parsedInline) pushOut(item);
        } else {
          pushOut(remainder);
        }
      }
      continue;
    }
    if (INSTRUCTION_SECTION_LINE_RE.test(line)) {
      if (inSection) break;
      continue;
    }
    if (!inSection) continue;

    const parsedInline = extractIngredientItemsFromSegment(line);
    if (parsedInline.length > 0) {
      for (const item of parsedInline) pushOut(item);
    } else {
      pushOut(line);
    }
    if (out.length >= 60) break;
  }

  if (out.length === 0) {
    const inlineFromSection = extractIngredientItemsFromSegment(extractIngredientSegment(text));
    if (inlineFromSection.length >= 3) {
      return inlineFromSection.slice(0, 60);
    }
  }

  // Fallback mode: some docs omit explicit "Ingredients" heading.
  if (out.length === 0) {
    const fallback = [];
    const fallbackSeen = new Set();
    for (const rawLine of lines) {
      const line = stripListPrefix(normalizeSectionLine(rawLine));
      if (!line) continue;
      if (isCommentOrSocialLine(line)) continue;
      if (TITLE_PLACEHOLDER_RE.test(line) || TITLE_STOP_RE.test(line)) continue;
      if (INSTRUCTION_SECTION_LINE_RE.test(line)) continue;
      if (/^https?:\/\//i.test(line)) continue;

      const hasQtyUnit = /\d/.test(line) && INGREDIENT_MEASURE_TOKEN_RE.test(line);
      const hasFractionUnit =
        /\b\d+\s*\/\s*\d+\b/.test(line) && /\b(?:tbsp|tsp|cups?|茶匙|湯匙|汤匙|大匙|小匙)\b/i.test(line);
      const bilingualMeasured = /[\u3400-\u9fff]/u.test(line) && /[A-Za-z]/.test(line) && /\d/.test(line);
      if (!hasQtyUnit && !hasFractionUnit && !bilingualMeasured) continue;

      const key = line.toLowerCase();
      if (fallbackSeen.has(key)) continue;
      fallbackSeen.add(key);
      fallback.push(line);
      if (fallback.length >= 60) break;
    }
    if (fallback.length >= 3) return fallback.slice(0, 60);
  }

  if (out.length === 1 && out[0].length > 160) {
    const parsedInline = extractIngredientItemsFromSegment(out[0]);
    if (parsedInline.length >= 3) {
      return parsedInline.slice(0, 60);
    }
  }

  if (out.length === 0) return ['See source URL for full ingredients list.'];
  return out;
}

function instructionsFromText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => normalizeSectionLine(line));
  const out = [];
  let inSection = false;

  for (const line of lines) {
    if (isCommentSectionStart(line) || isCommentOrSocialLine(line)) {
      if (inSection) break;
      continue;
    }

    if (/^(instructions?|method|steps?|directions?|做法|作法|手順|作り方)(?:\s*[:：]|\s+|$)/i.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;

    const cleaned = stripListPrefix(line);
    if (!cleaned) continue;
    if (TITLE_PLACEHOLDER_RE.test(cleaned)) continue;
    if (TITLE_STOP_RE.test(cleaned)) continue;
    out.push(cleaned);
    if (out.length >= 60) break;
  }

  if (out.length === 0) {
    const numbered = lines
      .map((line) => stripListPrefix(normalizeSectionLine(line)))
      .filter((line) => line && !isCommentOrSocialLine(line))
      .filter((line) => /^\(?[0-9]{1,3}\)?[.)、:：]\s*/.test(line) || /^step\s*[0-9]+/i.test(line));
    if (numbered.length >= 2) {
      return numbered.slice(0, 60);
    }
  }

  if (out.length === 0) return ['See source URL for full method.'];
  return out;
}

function cleanSourceLine(line) {
  return String(line || '')
    .replace(/^[\s\-*•·▪▫►▶◆◇🔸🔹🔶🔷]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ingredientsFromSourceDescription(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => cleanSourceLine(line))
    .filter(Boolean);

  const out = [];
  const seen = new Set();
  let inSection = false;
  let startedByLabel = false;

  for (const rawLine of lines) {
    const line = stripListPrefix(rawLine);
    if (!line) continue;
    if (isCommentOrSocialLine(line)) continue;
    if (/^#[\p{L}\p{N}_-]+(?:\s+#[\p{L}\p{N}_-]+)*$/u.test(line)) continue;
    if (isPromoLine(line)) {
      if (inSection) break;
      continue;
    }
    if (TITLE_PLACEHOLDER_RE.test(line) || TITLE_STOP_RE.test(line)) continue;
    if (/^https?:\/\//i.test(line)) continue;

    if (/^(ingredients?|ingredient list|材料|食材)(?:\s*\([^)]*\))?\s*[:：]?/i.test(line)) {
      inSection = true;
      startedByLabel = true;
      const rest = line.replace(/^(ingredients?|ingredient list|材料|食材)(?:\s*\([^)]*\))?\s*[:：]?/i, '').trim();
      if (rest) {
        const key = rest.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(rest);
        }
      }
      continue;
    }

    if (/^(instructions?|method|steps?|directions?|做法|作法|手順|作り方)(?:\s*[:：]|\s+|$)/i.test(line)) {
      if (inSection) break;
      continue;
    }

    // Fallback mode: collect obvious ingredient-style lines even without heading.
    if (!inSection) {
      if (
        /^([0-9]+(?:[./][0-9]+)?\s*(?:kg|g|mg|ml|l|cc|oz|lb|lbs|tbsp|tsp|cups?|pcs?|pc|克|公斤|毫升|公升|茶匙|湯匙|汤匙|大匙|小匙|條|条|隻|只|個|个|片|塊|块|顆|颗|粒)\b)/i.test(line) ||
        /\b(?:kg|g|mg|ml|l|cc|oz|lb|lbs|tbsp|tsp|cups?|pcs?|pc|克|公斤|毫升|公升|茶匙|湯匙|汤匙|大匙|小匙|條|条|隻|只|個|个|片|塊|块|顆|颗|粒)\b/i.test(line)
      ) {
        inSection = true;
      } else {
        continue;
      }
    }

    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= 80) break;
  }

  if (startedByLabel && out.length === 0) return [];
  return out;
}

function instructionsFromSourceDescription(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => cleanSourceLine(line))
    .filter(Boolean);

  const out = [];
  let inSection = false;

  for (const rawLine of lines) {
    const line = stripListPrefix(rawLine);
    if (!line) continue;
    if (isCommentOrSocialLine(line)) continue;
    if (/^#[\p{L}\p{N}_-]+(?:\s+#[\p{L}\p{N}_-]+)*$/u.test(line)) continue;
    if (isPromoLine(line)) {
      if (inSection) break;
      continue;
    }
    if (TITLE_PLACEHOLDER_RE.test(line) || TITLE_STOP_RE.test(line)) continue;
    if (/^https?:\/\//i.test(line)) continue;

    if (/^(instructions?|method|steps?|directions?|做法|作法|手順|作り方)(?:\s*[:：]|\s+|$)/i.test(line)) {
      inSection = true;
      const rest = line.replace(/^(instructions?|method|steps?|directions?|做法|作法|手順|作り方)(?:\s*[:：]|\s+|$)/i, '').trim();
      if (rest) out.push(rest);
      continue;
    }

    if (inSection) {
      out.push(line);
      if (out.length >= 80) break;
      continue;
    }
  }

  // Fallback: if there is no explicit section, only accept numbered-step lines.
  if (out.length === 0) {
    const numbered = lines
      .map((line) => stripListPrefix(line))
      .filter((line) => /^\(?[0-9]{1,3}\)?[.)、:：]\s*/.test(line) || /^step\s*[0-9]+/i.test(line));
    if (numbered.length >= 2) {
      return numbered.map((line) => stripListPrefix(line)).filter(Boolean).slice(0, 80);
    }
  }

  return out;
}

function isPlaceholderIngredients(items) {
  if (!Array.isArray(items) || items.length === 0) return true;
  if (items.length > 1) return false;
  return INGREDIENT_PLACEHOLDER_RE.test(String(items[0] || '').trim());
}

function isPlaceholderInstructions(items) {
  if (!Array.isArray(items) || items.length === 0) return true;
  if (items.length > 1) return false;
  return METHOD_PLACEHOLDER_RE.test(String(items[0] || '').trim());
}

function isGenericSummary(summary) {
  const clean = String(summary || '').trim();
  if (!clean) return true;
  if (/^video link$/i.test(clean)) return true;
  if (/^recipe imported from google doc\.?$/i.test(clean)) return true;
  if (/^see source url/i.test(clean)) return true;
  return false;
}

function inferRecipeMode(title, type, ingredients) {
  const blob = `${String(title || '')} ${String(type || '')} ${(Array.isArray(ingredients) ? ingredients.join(' ') : '')}`.toLowerCase();
  if (/(cheesecake|sponge|cotton|castella|cake|蛋糕|芝士蛋糕|海綿|海绵|棉花蛋糕)/i.test(blob)) return 'bake-cake';
  if (/(soup|broth|湯|汤|sinigang|ramen|bisque)/i.test(blob)) return 'soup';
  if (/(noodle|炒麵|炒面|麵|面|fried noodle|stir[- ]?fry)/i.test(blob)) return 'stir-fry';
  if (/(salad|沙拉)/i.test(blob)) return 'salad';
  if (/(drink|smoothie|latte|tea|coffee|飲品|饮品)/i.test(blob)) return 'beverage';
  return 'generic';
}

function inferInstructionFallback(title, type, ingredients) {
  if (!Array.isArray(ingredients) || ingredients.length < 2) return [];

  const mode = inferRecipeMode(title, type, ingredients);
  if (mode === 'bake-cake') {
    return [
      'Preheat oven to 150C and line a cake pan with baking paper.',
      'Whisk oil and milk until smooth, then mix in egg yolks and black sesame mixture.',
      'Sift in flour (and starch if used), then fold gently until no dry pockets remain.',
      'Whip egg whites with sugar (and salt if used) to medium peaks.',
      'Fold meringue into batter in 2-3 additions without deflating the foam.',
      'Pour into pan, tap out large bubbles, and bake in a gentle water bath until set.',
      'Cool before unmolding and slice to serve.'
    ];
  }

  if (mode === 'soup') {
    return [
      'Prepare and measure all ingredients; cut proteins and vegetables to bite-size pieces.',
      'Bring base liquid to a simmer and add aromatics to build flavor.',
      'Add vegetables first, then proteins; cook until just done.',
      'Season to taste and simmer briefly to combine flavors.',
      'Serve hot with garnish.'
    ];
  }

  if (mode === 'stir-fry') {
    return [
      'Prepare all ingredients and mix any sauce components before cooking.',
      'Heat wok or pan with oil, then stir-fry aromatics until fragrant.',
      'Cook proteins and vegetables in batches over high heat.',
      'Return everything to the pan, add sauce, and toss until evenly coated.',
      'Adjust seasoning and serve immediately.'
    ];
  }

  if (mode === 'salad') {
    return [
      'Wash and prepare all ingredients, then chill serving bowl if desired.',
      'Combine dressing ingredients and whisk until emulsified.',
      'Toss salad components gently with dressing just before serving.',
      'Adjust seasoning and finish with toppings.'
    ];
  }

  if (mode === 'beverage') {
    return [
      'Prepare and measure all ingredients.',
      'Blend or mix ingredients until smooth and fully combined.',
      'Adjust sweetness and texture to taste.',
      'Serve chilled.'
    ];
  }

  return [
    'Prepare and measure all ingredients before cooking.',
    'Combine ingredients according to recipe order and cook until done.',
    'Adjust seasoning and texture to taste.',
    'Plate and serve.'
  ];
}

function extractionQualityScore({ title = '', summary = '', ingredients = [], instructions = [], text = '' }) {
  let score = 0;
  if (!isPlaceholderIngredients(ingredients)) {
    score += Math.min(Array.isArray(ingredients) ? ingredients.length : 0, 20) * 2;
  }
  if (!isPlaceholderInstructions(instructions)) {
    score += Math.min(Array.isArray(instructions) ? instructions.length : 0, 20) * 2;
  }
  if (!isGenericSummary(summary)) score += 3;
  if (isUsableRecipeTitle(title)) score += 2;
  if (/(?:ingredients?|材料|食材|instructions?|method|steps?|做法|作法|手順|作り方)/i.test(String(text || ''))) {
    score += 1;
  }
  return score;
}

async function fetchDoc(docId, token) {
  const baseVariants = [
    { includeTabsContent: 'true', suggestionsViewMode: 'SUGGESTIONS_INLINE' },
    { suggestionsViewMode: 'SUGGESTIONS_INLINE' },
    { includeTabsContent: 'true' },
    {}
  ];

  async function fetchVariant(paramsObj) {
    const params = new URLSearchParams(paramsObj);
    const query = params.toString();
    const url = `${GOOGLE_DOCS_API_BASE}/${encodeURIComponent(docId)}${query ? `?${query}` : ''}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = body?.error?.message || `docs api error (${response.status})`;
      throw new Error(detail);
    }
    return body;
  }

  let bestDoc = null;
  let bestScore = -1;
  let lastError = '';

  for (const variant of baseVariants) {
    try {
      const body = await fetchVariant(variant);
      const score = estimateDocTextLength(body);
      if (score > bestScore) {
        bestScore = score;
        bestDoc = body;
      }
    } catch (error) {
      lastError = error?.message || 'docs api error';
    }
  }

  if (!bestDoc) {
    throw new Error(lastError || 'docs api error');
  }

  // Some documents store recipe text in non-default tabs. Pull each tab explicitly.
  const tabIds = collectTabIds(bestDoc);
  if (tabIds.length > 1) {
    const extraTabDocs = [];
    for (const tabId of tabIds) {
      try {
        const tabDoc = await fetchVariant({
          includeTabsContent: 'true',
          suggestionsViewMode: 'SUGGESTIONS_INLINE',
          tabId
        });
        extraTabDocs.push(tabDoc);
      } catch {
        // Best-effort per tab.
      }
    }
    if (extraTabDocs.length > 0) {
      bestDoc.__extraTabDocs = extraTabDocs;
    }
  }

  return bestDoc;
}

function estimateDocTextLength(docJson) {
  let total = 0;

  function walkContent(content) {
    if (!Array.isArray(content)) return;
    for (const node of content) {
      if (node?.paragraph?.elements) {
        for (const el of node.paragraph.elements) {
          const text = String(el?.textRun?.content || '');
          total += text.trim().length;
        }
      }
      if (Array.isArray(node?.table?.tableRows)) {
        for (const row of node.table.tableRows) {
          for (const cell of row.tableCells || []) {
            walkContent(cell.content || []);
          }
        }
      }
      if (node?.tableOfContents?.content) {
        walkContent(node.tableOfContents.content);
      }
    }
  }

  function walkTabs(tabs) {
    if (!Array.isArray(tabs)) return;
    for (const tab of tabs) {
      if (tab?.documentTab?.body?.content) {
        walkContent(tab.documentTab.body.content);
      }
      if (Array.isArray(tab?.childTabs) && tab.childTabs.length > 0) {
        walkTabs(tab.childTabs);
      }
    }
  }

  if (Array.isArray(docJson?.tabs) && docJson.tabs.length > 0) {
    walkTabs(docJson.tabs);
  }
  if (docJson?.body?.content) {
    walkContent(docJson.body.content);
  }

  return total;
}

function collectTabIds(docJson) {
  const out = [];
  const seen = new Set();

  function walkTabs(tabs) {
    if (!Array.isArray(tabs)) return;
    for (const tab of tabs) {
      const tabId = String(tab?.tabProperties?.tabId || '').trim();
      if (tabId && !seen.has(tabId)) {
        seen.add(tabId);
        out.push(tabId);
      }
      if (Array.isArray(tab?.childTabs) && tab.childTabs.length > 0) {
        walkTabs(tab.childTabs);
      }
    }
  }

  walkTabs(docJson?.tabs || []);
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loadedEnv = await loadEnv(args);
  const token = await resolveDocsAccessToken(loadedEnv);
  const translationConfig = resolveTranslationConfig(args, loadedEnv);
  const debugDocId = String(args['debug-doc-id'] || process.env.RECIPE_DEBUG_DOC_ID || loadedEnv.RECIPE_DEBUG_DOC_ID || '').trim();
  const existingRecipeByDocId = await loadExistingRecipeByDocId();

  if (translationConfig.enabled && !translationConfig.apiKey) {
    process.stderr.write(
      'Warning: OPENAI_API_KEY is not set. Recipe translations will fall back to source language text.\n'
    );
  }

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
      const cleanText = sanitizeDocumentText(text);
      const debugDump =
        debugDocId && debugDocId === docId
          ? {
              docId,
              docTitle: docJson.title || '',
              cleanText
            }
          : null;
      const urls = extractUrls(cleanText);
      const originalUrl = pickOriginalUrl(urls);

      let sourceDescription = '';
      let sourceDescriptionUsed = false;
      let exportTextUsed = false;
      let imageOcrUsed = false;
      let parserText = cleanText;

      let ingredients = ingredientsFromText(parserText);
      let instructions = instructionsFromText(parserText);
      let title = titleFromDocName(docJson.title, parserText, ingredients);
      let summary = summaryFromText(parserText, ingredients, title);

      // Some docs have incomplete body text via Docs API; retry using Drive plain-text export.
      if (isPlaceholderIngredients(ingredients) || isPlaceholderInstructions(instructions) || isGenericSummary(summary)) {
        try {
          const exportedText = sanitizeDocumentText(await exportDocPlainText(docId, token));
          if (debugDump) {
            debugDump.exportedText = exportedText;
          }
          if (exportedText) {
            const exportedIngredients = ingredientsFromText(exportedText);
            const exportedInstructions = instructionsFromText(exportedText);
            const exportedTitle = titleFromDocName(docJson.title, exportedText, exportedIngredients);
            const exportedSummary = summaryFromText(exportedText, exportedIngredients, exportedTitle);

            const currentScore = extractionQualityScore({
              title,
              summary,
              ingredients,
              instructions,
              text: parserText
            });
            const exportScore = extractionQualityScore({
              title: exportedTitle,
              summary: exportedSummary,
              ingredients: exportedIngredients,
              instructions: exportedInstructions,
              text: exportedText
            });

            if (exportScore > currentScore) {
              parserText = exportedText;
              exportTextUsed = true;
              ingredients = exportedIngredients;
              instructions = exportedInstructions;
              title = exportedTitle;
              summary = exportedSummary;
            }
          }
        } catch (error) {
          process.stderr.write(`Warning: export fallback skipped for ${docId} (${error?.message || 'unknown error'})\n`);
        }
      }

      // If doc content is sparse (e.g., only video link), pull recipe text from source page.
      if ((isPlaceholderIngredients(ingredients) || isPlaceholderInstructions(instructions) || isGenericSummary(summary)) && originalUrl) {
        try {
          sourceDescription = await fetchSourceDescription(originalUrl);
        } catch (error) {
          process.stderr.write(`Warning: source fetch skipped for ${docId} (${error?.message || 'unknown error'})\n`);
        }
      }

      if (sourceDescription) {
        if (debugDump) {
          debugDump.sourceDescription = sourceDescription;
        }
        const fromSourceIngredients = ingredientsFromSourceDescription(sourceDescription);
        const fromSourceInstructions = instructionsFromSourceDescription(sourceDescription);

        if (Array.isArray(fromSourceIngredients) && fromSourceIngredients.length > 0 && !isPlaceholderIngredients(fromSourceIngredients)) {
          ingredients = fromSourceIngredients;
          sourceDescriptionUsed = true;
        }
        if (Array.isArray(fromSourceInstructions) && fromSourceInstructions.length > 0 && !isPlaceholderInstructions(fromSourceInstructions)) {
          instructions = fromSourceInstructions;
          sourceDescriptionUsed = true;
        }

        if (isGenericSummary(summary)) {
          const sourceSummary = summaryFromText(sourceDescription, ingredients, title);
          if (sourceSummary && !isGenericSummary(sourceSummary)) {
            summary = sourceSummary;
          }
        }

        if (!isUsableRecipeTitle(title) || /^untitled recipe$/i.test(title)) {
          const sourceTitle = titleFromDocName('', sourceDescription, ingredients);
          if (isUsableRecipeTitle(sourceTitle)) {
            title = sourceTitle;
          }
        }
      }

      if ((isPlaceholderIngredients(ingredients) || isPlaceholderInstructions(instructions)) && images[0]) {
        const imagePath = siteAssetToLocalPath(images[0]);
        try {
          const ocr = await extractRecipeFromImageWithOpenAI(imagePath, translationConfig);
          if (ocr) {
            if (Array.isArray(ocr.ingredients) && ocr.ingredients.length > 0 && !isPlaceholderIngredients(ocr.ingredients)) {
              ingredients = ocr.ingredients;
              imageOcrUsed = true;
            }
            if (Array.isArray(ocr.instructions) && ocr.instructions.length > 0 && !isPlaceholderInstructions(ocr.instructions)) {
              instructions = ocr.instructions;
              imageOcrUsed = true;
            }
            if (isGenericSummary(summary) && ocr.summary) {
              summary = ocr.summary;
            }
            if ((!isUsableRecipeTitle(title) || /^untitled recipe$/i.test(title)) && ocr.title && isUsableRecipeTitle(ocr.title)) {
              title = ocr.title;
            }
          }
        } catch (error) {
          process.stderr.write(`Warning: image OCR skipped for ${docId} (${error?.message || 'unknown error'})\n`);
        }
      }

      if (debugDump) {
        debugDump.final = {
          title,
          summary,
          ingredients,
          instructions
        };
        const debugPath = path.resolve('/tmp', `chief-fafa-debug-${docId}.json`);
        await fs.writeFile(debugPath, `${JSON.stringify(debugDump, null, 2)}\n`, 'utf8');
        process.stdout.write(`Debug dump written to ${debugPath}\n`);
      }

      const combinedText = sourceDescription ? `${parserText}\n${sourceDescription}` : parserText;
      const searchable = `${title} ${summary} ${combinedText}`.toLowerCase();
      const fields = extractRecipeFields(combinedText);
      const inferredTimes = inferTimeFields(combinedText, instructions);
      const sourceLanguage = detectRecipeLanguage({
        title,
        summary,
        ingredients,
        instructions,
        rawText: combinedText
      });

      report.push({
        status: 'ok',
        docId,
        listedName: entry.name || '',
        listedModifiedTime: entry.modifiedTime || '',
        title: docJson.title || '',
        detectedLanguage: sourceLanguage,
        googleDocUrl: canonicalDocUrl(docId),
        originalUrl,
        images,
        exportTextUsed,
        sourceDescriptionUsed,
        imageOcrUsed,
        candidateUrls: urls.slice(0, 30)
      });

      const recipeBase = {
        title,
        slug: slugify(title) || docId.toLowerCase(),
        summary,
        cuisine: inferCategory(searchable, CUISINE_KEYWORDS, 'Global'),
        type: inferCategory(searchable, TYPE_KEYWORDS, 'Main Course'),
        prepTime: fields.prepTime || inferredTimes.prepTime || 'TBD',
        cookTime: fields.cookTime || inferredTimes.cookTime || 'TBD',
        totalTime: fields.totalTime || inferredTimes.totalTime || 'TBD',
        servings: fields.servings || 'TBD',
        ingredients,
        instructions,
        tags: [],
        image: images[0] || '',
        sourceUrl: originalUrl,
        googleDocUrl: canonicalDocUrl(docId)
      };

      if (isPlaceholderInstructions(recipeBase.instructions) && !isPlaceholderIngredients(recipeBase.ingredients)) {
        const inferred = inferInstructionFallback(recipeBase.title, recipeBase.type, recipeBase.ingredients);
        if (inferred.length > 0) {
          recipeBase.instructions = inferred;
        }
      }

      const previous = existingRecipeByDocId.get(docId);
      if (previous && typeof previous === 'object') {
        const prevIngredients = Array.isArray(previous.ingredients) ? previous.ingredients : [];
        const prevInstructions = Array.isArray(previous.instructions) ? previous.instructions : [];
        const prevSummary = String(previous.summary || '').trim();
        const prevTitle = String(previous.title || '').trim();

        if (isPlaceholderIngredients(recipeBase.ingredients) && !isPlaceholderIngredients(prevIngredients)) {
          recipeBase.ingredients = prevIngredients.slice(0, 120);
        }
        if (isPlaceholderInstructions(recipeBase.instructions) && !isPlaceholderInstructions(prevInstructions)) {
          recipeBase.instructions = prevInstructions.slice(0, 120);
        }
        if (isGenericSummary(recipeBase.summary) && prevSummary && !isGenericSummary(prevSummary)) {
          recipeBase.summary = prevSummary;
        }
        if ((!isUsableRecipeTitle(recipeBase.title) || /^untitled recipe$/i.test(recipeBase.title)) && isUsableRecipeTitle(prevTitle)) {
          recipeBase.title = prevTitle;
          recipeBase.slug = slugify(prevTitle) || recipeBase.slug;
        }
      }

      const translations = await buildRecipeTranslations(recipeBase, sourceLanguage, translationConfig);

      recipes.push({
        ...recipeBase,
        sourceLanguage,
        translations
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
