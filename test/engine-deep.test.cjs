const {test}=require('node:test');const assert=require('node:assert/strict');
const {Engine}=require('../src/engine.cjs');
const seed='https://www.ign.com/wikis/test';
const html=links=>`<h1>Gra</h1><article><p>${'Treść poradnika do testów. '.repeat(10)}</p>${links.map(u=>`<a href="${u}">Misja</a>`).join('')}<img src="https://cdn.example.com/a.jpg"><img src="https://cdn.example.com/a.jpg"></article>`;
function fake(url){return Promise.resolve({url,type:'text/html',data:Buffer.from(html(url===seed?[seed+'/quest']:[]))});}

test('przerwanie i wznowienie z zapisanego stanu nie pobiera ponownie gotowych stron',async()=>{
 let state;const first=new Engine(()=>{},null,{fetcher:fake,checkpoint:async s=>{state=structuredClone(s);}});first.allowed=async()=>{};
 await first.scan(seed,{limit:1});assert.equal(state.pages.length,1);assert.equal(state.pending.length,1);
 const calls=[];const second=new Engine(()=>{},null,{fetcher:async u=>{calls.push(u);return fake(u);}});second.allowed=async()=>{};
 const result=await second.scan(seed,{limit:5,resume:state});assert.equal(result.pages.length,2);assert.deepEqual(calls,[seed+'/quest']);assert(!result.truncated);assert.equal(result.warnings.filter(w=>w.kind==='limit').length,0);
});
test('anulowana bieżąca strona wraca do kolejki checkpointu',async()=>{
 let snapshot;const engine=new Engine(()=>{},null,{fetcher:async()=>{engine.cancel();throw new Error('Aborted');},checkpoint:async s=>snapshot=s});engine.allowed=async()=>{};
 await assert.rejects(engine.scan(seed),/Anulowano/);assert.deepEqual(snapshot.pending,[seed]);
});
test('robots.txt odmawia pobrania treści; crawl-delay jest respektowany',async()=>{
 const calls=[],delays=[];const engine=new Engine(()=>{},null,{fetcher:async u=>{calls.push(u);return {url:u,type:'text/plain',data:Buffer.from('User-agent: GameGuides\nDisallow: /private\nCrawl-delay: 3\n')};},wait:async ms=>delays.push(ms)});
 await assert.rejects(engine.allowed('https://example.com/private'),/robots/);await engine.allowed('https://example.com/public');assert.equal(calls.length,1);assert.deepEqual(delays,[3000]);
});
test('obrazy są deduplikowane, niepoprawny MIME trafia do raportu',async()=>{
 let calls=0;const engine=new Engine(()=>{},null,{fetcher:async u=>{calls++;return {url:u,type:'text/html',data:Buffer.from('<h1>Not image</h1>')};}});engine.allowed=async()=>{};
 engine.pages.set(seed,{title:'Gra',url:seed,content:'<img src="https://example.com/x.jpg">'});
 const result=await engine.chapters([seed],true);assert(!result[0].content.includes('<img'));assert.equal(engine.warnings.length,1);assert.match(engine.warnings[0].error,/format/);assert.equal(calls,1);
});
test('udane obrazy pobierane tylko raz i osadzane w PDF bez sieci',async()=>{
 let calls=0;const engine=new Engine(()=>{},null,{fetcher:async u=>{calls++;return {url:u,type:'image/png',data:Buffer.from('fake-png')};}});engine.allowed=async()=>{};
 engine.pages.set(seed,{title:'Gra',url:seed,content:'<img src="https://example.com/a.png"><img src="https://example.com/a.png">'});
 const result=await engine.chapters([seed],true);assert.equal(calls,1);assert(result[0].content.includes('data:image/png;base64,'));
});
test('przekierowanie poza grę nie dodaje obcej treści',async()=>{
 const engine=new Engine(()=>{},null,{fetcher:async()=>({url:'https://www.ign.com/wikis/other',type:'text/html',data:Buffer.from(html([]))})});engine.allowed=async()=>{};
 await assert.rejects(engine.scan(seed),/Przekierowanie/);
});
test('odmowa HTTP przełącza na przeglądarkę, bez eksportowania ekranu weryfikacji',async()=>{
 let browserCalls=0;
 const engine=new Engine(()=>{},null,{fetcher:async()=>{throw new Error('HTTP 403');},fallbackReader:async u=>{browserCalls++;return fake(u);}});engine.allowed=async()=>{};
 const result=await engine.scan(seed,{mode:'single'});assert.equal(result.pages.length,1);assert.equal(browserCalls,1);assert.equal(result.browser,true);
 const blocked=new Engine(()=>{},null,{fetcher:async()=>{throw new Error('HTTP 403');},fallbackReader:async u=>({url:u,type:'text/html',data:Buffer.from('<title>Security check</title><main>Verify you are human.</main>')})});blocked.allowed=async()=>{};
 await assert.rejects(blocked.scan(seed),/CAPTCHA/);
});
