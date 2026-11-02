const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {download}=require('./network.cjs');
function cachedDownloader(directory,fetcher=download){
  const peek=async(url,options)=>{
    if(options?.signal?.aborted)throw new Error('Anulowano.');
    const file=path.join(directory,createHash('sha256').update(url).digest('hex')+'.json');
    try{const cached=JSON.parse(await fs.readFile(file,'utf8'));if(/^image\/(png|jpeg|webp|gif|avif|svg\+xml)$/.test(cached.type)&&Date.now()-cached.created<30*86400000){const data=Buffer.from(cached.data,'base64');if(data.length<=(options?.maxBytes||15*1024*1024))return {...cached,data};}}catch{}
    return null;
  };
  const cachedDownload=async function(url,options){
    const cached=await peek(url,options);if(cached)return cached;
    const file=path.join(directory,createHash('sha256').update(url).digest('hex')+'.json');
    const result=await fetcher(url,options);
    if(/^image\/(png|jpeg|webp|gif|avif|svg\+xml)(;|$)/.test(result.type)){
      await fs.mkdir(directory,{recursive:true});
      await fs.writeFile(file,JSON.stringify({...result,type:result.type.split(';')[0],created:Date.now(),data:result.data.toString('base64')}));
    }
    return result;
  };
  cachedDownload.peek=peek;
  return cachedDownload;
}
async function pruneCache(directory,budget=512*1024*1024){
  let files;try{files=await fs.readdir(directory);}catch{return;}
  const entries=await Promise.all(files.map(async name=>{const file=path.join(directory,name);const stat=await fs.stat(file);return {file,size:stat.size,time:stat.mtimeMs};}));
  let total=entries.reduce((n,f)=>n+f.size,0);
  for(const f of entries.sort((a,b)=>a.time-b.time)){if(total<=budget)break;await fs.unlink(f.file);total-=f.size;}
}
module.exports={cachedDownloader,pruneCache};
