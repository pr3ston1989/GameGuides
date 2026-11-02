const sites = [
  {name:'IGN', host:'ign.com', selector:'.wiki-page, .wiki-page-content, .wiki-guide-content, [class*="article-content"], article', scope:u=>u.pathname.match(/^\/wikis\/[^/]+/)?.[0]},
  {name:'PowerPyx', host:'powerpyx.com', selector:'.entry-content', scope:u=>u.pathname.match(/^\/(.+)-trophy-guide-roadmap\/?$/)?.[1], slugPrefix:true},
  {name:'PlayStationTrophies', host:'playstationtrophies.org', selector:'article.text-article, .achi', collect:true, single:true},
  {name:'Gamepressure', host:'gamepressure.com', selector:'.p-word, .article, .article-content, #article, article, main', scope:u=>'/'+u.pathname.split('/').filter(Boolean)[0]+'/'},
  {name:'GRYOnline', host:'gry-online.pl', selector:'.p-word, .article, #article, article, main', scope:u=>u.pathname.startsWith('/poradniki/') ? '/poradniki/'+u.pathname.split('/')[2] : null},
  {name:'Neoseeker', host:'neoseeker.com', selector:'#wiki-content, .wiki-content, #faq_content, article, main', scope:u=>'/'+u.pathname.split('/').filter(Boolean)[0]+'/'},
  {name:'StrategyWiki', host:'strategywiki.org', selector:'#mw-content-text .mw-parser-output, #mw-content-text', scope:u=>'/wiki/'+u.pathname.slice(6).split('/')[0]},
  {name:'Samurai Gamers', host:'samurai-gamers.com', selector:'.entry-content', scope:u=>'/'+u.pathname.split('/').filter(Boolean)[0]+'/'},
  {name:'Gamer Guides', host:'gamerguides.com', selector:'.guide-page-content-body, .guide-page-content, article.guide-page', scope:u=>'/'+u.pathname.split('/').filter(Boolean)[0]+'/guide'},
  {name:'TrueAchievements', host:'trueachievements.com', selector:'.walkthrough, #walkthrough, article, main', scope:u=>u.pathname.match(/^\/game\/[^/]+\/walkthrough/)?.[0]},
  {name:'Steam Community', host:'steamcommunity.com', selector:'.guide.subSections', titleSelector:'.workshopItemTitle', single:true},
  {name:'GameFAQs', host:'gamefaqs.gamespot.com', selector:'.faqtext, #faqtext, .faq, article', single:true},
  {name:'Game8', host:'game8.co', selector:'.archive-style-wrapper', titleSelector:'.p-archiveHeader h1', scope:u=>u.pathname.match(/^\/games\/[^/]+/)?.[0]},
  {name:'Push Square', host:'pushsquare.com', selector:'.article-text, #article .body-text', single:true},
  {name:'Nintendo Life', host:'nintendolife.com', selector:'.article-text, #article .body-text', single:true},
  {name:'Eurogamer', host:'eurogamer.net', selector:'.article_body_content, .article_body', single:true},
  {name:'GamesRadar+', host:'gamesradar.com', selector:'#article-body, .article-body', single:true},
  {name:'PC Gamer', host:'pcgamer.com', selector:'#article-body, .article-body', single:true},
  {name:'RPG Site', host:'rpgsite.net', selector:'.article-body, .article_body, .article-content, article', single:true},
  {name:'PSNProfiles', host:'psnprofiles.com', selector:'.guide, #content .guide, article', single:true}
];
function normalize(value, base) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Brak adresu strony.');
  if (/[<>\x00-\x1f]/.test(value)) throw new Error('Nieprawidłowy adres strony.');
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
  if(/\/Special:/i.test(b.pathname))return false;
  if(s.name==='Game8'&&/\/archives\/(?:[^/]+\/comments(?:\/|$)|:[^/]+)/i.test(b.pathname))return false;
  if(s.name==='Game8'&&/\/boards(?:\/|$)/i.test(b.pathname))return false;
  const sameHost=a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&a.port===b.port;
  if(!sameHost) return false;
  if(s.single) return a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,'')&&a.search===b.search;
  const scope=s.scope?.(a);
  if(!scope) return a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,'')&&a.search===b.search;
  const p=b.pathname;
  if(s.slugPrefix) return p==='/'+scope+'/'||p.startsWith('/'+scope+'-');
  return p===scope || p.startsWith(scope.endsWith('/')?scope:scope+'/');
}
module.exports={sites,normalize,adapter,belongs};
