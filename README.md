# Posts of my little blog

![](https://img.shields.io/endpoint?url=https://cloudflare-pages-badge.nirmoe-badge.workers.dev/project/nir-moe)

I wanted to write my blog w/o getting my hands on the theme(I don't have the time nor the courage to play with it), so I splitted it out, and the remains, the most important part where the posts lives, is this repo.

Check it out at [nir.moe](https://nir.moe) or [github.io](https://norigif.github.io).

## Writing

Nothing changed for writing: posts are Markdown in `source/_posts/`, drafts in `source/_drafts/`.

```sh
bun install
npx hexo new "Post Title"        # new post
npx hexo new draft "Draft Title" # new draft
npx hexo publish "Draft Title"   # draft -> post
npx hexo server                  # preview at http://localhost:4000
bun run build                    # generate the site into dist/
```

Images can be referenced as usual (`![](/assets/image/photo.jpg)` or `{% image %}`); the theme
resizes them to WebP with `srcset` and intrinsic sizes at build time.

## Theme

The site uses the in-repo theme `themes/nir` (a reimagining of the old Tranquilpeak look): no
jQuery or web fonts, inlined CSS, seamless page transitions, local search with highlighting,
giscus comments, the snow easter egg, and light/dark mode that follows the OS.
