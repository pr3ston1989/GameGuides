const sites = [
  {name:'IGN', host:'ign.com', selector:'.wiki-page-content, .wiki-guide-content, [class*="article-content"], article', scope:u=>u.pathname.match(/^\/wikis\/[^/]+/)?.[0]},
  {name:'PowerPyx', host:'powerpyx.com', selector:'.entry-content', single:true},
  {name:'PlayStationTrophies', host:'playstationtrophies.org', selector:'.guide-content, .guide, article, main', scope:u=>u.pathname.match(/^\/game\/[^/]+/)?.[0]},
  {name:'Gamepressure', host:'gamepressure.com', selector:'.p-word, .article, .article-content, #article, article, main', scope:u=>'/'+u.pathname.split('/').filter(Boolean)[0]+'/'},
  {name:'GRYOnline', host:'gry-online.pl', selector:'.article, #article, article, main', scope:u=>u.pathname.startsWith('/poradniki/') ? '/poradniki/'+u.pathname.split('/')[2] : null},
  {name:'Neoseeker', host:'neoseeker.com', selector:'#wiki-content, .wiki-content, #faq_content, article, main', scope:u=>'/'+u.pathname.split('/').filter(Boolean)[0]+'/'},
  {name:'StrategyWiki', host:'strategywiki.org', selector:'#mw-content-text .mw-parser-output, #mw-content-text', scope:u=>'/wiki/'+u.pathname.slice(6).split('/')[0]},
  {name:'Samurai Gamers', host:'samurai-gamers.com', selector:'.entry-content', scope:u=>'/'+u.pathname.split('/').filter(Boolean)[0]+'/'},
  {name:'Gamer Guides', host:'gamerguides.com', selector:'article, .guide-content, main', scope:u=>'/'+u.pathname.split('/').filter(Boolean)[0]+'/guide/'},
  {name:'TrueAchievements', host:'trueachievements.com', selector:'.walkthrough, #walkthrough, article, main', scope:u=>u.pathname.match(/^\/game\/[^/]+\/walkthrough/)?.[0]},
  {name:'Steam Community', host:'steamcommunity.com', selector:'.guide.subSections, .guide', single:true},
  {name:'GameFAQs', host:'gamefaqs.gamespot.com', selector:'.faqtext, #faqtext, .faq, article', single:true}
];
function normalize(value, base) {
  const u = new URL(value, base);
  if (!['http:','https:'].includes(u.protocol) || u.username || u.password) throw new Error('Podaj publiczny adres HTTP lub HTTPS.');
  u.hash='';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
  u.hostname=u.hostname.toLowerCase();
  return u.href;
}
function adapter(url) { const u=new URL(url); return sites.find(s=>u.hostname===s.host || u.hostname.endsWith('.'+s.host)) || {name:'Tryb uniwersalny',selector:'article, main, .entry-content, #content',single:true}; }
function belongs(seed, candidate) {
  const a=new URL(seed), b=new URL(candidate), s=adapter(seed);
  if(a.origin!==b.origin || s.single) return normalize(seed)===normalize(candidate);
  const scope=s.scope?.(a);
  if(!scope) return normalize(seed)===normalize(candidate);
  const p=b.pathname;
  return p===scope || p.startsWith(scope.endsWith('/')?scope:scope+'/');
}
module.exports={sites,normalize,adapter,belongs};
