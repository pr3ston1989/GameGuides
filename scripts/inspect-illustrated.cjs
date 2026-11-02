const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {PDFDocument,PDFRawStream,PDFName}=require('pdf-lib');
const hash=data=>createHash('sha256').update(data).digest('hex');
async function inspect(file,mediaFile,output){
 const data=await fs.readFile(file),raw=await PDFDocument.load(data);
 const encodedImages=new Set();let imageObjects=0;
 for(const [,object] of raw.context.enumerateIndirectObjects())if(object instanceof PDFRawStream&&object.dict.get(PDFName.of('Subtype'))?.toString()==='/Image'){
  imageObjects++;if(object.dict.get(PDFName.of('Filter'))?.toString().includes('DCTDecode'))encodedImages.add(hash(object.getContents()));
 }
 const manifest=JSON.parse(await fs.readFile(mediaFile,'utf8')),media=manifest.media||manifest;
 const originals=[];
 for(const url of new Set((media.assets||[]).filter(a=>a.status==='embedded').map(a=>a.url))){
  const cached=JSON.parse(await fs.readFile(path.resolve('output/polish/images',hash(url)+'.json'),'utf8'));
  if(cached.type==='image/jpeg')originals.push({url,exactJpegPreserved:encodedImages.has(hash(Buffer.from(cached.data,'base64')))});
 }
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const loading=pdfjs.getDocument({data:new Uint8Array(data),useSystemFonts:true});const doc=await loading.promise;
 const pages=[],outside=[],footerCollisions=[],brokenLinks=[],destCache=new Map();let imagePlacements=0,internalLinks=0;
 const imageOps=new Set([pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject]);
 for(let n=1;n<=doc.numPages;n++){
  const page=await doc.getPage(n),view=page.getViewport({scale:1}),items=(await page.getTextContent()).items.filter(i=>i.str);
  const footer=items.find(i=>i.transform[5]<40&&i.str.includes('GameGuides'));
  for(const item of items){const [x,y]=item.transform.slice(4);if(x< -1||x+item.width>view.width+1||y< -1||y>view.height+1)outside.push({page:n,text:item.str});if(footer&&item!==footer&&y>footer.transform[5]&&y<45)footerCollisions.push({page:n,text:item.str});}
  const operators=await page.getOperatorList();const images=operators.fnArray.filter(fn=>imageOps.has(fn)).length;imagePlacements+=images;
  for(const a of await page.getAnnotations())if(a.dest){internalLinks++;if(typeof a.dest==='string'){if(!destCache.has(a.dest))destCache.set(a.dest,await doc.getDestination(a.dest));if(!destCache.get(a.dest))brokenLinks.push({page:n,dest:a.dest});}}
  pages.push({page:n,images,textLength:items.map(i=>i.str).join(' ').length});
 }
 const destinations={};
 for(let i=0;i<200;i++){const dest=await doc.getDestination('chapter-'+i);if(!dest)break;destinations[i]=await doc.getPageIndex(dest[0])+1;}
 const report={file:path.basename(file),pdfPages:doc.numPages,imageObjects,imagePlacements,expectedPlacements:media.embedded,jpegOriginals:originals.length,exactJpegMatches:originals.filter(x=>x.exactJpegPreserved).length,jpegMismatches:originals.filter(x=>!x.exactJpegPreserved),outside,footerCollisions,internalLinks,brokenLinks,destinations,pages};
 await loading.destroy();await fs.writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,pages:report.pages.length,jpegMismatches:report.jpegMismatches.length}));return report;
}
if(require.main===module)inspect(process.argv[2]||'output/polish/preview.pdf',process.argv[3]||'output/polish/preview-report.json',process.argv[4]||'output/polish/preview-inspection.json').catch(e=>{console.error(e);process.exitCode=1;});
module.exports={inspect};
