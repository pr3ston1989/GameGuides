const {app}=require('electron');const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const assert=require('node:assert/strict');const {Engine}=require('../src/engine.cjs'),{bookHtml}=require('../src/book.cjs'),{printBook}=require('../src/pdf.cjs');
sharp.cache(false);
const root=path.resolve('output/file-assets');app.setPath('userData',path.join(root,'profile'));app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 await fs.mkdir(root,{recursive:true});const assets=await fs.mkdtemp(path.join(root,'assets-'));
 const png=await sharp({create:{width:32,height:32,channels:3,background:'#7654cf'}}).png().toBuffer();
 const pixels=Buffer.alloc(32*64*3);for(let i=0;i<pixels.length;i+=3){pixels[i]=i<32*32*3?220:30;pixels[i+1]=80;pixels[i+2]=130;}
 const gif=await sharp(pixels,{raw:{width:32,height:64,pageHeight:32,channels:3}}).gif({delay:100,loop:0}).toBuffer();
 const e=new Engine(()=>{},null,{fetcher:async url=>({url,type:url.endsWith('.gif')?'image/gif':'image/png',data:url.endsWith('.gif')?gif:png})});e.allowed=async()=>{};
 e.pages.set('a',{url:'https://example.com/guide',title:'Test obrazu',content:'<p>Ilustracja musi być osadzona w samym PDF.</p><img src="https://example.com/image.png"><img src="https://example.com/animation.gif">'});
 const chapters=await e.chapters(['a'],true,{assetDirectory:assets});assert(chapters[0].content.includes('file:///'));assert(!chapters[0].content.includes('base64,'));
 assert.equal(e.media.assets[1].animationFrames,2);assert(chapters[0].content.includes('PDF pokazuje pierwszą klatkę'));
 const preview=(await fs.readdir(assets)).find(n=>n.endsWith('.webp'));assert(preview);
 assert((await sharp(gif).ensureAlpha().raw().toBuffer()).equals(await sharp(path.join(assets,preview)).ensureAlpha().raw().toBuffer()));
 const pdf=path.join(root,'self-contained.pdf');const result=await printBook(bookHtml(chapters),pdf);assert.equal(result.warnings.length,0);
 // Remove only the known generated files, then verify the PDF independently.
 assert.equal(path.dirname(path.resolve(assets)),root);assert(path.basename(assets).startsWith('assets-'));
 await fs.rm(assets,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),loading=pdfjs.getDocument({data:new Uint8Array(await fs.readFile(pdf))}),doc=await loading.promise;
 let images=0;for(let n=1;n<=doc.numPages;n++)images+=(await(await doc.getPage(n)).getOperatorList()).fnArray.filter(o=>o===pdfjs.OPS.paintImageXObject).length;
 assert.equal(images,2);await loading.destroy();console.log('FILE_ASSETS_CHECK_OK');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
