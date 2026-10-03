# Agent instructions

## Build and validate

Use Bun `>=1.4.2` to install dependencies, build the static site, and run checks. The project requires Node.js `^24.15.0` (Node.js 24.x, starting at 24.15.0):

```sh
bun install
bun run build
bun run check
```

The build writes deployable files to `dist/`. Do not edit generated files there by hand.

## Deploy to nir.moe (Cloudflare Pages)

### Primary: Push to tracked branch

The repository is connected to Cloudflare Pages project **nir-moe** tracking branch `import/goddess-unknown-static`.

```sh
# 1. Commit and push (triggers Cloudflare Pages build automatically)
git add -A && git commit -m "your message" && git push origin import/goddess-unknown-static

# 2. Poll deployment status via wrangler
npx wrangler pages deployment list --project-name nir-moe

# 3. Watch specific deployment (JSON for parsing)
npx wrangler pages deployment list --project-name nir-moe --json | jq '.[0] | {Id, Status, Deployment, Build}'
```

### Verify deployment

```sh
# Production URL (custom domain)
curl -sI https://nir.moe

# Preview URL from deployment ID
curl -s https://<deployment-id>.nir-moe.pages.dev
```

### Project details

| Item | Value |
|------|-------|
| Cloudflare Pages project | `nir-moe` |
| Tracked branch | `import/goddess-unknown-static` |
| Custom domains | `nir.moe`, `www.nir.moe` |
| Build command (in dashboard) | `bun install --frozen-lockfile && bun run build:cloudflare` |
| Output directory | `dist` |
| Build dashboard | https://dash.cloudflare.com/69ce9dcb71f8b05d8b97829ad2e02c5a/pages/view/nir-moe |

### Alternative deploy targets

- **GitHub Pages**: Push to `main`/`master` triggers `.github/workflows/pages.yml`
- **Netlify**: Connect repo; uses `netlify.toml` config

### Local preview

```sh
bun run preview  # serves dist/ at http://localhost:4173/
```

## Submit a PageSpeed Insights test

Submit fresh tests through the official [PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started), using `PAGESPEED_API_KEY` from the environment. Do not ask the user to submit a report or substitute browser `vitals` for PSI results.

1. Verify that the requested deployment is live. Use `https://nir.moe/` for production, not localhost or an unrelated preview.
2. Confirm the API key is configured without printing it. Use the authenticated `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed` endpoint with `url`, `strategy=mobile` or `desktop`, and repeated `category` parameters for `performance`, `accessibility`, `best-practices`, and `seo`. Read the key directly from the environment; never paste it into tool arguments, logs, or committed files.
3. Run the two strategies sequentially, allowing up to 180 seconds per request. Require HTTP success, a `lighthouseResult`, no `runtimeError`, and the expected target URL and `configSettings.formFactor`. Stop on authentication/quota errors instead of retrying rapidly or changing identities.
4. Save each complete JSON response outside the repository. Report `fetchTime`, category scores multiplied by 100, and the FCP, LCP, TBT, CLS, and Speed Index audits. Use `numericValue`/`numericUnit` for precision and note any `runWarnings`. API results do not provide a PSI web-report permalink; retain the JSON artifact path rather than inventing one.

Example (Node.js, run from Bash):

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const key = process.env.PAGESPEED_API_KEY;
if (!key) throw Error('PAGESPEED_API_KEY is not configured');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nir-moe-pagespeed-'));
for (const strategy of ['mobile', 'desktop']) {
  const url = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  url.searchParams.set('url', 'https://nir.moe/');
  url.searchParams.set('strategy', strategy);
  for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) {
    url.searchParams.append('category', category);
  }
  url.searchParams.set('key', key);
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw Error(`PSI HTTP ${response.status}; stop and inspect the error without exposing the key`);
  const report = await response.json();
  const result = report.lighthouseResult;
  if (!result || result.runtimeError || !result.categories?.performance
      || result.requestedUrl !== 'https://nir.moe/'
      || result.finalUrl !== 'https://nir.moe/'
      || result.configSettings?.formFactor !== strategy) {
    throw Error('Missing, failed, or unexpected Lighthouse result');
  }
  const file = path.join(directory, `${strategy}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({
    strategy, file, fetchTime: result.fetchTime, warnings: result.runWarnings,
    scores: Object.fromEntries(Object.entries(result.categories).map(([id, c]) => [id, c.score === null ? null : Math.round(c.score * 100)])),
    metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'].map(id => [id, {
      value: result.audits[id]?.numericValue, unit: result.audits[id]?.numericUnit
    }]))
  }, null, 2));
}
NODE
```
