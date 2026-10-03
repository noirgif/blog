import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import { marked } from 'marked';
import { load } from 'cheerio';
import katex from 'katex';
import { build as bundle, transform } from 'esbuild';
import { createImagePipeline, ARTICLE_SIZES, CARD_SIZES, PORTRAIT_MEDIA, COVER_SIZES } from './images.mjs';
import { createReadingFonts } from './fonts.mjs';
import { renderArticleBody, renderArticleHead, renderBrowseArchivesLink, renderPostCard, renderPostRow, renderPostTags, renderRelatedPost, renderSectionHeading, renderTaxonomyCloud, renderYearHeading } from '../theme/render.js';

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
const warnings=new Set(),imageByUrl=new Map();
const media=createImagePipeline(path.join(root,'public'),out,warning=>warnings.add(warning)),imageCache=media.cache;
await fs.rm(out,{recursive:true,force:true});
for(const directory of ['data','media','static','licenses'])await fs.mkdir(path.join(out,directory),{recursive:true});
const katexVersion=JSON.parse(await fs.readFile('node_modules/katex/package.json','utf8')).version;
const katexDirectory='/vendor/katex-'+katexVersion;
await fs.cp('node_modules/katex/dist',path.join(out,katexDirectory),{recursive:true,filter:p=>!p.endsWith('.js')&&!p.endsWith('.map')});
const favicon=await fs.readFile('theme/favicon.svg'),faviconAsset=`/static/favicon-${hash(favicon)}.svg`;
await fs.writeFile(path.join(out,faviconAsset),favicon);
const staticAssets={favicon:faviconAsset},fonts=[];
const latinRange='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
let fontCSS='',styleCode='';
for(const [slug,family,weight] of [['dm-sans','DM Sans','100 1000'],['playfair-display','Playfair Display','400 900']]){
 const directory=`node_modules/@fontsource-variable/${slug}`;
 const buffer=await fs.readFile(`${directory}/files/${slug}-latin-wght-normal.woff2`),asset=`/static/${slug}-${hash(buffer)}.woff2`;
 await fs.writeFile(path.join(out,asset),buffer);await fs.copyFile(`${directory}/LICENSE`,path.join(out,'licenses',slug+'.txt'));fonts.push(asset);
 fontCSS+=`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:optional;src:url('${url(asset)}') format('woff2');unicode-range:${latinRange}}`;
}

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
const image=src=>media.optimize(src);
function renderFootnotes(md){
 const definitions=new Map(),references=new Map(),order=[];
 const content=md.replace(/^[ \t]{0,3}\[\^([^\]\r\n]+)\]:[ \t]*(.*)$/gm,(_,label,text)=>{definitions.set(label,text);return ''}).replace(/\[\^([^\]\r\n]+)\]/g,(match,label)=>{if(!definitions.has(label))return match;if(!references.has(label)){references.set(label,[]);order.push(label)}const refs=references.get(label),key=Buffer.from(label,'utf8').toString('hex'),number=order.indexOf(label)+1,ref=`fn-${key}-ref-${refs.length+1}`;refs.push(ref);return `<sup class="footnote-ref"><a id="${ref}" href="#fn-${key}" aria-label="Footnote ${number}">${number}</a></sup>`});
 const labels=[...order,...[...definitions.keys()].filter(label=>!references.has(label))];if(!labels.length)return {content,html:''};
 const items=labels.map(label=>{const key=Buffer.from(label,'utf8').toString('hex'),body=marked.parseInline(definitions.get(label)||''),backlinks=(references.get(label)||[]).map((ref,i)=>` <a class="footnote-backref" href="#${ref}" aria-label="Back to footnote reference ${i+1}">↩</a>`).join('');return `<li id="fn-${key}">${body}${backlinks}</li>`}).join('');
 return {content,html:`<section class="footnotes" aria-label="Footnotes"><ol>${items}</ol></section>`};
}
async function renderMarkdown(md,title,post=false){
 const source=legacy(md),footnotes=renderFootnotes(source),$=load(marked.parse(footnotes.content)+footnotes.html,null,false);
 $('script').remove();$('[onclick],[onload],[onerror]').each((i,el)=>{for(const attr of Object.keys(el.attribs))if(attr.startsWith('on'))$(el).removeAttr(attr)});
 await Promise.all($('img').toArray().map(async el=>{const img=$(el),src=img.attr('src')||'';const converted=await image(src);if(converted){imageByUrl.set(converted.src,converted);img.attr({src:converted.src,srcset:converted.srcset,sizes:ARTICLE_SIZES,'data-preview':converted.preview,width:converted.width,height:converted.height,class:'progressive sharp',loading:'lazy',decoding:'async',alt:img.attr('alt')||title+' photograph'})}else {if(src.startsWith('/assets/')||src.startsWith('assets/')){img.replaceWith('<p class="empty">This photograph is unavailable from the original source.</p>');return;}const width=Number(img.attr('width')),height=Number(img.attr('height'));if(width>0&&height>0)img.attr('loading','lazy');else img.removeAttr('loading');img.attr({decoding:'async',alt:img.attr('alt')||title+' photograph'})}}));
 if(post){const firstImage=$('img').first();if(firstImage.length)firstImage.attr({loading:'eager',fetchpriority:'high'})}
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
 const route=validRoute(d.permalink?'/'+String(d.permalink).replace(/^\/+|\/+$/g,''):post?'/posts/'+slug:'/'+path.relative('source',file).split(path.sep).join('/').replace(/(?:\/index)?\.md$/,''));
 const date=post?timestamp(d.date,file):d.date?timestamp(d.date,file):'';
 const blocks=await renderMarkdown(parsed.content,d.title,post),body=blocks.join('');const $=load(body,null,false);
 const searchText=$.root().text().replace(/\s+/g,' ').trim();
 const paragraphs=$('p').toArray().map(el=>$(el).text().replace(/\s+/g,' ').trim()).filter(Boolean);
 const firstText=paragraphs.find(t=>!t.startsWith('This photograph is unavailable'))||String(d.description||searchText);
 const firstSentence=[...new Intl.Segmenter(d.lang||'en',{granularity:'sentence'}).segment(firstText)][0]?.segment.trim()||d.title;
 const preview=imageByUrl.get($('img[data-preview]').first().attr('src'));
 const thumbnail=post&&preview?await media.thumbnail(preview):null;
 documents.push({path:route,title:d.title,date,category:list(d.categories??d.category)[0]||'uncategorized',tags:list(d.tags),excerpt:String(d.description||searchText.slice(0,180)),searchText,paragraphs,firstSentence,image:thumbnail?.src||null,imageSrcset:thumbnail?.srcset||null,imagePreview:thumbnail?.preview||null,imageWidth:thumbnail?.width||null,imageHeight:thumbnail?.height||null,hasMath:$('.katex').length>0,blocks,post,comments:post&&d.comments!==false,lang:d.lang||'en',aliases:list(d.alias||d.aliases),sitemap:d.sitemap!==false});
}
documents.sort((a,b)=>b.date.localeCompare(a.date)||a.path.localeCompare(b.path));
const posts=documents.filter(d=>d.post);const paths=new Set();for(const d of documents){if(paths.has(d.path))throw Error('Duplicate permalink: '+d.path);paths.add(d.path)}
const template=await fs.readFile('theme/index.html','utf8');
const readingFonts=await createReadingFonts([load(template)('body').text(),config.title,config.description,config.author,'…',...documents.flatMap(d=>[d.title,d.category,...d.tags,d.excerpt,d.searchText,d.firstSentence])],out);
for(const [name,extension,loader] of [['style','css','css'],['app','js','js'],['giscus','css','css']]){
 const source=await fs.readFile(`theme/${name}.${extension}`,'utf8');
 const code=name==='app'
  ?(await bundle({entryPoints:['theme/app.js'],bundle:true,write:false,outfile:'app.js',format:'iife',platform:'browser',minify:true,target:['chrome100','firefox100','safari15.4'],legalComments:'none'})).outputFiles[0].text
  :(await transform((name==='style'?fontCSS:'')+source,{loader,minify:true,target:['chrome100','firefox100','safari15.4'],legalComments:'none'})).code;
 if(name==='style')styleCode=code;
 const asset=`/static/${name}-${hash(code)}.${extension}`;
 await fs.writeFile(path.join(out,asset),code);staticAssets[name]=asset;
}
const comments=d=>config.giscus&&d.comments?'<section class="comments-section" id="comments" aria-labelledby="comments-heading"><h2 id="comments-heading">Comments</h2><p class="comments-status" role="status">Comments load as you approach this section.</p><div class="giscus"></div><noscript><p>Enable JavaScript to read and write comments, or visit <a href="https://github.com/'+esc(config.giscus.repo)+'/discussions" target="_blank" rel="noopener">GitHub Discussions</a>.</p></noscript></section>':'';
const article=d=>`${renderArticleHead(d)}${d.blocks.map(renderArticleBody).join('')}${d.post?renderPostTags(d):''}${renderRelatedPost(d,posts)}${comments(d)}`;
const routes={};
for(const d of documents){
 const payload=[{title:d.title,date:d.date,category:d.post?d.category:'',tags:d.post?d.tags:[],hasMath:d.hasMath},...d.blocks.map(html=>({html})),...(d.post?[{html:renderPostTags(d),kind:'tags'},{html:renderRelatedPost(d,posts),kind:'related'},{html:comments(d),kind:'comments'}]:[])].map(x=>JSON.stringify(x)).join('\n')+'\n';
 const key=hash(payload);routes[d.path]=key;await fs.writeFile(path.join(out,'data',key+'.ndjson'),payload);
}
async function dataAsset(name,value){const data=JSON.stringify(value),asset=`/data/${name}-${hash(data)}.json`;await fs.writeFile(path.join(out,asset),data);return asset}
const assets={...staticAssets,katex:katexDirectory+'/katex.min.css',
 records:await dataAsset('records',documents.map(({blocks,post,aliases,sitemap,hasMath,searchText,paragraphs,...d})=>d)),
 routes:await dataAsset('routes',routes),
 search:await dataAsset('search',posts.map(({path,title,date,category,tags,searchText,paragraphs})=>({path,title,date,category,tags,searchText,paragraphs}))),
};
const cover=await media.sidebar(config.cover),avatar=await media.sidebar(config.avatar,true);
function prefixed(html){
 const $=load(html);
 $('[href],[src],[data-preview]').each((i,el)=>{for(const a of ['href','src','data-preview']){const v=$(el).attr(a);if(v?.startsWith('/')&&!v.startsWith('//'))$(el).attr(a,url(v))}});
 $('[srcset]').each((i,el)=>$(el).attr('srcset',$(el).attr('srcset').replace(/(^|,\s*)(\/(?!\/)[^\s,]+)/g,(_,separator,src)=>separator+url(src))));
 return $.html();
}
const generated=[];
async function page(route,title,body,kicker='Journal',lang='en'){
 route=validRoute(route);const $=load(template),post=documents.find(d=>d.path===route)?.post;
 $('html').attr('lang',lang);if(route==='/')$('body').addClass('home-page');if(post){$('body').addClass('post-view');$('.sidebar').attr({'inert':'','aria-hidden':'true'})}
 $('title').text(title===config.title?title:title+' · '+config.title);$('meta[name="description"]').attr('content',config.description);
 $('.wordmark').contents().first().replaceWith(esc(config.title.toUpperCase()));$('.home-logo-name').text(config.title.toUpperCase());$('.home-logo').attr('aria-label',config.title+' — return to the journal');
 if(cover){
  $('.cover').attr({src:cover.src,srcset:cover.srcset,sizes:COVER_SIZES,width:cover.width,height:cover.height,loading:post?'lazy':'eager',fetchpriority:post?'auto':'high',decoding:'async'}).wrap('<picture class="cover-picture"></picture>');
  $('.cover-picture').prepend($('<source>').attr({media:PORTRAIT_MEDIA,srcset:cover.mobile.srcset,sizes:'100vw'}));
 }else $('.cover').attr('src',config.cover);
 if(avatar)$('.avatar').attr({src:avatar.src,srcset:avatar.srcset,sizes:'42px',width:42,height:42,loading:'lazy',decoding:'async'});else $('.avatar').attr('src',config.avatar);
 $('.profile strong').text(config.author);$('#content').attr({'aria-busy':'false','data-prebuilt':'true'}).html(body);$('#breadcrumb').text(kicker);
 $('nav a[data-nav]').each((i,el)=>{if($(el).attr('data-nav')===route)$(el).addClass('active').attr('aria-current','page')});
 $('link[href="/style.css"]').replaceWith($('<style data-site-style></style>').text(styleCode));$('script[src="/app.js"]').attr('src',assets.app);
 $('head').prepend($('<link>').attr({rel:'preload',as:'font',href:fonts[0],type:'font/woff2',crossorigin:''}));
 $('head').append($('<link>').attr({rel:'preload',as:'font',href:fonts[1],type:'font/woff2',crossorigin:'',media:'(orientation: landscape), (min-width: 801px) and (hover: hover)'}));
 $('head').append($('<link>').attr({rel:'icon',href:assets.favicon,type:'image/svg+xml'}));
 if($('#content .katex').length)$('head').append($('<link>').attr({rel:'stylesheet',href:assets.katex,'data-katex':''}));
 const clientAssets={records:assets.records,routes:assets.routes,search:assets.search,katex:assets.katex,cardSizes:CARD_SIZES,readingFonts:readingFonts.faces.map(({bytes,...face})=>face),giscus:config.giscus?{...config.giscus,theme:assets.giscus}:null};
 $('head').append(`<script>window.__SITE_BASE__=${JSON.stringify(BASE).replace(/</g,'\\u003c')};window.__POSTS_PER_PAGE__=${Number(config.postsPerPage)||8};window.__SITE_ASSETS__=${JSON.stringify(clientAssets).replace(/</g,'\\u003c')};</script>`);
 // Our deferred script and configuration must not be rewritten by Rocket Loader.
 $('script').attr('data-cfasync','false');
 if(config.giscus&&post)$('head').append($('<link>').attr({rel:'preconnect',href:'https://giscus.app',crossorigin:''}));
 if(origin)$('head').append(`<link rel="canonical" href="${esc(origin+url(route==='/'?'/':route+'/'))}">`);
 const final=prefixed($.html()),destination=path.join(out,route==='/'?'':decodeURIComponent(route));await fs.mkdir(destination,{recursive:true});await fs.writeFile(path.join(destination,'index.html'),final);generated.push(route);return final;
}
for(const d of documents)await page(d.path,d.title,article(d),'Journal / '+(d.post?'Entry':d.title),d.lang);
const homePosts=posts.slice(0,config.postsPerPage||8),firstPreview=homePosts.find(p=>p.image);
await page('/',config.title,homePosts.map(p=>renderPostCard(p,{priority:p===firstPreview,cardSizes:CARD_SIZES})).join('')+renderBrowseArchivesLink());
let year='';await page('/all-archives','Archives',posts.map(p=>{const y=p.date.slice(0,4);const h=y!==year?renderYearHeading(y):'';year=y;return h+renderPostRow(p)}).join(),'Journal / Archives');
for(const kind of ['categories','tags']){
 const counts=new Map();for(const p of posts)for(const k of kind==='tags'?p.tags:[p.category])counts.set(k,(counts.get(k)||0)+1);
 await page('/all-'+kind,kind==='tags'?'Tags':'Categories',renderTaxonomyCloud(posts,kind),'Journal / '+kind);
 for(const [name] of counts)await page('/'+kind+'/'+name,name,renderSectionHeading(name)+posts.filter(p=>kind==='tags'?p.tags.includes(name):p.category===name).map(renderPostRow).join(''),'Journal / '+kind);
}
await page('/search','Search','<h1 class="sr-only" tabindex="-1">Search</h1><noscript><p>Search needs JavaScript. Browse the <a href="/all-archives/">archives</a>.</p></noscript><label for="query" class="sr-only">Search titles, text, or tags</label><input id="query" class="search-input" type="search" placeholder="Type a word or phrase to search titles, text, or tags" autocomplete="off"><div id="results" aria-live="polite"></div>','Journal / Search');
const notFound=await page('/404','Page not found',renderSectionHeading('This page has wandered off.')+'<a class="chip" href="/">Return to the journal</a>');await fs.writeFile(path.join(out,'404.html'),notFound);
for(const d of documents)for(const alias of d.aliases){const route=validRoute('/'+alias.replace(/^\/+|\/+$/g,''));if(paths.has(route))continue;const dir=path.join(out,route.slice(1));await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${esc(url(d.path+'/'))}"><link rel="canonical" href="${esc((origin||'')+url(d.path+'/'))}"><a href="${esc(url(d.path+'/'))}">Continue to ${esc(d.title)}</a>`)}
const xml=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
await fs.writeFile(path.join(out,'.nojekyll'),'');
if(origin){await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${generated.filter(p=>p!='/404'&&p!='/search'&&(documents.find(d=>d.path===p)?.sitemap!==false)).map(p=>`<url><loc>${xml(origin+url(p==='/'?'/':p+'/'))}</loc></url>`).join('')}</urlset>`)}
const rssContent=`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(config.title)}</title><link>${xml(origin+url('/'))}</link><description>${xml(config.description)}</description>${posts.slice(0,20).map(p=>`<item><title>${xml(p.title)}</title><link>${xml(origin+url(p.path+'/'))}</link><guid>${xml(origin+url(p.path+'/'))}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${xml(p.excerpt)}</description></item>`).join('')}</channel></rss>`;await fs.writeFile(path.join(out,'rss.xml'),rssContent);for(const alias of ['rss2.xml','rss-all.xml','zh-cn/rss.xml','en/rss.xml']){await fs.mkdir(path.dirname(path.join(out,alias)),{recursive:true});await fs.writeFile(path.join(out,alias),rssContent)}
try{await fs.copyFile('others/_redirects',path.join(out,'_redirects'))}catch(e){if(e.code!=='ENOENT')throw e}
const cacheHeaders=['/static/*','/media/*','/data/*',katexDirectory+'/*'].map(route=>`${url(route)}\n  Cache-Control: public, max-age=31536000, immutable`).join('\n\n')+'\n';
await fs.writeFile(path.join(out,'_headers'),cacheHeaders+`\n${url(staticAssets.giscus)}\n  Access-Control-Allow-Origin: *\n`);
await fs.writeFile(path.join(out,'build-info.json'),JSON.stringify({basePath:BASE,posts:posts.length,pages:generated.length,images:imageCache.size,assets,fonts,readingFonts}));
for(const warning of warnings)console.warn(warning);
console.log(`Built ${posts.length} Markdown posts, ${generated.length} HTML pages (${BASE||'/'}).`);
console.log(`Reading fonts: ${readingFonts.characters} characters (${readingFonts.cjkCharacters} CJK), ${(readingFonts.faces.reduce((bytes,face)=>bytes+face.bytes,0)/1024).toFixed(1)} KiB, self-hosted and asynchronous.`);
