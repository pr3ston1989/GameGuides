const cheerio=require('cheerio');
const {createHash}=require('node:crypto');
const {normalize}=require('./sites.cjs');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const anchor=(index,id)=>`chapter-${index}-a-${createHash('sha1').update(id).digest('hex').slice(0,12)}`;

function prepareChapters(chapters) {
  const indexes=new Map(chapters.map((c,i)=>[normalize(c.url),i]));
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
  return docs.map($=>$('body').html());
}

function bookHtml(chapters,{images=true,warnings=[],title=chapters[0]?.title||'Poradnik',fontSize=11,paper='A4',landscape=false}={}) {
  if(!chapters.length)throw new Error('Nie wybrano rozdziałów.');
  fontSize=Math.max(9,Math.min(13,Number(fontSize)||11));
  paper=paper==='Letter'?'Letter':'A4';
  const content=prepareChapters(chapters);
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${esc(title)} — GameGuides</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
  <style>
  @page{size:${paper}${landscape?' landscape':''};margin:20mm 17mm 22mm}
  *{box-sizing:border-box}body{color:#22283a;font:${fontSize}pt/1.6 'Segoe UI',Arial,sans-serif;margin:0}
  a{color:#5951b7;text-decoration:none;overflow-wrap:anywhere}
  h1,h2,h3,h4{line-height:1.25;break-after:avoid;overflow-wrap:anywhere}h1{font-size:28pt;letter-spacing:-.7px}h2{font-size:19pt;margin-top:28px}h3{font-size:14pt}
  p,li{orphans:3;widows:3}img{max-width:100%;height:auto;object-fit:contain;max-height:${landscape?'130':'210'}mm;break-inside:avoid;display:${images?'block':'none'};margin:14px auto}
  img.inline-image{display:${images?'inline-block':'none'};vertical-align:middle;margin:0 3px;max-width:24px;max-height:24px}
  table{border-collapse:collapse;width:100%;font-size:${Math.max(8,fontSize-2)}pt;overflow-wrap:anywhere;table-layout:fixed;margin:14px 0}
  td,th{border:1px solid #dcdde7;padding:7px;text-align:left;vertical-align:top}th{background:#eeedf7}thead{display:table-header-group}tr{break-inside:avoid}td img{max-width:100%}
  .wide-table th:first-child,.wide-table td:first-child{width:26%;overflow-wrap:normal}.wide-table td:first-child a{overflow-wrap:normal;word-break:normal}
  .trophy{margin:24px 0;border-top:1px solid #ddd;padding-top:12px}.trophy-header{overflow:auto;break-after:avoid}.trophy-header img{float:left;width:52px;height:52px;margin:0 12px 8px 0}.trophy-header h3{margin:0 0 7px}.trophy-header p{margin:0 0 10px}
  pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:9pt}blockquote{border-left:3px solid #8a78e6;margin-left:0;padding:8px 18px;background:#f5f4fa}figure{margin:12px 0}figcaption,.source{font-size:9pt;color:#697087}
  section.chapter{break-before:page}.cover{height:${landscape?'155':'235'}mm;display:flex;flex-direction:column;justify-content:center;border-top:8px solid #7b68df}
  .brand{letter-spacing:3px;color:#7561cc;font-size:11pt;font-weight:700}.cover h1{font-size:${title.length>100?'30':'38'}pt}.meta{color:#697087}
  .toc{break-before:page}.toc li{margin:9px 0}.notice{padding:16px;background:#fff5dc;border-left:4px solid #daa337}.chapter-head{border-bottom:2px solid #8370db;padding-bottom:18px;margin-bottom:25px}.source{overflow-wrap:anywhere}hr{border:0;border-top:1px solid #ddd}
  </style></head><body>
  <div class="cover"><div class="brand">GAMEGUIDES / OFFLINE EDITION</div><h1>${esc(title)}</h1>
  <p class="meta">${chapters.length} rozdz. • ${new Date().toLocaleDateString('pl-PL',{timeZone:'Europe/Warsaw'})}<br>${esc(new URL(chapters[0].url).hostname)}</p><p>Twój poradnik. Zawsze pod ręką.</p></div>
  <div class="toc"><h1>Spis treści</h1>${warnings.length?`<div class="notice"><b>Eksport z uwagami</b><p>${warnings.length} uwag. Szczegóły w raporcie JSON obok PDF.</p></div>`:''}
  <ol>${chapters.map((c,i)=>`<li><a href="#chapter-${i}">${esc(c.title)}</a></li>`).join('')}</ol>
  <p class="meta">Treść należy do autorów i wydawców podanych źródeł. Eksport nie przenosi praw do treści. Materiały wideo i interaktywne mapy wymagają odwiedzenia oryginalnej strony.</p></div>
  ${chapters.map((c,i)=>`<section class="chapter" id="chapter-${i}"><div class="chapter-head"><div class="brand">ROZDZIAŁ ${String(i+1).padStart(2,'0')}</div><h1>${esc(c.title)}</h1><div class="source">Źródło: <a href="${esc(c.url)}">${esc(c.url)}</a></div></div>${content[i]}</section>`).join('')}
  </body></html>`;
}
module.exports={bookHtml,esc,prepareChapters};
