const {app,BrowserWindow,session}=require('electron');
if(process.platform==='win32'&&!app.isReady())app.disableHardwareAcceleration();
const path=require('node:path');
const fs=require('node:fs/promises');

async function printBook(html,dest,{signal,progress,batch=true}={}) {
  if(batch){const result=await require('./pdf-batch.cjs').printBatches(html,dest,{signal,progress},printBook);if(result)return result;}
  session.fromPartition('pdf').webRequest.onBeforeRequest((details,cb)=>cb({cancel:! /^(file:|data:)/.test(details.url)}));
  const printer=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'pdf'}});
  const temp=path.join(app.getPath('temp'),`gameguides-${require('node:crypto').randomUUID()}.html`);
  let timer,abort,crashed;
  const interrupted=new Promise((_,reject)=>{
    crashed=(_event,details)=>reject(new Error(`Tworzenie PDF przerwane (${details.reason}). Postęp pobierania zachowano. Spróbuj wybrać mniej rozdziałów lub wyłączyć ilustracje.`));
    printer.webContents.once('render-process-gone',crashed);
    abort=()=>reject(new Error('Anulowano tworzenie PDF. Postęp pobierania zachowano.'));
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    timer=setTimeout(()=>reject(new Error('Tworzenie PDF przekroczyło 5 minut. Postęp zachowano; spróbuj wyeksportować mniejszą część poradnika.')),300000);
  });
  const guarded=operation=>Promise.race([operation,interrupted]);
  try {
    await fs.writeFile(temp,html);await guarded(printer.loadFile(temp));
    await guarded(printer.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;setTimeout(r,8000)}))])`));
    await guarded(printer.webContents.executeJavaScript(`Array.from(document.images).forEach(i=>{if(i.naturalWidth/i.naturalHeight>=1.4&&!i.classList.contains('inline-image')&&!i.classList.contains('map-image'))i.classList.add('landscape-photo')})`));
    const warnings=await guarded(printer.webContents.executeJavaScript(`Array.from(document.images).filter(i=>!i.naturalWidth).map(i=>{const warning={url:i.dataset.source||'',error:'Ilustracja: uszkodzony lub nieczytelny plik obrazu.',kind:'image'};const p=document.createElement('p');p.textContent='[Ilustracja niedostępna: '+(i.alt||'nieczytelny obraz')+']';i.replaceWith(p);return warning;})`));
    const pdf=await guarded(printer.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:batch,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:9px;width:100%;text-align:center;color:#777">GameGuides · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',generateDocumentOutline:true}));
    await fs.writeFile(dest+'.tmp',pdf);await fs.rename(dest+'.tmp',dest);
    return {warnings};
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);if(!printer.isDestroyed()){printer.webContents.removeListener('render-process-gone',crashed);printer.destroy();}await fs.unlink(temp).catch(()=>{});await fs.unlink(dest+'.tmp').catch(()=>{});}
}
module.exports={printBook};
