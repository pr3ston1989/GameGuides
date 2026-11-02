const {app}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {Engine}=require('../src/engine.cjs');
const {extract}=require('../src/extract.cjs');
const {bookHtml}=require('../src/book.cjs');
const {printBook}=require('../src/pdf.cjs');
const {cachedDownloader}=require('../src/media-cache.cjs');
app.setPath('userData',path.resolve('output/qa/profile'));
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  const report=JSON.parse(await fs.readFile('docs/testing/samples.json','utf8'));
  const root=path.resolve('output/qa');await fs.mkdir(root,{recursive:true});
  const filter=process.env.QA_SITES?.split(',');
  let results=[];if(filter){try{results=JSON.parse(await fs.readFile(path.join(root,'pdf-report.json'),'utf8')).filter(r=>!filter.includes(r.site));}catch{}}
  const transport=cachedDownloader(path.join(root,'image-cache'));
  let index=0;
  const sites=report.results.filter(r=>r.samples.some(s=>s.status==='ok')&&(!filter||filter.includes(r.name)));
  async function worker(){while(index<sites.length){
    const site=sites[index++],local=JSON.parse(await fs.readFile(`output/research/${site.name.replace(/[^a-z0-9]/gi,'-')}.json`,'utf8'));
    const samples=site.samples.filter(s=>s.status==='ok');
    const imageSample=[...samples].sort((a,b)=>a.images-b.images)[0];
    for(const [i,sample] of samples.entries()){
      const key=site.name.replace(/[^a-z0-9]/gi,'-')+'-'+i;
      try{
        const original=local.samples.find(s=>s.url===sample.url);
        const page=extract(await fs.readFile('output/research/'+original.fixture,'utf8'),sample.url);
        const engine=new Engine(()=>{},null,{fetcher:transport});engine.pages.set(sample.url,page);engine.seed=sample.url;engine.warnings=(page.quality||[]).map(error=>({url:sample.url,error,kind:'quality'}));
        const images=process.env.QA_IMAGES==='all'||sample===imageSample;
        const chapters=await engine.chapters([sample.url],images);
        const file=path.join(root,key+'.pdf');
        const rendered=await printBook(bookHtml(chapters,{images,warnings:engine.warnings}),file);
        engine.warnings.push(...rendered.warnings);
        results.push({site:site.name,url:sample.url,file:path.basename(file),words:page.words,images,media:engine.media,warnings:engine.warnings,ok:true});
        console.log('PDF_OK',key,'images='+images,'warnings='+engine.warnings.length);
      }catch(e){results.push({site:site.name,url:sample.url,ok:false,error:e.message});console.log('PDF_ERROR',key,e.message);}
      await fs.writeFile(path.join(root,'pdf-report.json'),JSON.stringify(results,null,2));
    }
  }}
  await Promise.all([worker(),worker(),worker()]);app.exit(results.some(r=>!r.ok)?1:0);
}).catch(e=>{console.error(e);app.exit(1);});
