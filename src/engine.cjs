const {download}=require('./network.cjs');
const {extract}=require('./extract.cjs');
const {normalize,adapter}=require('./sites.cjs');
const robotsParser=require('robots-parser');
const cheerio=require('cheerio');
const pause=(ms,signal)=>new Promise((resolve,reject)=>{if(signal.aborted)return reject(new Error('Anulowano.'));const abort=()=>{clearTimeout(t);reject(new Error('Anulowano.'));};const t=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});
class Engine {
 constructor(progress=()=>{},reader=null){this.progress=progress;this.reader=reader;this.pages=new Map();this.warnings=[];this.controller=new AbortController();this.robots=new Map();this.truncated=false;}
 cancel(){this.controller.abort();}
 get signal(){return this.controller.signal;}
 async allowed(url){
   const origin=new URL(url).origin;
   if(!this.robots.has(origin)){
     let text='';try{text=(await download(origin+'/robots.txt',{signal:this.signal,maxBytes:1024*1024})).data.toString();}catch(e){if(!/HTTP 404|HTTP 410/.test(e.message))throw new Error('Nie można sprawdzić robots.txt: '+e.message);}
     this.robots.set(origin,robotsParser(origin+'/robots.txt',text));
   }
   const rules=this.robots.get(origin);
   if(rules.isAllowed(url,'GameGuides')===false)throw new Error('Pobieranie tego adresu jest wyłączone przez robots.txt.');
   const delay=Math.max(1200,(rules.getCrawlDelay('GameGuides')||0)*1000);
   if(delay>60000)throw new Error('Serwis wymaga odstępu ponad 60 sekund. Automatyczny eksport niedostępny.');
   await pause(delay,this.signal);
 }
 async scan(value,{mode='guide',limit=300}={}){
   this.seed=normalize(value);this.pages.clear();this.warnings=[];this.truncated=false;
   const queue=[this.seed],seen=new Set(queue);let attempted=0;
   while(queue.length){
     if(this.signal.aborted)throw new Error('Anulowano.');
     if(attempted>=limit){this.truncated=true;break;}
     const url=queue.shift();attempted++;
     this.progress({phase:'scan',done:attempted,total:attempted+queue.length,message:`Pobieranie rozdziału ${attempted}: ${url}`});
     try{
       await this.allowed(url);
       const response=this.reader?await this.reader(url,this.signal):await download(url,{signal:this.signal});
       if(!/text\/html|application\/xhtml/i.test(response.type))throw new Error('Adres nie zawiera strony HTML.');
       const page=extract(response.data.toString('utf8'),response.url,this.seed);
       this.pages.set(url,page);
       if(mode==='guide')for(const link of page.links)if(!seen.has(link.url)){seen.add(link.url);queue.push(link.url);}
     }catch(e){if(this.signal.aborted)throw new Error('Anulowano.');this.warnings.push({url,error:e.message});if(url===this.seed)throw e;}
   }
   if(this.truncated)this.warnings.push({url:this.seed,error:`Osiągnięto limit ${limit} stron. Pozostało co najmniej ${queue.length} adresów. Zwiększ limit i przeanalizuj ponownie.`});
   return {site:adapter(this.seed).name,pages:[...this.pages].map(([key,p])=>({key,title:p.title,url:p.url,words:p.words})),warnings:this.warnings,truncated:this.truncated};
 }
 async chapters(keys,images){
   const chapters=[];const cache=new Map();let bytes=0;
   for(const [i,key] of keys.entries()){
     if(this.signal.aborted)throw new Error('Anulowano.');
     const page=this.pages.get(key);if(!page)throw new Error('Lista rozdziałów wygasła. Przeanalizuj poradnik ponownie.');
     this.progress({phase:'export',done:i+1,total:keys.length,message:`Składanie: ${page.title}`});
     const $=cheerio.load(page.content);
     for(const el of $('img').toArray()){
       const img=$(el),url=img.attr('src');
       if(!images){img.remove();continue;}
       try{
         if(!cache.has(url)){
           if(bytes>160*1024*1024)throw new Error('Osiągnięto limit 160 MB ilustracji.');
           await this.allowed(url);
           const r=await download(url,{signal:this.signal,maxBytes:5*1024*1024});
           const type=r.type.split(';')[0];if(!/^image\/(png|jpeg|webp|gif|avif)$/.test(type))throw new Error('Nieobsługiwany format ilustracji.');
           bytes+=r.data.length;cache.set(url,`data:${type};base64,${r.data.toString('base64')}`);
         }
         img.attr('src',cache.get(url));
       }catch(e){if(this.signal.aborted)throw new Error('Anulowano.');this.warnings.push({url,error:'Ilustracja: '+e.message});img.replaceWith($('<p>').text('[Ilustracja niedostępna: '+(img.attr('alt')||url)+']'));}
     }
     chapters.push({...page,content:$.html()});
   }
   return chapters;
 }
}
module.exports={Engine};
