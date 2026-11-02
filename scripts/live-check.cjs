const fs=require('node:fs/promises');const {Engine}=require('../src/engine.cjs');
(async()=>{
 const results=[];
 for(const url of ['https://www.powerpyx.com/steinsgate-reboot-trophy-guide-roadmap/','https://www.gamepressure.com/assassins-creed-valhalla/starting-tips/zadbca','https://www.ign.com/wikis/cyberpunk-2077']){
  const engine=new Engine();try{const r=await engine.scan(url,{mode:'single',limit:1});const chapters=await engine.chapters(r.pages.map(p=>p.key),false);results.push({url,ok:true,title:chapters[0].title,words:chapters[0].words,discovered:chapters[0].links.length});}catch(e){results.push({url,ok:false,error:e.message});}
 }
 await fs.mkdir('output',{recursive:true});await fs.writeFile('output/live-check.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})();
