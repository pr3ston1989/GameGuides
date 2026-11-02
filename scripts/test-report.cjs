const fs=require('node:fs/promises');
async function main(){
 const samples=JSON.parse(await fs.readFile('docs/testing/samples.json','utf8'));
 const pdf=JSON.parse(await fs.readFile('output/qa/visual-report.json','utf8'));
 const full=JSON.parse(await fs.readFile('docs/testing/full-guide.json','utf8'));
 const ui=JSON.parse(await fs.readFile('output/ui-qa/result.json','utf8'));
 await fs.writeFile('docs/testing/pdf.json',JSON.stringify(pdf,null,2));
 await fs.writeFile('docs/testing/ui.json',JSON.stringify({ok:ui.ok,checks:ui.checks},null,2));
 const verified=samples.results.filter(s=>s.samples.filter(p=>p.status==='ok').length===2);
 const pages=pdf.reduce((n,p)=>n+p.pdfPages,0);
 const lines=[
 '# Raport testów GameGuides 1.1.0','', 'Data: 2 listopada 2026.','',
 '## Zakres i metoda','',
 `Sprawdzono katalogi 20 serwisów. W ${verified.length} serwisach odczytano po dwie wylosowane strony. Dobór: ranking SHA-256(seed + URL), seed gameguides-2026-11-02-v2, pierwsze dwa adresy z katalogu po odfiltrowaniu stron platform, roczników i linków niebędących poradnikami. To ograniczona próba, nie gwarancja działania całych serwisów. Katalogi IGN, Game8, Neoseeker i Steam dotyczyły jednej gry; inne obejmowały wiele gier. Wiki mogą zawierać krótkie strony startowe.`, '',
 'Skorygowano adresy katalogów Gamepressure, GRYOnline, GamesRadar+ i Game8 po pierwszej próbie. Dla Neoseeker użyto spisu poradnika zamiast strony głównej. W StrategyWiki wykluczono platformy i roczniki przed ponownym losowaniem. PlayStationTrophies, Neoseeker i StrategyWiki testowano dodatkowo w przeglądarce po odmowach HTTP. Dokładne adresy i pomiary: [samples.json](samples.json).','',
 '## Wyniki','',
 `- ${pdf.length} PDF, łącznie ${pages} stron, wszystkie wyrenderowane do podglądów.`,
 '- Dla każdego dostępnego serwisu jeden eksport z włączonym pobieraniem ilustracji i drugi bez obrazów.',
 `- Tekst poza granicami strony: ${pdf.reduce((n,p)=>n+p.overflow.length,0)} przypadków.`,
 `- Uszkodzone odsyłacze wewnętrzne: ${pdf.reduce((n,p)=>n+p.brokenLinks.length,0)} z ${pdf.reduce((n,p)=>n+p.internalLinks,0)} sprawdzonych.`,
 `- Minimalna zgodność zbioru słów z odczytanym HTML: ${(Math.min(...pdf.map(p=>p.tokenCoverage))*100).toFixed(2)}%. Różnice obejmują łamanie słów i elementy wideo. Wskaźnik nie zastępuje oceny wizualnej.`,
 `- GreedFall: ${full.pages.length} rozdziały, ${full.pdfPages} stron PDF, ${full.pending} adresów w kolejce, ${full.warnings.length} uwag. Pełny poradnik testowano bez ilustracji.`,
 `- Cały PDF GreedFall: ${full.overflow.length} wyjść poza stronę, ${full.brokenLinks.length} błędnych odsyłaczy z ${full.internalLinks}. Wizualnie sprawdzono strony ${full.visuallySampledPages.join(', ')}.`,
 `- GUI: ${ui.checks.length} scenariuszy, wynik ${ui.ok?'poprawny':'błędny'}. Eksport, wymiary PDF, linki, kolejność, filtr, wznowienie, anulowanie, błędny URL, uszkodzone obrazy i układ 920 px.`, '',
 '## Serwisy','', '| Serwis | Odczyt próby | Tryb | Przykłady |','|---|---|---|---|'
 ];
 for(const s of samples.results){
   const links=s.samples.map(p=>`[${(p.title||'Błąd odczytu').replace(/\|/g,'/')}](<${p.url}>)`).join('; ');
   lines.push(`| ${s.name} | ${s.samples.filter(p=>p.status==='ok').length}/2 | ${s.mode} | ${links||s.catalogError||'Brak próbek'} |`);
 }
 lines.push('', '## Poprawki wynikające z testów','',
 '1. Nintendo Life: przywrócone tabele i galerie w aside. Pokédex: 195 → około 1408 słów.',
 '2. Game8: treść poradnika zamiast okna członkostwa, przywrócone statystyki i tabele.',
 '3. PlayStationTrophies: roadmap oraz wszystkie opisy trofeów i DLC. 007 First Light: 651 → 4958 słów; Mafia III: 2378 → 12365 słów.',
 '4. IGN: przywrócone obrazy zastąpione przez przezroczyste piksele, wyłącznie dla widocznych miejsc na zdjęcia.',
 '5. Indeksy działów są zachowywane, a nie zgłaszane jako błędy. Szerokie tabele mają większą kolumnę nazw.',
 '6. Usunięte dodatki reklamowe, udostępnianie, duplikaty noscript i karty ocen gry. Uszkodzone obrazy są raportowane.',
 '7. Security check/CAPTCHA nie są poradnikami. Dodano automatyczne przełączenie na normalną przeglądarkę.',
 '8. Zapis postępu, ponowienie błędnych stron, zachowanie kolejności, cache obrazów, historia, ustawienia papieru i tekstu.', '',
 '## Ograniczenia','',
 'GameFAQs, PSNProfiles i TrueAchievements blokowały dostęp; RPG Site zwracało błąd podczas sprawdzania robots.txt. Nie oznaczono ich jako zweryfikowanych. Tryb przeglądarkowy może działać przejściowo i wymagać ręcznej weryfikacji. Game8: tekst działał, ale serwer ilustracji blokował sprawdzenie robots.txt; 17 brakujących obrazów trafiło do raportu. Jedna próbka Steam była krótkim wpisem społecznościowym, a ARMS w StrategyWiki krótką stroną startową; aplikacja ostrzega o małej ilości treści. Zgodność z widocznym HTML nie gwarantuje odkrycia stron niepodlinkowanych, płatnych ani niedostępnych.', '',
 'Szczegóły: [PDF](pdf.json), [pełny poradnik](full-guide.json), [GUI](ui.json), [próby przeglądarkowe](browser.json).','');
 await fs.writeFile('docs/testing/REPORT.md',lines.join('\n'));
 console.log({sites:verified.length,documents:pdf.length,pages,fullChapters:full.pages.length,fullPdfPages:full.pdfPages});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
