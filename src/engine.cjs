const {download} = require('./network.cjs');
const {extract,EXTRACTOR_VERSION} = require('./extract.cjs');
const {normalize,adapter,belongs} = require('./sites.cjs');
const robotsParser = require('robots-parser');
const cheerio = require('cheerio');

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
  }
  cancel(){this.controller.abort();}
  get signal(){return this.controller.signal;}
  snapshot(){return {version:2,extractorVersion:EXTRACTOR_VERSION,seed:this.seed,mode:this.mode,limit:this.limit,pending:[...this.pending],seen:[...this.seen],pages:[...this.pages],warnings:this.warnings,truncated:this.truncated,browser:!!this.reader};}

  async allowed(url,{media=false}={}) {
    const origin=new URL(url).origin;
    if(!this.robots.has(origin)) {
      let text='';
      try { text=(await this.fetcher(origin+'/robots.txt',{signal:this.signal,maxBytes:1024*1024})).data.toString(); }
      catch(e) {
        const status=Number(e.message.match(/HTTP (\d{3})/)?.[1]);
        // RFC 9309 §2.3.1.3: an unavailable (4xx) robots file is not a Disallow rule.
        // A rate limit (429), server failure, or network failure still stops requests.
        if(!(status>=400&&status<500&&status!==429)){const error='Nie można sprawdzić robots.txt: '+e.message;this.robots.set(origin,{error});throw new Error(error);}
      }
      this.robots.set(origin,robotsParser(origin+'/robots.txt',text));
    }
    const rules=this.robots.get(origin);
    if(rules.error)throw new Error(rules.error);
    if(rules.isAllowed(url,'GameGuides')===false) throw new Error('Pobieranie tego adresu jest wyłączone przez robots.txt.');
    const delay=Math.max(media?200:1200,(rules.getCrawlDelay('GameGuides')||0)*1000);
    if(delay>60000) throw new Error('Serwis wymaga odstępu ponad 60 sekund. Automatyczny eksport niedostępny.');
    await this.wait(delay,this.signal);
  }

  async scan(value,{mode='guide',limit=2000,resume=null}={}) {
    this.seed=normalize(value); this.mode=mode; this.limit=limit;
    this.pages.clear(); this.warnings=[]; this.truncated=false;
    this.pending=[this.seed]; this.seen=new Set(this.pending);
    if(resume && resume.seed===this.seed && resume.extractorVersion===EXTRACTOR_VERSION) {
      this.pages=new Map(resume.pages);
      this.pending=[...new Set(resume.pending.concat(resume.warnings.filter(w=>w.kind==='page').map(w=>w.url)))].filter(u=>belongs(this.seed,u));
      this.seen=new Set(resume.seen);
      this.warnings=resume.warnings.filter(w=>!['limit','page'].includes(w.kind));
    }else if(resume&&resume.seed===this.seed){
      this.progress({phase:'refresh',message:'Zapis pochodzi ze starszej wersji odczytu. Odświeżam źródła, aby odzyskać komplet treści i ilustracji.'});
      this.pending=mode==='single'?[this.seed]:[...new Set([this.seed,...(resume.pages||[]).map(([key])=>key),...(resume.pending||[])])].filter(u=>belongs(this.seed,u));
      this.seen=new Set(this.pending);
    }
    let attempted=0;
    try {
      while(this.pending.length) {
        if(this.signal.aborted) throw new Error('Anulowano. Postęp został zachowany.');
        if(this.pages.size+attempted>=limit) {this.truncated=true;break;}
        const url=this.pending.shift();
        this.progress({phase:'scan',done:this.pages.size,total:this.pages.size+this.pending.length+1,message:`Pobrano ${this.pages.size} rozdziałów · w kolejce ${this.pending.length+1}: ${url}`});
        try {
          await this.allowed(url);
          const {response,page}=await this.loadPage(url);
          const canonical=normalize(response.url);
          if(![...this.pages.values()].some(p=>normalize(p.url)===canonical)) {
            this.pages.set(url,page);
            for(const warning of page.quality||[]) this.warnings.push({url,error:warning,kind:'quality'});
            if(mode==='guide') for(const link of page.links) if(!this.seen.has(link.url)){this.seen.add(link.url);this.pending.push(link.url);}
          }
        } catch(e) {
          if(this.signal.aborted) {this.pending.unshift(url);throw new Error('Anulowano. Postęp został zachowany.');}
          this.warnings.push({url,error:e.message,kind:'page'}); attempted++;
          if(url===this.seed&&!this.pages.size) throw e;
        }
        if((this.pages.size+attempted)%10===0) await this.checkpoint(this.snapshot());
      }
      if(this.truncated) this.warnings.push({url:this.seed,error:`Osiągnięto limit ${limit} stron. Pozostało ${this.pending.length} adresów. Zwiększ limit i wznów pobieranie.`,kind:'limit'});
      return this.result();
    } finally { await this.checkpoint(this.snapshot()); }
  }

  async loadPage(url){
    const load=async()=>{
      const response=this.reader?await this.reader(url,this.signal):await this.fetcher(url,{signal:this.signal});
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
    const order=new Map([...this.seen].map((url,index)=>[url,index]));
    const pages=[...this.pages].sort((a,b)=>(order.get(a[0])??Infinity)-(order.get(b[0])??Infinity)).map(([key,p])=>({key,title:p.title,url:p.url,words:p.words,kind:p.kind||'article',images:p.images??cheerio.load(p.content)('img').length}));
    return {site:adapter(this.seed).name,pages,warnings:this.warnings,truncated:this.truncated,pending:this.pending.length,browser:!!this.reader};
  }

  async chapters(keys,images) {
    const chapters=[],cache=new Map(); let bytes=0;
    this.media={requested:!!images,expected:0,embedded:0,failed:0,assets:[]};
    // Export warnings belong to this attempt, not previous exports.
    this.warnings=this.warnings.filter(w=>w.kind!=='image');
    for(const [i,key] of keys.entries()) {
      if(this.signal.aborted) throw new Error('Anulowano.');
      const page=this.pages.get(key);
      if(!page) throw new Error('Lista rozdziałów wygasła. Przeanalizuj poradnik ponownie.');
      this.progress({phase:'export',done:i+1,total:keys.length,message:`Składanie ${i+1}/${keys.length}: ${page.title}`});
      const $=cheerio.load(page.content);
      for(const [index,el] of $('img').toArray().entries()) {
        const img=$(el),url=img.attr('src');
        this.media.expected++;
        const asset={chapter:key,url,alt:img.attr('alt')||'',status:images?'pending':'disabled'};this.media.assets.push(asset);
        if(!images){img.remove();continue;}
        this.progress({phase:'images',message:`Ilustracje: rozdział ${i+1}/${keys.length}, obraz ${index+1}/${$('img').length}`});
        try {
          if(!cache.has(url)) {
            const options={signal:this.signal,maxBytes:5*1024*1024,referer:page.url};
            let r=this.fetcher.peek?await this.fetcher.peek(url,options):null;
            if(!r){await this.allowed(url,{media:true});r=await this.fetcher(url,options);}
            const type=r.type.split(';')[0];
            if(!/^image\/(png|jpeg|webp|gif|avif|svg\+xml)$/.test(type)) throw new Error('Nieobsługiwany format ilustracji.');
            if(bytes+r.data.length>160*1024*1024) throw new Error('Osiągnięto limit 160 MB ilustracji.');
            bytes+=r.data.length;cache.set(url,`data:${type};base64,${r.data.toString('base64')}`);
          }
          img.attr('src',cache.get(url)).attr('data-source',url);
          asset.status='embedded';this.media.embedded++;
        } catch(e) {
          if(this.signal.aborted) throw new Error('Anulowano.');
          this.warnings.push({url,error:'Ilustracja: '+e.message,kind:'image'});
          asset.status='failed';asset.error=e.message;this.media.failed++;
          img.replaceWith($('<p>').text('[Ilustracja niedostępna: '+(img.attr('alt')||url)+']'));
        }
      }
      chapters.push({...page,content:$('body').html()});
    }
    return chapters;
  }
}
module.exports={Engine,pause};
