const fs=require('node:fs/promises');
const path=require('node:path');
const cheerio=require('cheerio');
const {extract}=require('../src/extract.cjs');
async function recheck(){
 const dir=path.resolve('output/research'),results=[];
 for(const file of (await fs.readdir(dir)).filter(f=>f.endsWith('.json')&&f!=='sample-report.json'&&f!=='rechecked.json')){
  const r=JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));if(!r.name)continue;
  const row={name:r.name,catalogue:r.catalogue,seed:r.seed,mode:r.mode||'http',candidateCount:r.candidates.length,catalogError:r.catalogError,samples:[]};
  for(const sample of r.samples){
   const updated={...sample};delete updated.fixture;
   if(sample.fixture){try{const p=extract(await fs.readFile(path.join(dir,sample.fixture),'utf8'),sample.url);const q=cheerio.load(p.content);Object.assign(updated,{status:'ok',words:p.words,previousWords:sample.words,images:q('img').length,tables:q('table').length,headings:q('h2,h3,h4').length,quality:p.quality,selector:p.selector});}catch(e){updated.status='error';updated.error=e.message;}}
   row.samples.push(updated);
  }
  results.push(row);
 }
 const report={created:new Date().toISOString(),method:'Dwa adresy na serwis z katalogu; deterministyczny ranking SHA-256(seed + URL), bez wymiany nieudanych próbek. Poprawiono adresy czterech katalogów i udokumentowano ponowne losowanie.',results};
 await fs.mkdir('docs/testing',{recursive:true});await fs.writeFile('docs/testing/samples.json',JSON.stringify(report,null,2));
 for(const r of results)console.log(r.name,r.catalogError||r.samples.map(s=>s.status==='ok'?`${s.words} słów (${s.previousWords}), ${s.images} obrazów, ${s.tables} tabel`:s.error).join(' | '));
 return report;
}
if(require.main===module)recheck().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={recheck};
