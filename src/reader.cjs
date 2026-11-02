const {app,BrowserWindow,session}=require('electron');
if(process.platform==='win32'&&!app.isReady())app.disableHardwareAcceleration();
const dns=require('node:dns/promises');
const {privateIP}=require('./network.cjs');
const {normalize}=require('./sites.cjs');
let reader;let configured=false;let lastStatus=0;
async function publicUrl(url){
 const u=new URL(normalize(url));const records=await dns.lookup(u.hostname.replace(/^\[|\]$/g,''),{all:true});
 if(!records.length||records.some(r=>privateIP(r.address)))throw new Error('Adresy lokalne i prywatne są zablokowane.');
 return u.href;
}
function window(){
 if(reader&&!reader.isDestroyed())return reader;
 const ses=session.fromPartition('persist:guide-reader');
 if(!configured){
  ses.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
  ses.on('will-download',(e)=>e.preventDefault());
  ses.webRequest.onBeforeRequest((details,cb)=>{
    if(/^(data:|blob:|about:)/.test(details.url))return cb({cancel:false});
    publicUrl(details.url).then(()=>cb({cancel:false}),()=>cb({cancel:true}));
  });configured=true;
 }
 reader=new BrowserWindow({width:1100,height:800,title:'GameGuides — przeglądarka źródła',autoHideMenuBar:true,webPreferences:{partition:'persist:guide-reader',sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true}});
 lastStatus=0;reader.webContents.on('did-navigate',(_e,_url,status)=>{lastStatus=status;});
 reader.webContents.setWindowOpenHandler(()=>({action:'deny'}));return reader;
}
async function prepare(url){const href=await publicUrl(url);const w=window();w.show();await w.loadURL(href);}
async function read(url,signal){
 await publicUrl(url);const w=window();
 if(signal.aborted)throw new Error('Anulowano.');
 const stop=()=>{if(!w.isDestroyed())w.webContents.stop();};signal.addEventListener('abort',stop,{once:true});
 let timer,domListener;
 try{
   if(w.webContents.getURL()!==url){
     w.webContents.stop();
     const domReady=new Promise(resolve=>{domListener=resolve;w.webContents.once('dom-ready',domListener);});
     await Promise.race([domReady,w.loadURL(url),new Promise((_,reject)=>{timer=setTimeout(()=>{stop();reject(new Error('Strona nie zakończyła ładowania w ciągu 35 sekund.'));},35000);})]);
   }
   await new Promise(r=>setTimeout(r,1600));
   if(signal.aborted)throw new Error('Anulowano.');
   const html=await w.webContents.executeJavaScript('document.documentElement.outerHTML');
   return {data:Buffer.from(html),type:'text/html',url:w.webContents.getURL(),status:lastStatus};
 }finally{clearTimeout(timer);signal.removeEventListener('abort',stop);if(domListener&&!w.isDestroyed())w.webContents.removeListener('dom-ready',domListener);}
}
function close(){if(reader&&!reader.isDestroyed())reader.destroy();}
module.exports={prepare,read,close};
