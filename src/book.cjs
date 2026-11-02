const cheerio=require('cheerio');
const {createHash}=require('node:crypto');
const {normalize}=require('./sites.cjs');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const anchor=(index,id)=>`chapter-${index}-a-${createHash('sha1').update(id).digest('hex').slice(0,12)}`;
const plural=(n,one,few,many)=>`${n} ${n===1?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many}`;

function prepareChapters(chapters) {
  const indexes=new Map(chapters.map((c,i)=>[normalize(c.url),i]));
  chapters.forEach((c,i)=>(c.aliases||[]).forEach(url=>indexes.set(normalize(url),i)));
  const docs=chapters.map(c=>cheerio.load(c.content));
  const ids=docs.map(($,i)=>{
    const map=new Map();
    $('[id],a[name]').each((_,el)=>{const item=$(el),id=item.attr('id')||item.attr('name');if(id){map.set(id,anchor(i,id));item.attr('id',anchor(i,id)).removeAttr('name');}});
    return map;
  });
  docs.forEach(($,i)=>$('a[href]').each((_,el)=>{
    const a=$(el),href=a.attr('href');
    try {
      const u=new URL(href,chapters[i].url);
      const target=href.startsWith('#')?i:indexes.get(normalize(u.href));
      if(target===undefined)return;
      let fragment='';try{fragment=decodeURIComponent(u.hash.slice(1));}catch{}
      a.attr('href','#'+(ids[target].get(fragment)||`chapter-${target}`));
    }catch{a.removeAttr('href');}
  }));
  for(const $ of docs) $('table').each((_,el)=>{
    const columns=Math.max(0,...$(el).find('tr').toArray().map(row=>$(row).children('th,td').toArray().reduce((n,cell)=>n+(Number($(cell).attr('colspan'))||1),0)));
    if(columns>=7)$(el).addClass('wide-table');
  });
  for(const $ of docs){
    $('p').each((_,el)=>{const p=$(el);if(p.find('img').length&&!p.text().trim()&&p.children().toArray().every(n=>['img','a','span','picture'].includes(n.name)))p.replaceWith($('<figure>').html(p.html()));});
    $('p,div,span').filter((_,el)=>!$(el).text().trim()&&!$(el).find('img,table,[id]').length&&!$(el).attr('id')).remove();
    // Keep a short ending with the preceding explanation or illustration.
    // Otherwise a one-line reward can occupy an entire final page of a chapter.
    const tail=[];let words=0;
    for(const el of $('body').children().toArray().reverse()){
      const node=$(el),count=node.text().trim().split(/\s+/).filter(Boolean).length;
      if(words+count>200||node.find('table').length)break;
      tail.unshift(el);words+=count;
      if(words>=70||node.is('img,figure')||node.find('img').length)break;
    }
    if(tail.length>1){const group=$('<div class="chapter-tail">');$(tail[0]).before(group);tail.forEach(el=>group.append(el));}
  }
  return docs.map($=>$('body').html());
}

function bookHtml(chapters,{images=true,warnings=[],title=chapters[0]?.title||'Poradnik',fontSize=11,paper='A4',landscape=false}={}) {
  if(!chapters.length)throw new Error('Nie wybrano rozdziałów.');
  fontSize=Math.max(9,Math.min(13,Number(fontSize)||11));
  paper=paper==='Letter'?'Letter':'A4';
  const content=prepareChapters(chapters);
  const imageCount=content.reduce((n,html)=>n+cheerio.load(html)('img').length,0);
  const words=chapters.reduce((n,c)=>n+(c.words||cheerio.load(c.content).text().split(/\s+/).length),0);
  const compact=chapters.length===1&&words<1800;
  const prefixes=new Map();for(const c of chapters){if(c.title.includes(': ')){const p=c.title.split(': ')[0];prefixes.set(p,(prefixes.get(p)||0)+1);}}
  const frequent=[...prefixes].sort((a,b)=>b[1]-a[1])[0];
  const game=frequent&&frequent[1]>=3&&frequent[1]/chapters.length>0.7?frequent[0]:title.replace(/\s*(?:Guide(?: and Walkthrough)?|[-–—] poradnik.*)$/i,'').trim();
  const displayTitle=c=>c.title.startsWith(game+': ')?c.title.slice(game.length+2):c.title;
  const edition=images?(imageCount?plural(imageCount,'ilustracja','ilustracje','ilustracji'):'Tekst i tabele'):'Wydanie tekstowe — ilustracje wyłączone';
  const notice=warnings.length?`<div class="notice"><b>Eksport z uwagami</b><p>${warnings.length} uwag lub braków. Szczegóły w raporcie JSON obok PDF.</p></div>`:'';
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${esc(title)} — GameGuides</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: file:; style-src 'unsafe-inline'">
  <style>
  @page{size:${paper}${landscape?' landscape':''};margin:18mm 17mm 19mm}
  *{box-sizing:border-box}body{color:#22283a;font:${fontSize}pt/1.5 'Segoe UI',Arial,sans-serif;margin:0}
  a{color:#5951b7;text-decoration:none;overflow-wrap:anywhere}
  h1,h2,h3,h4{line-height:1.25;break-after:avoid;overflow-wrap:anywhere}h1{font-size:25pt;letter-spacing:-.6px}h2{font-size:17pt;margin-top:23px}h3{font-size:13pt}h4{font-size:11pt}
  p,li{orphans:3;widows:3}p{margin:9px 0;break-inside:avoid}img{max-width:100%;height:auto;object-fit:contain;max-height:${landscape?'118':'178'}mm;break-inside:avoid;display:${images?'block':'none'};margin:12px auto;border-radius:3px}
  img.landscape-photo{max-height:${landscape?'118':'90'}mm}
  .chapter-tail{break-inside:avoid}
  img.inline-image{display:${images?'inline-block':'none'};vertical-align:middle;margin:0 3px;max-width:24px;max-height:24px}
  table{border-collapse:collapse;width:100%;font-size:${Math.max(8.5,fontSize-1.5)}pt;overflow-wrap:anywhere;table-layout:fixed;margin:12px 0}
  td,th{border:1px solid #dcdde7;padding:7px;text-align:left;vertical-align:top}th{background:#eeedf7}thead{display:table-header-group}tr{break-inside:avoid}td img{max-width:100%}
  .wide-table{table-layout:auto;font-size:${Math.max(8.5,Math.min(9,fontSize-2))}pt}.wide-table th,.wide-table td{padding:5px 4px}.wide-table th{overflow-wrap:normal}.wide-table th:first-child,.wide-table td:first-child{width:26%;overflow-wrap:normal}.wide-table td:first-child a,.wide-table td:nth-child(2),.wide-table td:nth-child(2) a{overflow-wrap:normal;word-break:normal}
  .trophy{margin:24px 0;border-top:1px solid #ddd;padding-top:12px}.trophy-header{overflow:auto;break-after:avoid}.trophy-header img{float:left;width:52px;height:52px;margin:0 12px 8px 0}.trophy-header h3{margin:0 0 7px}.trophy-header p{margin:0 0 10px}
  .callout{padding:10px 15px;margin:15px 0;border-left:3px solid #8a78e6;background:#f3f1fb;break-inside:avoid}.callout p:first-child{margin-top:0}.callout p:last-child{margin-bottom:0}
  pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:9pt}blockquote{border-left:3px solid #8a78e6;margin-left:0;padding:8px 18px;background:#f5f4fa}figure{margin:13px 0;break-inside:avoid}figure img{margin:0 auto}figcaption,.source{font-size:8.5pt;color:#697087}figcaption{padding-top:6px;line-height:1.4}
  section.chapter{break-before:page}.cover{height:${landscape?'155':'235'}mm;display:flex;flex-direction:column;justify-content:center;border-top:7px solid #7b68df}
  .brand{letter-spacing:3px;color:#7561cc;font-size:11pt;font-weight:700}.cover h1{font-size:${title.length>100?'30':'38'}pt}.meta{color:#697087}
  .toc{break-before:page}.toc ol{columns:${chapters.length>35?'2':'1'};column-gap:24px;font-size:9.5pt;line-height:1.35;padding-left:22px}.toc li{margin:6px 0;break-inside:avoid}
  .notice{padding:10px 14px;background:#fff5dc;border-left:3px solid #daa337;font-size:9pt}.notice p{margin:4px 0}
  .chapter-head{border-bottom:2px solid #8370db;padding-bottom:13px;margin-bottom:18px}.chapter-head h1{margin:10px 0}.source{overflow-wrap:anywhere}.compact-head{border-top:5px solid #7b68df;padding-top:20px;margin-bottom:22px}.compact-head h1{margin:12px 0}.single-body{break-before:page}.index-page{font-size:10pt}.index-page ul{columns:2}hr{border:0;border-top:1px solid #ddd}
  </style></head><body>
  <div class="${compact?'compact-head':'cover'}"><div class="brand">GAMEGUIDES / PORADNIK OFFLINE</div><h1>${esc(title)}</h1>
  <p class="meta">${chapters.length>1?plural(chapters.length,'rozdział','rozdziały','rozdziałów')+' · ':''}${edition}<br>${new Date().toLocaleDateString('pl-PL',{timeZone:'Europe/Warsaw'})} · <a href="${esc(chapters[0].url)}">${esc(new URL(chapters[0].url).hostname)}</a></p>${notice}</div>
  ${chapters.length>1?`<div class="toc"><h1>Spis treści</h1><ol>${chapters.map((c,i)=>`<li><a href="#chapter-${i}">${esc(displayTitle(c))}</a></li>`).join('')}</ol><p class="meta">Treść i ilustracje należą do autorów i wydawców podanych źródeł. Materiały wideo i interaktywne mapy wymagają strony źródłowej.</p></div>`:''}
  ${chapters.map((c,i)=>`<section class="${chapters.length>1?'chapter':compact?'':'single-body'}${c.kind==='index'?' index-page':''}" id="chapter-${i}">${chapters.length>1?`<div class="chapter-head"><div class="brand">ROZDZIAŁ ${String(i+1).padStart(2,'0')}</div><h1>${esc(displayTitle(c))}</h1><div class="source">Źródło: <a href="${esc(c.url)}">${esc(new URL(c.url).hostname)} · Oryginał online</a></div></div>`:''}${content[i]}</section>`).join('')}
  </body></html>`;
}
module.exports={bookHtml,esc,prepareChapters};
