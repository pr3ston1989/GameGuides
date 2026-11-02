const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const sharp=require('sharp');
(async()=>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const file=path.resolve('output/full-guide/GreedFall.pdf'),scan=JSON.parse(await fs.readFile('output/full-guide/report.json','utf8'));
 const loading=pdfjs.getDocument({data:new Uint8Array(await fs.readFile(file)),useSystemFonts:true});const doc=await loading.promise;
 const overflow=[],brokenLinks=[],cache=new Map();let links=0;
 for(let n=1;n<=doc.numPages;n++){
  const page=await doc.getPage(n),view=page.getViewport({scale:1});
  for(const item of (await page.getTextContent()).items.filter(i=>i.str)){const [x,y]=item.transform.slice(4);if(x< -1||y< -1||x+item.width>view.width+1||y>view.height+1)overflow.push({page:n,text:item.str});}
  for(const a of await page.getAnnotations())if(a.dest){links++;if(typeof a.dest==='string'){if(!cache.has(a.dest))cache.set(a.dest,await doc.getDestination(a.dest));if(!cache.get(a.dest))brokenLinks.push({page:n,dest:a.dest});}}
 }
 const pages=doc.numPages;await loading.destroy();
 const selected=[1,2,5,12,40,80,160,240,320,400,pages].filter(p=>p<=pages),tiles=[];
 for(const [i,page] of selected.entries()){
  const prefix=path.resolve(`output/full-guide/page-${page}`);execFileSync('pdftoppm',['-f',String(page),'-singlefile','-scale-to','600','-png',file,prefix]);
  tiles.push({input:await sharp(prefix+'.png').resize(260,370,{fit:'contain',background:'#ddd'}).toBuffer(),left:i%4*270,top:Math.floor(i/4)*380});
 }
 await sharp({create:{width:1080,height:Math.ceil(tiles.length/4)*380,channels:3,background:'#ddd'}}).composite(tiles).png().toFile('output/full-guide/contact.png');
 const report={...scan,pdfPages:pages,internalLinks:links,brokenLinks,overflow,visuallySampledPages:selected};
 await fs.writeFile('docs/testing/full-guide.json',JSON.stringify(report,null,2));console.log(JSON.stringify({chapters:report.pages.length,pdfPages:pages,links,brokenLinks:brokenLinks.length,overflow:overflow.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
