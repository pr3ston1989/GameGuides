const {download} = require('./network.cjs');
const {extract,assertAccessible,EXTRACTOR_VERSION} = require('./extract.cjs');
const {normalize,adapter,belongs,isUtilityTitle} = require('./sites.cjs');
const robotsParser = require('robots-parser');
const cheerio = require('cheerio');
const {createHash}=require('node:crypto');
const fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url');

const pause = (ms,signal) => new Promise((resolve,reject) => {
  if(signal.aborted) return reject(new Error('Anulowano.'));
  const abort=()=>{clearTimeout(timer);reject(new Error('Anulowano.'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
  signal.addEventListener('abort',abort,{once:true});
});

class Engine {
  constructor(progress=()=>{},reader=null,options={}) {
    this.progress=progress; this.reader=reader;
    this.fetcher=options.fetcher||download; this.wait=options.wait||pause;
    this.fallbackReader=options.fallbackReader||null;
    this.checkpoint=options.checkpoint||async function(){};
    this.pages=new Map(); this.warnings=[]; this.controller=new AbortController();
    this.robots=new Map(); this.truncated=false; this.pending=[]; this.seen=new Set();
    this.robotLoads=new Map();this.requestSlots=new Map();
    this.concurrency=Math.max(1,Math.min(4,options.concurrency||3));this.readerQueue=Promise.resolve();
  }
  cancel(){this.controller.abort();}
  get signal(){return this.controller.signal;}
  snapshot(){return {version:2,extractorVersion:EXTRACTOR_VERSION,seed:this.seed,mode:this.mode,limit:this.limit,pending:[...this.pending],seen:[...this.seen],pages:[...this.pages],warnings:this.warnings,truncated:this.truncated,browser:!!this.reader};}

  async allowed(url,{media=false}={}) {
    const origin=new URL(url).origin;
    if(this.robotLoads.has(origin))await this.robotLoads.get(origin);
    if(!this.robots.has(origin)) {
      const loading=(async()=>{
      let text='';
      try { text=(await this.fetcher(origin+'/robots.txt',{signal:this.signal,maxBytes:1024*1024})).data.toString(); }
      catch(e) {
        const status=Number(e.message.match(/HTTP (\d{3})/)?.[1]);
        // RFC 9309 §2.3.1.3: an unavailable (4xx) robots file is not a Disallow rule.
        // A rate limit (429), server failure, or network failure still stops requests.
        if(!(status>=400&&status<500&&status!==429)){const error='Nie można sprawdzić robots.txt: '+e.message;this.robots.set(origin,{error});throw new Error(error);}
      }
      this.robots.set(origin,robotsParser(origin+'/robots.txt',text));
      })();this.robotLoads.set(origin,loading);
      try{await loading;}finally{this.robotLoads.delete(origin);}
    }
    const rules=this.robots.get(origin);
    if(rules.error)throw new Error(rules.error);
    if(rules.isAllowed(url,'GameGuides')===false) throw new Error('Pobieranie tego adresu jest wyłączone przez robots.txt.');
    const delay=Math.max(media?200:(this.reader?1200:250),(rules.getCrawlDelay('GameGuides')||0)*1000);
    if(delay>60000) throw new Error('Serwis wymaga odstępu ponad 60 sekund. Automatyczny eksport niedostępny.');
    const previous=this.requestSlots.get(origin)||Promise.resolve();
    const slot=previous.catch(()=>{}).then(()=>this.wait(delay,this.signal));
    this.requestSlots.set(origin,slot);await slot;
  }

  async scan(value,{mode='guide',limit=2000,resume=null}={}) {
    this.seed=normalize(value); this.mode=mode; this.limit=limit;
    this.pages.clear(); this.warnings=[]; this.truncated=false;
    this.pending=[this.seed]; this.seen=new Set(this.pending);
    if(resume && resume.seed===this.seed && resume.extractorVersion===EXTRACTOR_VERSION) {
      const blocked=[];
      this.pages=new Map(resume.pages.filter(([key,p])=>{if(!belongs(this.seed,key)||isUtilityTitle(adapter(this.seed).name,p.title))return false;try{assertAccessible(cheerio.load(p.content),p.title);return true;}catch{blocked.push(key);return false;}}));
      this.pending=[...new Set(resume.pending.concat(blocked,resume.warnings.filter(w=>w.kind==='page').map(w=>w.url)))].filter(u=>belongs(this.seed,u));
      this.seen=new Set(resume.seen);
      this.warnings=resume.warnings.filter(w=>!['limit','page'].includes(w.kind)&&!blocked.includes(w.url)&&belongs(this.seed,w.url));
    }else if(resume&&resume.seed===this.seed){
      this.progress({phase:'refresh',message:'Zapis pochodzi ze starszej wersji odczytu. Odświeżam źródła, aby odzyskać komplet treści i ilustracji.'});
      this.pending=mode==='single'?[this.seed]:[...new Set([this.seed,...(resume.pages||[]).map(([key])=>key),...(resume.pending||[])])].filter(u=>belongs(this.seed,u));
      this.seen=new Set(this.pending);
    }
    let attempted=0,consecutiveBlocks=0,lastCheckpoint=0;
    try {
      const savedRoot=this.pages.get(this.seed);
      if(mode==='guide'&&savedRoot&&!Array.isArray(savedRoot.navigation)){
        try{await this.allowed(this.seed);const {page}=await this.loadPage(this.seed);savedRoot.navigation=page.navigation;savedRoot.links=page.links;}
        catch(error){if(this.signal.aborted)throw error;this.warnings.push({url:this.seed,error:'Nie udało się odświeżyć spisu treści: '+error.message,kind:'order'});}
      }
      while(this.pending.length) {
        if(this.signal.aborted) throw new Error('Anulowano. Postęp został zachowany.');
        if(this.pages.size+attempted>=limit) {this.truncated=true;break;}
        const batch=this.pending.splice(0,Math.min(this.reader?1:this.concurrency,limit-this.pages.size-attempted));
        this.progress({phase:'scan',done:this.pages.size,total:this.pages.size+this.pending.length+batch.length,message:`Pobrano ${this.pages.size} rozdziałów · w kolejce ${this.pending.length+batch.length}: ${batch[0]}`});
        const results=await Promise.allSettled(batch.map(async url=>{await this.allowed(url);return this.loadPage(url);}));
        for(const [index,url] of batch.entries()){
        try {
          const outcome=results[index];if(outcome.status==='rejected')throw outcome.reason;
          const {response,page}=outcome.value;
          consecutiveBlocks=0;
          const canonical=normalize(response.url);
          if(![...this.pages.values()].some(p=>normalize(p.url)===canonical)) {
            this.pages.set(url,page);
            for(const warning of page.quality||[]) this.warnings.push({url,error:warning,kind:'quality'});
            if(mode==='guide') for(const link of page.links) if(!this.seen.has(link.url)){this.seen.add(link.url);this.pending.push(link.url);}
          }
        } catch(e) {
          if(this.signal.aborted) {this.pending.unshift(...batch.slice(index));throw new Error('Anulowano. Postęp został zachowany.');}
          this.warnings.push({url,error:e.message,kind:'page'}); attempted++;
          if(url===this.seed&&!this.pages.size) throw e;
          consecutiveBlocks=/HTTP (403|429)|CAPTCHA|blokadę/i.test(e.message)?consecutiveBlocks+1:0;
          if(consecutiveBlocks>=3){this.pending.unshift(...batch.slice(index));this.progress({phase:'blocked',message:'Serwis blokuje kolejne strony. Zachowano postęp; wznów po ustaniu blokady.'});break;}
        }
        }
        if(this.pages.size+attempted-lastCheckpoint>=10){await this.checkpoint(this.snapshot());lastCheckpoint=this.pages.size+attempted;}
        if(consecutiveBlocks>=3)break;
      }
      if(this.truncated) this.warnings.push({url:this.seed,error:`Osiągnięto limit ${limit} stron. Pozostało ${this.pending.length} adresów. Zwiększ limit i wznów pobieranie.`,kind:'limit'});
      return this.result();
    } finally { await this.checkpoint(this.snapshot()); }
  }

  async loadPage(url){
    const load=async()=>{
      let response;
      if(this.reader){
        const read=this.readerQueue.catch(()=>{}).then(()=>{if(this.signal.aborted)throw new Error('Anulowano.');return this.reader(url,this.signal);});
        this.readerQueue=read;response=await read;
      }else response=await this.fetcher(url,{signal:this.signal});
      if(!/text\/html|application\/xhtml/i.test(response.type))throw new Error('Adres nie zawiera strony HTML.');
      if(!belongs(this.seed,response.url))throw new Error('Przekierowanie poza zakres wybranego poradnika.');
      try{return {response,page:extract(response.data.toString('utf8'),response.url,this.seed)};}
      catch(e){if(response.status>=400)throw new Error(`HTTP ${response.status}: serwis nie udostępnił treści poradnika w przeglądarce. Dokończ ręcznie weryfikację i ponów próbę. ${e.message}`);throw e;}
    };
    try{return await load();}catch(e){
      if(!this.signal.aborted&&!this.reader&&this.fallbackReader&&/HTTP (403|429)|CAPTCHA|Nie znaleziono treści/i.test(e.message)){
        this.progress({phase:'browser',message:'Serwis wymaga przeglądarki — przełączam tryb odczytu. W razie potrzeby dokończ weryfikację w otwartym oknie.'});
        this.reader=this.fallbackReader;return load();
      }
      throw e;
    }
  }

  result(){
    // Preserve source navigation and expand section indexes in place, independent of response timing.
    const byUrl=new Map();for(const [key,page]of this.pages){byUrl.set(key,[key,page]);byUrl.set(page.url,[key,page]);}
    const ordered=[],visited=new Set();
    const visit=(url,expand=false)=>{const entry=byUrl.get(url);if(!entry||visited.has(entry[0]))return;const [key,page]=entry;visited.add(key);ordered.push(key);if(expand||page.kind==='index')for(const link of page.links||[])visit(link.url);};
    const navigation=[...this.pages.values()].map(p=>p.navigation||[]).sort((a,b)=>b.length-a.length)[0]||[];
    visit(this.seed);for(const url of navigation)visit(url);
    for(const link of this.pages.get(this.seed)?.links||[])visit(link.url);
    for(const url of this.seen)visit(url);for(const key of this.pages.keys())visit(key);
    const order=new Map(ordered.map((url,index)=>[url,index]));
    const pages=[...this.pages].sort((a,b)=>(order.get(a[0])??Infinity)-(order.get(b[0])??Infinity)).map(([key,p])=>({key,title:p.title,url:p.url,words:p.words,kind:p.kind||'article',images:p.images??cheerio.load(p.content)('img').length}));
    return {site:adapter(this.seed).name,pages,warnings:this.warnings,truncated:this.truncated,pending:this.pending.length,browser:!!this.reader};
  }

  async chapters(keys,images,{assetDirectory}={}) {
    const chapters=[],cache=new Map(),duplicates=new Map(),animations=new Map(); let bytes=0;
    const budgetMB=assetDirectory?512:160;
    if(images&&assetDirectory)await fs.mkdir(assetDirectory,{recursive:true});
    this.media={requested:!!images,expected:0,embedded:0,failed:0,assets:[]};
    // Export warnings belong to this attempt, not previous exports.
    this.warnings=this.warnings.filter(w=>w.kind!=='image');
    for(const [i,key] of keys.entries()) {
      if(this.signal.aborted) throw new Error('Anulowano.');
      const page=this.pages.get(key);
      if(!page) throw new Error('Lista rozdziałów wygasła. Przeanalizuj poradnik ponownie.');
      const fingerprint=createHash('sha256').update(page.title+'\0'+page.content).digest('hex');
      if(duplicates.has(fingerprint)){
        const original=chapters[duplicates.get(fingerprint)];original.aliases=[...new Set([...(original.aliases||[]),page.url,...(page.aliases||[])])];continue;
      }
      duplicates.set(fingerprint,chapters.length);
      this.progress({phase:'export',done:i+1,total:keys.length,message:`Składanie ${i+1}/${keys.length}: ${page.title}`});
      const $=cheerio.load(page.content);
      const elements=$('img').toArray();let cursor=0;
      const processImage=async(index,el)=>{
        const img=$(el),url=img.attr('src');
        this.media.expected++;
        const asset={chapter:key,url,alt:img.attr('alt')||'',status:images?'pending':'disabled'};this.media.assets.push(asset);
        if(!images){img.remove();return;}
        this.progress({phase:'images',message:`Ilustracje: rozdział ${i+1}/${keys.length}, obraz ${index+1}/${$('img').length}`});
        try {
          if(!cache.has(url)) {
            cache.set(url,(async()=>{
            const options={signal:this.signal,maxBytes:5*1024*1024,referer:page.url};
            let r=this.fetcher.peek?await this.fetcher.peek(url,options):null;
            if(!r){await this.allowed(url,{media:true});r=await this.fetcher(url,options);}
            let type=r.type.split(';')[0],data=r.data;
            if(!/^image\/(png|jpeg|webp|gif|avif|svg\+xml)$/.test(type)) throw new Error('Nieobsługiwany format ilustracji.');
            if(assetDirectory&&type==='image/gif'){
              const sharp=require('sharp'),metadata=await sharp(data).metadata();
              animations.set(url,metadata.pages||1);
              data=await sharp(data).webp({lossless:true}).toBuffer();type='image/webp';
            }
            // Limit decoded pixels in Chromium; preserve detailed maps unchanged.
            if(assetDirectory&&type!=='image/svg+xml'){
              const sharp=require('sharp');
              const image=sharp(data,{limitInputPixels:100000000});let meta;
              try{meta=await image.metadata();}catch{throw new Error('Uszkodzony lub nieczytelny plik obrazu.');}
              if(!img.hasClass('map-image')&&Math.max(meta.width||0,meta.height||0)>2000){
                image.rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true});
              }
              // Chromium embeds JPEG directly; WebP screenshots become enormous decoded PDF streams.
              if(type!=='image/webp'||!animations.has(url)){
                if(Math.max(meta.width||0,meta.height||0)>256&&!img.hasClass('map-image')){
                  data=await image.flatten({background:'#ffffff'}).jpeg({quality:78}).toBuffer();type='image/jpeg';
                }else if(!img.hasClass('map-image')&&Math.max(meta.width||0,meta.height||0)>2000){
                  data=await image.png().toBuffer();type='image/png';
                }
              }
            }
            if(bytes+data.length>budgetMB*1024*1024) throw new Error(`Osiągnięto limit ${budgetMB} MB ilustracji.`);
            bytes+=data.length;
            if(assetDirectory){
              const extension=type==='image/svg+xml'?'svg':type.split('/')[1];
              const asset=path.join(assetDirectory,createHash('sha256').update(data).digest('hex')+'.'+extension);
              await fs.writeFile(asset,data);return pathToFileURL(asset).href;
            }else return `data:${type};base64,${data.toString('base64')}`;
            })());
          }
          img.attr('src',await cache.get(url)).attr('data-source',url);
          if((animations.get(url)||0)>1){
            asset.animationFrames=animations.get(url);asset.rendering='first-frame-with-source-link';
            const figure=$('<figure>').append(img.clone()).append($('<figcaption>').text('Animacja: PDF pokazuje pierwszą klatkę. ').append($('<a>').attr('href',url).text('Otwórz pełną animację')));
            const parent=img.parent();if(parent.is('a')&&!parent.text().trim()&&parent.find('img').length===1)parent.replaceWith(figure);else img.replaceWith(figure);
          }
          asset.status='embedded';this.media.embedded++;
        } catch(e) {
          if(this.signal.aborted) throw new Error('Anulowano.');
          this.warnings.push({url,error:'Ilustracja: '+e.message,kind:'image'});
          asset.status='failed';asset.error=e.message;this.media.failed++;
          img.replaceWith($('<p>').text('[Ilustracja niedostępna: '+(img.attr('alt')||url)+']'));
        }
      };
      await Promise.all(Array.from({length:Math.min(4,elements.length)},async()=>{
        while(cursor<elements.length){const index=cursor++;await processImage(index,elements[index]);}
      }));
      chapters.push({...page,content:$('body').html()});
    }
    return chapters;
  }
}
module.exports={Engine,pause};
