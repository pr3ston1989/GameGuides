const {app}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {bookHtml}=require('../src/book.cjs');
const {printBook}=require('../src/pdf.cjs');
app.setPath('userData',path.resolve('output/polish/render-profile'));app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const all=JSON.parse(await fs.readFile('output/polish/illustrated-chapters.json','utf8'));
 const chapters=all.filter(c=>c.kind!=='index');
 const images=JSON.parse(await fs.readFile('output/polish/image-report.json','utf8'));
 const audit=JSON.parse(await fs.readFile('output/polish/source-audit.json','utf8'));
 if(images.warnings.length||audit.some(c=>c.missingImages.length||c.missingParagraphs.length))throw new Error('Audyt źródłowy wykazał braki — nie publikuję kompletnego wydania.');
 await fs.mkdir('output/pdf',{recursive:true});
 const destination=path.resolve('output/pdf/GreedFall-ilustrowany.pdf');
 const result=await printBook(bookHtml(chapters,{title:'GreedFall — kompletny poradnik',images:true,warnings:images.warnings}),destination);
 const report={created:new Date().toISOString(),source:'https://www.gamepressure.com/greedfall/',sourcePages:all.length,chapters:chapters.length,skippedIndexes:all.filter(c=>c.kind==='index').map(c=>({title:c.title,url:c.url})),images:images.media,warnings:[...images.warnings,...result.warnings],sourceAudit:{paragraphs: audit.reduce((n,c)=>n+c.sourceParagraphs,0),images:audit.reduce((n,c)=>n+c.sourceImages.length,0),missingParagraphs:audit.flatMap(c=>c.missingParagraphs),missingImages:audit.flatMap(c=>c.missingImages)}};
 await fs.writeFile(destination+'.report.json',JSON.stringify(report,null,2));console.log('ILLUSTRATED_PDF',chapters.length,images.placements,result.warnings.length);app.exit(result.warnings.length?1:0);
}).catch(e=>{console.error(e);app.exit(1);});
