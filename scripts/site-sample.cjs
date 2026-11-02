// Reproducible random sample from live catalogues, not hand-picked passing pages.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const cheerio = require('cheerio');
const { download } = require('../src/network.cjs');
const { extract } = require('../src/extract.cjs');
const { Engine } = require('../src/engine.cjs');
const catalogues = [
 ['IGN', 'https://www.ign.com/wikis/elden-ring', /\/wikis\/elden-ring\/.+/],
 ['PowerPyx', 'https://www.powerpyx.com/trophy-guides/', /\/[^/]+-trophy-guide-roadmap\/$/],
 ['PlayStationTrophies', 'https://www.playstationtrophies.org/guides/', /\/game\/[^/]+\/guide\//],
 ['Gamepressure', 'https://www.gamepressure.com/guides/', /gamepressure\.com\/(?!guides|newsroom|games|download|editorials|reviews)[^/]+\/$/],
 ['GRYOnline', 'https://www.gry-online.pl/poradniki/', /\/poradniki\/(?!wszystkie|rpg|akcji|strategiczne|przygodowe|symulacje)[^/]+\//],
 ['Neoseeker', 'https://www.neoseeker.com/clair-obscur-expedition-33/walkthrough', /neoseeker\.com\/clair-obscur-expedition-33\/[^/#?]+$/],
 ['StrategyWiki', 'https://strategywiki.org/wiki/Main_Page', /\/wiki\/[^:#?]+$/],
 ['Samurai Gamers', 'https://samurai-gamers.com/', /samurai-gamers\.com\/[^/]+\/[^/]+\/$/],
 ['Gamer Guides', 'https://www.gamerguides.com/', /gamerguides\.com\/[^/]+\/guide/],
 ['TrueAchievements', 'https://www.trueachievements.com/walkthroughs.aspx', /\/game\/[^/]+\/walkthrough/],
 ['Steam Community', 'https://steamcommunity.com/app/1245620/guides/', /\/sharedfiles\/filedetails\/\?id=\d+/],
 ['GameFAQs', 'https://gamefaqs.gamespot.com/ps5/323053-elden-ring/faqs', /\/faqs\/\d+/],
 ['RPG Site', 'https://www.rpgsite.net/category/guides', /\/guide\/\d+/],
 ['Push Square', 'https://www.pushsquare.com/guides', /\/guides\/[^/?#]+$/],
 ['Nintendo Life', 'https://www.nintendolife.com/guides', /\/guides\/[^/?#]+$/],
 ['GamesRadar+', 'https://www.gamesradar.com/guides/', /gamesradar\.com\/games\/[^/]+\/[^/?#]+\/$/],
 ['Eurogamer', 'https://www.eurogamer.net/guides', /eurogamer\.net\/[^/?#]+(?:guide|walkthrough|locations)[^/?#]*$/],
 ['PC Gamer', 'https://www.pcgamer.com/guides/', /pcgamer\.com\/games\/[^/]+\/[^/?#]+\/$/],
 ['Game8', 'https://game8.co/games/Elden-Ring', /\/games\/[^/]+\/archives\/\d+/],
 ['PSNProfiles', 'https://psnprofiles.com/guides', /\/guide\/\d+/]
];
const root = path.resolve('output/research');
const seed = process.env.SAMPLE_SEED || 'gameguides-2026-11-02-v2';
function rank(url) { return crypto.createHash('sha256').update(seed + url).digest('hex'); }
async function work([name, catalogue, pattern]) {
 const result = { name, catalogue, seed, candidates: [], samples: [], catalogError: null };
 const engine = new Engine();
 try {
  await engine.allowed(catalogue);
  const response = await download(catalogue);
  const $ = cheerio.load(response.data.toString());
  const candidates = new Set();
  $('a[href]').each((_, el) => { try { const u = new URL($(el).attr('href'), response.url); u.hash = ''; if (pattern.test(u.href) && u.hostname.replace(/^www\./,'') === new URL(catalogue).hostname.replace(/^www\./,'')) candidates.add(u.href); } catch {} });
  result.candidates = [...candidates].sort();
  const selected = [...candidates].sort((a,b)=>rank(a).localeCompare(rank(b))).slice(0,2);
  if (!selected.length) result.catalogError = 'Katalog nie zawiera pasujących linków w statycznym HTML.';
  for (const [index, url] of selected.entries()) {
   const row = { url, status: 'error' }; const start = Date.now();
   try {
    await engine.allowed(url);
    const r = await download(url);
    const file = `${name.replace(/[^a-z0-9]/gi,'-')}-${index}.html`;
    await fs.writeFile(path.join(root,file),r.data);
    row.fixture = file;
    const article = extract(r.data.toString(),r.url);
    const q = cheerio.load(article.content); const total=q.text().length;
    Object.assign(row,{status:'ok',title:article.title,words:article.words,links:article.links.length,images:q('img').length,tables:q('table').length,headings:q('h2,h3,h4').length,linkDensity:Math.round(q('a').text().length/Math.max(total,1)*100)/100});
   } catch(e) { row.error=e.message; }
   row.elapsedMs=Date.now()-start; result.samples.push(row);
  }
 } catch(e) { result.catalogError=e.message; }
 await fs.writeFile(path.join(root,name.replace(/[^a-z0-9]/gi,'-')+'.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,candidates:result.candidates.length})); return result;
}
async function main() {
 await fs.mkdir(root,{recursive:true});
 const results=[]; let index=0;
 const entries=process.env.SAMPLE_SITES?catalogues.filter(c=>process.env.SAMPLE_SITES.split(',').includes(c[0])):catalogues;
 async function worker(){while(index<entries.length){const entry=entries[index++];results.push(await work(entry));}}
 await Promise.all([worker(),worker(),worker()]);
 await fs.writeFile(path.join(root,'sample-report.json'),JSON.stringify({seed,created:new Date().toISOString(),results},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={catalogues,rank};
