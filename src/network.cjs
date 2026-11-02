const dns=require('node:dns/promises');
const net=require('node:net');
const https=require('node:https');
const http=require('node:http');
const {normalize}=require('./sites.cjs');
function privateIP(ip) {
 if(ip.includes(':')) { const v=ip.toLowerCase(); return !v.startsWith('2') && !v.startsWith('3'); }
 const [a,b]=ip.split('.').map(Number);
 return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19));
}
async function download(value,{signal,maxBytes=15*1024*1024,redirects=5,referer}={}) {
 const url=new URL(normalize(value));
 const host=url.hostname.replace(/^\[|\]$/g,'');
 const records=net.isIP(host)?[{address:host,family:net.isIP(host)}]:await dns.lookup(host,{all:true});
 if(!records.length||records.some(x=>privateIP(x.address))) throw new Error('Adresy lokalne i prywatne nie są obsługiwane.');
 const record=records[0];
 return new Promise((resolve,reject)=>{
   const headers={'User-Agent':'GameGuides/1.2 (+https://github.com/pr3ston1989/GameGuides)','Accept':referer?'image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8':'text/html,image/*;q=0.8,*/*;q=0.5'};
   // Send only the public origin, as browsers do for cross-origin media requests.
   if(referer)headers.Referer=new URL(normalize(referer)).origin+'/';
   const req=(url.protocol==='https:'?https:http).get(url,{signal,headers,lookup:(_host,opts,cb)=>opts.all?cb(null,[record]):cb(null,record.address,record.family)},res=>{
     if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume(); if(!redirects)return reject(new Error('Zbyt wiele przekierowań.')); download(new URL(res.headers.location,url).href,{signal,maxBytes,redirects:redirects-1,referer}).then(resolve,reject);return;}
     if(res.statusCode!==200){res.resume();reject(new Error(`HTTP ${res.statusCode}: serwis odmówił dostępu lub strona nie istnieje.`));return;}
     const chunks=[]; let size=0;
     res.on('data',c=>{size+=c.length;if(size>maxBytes)res.destroy(new Error('Przekroczono limit rozmiaru strony.'));else chunks.push(c);});
     res.on('end',()=>resolve({data:Buffer.concat(chunks),type:res.headers['content-type']||'',url:url.href})); res.on('error',reject);
   });
   req.setTimeout(25000,()=>req.destroy(new Error('Serwer nie odpowiedział w ciągu 25 sekund.')));req.on('error',reject);
 });
}
module.exports={download,privateIP};
