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

Submit a fresh analysis yourself; do not ask the user to submit it or substitute an existing report for a new run.

1. Verify that the requested deployment is live. Use `https://nir.moe/` for production, not localhost or an unrelated preview.
2. Use native `agent_browser` to open <https://pagespeed.web.dev/> and run `snapshot -i`. Keep the returned session identity for all follow-up commands. If the cookie notice is present, dismiss it and refresh the snapshot.
3. Fill the current required textbox ref with `https://nir.moe/`. Verify its value with `get value <ref>`, then click the current **Analyze** button once. Refresh refs after any rerender; do not reuse another session's refs.
4. Wait for the analysis to finish, checking for either a completed report or an explicit error. `Running analysis`, click dispatch, and the intermediate `/analysis?url=...` URL do not prove success. Do not wait for the generic word `Performance`: footer text can satisfy it before results exist. Verify the report's timestamp, target URL, selected Mobile/Desktop tab, category scores, and FCP/LCP/TBT/CLS/Speed Index values.
5. Use **Copy Link** to capture the generated report permalink, normally `/analysis/<site-slug>/<report-id>?form_factor=mobile` (or `desktop`). Select the other form-factor tab and verify its results if both are requested; do not resubmit unnecessarily. Report only values read from the completed report.
6. If PSI shows `Unable to resolve`, inspect `network requests` in that same session and use its `network request <request-id>` follow-up to inspect the failed `POST /_/PagespeedUi/data/batchexecute` status and response body before deciding what failed. HTTP 429 with Google's automated-query refusal is an automation/rate-limit block, not evidence of bad site DNS. Stop on that block; do not rotate domains, browser identities, or networks to evade it. A shell HTTP 200 cannot establish that PSI accepted the test. Report the blocker honestly rather than using browser `vitals` as PSI results.
