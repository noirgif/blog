import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import { marked } from 'marked';
import { load } from 'cheerio';
import sharp from 'sharp';
import katex from 'katex';

const root=process.cwd(), out=path.join(root,'dist');
const config=JSON.parse(await fs.readFile('site.config.json','utf8'));
const rawBase=process.env.BASE_PATH??config.basePath??'';
const base=rawBase==='/'?'':'/'+rawBase.replace(/^\/+|\/+$/g,'');
const BASE=base==='/'?'':base;
if(BASE.includes('..')||/[?#\\]/.test(BASE))throw Error('BASE_PATH must be a URL path, such as /blog.');
const origin=(process.env.SITE_URL??process.env.CF_PAGES_URL??process.env.URL??config.url??'').replace(/\/$/,'');
const url=p=>BASE+p, esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const list=v=>v==null?[]:Array.isArray(v)?v.map(String):[String(v)];
const warnings=new Set(),imageCache=new Map();
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(path.join(out,'data'),{recursive:true});
await fs.cp('public/media',path.join(out,'media'),{recursive:true});
await fs.cp('node_modules/katex/dist',path.join(out,'vendor/katex'),{recursive:true,filter:p=>!p.endsWith('.js')&&!p.endsWith('.map')});
await fs.copyFile('theme/style.css',path.join(out,'style.css'));await fs.copyFile('theme/app.js',path.join(out,'app.js'));

async function files(dir){const result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await files(p));else if(e.name.endsWith('.md'))result.push(p)}return result.sort()}
function validRoute(route){if(!route.startsWith('/')||route.includes('..')||/[?#\\]/.test(route))throw Error(`Invalid route: ${route}`);return route.replace(/\/$/,'')||'/'}
function timestamp(value,file){if(!value)throw Error(`Missing date in ${file}. Use date: YYYY-MM-DD HH:mm:ss`);const d=value instanceof Date?value:new Date(String(value).replace(' ','T')+(/(?:Z|[+-]\d\d:\d\d)$/.test(String(value))?'':'Z'));if(!Number.isFinite(d.getTime()))throw Error(`Invalid date in ${file}`);return d.toISOString()}
function legacy(md){
 md=md.replace(/{%\s*(?:raw|endraw)\s*%}/g,'');
 md=md.replace(/{%\s*codeblock([^%]*)%}([\s\S]*?){%\s*endcodeblock\s*%}/g,(_,opts,body)=>`\n<pre><code class="language-${esc(opts.match(/lang:(\w+)/)?.[1]||'text')}">${esc(body.trim())}</code></pre>\n`);
 md=md.replace(/{%\s*katex\s*([^%]*)%}([\s\S]*?){%\s*endkatex\s*%}/g,(_,opts,body)=>katex.renderToString(body.trim(),{displayMode:opts.includes('display'),throwOnError:false,output:'html'}));
 md=md.replace(/{%\s*(quote|blockquote)([^%]*)%}([\s\S]*?){%\s*end(?:quote|blockquote)\s*%}/g,(_,tag,by,body)=>`\n<blockquote>${marked.parse(legacy(body))}${by.trim()?`<cite>${esc(by.trim())}</cite>`:''}</blockquote>\n`);
 md=md.replace(/{%\s*alert([^%]*)%}([\s\S]*?){%\s*endalert\s*%}/g,(_,kind,body)=>`\n<aside class="notice">${marked.parse(legacy(body))}</aside>\n`);
 md=md.replace(/{%\s*(?:image|img)\s+([^%]*)%}/g,(_,args)=>{const tokens=args.match(/"[^"]*"|'[^']*'|\S+/g)?.map(x=>x.replace(/^["']|["']$/g,''))||[];const n=tokens.findIndex(t=>/^(https?:|\/|assets\/|\.\/)/.test(t));if(n<0)throw Error('Unrecognized image tag: '+args);const caption=tokens.slice(n+1).join(' ');return `\n<figure><img src="${esc(tokens[n])}" alt="${esc(caption)}">${caption?`<figcaption>${esc(caption)}</figcaption>`:''}</figure>\n`});
 md=md.replace(/{%\s*iframe\s+(\S+)([^%]*)%}/g,(_,src,dimensions)=>{const [w,h]=dimensions.trim().split(/\s+/);return `\n<iframe src="${esc(src.startsWith('//')?'https:'+src:src)}" title="Embedded content" width="${Number(w)||646}" height="${Number(h)||190}" loading="lazy"></iframe>\n`});
 md=md.replace(/<!--\s*entry\s*-->([\s\S]*?)<!--\s*\/entry\s*-->/g,(_,body)=>`\n<section class="photo-diary-entry">${marked.parse(body)}</section>\n`);
 return md.replace(/<!--\s*(?:more|excerpt)\s*-->/g,'');
}
marked.use({gfm:true,breaks:false,renderer:{heading({tokens,depth}){const text=this.parser.parseInline(tokens);const plain=load(text,null,false).text();const slug=plain.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s+/g,'-');return `<h${depth} id="${esc(slug)}">${text}</h${depth}>\n`}}});
async function image(src){
 if(imageCache.has(src))return imageCache.get(src);
 const task=(async()=>{
  let relative=src;
  if(relative.startsWith('https://nir.moe/'))relative=new URL(relative).pathname;
  if(relative.startsWith('assets/'))relative='/'+relative;
  if(!relative.startsWith('/assets/')&&!relative.startsWith('/media/')){const cached='/media/'+hash(src)+'.jpg';try{const m=await sharp(path.join(root,'public',cached)).metadata();return {full:cached,tiny:cached.replace('.jpg','-tiny.jpg'),width:m.width,height:m.height}}catch{return null}}
  const file=path.join(root,'public',decodeURIComponent(relative));if(!file.startsWith(path.join(root,'public')+path.sep))throw Error('Invalid asset path');
  try{
   await fs.access(file);const id=hash(relative),full='/media/'+id+'.jpg',tiny='/media/'+id+'-tiny.jpg';const data=await sharp(file,{animated:false}).rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality:86,progressive:true}).toBuffer({resolveWithObject:true});
   await fs.writeFile(path.join(out,full),data.data);await sharp(data.data).resize({width:36,height:36,fit:'inside'}).jpeg({quality:45}).toFile(path.join(out,tiny));
   return {full,tiny,width:data.info.width,height:data.info.height};
  }catch(e){warnings.add('Missing/unreadable local image: '+relative);return null}
 })();imageCache.set(src,task);return task;
}
async function renderMarkdown(md,title){
 const $=load(marked.parse(legacy(md)),null,false);
 $('script').remove();$('[onclick],[onload],[onerror]').each((i,el)=>{for(const attr of Object.keys(el.attribs))if(attr.startsWith('on'))$(el).removeAttr(attr)});
 await Promise.all($('img').toArray().map(async el=>{const img=$(el),src=img.attr('src')||'';const converted=await image(src);if(converted){img.attr({src:converted.full,'data-full':converted.full,'data-preview':converted.tiny,width:converted.width,height:converted.height,class:'progressive sharp',loading:'lazy',decoding:'async',alt:img.attr('alt')||title+' photograph'})}else {if(src.startsWith('/assets/')||src.startsWith('assets/')){img.replaceWith('<p class="empty">This photograph is unavailable from the original source.</p>');return;}img.attr({loading:'lazy',decoding:'async',alt:img.attr('alt')||title+' photograph'})}}));
 $('a[href]').each((i,el)=>{const a=$(el),href=a.attr('href');if(/^javascript:/i.test(href))a.removeAttr('href');else if(/^\/\d{4}\/\d{2}\/\d{2}\//.test(href))a.attr('href','/posts/'+href.split('/').filter(Boolean).at(-1)+'/');else if(href.startsWith('https://nir.moe/'))a.attr('href',new URL(href).pathname+new URL(href).hash);else if(/^https?:\/\//.test(href))a.attr({target:'_blank',rel:'noopener'})});
 return $.root().contents().toArray().map(el=>$.html(el)).filter(x=>x.trim());
}
const documents=[];
for(const file of await files('source')){
 if(file.split(path.sep).some(s=>s==='_drafts'))continue;
 const parsed=matter(await fs.readFile(file,'utf8')),d=parsed.data;
 if(d.draft===true||d.published===false)continue;
 if(d.title==null||!String(d.title).trim())throw Error('Missing title in '+file);d.title=String(d.title);
 const post=file.startsWith('source'+path.sep+'_posts'+path.sep);
 const slug=String(d.slug||path.basename(file,'.md'));
 const route=validRoute(d.permalink?'/'+String(d.permalink).replace(/^\/+|\/+$/g,''):post?'/posts/'+slug:'/'+path.relative('source',file).replace(/(?:\/index)?\.md$/,''));
 const date=post?timestamp(d.date,file):d.date?timestamp(d.date,file):'';
 const blocks=await renderMarkdown(parsed.content,d.title),body=blocks.join('');const $=load(body,null,false);
 const searchText=$.root().text().replace(/\s+/g,' ').trim();
 const paragraphs=$('p').toArray().map(el=>$(el).text().replace(/\s+/g,' ').trim()).filter(Boolean);
 const firstText=paragraphs.find(t=>!t.startsWith('This photograph is unavailable'))||String(d.description||searchText);
 const firstSentence=[...new Intl.Segmenter(d.lang||'en',{granularity:'sentence'}).segment(firstText)][0]?.segment.trim()||d.title;
 documents.push({path:route,title:d.title,date,category:list(d.categories??d.category)[0]||'uncategorized',tags:list(d.tags),excerpt:String(d.description||searchText.slice(0,180)),searchText,paragraphs,firstSentence,image:$('img[data-preview]').first().attr('data-preview')||null,blocks,post,lang:d.lang||'en',aliases:list(d.alias||d.aliases),sitemap:d.sitemap!==false});
}
documents.sort((a,b)=>b.date.localeCompare(a.date)||a.path.localeCompare(b.path));
const posts=documents.filter(d=>d.post);const paths=new Set();for(const d of documents){if(paths.has(d.path))throw Error('Duplicate permalink: '+d.path);paths.add(d.path)}
const stamp=s=>s?new Date(s).toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric',timeZone:'UTC'}):'';
const category=p=>`<a class="category" href="/categories/${encodeURIComponent(p.category)}">${esc(p.category)}</a>`;
const row=p=>`<div class="row"><time class="date">${esc(stamp(p.date))}</time><a href="${esc(p.path)}/">${esc(p.title)}</a></div>`;
const card=p=>`<article class="post-card"><div class="meta"><time>${esc(stamp(p.date))}</time><span>·</span>${category(p)}</div><h2><a href="${esc(p.path)}/">${esc(p.title)}</a></h2>${p.image?`<a href="${esc(p.path)}/" class="preview-images"><img class="progressive sharp" src="${p.image.replace('-tiny.jpg','.jpg')}" data-full="${p.image.replace('-tiny.jpg','.jpg')}" data-preview="${p.image}" loading="lazy" alt="${esc(p.title)}"></a>`:''}<p>${esc(p.excerpt.slice(0,165))}…</p></article>`;
const heading=(title,sub='',kicker='JOURNAL')=>`<div class="section-heading"><h1 tabindex="-1">${esc(title)}</h1></div>`;
function related(d){if(!d.post)return '';const ranked=posts.filter(p=>p.path!==d.path).map(p=>({p,overlap:p.tags.filter(t=>d.tags.includes(t)).length})).sort((a,b)=>b.overlap-a.overlap||Number(b.p.category===d.category)-Number(a.p.category===d.category)||b.p.date.localeCompare(a.p.date)||a.p.path.localeCompare(b.p.path));const p=ranked[0]?.p;if(!p)return '';return `<aside class="related-post" aria-label="Related post"><span class="related-label">Related post</span><h2><a href="${esc(p.path)}/">${esc(p.title)}</a></h2><p>${esc(p.firstSentence)}</p></aside>`}
const article=d=>`<div class="article-head"><div class="meta"><time>${esc(stamp(d.date))}</time>${d.post?'<span>·</span>'+category(d):''}</div><h1 tabindex="-1">${esc(d.title)}</h1></div>${d.blocks.map(b=>`<div class="article-body">${b}</div>`).join('')}${related(d)}`;
let template=await fs.readFile('theme/index.html','utf8');
function prefixed(html){const $=load(html);$('[href],[src],[data-full],[data-preview]').each((i,el)=>{for(const a of ['href','src','data-full','data-preview']){const v=$(el).attr(a);if(v?.startsWith('/')&&!v.startsWith('//'))$(el).attr(a,url(v))}});return $.html()}
const generated=[];
async function page(route,title,body,kicker='Journal',lang='en'){
 route=validRoute(route);const $=load(template);$('html').attr('lang',lang);if(documents.find(d=>d.path===route)?.post){$('body').addClass('post-view');$('.sidebar').attr({'inert':'','aria-hidden':'true'})}$('title').text(title===config.title?title:title+' · '+config.title);$('meta[name="description"]').attr('content',config.description);$('.wordmark').contents().first().replaceWith(esc(config.title.toUpperCase()));$('.cover').attr('src',config.cover);$('.avatar').attr('src',config.avatar);$('.profile strong').text(config.author);$('#content').attr({'aria-busy':'false','data-prebuilt':'true'}).html(body);$('#breadcrumb').text(kicker);$('nav a[data-nav]').each((i,el)=>{if($(el).attr('data-nav')===route)$(el).addClass('active').attr('aria-current','page')});$('head').append(`<link rel="stylesheet" href="/vendor/katex/katex.min.css"><script>window.__SITE_BASE__=${JSON.stringify(BASE).replace(/</g,'\\u003c')};window.__POSTS_PER_PAGE__=${Number(config.postsPerPage)||8};</script>`);if(origin)$('head').append(`<link rel="canonical" href="${esc(origin+url(route==='/'?'/':route+'/'))}">`);const final=prefixed($.html());const destination=path.join(out,route==='/'?'':decodeURIComponent(route));await fs.mkdir(destination,{recursive:true});await fs.writeFile(path.join(destination,'index.html'),final);generated.push(route);return final;
}
for(const d of documents)await page(d.path,d.title,article(d),'Journal / '+(d.post?'Entry':d.title),d.lang);
await page('/',config.title,posts.slice(0,config.postsPerPage||8).map(card).join('')+'<a class="chip" href="/all-archives/">Browse all entries</a>');
let year='';await page('/all-archives','Archives',posts.map(p=>{const y=p.date.slice(0,4);const h=y!==year?`<h2 class="year-title">${esc(y)}</h2>`:'';year=y;return h+row(p)}).join(''),'Journal / Archives');
for(const kind of ['categories','tags']){
 const counts=new Map();for(const p of posts)for(const k of kind==='tags'?p.tags:[p.category])counts.set(k,(counts.get(k)||0)+1);
 await page('/all-'+kind,kind==='tags'?'Tags':'Categories',`<div class="chips">${[...counts].sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<a class="chip" href="/${kind}/${encodeURIComponent(k)}/">${esc(k)}<small>${n}</small></a>`).join('')}</div>`,'Journal / '+kind);
 for(const [name,n] of counts)await page('/'+kind+'/'+name,name,heading(name,`${n} entries`,kind.toUpperCase())+posts.filter(p=>kind==='tags'?p.tags.includes(name):p.category===name).map(row).join(''),'Journal / '+kind);
}
await page('/search','Search','<h1 class="sr-only" tabindex="-1">Search</h1><noscript><p>Search needs JavaScript. Browse the <a href="/all-archives/">archives</a>.</p></noscript><label for="query" class="sr-only">Search titles, text, or tags</label><input id="query" class="search-input" type="search" placeholder="Type a word or phrase to search titles, text, or tags" autocomplete="off"><div id="results" aria-live="polite"></div>','Journal / Search');
const notFound=await page('/404','Page not found',heading('This page has wandered off.','','404')+'<a class="chip" href="/">Return to the journal</a>');await fs.writeFile(path.join(out,'404.html'),notFound);
const routes={};for(const d of documents){routes[d.path]=hash(d.path);const payload=[{title:d.title,date:d.date,category:d.post?d.category:''},...d.blocks.map(html=>({html})),...(d.post?[{html:related(d),kind:'related'}]:[])].map(x=>JSON.stringify(x));await fs.writeFile(path.join(out,'data',hash(d.path)+'.ndjson'),payload.join('\n')+'\n')}
await fs.writeFile(path.join(out,'data','routes.json'),JSON.stringify(routes));await fs.writeFile(path.join(out,'data','records.json'),JSON.stringify(documents.map(({blocks,post,aliases,sitemap,...d})=>d)));await fs.writeFile(path.join(out,'data','assets.json'),JSON.stringify({cover:config.cover,avatar:config.avatar}));
for(const d of documents)for(const alias of d.aliases){const route=validRoute('/'+alias.replace(/^\/+|\/+$/g,''));if(paths.has(route))continue;const dir=path.join(out,route.slice(1));await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${esc(url(d.path+'/'))}"><link rel="canonical" href="${esc((origin||'')+url(d.path+'/'))}"><a href="${esc(url(d.path+'/'))}">Continue to ${esc(d.title)}</a>`)}
const xml=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
await fs.writeFile(path.join(out,'.nojekyll'),'');
if(origin){await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${generated.filter(p=>p!='/404'&&p!='/search'&&(documents.find(d=>d.path===p)?.sitemap!==false)).map(p=>`<url><loc>${xml(origin+url(p==='/'?'/':p+'/'))}</loc></url>`).join('')}</urlset>`)}
const rssContent=`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(config.title)}</title><link>${xml(origin+url('/'))}</link><description>${xml(config.description)}</description>${posts.slice(0,20).map(p=>`<item><title>${xml(p.title)}</title><link>${xml(origin+url(p.path+'/'))}</link><guid>${xml(origin+url(p.path+'/'))}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${xml(p.excerpt)}</description></item>`).join('')}</channel></rss>`;await fs.writeFile(path.join(out,'rss.xml'),rssContent);for(const alias of ['rss2.xml','rss-all.xml','zh-cn/rss.xml','en/rss.xml']){await fs.mkdir(path.dirname(path.join(out,alias)),{recursive:true});await fs.writeFile(path.join(out,alias),rssContent)}
try{await fs.copyFile('others/_redirects',path.join(out,'_redirects'))}catch(e){if(e.code!=='ENOENT')throw e}
await fs.writeFile(path.join(out,'build-info.json'),JSON.stringify({basePath:BASE,posts:posts.length,pages:generated.length,images:imageCache.size}));
for(const warning of warnings)console.warn(warning);
console.log(`Built ${posts.length} Markdown posts, ${generated.length} HTML pages (${BASE||'/'}).`);
