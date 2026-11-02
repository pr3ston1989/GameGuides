const {app}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {main}=require('../src/main.cjs');
const root=path.resolve('output/ui-qa');
app.setPath('userData',path.join(root,'profile'));app.on('window-all-closed',()=>{});
let slow=false,exportIndex=0,brokenImage=false,includeIndex=false;
const base='https://www.ign.com/wikis/qa';
const text='Przykładowa treść zadania z tabelą, nagłówkami i odnośnikami do kolejnych rozdziałów. '.repeat(12);
async function fetcher(url){
  if(url.endsWith('/broken.png'))return {url,type:'image/png',data:Buffer.from('broken-image')};
  if(url.endsWith('/robots.txt'))return {url,type:'text/plain',data:Buffer.from('User-agent: *\nAllow: /')};
  if(url.endsWith('/index'))return {url,type:'text/html',data:Buffer.from('<h1>Indeks</h1><article>'+Array.from({length:12},(_,i)=>`<a href="#part-${i}">Spis rozdziałów i pozycji ${i}</a>`).join('')+'</article>')};
  const number=url===base?0:Number(url.split('/').at(-1));
  const links=number===0?[1,2,3,...includeIndex?['index']:[]].map(n=>`<a href="${base}/${n}#boss">Misja ${n}</a>`).join(''):'';
  return {url,type:'text/html',data:Buffer.from(`<h1>${number?'Misja '+number:'Poradnik QA'}</h1><article><p>${text}</p><h2 id="boss">Boss</h2><table><thead><tr><th>Cel</th><th>Warunek</th></tr></thead><tr><td>Zakończ misję</td><td>Znajdź klucz</td></tr></table>${links}${brokenImage?'<img src="https://cdn.example.com/broken.png" alt="Mapa zadania">':''}</article>`)};
}
function wait(ms,signal){return new Promise((resolve,reject)=>{const timer=setTimeout(resolve,slow?2000:10);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Anulowano.'));},{once:true});});}
app.whenReady().then(async()=>{
 await fs.mkdir(root,{recursive:true});
 const win=await main({showWindow:false,engineOptions:{fetcher,wait},saveDialog:async()=>({canceled:false,filePath:path.join(root,`ui-export-${++exportIndex}.pdf`)})});
 const run=code=>win.webContents.executeJavaScript(code);
 async function until(code){const start=Date.now();while(Date.now()-start<12000){if(await run(code))return;await new Promise(r=>setTimeout(r,50));}throw new Error('UI_TIMEOUT '+code+' '+await run('document.getElementById("status").textContent'));}
 await run(`document.getElementById('url').value='${base}';document.getElementById('limit').value=2;document.getElementById('images').checked=false;document.getElementById('scan').click()`);
 await until(`!document.getElementById('scan').disabled&&document.querySelectorAll('#pages li').length===2`);
 await until(`!document.getElementById('resume-box').hidden`);
 await run(`document.getElementById('filter').value='Misja';document.getElementById('filter').dispatchEvent(new Event('input'))`);
 assert.equal(await run(`document.querySelectorAll('#pages li').length`),1);
 await run(`document.getElementById('filter').value='';document.getElementById('filter').dispatchEvent(new Event('input'));document.querySelectorAll('#pages li')[0].querySelectorAll('button')[1].click();document.getElementById('book-title').value='Mój poradnik — Zażółć gęślą jaźń';document.getElementById('paper').value='Letter';document.getElementById('landscape').checked=true;document.getElementById('export').click()`);
 await until(`!document.getElementById('result').hidden&&!document.getElementById('export').disabled`);
 const first=JSON.parse(await fs.readFile(path.join(root,'ui-export-1.pdf.report.json'),'utf8'));
 assert.equal(first.chapters[0].title,'Misja 1');assert.equal(first.layout.paper,'Letter');assert.equal(first.complete,false);
 await fs.writeFile(path.join(root,'selected.png'),(await win.webContents.capturePage()).toPNG());
 await run(`document.getElementById('limit').value=20;document.getElementById('resume').click()`);
 await until(`!document.getElementById('scan').disabled&&document.querySelectorAll('#pages li').length===4`);
 await run(`document.getElementById('landscape').checked=false;document.getElementById('paper').value='A4';document.getElementById('export').click()`);
 await until(`document.getElementById('result-text').textContent.includes('ui-export-2')&&!document.getElementById('export').disabled`);
 const second=JSON.parse(await fs.readFile(path.join(root,'ui-export-2.pdf.report.json'),'utf8'));assert.equal(second.complete,true);assert.equal(second.selected,4);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 for(const [number,expectedWidth] of [[1,792],[2,595]]){
   const loading=pdfjs.getDocument({data:new Uint8Array(await fs.readFile(path.join(root,`ui-export-${number}.pdf`))),useSystemFonts:true});
   const doc=await loading.promise;assert(Math.abs((await doc.getPage(1)).getViewport({scale:1}).width-expectedWidth)<2);
   let links=0;for(let n=1;n<=doc.numPages;n++)for(const a of await (await doc.getPage(n)).getAnnotations())if(a.dest){links++;if(typeof a.dest==='string')assert(await doc.getDestination(a.dest));}
   assert(links>=number*2);await loading.destroy();
 }
 slow=true;
 await run(`document.getElementById('scan').click()`);await new Promise(r=>setTimeout(r,100));await run(`document.getElementById('cancel').click()`);
 await until(`!document.getElementById('scan').disabled&&document.getElementById('status').textContent.includes('Anulowano')`);
 slow=false;await run(`document.getElementById('resume').click()`);
 await until(`!document.getElementById('scan').disabled&&document.querySelectorAll('#pages li').length===4`);
 brokenImage=true;
 await run(`document.getElementById('images').checked=true;document.getElementById('scan').click()`);
 await until(`!document.getElementById('scan').disabled&&document.querySelectorAll('#pages li').length===4`);
 await run(`document.getElementById('export').click()`);
 await until(`document.getElementById('result-text').textContent.includes('ui-export-3')&&!document.getElementById('export').disabled`);
 const third=JSON.parse(await fs.readFile(path.join(root,'ui-export-3.pdf.report.json'),'utf8'));assert.equal(third.complete,false);assert.equal(third.warnings.length,4);assert(third.warnings.every(w=>w.error.includes('nieczytelny')));
 includeIndex=true;brokenImage=false;
 await run(`document.getElementById('scan').click()`);
 await until(`!document.getElementById('scan').disabled&&document.querySelectorAll('#pages li').length===5`);
 assert(await run(`document.getElementById('count').textContent.startsWith('4 / 5')`));
 await run(`document.getElementById('export').click()`);
 await until(`document.getElementById('result-text').textContent.includes('ui-export-4')&&!document.getElementById('export').disabled`);
 const fourth=JSON.parse(await fs.readFile(path.join(root,'ui-export-4.pdf.report.json'),'utf8'));assert.equal(fourth.complete,true);assert.equal(fourth.skippedIndexes.length,1);
 win.setSize(920,760);await new Promise(r=>setTimeout(r,200));await fs.writeFile(path.join(root,'compact.png'),(await win.webContents.capturePage()).toPNG());
 assert(await run(`document.documentElement.scrollWidth<=innerWidth`));
 await run(`document.getElementById('source-details').open=true;document.getElementById('source-details').scrollIntoView()`);await fs.writeFile(path.join(root,'sources.png'),(await win.webContents.capturePage()).toPNG());
 await run(`document.getElementById('url').value='file:///C:/secret';document.getElementById('scan').click()`);
 await until(`!document.getElementById('scan').disabled&&document.getElementById('status').textContent.includes('HTTP')`);
 await fs.writeFile(path.join(root,'result.json'),JSON.stringify({ok:true,checks:['scan','limit','resume','filter','reorder','custom title','Letter landscape','PDF dimensions','PDF internal links','PDF export','corrupt images reported','history update','cancel','resume after cancel','indexes optional by default','content completeness without indexes','compact layout','invalid URL'],exports:[first,second,third,fourth]},null,2));
 console.log('UI_CHECK_OK');win.destroy();app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
