# GameGuides

Samodzielna aplikacja Windows: wklej link do poradnika, wybierz rozdziały i zapisz estetyczny PDF. Polski interfejs, ciemny motyw, własna ikona, instalator i wersja portable.

![Interfejs](docs/gui.png)

## Instalacja

Pobierz **GameGuides-1.0.0-Setup.exe** z [Releases](https://github.com/pr3ston1989/GameGuides/releases). Instalator pozwala wybrać katalog i tworzy skróty na pulpicie oraz w menu Start. Nie wymaga Node.js ani osobnego silnika PDF. **Portable.exe** uruchamia aplikację bez instalacji. Wydanie nie ma komercyjnego podpisu cyfrowego.

## Użycie

1. Wklej adres głównej strony poradnika.
2. Wybierz „Cały poradnik” albo „Tylko podana strona”.
3. Kliknij „Znajdź rozdziały”. Aplikacja pobiera strony kolejno, z odstępami; duże poradniki mogą wymagać kilkudziesięciu minut.
4. Sprawdź listę. Odznacz niepotrzebne rozdziały i zmień ich kolejność strzałkami.
5. Wybierz ilustracje i kliknij „Zapisz PDF”. Obok PDF powstanie raport `.pdf.report.json` z adresami źródeł i informacjami o błędach.

Limit wynosi domyślnie 2000 stron, maksymalnie 5000. Osiągnięcie limitu jest wyraźnie zgłaszane; zwiększ go i ponów analizę. „Cały poradnik” oznacza dostępne rozdziały znalezione przez linki w obrębie tej samej gry. Strony niepodlinkowane, ukryte w niedostępnych menu lub wymagające odrębnego dostępu mogą pozostać niewykryte. Raport nie gwarantuje kompletności względem całej witryny.

## JavaScript, cookies i logowanie

Zaznacz „Odczyt w przeglądarce” i użyj „Otwórz stronę”. W osobnym oknie samodzielnie zaakceptuj cookies, zaloguj się lub rozwiąż wyświetloną weryfikację. Następnie uruchom analizę w głównym oknie. Aplikacja czyta wyrenderowany dokument i używa tej samej sesji do następnych stron. Przeglądarka nie gwarantuje usunięcia blokad serwisu. Nie automatyzuje CAPTCHA ani nie odblokowuje płatnych treści. Polityka robots.txt jest sprawdzana także w tym trybie.

Sesja przeglądarki (w tym cookies logowania) i historia są lokalnie w katalogu danych użytkownika aplikacji. Aplikacja łączy się ze wskazanymi serwisami, a tryb przeglądarkowy uruchamia również ich zasoby i skrypty. Poradniki nie są wysyłane na serwer GameGuides. Ilustracje pobiera osobny klient HTTP; obrazy wymagające cookies mogą być niedostępne i trafią do raportu.

## Serwisy

| Serwis | Zakres | Weryfikacja |
| --- | --- | --- |
| IGN | `/wikis/nazwa-gry/…` | Odczyt Cyberpunk 2077 i odkrywanie linków sprawdzone na żywo |
| PowerPyx | Podana strona | STEINS;GATE RE:BOOT sprawdzony na żywo |
| Gamepressure | Wszystkie rozdziały w ścieżce gry | Strona główna Valhalli, rozdział Tips and tricks oraz odkrywanie linków sprawdzone na żywo |
| PlayStationTrophies | `/game/nazwa-gry/…` | Adapter; przykład zwracał HTTP 403 |
| Neoseeker | Ścieżka gry | Adapter, bez pełnego testu pobrania |
| StrategyWiki | Gra oraz podstrony `/wiki/Gra/…` | Adapter; test zwracał HTTP 403 |
| Samurai Gamers | Ścieżka gry | Adapter, bez pełnego testu pobrania |
| Gamer Guides | Ścieżka gry i `/guide/…` | Adapter, bez pełnego testu pobrania |
| TrueAchievements | Walkthrough danej gry | Adapter, bez pełnego testu pobrania |
| GRYOnline | Ścieżka poradnika | Adapter, bez pełnego testu pobrania |
| Steam Community | Pojedynczy poradnik | Adapter, bez pełnego testu pobrania |
| GameFAQs | Pojedynczy poradnik | Adapter, bez pełnego testu pobrania |
| Pozostałe | Pojedynczy artykuł | Uniwersalny odczyt `article`, `main`, `.entry-content`, `#content` |

Adaptery są heurystykami, zależą od układu HTML i dostępności strony. Nie oznaczają oficjalnej integracji. Materiały wideo i interaktywne mapy nie są osadzane w PDF. Ilustracje mają limit 5 MB na obraz i 160 MB łącznie. Zachowywane są źródła i informacje o autorach znajdujące się w treści. Korzystaj zgodnie z prawami do treści i zasadami wydawcy.

## Rozwój

Node.js 24 LTS oraz Windows 10/11 x64:

```powershell
npm ci
npm run icons
npm test
npm start
npm run smoke
npm run build -- --publish never
```

`npm run smoke` generuje `output/demo.pdf` i zrzut GUI. `node scripts/live-check.cjs` wykonuje jawne testy sieciowe trzech serwisów (bez pobierania całych poradników). Testy jednostkowe działają offline. Instalator i portable powstają w `dist/`. GitHub Actions buduje Windows; tag `v*` publikuje pliki w Releases.

## Architektura

Electron renderuje GUI i drukuje oczyszczony dokument do PDF. Cheerio odczytuje strukturę treści, sanitize-html usuwa aktywne elementy. Proces głównego GUI nie wykonuje zewnętrznych skryptów. Opcjonalny czytnik ma osobną sesję, izolację, brak Node.js, blokadę uprawnień, pobierania plików i nowych okien. Pobieranie HTTP weryfikuje publiczne adresy IP oraz przekierowania i przypina DNS do żądania. PDF nie pobiera zewnętrznych zasobów; obrazy są osadzone lokalnie.

Kod aplikacji: MIT. Treści poradników i znaki serwisów pozostają własnością ich autorów.
