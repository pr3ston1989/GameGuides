const fs=require('node:fs/promises');const cheerio=require('cheerio');
const compact=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
(async()=>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const loading=pdfjs.getDocument({data:new Uint8Array(await fs.readFile('output/pdf/GreedFall-ilustrowany.pdf')),useSystemFonts:true}),doc=await loading.promise;
 const texts=[];
 for(let n=1;n<=doc.numPages;n++){const items=(await(await doc.getPage(n)).getTextContent()).items.filter(i=>i.str&&i.transform[5]>40);texts.push(items.map(i=>i.str).join(' '));}
 await loading.destroy();const actual=compact(texts.join(' ')),missing=[];let expected=0;
 for(const chapter of JSON.parse(await fs.readFile('output/polish/illustrated-chapters.json','utf8')).filter(c=>c.kind!=='index')){
  const q=cheerio.load(chapter.content);
  for(const p of q('p').toArray().map(e=>q(e).text().replace(/\s+/g,' ').trim()).filter(t=>t.length>60)){
   expected++;if(!actual.includes(compact(p)))missing.push({url:chapter.url,text:p});
  }
 }
 const report={expected,retained:expected-missing.length,missing,method:'NFKC; letters and digits in source paragraphs longer than 60 characters, compared with all PDF pages excluding footers'};
 await fs.writeFile('output/polish/paragraphs.json',JSON.stringify(report,null,2));console.log('PARAGRAPHS',expected,'MISSING',missing.length);if(missing.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
