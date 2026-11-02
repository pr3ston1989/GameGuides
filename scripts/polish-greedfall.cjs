const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const cheerio=require('cheerio');
const {Engine}=require('../src/engine.cjs');
const {download}=require('../src/network.cjs');
const {extract}=require('../src/extract.cjs');
const {cachedDownloader}=require('../src/media-cache.cjs');
const root=path.resolve('output/polish');
const seed='https://www.gamepressure.com/greedfall/';
const hash=s=>createHash('sha256').update(s).digest('hex');
async function rawDownload(url,options){
 const file=path.join(root,'raw',hash(url)+'.json');
 try{const r=JSON.parse(await fs.readFile(file,'utf8'));return {...r,data:Buffer.from(r.data,'base64')};}catch{}
 const r=await download(url,options);
 if(/text\/html/.test(r.type)){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify({...r,data:r.data.toString('base64')}));}
 return r;
}
async function fetchGuide(){
 await fs.mkdir(root,{recursive:true});let previous=-1;
 const engine=new Engine(p=>{if(p.phase==='scan'&&Math.floor(p.done/10)!==previous){previous=Math.floor(p.done/10);console.log(p.message);}},null,{fetcher:rawDownload,checkpoint:s=>fs.writeFile(path.join(root,'fresh-checkpoint.json'),JSON.stringify(s))});
 const result=await engine.scan(seed,{limit:1000});console.log('FRESH_SCAN',result.pages.length,result.warnings.length);
}
async function prepareImages(){
 const checkpoint=JSON.parse(await fs.readFile(path.join(root,'fresh-checkpoint.json'),'utf8'));
 const transport=cachedDownloader(path.join(root,'images'));
 let lastChapter='';
 const engine=new Engine(p=>{if(p.phase==='export'&&p.message!==lastChapter){lastChapter=p.message;console.log(p.message);}},null,{fetcher:transport});
 engine.seed=seed;engine.seen=new Set(checkpoint.seen);
 const audit=[];
 const keys=[...new Set([...checkpoint.pages.map(([key])=>key),...checkpoint.warnings.filter(w=>w.kind==='page').map(w=>w.url)])];
 for(const key of keys){
  const response=await rawDownload(key);const html=response.data.toString();
  const page=extract(html,response.url,seed);engine.pages.set(key,page);
  const q=cheerio.load(html),article=q('.p-word').first().clone();
  const images=article.find('img[src]').toArray().map(el=>q(el).attr('src')).filter(s=>s.includes('/greedfall/gfx/word/')).map(s=>new URL(s,response.url).href);
  const mapImages=q('main > .guide16-map-c a.guide-map-2020-zoom[href]').toArray().map(el=>new URL(q(el).attr('href'),response.url).href);images.push(...mapImages);
  article.find('.auth-bio-c,.s024-np-c,.game2-obj-c,.btd.pb20.pt20,.no-print,script,style,nav,footer').remove();
  const expectedParagraphs=article.find('p').toArray().map(el=>q(el).text().replace(/\s+/g,' ').trim()).filter(t=>t.length>60);
  const parsed=cheerio.load(page.content),text=parsed.text().replace(/\s+/g,' ').trim();
  const actualImages=parsed('img').toArray().map(el=>parsed(el).attr('src'));
  audit.push({url:key,title:page.title,kind:page.kind,sourceImages:images,sourceMapImages:mapImages,retainedImages:actualImages,missingImages:images.filter(u=>!actualImages.includes(u)),sourceParagraphs:expectedParagraphs.length,missingParagraphs:expectedParagraphs.filter(t=>!text.includes(t)),tablesBefore:article.find('table').length,tablesAfter:parsed('table').length});
 }
 await fs.writeFile(path.join(root,'source-audit.json'),JSON.stringify(audit,null,2));
 const chapters=await engine.chapters(engine.result().pages.map(p=>p.key),true);
 await fs.writeFile(path.join(root,'illustrated-chapters.json'),JSON.stringify(chapters));
 await fs.writeFile(path.join(root,'image-report.json'),JSON.stringify({placements:chapters.reduce((n,c)=>n+cheerio.load(c.content)('img').length,0),media:engine.media,warnings:engine.warnings},null,2));
 console.log('ILLUSTRATED_READY',chapters.length,engine.warnings.length);
}
if(require.main===module){(process.argv.includes('--images')?prepareImages():fetchGuide()).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={root,seed,rawDownload,prepareImages};
