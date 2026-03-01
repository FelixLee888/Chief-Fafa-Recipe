#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_INPUT = path.resolve('data/google-doc-export.txt');
const DEFAULT_OUTPUT = path.resolve('data/recipes.json');
const DEFAULT_EXTERNAL_ENV = '/Users/felixlee/Documents/ChiefFaFaBot/.env';
const IMAGE_STATIC_DIR = path.resolve('static/assets/recipe-images');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DOCS_API_BASE = 'https://docs.googleapis.com/v1/documents';
const GOOGLE_DOCS_URL_RE = /https?:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/i;
const IMAGE_MARKER_RE = /^\[\[IMAGE:([A-Za-z0-9_-]+)\]\]$/;

const LABEL_PATTERNS = {
  ingredients: [/^(ingredients?|ingredient list|材料|食材|材料清單|材料清单)(?:\s*\([^)]*\))?\s*[:：]?/i],
  instructions: [/^(instructions?|method|steps?|directions?|作法|做法|步驟|步骤|手順|作り方|方法)(?:\s*\([^)]*\))?\s*[:：]?/i],
  summary: [/^(summary|description|簡介|简介|說明|说明|介紹|介绍)\s*[:：]?/i],
  cuisine: [/^(cuisine|料理類型|料理类型|菜系)\s*[:：]?/i],
  type: [/^(type|category|類型|类型|分類|分类|餐別|餐别)\s*[:：]?/i],
  prepTime: [/^(prep(?:aration)?\s*time|準備時間|准备时间)\s*[:：]?/i],
  cookTime: [/^(cook(?:ing)?\s*time|烹調時間|烹调时间|調理時間|调理时间)\s*[:：]?/i],
  totalTime: [/^(total\s*time|總時間|总时间|所要時間|所要时间)\s*[:：]?/i],
  servings: [/^(servings?|yield|份量|人份|人数|食用人數|食用人数)\s*[:：]?/i],
  image: [/^(image|photo|圖片|图片|照片)\s*[:：]?/i]
};

const CUISINE_KEYWORDS = {
  Filipino: ['adobo', 'calamansi', 'patis', 'sinigang', 'tocino', 'longganisa', 'pandesal', 'atchara', 'ginisang'],
  Italian: ['pasta', 'parmesan', 'risotto', 'basil', 'oregano', 'mozzarella', 'marinara', 'gnocchi'],
  Japanese: ['miso', 'mirin', 'dashi', 'onigiri', 'sushi', 'teriyaki', 'nori', 'shoyu', '味噌', '日式', '和風', '和风'],
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
  Dessert: ['dessert', 'cake', 'cookie', 'brownie', 'pudding', 'sweet', 'ice cream', '甜點', '甜品', 'デザート'],
  Snack: ['snack', 'bite', 'onigiri', 'bar', 'chips', '點心', '点心'],
  Appetizer: ['appetizer', 'starter', 'dip', 'canape', 'small plate', '前菜'],
  Soup: ['soup', 'broth', 'ramen', 'bisque', 'sinigang', '湯', '汤'],
  Salad: ['salad', 'greens', 'vinaigrette', 'slaw', '沙拉'],
  Beverage: ['drink', 'smoothie', 'juice', 'latte', 'tea', 'coffee', '飲品', '饮品']
};

const TAG_KEYWORDS = [
  'chicken',
  'beef',
  'pork',
  'shrimp',
  'fish',
  'tofu',
  'vegan',
  'vegetarian',
  'gluten free',
  'spicy',
  'quick',
  'one pot',
  'air fryer',
  'high protein',
  'low carb',
  'black sesame',
  'coconut',
  'rice',
  'noodle',
  '雞',
  '牛',
  '豬',
  '豆腐',
  '芝麻'
];

const COMMENT_SECTION_START_RE =
  /(?:^\s*\d+\s+comments?\s*$|\b(?:leave a comment|post a comment|view comments?)\b|(?:發佈留言|发表评论|留言|評論|评论|回覆|回應|回应))/i;
const SOCIAL_SHARE_RE =
  /(?:blogthis|share this|share on|share to|email this|pin(?:terest)?|facebook|twitter|分享至|分享到|以電子郵件傳送這篇文章|回覆\s*刪除|回复\s*删除)/i;
const COMMENT_AUTHOR_RE =
  /^[\w\u3400-\u9fff][\w\u3400-\u9fff .,'’\-]{0,48}\s+\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日.*$/u;
const COMMENT_BODY_RE = /\b(?:thanks for sharing|great post|anonymous said|留下評論|发表留言)\b/i;
const TITLE_PLACEHOLDER_RE =
  /(?:<\s*image[^>]*>|image[_\s-]*attachment(?:_here)?|__\s*chief[_\s-]*fafa[_\s-]*payload\s*__|chief[_\s-]*fafa[_\s-]*payload|\[\[image:[^\]]+\]\]|["']?__\w+__["']?)/i;
const TITLE_LABEL_RE =
  /^(?:recipe\s*title|title|dish\s*name|recipe\s*name|recipe\s*heading|食譜標題|食谱标题|標題|标题)\s*[:：]\s*/i;
const TITLE_STOP_RE =
  /^(?:chief\s*fafa\s*recipe\s*note|recipe\s*note|untitled\s*recipe|video\s*(?:title|description)|see source url.*|not clearly detected from source.*|ingredients?|instructions?|method|steps?|\(?not provided.*\)?|recipe submitted as text|direct text input|source type|input source|text input|n\/a|none)$/i;
const TITLE_META_LINE_RE =
  /^(?:original\s*page\s*url|source\s*url|page\s*url|google\s*doc(?:ument)?\s*url|reference\s*url|video\s*url|media\s*url|recipe\s*title|author|description|caption|source\s*type|input\s*source|language|lang|cuisine|type|category)(?:\s*[:：].*)?$/i;
const TITLE_META_VALUE_RE =
  /^(?:global|chinese|japanese|korean|thai|filipino|indian|italian|french|mexican|mediterranean|american|dessert|dinner|lunch|breakfast|snack|appetizer|soup|salad|beverage|main course|english|en|ja|zh(?:-hant)?|繁體中文|日本語)$/i;
const TITLE_STEP_LINE_RE = /^(?:\(?[0-9]{1,3}\)?[.)、:：]|step\s*[0-9]+|第\s*[0-9]+\s*步)/i;
const TITLE_INGREDIENT_MEASURE_RE =
  /\b[0-9]+(?:\.[0-9]+)?\s*(?:kg|g|mg|ml|l|cc|oz|lb|lbs|tbsp|tsp|cups?|pcs?|pc|克|公斤|毫升|公升|茶匙|湯匙|汤匙|大匙|小匙|條|条|隻|只|個|个|片|塊|块|顆|颗|粒)\b/i;

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

function parseEnv(raw) {
  const env = {};
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
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

async function loadEnvFiles(args) {
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
      // Optional env files are intentionally best-effort.
    }
  }

  return loaded;
}

function pickEnv(extraEnv, keys) {
  for (const key of keys) {
    const processValue = String(process.env[key] || '').trim();
    if (processValue) return processValue;

    const extraValue = String(extraEnv[key] || '').trim();
    if (extraValue) return extraValue;
  }
  return '';
}

function resolveGoogleClientSecrets(extraEnv) {
  const clientId = pickEnv(extraEnv, ['GOOGLE_DOCS_CLIENT_ID', 'GOOGLE_KEEP_CLIENT_ID']);
  const clientSecret = pickEnv(extraEnv, ['GOOGLE_DOCS_CLIENT_SECRET', 'GOOGLE_KEEP_CLIENT_SECRET']);
  return { clientId, clientSecret };
}

async function resolveDocsAccessToken(extraEnv) {
  const refreshToken = pickEnv(extraEnv, ['GOOGLE_DOCS_REFRESH_TOKEN', 'GOOGLE_KEEP_REFRESH_TOKEN']);
  const directToken = pickEnv(extraEnv, ['GOOGLE_DOCS_ACCESS_TOKEN', 'GOOGLE_KEEP_ACCESS_TOKEN']);

  if (refreshToken) {
    const { clientId, clientSecret } = resolveGoogleClientSecrets(extraEnv);
    if (clientId && clientSecret) {
      const payload = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      try {
        const response = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: payload
        });

        const body = await response.json().catch(() => ({}));
        if (response.ok && body && typeof body === 'object') {
          const accessToken = String(body.access_token || '').trim();
          if (accessToken) {
            return { token: accessToken, error: '' };
          }
          return { token: '', error: 'token refresh response missing access_token' };
        }

        const detail =
          body && typeof body === 'object' && body.error_description
            ? String(body.error_description)
            : `token refresh failed (${response.status})`;
        if (directToken) {
          return { token: directToken, error: '' };
        }
        return { token: '', error: detail };
      } catch (error) {
        if (directToken) {
          return { token: directToken, error: '' };
        }
        return { token: '', error: `token refresh failed (${error?.message || 'unknown error'})` };
      }
    }

    if (directToken) {
      return { token: directToken, error: '' };
    }
    return { token: '', error: 'GOOGLE_DOCS_CLIENT_ID / GOOGLE_DOCS_CLIENT_SECRET missing' };
  }

  if (directToken) {
    return { token: directToken, error: '' };
  }

  return {
    token: '',
    error: 'GOOGLE_DOCS_ACCESS_TOKEN / GOOGLE_DOCS_REFRESH_TOKEN not configured'
  };
}

function extractGoogleDocId(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const fromUrl = trimmed.match(GOOGLE_DOCS_URL_RE);
  if (fromUrl && fromUrl[1]) return fromUrl[1];

  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return '';
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

function matchLabel(line, patterns) {
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return line.slice(match[0].length).trim();
    }
  }
  return null;
}

function isSectionLabel(line) {
  return Object.values(LABEL_PATTERNS).some((patterns) => patterns.some((pattern) => pattern.test(line.trim())));
}

function isIngredientLabel(line) {
  return LABEL_PATTERNS.ingredients.some((pattern) => pattern.test(line.trim()));
}

function cleanHeading(line) {
  const strippedHashes = line.replace(/^#{1,3}\s+/, '');
  return strippedHashes.replace(/^recipe\s*[:：]\s*/i, '').trim();
}

function splitRecipeBlocks(text) {
  const normalized = sanitizeDocumentText(text);
  const lines = normalized.split('\n');
  const blocks = [];
  let current = null;

  const hasIngredientAhead = (index) => {
    const window = lines.slice(index + 1, index + 20);
    return window.some((value) => isIngredientLabel(value));
  };

  const isHeading = (index) => {
    const line = lines[index].trim();
    if (!line) return false;

    if (/^#{1,3}\s+/.test(line)) return true;
    if (/^recipe\s*[:：]/i.test(line)) return true;
    if (isSectionLabel(line)) return false;
    if (line.length < 3 || line.length > 120) return false;

    return hasIngredientAhead(index);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isHeading(i)) {
      if (current && current.lines.join('').trim()) {
        blocks.push(current);
      }
      current = { title: cleanHeading(line), lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current && current.lines.join('').trim()) {
    blocks.push(current);
  }

  if (blocks.length > 0) {
    return blocks;
  }

  const fallbackChunks = normalized
    .split(/\n-{3,}\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (fallbackChunks.length > 0) {
    return fallbackChunks.map((chunk) => {
      const chunkLines = chunk.split('\n');
      return {
        title: cleanHeading(chunkLines[0] || 'Untitled Recipe'),
        lines: chunkLines.slice(1)
      };
    });
  }

  const compact = lines.map((line) => line.trim()).filter(Boolean);
  if (compact.length > 0) {
    return [
      {
        title: cleanHeading(compact[0]),
        lines: compact.slice(1)
      }
    ];
  }

  return [];
}

function stripBullet(line) {
  return line
    .replace(/^[-*•]\s*/, '')
    .replace(/^[0-9]+[.)、]\s*/, '')
    .replace(/^第\s*[0-9]+\s*步\s*[:：]?\s*/, '')
    .trim();
}

function inferCategory(text, dictionary, fallback) {
  let bestCategory = fallback;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(dictionary)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function inferTags(text, ingredients) {
  const tags = new Set();

  for (const keyword of TAG_KEYWORDS) {
    if (text.includes(keyword)) {
      tags.add(keyword.replace(/\b\w/g, (char) => char.toUpperCase()));
    }
  }

  const ingredientText = ingredients.join(' ').toLowerCase();
  if (ingredientText.includes('tofu') || ingredientText.includes('tempeh') || ingredientText.includes('豆腐')) {
    tags.add('Vegetarian');
  }
  if (
    !ingredientText.includes('beef') &&
    !ingredientText.includes('pork') &&
    !ingredientText.includes('chicken') &&
    !ingredientText.includes('fish') &&
    (ingredientText.includes('vegetable') || ingredientText.includes('蔬菜'))
  ) {
    tags.add('Plant-Forward');
  }

  return [...tags].slice(0, 8);
}

function combineTime(prepTime, cookTime) {
  if (!prepTime && !cookTime) return '';
  if (prepTime && cookTime) return `${prepTime} + ${cookTime}`;
  return prepTime || cookTime;
}

function parseBlock(block) {
  const recipe = {
    title: block.title.trim(),
    summary: '',
    prepTime: '',
    cookTime: '',
    totalTime: '',
    servings: '',
    ingredients: [],
    instructions: [],
    cuisine: '',
    type: '',
    tags: [],
    image: '',
    imageRefs: []
  };

  let section = '';
  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isCommentSectionStart(line)) {
      break;
    }
    if (isCommentOrSocialLine(line)) {
      continue;
    }

    const imageMarker = line.match(IMAGE_MARKER_RE);
    if (imageMarker) {
      recipe.imageRefs.push(imageMarker[1]);
      continue;
    }

    const ingredientsValue = matchLabel(line, LABEL_PATTERNS.ingredients);
    if (ingredientsValue !== null) {
      section = 'ingredients';
      if (ingredientsValue) recipe.ingredients.push(stripBullet(ingredientsValue));
      continue;
    }

    const instructionsValue = matchLabel(line, LABEL_PATTERNS.instructions);
    if (instructionsValue !== null) {
      section = 'instructions';
      if (instructionsValue) recipe.instructions.push(stripBullet(instructionsValue));
      continue;
    }

    const summaryValue = matchLabel(line, LABEL_PATTERNS.summary);
    if (summaryValue !== null) {
      recipe.summary = summaryValue;
      continue;
    }

    const cuisineValue = matchLabel(line, LABEL_PATTERNS.cuisine);
    if (cuisineValue !== null) {
      recipe.cuisine = cuisineValue;
      continue;
    }

    const typeValue = matchLabel(line, LABEL_PATTERNS.type);
    if (typeValue !== null) {
      recipe.type = typeValue;
      continue;
    }

    const prepValue = matchLabel(line, LABEL_PATTERNS.prepTime);
    if (prepValue !== null) {
      recipe.prepTime = prepValue;
      continue;
    }

    const cookValue = matchLabel(line, LABEL_PATTERNS.cookTime);
    if (cookValue !== null) {
      recipe.cookTime = cookValue;
      continue;
    }

    const totalValue = matchLabel(line, LABEL_PATTERNS.totalTime);
    if (totalValue !== null) {
      recipe.totalTime = totalValue;
      continue;
    }

    const servingsValue = matchLabel(line, LABEL_PATTERNS.servings);
    if (servingsValue !== null) {
      recipe.servings = servingsValue;
      continue;
    }

    const imageValue = matchLabel(line, LABEL_PATTERNS.image);
    if (imageValue !== null) {
      recipe.image = imageValue;
      continue;
    }

    if (section === 'ingredients') {
      recipe.ingredients.push(stripBullet(line));
      continue;
    }

    if (section === 'instructions') {
      recipe.instructions.push(stripBullet(line));
      continue;
    }

    if (!recipe.summary && !isSectionLabel(line)) {
      recipe.summary = line;
    }
  }

  const combinedText = [
    recipe.title,
    recipe.summary,
    recipe.ingredients.join(' '),
    recipe.instructions.join(' ')
  ]
    .join(' ')
    .toLowerCase();

  if (!recipe.cuisine) {
    recipe.cuisine = inferCategory(combinedText, CUISINE_KEYWORDS, 'Global');
  }
  if (!recipe.type) {
    recipe.type = inferCategory(combinedText, TYPE_KEYWORDS, 'Main Course');
  }
  recipe.tags = inferTags(combinedText, recipe.ingredients);

  if (!recipe.totalTime) {
    recipe.totalTime = combineTime(recipe.prepTime, recipe.cookTime);
  }

  return recipe;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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

function isUsableRecipeTitle(value) {
  const clean = cleanTitleCandidate(value);
  if (!clean) return false;
  if (clean.length < 3 || clean.length > 140) return false;
  if (!/[\p{L}\p{N}]/u.test(clean)) return false;
  if (/^https?:\/\//i.test(clean)) return false;
  if (TITLE_PLACEHOLDER_RE.test(clean)) return false;
  if (TITLE_STOP_RE.test(clean)) return false;
  if (looksLikeMetadataValue(clean)) return false;
  if (TITLE_STEP_LINE_RE.test(clean)) return false;
  if (isCommentOrSocialLine(clean) || isCommentSectionStart(clean)) return false;
  if (isSectionLabel(clean)) return false;
  if (TITLE_INGREDIENT_MEASURE_RE.test(clean) && /\d/.test(clean)) return false;
  return true;
}

function inferTitleFromIngredients(ingredients = [], textBlob = '') {
  const text = String(textBlob || '');

  const knownDishes = [
    { re: /sea\s*cucumber|海參|海参/iu, label: 'Sea Cucumber' },
    { re: /turnip\s*cake|蘿蔔糕|萝卜糕/iu, label: 'Turnip Cake' },
    { re: /cheesecake|芝士蛋糕|起司蛋糕/iu, label: 'Cheesecake' },
    { re: /sponge\s*cake|棉花蛋糕|海綿蛋糕|海绵蛋糕/iu, label: 'Sponge Cake' },
    { re: /fried\s*noodles?|炒麵|炒面/iu, label: 'Fried Noodles' }
  ];

  for (const dish of knownDishes) {
    if (dish.re.test(text)) {
      if (/\bbrais(?:e|ed|ing)\b|炆|燜|焖/iu.test(text)) {
        return `Braised ${dish.label}`;
      }
      return `${dish.label} Recipe`;
    }
  }

  const generic = new Set([
    'salt', 'sugar', 'water', 'oil', 'soy sauce', 'dark soy sauce', 'light soy sauce', 'stock', 'chicken stock',
    'pepper', 'white pepper', 'black pepper', 'wine', 'ginger', 'garlic', 'scallion', 'spring onion', 'cornstarch',
    'flour', 'lard', 'butter', 'milk', 'cream', 'egg', 'eggs', '鹽', '盐', '糖', '水', '油', '胡椒', '黑胡椒', '白胡椒', '薑', '姜', '蒜'
  ]);

  let best = '';
  let bestScore = 0;
  for (const item of ingredients) {
    const clean = cleanTitleCandidate(item).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!clean || clean.length > 60) continue;
    if (TITLE_PLACEHOLDER_RE.test(clean)) continue;
    if (TITLE_INGREDIENT_MEASURE_RE.test(clean) && /\d/.test(clean)) continue;
    const key = clean.toLowerCase();
    if (generic.has(key)) continue;

    let score = 1;
    if (/sea\s*cucumber|海參|海参|turnip|蘿蔔|萝卜|cake|noodle|麵|面|chicken|beef|pork|shrimp|fish|tofu/iu.test(clean)) score += 4;
    if (text.toLowerCase().includes(key)) score += 1;
    if (/[A-Za-z]/.test(clean) || /[\u3400-\u9fff]/u.test(clean)) score += 1;
    if (clean.length >= 4 && clean.length <= 32) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = clean;
    }
  }

  if (!best) return '';
  const english = /^[A-Za-z][A-Za-z\s'’\-]+$/.test(best) ? best.replace(/\b\w/g, (c) => c.toUpperCase()) : best;
  if (/\bbrais(?:e|ed|ing)\b|炆|燜|焖/iu.test(text) && /^[A-Za-z]/.test(english)) {
    return `Braised ${english}`;
  }
  return /^[A-Za-z]/.test(english) ? `${english} Recipe` : `${english} 食譜`;
}

function normalizeTitle(title, summary, ingredients = [], instructions = []) {
  const cleanTitle = cleanTitleCandidate(title);
  const cleanSummary = String(summary || '').trim();

  if (isUsableRecipeTitle(cleanTitle)) return cleanTitle;

  if (/^video\s+(description|title)/i.test(cleanTitle) && cleanSummary) {
    const candidate = cleanTitleCandidate(cleanSummary.split(/\n|\||｜/)[0]);
    if (isUsableRecipeTitle(candidate)) return candidate;
  }

  if (cleanSummary) {
    const firstSummaryLine = cleanTitleCandidate(cleanSummary.split(/\n|\||｜/)[0]);
    if (isUsableRecipeTitle(firstSummaryLine)) return firstSummaryLine;
  }

  for (const line of instructions.slice(0, 12)) {
    const candidate = cleanTitleCandidate(line);
    if (isUsableRecipeTitle(candidate) && !TITLE_STEP_LINE_RE.test(line)) {
      return candidate;
    }
  }

  const inferred = inferTitleFromIngredients(ingredients, [cleanSummary, ...ingredients, ...instructions].join(' '));
  if (inferred) return inferred;

  return cleanTitle || 'Untitled Recipe';
}

function normalizeRecipe(recipe, index, imagesByRef, fallbackImages) {
  const title = normalizeTitle(recipe.title || 'Untitled Recipe', recipe.summary, recipe.ingredients, recipe.instructions);
  const slug = slugify(title) || `recipe-${Math.random().toString(36).slice(2, 8)}`;

  const markerImage = recipe.imageRefs.map((ref) => imagesByRef[ref]).find(Boolean) || '';
  const fallbackImage = fallbackImages.length > 0 ? fallbackImages[Math.min(index, fallbackImages.length - 1)] : '';
  const image = recipe.image || markerImage || fallbackImage;
  const cleanedIngredients = recipe.ingredients
    .map((item) => String(item || '').trim())
    .filter((item) => item && !isCommentOrSocialLine(item) && !TITLE_PLACEHOLDER_RE.test(item));
  const cleanedInstructions = recipe.instructions
    .map((item) => String(item || '').trim())
    .filter((item) => item && !isCommentOrSocialLine(item) && !TITLE_PLACEHOLDER_RE.test(item));

  return {
    title,
    slug,
    summary: recipe.summary || `A signature ${(recipe.type || 'main course').toLowerCase()} from Chef Fafa's kitchen.`,
    cuisine: recipe.cuisine || 'Global',
    type: recipe.type || 'Main Course',
    prepTime: recipe.prepTime || 'TBD',
    cookTime: recipe.cookTime || 'TBD',
    totalTime: recipe.totalTime || 'TBD',
    servings: recipe.servings || 'TBD',
    ingredients: cleanedIngredients,
    instructions: cleanedInstructions,
    tags: recipe.tags || [],
    image
  };
}

function isValidRecipe(recipe) {
  return recipe.title && recipe.ingredients.length > 0 && recipe.instructions.length > 0;
}

function extractTextAndImageRefsFromDocsApi(data) {
  const chunks = [];
  const imageRefs = [];

  function walkContent(content) {
    if (!Array.isArray(content)) return;

    for (const node of content) {
      if (node?.paragraph?.elements) {
        for (const element of node.paragraph.elements) {
          const text = element?.textRun?.content;
          if (text) {
            chunks.push(text);
            continue;
          }

          const imageRef = element?.inlineObjectElement?.inlineObjectId;
          if (imageRef) {
            imageRefs.push(imageRef);
            chunks.push(`\n[[IMAGE:${imageRef}]]\n`);
          }
        }
      }

      const tableRows = node?.table?.tableRows;
      if (Array.isArray(tableRows)) {
        for (const row of tableRows) {
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

  walkContent(data?.body?.content || []);
  return {
    text: normalizeText(chunks.join('')),
    imageRefs
  };
}

function getInlineObjectImageUri(docJson, objectId) {
  const node = docJson?.inlineObjects?.[objectId]?.inlineObjectProperties?.embeddedObject;
  const imageProps = node?.imageProperties;
  const uri = String(imageProps?.contentUri || imageProps?.sourceUri || '').trim();
  return uri;
}

function mimeToExt(mime, uri = '') {
  const clean = String(mime || '').split(';')[0].trim().toLowerCase();
  if (clean === 'image/jpeg' || clean === 'image/jpg') return '.jpg';
  if (clean === 'image/png') return '.png';
  if (clean === 'image/webp') return '.webp';
  if (clean === 'image/gif') return '.gif';

  const pathname = (() => {
    try {
      return new URL(uri).pathname;
    } catch {
      return '';
    }
  })();

  const ext = path.extname(pathname).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp' || ext === '.gif') {
    return ext === '.jpeg' ? '.jpg' : ext;
  }

  return '.jpg';
}

async function downloadImageWithAuth(url, token) {
  let response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    response = await fetch(url);
  }

  if (!response.ok) {
    throw new Error(`image download failed (${response.status})`);
  }

  const mime = response.headers.get('content-type') || '';
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, mime };
}

async function downloadDocImages({ docId, token, docJson, imageRefs }) {
  const uniqueRefs = [];
  const seen = new Set();
  for (const ref of imageRefs) {
    if (!seen.has(ref)) {
      seen.add(ref);
      uniqueRefs.push(ref);
    }
  }

  if (uniqueRefs.length === 0) {
    return { imagesByRef: {}, imageList: [] };
  }

  await fs.mkdir(IMAGE_STATIC_DIR, { recursive: true });

  const existing = await fs.readdir(IMAGE_STATIC_DIR).catch(() => []);
  await Promise.all(
    existing
      .filter((name) => name.startsWith(`${docId}-`))
      .map((name) => fs.rm(path.join(IMAGE_STATIC_DIR, name), { force: true }))
  );

  const imagesByRef = {};
  const imageList = [];

  for (let index = 0; index < uniqueRefs.length; index += 1) {
    const ref = uniqueRefs[index];
    const uri = getInlineObjectImageUri(docJson, ref);
    if (!uri) continue;

    try {
      const { bytes, mime } = await downloadImageWithAuth(uri, token);
      const ext = mimeToExt(mime, uri);
      const fileName = `${docId}-${String(index + 1).padStart(2, '0')}${ext}`;
      const outputPath = path.join(IMAGE_STATIC_DIR, fileName);
      await fs.writeFile(outputPath, bytes);

      const webPath = `/assets/recipe-images/${fileName}`;
      imagesByRef[ref] = webPath;
      imageList.push(webPath);
    } catch (error) {
      process.stderr.write(`Warning: failed to download image ${ref}: ${error.message}\n`);
    }
  }

  return { imagesByRef, imageList };
}

async function fetchPublicDocExport(docId) {
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`public export failed (${response.status})`);
  }

  const body = await response.text();
  const normalized = normalizeText(body);
  if (!normalized || normalized.includes('Sign in') || normalized.includes('<!DOCTYPE html>')) {
    throw new Error('public export returned non-text login response');
  }

  return normalized;
}

async function fetchPrivateDocViaApi(docId, token) {
  const url = `${GOOGLE_DOCS_API_BASE}/${encodeURIComponent(docId)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && body.error && body.error.message
        ? String(body.error.message)
        : `docs api error (${response.status})`;
    throw new Error(detail);
  }

  return body;
}

async function readSource({ inputPath, docId, envValues, skipImages }) {
  if (!docId) {
    return {
      text: await fs.readFile(inputPath, 'utf8'),
      imagesByRef: {},
      fallbackImages: [],
      sourceType: 'local'
    };
  }

  const { token } = await resolveDocsAccessToken(envValues);
  if (token) {
    try {
      const docJson = await fetchPrivateDocViaApi(docId, token);
      const extracted = extractTextAndImageRefsFromDocsApi(docJson);

      if (!extracted.text) {
        throw new Error('document was fetched but no text content was extracted');
      }

      if (skipImages) {
        return {
          text: extracted.text,
          imagesByRef: {},
          fallbackImages: [],
          sourceType: 'docs-api-no-images'
        };
      }

      const downloaded = await downloadDocImages({
        docId,
        token,
        docJson,
        imageRefs: extracted.imageRefs
      });

      return {
        text: extracted.text,
        imagesByRef: downloaded.imagesByRef,
        fallbackImages: downloaded.imageList,
        sourceType: 'docs-api'
      };
    } catch (error) {
      process.stderr.write(`Warning: Docs API path failed (${error.message}). Falling back to text export.\n`);
    }
  }

  return {
    text: await fetchPublicDocExport(docId),
    imagesByRef: {},
    fallbackImages: [],
    sourceType: 'public-export'
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(String(args.input || DEFAULT_INPUT));
  const outputPath = path.resolve(String(args.output || DEFAULT_OUTPUT));
  const skipImages = Boolean(args['skip-images']);

  const docSource = args['doc-id'] || args.docId || args['doc-url'] || args.docUrl || '';
  const docId = extractGoogleDocId(docSource);
  const envValues = await loadEnvFiles(args);

  if ((args['doc-id'] || args.docId || args['doc-url'] || args.docUrl) && !docId) {
    throw new Error('Invalid Google Doc identifier. Pass --doc-id <id> or --doc-url <google-doc-url>.');
  }

  const source = await readSource({
    inputPath,
    docId,
    envValues,
    skipImages
  });

  const blocks = splitRecipeBlocks(sanitizeDocumentText(source.text));
  const recipes = blocks
    .map(parseBlock)
    .map((recipe, index) => normalizeRecipe(recipe, index, source.imagesByRef, source.fallbackImages))
    .filter(isValidRecipe);

  if (recipes.length === 0) {
    throw new Error('No valid recipes parsed. Ensure each recipe has title, Ingredients/材料, and Instructions/做法 sections.');
  }

  const output = {
    site: {
      title: "Chef Fafa's Recipe",
      description: 'Modern, searchable recipe collection with auto-categorized cuisine and meal types.',
      generatedAt: new Date().toISOString(),
      source: docId ? `google-doc:${docId}` : path.basename(inputPath),
      sourceType: source.sourceType,
      locales: ['en', 'zh-Hant', 'ja']
    },
    recipes
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  process.stdout.write(`Imported ${recipes.length} recipes to ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
