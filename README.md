# Posts of my little blog

![](https://img.shields.io/endpoint?url=https://cloudflare-pages-badge.nirmoe-badge.workers.dev/project/nir-moe)

I wanted to write my blog w/o getting my hands on the theme(I don't have the time nor the courage to play with it), so I splitted it out, and the remains, the most important part where the posts lives, is this repo.

Check it out at [nir.moe](https://nir.moe) or [github.io](https://noirgif.github.io).

## Writing

Posts are Markdown in `source/_posts/`, drafts in `source/_drafts/`. You need Node 22+ and
bun 1.4+ (older bun can't read `bun.lock`; `npx -y bun@latest` works as a stand-in).

```sh
bun install
npx hexo new "Post Title"        # new post
npx hexo new draft "Draft Title" # new draft
npx hexo publish "Draft Title"   # draft -> post
npx hexo new diary "Title"       # photo diary entry (scaffolds/diary.md)
npx hexo server                  # preview at http://localhost:4000
bun run build                    # generate the site into dist/
```

- **Language:** set `lang: en`, `lang: zh-cn` or `lang: ja-jp` in the front matter. It picks the
  page language, the CJK webfont region, the giscus language and the per-language feed
  (`/en/rss.xml`, `/zh-cn/rss.xml`; everything is also in `/rss-all.xml`).
- **Images:** reference them as usual (`![](/assets/image/photo.jpg)`, a file in the post's
  asset folder, or `{% image %}`). The theme resizes them to WebP with `srcset` and intrinsic
  sizes at build time, so no CDN or manual resizing is needed.
- **Callouts:** `{% alert info %}Markdown{% endalert %}`.
- **Lyrics with commentary:** a two-column block, lyrics on the left and notes on the right
  (stacked on phones). Rows are separated by `===`, a row's lyrics and its Markdown note by
  `---`; the note is optional. The argument marks the lyrics' language, so Japanese lyrics in a
  Chinese post get the Japanese serif (and Chinese quotes in a Japanese post the Chinese one):

  ```
  {% lyrics ja %}
  今、僕、アンダーグラウンドから
  響けよ　アンダーグラウンドから
  ---
  Commentary in **Markdown**.
  ===
  Next stanza
  {% endlyrics %}
  ```
- **Math:** `{% katex %}\lim_{x \to \infty}{% endkatex %}` (hexo-math), rendered to MathML at
  build time.

## Theme

The site uses the in-repo theme `themes/nir` (a reimagining of the old Tranquilpeak look): no
jQuery, no web fonts for Latin text, inlined CSS, seamless page transitions, local search with
highlighting, giscus comments, the snow easter egg, and light/dark mode that follows the OS.
Chinese and Japanese text gets a serif webfont subset to exactly the characters on each page.

## Deployment

Cloudflare Pages builds every push with `bun install --frozen-lockfile && bun run
build:cloudflare` and serves `dist/`. The old GitHub Pages mirror is updated with
`npx hexo deploy`.

Notes for coding agents (architecture and performance rules) are in [AGENTS.md](AGENTS.md).
