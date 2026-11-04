const cheerio=require('cheerio');
const fs=require('node:fs/promises'),path=require('node:path');
const {PDFDocument,PDFName,PDFDict,PDFArray,PDFString,PDFHexString,StandardFonts,rgb}=require('pdf-lib');

async function printBatches(html,dest,{signal,progress=()=>{}}={},printBook){
  const $=cheerio.load(html),sections=$('body > section').toArray();
  if(sections.length<2||($('img').length<=180&&sections.length<=35))return null;
  const groups=[];let group=[],images=0;
  for(const section of sections){const count=$(section).find('img').length;
    if(group.length&&(images+count>80||group.length>=12)){groups.push(group);group=[];images=0;}
    group.push(section);images+=count;
  }if(group.length)groups.push(group);
  const head=$('head').html(),prefix=$('body').children().not('section').toArray().map(el=>$.html(el)).join('');
  const directory=await fs.mkdtemp(path.join(path.dirname(path.resolve(dest)),'.gameguides-pdf-'));
  const merged=await PDFDocument.create(),destinations=merged.context.obj({}),warnings=[];
  const marker='https://gameguides.invalid/destination/';
  try{
    for(const [index,sections] of groups.entries()){
      if(signal?.aborted)throw new Error('Anulowano tworzenie PDF.');
      progress({phase:'print',done:index,total:groups.length,message:`Tworzenie PDF: część ${index+1}/${groups.length}`});
      const chunk=cheerio.load(`<html><head>${head}</head><body>${index===0?prefix:''}${sections.map(el=>$.html(el)).join('')}</body></html>`);
      const ids=new Set(chunk('[id]').toArray().map(el=>chunk(el).attr('id')));
      chunk('a[href^="#"]').each((_,el)=>{const a=chunk(el),id=a.attr('href').slice(1);if(!ids.has(id))a.attr('href',marker+encodeURIComponent(id));});
      // Ensure Chromium records destinations even if the only incoming link is in another part.
      const targets=chunk('<div style="position:absolute;top:0;left:0;font-size:1px;opacity:0">');
      for(const id of ids)targets.append(chunk('<a>').attr('href','#'+id).text('.'));
      chunk('body').append(targets);
      const file=path.join(directory,index+'.pdf');
      const rendered=await printBook(chunk.html(),file,{signal,batch:false});warnings.push(...rendered.warnings);
      const source=await PDFDocument.load(await fs.readFile(file)),offset=merged.getPageCount();
      const copied=await merged.copyPages(source,source.getPageIndices());copied.forEach(page=>merged.addPage(page));
      const sourceDests=source.catalog.lookup(PDFName.of('Dests'));
      if(sourceDests instanceof PDFDict)for(const [name,value] of sourceDests.entries()){
        const array=source.context.lookup(value);if(!(array instanceof PDFArray))continue;
        const pageIndex=source.getPages().findIndex(page=>page.ref.toString()===array.get(0).toString());
        if(pageIndex>=0)destinations.set(name,merged.context.obj([merged.getPage(offset+pageIndex).ref,...array.asArray().slice(1)]));
      }
      await fs.unlink(file);
    }
    merged.catalog.set(PDFName.of('Dests'),destinations);
    const outline=merged.context.obj({Type:'Outlines'}),outlineRef=merged.context.register(outline);
    const entries=$('.toc a[href^="#"]').toArray().map(el=>({id:$(el).attr('href').slice(1),title:$(el).text()})).filter(item=>destinations.has(PDFName.of(item.id)));
    const items=entries.map(item=>merged.context.obj({Title:PDFHexString.fromText(item.title),Parent:outlineRef,Dest:PDFName.of(item.id)}));
    const refs=items.map(item=>merged.context.register(item));
    items.forEach((item,i)=>{if(i)item.set(PDFName.of('Prev'),refs[i-1]);if(i+1<items.length)item.set(PDFName.of('Next'),refs[i+1]);});
    if(refs.length){outline.set(PDFName.of('First'),refs[0]);outline.set(PDFName.of('Last'),refs.at(-1));outline.set(PDFName.of('Count'),merged.context.obj(refs.length));merged.catalog.set(PDFName.of('Outlines'),outlineRef);}
    const font=await merged.embedFont(StandardFonts.Helvetica),total=merged.getPageCount();
    for(const [index,page] of merged.getPages().entries()){
      const annotations=page.node.Annots();
      for(const ref of annotations?.asArray()||[]){
        const annotation=merged.context.lookup(ref);if(!(annotation instanceof PDFDict))continue;
        const action=annotation.lookup(PDFName.of('A'));if(!(action instanceof PDFDict))continue;
        const uri=action.lookup(PDFName.of('URI'));
        if(uri instanceof PDFString&&uri.decodeText().startsWith(marker)){
          const id=decodeURIComponent(uri.decodeText().slice(marker.length));
          if(destinations.has(PDFName.of(id))){annotation.delete(PDFName.of('A'));annotation.set(PDFName.of('Dest'),PDFName.of(id));}
        }
      }
      const label=`GameGuides - ${index+1} / ${total}`;
      page.drawText(label,{x:(page.getWidth()-font.widthOfTextAtSize(label,9))/2,y:16,size:9,font,color:rgb(.47,.47,.47)});
    }
    if(signal?.aborted)throw new Error('Anulowano tworzenie PDF.');
    await fs.writeFile(dest+'.tmp',await merged.save());await fs.rename(dest+'.tmp',dest);
    return {warnings};
  }finally{
    // Only remove the verified directory created for this export.
    if(path.dirname(directory)===path.dirname(path.resolve(dest))&&path.basename(directory).startsWith('.gameguides-pdf-'))await fs.rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});
    await fs.unlink(dest+'.tmp').catch(()=>{});
  }
}
module.exports={printBatches};
