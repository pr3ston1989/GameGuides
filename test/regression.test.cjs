const {test}=require('node:test');
const assert=require('node:assert/strict');
const cheerio=require('cheerio');
const {extract,imageSource}=require('../src/extract.cjs');
const {belongs,normalize}=require('../src/sites.cjs');
const {prepareChapters,bookHtml}=require('../src/book.cjs');
const text='Kompletna treść poradnika z informacjami o zadaniach i sekretach. '.repeat(8);

test('Nintendo Life: tabela i galeria w aside są treścią, powiązane artykuły są usuwane',()=>{
 const p=extract(`<h1>Gra</h1><div class="article-text"><p>${text}</p><aside class="object-google-sheet"><table><tr><td>Pokemon 230</td></tr></table></aside><aside class="gallery"><img src="/map.jpg"></aside><aside class="object-related"><p>Inna gra</p></aside></div>`,'https://www.nintendolife.com/guides/test');
 assert(p.content.includes('Pokemon 230'));assert(p.content.includes('/map.jpg'));assert(!p.content.includes('Inna gra'));
});
test('Game8: ignoruje puste h1 i okno członkostwa, wybiera właściwy poradnik',()=>{
 const p=extract(`<h1></h1><main class="p-membershipModal__content">${text}</main><div class="p-archiveHeader"><h1>Parry</h1></div><div class="archive-style-wrapper"><p>${text}</p><table><tr><td>Wymagana siła: 12</td></tr></table></div>`,'https://game8.co/games/Elden-Ring/archives/1');
 assert.equal(p.title,'Parry');assert(p.content.includes('Wymagana siła'));assert.equal(p.selector,'.archive-style-wrapper');
});
test('PlayStationTrophies: roadmap i wszystkie opisy trofeów z oddzielnych sekcji',()=>{
 const p=extract(`<h1>Trofea</h1><article class="text-article"><p>${text}</p></article><div class="achi"><ul class="achilist"><li class="achilist__item" id="item-1"><div class="list__pic"><img data-src="/trophy.png"></div><div class="achilist__data"><h4 class="achilist__title">Sekretne trofeum</h4><p>Cel trofeum</p></div><div class="text_res"><p>Pełny opis zdobycia trofeum.</p></div></li></ul></div>`,'https://www.playstationtrophies.org/game/test/guide/');
 assert(p.content.includes('Pełny opis zdobycia trofeum'));assert(p.content.includes('Sekretne trofeum'));assert(p.content.includes(text));assert(p.content.includes('class="trophy"'));
});
test('małe ikony trofeów i kontrolera pozostają wewnątrz wiersza tekstu',()=>{
 const p=extract(`<h1>Trofea</h1><article class="text-article"><p>${text}<img src="/images/icons/controller/trophy_gold.png" style="height:17px"> Zdobądź złoto.</p></article>`,'https://www.playstationtrophies.org/game/test/guide/');assert.equal(cheerio.load(p.content)('img').attr('class'),'inline-image');
});
test('IGN odzyskuje zdjęcie z danych strony tylko dla widocznego miejsca na obraz',()=>{
 const data={props:{pageProps:{page:{page:{htmlEntities:[{values:{html:'<img alt="Map" src="https://oyster.ignimgs.com/map.png"><img alt="Other" src="https://oyster.ignimgs.com/other.png">'}}]}}}}};
 const p=extract(`<h1>Gra</h1><div class="wiki-page"><p>${text}</p><img alt="Map" src="data:image/gif;base64,AA"></div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`,'https://www.ign.com/wikis/test/quest');
 assert(p.content.includes('https://oyster.ignimgs.com/map.png'));assert(!p.content.includes('other.png'));
});
test('base href, rozwijane sekcje, kotwice i brakujące obrazy',()=>{
 const p=extract(`<base href="https://www.pushsquare.com/"><h1>Gra</h1><div class="article-text"><p>${text}</p><details><summary>Boss</summary><p id="boss">Porada</p></details><a href="#boss">Skocz</a><a href="guides/another#section">Źródło</a><img><img data-src="/real.jpg" src="data:image/gif;base64,AA"></div>`,'https://www.pushsquare.com/guides/game');
 assert(!p.content.includes('details'));assert(p.content.includes('https://www.pushsquare.com/guides/another#section'));assert(!p.content.includes('undefined'));assert(p.content.includes('https://www.pushsquare.com/real.jpg'));assert(p.content.includes('href="#boss"'));
});
test('srcset wybiera odpowiednią rozdzielczość zamiast piksela śledzącego',()=>{const q=cheerio.load('<img src="/pixel.gif" srcset="/a.jpg 400w, /b.jpg 1200w, /c.jpg 2400w">');assert.equal(imageSource(q('img')),'/b.jpg');});
test('obrazy noscript są odzyskiwane, a duplikaty WordPress nie powielają zdjęć',()=>{
 const p=extract(`<h1>Gra</h1><article><p>${text}</p><picture><noscript><img src="/map.jpg"></noscript></picture><div><img src="/hero.jpg"><noscript><img src="/hero.jpg"></noscript></div><div><img src="data:image/gif;base64,AA"><noscript><img src="/real.jpg"></noscript></div></article>`,'https://example.com/guide');
 const q=cheerio.load(p.content);assert.equal(q('img').length,3);assert(q.html().includes('/map.jpg'));assert(q.html().includes('/real.jpg'));
});
test('katalog linków nie jest uznawany za poradnik',()=>{assert.throws(()=>extract(`<h1>Katalog</h1><article>${Array.from({length:20},(_,i)=>`<a href="/a${i}">Poradnik numer ${i} — przeczytaj</a>`).join('')}</article>`,'https://example.com'),/katalog/);});
test('indeks rozdziałów znanego poradnika jest zachowany i nie jest błędem dostępu',()=>{const p=extract(`<h1>FAQ</h1><div class="p-word">${Array.from({length:20},(_,i)=>`<a href="/greedfall/quest-${i}">Misja ${i}</a>`).join('')}</div>`,'https://www.gamepressure.com/greedfall/faq/z123');assert.equal(p.kind,'index');assert.equal(p.quality.length,0);assert.equal(p.links.length,20);});
test('krótki poradnik zawiera uwagę jakości, a nie fałszywą gwarancję kompletności',()=>{const p=extract(`<h1>Krótka strona</h1><article><p>${'Bardzo długie słowo '.repeat(9)}</p></article>`,'https://example.com');assert.equal(p.quality.length,1);});
test('Security check i weryfikacja człowieka nie są eksportowane jako poradnik',()=>{
 assert.throws(()=>extract(`<title>Security check</title><main>${text}</main>`,'https://www.neoseeker.com/test/walkthrough'),/CAPTCHA/);
 assert.throws(()=>extract(`<title>Neoseeker</title><main>Please verify you are human. ${'Welcome. '.repeat(20)}</main>`,'https://www.neoseeker.com/test/walkthrough'),/CAPTCHA/);
});
test('PowerPyx odkrywa podstrony tej samej gry i oddziela inne gry',()=>{
 const seed='https://www.powerpyx.com/dragons-dogma-2-trophy-guide-roadmap/';
 assert(belongs(seed,'https://www.powerpyx.com/dragons-dogma-2-all-quests/'));assert(!belongs(seed,'https://www.powerpyx.com/dragons-dogma-3-all-quests/'));
 assert(belongs('http://powerpyx.com/a/','https://www.powerpyx.com/a/'));assert.throws(()=>normalize(undefined,'https://example.com'));
});
test('kotwice nie kolidują między rozdziałami, linki do pobranych stron działają offline',()=>{
 const parts=prepareChapters([{url:'https://example.com/a',content:'<h2 id="boss">A</h2><a href="https://example.com/b#boss">B</a>'},{url:'https://example.com/b',content:'<h2 id="boss">B</h2><a href="#boss">Local</a>'}]);
 const a=cheerio.load(parts[0]),b=cheerio.load(parts[1]);assert.notEqual(a('h2').attr('id'),b('h2').attr('id'));assert.equal(a('a').attr('href'),'#'+b('h2').attr('id'));assert.equal(b('a').attr('href'),'#'+b('h2').attr('id'));
});
test('ustawienia PDF: bezpieczny tytuł, rozmiar tekstu i format poziomy',()=>{
 const html=bookHtml([{url:'https://example.com',title:'Gra',content:'<p>Text</p>'}],{title:'<img src=x onerror=alert(1)>',paper:'Letter',landscape:true,fontSize:99});assert(html.includes('size:Letter landscape'));assert(html.includes('font:13pt'));assert(html.includes('&lt;img'));
});
