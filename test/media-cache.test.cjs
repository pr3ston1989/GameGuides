const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const {cachedDownloader,pruneCache}=require('../src/media-cache.cjs');
test('cache przechowuje tylko obrazy, respektuje limit i anulowanie',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'gameguides-test-'));
 try{
  let requests=0;const cached=cachedDownloader(directory,async url=>{requests++;return {url,type:url.endsWith('png')?'image/png':'text/html',data:Buffer.from('image-data')};});
  await cached('https://example.com/a.png');await cached('https://example.com/a.png');assert.equal(requests,1);
  await cached('https://example.com/page');await cached('https://example.com/page');assert.equal(requests,3);
  await cached('https://example.com/a.png',{maxBytes:1});assert.equal(requests,4);
  const controller=new AbortController();controller.abort();await assert.rejects(cached('https://example.com/a.png',{signal:controller.signal}),/Anulowano/);
  await pruneCache(directory,0);assert.deepEqual(await fs.readdir(directory),[]);
 }finally{assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(directory,{recursive:true,force:true});}
});
