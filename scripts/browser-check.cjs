const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {Engine}=require('../src/engine.cjs');
const reader=require('../src/reader.cjs');
const root=path.resolve('output/browser-qa');
app.setPath('userData',path.join(root,'profile'));app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 await fs.mkdir(root,{recursive:true});const results=[];
 const cases=[['PlayStationTrophies','https://www.playstationtrophies.org/game/mafia-3/guide/'],['Neoseeker','https://www.neoseeker.com/clair-obscur-expedition-33/walkthrough'],['StrategyWiki','https://strategywiki.org/wiki/Chrono_Trigger']];
 for(const [site,url] of cases){
  const engine=new Engine(()=>{},reader.read);let result;
  try{const r=await engine.scan(url,{mode:'single',limit:1});result={site,url,ok:true,pages:r.pages};}catch(e){result={site,url,ok:false,error:e.message};}
  const window=BrowserWindow.getAllWindows()[0];
  if(window&&!window.isDestroyed())try{await fs.writeFile(path.join(root,site+'.png'),(await window.webContents.capturePage()).toPNG());}catch(e){result.screenshotError=e.message;}
  results.push(result);console.log(JSON.stringify(result));
 }
 await fs.writeFile('docs/testing/browser.json',JSON.stringify({created:new Date().toISOString(),results},null,2));reader.close();app.exit(0);
}).catch(e=>{console.error(e);reader.close();app.exit(1);});
