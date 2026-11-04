const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../src/engine.cjs'),{extract}=require('../src/extract.cjs');
test('IGN uses navigation order before incidental article links',()=>{
 const seed='https://www.ign.com/wikis/game/Walkthrough';
 const page=extract(`<h1>Walkthrough</h1><article><p>${'Content '.repeat(30)}</p><a href="/wikis/game/Late">Late</a></article><div class="wiki-toc"><a href="/wikis/game/Early">Early</a><a href="/wikis/game/Late">Late</a></div>`,seed);
 assert.equal(page.links[0].url,'https://www.ign.com/wikis/game/Early');
 const e=new Engine();e.seed=seed;e.seen=new Set([seed,'https://www.ign.com/wikis/game/Late','https://www.ign.com/wikis/game/Early']);
 e.pages.set(seed,page);for(const link of page.links)e.pages.set(link.url,{...page,url:link.url});
 assert.equal(e.result().pages[1].url,page.links[0].url);
});
test('image workers overlap requests, deduplicate in-flight images and remain bounded',async()=>{
 let active=0,peak=0,calls=0;
 const e=new Engine(()=>{},null,{fetcher:async url=>{calls++;peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,15));active--;return {url,type:'image/png',data:Buffer.from('fixture')};}});e.allowed=async()=>{};
 e.pages.set('a',{url:'https://example.com/a',title:'Test',content:Array.from({length:12},(_,i)=>`<img src="https://example.com/${i%6}.png">`).join('')});
 const chapters=await e.chapters(['a'],true);assert.equal(calls,6);assert(peak>1&&peak<=4);assert.equal(e.media.embedded,12);assert.equal(e.media.failed,0);assert.equal((chapters[0].content.match(/<img/g)||[]).length,12);
});
test('HTTP pages load concurrently while output retains source order',async()=>{
 const seed='https://www.neoseeker.com/game/';let active=0,peak=0;
 const e=new Engine(()=>{},null,{fetcher:async url=>{peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,url.endsWith('/1')?35:5));active--;return {url,type:'text/html',data:Buffer.from(`<h1>Guide</h1><article><p>${'Text '.repeat(40)}</p>${url===seed?[1,2,3,4,5,6].map(i=>`<a href="${seed}${i}">Chapter ${i}</a>`).join(''):''}</article>`)};}});e.allowed=async()=>{};
 const result=await e.scan(seed);assert(peak>1&&peak<=3);assert.deepEqual(result.pages.map(p=>p.url),[seed,...[1,2,3,4,5,6].map(i=>seed+i)]);
});
test('section indexes expand into source order instead of breadth-first discovery',()=>{
 const e=new Engine(),root='https://example.com/';e.seed=root;
 const put=(key,kind,links=[])=>e.pages.set(root+key,{url:root+key,title:key,kind,links:links.map(url=>({url:root+url})),content:'<p>Text</p>'});
 put('','index',['part1','part2']);put('part1','index',['1','2']);put('part2','index',['3']);for(const i of ['1','2','3'])put(i,'article');
 e.seen=new Set(e.pages.keys());assert.deepEqual(e.result().pages.map(p=>p.url.slice(root.length)),['','part1','1','2','part2','3']);
});
test('source navigation works outside IGN',()=>{
 const url='https://www.neoseeker.com/game/';const p=extract(`<h1>Game</h1><article><p>${'Text '.repeat(40)}</p><a href="${url}end">End</a></article><div class="guide-toc"><a href="${url}start">Start</a><a href="${url}end">End</a></div>`,url);
 assert.deepEqual(p.navigation,[url+'start',url+'end']);assert.equal(p.links[0].url,url+'start');
});
test('HTTP decompression supports gzip, deflate and Brotli with decoded size limits',async()=>{
 const {Readable}=require('node:stream'),zlib=require('node:zlib'),{readBody}=require('../src/network.cjs');
 const input=Buffer.from('Guide text '.repeat(100));
 for(const [encoding,compress]of [['gzip',zlib.gzipSync],['deflate',zlib.deflateSync],['br',zlib.brotliCompressSync]]){
  const response=()=>Object.assign(Readable.from([compress(input)]),{headers:{'content-encoding':encoding}});
  assert((await readBody(response(),input.length)).equals(input));await assert.rejects(readBody(response(),100),/limit/);
 }
});
