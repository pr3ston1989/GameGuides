const cheerio = require('cheerio');
const sanitize = require('sanitize-html');
const { adapter, belongs, normalize } = require('./sites.cjs');
const EXTRACTOR_VERSION=3;

const noise = [
  'script', 'style', 'noscript', 'form', 'button', 'input', 'nav', 'footer',
  '.sharedaddy', '.related-posts', '.related-content', '.object-related',
  '.campaign-nextprev', '.campaign-navigation', '.article-footer',
  '#comments', '.comments', '.comment', '.advertisement', '.ad-unit',
  '[class*="ad-slot"]', '[class*="cookie"]', '.wiki-navigation',
  '.wiki-sidebar', '.wiki-toc', '.newsletter', '.newsletter-signup',
  '.social', '.share', '.sharing', '.article-share', '.share-links',
  '.guide-page-content-footer', '.guide-page-topper', '.affiliate-disclaimer',
  '#utility-bar', '.spons', '.gg-ad', '.remove-this-ad', '.nc_socialPanel',
  '.powio-3-c', '.game2-obj-c', '.s024-np-c', '.no-print',
  '#toc', '.toc', '.ez-toc-container', '.mw-editsection'
].join(',');

function firstText($, selector) {
  return $(selector).toArray().map(el => $(el).text().replace(/\s+/g, ' ').trim()).find(Boolean);
}

function imageSource(img) {
  const lazy = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('data-original');
  if (lazy && !/[<>]/.test(lazy) && !lazy.startsWith('data:')) return lazy;
  const ownSet=img.attr('data-srcset')||img.attr('srcset');
  const direct=img.attr('src');
  if(!ownSet&&direct&&!direct.startsWith('data:'))return direct;
  const set = ownSet || img.closest('picture').find('source').last().attr('srcset');
  if (set) {
    const choices = set.split(',').map(s => s.trim().split(/\s+/)).filter(a => a[0]);
    choices.sort((a,b) => (parseFloat(a[1]) || 1) - (parseFloat(b[1]) || 1));
    const usable = choices.filter(c => (parseFloat(c[1]) || 1) <= 1600);
    return (usable.at(-1) || choices[0])?.[0];
  }
  return img.attr('src');
}

function assertAccessible($,title){
  const body=$('body').clone();body.find('script,style,noscript').remove();
  const visibleText=body.text().replace(/\s+/g,' ').trim();
  if (/just a moment|access denied|verify you are human|attention required|enable javascript and cookies|^security check$|^checking (?:your )?browser/i.test(title) || (visibleText.length<1800&&/verify (?:that )?you are (?:a )?human|performing security verification|checking your browser before/i.test(visibleText))) {
    throw new Error('Serwis wyświetla blokadę dostępu lub CAPTCHA.');
  }
}

function extract(html, url, seed = url) {
  const $ = cheerio.load(html), site = adapter(seed);
  const title = firstText($, site.titleSelector || 'h1') || firstText($, 'title') || 'Poradnik';
  assertAccessible($,title);
  let base = url;
  try { base = normalize($('base[href]').first().attr('href'), url); } catch {}
  const links = [], seen = new Set();
  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (href.startsWith('#')) return;
      const u = normalize(href, base), label = $(el).text().trim();
      if (label && belongs(seed, u) && !seen.has(u) && !/\.(?:jpg|png|pdf|zip|webp)$/i.test(new URL(u).pathname) && !/\/(?:topcontributors|edit|history)(?:\/|$)/.test(new URL(u).pathname)) {
        seen.add(u); links.push({ url: u, title: label.slice(0,220) });
      }
    } catch {}
  });
  let root, selectorUsed;
  const scope=site.scope?.(new URL(seed));
  const isScopeRoot=scope&&new URL(url).pathname.replace(/\/$/,'')===scope.replace(/\/$/,'');
  const indexFromLinks=()=>{
    const list=$('<ul>');for(const link of links)if(link.url!==url)list.append($('<li>').append($('<a>').attr('href',link.url).text(link.title)));
    return {title,content:$.html(list),links,url,site:site.name,words:list.text().split(/\s+/).length,quality:[],kind:'index',images:0,tables:0,extractorVersion:EXTRACTOR_VERSION};
  };
  if(site.collect){
    const sections=$(site.selector).filter((_,el)=>$(el).text().trim().length>20);
    if(sections.length){root=$('<div>');sections.each((_,el)=>root.append($(el).clone()));selectorUsed=site.selector;}
  }
  for (const selector of root?[]:site.selector.split(',').map(s => s.trim())) {
    const el = $(selector).first();
    if (el.length && el.text().trim().length > 100) { root = el.clone(); selectorUsed = selector; break; }
  }
  if (!root){if(isScopeRoot&&links.length>1)return indexFromLinks();throw new Error('Nie znaleziono treści poradnika. Strona może wymagać JavaScript lub mieć zmieniony układ.');}
  if(['Gamepressure','GRYOnline'].includes(site.name)){
    const maps=$('main > .guide16-map-c figure');
    maps.toArray().reverse().forEach(el=>{
      const map=$(el).clone(),original=map.find('a.guide-map-2020-zoom[href]').first().attr('href');
      map.find('img').first().addClass('map-image');
      if(original)map.find('img').first().attr('data-src',original);
      map.find('.guide-map-2020-zoom').remove();
      map.append(map.find('figcaption'));root.prepend(map);
    });
    root.find('.text-frame-red,.text-frame-green,.text-frame-blue').each((_,el)=>$(el).attr('class','callout'));
    root.children('ul').each((_,el)=>{const ul=$(el),anchors=ul.find('a[href]');if(anchors.length&&anchors.toArray().every(a=>$(a).attr('href').startsWith('#'))&&ul.text().replace(/\s+/g,'')===anchors.text().replace(/\s+/g,''))ul.remove();});
  }
  if(site.name==='PlayStationTrophies'){
    // Forum emoticons encode controls and trophy labels, rather than photographs.
    // Print their accessible labels inline; the obsolete forum image endpoint is blocked.
    root.find('img.inlineimg[src*="/forum/images/smilies/"]').each((_,el)=>{
      const img=$(el),label=img.attr('title')||img.attr('alt')||new URL(img.attr('src'),base).pathname.split('/').pop().replace(/\.\w+$/,'');
      img.replaceWith($('<span>').text('['+label+']'));
    });
    root.find('.achi__actions,.achi__bottom,.achi__header>.text-right').remove();
    root.find('.achilist__item').each((_,el)=>{
      const item=$(el),name=item.find('.achilist__title').first().text().trim();
      const section=$('<section>').attr('class','trophy').attr('id',item.attr('id')||'');
      const header=$('<div>').attr('class','trophy-header');
      const icon=item.find('.list__pic img').first().clone();icon.attr('width','52').attr('height','52');
      header.append(icon).append($('<h3>').text(name)).append(item.find('.achilist__data>p').first().clone());
      section.append(header).append(item.find('.text_res').first().clone());
      item.replaceWith(section);
    });
    root.find('.achilist').each((_,el)=>$(el).replaceWith($('<div>').html($(el).html())));
  }
  root.find('noscript').each((_,el)=>{
    const node=$(el),fallback=cheerio.load(node.html()||'');
    const fallbackImages=fallback('img').toArray();
    const visible=node.parent().find('img').filter((_,img)=>!$(img).closest('noscript').length);
    if(fallbackImages.length===1&&visible.length===1){
      const existing=visible.first(),src=imageSource(existing);
      if(!src||src.startsWith('data:'))existing.attr('data-src',imageSource(fallback(fallbackImages[0]))||'');
      node.remove();
    }else if(!visible.length&&fallbackImages.length){
      node.replaceWith(fallbackImages.map(img=>fallback.html(img)).join(''));
    }else node.remove();
  });
  if (site.name==='IGN') {
    root.find('p').each((_,el)=>{const p=$(el);if(/^<youtube>.*<\/youtube>$/i.test(p.text().trim())){const href=p.find('a[href]').first().attr('href');if(href&&/^https:\/\/(www\.)?youtube\.com\//.test(href))p.empty().append($('<a>').attr('href',href).text('Materiał wideo — otwórz w serwisie źródłowym'));}});
    // Hydrated IGN markup can replace visible images with transparent pixels.
    // Recover only images already present in the visible article by matching alt.
    const sources=new Map();
    try {
      const data=JSON.parse($('#__NEXT_DATA__').html());
      for(const entity of data.props?.pageProps?.page?.page?.htmlEntities||[]) {
        const fragment=cheerio.load(entity.values?.html||'');
        fragment('img[alt][src]').each((_,el)=>sources.set(fragment(el).attr('alt'),imageSource(fragment(el))));
      }
    } catch {}
    root.find('img').each((_,el)=>{const img=$(el);if((img.attr('src')||'').startsWith('data:')&&sources.has(img.attr('alt')))img.attr('src',sources.get(img.attr('alt')));});
    root.find('h3').each((_,el)=>{if(/^(Up Next:|Top Guide Sections|Was this guide helpful\?|In This Guide)/i.test($(el).text()))$(el).parent().remove();});
  }

  // Actual guide tables and galleries are sometimes encoded as <aside>.
  root.find('aside').each((_, el) => {
    const aside = $(el);
    if (aside.is('.object-google-sheet, .gallery') || aside.find('table').length) aside.replaceWith(aside.html());
    else aside.remove();
  });
  root.find('img[data-lazy-type="iframe"]').each((_,el)=>{
    const node=$(el),fragment=cheerio.load(node.attr('data-lazy-src')||'');
    const frame=fragment('iframe').first();
    if(frame.length)node.replaceWith($('<iframe>').attr('src',frame.attr('src')||''));else node.remove();
  });
  root.find('iframe').each((_, el) => {
    const frame = $(el); let href;
    try { href = normalize(frame.attr('src'), base); } catch {}
    if (href && /(?:^|\.)(?:youtube\.com|youtu\.be|vimeo\.com)$/.test(new URL(href).hostname)) {
      const replacement=$('<p>').append($('<a>').attr('href',href).text('Materiał wideo — otwórz w serwisie źródłowym'));
      const figure=frame.closest('figure');if(figure.length)figure.replaceWith(replacement);else frame.replaceWith(replacement);
    } else frame.remove();
  });
  root.find(noise).remove();
  root.find('p').filter((_,el)=>/^Subscribe to .+ on YouTube\s*\d*[\d.km]*$/i.test($(el).text().replace(/\s+/g,' ').trim())).remove();
  if(['Gamepressure','GRYOnline'].includes(site.name)) {
    root.children('div.btd.pb20.pt20').remove();
    root.find('.auth-bio-c').each((_,el)=>{
      const bio=$(el),author=bio.find('a').toArray().map(a=>$(a).text().trim()).find(Boolean);
      if(author)bio.replaceWith($('<p>').text('Autor: '+author));
    });
  }
  root.find('a').each((_,el)=>{const a=$(el);if(/^View Full.size$/i.test(a.text().trim())&&!a.find('img').length)a.remove();});
  root.find('img[src*="/im/plat/"], .byline-action').remove();
  root.find('details').each((_, el) => { const details = $(el); details.replaceWith($('<div>').html(details.html())); });
  root.find('summary, .subSectionTitle').each((_, el) => { const node = $(el); node.replaceWith($('<h3>').html(node.html()).attr('id',node.attr('id') || '')); });
  const mediaIssues=[];
  root.find('img').each((_, el) => {
    const img = $(el), src = imageSource(img);
    const inlineIcon=img.hasClass('inlineimg')||/\/images\/icons\//.test(src||''),mapImage=img.hasClass('map-image');
    try { img.attr('src', normalize(src,base)); } catch {if((img.attr('alt')||'').trim()||Number(img.attr('width'))>80)mediaIssues.push('Nie udało się odczytać adresu ilustracji: '+(img.attr('alt')||'obraz bez opisu'));img.remove(); return; }
    img.removeAttr('srcset').removeAttr('style').removeAttr('class');
    if(mapImage)img.attr('class','map-image');
    if (inlineIcon || (Number(img.attr('width')) > 0 && Number(img.attr('width')) <= 48) || /\/(?:\d+_trophy\.|trophy\.|trophy-guide-(?:platinum|gold|silver|bronze)\.)|\/smilies\//.test(src || '')) img.attr('class','inline-image');
  });
  root.find('a[href]').each((_, el) => {
    const a = $(el), href = a.attr('href');
    try {
      if (href.startsWith('#')) return;
      const absolute = new URL(href,base);
      a.attr('href',normalize(href,base) + absolute.hash);
    } catch { a.removeAttr('href'); }
  });
  const content = sanitize(root.html(), {
    allowedTags: sanitize.defaults.allowedTags.concat(['img','figure','figcaption']),
    allowedAttributes: { '*':['id'], a:['href','name'], img:['src','alt','width','height','class'], div:['class'],section:['class'],td:['colspan','rowspan'], th:['colspan','rowspan'] },
    allowedClasses: { img:['inline-image','map-image'],div:['trophy-header','callout'],section:['trophy'] }, allowedSchemes:['http','https'], allowProtocolRelative:false
  });
  const q = cheerio.load(content), text = q.text().replace(/\s+/g,' ').trim();
  const linkDensity = q('a').text().length / Math.max(text.length,1);
  const hasMedia=q('img').length>0||q('a[href]').toArray().some(el=>/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\//.test(q(el).attr('href')));
  const isIndex=!hasMedia&&linkDensity>0.8&&!q('table').length&&!q('p').filter((_,el)=>q(el).text().length>120).length;
  if (text.length < 100 && !hasMedia && !(isIndex&&!site.single&&site.scope&&q('a[href]').length)){if(isScopeRoot&&links.length>1)return indexFromLinks();throw new Error('Zbyt mało treści, aby utworzyć rozdział.');}
  if (isIndex && (site.single || !site.scope)) {
    throw new Error('Podany adres wygląda na katalog linków, a nie treść poradnika. Wklej adres konkretnego poradnika.');
  }
  const quality = [...mediaIssues];
  if (text.split(/\s+/).length < 60 && !isIndex) quality.push('Bardzo krótka treść — sprawdź, czy strona zawiera pełny poradnik.');
  return { title, content, links, url, site:site.name, words:text.split(/\s+/).length, quality, selector:selectorUsed,kind:isIndex?'index':'article',images:q('img').length,tables:q('table').length,extractorVersion:EXTRACTOR_VERSION };
}
module.exports = { extract, imageSource,assertAccessible,EXTRACTOR_VERSION };
