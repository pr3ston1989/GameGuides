const {app,BrowserWindow,session}=require('electron');
if(process.platform==='win32'&&!app.isReady())app.disableHardwareAcceleration();
const path=require('node:path');
const fs=require('node:fs/promises');

async function printBook(html,dest) {
  session.fromPartition('pdf').webRequest.onBeforeRequest((details,cb)=>cb({cancel:! /^(file:|data:)/.test(details.url)}));
  const printer=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'pdf'}});
  const temp=path.join(app.getPath('temp'),`gameguides-${require('node:crypto').randomUUID()}.html`);
  try {
    await fs.writeFile(temp,html);await printer.loadFile(temp);
    await printer.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;setTimeout(r,8000)}))])`);
    const warnings=await printer.webContents.executeJavaScript(`Array.from(document.images).filter(i=>!i.naturalWidth).map(i=>{const warning={url:i.dataset.source||'',error:'Ilustracja: uszkodzony lub nieczytelny plik obrazu.',kind:'image'};const p=document.createElement('p');p.textContent='[Ilustracja niedostępna: '+(i.alt||'nieczytelny obraz')+']';i.replaceWith(p);return warning;})`);
    const pdf=await printer.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:9px;width:100%;text-align:center;color:#777">GameGuides · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',generateDocumentOutline:true});
    await fs.writeFile(dest+'.tmp',pdf);await fs.rename(dest+'.tmp',dest);
    return {warnings};
  } finally {printer.destroy();await fs.unlink(temp).catch(()=>{});await fs.unlink(dest+'.tmp').catch(()=>{});}
}
module.exports={printBook};
