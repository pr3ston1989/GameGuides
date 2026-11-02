const fs=require('node:fs/promises');const path=require('node:path');const sharp=require('sharp');
(async()=>{
 const report=JSON.parse(await fs.readFile('output/qa/visual-report.json','utf8'));
 for(let start=0;start<report.length;start+=8){const tiles=[];
  for(const [i,item] of report.slice(start,start+8).entries()){
   const left=i%2*550,top=Math.floor(i/2)*275,name=path.basename(item.file,'.pdf');
   tiles.push({input:Buffer.from(`<svg width="540" height="25"><text x="5" y="17" font-size="14">${name}</text></svg>`),left,top});
   for(const [j,p] of [1,Math.ceil(item.pdfPages/2),item.pdfPages].entries()){
    const file=`output/qa/renders/${name}-${String(p).padStart(String(item.pdfPages).length,'0')}.png`;
    tiles.push({input:await sharp(file).resize(170,241,{fit:'contain',background:'#ddd'}).toBuffer(),left:left+j*180,top:top+25});
   }
  }
  await sharp({create:{width:1100,height:Math.ceil(Math.min(8,report.length-start)/2)*275,channels:3,background:'#ddd'}}).composite(tiles).png().toFile(`output/qa/overview-${start/8+1}.png`);
 }
 console.log('OVERVIEWS',Math.ceil(report.length/8));
})().catch(e=>{console.error(e);process.exitCode=1;});
