const fs=require('node:fs/promises'),path=require('node:path'),cheerio=require('cheerio'),sharp=require('sharp');
const {execFileSync}=require('node:child_process');
const norm=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
(async()=>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const root=path.resolve('output/full-sites');
 for(const dirName of await fs.readdir(root)){
  const dir=path.join(root,dirName);let report;try{report=JSON.parse(await fs.readFile(path.join(dir,'report.json')));}catch{continue;}
  if(!report.chapters)continue;try{await fs.access(path.join(dir,'inspection.json'));continue;}catch{}
  const loading=pdfjs.getDocument({data:new Uint8Array(await fs.readFile(path.join(dir,'guide.pdf'))),useSystemFonts:true}),doc=await loading.promise;
  const outside=[],texts=[],broken=[];let draws=0,links=0;
  for(let n=1;n<=doc.numPages;n++){
   const p=await doc.getPage(n),v=p.getViewport({scale:1}),items=(await p.getTextContent()).items.filter(i=>i.str);
   texts.push(items.filter(i=>i.transform[5]>40).map(i=>i.str).join(' '));
   for(const i of items){const [x,y]=i.transform.slice(4);if(x< -1||x+i.width>v.width+1||y< -1||y>v.height+1)outside.push({page:n,text:i.str});}
   draws+=(await p.getOperatorList()).fnArray.filter(o=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject].includes(o)).length;
   for(const a of await p.getAnnotations())if(a.dest){links++;if(typeof a.dest==='string'&&!await doc.getDestination(a.dest))broken.push({page:n,dest:a.dest});}
  }
  const actual=norm(texts.join(' ')),missing=[];let paragraphs=0;
  for(const c of JSON.parse(await fs.readFile(path.join(dir,'chapters.json')))){const q=cheerio.load(c.content);for(const p of q('p').toArray().map(e=>q(e).text().trim()).filter(s=>s.length>60)){paragraphs++;if(!actual.includes(norm(p)))missing.push({url:c.url,text:p});}}
  const pages=doc.numPages;await loading.destroy();
  await fs.mkdir(path.join(dir,'renders'),{recursive:true});
  execFileSync('pdftoppm',['-scale-to','300','-png',path.join(dir,'guide.pdf'),path.join(dir,'renders','p')]);
  for(let first=1;first<=pages;first+=48){const tiles=[];for(let i=0;i<Math.min(48,pages-first+1);i++){tiles.push({input:await sharp(path.join(dir,'renders',`p-${String(first+i).padStart(String(pages).length,'0')}.png`)).resize(150,213,{fit:'contain',background:'#ddd'}).toBuffer(),left:i%8*160,top:Math.floor(i/8)*223});}await sharp({create:{width:1280,height:Math.ceil(tiles.length/8)*223,channels:3,background:'#ddd'}}).composite(tiles).png().toFile(path.join(dir,`board-${first}.png`));}
  const inspection={site:report.site,pdfPages:pages,draws,expectedImages:report.media.embedded,paragraphs,missingParagraphs:missing,overflow:outside,links,brokenLinks:broken,renderedPages:pages,manualReview:'pending'};
  await fs.writeFile(path.join(dir,'inspection.json'),JSON.stringify(inspection,null,2));console.log(report.site,pages,'pages',draws,'images','missing paragraphs',missing.length,'overflow',outside.length);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
