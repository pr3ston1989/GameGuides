const {app,BrowserWindow,ipcMain,dialog,shell,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {Engine}=require('./engine.cjs');
const {sites}=require('./sites.cjs');
const {bookHtml}=require('./book.cjs');
const reader=require('./reader.cjs');
let win,engine,busy=false,lastFile;
const historyFile=()=>path.join(app.getPath('userData'),'history.json');
async function history(){try{return JSON.parse(await fs.readFile(historyFile(),'utf8'));}catch{return [];}}
async function printBook(html,dest){
 const printer=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'pdf'}});
 const temp=path.join(app.getPath('temp'),`gameguides-${require('node:crypto').randomUUID()}.html`);
 try{
  await fs.writeFile(temp,html);await printer.loadFile(temp);
  await printer.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;setTimeout(r,8000)}))])`);
  const pdf=await printer.webContents.printToPDF({printBackground:true,pageSize:'A4',preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:9px;width:100%;text-align:center;color:#777">GameGuides · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',generateDocumentOutline:true});
  await fs.writeFile(dest+'.tmp',pdf);await fs.rename(dest+'.tmp',dest);
 }finally{printer.destroy();await fs.unlink(temp).catch(()=>{});await fs.unlink(dest+'.tmp').catch(()=>{});}
}
async function main(){
 session.fromPartition('pdf').webRequest.onBeforeRequest((details,cb)=>cb({cancel:! /^(file:|data:)/.test(details.url)}));
 win=new BrowserWindow({width:1240,height:870,minWidth:920,minHeight:700,title:'GameGuides',icon:path.join(__dirname,'../assets/icon.png'),backgroundColor:'#10121a',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 ipcMain.handle('sites',()=>sites.map(({name,host})=>({name,host})));
 ipcMain.handle('history',history);
 ipcMain.handle('prepare',(_e,url)=>{if(busy)throw new Error('Operacja już trwa.');return reader.prepare(url);});
 ipcMain.handle('cancel',()=>engine?.cancel());
 ipcMain.handle('open',async()=>{if(lastFile)return shell.openPath(lastFile);});
 ipcMain.handle('folder',()=>{if(lastFile)shell.showItemInFolder(lastFile);});
 ipcMain.handle('scan',async(_e,args)=>{
   if(busy)throw new Error('Operacja już trwa.');busy=true;
   engine=new Engine(p=>{if(!win.isDestroyed())win.webContents.send('progress',p);},args.browser?reader.read:null);
   try{if(typeof args.url!=='string')throw new Error('Brak adresu.');return await engine.scan(args.url,{mode:args.mode==='single'?'single':'guide',limit:Math.min(5000,Math.max(1,Number(args.limit)||2000))});}finally{busy=false;}
 });
 ipcMain.handle('export',async(_e,args)=>{
   if(busy||!engine||engine.signal.aborted)throw new Error('Przeanalizuj poradnik ponownie.');
   if(!Array.isArray(args.keys)||!args.keys.length||args.keys.some(k=>!engine.pages.has(k)))throw new Error('Wybierz poprawne rozdziały.');
   busy=true;
   try{
    const title=engine.pages.get(args.keys[0]).title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,120);
    const result=await dialog.showSaveDialog(win,{defaultPath:path.join(app.getPath('documents'),title+'.pdf'),filters:[{name:'Poradnik PDF',extensions:['pdf']}]});
    if(result.canceled)return null;
    const chapters=await engine.chapters(args.keys,!!args.images);
    if(engine.signal.aborted)throw new Error('Anulowano.');
    win.webContents.send('progress',{phase:'print',message:'Tworzenie pliku PDF…'});
    await printBook(bookHtml(chapters,{images:args.images,warnings:engine.warnings}),result.filePath);
    const report={created:new Date().toISOString(),source:engine.seed,complete:!engine.truncated&&!engine.warnings.length&&args.keys.length===engine.pages.size,selected:args.keys.length,discovered:engine.pages.size,truncated:engine.truncated,chapters:chapters.map(p=>({title:p.title,url:p.url})),warnings:engine.warnings};
    await fs.writeFile(result.filePath+'.report.json',JSON.stringify(report,null,2));lastFile=result.filePath;
    const items=await history();items.unshift({title,path:lastFile,date:report.created,chapters:chapters.length});await fs.writeFile(historyFile(),JSON.stringify(items.slice(0,30)));
    return {path:lastFile,warnings:engine.warnings.length,chapters:chapters.length};
   }finally{busy=false;}
 });
 await win.loadFile(path.join(__dirname,'ui/index.html'));
 win.on('closed',()=>{engine?.cancel();reader.close();});
 if(process.argv.includes('--smoke')){
   const out=path.join(__dirname,'../output');await fs.mkdir(out,{recursive:true});
   const fixture=require('../test/fixture.cjs');
   await printBook(bookHtml(fixture),path.join(out,'demo.pdf'));
   await new Promise(r=>setTimeout(r,500));await fs.writeFile(path.join(out,'gui.png'),(await win.webContents.capturePage()).toPNG());
   console.log('SMOKE_OK');app.quit();
 }
 if(process.argv.includes('--live-pdf')){
   const out=path.join(__dirname,'../output');await fs.mkdir(out,{recursive:true});
   const e=new Engine();const result=await e.scan('https://www.powerpyx.com/steinsgate-reboot-trophy-guide-roadmap/',{mode:'single',limit:1});
   const chapters=await e.chapters(result.pages.map(p=>p.key),true);
   await printBook(bookHtml(chapters,{warnings:e.warnings}),path.join(out,'STEINSGATE-PowerPyx.pdf'));
   await fs.writeFile(path.join(out,'STEINSGATE-PowerPyx.pdf.report.json'),JSON.stringify({chapters:result.pages,warnings:e.warnings},null,2));
   console.log('LIVE_PDF_OK',e.warnings.length);app.quit();
 }
}
app.whenReady().then(main).catch(e=>{console.error(e);app.exit(1);});
app.on('window-all-closed',()=>{engine?.cancel();app.quit();});
