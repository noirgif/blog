import fs from 'node:fs/promises';
import path from 'node:path';
const args=process.argv.slice(2),draft=args.includes('--draft'),title=args.filter(a=>a!=='--draft'&&a!=='--').join(' ').trim();
if(!title){console.error('Usage: pnpm new "Post title" [--draft]');process.exit(1)}
const slug=title.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s+/g,'-');
if(!slug||slug==='.'||slug==='..')throw Error('Use a title with letters or numbers.');
const date=new Date().toISOString().slice(0,19).replace('T',' '),dir=draft?'source/_drafts':'source/_posts';
await fs.mkdir(dir,{recursive:true});const file=path.join(dir,slug+'.md');
await fs.writeFile(file,`---\ntitle: ${JSON.stringify(title)}\ndate: ${date}\ncategory: diary\ntags: []\n${draft?'draft: true\n':''}---\n\nWrite your post here.\n`,{flag:'wx'});
console.log(`Created ${file}`);
