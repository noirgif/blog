const BASE=window.__SITE_BASE__||'';
const siteUrl=p=>BASE+p;
const ASSETS=window.__SITE_ASSETS__;
async function loadReadingFonts(){
 if(!window.FontFace||!document.fonts||!ASSETS.readingFonts)return;
 const state=document.documentElement,controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),30000);
 state.dataset.readingFont='loading';
 try{
  const faces=await Promise.all(ASSETS.readingFonts.map(async font=>{
   const response=await fetch(siteUrl(font.src),{priority:'low',signal:controller.signal});
   if(!response.ok)throw Error('Reading font unavailable');
   const face=new FontFace(font.family,await response.arrayBuffer(),{weight:font.weight,style:font.style});
   return face.load();
  }));
  // Publish the complete Latin/SC cohort together, never a partially loaded mix.
  for(const face of faces)document.fonts.add(face);
  state.dataset.readingFont='ready';
 }catch{
  controller.abort();state.dataset.readingFont='fallback';
 }finally{clearTimeout(timeout)}
}
function scheduleReadingFonts(){
 const idle=()=>{if('requestIdleCallback' in window)requestIdleCallback(loadReadingFonts,{timeout:1000});else setTimeout(loadReadingFonts,0)};
 const painted=()=>{
  if(performance.getEntriesByName('first-contentful-paint').length){idle();return}
  if(window.PerformanceObserver?.supportedEntryTypes?.includes('paint')){
   const observer=new PerformanceObserver(entries=>{if(entries.getEntries().some(entry=>entry.name==='first-contentful-paint')){observer.disconnect();idle()}});
   observer.observe({type:'paint',buffered:true});
  }else requestAnimationFrame(()=>requestAnimationFrame(idle));
 };
 // Critical images and an observed first paint take precedence; no font CSS/preload.
 if(document.readyState==='complete')painted();else window.addEventListener('load',painted,{once:true});
}
scheduleReadingFonts();
function prefixLinks(root){
 for(const el of root.querySelectorAll('[href],[src],[data-preview]'))for(const attr of ['href','src','data-preview']){const value=el.getAttribute(attr);if(value?.startsWith('/')&&!value.startsWith('//')&&!(BASE&&value.startsWith(BASE+'/')))el.setAttribute(attr,siteUrl(value));}
 for(const el of root.querySelectorAll('[srcset]'))el.setAttribute('srcset',el.getAttribute('srcset').replace(/(^|,\s*)(\/(?!\/)[^\s,]+)/g,(_,separator,src)=>separator+(BASE&&src.startsWith(BASE+'/')?src:siteUrl(src))));
}
const main=document.querySelector('#content'), statusEl=document.querySelector('#status'), progress=document.querySelector('#progress');
const menuButton=document.querySelector('#mobile-menu-toggle');
function closeMobileMenu(){document.body.classList.remove('mobile-menu-open');menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open navigation menu');}
menuButton.addEventListener('click',()=>{const open=document.body.classList.toggle('mobile-menu-open');menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('mobile-menu-open')){closeMobileMenu();menuButton.focus();}});
let records=[],routes={},controller=null,sequence=0,ready,searchReady,mathReady;
const prefetchedPosts=new Map();
async function fetchData(asset){const response=await fetch(siteUrl(asset));if(!response.ok)throw Error('Journal unavailable');return response.json()}
function ensureReady(){return ready||(ready=Promise.all([fetchData(ASSETS.records),fetchData(ASSETS.routes)]).then(([r,t])=>{records=r;routes=t}).catch(error=>{ready=null;throw error}))}
function loadSearch(){return searchReady||(searchReady=fetchData(ASSETS.search).catch(error=>{searchReady=null;throw error}))}
function ensureMathStyles(){
 const existing=document.querySelector('link[data-katex]');if(existing?.sheet)return Promise.resolve();if(mathReady)return mathReady;
 const link=existing||document.createElement('link');
 mathReady=new Promise((resolve,reject)=>{link.addEventListener('load',resolve,{once:true});link.addEventListener('error',()=>{mathReady=null;link.remove();reject(Error('Math styles could not be loaded.'))},{once:true})});
 if(!existing){link.rel='stylesheet';link.href=siteUrl(ASSETS.katex);link.dataset.katex='';document.head.append(link)}
 return mathReady;
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=p=>decodeURI(BASE&&p.startsWith(BASE+'/')?p.slice(BASE.length):p===BASE?'/':p).replace(/\/index\.html$/,'/').replace(/\/$/,'')||'/';
function setReadingMode(path){closeMobileMenu();const post=path.startsWith('/posts/'),sidebar=document.querySelector('.sidebar');const moveFocus=post&&sidebar.contains(document.activeElement)||!post&&document.activeElement===document.querySelector('.home-logo');document.body.classList.toggle('post-view',post);if(moveFocus)document.querySelector(post?'.home-logo':'#breadcrumb').focus({preventScroll:true});sidebar.inert=post;if(post)sidebar.setAttribute('aria-hidden','true');else sidebar.removeAttribute('aria-hidden');}
function updateRouteChrome(path){document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===path;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.querySelector('#breadcrumb').textContent=path==='/'?'Journal':path.startsWith('/posts/')?'Journal / Entry':path.includes('categories')?'Journal / Categories':path.includes('tags')?'Journal / Tags':path.includes('archives')?'Journal / Archives':path==='/search'?'Journal / Search':path==='/about'?'Journal / About':'Journal / Links';}
const date=s=>s?new Date(s).toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'}):'';
const posts=()=>records.filter(r=>r.path.startsWith('/posts/'));
function element(html,cls='',target=main){const d=document.createElement('div');d.className=(target===main?'reveal ':'')+cls;d.innerHTML=html;prefixLinks(d);target.append(d);enhanceImages(d);return d}
const enhancedImages=new WeakSet();
function enhanceImages(root,prebuilt=false){
 // Static HTML already has the real responsive image. Never downgrade it to a preview.
 if(prebuilt)return;
 for(const img of root.querySelectorAll('img.progressive')){
  if(enhancedImages.has(img))continue;enhancedImages.add(img);
  if(img.complete&&img.naturalWidth){img.classList.add('sharp');continue}
  img.classList.remove('sharp');
  if(img.dataset.preview){img.style.backgroundImage=`url("${img.dataset.preview}")`;img.style.backgroundSize='cover';img.style.backgroundPosition='center'}
  const loaded=()=>{img.classList.add('sharp');img.style.backgroundImage=''};
  img.addEventListener('load',loaded,{once:true});img.addEventListener('error',loaded,{once:true});
 }
}
function heading(title,sub='',kicker='JOURNAL',target=main){element(`<div class="section-heading"><h1 tabindex="-1">${escape(title)}</h1></div>`,'',target)}
function row(p){return `<div class="row"><span class="date">${escape(date(p.date))}</span><a href="${escape(p.path)}">${escape(p.title)}</a></div>`}
function highlighted(text,q){text=String(text);let result='',offset=0,index;while((index=text.toLowerCase().indexOf(q,offset))!==-1){result+=escape(text.slice(offset,index))+'<mark>'+escape(text.slice(index,index+q.length))+'</mark>';offset=index+q.length}return result+escape(text.slice(offset))}
function searchResult(p,q){const text=(p.paragraphs||[]).find(t=>t.toLowerCase().includes(q))||(p.searchText?.toLowerCase().includes(q)?p.searchText:'');let snippet='';if(text){const index=text.toLowerCase().indexOf(q),start=Math.max(0,index-70),end=Math.min(text.length,Math.max(start+210,index+q.length));snippet=(start?'…':'')+text.slice(start,end)+(end<text.length?'…':'')}const tags=p.tags.filter(t=>t.toLowerCase().includes(q));const category=p.category.toLowerCase().includes(q)?p.category:'';return `<article class="search-result"><div class="row"><time class="date">${escape(date(p.date))}</time><a href="${escape(p.path)}">${highlighted(p.title,q)}</a></div>${snippet?`<p class="search-snippet">${highlighted(snippet,q)}</p>`:''}${tags.length||category?`<div class="search-tags">${tags.map(t=>`<a href="/tags/${encodeURIComponent(t)}">#${highlighted(t,q)}</a>`).join(' ')}${category?`<a href="/categories/${encodeURIComponent(category)}">${highlighted(category,q)}</a>`:''}</div>`:''}</article>`}
function card(p,priority=false){return `<article class="post-card"><div class="meta"><time>${escape(date(p.date))}</time><span>·</span><a class="category" href="/categories/${encodeURIComponent(p.category)}">${escape(p.category)}</a></div><h2><a href="${escape(p.path)}">${escape(p.title)}</a></h2>${p.image?`<a href="${escape(p.path)}" class="preview-images"><img class="progressive sharp" src="${p.image}" srcset="${p.imageSrcset}" sizes="${ASSETS.cardSizes}" data-preview="${p.imagePreview}" width="${p.imageWidth}" height="${p.imageHeight}" alt="${escape(p.title)}" loading="${priority?'eager':'lazy'}" fetchpriority="${priority?'high':'auto'}" decoding="async"></a>`:''}<p>${escape(p.excerpt.slice(0,165))}…</p></article>`}
function articleHead(post){return `<div class="article-head"><div class="meta"><time>${escape(date(post.date))}</time>${post.category?`<span>·</span><a class="category" href="/categories/${encodeURIComponent(post.category)}">${escape(post.category)}</a>`:''}</div><h1 tabindex="-1">${escape(post.title)}</h1></div>`}
async function prefetchPost(path){if(!path.startsWith('/posts/'))return;await ensureReady();if(!routes[path]||prefetchedPosts.has(path))return;const request={controller:new AbortController()};request.promise=fetch(siteUrl(`/data/${routes[path]}.ndjson`),{signal:request.controller.signal});prefetchedPosts.set(path,request);while(prefetchedPosts.size>2){const [oldPath,oldRequest]=prefetchedPosts.entries().next().value;prefetchedPosts.delete(oldPath);oldRequest.controller.abort()}request.promise.catch(()=>{if(prefetchedPosts.get(path)===request)prefetchedPosts.delete(path)})}
async function streamPost(path,signal,id,target=main,onHead=null,skipHead=false){const cached=prefetchedPosts.get(path);if(cached){prefetchedPosts.delete(path);if(signal.aborted)cached.controller.abort();else signal.addEventListener('abort',()=>cached.controller.abort(),{once:true})}const response=await(cached?cached.promise:fetch(siteUrl(`/data/${routes[path]}.ndjson`),{signal}));if(!response.ok)throw Error('This entry could not be loaded.');const reader=response.body.getReader(), decoder=new TextDecoder();let buffer='',title='',head=false;
 async function line(s){if(!s.trim()||id!==sequence)return;const data=JSON.parse(s);if(!head){head=true;title=data.title;if(data.hasMath)await ensureMathStyles();if(id!==sequence||signal.aborted)return;if(!skipHead){element(articleHead(data),'',target);if(onHead)target=await onHead(title)||target}}else element(data.html,data.kind==='related'?'':'article-body',target)}
 while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let n;while((n=buffer.indexOf('\n'))>=0){await line(buffer.slice(0,n));buffer=buffer.slice(n+1)}if(done){await line(buffer);break}}
 return title;
}
async function render(path,signal,id,target=main,onHead=null,skipHead=false){await ensureReady();if(signal.aborted||id!==sequence)return;const all=posts();
 if(routes[path])return streamPost(path,signal,id,target,onHead,skipHead);
 if(path==='/'){const list=all.slice(0,window.__POSTS_PER_PAGE__||8),firstPreview=list.find(p=>p.image);list.forEach(p=>element(card(p,p===firstPreview)));element('<a class="chip" href="/all-archives">Browse all entries</a>');return}
 if(path==='/search'){
  const wrap=element('<h1 class="sr-only" tabindex="-1">Search</h1><label class="sr-only" for="query">Search titles, text, or tags</label><input id="query" class="search-input" type="search" placeholder="Type a word or phrase to search titles, text, or tags" autocomplete="off"><div id="results" aria-live="polite"></div>');
  const input=wrap.querySelector('input'),results=wrap.querySelector('#results');let index=null;
  const search=()=>{const q=input.value.trim().toLowerCase();if(!index){results.textContent='Loading search index…';return}const list=q?index.filter(p=>[p.title,p.searchText,p.category,...p.tags].some(text=>text.toLowerCase().includes(q))):[];results.innerHTML=list.length?list.map(p=>searchResult(p,q)).join(''):q?'<p class="empty">No entries found. Try another word.</p>':'';prefixLinks(results)};
  input.addEventListener('input',search);search();index=await loadSearch();if(signal.aborted||id!==sequence)return;search();return;
 }
 if(path==='/all-archives'){let year='';for(const p of all){const y=p.date.slice(0,4)||'Undated';if(y!==year){year=y;element(`<h2 class="year-title">${escape(y)}</h2>`)}element(row(p))}return}
 if(path==='/all-categories'||path==='/all-tags'){const kind=path==='/all-tags'?'tags':'categories';const counts={};for(const p of all)for(const k of kind==='tags'?p.tags:[p.category])counts[k]=(counts[k]||0)+1;element(`<div class="chips">${Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<a class="chip" href="/${kind}/${encodeURIComponent(k)}">${escape(k)}<small>${n}</small></a>`).join('')}</div>`);if(!Object.keys(counts).length)element('<p class="empty">No tags in this journal yet.</p>');return}
 if(/^\/(categories|tags)\//.test(path)){const [,kind,...rest]=path.split('/'),name=decodeURIComponent(rest.join('/'));const list=all.filter(p=>kind==='tags'?p.tags.includes(name):p.category===name);heading(name,`${list.length} entries`,kind.toUpperCase());list.forEach(p=>element(row(p)));if(!list.length)element('<p class="empty">No entries found.</p>');return}
 heading('This page has wandered off.','','404');element('<p>The entry could not be found.</p><a class="chip" href="/">Return to the journal</a>');
}
function saveScroll(){history.replaceState({...history.state,scroll:window.scrollY},'')}
function commitHomePost(path,content,sourceCard,title,id){const commit=()=>{if(id!==sequence)return;window.scrollTo({top:0,behavior:'instant'});setReadingMode(path);updateRouteChrome(path);main.replaceChildren(content);if(title)document.title=title+' · Goddess Unknown';statusEl.textContent='';main.querySelector('h1')?.focus({preventScroll:true})};commit();return Promise.resolve(main)}
async function navigate(raw,{push=true,restore=null,sourceCard=null}={}){const url=new URL(raw,location.origin),path=normalize(url.pathname),fromHome=push&&normalize(location.pathname)==='/'&&path.startsWith('/posts/')&&sourceCard;const id=++sequence;let committedHomePost=false;controller?.abort();controller=new AbortController();if(push)saveScroll();if(!fromHome){setReadingMode(path);main.replaceChildren();main.setAttribute('aria-busy','true');statusEl.textContent='Loading…';window.scrollTo({top:0,behavior:'instant'});updateRouteChrome(path);document.title='Goddess Unknown'}else main.setAttribute('aria-busy','true');progress.classList.add('busy');if(push)history.pushState({scroll:0},'',url.pathname+url.search+url.hash);const staging=fromHome?document.createDocumentFragment():main;
 try{if(fromHome){await ensureReady();if(id!==sequence||controller.signal.aborted)return;const record=records.find(post=>post.path===path);if(record){element(articleHead(record),'',staging);committedHomePost=true;await commitHomePost(path,staging,sourceCard,record.title,id);if(id!==sequence)return}}
 const target=fromHome&&committedHomePost?main:staging,onHead=fromHome&&!committedHomePost?title=>{if(id!==sequence)return null;committedHomePost=true;return commitHomePost(path,staging,sourceCard,title,id)}:null;const title=await render(path,controller.signal,id,target,onHead,committedHomePost);if(id!==sequence)return;if(fromHome&&!committedHomePost)await commitHomePost(path,staging,sourceCard,title,id);else if(!fromHome){if(title)document.title=title+' · Goddess Unknown';statusEl.textContent='';if(push)main.querySelector('h1')?.focus({preventScroll:true});if(restore!==null)requestAnimationFrame(()=>window.scrollTo({top:restore,behavior:'instant'}));else if(url.hash)document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();}}
 catch(e){if(e.name==='AbortError'||id!==sequence)return;if(fromHome&&!committedHomePost){staging.replaceChildren();element('<h1>Couldn’t load this page.</h1><p>Please try again.</p><button class="retry">Retry</button>','',staging);commitHomePost(path,staging,sourceCard,null,id);main.querySelector('.retry').onclick=()=>navigate(raw,{push:false})}else{statusEl.textContent='';element('<h1>Couldn’t load this page.</h1><p>Please try again.</p><button class="retry">Retry</button>');main.querySelector('.retry').onclick=()=>navigate(raw,{push:false})}}
 finally{if(id===sequence){main.setAttribute('aria-busy','false');progress.classList.remove('busy')}}
}
function prefetchFromLink(e){const a=e.target.closest?.('a[href]');if(!a)return;const url=new URL(a.href,location.href);const path=normalize(url.pathname);if(url.origin===location.origin&&path!==normalize(location.pathname))prefetchPost(path).catch(()=>{})}
document.addEventListener('pointerover',prefetchFromLink,{passive:true});document.addEventListener('pointerdown',prefetchFromLink,{passive:true});document.addEventListener('focusin',prefetchFromLink);
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target||a.hasAttribute('download'))return;const url=new URL(a.href);if(url.origin!==location.origin||normalize(url.pathname).startsWith('/media/'))return;if(url.pathname===location.pathname&&url.search===location.search&&url.hash){const target=document.getElementById(decodeURIComponent(url.hash.slice(1)));if(target){e.preventDefault();saveScroll();history.pushState({scroll:0},'',url.pathname+url.search+url.hash);target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});target.focus({preventScroll:true})}return}e.preventDefault();const card=a.closest('.post-card');navigate(url.href,{sourceCard:card?.querySelector('h2 a')||null})});
history.scrollRestoration='manual';window.addEventListener('popstate',e=>navigate(location.href,{push:false,restore:e.state?.scroll??0}));let scrollTimer;window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(saveScroll,100)},{passive:true});
let snowTimer,snowClicks=0,snowEnding=false;const snowButton=document.querySelector('#snow');
let snowTint;
function resetSnowButton(){snowButton.style.color='';snowButton.style.fontSize=''}
function finishSnow(){if(snowEnding)return;snowEnding=true;clearTimeout(snowTimer);snowTimer=null;snowButton.setAttribute('aria-pressed','false');snowTint?.remove();const finale=document.createElement('div');finale.className='snow-redout';document.body.append(finale);const sound=document.createElement('audio');sound.className='snow-sound';sound.autoplay=true;sound.preload='auto';sound.src='https://res.cloudinary.com/noirgif/video/upload/v1545761612/nir.moe/SFX/Grievous_Ladywww_-_Laur_vs_Team_Grimoire.mp3';const cleanPage=()=>document.body.replaceChildren();sound.addEventListener('ended',cleanPage,{once:true});sound.addEventListener('error',cleanPage,{once:true});document.body.append(sound);sound.play().catch(()=>{})}
function scheduleSnow(reducedMotion){snowTimer=setTimeout(()=>{const f=document.createElement('span');f.className='snowflake';f.textContent='❄';f.style.left=Math.random()*100+'vw';f.style.opacity=.35+Math.random()*.55;f.style.fontSize=(10+Math.random()*5+snowClicks*.7)+'px';if(snowClicks)f.style.color=`rgb(255,${Math.max(0,215-snowClicks*20)},${Math.max(0,215-snowClicks*20)})`;f.style.animationDuration=(reducedMotion?14:6+Math.random()*7)+'s';document.body.append(f);f.onanimationend=()=>f.remove();f.addEventListener('click',()=>countSnowClick(f));scheduleSnow(reducedMotion)},Math.max(70,350-snowClicks*22))}
function countSnowClick(flake=null){snowClicks++;const red=Math.min(255,40+snowClicks*20),shade=255-red;for(const item of document.querySelectorAll('.snowflake')){item.style.fontSize=`${parseFloat(item.style.fontSize||'12')+.7}px`;item.style.color=`rgb(255,${shade},${shade})`}if(flake)flake.style.animationPlayState='paused';snowButton.style.color=`rgb(255,${shade},${shade})`;snowButton.style.fontSize=`${23+snowClicks*1.2}px`;if(snowTint)snowTint.style.backgroundColor=`rgba(220,0,0,${Math.min(.85,.12+snowClicks*.055)})`;if(snowClicks>=12)finishSnow()}
snowButton.onclick=()=>{if(snowEnding)return;if(!snowTimer){snowButton.setAttribute('aria-pressed','true');scheduleSnow(matchMedia('(prefers-reduced-motion: reduce)').matches)}};
// The static page already has the correct sidebar state; avoid initial layout mutations.
if(main.dataset.prebuilt&&normalize(location.pathname)!=='/search')enhanceImages(main,true);else navigate(location.href,{push:false});
