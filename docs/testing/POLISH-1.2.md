# Kontrola jakości GameGuides 1.2

Data: 2 listopada 2026. Pomiary i adresy: [polish-1.2.json](polish-1.2.json).

## Dlaczego powtórzono testy

Poprzedni pełny eksport GreedFall był wydaniem tekstowym. Potwierdzał odczyt rozdziałów, ale nie dowodził poprawnego pobrania ilustracji. W tej wersji ponownie pobrano surowe strony i wykonano cały eksport z obrazami. Stare zapisy sesji są ponownie analizowane po zmianie wersji ekstraktora, aby wcześniejsze pominięcia nie pozostawały w pamięci podręcznej.

## GreedFall z Gamepressure

- 163 odczytane adresy, 135 rozdziałów treści. 28 czystych indeksów pozostaje opcjonalnych w GUI.
- 489 stron PDF, około 30,5 MB. 711 ilustracji i map, 711 operacji rysowania obrazów w PDF, zero błędów obrazów.
- Niezależne porównanie oryginalnego artykułu i głównej mapy z treścią ekstraktora: zero pominiętych ilustracji i dłuższych akapitów.
- Wszystkie 1063 akapity dłuższe niż 60 znaków znaleziono również w tekście gotowego PDF. Porównanie normalizuje Unicode, odstępy i interpunkcję; nie sprawdza w ten sposób wyglądu ani stylów.
- Wszystkie 648 unikatowych źródłowych JPEG znajdują się w PDF bez zmiany bajtów skompresowanego obrazu. Pozostałe formaty sprawdzono przez dekodowanie i liczbę osadzeń; nie deklarujemy dla nich identyczności bajtowej.
- 470 odsyłaczy wewnętrznych, zero nieistniejących celów. Wszystkie strony sprawdzono pod kątem tekstu poza kartką i kolizji ze stopką: zero wykrytych przypadków.
- Wyrenderowano wszystkie 489 stron i przejrzano 11 plansz. Powiększono m.in. spis, porady ze zdjęciami, mapę świata, sterowanie, zakończenia i końcowe strony. To przegląd układu; nie ręczna korekta każdego słowa.

Naprawiono mapę umieszczoną nad właściwym artykułem, wybór pełnej rozdzielczości, elementy oceniania gry, powtórzony spis ze strony, podpisy i ostrzeżenia. Zmniejszono nadmierną wysokość poziomych zrzutów. Mapy zachowują większy format. Krótkie zakończenia są wiązane z poprzednią treścią, akapity nie są dowolnie dzielone.

## Pozostałe źródła

Te same 32 wcześniej wylosowane adresy z 16 serwisów wyeksportowano ponownie, **wszystkie z ilustracjami**. Łącznie: 361 stron, 1096 osadzeń obrazów, zero błędów pobierania/dekodowania obrazów, zero wykrytych wyjść tekstu poza kartkę, zero uszkodzonych odsyłaczy wewnętrznych. Nie zamieniano nieudanych adresów na łatwiejsze.

Wszystkie strony wyrenderowano. Ręcznie przejrzano plansze pierwszej, środkowej i ostatniej strony każdego pliku, a dodatkowo tabele Game8 i Nintendo Life, opisy trofeów i ilustracje PlayStationTrophies oraz mapę GreedFall w powiększeniu. Testowanie całego każdego serwisu nie zostało wykonane.

Poprawki:

- PowerPyx: stare leniwie ładowane filmy zamieniane na odsyłacze do wideo, bez 23 fałszywych braków obrazów.
- PlayStationTrophies: obrazy Imgur pobierane z nagłówkiem źródła, symbole kontrolera i trofeów ze starego forum drukowane jako czytelne etykiety.
- StrategyWiki: SVG osadzane wyłącznie jako obrazy, bez wstawiania aktywnego SVG do dokumentu.
- Game8: 99 ilustracji z obu próbek działa; odmowa dostępu do robots.txt kodem 4xx nie oznacza zakazu pobrania publicznych plików. Faktyczny Disallow, 429, błędy serwera i sieci nadal zatrzymują odczyt. Reguła: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.3.1.3).
- Szerokie tabele: szerokości wynikają z treści; nazwy i nagłówki nie rozpadają się na pojedyncze litery. Powtarzane nagłówki pozostają widoczne.
- Nintendo Life i Push Square: usunięte zachęty do subskrypcji YouTube.
- Krótki artykuł nie otrzymuje osobnej pustej okładki ani jednoelementowego spisu treści.

Dwie strony (krótki wpis Steam i strona startowa ARMS) nadal otrzymują ostrzeżenie o małej ilości tekstu. To treść źródłowa, nie pełny opis przejścia. W dwóch innych PDF pomocnicza metryka pojedynczych tokenów wykazuje różnice segmentacji; nie ukryto ich w JSON. Wynik tej metryki nie jest samodzielnym dowodem kompletności.

## Aplikacja i odtworzenie testów

40 testów jednostkowych oraz 18 scenariuszy GUI przechodzi. GUI sprawdza rzeczywisty eksport, format papieru, odsyłacze, filtr, kolejność, przerwanie, wznowienie, raport uszkodzonego pliku i opcjonalne indeksy. Test startu rzeczywistego punktu wejścia przechodzi.

Do odtworzenia wymagane są dostęp do źródeł i Poppler. Wyniki w `output/` są lokalne i nie zawierają się w repozytorium.

```powershell
node scripts/polish-greedfall.cjs
node scripts/polish-greedfall.cjs --images
npx electron scripts/render-polished.cjs
node scripts/inspect-illustrated.cjs output/pdf/GreedFall-ilustrowany.pdf output/polish/image-report.json output/polish/final-inspection.json
node scripts/verify-paragraphs.cjs
node scripts/polish-visual.cjs
$env:QA_IMAGES='all'
npm run test:pdf
npm run test:render
node scripts/qa-overview.cjs
npm test
npm run test:ui
node scripts/polish-report.cjs
```

Fixture'y 32 próbek powstają przy wcześniejszym uruchomieniu samplerów opisanych w README. [Raport 1.1](REPORT.md) pozostaje zapisem historycznych testów, w tym dawnego wydania tekstowego.
