const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const sharp=require('sharp');
const cheerio=require('cheerio');
const {extract}=require('../src/extract.cjs');
const tokenise=s=>s.normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
async function main(){
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const root=path.resolve('output/qa');const report=JSON.parse(await fs.readFile(path.join(root,'pdf-report.json'),'utf8'));
 const results=[];
 await fs.mkdir(path.join(root,'renders'),{recursive:true});
 for(const item of report.filter(x=>x.ok)){
  const pdf=path.join(root,item.file),name=path.basename(item.file,'.pdf');
  const loading=pdfjs.getDocument({data:new Uint8Array(await fs.readFile(pdf)),useSystemFonts:true});
  const doc=await loading.promise;
  const pages=doc.numPages,overflow=[],brokenLinks=[],texts=[];let internalLinks=0;
  for(let index=1;index<=pages;index++){
    const page=await doc.getPage(index),viewport=page.getViewport({scale:1});
    const items=(await page.getTextContent()).items.filter(i=>i.str);
    texts.push(items.map(i=>i.str).join(' '));
    for(const item of items){const [x,y]=item.transform.slice(4);if(x< -1||y< -1||x+item.width>viewport.width+1||y>viewport.height+1)overflow.push({page:index,text:item.str,x,y,width:item.width});}
    for(const a of await page.getAnnotations()){if(a.dest){internalLinks++;if(typeof a.dest==='string'&&!await doc.getDestination(a.dest))brokenLinks.push({page:index,dest:a.dest});}}
  }
  const text=texts.join(' ');await loading.destroy();
  const sample=JSON.parse(await fs.readFile(`output/research/${item.site.replace(/[^a-z0-9]/gi,'-')}.json`,'utf8')).samples.find(s=>s.url===item.url);
  const article=extract(await fs.readFile('output/research/'+sample.fixture,'utf8'),sample.url);
  const source=cheerio.load(article.content);
  const expectedText=source.root().find('*').contents().filter((_,n)=>n.type==='text').map((_,n)=>source(n).text()).get().join(' ');
  const expected=new Set(tokenise(expectedText)),actual=new Set(tokenise(text));
  const missing=[...expected].filter(t=>!actual.has(t));
  const coverage=1-missing.length/expected.size;
  const prefix=path.join(root,'renders',name);
  execFileSync('pdftoppm',['-scale-to','440','-png',pdf,prefix],{maxBuffer:10*1024*1024});
  const files=(await fs.readdir(path.join(root,'renders'))).filter(f=>f.startsWith(name+'-')&&f.endsWith('.png')).sort();
  const tiles=await Promise.all(files.map(async(file,i)=>({input:await sharp(path.join(root,'renders',file)).resize(210,300,{fit:'contain',background:'#ddd'}).toBuffer(),left:i%5*220,top:Math.floor(i/5)*310})));
  await sharp({create:{width:1100,height:Math.ceil(files.length/5)*310,channels:3,background:'#ddd'}}).composite(tiles).png().toFile(path.join(root,name+'-contact.png'));
  results.push({...item,pdfPages:pages,tokenCoverage:Math.round(coverage*10000)/10000,missingTokens:missing,overflow,internalLinks,brokenLinks});
  console.log(name,'pages',pages,'coverage',coverage.toFixed(3),'overflow',overflow.length);
 }
 await fs.writeFile(path.join(root,'visual-report.json'),JSON.stringify(results,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
