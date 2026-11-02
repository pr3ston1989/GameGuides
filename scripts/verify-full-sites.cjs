const {app}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {Engine}=require('../src/engine.cjs'),{bookHtml}=require('../src/book.cjs'),{printBook}=require('../src/pdf.cjs'),{cachedDownloader}=require('../src/media-cache.cjs');
const reader=require('../src/reader.cjs');
const root=path.resolve('output/full-sites');
app.setPath('userData',path.join(root,'profile-'+(process.env.FULL_SITES||'all').replace(/[^a-z0-9]/gi,'')));app.on('window-all-closed',()=>{});
const cases=[
 ['IGN','https://www.ign.com/wikis/portal'],
 ['Gamer Guides','https://www.gamerguides.com/the-witcher-3-wild-hunt/guide/gwent/card-locations/gwent-in-novigrad'],
 ['GRYOnline','https://www.gry-online.pl/poradniki/assassins-creed-black-flag-resynced/'],
 ['Samurai Gamers','https://samurai-gamers.com/metaphor-refantazio/metaphor-does-demo-progress-carry-over/'],
 ['Game8','https://game8.co/games/Elden-Ring/archives/378552'],
 ['PowerPyx','https://www.powerpyx.com/dragons-dogma-2-trophy-guide-roadmap/'],
 ['Neoseeker','https://www.neoseeker.com/clair-obscur-expedition-33/','browser'],
 ['StrategyWiki','https://strategywiki.org/wiki/Tetris','browser'],
 ['PlayStationTrophies','https://www.playstationtrophies.org/game/mafia-3/guide/','browser'],
 ['GameFAQs','https://gamefaqs.gamespot.com/ps4/168653-persona-5/faqs'],
 ['PSNProfiles','https://psnprofiles.com/guide/11984-control-trophy-guide'],
 ['TrueAchievements','https://www.trueachievements.com/game/Control/walkthrough'],
 ['RPG Site','https://www.rpgsite.net/feature/16300-persona-3-reload-walkthrough-guide']
];
async function run([site,url,mode]){
 const name=site.replace(/[^a-z0-9]/gi,'-'),dir=path.join(root,name);await fs.mkdir(dir,{recursive:true});
 const reportFile=path.join(dir,'report.json');
 try{const old=JSON.parse(await fs.readFile(reportFile));if(old.finished&&!process.argv.includes('--retry'))return;}catch{}
 const transport=cachedDownloader(path.join(root,'images'));let last='';
 const engine=new Engine(p=>{const m=p.phase==='scan'?Math.floor(p.done/20):p.phase;if(m!==last){last=m;console.log(site,p.message);}},mode?reader.read:null,{fetcher:transport,fallbackReader:reader.read,checkpoint:s=>fs.writeFile(path.join(dir,'checkpoint.json'),JSON.stringify(s))});
 const report={site,url,started:new Date().toISOString(),mode:mode||'http'};
 try{
  let resume;try{resume=JSON.parse(await fs.readFile(path.join(dir,'checkpoint.json')));}catch{}
  const result=await engine.scan(url,{limit:3000,resume});
  const keys=result.pages.filter(p=>p.kind!=='index').map(p=>p.key);
  const chapters=await engine.chapters(keys,true);
  await fs.writeFile(path.join(dir,'chapters.json'),JSON.stringify(chapters));
  const printed=await printBook(bookHtml(chapters,{images:true,warnings:engine.warnings}),path.join(dir,'guide.pdf'));
  Object.assign(report,{discovered:result.pages.length,chapters:keys.length,pending:result.pending,truncated:result.truncated,pages:result.pages,media:engine.media,warnings:[...engine.warnings,...printed.warnings],status:result.pending||engine.warnings.length||printed.warnings.length?'with-issues':'exported',finished:new Date().toISOString()});
 }catch(e){Object.assign(report,{status:'failed',error:e.message,warnings:engine.warnings,finished:new Date().toISOString()});}
 await fs.writeFile(reportFile,JSON.stringify(report,null,2));console.log('FINISHED',site,report.status,report.chapters||0);
 reader.close();
}
app.whenReady().then(async()=>{await fs.mkdir(root,{recursive:true});const wanted=process.env.FULL_SITES?.split(',');for(const c of cases.filter(c=>!wanted||wanted.includes(c[0])))await run(c);app.exit(0);}).catch(e=>{console.error(e);app.exit(1);});
