const {app}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {Engine}=require('../src/engine.cjs');
const {extract}=require('../src/extract.cjs');
const {cachedDownloader}=require('../src/media-cache.cjs');
const {root,seed,rawDownload}=require('./polish-greedfall.cjs');
const {bookHtml}=require('../src/book.cjs');
const {printBook}=require('../src/pdf.cjs');
app.setPath('userData',path.join(root,'preview-profile'));app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const checkpoint=JSON.parse(await fs.readFile(path.join(root,'fresh-checkpoint.json'),'utf8'));
 const slugs=['/beginners-guide/','/character-development/','/the-charlatan/','/world-map/'];
 const keys=slugs.map(slug=>checkpoint.pages.find(([url])=>url.includes(slug))?.[0]).filter(Boolean);
 const engine=new Engine(p=>{if(p.phase==='export')console.log(p.message);},null,{fetcher:cachedDownloader(path.join(root,'images'))});engine.seed=seed;
 for(const url of keys){const r=await rawDownload(url);engine.pages.set(url,extract(r.data.toString(),r.url,seed));}
 const chapters=await engine.chapters(keys,true);
 const result=await printBook(bookHtml(chapters,{title:'GreedFall — podgląd składu z ilustracjami',warnings:engine.warnings}),path.join(root,'preview.pdf'));
 await fs.writeFile(path.join(root,'preview-report.json'),JSON.stringify({keys,media:engine.media,warnings:[...engine.warnings,...result.warnings]},null,2));
 console.log('PREVIEW_READY',chapters.length,engine.media.embedded);app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
