#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_PATH = path.resolve('data/recipes.json');
const STATIC_DIR = path.resolve('static');
const OUTPUT_DIR = path.resolve('site');
const DEFAULT_LOCALE = 'en';
const FAVICON_FILE = 'fafa_icon.png';
const FAVICON_32_FILE = 'favicon-32.png';
const APPLE_TOUCH_ICON_FILE = 'apple-touch-icon.png';
const FAVICON_VERSION = '20260227-2';
const BASE_PATH = normalizeBasePath(process.env.SITE_BASE_PATH || '');

const LOCALES = {
  en: {
    code: 'en',
    name: 'English',
    navSearch: 'Search',
    navRecipes: 'Recipes',
    allRecipes: 'All recipes',
    heroEyebrow: 'FAFA RECIPE ARCHIVE',
    heroTitle: 'Find your next favorite meal in seconds.',
    heroSubtitle: 'Search by title, ingredients, cuisine, or recipe type. Categories are auto-generated from your Google Doc content.',
    searchLabel: 'Search recipes',
    searchPlaceholder: 'Try: black sesame, adobo, pasta, soup',
    recipesIndexed: 'recipes indexed',
    cuisines: 'Cuisines',
    types: 'Types',
    allCuisines: 'All cuisines',
    allTypes: 'All types',
    noResults: 'No recipes match your current search. Try a different keyword or clear filters.',
    footerIndex: 'Built for discoverability: semantic HTML, structured data, clean URLs, and auto-categorized recipes.',
    footerRecipe: 'Auto-categorized from recipe text and images extracted from Google Doc. Update source content and rebuild to refresh this page.',
    home: 'Home',
    prep: 'Prep',
    cook: 'Cook',
    total: 'Total',
    servings: 'Servings',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    language: 'Language',
    themeToLight: 'Light mode',
    themeToDark: 'Dark mode',
    switchTheme: 'Switch color theme',
    source: 'Source',
    googleDoc: 'Google Doc',
    coverAlt: "Chef Fafa's Recipe cover image",
    audioUnmute: 'Unmute video',
    audioMute: 'Mute video',
    audioSwitch: 'Toggle video sound'
  },
  'zh-Hant': {
    code: 'zh-Hant',
    name: '繁體中文',
    navSearch: '搜尋',
    navRecipes: '食譜',
    allRecipes: '全部食譜',
    heroEyebrow: '春田花花食譜庫',
    heroTitle: '快速找到下一道想做的料理。',
    heroSubtitle: '可依標題、食材、料理類型與餐別搜尋。分類會依 Google Doc 內容自動整理。',
    searchLabel: '搜尋食譜',
    searchPlaceholder: '例如：黑芝麻、蘿蔔糕、義大利麵、湯',
    recipesIndexed: '道食譜已建立索引',
    cuisines: '料理類型',
    types: '餐別',
    allCuisines: '全部料理',
    allTypes: '全部餐別',
    noResults: '目前沒有符合條件的食譜，請換個關鍵字或清除篩選。',
    footerIndex: '為搜尋友善而設計：語意化 HTML、結構化資料、乾淨網址與自動分類。',
    footerRecipe: '內容由食譜文字自動分類，圖片由 Google Doc 擷取。更新來源後重新建置即可同步。',
    home: '首頁',
    prep: '準備',
    cook: '烹調',
    total: '總計',
    servings: '份量',
    ingredients: '材料',
    instructions: '做法',
    language: '語言',
    themeToLight: '淺色模式',
    themeToDark: '深色模式',
    switchTheme: '切換深淺模式',
    source: '原始頁面',
    googleDoc: 'Google 文件',
    coverAlt: '花花之食譜封面圖',
    audioUnmute: '開啟聲音',
    audioMute: '靜音',
    audioSwitch: '切換影片聲音'
  },
  ja: {
    code: 'ja',
    name: '日本語',
    navSearch: '検索',
    navRecipes: 'レシピ',
    allRecipes: 'すべてのレシピ',
    heroEyebrow: 'エディトリアル レシピアーカイブ',
    heroTitle: '次に作りたい一皿をすぐに見つける。',
    heroSubtitle: 'タイトル、食材、料理ジャンル、レシピタイプで検索。分類は Google ドキュメントの内容から自動生成。',
    searchLabel: 'レシピを検索',
    searchPlaceholder: '例：黒ごま、アドボ、パスタ、スープ',
    recipesIndexed: '件のレシピを索引化',
    cuisines: '料理ジャンル',
    types: 'レシピタイプ',
    allCuisines: 'すべてのジャンル',
    allTypes: 'すべてのタイプ',
    noResults: '一致するレシピがありません。キーワードを変えるかフィルターを解除してください。',
    footerIndex: '検索性を重視：セマンティック HTML、構造化データ、クリーン URL、自動カテゴリ分け。',
    footerRecipe: 'レシピ本文を自動分類し、画像は Google ドキュメントから抽出。更新後に再ビルドしてください。',
    home: 'ホーム',
    prep: '下準備',
    cook: '調理',
    total: '合計',
    servings: '分量',
    ingredients: '材料',
    instructions: '作り方',
    language: '言語',
    themeToLight: 'ライト',
    themeToDark: 'ダーク',
    switchTheme: 'テーマ切替',
    source: '元ページ',
    googleDoc: 'Google ドキュメント',
    coverAlt: 'Chef Fafa レシピのカバー画像',
    audioUnmute: '音声オン',
    audioMute: 'ミュート',
    audioSwitch: '動画の音声を切り替え'
  }
};

const CUISINE_I18N = {
  Filipino: { 'zh-Hant': '菲律賓料理', ja: 'フィリピン料理' },
  Italian: { 'zh-Hant': '義式料理', ja: 'イタリア料理' },
  Japanese: { 'zh-Hant': '日式料理', ja: '和食' },
  Chinese: { 'zh-Hant': '中式料理', ja: '中華料理' },
  Thai: { 'zh-Hant': '泰式料理', ja: 'タイ料理' },
  Korean: { 'zh-Hant': '韓式料理', ja: '韓国料理' },
  Indian: { 'zh-Hant': '印度料理', ja: 'インド料理' },
  Mexican: { 'zh-Hant': '墨西哥料理', ja: 'メキシコ料理' },
  Mediterranean: { 'zh-Hant': '地中海料理', ja: '地中海料理' },
  American: { 'zh-Hant': '美式料理', ja: 'アメリカ料理' },
  French: { 'zh-Hant': '法式料理', ja: 'フランス料理' },
  Global: { 'zh-Hant': '國際風味', ja: 'グローバル' }
};

const TYPE_I18N = {
  Breakfast: { 'zh-Hant': '早餐', ja: '朝食' },
  Lunch: { 'zh-Hant': '午餐', ja: 'ランチ' },
  Dinner: { 'zh-Hant': '晚餐', ja: 'ディナー' },
  Dessert: { 'zh-Hant': '甜點', ja: 'デザート' },
  Snack: { 'zh-Hant': '點心', ja: 'スナック' },
  Appetizer: { 'zh-Hant': '前菜', ja: '前菜' },
  Soup: { 'zh-Hant': '湯品', ja: 'スープ' },
  Salad: { 'zh-Hant': '沙拉', ja: 'サラダ' },
  Beverage: { 'zh-Hant': '飲品', ja: 'ドリンク' },
  'Main Course': { 'zh-Hant': '主菜', ja: 'メイン' }
};
const BRAND_NAME_BY_LOCALE = {
  en: "Chef Fafa's Recipe",
  'zh-Hant': '花花之食譜',
  ja: "Chef Fafa's Recipe"
};
const PLACEHOLDER_INGREDIENT = 'See source URL for full ingredients list.';
const PLACEHOLDER_METHOD = 'See source URL for full method.';
const PLACEHOLDER_I18N = {
  en: {
    ingredient: PLACEHOLDER_INGREDIENT,
    method: PLACEHOLDER_METHOD
  },
  'zh-Hant': {
    ingredient: '請查看來源網址以獲得完整材料清單。',
    method: '請查看來源網址以獲得完整做法。'
  },
  ja: {
    ingredient: '材料の完全な一覧は元のURLをご確認ください。',
    method: '作り方の全文は元のURLをご確認ください。'
  }
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeBasePath(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return '';
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function withBasePath(urlPath) {
  const normalized = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  return `${BASE_PATH}${normalized}`;
}

function assetUrl(filename) {
  return withBasePath(`/assets/${filename}`);
}

function siteScopedUrl(value) {
  const raw = String(value || '');
  if (raw.startsWith('/assets/')) {
    return withBasePath(raw);
  }
  return raw;
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const source = path.join(from, entry.name);
      const target = path.join(to, entry.name);
      if (entry.isDirectory()) {
        await copyDir(source, target);
      } else {
        await fs.copyFile(source, target);
      }
    })
  );
}

function localizeValue(locale, value, dictionary) {
  if (locale === DEFAULT_LOCALE) return value;
  const row = dictionary[value];
  if (!row) return value;
  return row[locale] || value;
}

function localizeCuisine(locale, cuisine) {
  return localizeValue(locale, cuisine, CUISINE_I18N);
}

function localizeType(locale, type) {
  return localizeValue(locale, type, TYPE_I18N);
}

function brandName(locale) {
  return BRAND_NAME_BY_LOCALE[locale] || BRAND_NAME_BY_LOCALE.en;
}

function localizedRecipeContent(recipe, locale) {
  const localeMap = recipe?.translations && typeof recipe.translations === 'object' ? recipe.translations : null;
  const translated = localeMap && localeMap[locale] && typeof localeMap[locale] === 'object' ? localeMap[locale] : null;

  if (!translated) return recipe;

  let ingredients = Array.isArray(translated.ingredients) && translated.ingredients.length > 0 ? translated.ingredients : recipe.ingredients;
  let instructions = Array.isArray(translated.instructions) && translated.instructions.length > 0 ? translated.instructions : recipe.instructions;

  const placeholder = PLACEHOLDER_I18N[locale] || PLACEHOLDER_I18N.en;
  if (Array.isArray(ingredients) && ingredients.length === 1 && String(ingredients[0]).trim() === PLACEHOLDER_INGREDIENT) {
    ingredients = [placeholder.ingredient];
  }
  if (Array.isArray(instructions) && instructions.length === 1 && String(instructions[0]).trim() === PLACEHOLDER_METHOD) {
    instructions = [placeholder.method];
  }

  return {
    ...recipe,
    title: String(translated.title || recipe.title || ''),
    summary: String(translated.summary || recipe.summary || ''),
    ingredients,
    instructions
  };
}

function indexUrl(locale) {
  return withBasePath(`/${locale}/index.html`);
}

function recipeUrl(locale, slug) {
  return withBasePath(`/${locale}/recipes/${slug}.html`);
}

function hostFromUrl(url) {
  try {
    return new URL(String(url)).hostname;
  } catch {
    return String(url || '');
  }
}

function alternateLinks(page, locale) {
  const lines = Object.keys(LOCALES)
    .map((code) => {
      const href = page.kind === 'index' ? indexUrl(code) : recipeUrl(code, page.slug);
      return `<link rel="alternate" hreflang="${escapeHtml(code)}" href="${href}">`;
    })
    .join('\n  ');

  const fallbackHref = page.kind === 'index' ? indexUrl(DEFAULT_LOCALE) : recipeUrl(DEFAULT_LOCALE, page.slug);
  return `${lines}\n  <link rel="alternate" hreflang="x-default" href="${fallbackHref}">`;
}

function faviconLinks() {
  return `<link rel="icon" type="image/png" sizes="32x32" href="${assetUrl(FAVICON_32_FILE)}?v=${FAVICON_VERSION}">
  <link rel="icon" type="image/png" sizes="512x512" href="${assetUrl(FAVICON_FILE)}?v=${FAVICON_VERSION}">
  <link rel="apple-touch-icon" sizes="180x180" href="${assetUrl(APPLE_TOUCH_ICON_FILE)}?v=${FAVICON_VERSION}">
  <link rel="shortcut icon" href="${assetUrl(FAVICON_32_FILE)}?v=${FAVICON_VERSION}">`;
}

function themeBootScript() {
  return `<script>(function(){try{var k='chief_fafa_theme';var v=localStorage.getItem(k);var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(v==='dark'||v==='light')?v:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(_){}})();</script>`;
}

function themeToggleButton(locale) {
  const labels = LOCALES[locale];
  return `<button class="theme-toggle" type="button" data-theme-toggle data-label-light="${escapeHtml(labels.themeToLight)}" data-label-dark="${escapeHtml(labels.themeToDark)}" aria-label="${escapeHtml(labels.switchTheme)}" title="${escapeHtml(labels.switchTheme)}">${escapeHtml(labels.themeToDark)}</button>`;
}

function heroAudioToggleButton(locale) {
  const labels = LOCALES[locale];
  return `<button class="hero__audio-toggle" type="button" data-hero-audio-toggle data-label-unmute="${escapeHtml(labels.audioUnmute)}" data-label-mute="${escapeHtml(labels.audioMute)}" aria-label="${escapeHtml(labels.audioSwitch)}" title="${escapeHtml(labels.audioSwitch)}">${escapeHtml(labels.audioUnmute)}</button>`;
}

function languageSwitcher(locale, page) {
  const label = LOCALES[locale].language;
  const links = Object.entries(LOCALES)
    .map(([code, info]) => {
      const href = page.kind === 'index' ? indexUrl(code) : recipeUrl(code, page.slug);
      const activeClass = code === locale ? ' is-active' : '';
      return `<a class="lang-link${activeClass}" href="${href}" hreflang="${escapeHtml(code)}" lang="${escapeHtml(code)}">${escapeHtml(info.name)}</a>`;
    })
    .join('');

  return `<div class="lang-switch" aria-label="${escapeHtml(label)}"><span>${escapeHtml(label)}:</span>${links}</div>`;
}

function recipeCard(locale, recipe) {
  const labels = LOCALES[locale];
  const view = localizedRecipeContent(recipe, locale);
  const cuisine = localizeCuisine(locale, recipe.cuisine);
  const type = localizeType(locale, recipe.type);

  const tags = recipe.tags
    .slice(0, 4)
    .map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`)
    .join('');

  const searchable = [
    view.title,
    view.summary,
    recipe.title,
    recipe.summary,
    recipe.cuisine,
    recipe.type,
    recipe.tags.join(' '),
    view.ingredients?.join(' ') || '',
    recipe.ingredients?.join(' ') || ''
  ]
    .join(' ')
    .toLowerCase();

  const image = recipe.image
    ? `<figure class="recipe-card__image"><img src="${escapeHtml(siteScopedUrl(recipe.image))}" alt="${escapeHtml(view.title)}" loading="lazy" decoding="async"></figure>`
    : '<div class="recipe-card__image recipe-card__image--empty" aria-hidden="true"></div>';

  return `
    <article class="recipe-card" data-search="${escapeHtml(searchable)}" data-cuisine="${escapeHtml(cuisine)}" data-type="${escapeHtml(type)}">
      <a class="recipe-card__link" href="${recipeUrl(locale, recipe.slug)}" aria-label="View ${escapeHtml(view.title)}">
        ${image}
        <div class="recipe-card__meta">
          <span>${escapeHtml(cuisine)}</span>
          <span>${escapeHtml(type)}</span>
        </div>
        <h3>${escapeHtml(view.title)}</h3>
        <p>${escapeHtml(view.summary)}</p>
        <div class="recipe-card__time">${escapeHtml(labels.total)}: ${escapeHtml(recipe.totalTime || 'TBD')}</div>
        ${
          recipe.sourceUrl
            ? `<div class="recipe-card__source">${escapeHtml(labels.source)}: <span>${escapeHtml(hostFromUrl(recipe.sourceUrl))}</span></div>`
            : ''
        }
        <div class="recipe-card__chips">${tags}</div>
      </a>
    </article>
  `;
}

function itemListSchema(recipes, locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: brandName(locale),
    inLanguage: locale,
    itemListElement: recipes.map((recipe, index) => {
      const view = localizedRecipeContent(recipe, locale);
      return {
      '@type': 'ListItem',
      position: index + 1,
      name: view.title,
      url: recipeUrl(locale, recipe.slug)
      };
    })
  };
}

function recipeSchema(recipe, locale) {
  const view = localizedRecipeContent(recipe, locale);
  const output = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: view.title,
    description: view.summary,
    inLanguage: locale,
    recipeCuisine: recipe.cuisine,
    recipeCategory: recipe.type,
    recipeIngredient: view.ingredients,
    recipeInstructions: view.instructions.map((step) => ({
      '@type': 'HowToStep',
      text: step
    })),
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    keywords: recipe.tags.join(', '),
    recipeYield: recipe.servings,
    author: {
      '@type': 'Organization',
      name: brandName(locale)
    }
  };

  if (recipe.image) {
    output.image = [siteScopedUrl(recipe.image)];
  }

  return output;
}

function buildIndexHtml({ site, recipes, locale }) {
  const labels = LOCALES[locale];
  const brand = brandName(locale);
  const localizedRecipes = recipes.map((recipe) => localizedRecipeContent(recipe, locale));

  const cuisines = [...new Set(recipes.map((recipe) => localizeCuisine(locale, recipe.cuisine)))].sort();
  const types = [...new Set(recipes.map((recipe) => localizeType(locale, recipe.type)))].sort();

  const cuisineButtons = cuisines
    .map((cuisine) => `<button class="filter-btn" type="button" data-filter-group="cuisine" data-filter-value="${escapeHtml(cuisine)}">${escapeHtml(cuisine)}</button>`)
    .join('');

  const typeButtons = types
    .map((type) => `<button class="filter-btn" type="button" data-filter-group="type" data-filter-value="${escapeHtml(type)}">${escapeHtml(type)}</button>`)
    .join('');

  const cards = recipes.map((recipe) => recipeCard(locale, recipe)).join('');

  const listSchema = JSON.stringify(itemListSchema(recipes, locale));
  const embeddedData = JSON.stringify(
    localizedRecipes.map(({ slug, title, cuisine, type, tags, summary, ingredients }) => ({ slug, title, cuisine, type, tags, summary, ingredients }))
  );
  const canonical = indexUrl(locale);

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(brand)} | ${escapeHtml(labels.navRecipes)}</title>
  <meta name="description" content="${escapeHtml(site.description)}">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="${escapeHtml(brand)}">
  <meta property="og:description" content="${escapeHtml(site.description)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${escapeHtml(locale)}">
  <link rel="canonical" href="${canonical}">
  ${alternateLinks({ kind: 'index' }, locale)}
  ${faviconLinks()}
  ${themeBootScript()}
  <link rel="stylesheet" href="${assetUrl('styles.css')}">
  <script type="application/ld+json">${listSchema}</script>
</head>
<body>
  <div class="bg-orb bg-orb--one" aria-hidden="true"></div>
  <div class="bg-orb bg-orb--two" aria-hidden="true"></div>

  <header class="site-header">
    <a class="site-brand" href="${indexUrl(locale)}">${escapeHtml(brand)}</a>
    <div class="site-header__tools">
      <nav aria-label="Top navigation">
        <a href="#search">${escapeHtml(labels.navSearch)}</a>
        <a href="#recipes">${escapeHtml(labels.navRecipes)}</a>
      </nav>
      ${themeToggleButton(locale)}
      ${languageSwitcher(locale, { kind: 'index' })}
    </div>
  </header>

  <main>
    <section class="hero hero--cover" id="search">
      <div class="hero__cover" data-hero-cover data-hero-interval="3000" data-hero-videos="${assetUrl('fafa_header_video1.mp4')},${assetUrl('fafa_header_video2.mp4')}">
        <img class="hero__cover-image" src="${assetUrl('fafa_header.png')}" alt="${escapeHtml(labels.coverAlt)}" loading="eager" decoding="async">
        <video class="hero__cover-video" data-hero-video muted playsinline webkit-playsinline preload="metadata" poster="${assetUrl('fafa_header.png')}" aria-hidden="true">
          <source src="${assetUrl('fafa_header_video1.mp4')}" type="video/mp4">
        </video>
        ${heroAudioToggleButton(locale)}
      </div>
      <div class="hero__content">
        <p class="eyebrow">${escapeHtml(labels.heroEyebrow)}</p>
        <h1>${escapeHtml(labels.heroTitle)}</h1>
        <p>${escapeHtml(labels.heroSubtitle)}</p>
        <label class="search-label" for="recipe-search">${escapeHtml(labels.searchLabel)}</label>
        <div class="search-wrap">
          <input id="recipe-search" type="search" placeholder="${escapeHtml(labels.searchPlaceholder)}" autocomplete="off">
        </div>
        <div class="stats"><span id="result-count">${recipes.length}</span> ${escapeHtml(labels.recipesIndexed)}</div>
      </div>
    </section>

    <section class="filters" aria-label="Recipe filters">
      <div>
        <h2>${escapeHtml(labels.cuisines)}</h2>
        <div class="filter-row">
          <button class="filter-btn is-active" type="button" data-filter-group="cuisine" data-filter-value="all">${escapeHtml(labels.allCuisines)}</button>
          ${cuisineButtons}
        </div>
      </div>
      <div>
        <h2>${escapeHtml(labels.types)}</h2>
        <div class="filter-row">
          <button class="filter-btn is-active" type="button" data-filter-group="type" data-filter-value="all">${escapeHtml(labels.allTypes)}</button>
          ${typeButtons}
        </div>
      </div>
    </section>

    <section class="recipes" id="recipes" aria-live="polite">
      <div class="recipes-grid" id="recipe-grid">
        ${cards}
      </div>
      <p class="empty-state is-hidden" id="empty-state">${escapeHtml(labels.noResults)}</p>
    </section>
  </main>

  <footer class="site-footer">
    <p>${escapeHtml(labels.footerIndex)}</p>
  </footer>

  <script id="recipe-data" type="application/json">${embeddedData}</script>
  <script src="${assetUrl('app.js')}" defer></script>
</body>
</html>`;
}

function buildRecipeHtml({ site, recipe, locale }) {
  const labels = LOCALES[locale];
  const brand = brandName(locale);
  const view = localizedRecipeContent(recipe, locale);
  const schema = JSON.stringify(recipeSchema(recipe, locale));

  const ingredients = view.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const steps = view.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
  const tags = recipe.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('');
  const cuisine = localizeCuisine(locale, recipe.cuisine);
  const type = localizeType(locale, recipe.type);

  const image = recipe.image
    ? `<figure class="recipe-hero-image"><img src="${escapeHtml(siteScopedUrl(recipe.image))}" alt="${escapeHtml(view.title)}" loading="eager" decoding="async"></figure>`
    : '';

  const sourceLinks = `
      <section class="recipe-source-links">
        ${
          recipe.sourceUrl
            ? `<p><strong>${escapeHtml(labels.source)}:</strong> <a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.sourceUrl)}</a></p>`
            : ''
        }
        ${
          recipe.googleDocUrl
            ? `<p><strong>${escapeHtml(labels.googleDoc)}:</strong> <a href="${escapeHtml(recipe.googleDocUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.googleDocUrl)}</a></p>`
            : ''
        }
      </section>
  `;

  const canonical = recipeUrl(locale, recipe.slug);

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(view.title)} | ${escapeHtml(brand)}</title>
  <meta name="description" content="${escapeHtml(view.summary)}">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="${escapeHtml(view.title)}">
  <meta property="og:description" content="${escapeHtml(view.summary)}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="${escapeHtml(locale)}">
  ${recipe.image ? `<meta property="og:image" content="${escapeHtml(siteScopedUrl(recipe.image))}">` : ''}
  <link rel="canonical" href="${canonical}">
  ${alternateLinks({ kind: 'recipe', slug: recipe.slug }, locale)}
  ${faviconLinks()}
  ${themeBootScript()}
  <link rel="stylesheet" href="${assetUrl('styles.css')}">
  <script type="application/ld+json">${schema}</script>
</head>
<body>
  <div class="bg-orb bg-orb--one" aria-hidden="true"></div>
  <div class="bg-orb bg-orb--two" aria-hidden="true"></div>

  <header class="site-header">
    <a class="site-brand" href="${indexUrl(locale)}">${escapeHtml(brand)}</a>
    <div class="site-header__tools">
      <nav aria-label="Top navigation">
        <a href="${indexUrl(locale)}">${escapeHtml(labels.allRecipes)}</a>
      </nav>
      ${themeToggleButton(locale)}
      ${languageSwitcher(locale, { kind: 'recipe', slug: recipe.slug })}
    </div>
  </header>

  <main class="recipe-page">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="${indexUrl(locale)}">${escapeHtml(labels.home)}</a>
      <span>/</span>
      <span>${escapeHtml(cuisine)}</span>
      <span>/</span>
      <span>${escapeHtml(view.title)}</span>
    </nav>

    <article>
      <p class="eyebrow">${escapeHtml(cuisine)} • ${escapeHtml(type)}</p>
      <h1>${escapeHtml(view.title)}</h1>
      <p class="recipe-summary">${escapeHtml(view.summary)}</p>
      ${image}
      ${sourceLinks}

      <section class="recipe-stats" aria-label="Recipe details">
        <div><strong>${escapeHtml(labels.prep)}:</strong> ${escapeHtml(recipe.prepTime || 'TBD')}</div>
        <div><strong>${escapeHtml(labels.cook)}:</strong> ${escapeHtml(recipe.cookTime || 'TBD')}</div>
        <div><strong>${escapeHtml(labels.total)}:</strong> ${escapeHtml(recipe.totalTime || 'TBD')}</div>
        <div><strong>${escapeHtml(labels.servings)}:</strong> ${escapeHtml(recipe.servings || 'TBD')}</div>
      </section>

      <div class="recipe-tags">${tags}</div>

      <section>
        <h2>${escapeHtml(labels.ingredients)}</h2>
        <ul class="ingredient-list">
          ${ingredients}
        </ul>
      </section>

      <section>
        <h2>${escapeHtml(labels.instructions)}</h2>
        <ol class="instruction-list">
          ${steps}
        </ol>
      </section>
    </article>
  </main>

  <footer class="site-footer">
    <p>${escapeHtml(labels.footerRecipe)}</p>
  </footer>
  <script src="${assetUrl('app.js')}" defer></script>
</body>
</html>`;
}

function buildRootIndex() {
  const englishUrl = indexUrl('en');
  const chineseUrl = indexUrl('zh-Hant');
  const japaneseUrl = indexUrl('ja');
  const brand = brandName('en');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(brand)}</title>
  ${faviconLinks()}
  <meta http-equiv="refresh" content="0; url=${englishUrl}">
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; }
    a { display: inline-block; margin: 0.35rem 0.5rem 0 0; }
  </style>
</head>
<body>
  <p>Redirecting to localized site...</p>
  <p>
    <a href="${englishUrl}">English</a>
    <a href="${chineseUrl}">繁體中文</a>
    <a href="${japaneseUrl}">日本語</a>
  </p>
  <script>
    const lang = (navigator.language || '').toLowerCase();
    let target = '${englishUrl}';
    if (lang.startsWith('zh')) target = '${chineseUrl}';
    if (lang.startsWith('ja')) target = '${japaneseUrl}';
    location.replace(target);
  </script>
</body>
</html>`;
}

function buildSitemap(recipes) {
  const urls = [withBasePath('/index.html')];

  for (const locale of Object.keys(LOCALES)) {
    urls.push(indexUrl(locale));
    for (const recipe of recipes) {
      urls.push(recipeUrl(locale, recipe.slug));
    }
  }

  const lines = urls
    .map((url) => {
      const priority = url.endsWith('/index.html') ? '0.9' : '0.8';
      return `  <url>\n    <loc>${url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines}
</urlset>`;
}

async function main() {
  const payloadRaw = await fs.readFile(DATA_PATH, 'utf8');
  const payload = JSON.parse(payloadRaw);

  if (!payload.recipes || payload.recipes.length === 0) {
    throw new Error('data/recipes.json has no recipes. Run the importer first.');
  }

  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await copyDir(STATIC_DIR, OUTPUT_DIR);

  for (const locale of Object.keys(LOCALES)) {
    const localeRoot = path.join(OUTPUT_DIR, locale);
    const recipeDir = path.join(localeRoot, 'recipes');
    await fs.mkdir(recipeDir, { recursive: true });

    const indexHtml = buildIndexHtml({
      site: payload.site,
      recipes: payload.recipes,
      locale
    });
    await fs.writeFile(path.join(localeRoot, 'index.html'), indexHtml, 'utf8');

    await Promise.all(
      payload.recipes.map(async (recipe) => {
        const html = buildRecipeHtml({ site: payload.site, recipe, locale });
        await fs.writeFile(path.join(recipeDir, `${recipe.slug}.html`), html, 'utf8');
      })
    );
  }

  await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), buildRootIndex(), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIR, 'sitemap.xml'), buildSitemap(payload.recipes), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${withBasePath('/sitemap.xml')}\n`, 'utf8');

  process.stdout.write(`Built ${payload.recipes.length} recipe pages for ${Object.keys(LOCALES).length} locales in ${OUTPUT_DIR}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
