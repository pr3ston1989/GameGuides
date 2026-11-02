const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const sharp=require('sharp');
async function main(){
 const root=path.resolve('output/polish/full-renders');await fs.mkdir(root,{recursive:true});
 const report=JSON.parse(await fs.readFile('output/polish/final-inspection.json','utf8'));
 execFileSync('pdftoppm',['-scale-to','340','-png','output/pdf/GreedFall-ilustrowany.pdf',path.join(root,'page')],{maxBuffer:10*1024*1024});
 for(let first=1;first<=report.pdfPages;first+=48){
  const count=Math.min(48,report.pdfPages-first+1),tiles=[];
  for(let i=0;i<count;i++){
   const page=first+i;
   tiles.push({input:await sharp(path.join(root,`page-${String(page).padStart(3,'0')}.png`)).resize(170,241,{fit:'contain',background:'#ddd'}).toBuffer(),left:i%8*180,top:Math.floor(i/8)*260});
   tiles.push({input:Buffer.from(`<svg width="170" height="18"><text x="85" y="13" text-anchor="middle" font-size="12">${page}</text></svg>`),left:i%8*180,top:Math.floor(i/8)*260+241});
  }
  await sharp({create:{width:1440,height:Math.ceil(count/8)*260,channels:3,background:'#ddd'}}).composite(tiles).png().toFile(path.join(root,`board-${first}.png`));
 }
 console.log('BOARDS',Math.ceil(report.pdfPages/48),'PAGES',report.pdfPages);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
