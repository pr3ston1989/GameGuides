const {test}=require('node:test');const assert=require('node:assert/strict');
const {normalize,belongs,adapter}=require('../src/sites.cjs');const {extract}=require('../src/extract.cjs');const {privateIP}=require('../src/network.cjs');const {bookHtml}=require('../src/book.cjs');
test('adresy i granice poradnika',()=>{
 assert.equal(normalize('/wikis/game/Quest?utm_source=x#foo','https://www.ign.com'),'https://www.ign.com/wikis/game/Quest');
 assert(belongs('https://www.ign.com/wikis/game','https://www.ign.com/wikis/game/Quest'));
 assert(!belongs('https://www.ign.com/wikis/game','https://www.ign.com/wikis/game-other'));
 assert(!belongs('https://www.ign.com/wikis/game','https://evil.com/wikis/game'));
 assert(belongs('https://www.gamepressure.com/ac-valhalla/','https://www.gamepressure.com/ac-valhalla/quest/z123'));
 assert(!belongs('https://www.powerpyx.com/game-guide/','https://www.powerpyx.com/other/'));
 assert.equal(adapter('https://evilign.com').name,'Tryb uniwersalny');assert.throws(()=>normalize('file:///C:/secret'));
});
test('ekstrakcja treści, nawigacja i neutralizacja HTML',()=>{
 const html='<h1>Gra</h1><nav><a href="/wikis/game/quest">Quest</a></nav><article><h2>Start</h2><p>'+('Treść poradnika. '.repeat(40))+'</p><script>alert(1)</script><img data-src="/map.png" onerror="alert(1)"><a href="javascript:evil()">bad</a><iframe src="https://evil.com"></iframe></article>';
 const r=extract(html,'https://www.ign.com/wikis/game');assert.equal(r.links.length,1);assert(r.content.includes('https://www.ign.com/map.png'));assert(!/script|onerror|iframe|javascript:/.test(r.content));
 assert.throws(()=>extract('<title>Just a moment</title><article>captcha</article>','https://ign.com/wikis/game'),/CAPTCHA/);
});
test('blokowanie prywatnych adresów IPv4 i IPv6',()=>{for(const ip of ['127.0.0.1','10.1.2.3','192.168.0.2','169.254.169.254','::1','::ffff:127.0.0.1','fe80::1'])assert(privateIP(ip),ip);for(const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111'])assert(!privateIP(ip),ip);});
test('książka ma spis, źródła i bezpieczny tytuł',()=>{const html=bookHtml([{title:'<script>x</script>',url:'https://example.com',content:'<p>Text</p>'}]);assert(html.includes('href="#chapter-0"'));assert(html.includes('&lt;script&gt;'));assert(html.includes('Źródło:'));assert(html.includes("default-src 'none'"));});
