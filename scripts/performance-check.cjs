const {app}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {bookHtml}=require('../src/book.cjs'),{printBook}=require('../src/pdf.cjs');
const root=path.resolve('output/performance');app.setPath('userData',path.join(root,'profile'));app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  await fs.mkdir(root,{recursive:true});
  const chapters=Array.from({length:40},(_,i)=>({url:`https://example.com/guide/${i}`,title:`Chapter ${i}`,content:`<h2 id="target">Target ${i}</h2><p>Printable content.</p><a href="https://example.com/guide/${(i+15)%40}#target">Next chapter</a>`}));
  const file=path.join(root,'batch.pdf');await printBook(bookHtml(chapters),file);
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=pdfjs.getDocument({data:new Uint8Array(await fs.readFile(file))}),doc=await task.promise;
  let links=0;for(let n=1;n<=doc.numPages;n++){
    const page=await doc.getPage(n),text=(await page.getTextContent()).items.map(i=>i.str).join(' ');
    assert(text.includes(`GameGuides - ${n} / ${doc.numPages}`));
    for(const a of await page.getAnnotations()){
      assert(!a.url?.includes('gameguides.invalid'));
      if(a.dest){const destination=typeof a.dest==='string'?await doc.getDestination(a.dest):a.dest;assert(destination);const target=await doc.getPageIndex(destination[0]);assert(target>=0&&target<doc.numPages);links++;}
    }
  }assert(links>=80);
  assert.equal((await doc.getOutline()).length,40);
  console.log('BATCH_PDF_OK',doc.numPages,'pages',links,'links');await task.destroy();app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
