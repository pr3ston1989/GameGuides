const {test}=require('node:test');const assert=require('node:assert/strict');
const cheerio=require('cheerio');
const {extract,EXTRACTOR_VERSION}=require('../src/extract.cjs');
const {bookHtml}=require('../src/book.cjs');const {Engine}=require('../src/engine.cjs');
const text='Właściwy opis zadania wraz z wyjaśnieniem kolejnych etapów. '.repeat(14);
test('główna mapa ponad artykułem jest zachowana w pełnej rozdzielczości',()=>{
 const html=`<main><div class="guide16-map-c"><figure><figcaption>Mapa świata</figcaption><picture><source srcset="/small.jpg"><img src="/small.jpg"></picture><a class="guide-map-2020-zoom" href="/static/mapy/full.jpg"></a></figure></div><h1>GreedFall: World Map</h1><div class="p-word"><p>${text}</p><div class="text-frame-red"><p>Ważne ostrzeżenie.</p></div><img src="/greedfall/gfx/word/quest.jpg"><section class="game2-obj-c">Rate It! Overview Review</section></div></main>`;
 const p=extract(html,'https://www.gamepressure.com/greedfall/world-map/z1');const q=cheerio.load(p.content);
 assert.equal(q('img').length,2);assert.equal(q('img').first().attr('src'),'https://www.gamepressure.com/static/mapy/full.jpg');assert.equal(q('figcaption').text(),'Mapa świata');assert(q('.callout').text().includes('Ważne'));assert(!q.text().includes('Rate It!'));
});
test('krótki artykuł nie dostaje pustej okładki ani osobnego spisu',()=>{
 const html=bookHtml([{title:'Porada',url:'https://example.com/guide',words:100,content:'<p>'+text+'</p>'}]);
 assert(html.includes('class="compact-head"'));assert(!html.includes('<div class="toc">'));assert(!html.includes('class="single-body"'));
});
test('wydanie bez ilustracji jest jednoznacznie podpisane',()=>{const html=bookHtml([{title:'Gra',url:'https://example.com',words:100,content:'<p>'+text+'</p>'}],{images:false});assert(html.includes('ilustracje wyłączone'));});
test('krótkie, prawdziwe indeksy działów pozostają dostępne dla odkrywania',()=>{
 const html='<h1>Rozdziały</h1><div class="p-word"><div><a href="/greedfall/a">Misja A</a><a href="/greedfall/b">Misja B</a></div><section class="game2-obj-c">'+text+'</section></div>';
 const p=extract(html,'https://www.gamepressure.com/greedfall/part/z1');assert.equal(p.kind,'index');assert.equal(p.links.length,2);
});
test('starszy zapis jest pobierany ponownie, zamiast utrwalać braki ekstrakcji',async()=>{
 const seed='https://www.ign.com/wikis/test';let calls=0;
 const engine=new Engine(()=>{},null,{fetcher:async url=>{calls++;return {url,type:'text/html',data:Buffer.from('<h1>Gra</h1><article>'+text+'</article>')};}});engine.allowed=async()=>{};
 const result=await engine.scan(seed,{mode:'single',resume:{version:1,seed,pages:[[seed,{url:seed,title:'Stara treść',content:'Brak mapy'}]],pending:[],warnings:[]}});
 assert.equal(calls,1);assert.equal(result.pages[0].title,'Gra');assert.equal(engine.snapshot().extractorVersion,EXTRACTOR_VERSION);
});
test('lokalny cache ilustracji nie wykonuje kolejnego pobierania ani opóźnienia sieciowego',async()=>{
 const fetcher=async()=>{throw new Error('Sieć nie powinna być użyta');};fetcher.peek=async url=>({url,type:'image/png',data:Buffer.from('png')});
 const engine=new Engine(()=>{},null,{fetcher});engine.allowed=async()=>{throw new Error('Opóźnienie nie powinno być wywołane');};
 engine.pages.set('a',{url:'https://example.com',title:'Gra',content:'<img src="https://example.com/image.png">'});
 await engine.chapters(['a'],true);assert.equal(engine.media.expected,1);assert.equal(engine.media.embedded,1);assert.equal(engine.media.failed,0);
});
test('robots.txt 403 nie blokuje publicznego obrazu; 429 i 500 zatrzymują pobieranie',async()=>{
 for(const status of [403,404,429,500]){
  const engine=new Engine(()=>{},null,{fetcher:async()=>{throw new Error('HTTP '+status);},wait:async()=>{}});
  if(status<420)await engine.allowed('https://cdn.example.com/photo.jpg');else await assert.rejects(engine.allowed('https://cdn.example.com/photo.jpg'),/robots/);
 }
});
test('leniwe filmy PowerPyx są linkami do wideo zamiast fałszywych ilustracji',()=>{
 const p=extract('<h1>Gra</h1><div class="entry-content"><p>'+text+'</p><img data-lazy-type="iframe" data-lazy-src="&lt;iframe src=&quot;//www.youtube.com/embed/abc&quot;&gt;&lt;/iframe&gt;"></div>','https://www.powerpyx.com/test-trophy-guide-roadmap/');
 const q=cheerio.load(p.content);assert.equal(p.images,0);assert.equal(q('a').attr('href'),'https://www.youtube.com/embed/abc');
});
test('symbole przycisków starszych poradników pozostają czytelnymi etykietami',()=>{
 const p=extract('<h1>Gra</h1><article class="text-article"><p>'+text+'Press <img class="inlineimg" src="/forum/images/smilies/L_1.png" title="L1 Button">.</p></article>','https://www.playstationtrophies.org/game/test/guide/');
 assert.equal(p.images,0);assert(p.content.includes('[L1 Button]'));
});
test('ilustracja SVG jest osadzana jako obraz, a hosting otrzymuje adres źródła',async()=>{
 let options;const engine=new Engine(()=>{},null,{fetcher:async(url,o)=>{options=o;return {url,type:'image/svg+xml',data:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M0 0h20v20H0z"/></svg>')};}});engine.allowed=async()=>{};
 engine.pages.set('a',{url:'https://example.com/guide',title:'Gra',content:'<img src="https://cdn.example.com/icon.svg">'});
 const [chapter]=await engine.chapters(['a'],true);assert.equal(options.referer,'https://example.com/guide');assert(chapter.content.includes('src="data:image/svg+xml;base64,'));assert(!chapter.content.includes('<svg'));
});
