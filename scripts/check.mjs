import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import assert from 'node:assert/strict';
import matter from 'gray-matter';
const root=path.resolve('dist'),info=JSON.parse(await fs.readFile(path.join(root,'build-info.json'),'utf8')),base=info.basePath;
const routes=JSON.parse(await fs.readFile(path.join(root,'data/routes.json'),'utf8'));const records=JSON.parse(await fs.readFile(path.join(root,'data/records.json'),'utf8'));
for(const record of records)if(record.image)assert(Number(record.imageWidth)>0&&Number(record.imageHeight)>0,`Missing preview dimensions: ${record.path}`);
const errors=[];
async function allFiles(d){const result=[];for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())result.push(...await allFiles(p));else result.push(p)}return result}
const deploymentFiles=await allFiles(root);assert(deploymentFiles.length<=20000,'Cloudflare Pages Free permits at most 20,000 files');let largest=0;for(const file of deploymentFiles){const size=(await fs.stat(file)).size;largest=Math.max(largest,size);assert(size<=25*1024*1024,`Asset exceeds Cloudflare Pages 25 MiB limit: ${file}`)}
assert(!await fs.stat(path.join(root,'_worker.js')).catch(()=>null),'Static deployment must not include a Worker');
async function exists(p){try{await fs.access(p);return true}catch{return false}}
async function files(d){const result=[];for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())result.push(...await files(p));else if(e.name.endsWith('.html'))result.push(p)}return result}
for(const [route,key] of Object.entries(routes)){
 const file=path.join(root,decodeURIComponent(route),'index.html');assert(await exists(file),`Missing direct-entry HTML: ${route}`);
 const html=await fs.readFile(file,'utf8'),$=load(html);assert($('#content h1').length,`Missing pre-rendered heading: ${route}`);assert.equal($('body').hasClass('post-view'),route.startsWith('/posts/'),`Incorrect static sidebar state: ${route}`);assert.equal($('.sidebar').attr('aria-hidden')==='true',route.startsWith('/posts/'),`Incorrect sidebar accessibility state: ${route}`);assert($('#content').text().trim().length>0,`Empty pre-rendered content: ${route}`);for(const [selector,description] of [['.footnote-ref a[href^="#"]','footnote'],['.footnote-backref[href^="#"]','footnote backlink']])for(const link of $(selector).toArray()){const id=$(link).attr('href').slice(1);assert.equal($(`[id="${id}"]`).length,1,`Broken ${description} target on ${route}: ${id}`)}
 assert.equal($('.home-logo').attr('href'),base+'/','Post logo must link home');assert($('.home-logo-name').text().trim(),'Missing site wordmark');assert($('.home-logo').attr('aria-label').includes('return to the journal'),'Missing logo accessibility label');
 if(route.startsWith('/posts/')){const recommendation=$('.related-post');assert.equal(recommendation.length,1,`Expected one recommendation: ${route}`);const target=records.find(p=>base+p.path+'/'===recommendation.find('a').attr('href'));assert(target&&target.path!==route,`Invalid recommendation: ${route}`);assert.equal(recommendation.find('p').text(),target.firstSentence);const current=records.find(p=>p.path===route),sharedTag=current.tags.find(tag=>target.tags.includes(tag)),label=sharedTag?`Other post with #${sharedTag}`:'Other post';assert.equal(recommendation.find('.related-label').text(),label,`Incorrect recommendation label: ${route}`);assert.equal(recommendation.attr('aria-label'),label,`Incorrect recommendation accessible label: ${route}`);const overlap=p=>p.tags.filter(t=>current.tags.includes(t)).length;assert.equal(overlap(target),Math.max(...records.filter(p=>p.path.startsWith('/posts/')&&p.path!==route).map(overlap)),`Recommendation missed more similar tags: ${route}`);assert.equal($('.back-link').length,0)}
 const payload=(await fs.readFile(path.join(root,'data',key+'.ndjson'),'utf8')).trim().split('\n').map(s=>JSON.parse(s));assert(payload[0].title);assert(payload.length>1);
}
for(const file of await files(root)){
 const $=load(await fs.readFile(file,'utf8'));
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

for(const filename of await fs.readdir('source/_posts')){if(!filename.endsWith('.md'))continue;const {data}=matter(await fs.readFile(path.join('source/_posts',filename),'utf8'));if(data.draft===true||data.published===false){const route='/posts/'+String(data.slug||filename.slice(0,-3));assert(!routes[route],`Unpublished post leaked: ${filename}`)}}
if(errors.length){console.error([...new Set(errors)].slice(0,35).join('\n'));process.exit(1)}
console.log(`Free-tier asset checks: ${deploymentFiles.length} files, largest ${(largest/1024/1024).toFixed(2)} MiB. No runtime services.\nValidated ${info.posts} posts and ${info.pages} static HTML routes at ${base||'/'}, including pre-rendered content and local asset/link references.`);
