const {app}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const cheerio=require('cheerio');
const {catalogues,rank}=require('./site-sample.cjs');
const {Engine}=require('../src/engine.cjs');
const {extract,assertAccessible}=require('../src/extract.cjs');
const reader=require('../src/reader.cjs');
app.setPath('userData',path.resolve('output/browser-samples/profile'));app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 for(const [name,catalogue,pattern] of catalogues.filter(c=>(process.env.BROWSER_SAMPLE_SITES||'StrategyWiki').split(',').includes(c[0]))){
  reader.close();
  const engine=new Engine(),result={name,catalogue,seed:'gameguides-2026-11-02-v2',mode:'browser',candidates:[],samples:[],catalogError:null};
  try{
   await engine.allowed(catalogue);const r=await reader.read(catalogue,engine.signal);
   const $=cheerio.load(r.data.toString()),set=new Set();
   assertAccessible($,$('title').text());
   $('a[href]').each((_,el)=>{try{const u=new URL($(el).attr('href'),r.url);u.hash='';if(pattern.test(u.href)&&u.hostname===new URL(catalogue).hostname&&u.href!==catalogue)set.add(u.href);}catch{}});
   if(name==='StrategyWiki')for(const url of set)if(/\/wiki\/(?:\d+|PlayStation[^/]*|Steam|Windows|Xbox[^/]*)$/.test(url))set.delete(url);
   result.candidates=[...set].sort();
   if(!set.size)result.catalogError='Katalog nie zawiera pasujących linków do poradników.';
   for(const [i,url] of [...set].sort((a,b)=>rank(a).localeCompare(rank(b))).slice(0,2).entries()){
    const row={url,status:'error',mode:'browser'};
    try{
     await engine.allowed(url);const response=await reader.read(url,engine.signal);
     row.fixture=`${name.replace(/[^a-z0-9]/gi,'-')}-${i}.html`;await fs.writeFile('output/research/'+row.fixture,response.data);
     const p=extract(response.data.toString(),response.url);const q=cheerio.load(p.content);
     Object.assign(row,{status:'ok',title:p.title,words:p.words,images:q('img').length,tables:q('table').length,headings:q('h2,h3').length,quality:p.quality});
    }catch(e){row.error=e.message;}
    result.samples.push(row);
   }
  }catch(e){result.catalogError=e.message;}
  await fs.writeFile(`output/research/${name.replace(/[^a-z0-9]/gi,'-')}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,candidates:result.candidates.length}));
 }
 reader.close();app.exit(0);
}).catch(e=>{console.error(e);reader.close();app.exit(1);});
