const cheerio=require('cheerio');
const sanitize=require('sanitize-html');
const {adapter,belongs,normalize}=require('./sites.cjs');
function extract(html,url,seed=url) {
 const $=cheerio.load(html), site=adapter(seed);
 const title=($('h1').first().text()||$('title').text()).trim();
 if(/just a moment|access denied|verify you are human|attention required/i.test(title)) throw new Error('Serwis wyświetla blokadę dostępu lub CAPTCHA.');
 const links=[];const seen=new Set();
 // Discover from the complete DOM before removing navigation / guide sidebars.
 $('a[href]').each((_,el)=>{try{const u=normalize($(el).attr('href'),url);const label=$(el).text().trim();if(label&&belongs(seed,u)&&!seen.has(u)&&! /\.(jpg|png|pdf|zip|webp)$/i.test(new URL(u).pathname)){seen.add(u);links.push({url:u,title:label.slice(0,220)});}}catch{}});
 let root;
 for(const selector of site.selector.split(',').map(s=>s.trim())){const el=$(selector).first();if(el.length&&el.text().trim().length>100){root=el.clone();break;}}
 if(!root) throw new Error('Nie znaleziono treści poradnika. Strona może wymagać JavaScript lub mieć zmieniony układ.');
 root.find('script, style, iframe, form, button, input, nav, footer, aside, .sharedaddy, .related-posts, #comments, .comments, .advertisement, [class*="ad-slot"], [class*="cookie"], .wiki-navigation, .wiki-sidebar, .wiki-toc').remove();
 root.find('img').each((_,el)=>{const img=$(el);const src=img.attr('data-src')||img.attr('data-lazy-src')||img.attr('src');try{img.attr('src',normalize(src,url));}catch{img.remove();}img.removeAttr('srcset').removeAttr('style').removeAttr('class');if((Number(img.attr('width'))>0&&Number(img.attr('width'))<=48)||/\/(?:\d+_trophy\.|trophy\.|trophy-guide-(?:platinum|gold|silver|bronze)\.)|\/smilies\//.test(src||''))img.attr('class','inline-image');});
 root.find('a[href]').each((_,el)=>{try{$(el).attr('href',normalize($(el).attr('href'),url));}catch{$(el).removeAttr('href');}});
 const content=sanitize(root.html(),{allowedTags:sanitize.defaults.allowedTags.concat(['img','figure','figcaption','details','summary']),allowedAttributes:{a:['href'],img:['src','alt','width','height','class'],td:['colspan','rowspan'],th:['colspan','rowspan']},allowedClasses:{img:['inline-image']},allowedSchemes:['http','https','data'],allowProtocolRelative:false});
 const text=cheerio.load(content).text().trim();
 if(text.length<100)throw new Error('Zbyt mało treści, aby utworzyć rozdział.');
 return {title,content,links,url,site:site.name,words:text.split(/\s+/).length};
}
module.exports={extract};
