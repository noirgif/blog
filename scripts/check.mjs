import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import assert from 'node:assert/strict';
import matter from 'gray-matter';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { create } from 'fontkit';
import { readingCharacters, assertReadingCoverage } from './fonts.mjs';
const root=path.resolve('dist'),info=JSON.parse(await fs.readFile(path.join(root,'build-info.json'),'utf8')),base=info.basePath;
const routes=JSON.parse(await fs.readFile(path.join(root,info.assets.routes),'utf8')),records=JSON.parse(await fs.readFile(path.join(root,info.assets.records),'utf8'));
const search=JSON.parse(await fs.readFile(path.join(root,info.assets.search),'utf8'));
assert.deepEqual(search.map(p=>p.path),records.filter(p=>p.path.startsWith('/posts/')).map(p=>p.path),'Search index must include every published post');
for(const record of records){
 assert(!('searchText' in record)&&!('paragraphs' in record),'Full search text leaked into navigation metadata');
 if(record.image){assert(Number(record.imageWidth)>0&&Number(record.imageHeight)>0,`Missing preview dimensions: ${record.path}`);assert(record.image.endsWith('.webp')&&record.imageSrcset&&record.imagePreview,`Missing responsive thumbnail: ${record.path}`)}
}
assert((await fs.stat(path.join(root,info.assets.records))).size<128*1024,'Navigation metadata exceeds its 128 KiB budget');
const home=load(await fs.readFile(path.join(root,'index.html'),'utf8'));
assert.equal(home('#content .preview-images img').first().attr('loading'),'eager','The first homepage preview must not be lazy-loaded');
assert.equal(home('#content .preview-images img').first().attr('fetchpriority'),'high','Missing LCP image priority');
assert.equal(home('#content .preview-images img[loading="eager"]').length,1,'Only the first homepage preview should be eager-loaded');
assert.equal(home('link[data-katex]').length,0,'The homepage must not load math CSS');
assert.equal(home('link[rel="stylesheet"]').length,0,'The homepage must not have render-blocking stylesheet requests');
assert(home('style[data-site-style]').length,'Missing inline critical styles');
for(const script of home('script').toArray())assert.equal(home(script).attr('data-cfasync'),'false','Site scripts must opt out of Rocket Loader');
assert(home('#content .preview-images img').first().attr('srcset').includes('640w'),'Missing close-fitting mobile thumbnail');
assert(!home.html().includes('fonts.googleapis.com')&&!home.html().includes('fonts.gstatic.com')&&!home.html().includes('Noto Sans SC'),'External font dependency returned');
const readingFaces=[];
for(const face of info.readingFonts.faces){
 assert(face.src.startsWith('/static/')&&face.src.endsWith('.woff2')&&!face.src.includes('-full'),'Reading font must be a hashed local subset');
 const buffer=await fs.readFile(path.join(root,face.src));
 assert.equal(buffer.length,face.bytes,'Incorrect reading font byte count');
 const font=create(buffer);assert(font.familyName.startsWith(face.family),'Unexpected reading typeface');
 assert.equal(font.italicAngle!==0,face.style==='italic','Reading emphasis must use a real matching italic font');
 assert.equal(`${font.variationAxes.wght.min} ${font.variationAxes.wght.max}`,face.weight,'Reading font weight descriptor must match its axis');
 if(face.family==='Noto Serif KR')assert(font.characterSet.every(codePoint=>codePoint===0xffff||/\p{Script=Hangul}/u.test(String.fromCodePoint(codePoint))),'KR must not introduce regional Han glyphs');
 if(face.family!=='Noto Serif')for(const feature of ['hwid','pwid','palt','halt','chws','vert','vrt2'])assert(!font.availableFeatures.includes(feature),`Unexpected width/vertical alternate: ${feature}`);
 readingFaces.push({...face,font});
}
assert.equal(readingFaces.filter(face=>face.family==='Noto Serif SC').length,1,'Exactly one SC regional face is required');
assert(readingFaces.some(face=>face.family==='Noto Serif'&&face.style==='italic'),'Missing matching Latin italic face');
const siteStyle=home('style[data-site-style]').text();
assert(/--reading-font:\s*(['"])Noto Serif\1\s*,\s*(['"])Noto Serif SC\2/.test(siteStyle),'Noto Serif must precede the CJK family');
assert(!/@font-face\s*\{[^}]*Noto Serif/.test(siteStyle),'Reading fonts must not be requested before asynchronous loading');
for(const link of home('link[rel="preload"][as="font"]').toArray())assert(!home(link).attr('href').includes('noto-serif'),'Do not preload noncritical reading fonts');
const publishedReadingText=[];
const cacheHeaders=await fs.readFile(path.join(root,'_headers'),'utf8');
for(const directory of ['static','media','data'])assert(cacheHeaders.includes(`${base}/${directory}/*\n  Cache-Control: public, max-age=31536000, immutable`),`Missing immutable cache policy: ${directory}`);
const errors=[];
async function allFiles(d){const result=[];for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())result.push(...await allFiles(p));else result.push(p)}return result}
const deploymentFiles=await allFiles(root);assert(deploymentFiles.length<=20000,'Cloudflare Pages Free permits at most 20,000 files');let largest=0;
for(const file of deploymentFiles){
 const size=(await fs.stat(file)).size;largest=Math.max(largest,size);assert(size<=25*1024*1024,`Asset exceeds Cloudflare Pages 25 MiB limit: ${file}`);
 if(/^(?:static|media|data)\//.test(path.relative(root,file).split(path.sep).join('/'))){
  const expected=path.basename(file).match(/([a-f0-9]{16})\.[^.]+$/)?.[1];
  assert(expected,`Unversioned immutable asset: ${file}`);
  const actual=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex').slice(0,16);
  assert.equal(actual,expected,`Asset filename must hash its contents: ${file}`);
 }
}
assert(!await fs.stat(path.join(root,'_worker.js')).catch(()=>null),'Static deployment must not include a Worker');
async function exists(p){try{await fs.access(p);return true}catch{return false}}
async function files(d){const result=[];for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())result.push(...await files(p));else if(e.name.endsWith('.html'))result.push(p)}return result}
for(const [route,key] of Object.entries(routes)){
 const file=path.join(root,decodeURIComponent(route),'index.html');assert(await exists(file),`Missing direct-entry HTML: ${route}`);
 const html=await fs.readFile(file,'utf8'),$=load(html);assert($('#content h1').length,`Missing pre-rendered heading: ${route}`);assert.equal($('body').hasClass('post-view'),route.startsWith('/posts/'),`Incorrect static sidebar state: ${route}`);assert.equal($('.sidebar').attr('aria-hidden')==='true',route.startsWith('/posts/'),`Incorrect sidebar accessibility state: ${route}`);assert($('#content').text().trim().length>0,`Empty pre-rendered content: ${route}`);for(const [selector,description] of [['.footnote-ref a[href^="#"]','footnote'],['.footnote-backref[href^="#"]','footnote backlink']])for(const link of $(selector).toArray()){const id=$(link).attr('href').slice(1);assert.equal($(`[id="${id}"]`).length,1,`Broken ${description} target on ${route}: ${id}`)}
 assert.equal($('.home-logo').attr('href'),base+'/','Post logo must link home');assert($('.home-logo-name').text().trim(),'Missing site wordmark');assert($('.home-logo').attr('aria-label').includes('return to the journal'),'Missing logo accessibility label');
 if(route.startsWith('/posts/')){const recommendation=$('.related-post');assert.equal(recommendation.length,1,`Expected one recommendation: ${route}`);const target=records.find(p=>base+p.path+'/'===recommendation.find('a').attr('href'));assert(target&&target.path!==route,`Invalid recommendation: ${route}`);assert.equal(recommendation.find('p').text(),target.firstSentence);const current=records.find(p=>p.path===route),sharedTag=current.tags.find(tag=>target.tags.includes(tag)),label=sharedTag?`Other post with #${sharedTag}`:'Other post';assert.equal(recommendation.find('.related-label').text(),label,`Incorrect recommendation label: ${route}`);assert.equal(recommendation.attr('aria-label'),label,`Incorrect recommendation accessible label: ${route}`);const overlap=p=>p.tags.filter(t=>current.tags.includes(t)).length;assert.equal(overlap(target),Math.max(...records.filter(p=>p.path.startsWith('/posts/')&&p.path!==route).map(overlap)),`Recommendation missed more similar tags: ${route}`);assert.equal($('.back-link').length,0)}
 const payload=(await fs.readFile(path.join(root,'data',key+'.ndjson'),'utf8')).trim().split('\n').map(s=>JSON.parse(s));assert(payload[0].title);assert(payload.length>1);
 assert.equal(payload[0].hasMath,$('#content .katex').length>0,`Incorrect streamed math metadata: ${route}`);
 assert.equal($('link[data-katex]').length,payload[0].hasMath?1:0,`Math CSS must load only on math pages: ${route}`);
}
const imageMetadata=new Map();
for(const file of await files(root)){
 const $=load(await fs.readFile(file,'utf8'));
 const reading=load($('#content').html()||'');reading('script,style,.katex,pre,code').remove();publishedReadingText.push(reading.root().text());
 for(const el of $('[srcset]').toArray()){
  const descriptors=new Set();
  for(const candidate of $(el).attr('srcset').split(',')){
   const [src,descriptor]=candidate.trim().split(/\s+/);
   assert(/^\d+w$/.test(descriptor),`Invalid responsive image descriptor: ${candidate}`);
   assert(!descriptors.has(descriptor),`Duplicate responsive image width: ${file}`);descriptors.add(descriptor);
   assert(!base||src.startsWith(base+'/'),`Responsive image outside base path: ${src}`);
   const imageFile=path.join(root,base?src.slice(base.length):src);
   assert(await exists(imageFile),`Missing responsive image: ${src}`);
   if(!imageMetadata.has(imageFile))imageMetadata.set(imageFile,await sharp(imageFile).metadata());
   assert.equal(imageMetadata.get(imageFile).width,Number(descriptor.slice(0,-1)),`Incorrect responsive image width: ${src}`);
  }
 }
 for(const el of $('img[loading="lazy"]').toArray()){const width=Number($(el).attr('width')),height=Number($(el).attr('height'));assert(width>0&&height>0,`Lazy-loaded image needs explicit dimensions: ${path.relative(root,file)}`)}
 for(const el of $('a[href],link[href],script[src],img[src],img[data-full],img[data-preview]').toArray()){
  for(const attr of ['href','src','data-full','data-preview']){
   const raw=$(el).attr(attr);if(!raw||!raw.startsWith('/')||raw.startsWith('//'))continue;
   if(base&&!raw.startsWith(base+'/')){errors.push(`${path.relative(root,file)}: path outside base: ${raw}`);continue}
   let pathname=decodeURIComponent(new URL(raw,'https://example.com').pathname);if(base)pathname=pathname.slice(base.length);
   const target=path.join(root,pathname);if(await exists(target))continue;
   // Some older posts link to files that were already absent from the source repository.
   if($(el).is('a')&&/\.(zip|pdf|txt|py|sh|cpp|rs)$/i.test(pathname))continue;
   errors.push(`${path.relative(root,file)}: missing ${attr} ${raw}`);
  }
 }
}

assertReadingCoverage(readingFaces,readingCharacters([...publishedReadingText,home('nav').text(),...records.flatMap(record=>[record.title,record.category,...record.tags,record.excerpt,record.firstSentence]),...search.map(record=>record.searchText)]));
console.log(`Reading font checks: published glyph coverage, matching Latin italics, full-width Han/kana, and Hangul-only Korean fallback (${info.readingFonts.cjkCharacters} CJK characters).`);
for(const filename of await fs.readdir('source/_posts')){if(!filename.endsWith('.md'))continue;const {data}=matter(await fs.readFile(path.join('source/_posts',filename),'utf8'));if(data.draft===true||data.published===false){const route='/posts/'+String(data.slug||filename.slice(0,-3));assert(!routes[route],`Unpublished post leaked: ${filename}`)}}
if(errors.length){console.error([...new Set(errors)].slice(0,35).join('\n'));process.exit(1)}
console.log(`Free-tier asset checks: ${deploymentFiles.length} files, largest ${(largest/1024/1024).toFixed(2)} MiB. No runtime services.\nValidated ${info.posts} posts and ${info.pages} static HTML routes at ${base||'/'}, including pre-rendered content and local asset/link references.`);
