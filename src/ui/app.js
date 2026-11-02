const $=id=>document.getElementById(id);
let pages=[],working=false,saved=null,knownSites=[];
const errorText=e=>e.message.replace(/^Error invoking remote method '[^']+': Error: /,'');
function status(text){$('status').textContent=text;}
function busy(value){
  working=value;
  for(const id of ['scan','export','prepare','resume','url','mode','limit','images','browser','auto-browser','book-title','paper','font-size','landscape'])$(id).disabled=value;
  $('export').disabled=value||!pages.some(p=>p.selected);
  $('cancel').hidden=!value;$('progress').hidden=!value;
  if(!value)$('progress').removeAttribute('value');
}
function render(){
  $('empty').hidden=pages.length>0;$('selection').hidden=!pages.length;$('pages').replaceChildren();
  const query=$('filter').value.toLocaleLowerCase();
  pages.forEach((p,i)=>{
    if(query&&!`${p.title} ${p.url}`.toLocaleLowerCase().includes(query))return;
    const li=document.createElement('li'),label=document.createElement('label'),check=document.createElement('input');
    check.type='checkbox';check.checked=p.selected;check.disabled=working;
    check.onchange=()=>{p.selected=check.checked;render();};
    label.append(check,document.createTextNode(' '+p.title));
    const small=document.createElement('small');small.textContent=`${p.kind==='index'?'Indeks działu (opcjonalny) · ':''}${p.words} słów · ${p.images||0} ilustracji · ${p.url}`;label.append(small);li.append(label);
    for(const [text,delta] of [['↑',-1],['↓',1]]){
      const button=document.createElement('button');button.textContent=text;button.className='quiet';button.title='Przenieś rozdział';
      button.disabled=working||!pages[i+delta];button.onclick=()=>{[pages[i],pages[i+delta]]=[pages[i+delta],pages[i]];render();};li.append(button);
    }
    $('pages').append(li);
  });
  const n=pages.filter(p=>p.selected).length;
  $('count').textContent=`${n} / ${pages.length} rozdziałów`;
  $('all').checked=n===pages.length;$('all').indeterminate=n>0&&n<pages.length;$('all').disabled=working;$('export').disabled=working||!n;
  const pictures=pages.filter(p=>p.selected).reduce((sum,p)=>sum+(p.images||0),0);
  $('export-summary').textContent=$('images').checked?`Ilustracje włączone${pages.length?' · '+pictures+' obrazów w wybranych rozdziałach':''}`:'Wydanie tekstowe — wszystkie ilustracje zostaną pominięte';
}
function warnings(items){$('warnings').hidden=!items.length;$('warnings').textContent=items.map(w=>`${w.error}\n${w.url}`).join('\n\n');}
async function refreshResume(){saved=await window.guides.checkpoint();$('resume-box').hidden=!saved?.pages&&!saved?.pending&&!saved?.failed;if(saved)$('resume-text').textContent=`Zapisana sesja: ${saved.pages} rozdz., ${saved.pending} w kolejce, ${saved.failed} do ponowienia. ${saved.url}`;}
async function scan(resume=false){
  pages=[];busy(true);render();warnings([]);$('result').hidden=true;
  try {
    const r=await window.guides.scan({url:$('url').value.trim(),mode:$('mode').value,limit:Number($('limit').value),browser:$('browser').checked,autoBrowser:$('auto-browser').checked,resume});
    pages=r.pages.map(p=>({...p,selected:p.kind!=='index'}));$('site').textContent=r.site+(r.browser?' · przeglądarka':'');$('book-title').value=pages[0]?.title||'';
    const indexes=pages.filter(p=>p.kind==='index').length;
    warnings(r.warnings);status(r.truncated?'Osiągnięto limit — zwiększ go i użyj „Wznów”.':`Znaleziono ${pages.length-indexes} rozdziałów${indexes?' i '+indexes+' opcjonalnych indeksów':''}. Sprawdź listę i zapisz PDF.`);
  } catch(e){status(errorText(e));}
  finally {busy(false);render();await refreshResume();}
}
$('scan').onclick=()=>scan();
$('resume').onclick=()=>{if(!saved)return;$('url').value=saved.url;$('mode').value=saved.mode;$('browser').checked=$('browser').checked||saved.browser;scan(true);};
$('export').onclick=async()=>{
  busy(true);render();
  try {
    const r=await window.guides.export({keys:pages.filter(p=>p.selected).map(p=>p.key),images:$('images').checked,title:$('book-title').value,paper:$('paper').value,fontSize:Number($('font-size').value),landscape:$('landscape').checked});
    if(r){$('result').hidden=false;$('result-text').textContent=`Zapisano ${r.chapters} rozdziałów · ${r.illustrations.requested?r.illustrations.embedded+' / '+r.illustrations.expected+' ilustracji':'wydanie bez ilustracji'}: ${r.path}`;status(r.warnings?`PDF zapisany z uwagami (${r.warnings}). Sprawdź raport JSON obok pliku.`:r.illustrations.requested?'PDF gotowy z ilustracjami. Miłego grania!':'Wydanie tekstowe gotowe — ilustracje były wyłączone.');await renderHistory();}
    else status('Zapis anulowany.');
  } catch(e){status(errorText(e));}
  finally {busy(false);render();}
};
$('filter').oninput=render;
$('images').onchange=render;
$('all').onchange=()=>{pages.forEach(p=>p.selected=$('all').checked);render();};
$('cancel').onclick=()=>{window.guides.cancel();status('Przerywanie i zapisywanie postępu…');};
$('open').onclick=()=>window.guides.open();$('folder').onclick=()=>window.guides.folder();
$('prepare').onclick=async()=>{try{await window.guides.prepare($('url').value.trim());$('browser').checked=true;status('Dokończ zgody lub logowanie w otwartym oknie. Następnie kliknij „Znajdź rozdziały”.');}catch(e){status(errorText(e));}};
window.guides.onProgress(p=>{status(p.message);$('cancel').hidden=p.phase==='print';if(p.total){$('progress').max=p.total;$('progress').value=p.done;}else $('progress').removeAttribute('value');});
window.guides.sites().then(items=>{
  knownSites=items;$('source-summary').textContent=`${items.filter(s=>s.status==='verified').length} sprawdzonych · ${items.length} adapterów`;
  for(const s of items){
    const b=document.createElement('button');b.className='source-card '+(s.status==='verified'?'verified':'restricted');
    const name=document.createElement('b');name.textContent=s.name;
    const state=document.createElement('small');state.textContent=(s.status==='verified'?'✓ Odczyt sprawdzony':'! Dostęp ograniczony')+(s.mode==='browser'?' · przeglądarka':'')+(s.single?' · jedna strona':' · rozdziały');
    b.title=s.note||s.host;b.append(name,state);b.onclick=()=>{if(working)return;$('url').value=s.example||'https://'+s.host;$('browser').checked=s.mode==='browser';$('url').focus();status(s.note||'Wybierz zakres i uruchom analizę.');window.scrollTo({top:0,behavior:'smooth'});};$('sites').append(b);
  }
});
async function renderHistory(){
  const items=await window.guides.history();$('history').replaceChildren();
  if(!items.length){const p=document.createElement('p');p.className='history-empty';p.textContent='Zapisane poradniki pojawią się tutaj.';$('history').append(p);}
  items.forEach((item,index)=>{const button=document.createElement('button');button.className='history-item';button.textContent=item.title;button.title=item.path;const small=document.createElement('small');small.textContent=`${item.chapters} rozdziałów · ${new Date(item.date).toLocaleDateString('pl-PL')}`;button.append(small);button.onclick=async()=>{const error=await window.guides.open(index);if(error)status(error);};$('history').append(button);});
}
refreshResume();renderHistory();
