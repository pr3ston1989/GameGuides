const {app,BrowserWindow,ipcMain,dialog,shell}=require('electron');
if(process.platform==='win32'&&!app.isReady())app.disableHardwareAcceleration();
const path=require('node:path');
const fs=require('node:fs/promises');
const {Engine}=require('./engine.cjs');
const {sites}=require('./sites.cjs');
const {bookHtml}=require('./book.cjs');
const {printBook}=require('./pdf.cjs');
const {cachedDownloader,pruneCache}=require('./media-cache.cjs');
const reader=require('./reader.cjs');
let win,engine,busy=false,lastFile;
const historyFile=()=>path.join(app.getPath('userData'),'history.json');
const checkpointFile=()=>path.join(app.getPath('userData'),'scan.json');
async function history(){try{return JSON.parse(await fs.readFile(historyFile(),'utf8'));}catch{return [];}}
async function checkpoint(){try{return JSON.parse(await fs.readFile(checkpointFile(),'utf8'));}catch{return null;}}
async function saveCheckpoint(value){
  await fs.mkdir(app.getPath('userData'),{recursive:true});
  await fs.writeFile(checkpointFile()+'.tmp',JSON.stringify(value));
  await fs.rename(checkpointFile()+'.tmp',checkpointFile());
}

async function main({engineOptions={},saveDialog=(...args)=>dialog.showSaveDialog(...args),showWindow=true}={}) {
  const mediaDirectory=path.join(app.getPath('userData'),'media-cache');
  await pruneCache(mediaDirectory).catch(()=>{});
  win=new BrowserWindow({show:showWindow,width:1280,height:960,minWidth:920,minHeight:700,title:'GameGuides',icon:path.join(__dirname,'../assets/icon.png'),backgroundColor:'#10121a',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
  ipcMain.handle('sites',()=>{
    let status={};try{status=require('./site-status.json');}catch{}
    return sites.map(({name,host,single})=>({name,host,single:!!single,...status[name]}));
  });
  ipcMain.handle('history',history);
  ipcMain.handle('checkpoint',async()=>{const saved=await checkpoint();return saved?{url:saved.seed,pages:saved.pages.length,pending:saved.pending.length,failed:saved.warnings.filter(w=>w.kind==='page').length,mode:saved.mode,browser:saved.browser}:null;});
  ipcMain.handle('prepare',(_e,url)=>{if(busy)throw new Error('Operacja już trwa.');return reader.prepare(url);});
  ipcMain.handle('cancel',()=>engine?.cancel());
  ipcMain.handle('open',async(_e,index)=>{
    const file=Number.isInteger(index)?(await history())[index]?.path:lastFile;
    if(file&&path.isAbsolute(file)&&file.toLowerCase().endsWith('.pdf'))return shell.openPath(file);
  });
  ipcMain.handle('folder',()=>{if(lastFile)shell.showItemInFolder(lastFile);});
  ipcMain.handle('scan',async(_e,args)=>{
    if(busy)throw new Error('Operacja już trwa.');busy=true;
    try {
      if(typeof args.url!=='string')throw new Error('Brak adresu.');
      const saved=args.resume?await checkpoint():null;
      engine=new Engine(p=>{if(!win.isDestroyed())win.webContents.send('progress',p);},args.browser?reader.read:null,{fetcher:cachedDownloader(mediaDirectory),fallbackReader:args.autoBrowser?reader.read:null,checkpoint:saveCheckpoint,...engineOptions});
      return await engine.scan(args.url,{mode:args.mode==='single'?'single':'guide',limit:Math.min(5000,Math.max(1,Number(args.limit)||2000)),resume:saved});
    } finally {busy=false;}
  });
  ipcMain.handle('export',async(_e,args)=>{
    if(busy||!engine||engine.signal.aborted)throw new Error('Przeanalizuj poradnik ponownie.');
    if(!Array.isArray(args.keys)||!args.keys.length||args.keys.some(k=>!engine.pages.has(k)))throw new Error('Wybierz poprawne rozdziały.');
    busy=true;
    try {
      const title=String(args.title||engine.pages.get(args.keys[0]).title).trim().slice(0,200);
      const filename=title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,120)||'Poradnik';
      const result=await saveDialog(win,{defaultPath:path.join(app.getPath('documents'),filename+'.pdf'),filters:[{name:'Poradnik PDF',extensions:['pdf']}]});
      if(result.canceled)return null;
      const chapters=await engine.chapters(args.keys,!!args.images);
      if(engine.signal.aborted)throw new Error('Anulowano.');
      win.webContents.send('progress',{phase:'print',message:'Tworzenie pliku PDF…'});
      const layout={images:!!args.images,warnings:engine.warnings,title,fontSize:args.fontSize,paper:args.paper,landscape:!!args.landscape};
      const rendered=await printBook(bookHtml(chapters,layout),result.filePath);
      engine.warnings.push(...rendered.warnings);
      const report={created:new Date().toISOString(),source:engine.seed,allDiscoveredSelected:args.keys.length===engine.pages.size,complete:!engine.pending.length&&!engine.warnings.length&&args.keys.length===engine.pages.size,selected:args.keys.length,discovered:engine.pages.size,pending:engine.pending.length,truncated:engine.truncated,layout:{title,fontSize:args.fontSize||11,paper:args.paper||'A4',landscape:!!args.landscape,images:!!args.images},chapters:chapters.map(p=>({title:p.title,url:p.url,words:p.words})),warnings:engine.warnings};
      await fs.writeFile(result.filePath+'.report.json',JSON.stringify(report,null,2));lastFile=result.filePath;
      const items=(await history()).filter(item=>path.normalize(item.path).toLowerCase()!==path.normalize(lastFile).toLowerCase());items.unshift({title,path:lastFile,date:report.created,chapters:chapters.length});await fs.writeFile(historyFile(),JSON.stringify(items.slice(0,30)));
      return {path:lastFile,warnings:engine.warnings.length,chapters:chapters.length};
    } finally {busy=false;}
  });
  await win.loadFile(path.join(__dirname,'ui/index.html'));
  win.on('closed',()=>{engine?.cancel();reader.close();});
  if(process.argv.includes('--smoke')){
    const out=path.join(__dirname,'../output');await fs.mkdir(out,{recursive:true});
    await printBook(bookHtml(require('../test/fixture.cjs')),path.join(out,'demo.pdf'));
    await fs.writeFile(path.join(out,'gui.png'),(await win.webContents.capturePage()).toPNG());
    console.log('SMOKE_OK');app.quit();
  }
  return win;
}
module.exports={main};
