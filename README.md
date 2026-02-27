# Chief Fafa's Recipe Website

Modern static recipe site with:

- Multilingual pages: English (`/en`), Traditional Chinese (`/zh-Hant`), Japanese (`/ja`)
- Search-friendly recipe pages with clean URLs and `hreflang`
- Auto-categorized cuisines and recipe types from recipe content
- Google Doc image extraction into local site assets
- Structured data (`schema.org/Recipe`), sitemap, and robots
- Backend refresh service for automatic Google Doc sync

## Project Structure

- `scripts/import-google-doc.mjs`: Single-doc importer/parser with image extraction.
- `scripts/refresh_from_doc_ids.mjs`: Batch extract images + original URLs from fixed Doc IDs.
- `scripts/build-site.mjs`: Builds multilingual static website into `site/`.
- `scripts/refresh_service.mjs`: Backend HTTP service with auto-refresh scheduler.
- `data/doc-assets.json`: Extracted doc/image/source-url report.
- `data/recipes.json`: Parsed recipe data used by the site builder.
- `static/assets/*`: Frontend JS/CSS and extracted recipe images.
- `site/*`: Generated static website output.

## One-Time Manual Refresh

```bash
npm run refresh
npm run build
```

## Backend Service (Automatic Refresh)

Run the service:

```bash
npm run service
```

Default behavior:

- Listens on `http://127.0.0.1:8789`
- Runs refresh on startup
- Auto-runs refresh every 30 minutes
- Serves the generated website directly from `site/`

### Service API

- `GET /api/health` or `GET /api/status`: current state, last run, next run, recent logs
- `POST /api/refresh`: trigger immediate refresh (also accepts `GET`)
- `GET /api/logs`: recent service logs

### Optional Environment Variables

- `RECIPE_SERVICE_HOST` (default `127.0.0.1`)
- `RECIPE_SERVICE_PORT` (default `8789`)
- `RECIPE_REFRESH_INTERVAL_MINUTES` (default `30`)
- `RECIPE_AUTO_REFRESH` (`1` or `0`, default `1`)
- `RECIPE_RUN_ON_START` (`1` or `0`, default `1`)
- `RECIPE_SERVICE_TOKEN` (if set, required for `/api/refresh` and `/api/logs` via `x-service-token` header or `?token=`)
- `RECIPE_DOC_IDS` (comma-separated override list)
- `RECIPE_ENV_FILE` (custom `.env` path)

## Google Docs OAuth Env

Private doc access uses the same env naming as ChiefFaFaBot:

- `GOOGLE_DOCS_CLIENT_ID`
- `GOOGLE_DOCS_CLIENT_SECRET`
- `GOOGLE_DOCS_REFRESH_TOKEN`
- `GOOGLE_DOCS_ACCESS_TOKEN` (optional fallback)

The scripts automatically check:

- `/Users/felixlee/Documents/ChiefFaFaBot/.env`
- `.env` in this project

## GitHub Pages Deployment

This project includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

After pushing this repository to GitHub on the `main` branch:

1. Open repo `Settings` -> `Pages`
2. Set `Source` to `GitHub Actions`
3. Push to `main` (or re-run the workflow)

The workflow builds the static site with `node scripts/build-site.mjs` and publishes the generated `site/` folder.
