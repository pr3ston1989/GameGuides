# Raport testów GameGuides 1.1.0

Data: 2 listopada 2026.

## Zakres i metoda

Sprawdzono katalogi 20 serwisów. W 16 serwisach odczytano po dwie wylosowane strony. Dobór: ranking SHA-256(seed + URL), seed gameguides-2026-11-02-v2, pierwsze dwa adresy z katalogu po odfiltrowaniu stron platform, roczników i linków niebędących poradnikami. To ograniczona próba, nie gwarancja działania całych serwisów. Katalogi IGN, Game8, Neoseeker i Steam dotyczyły jednej gry; inne obejmowały wiele gier. Wiki mogą zawierać krótkie strony startowe.

Skorygowano adresy katalogów Gamepressure, GRYOnline, GamesRadar+ i Game8 po pierwszej próbie. Dla Neoseeker użyto spisu poradnika zamiast strony głównej. W StrategyWiki wykluczono platformy i roczniki przed ponownym losowaniem. PlayStationTrophies, Neoseeker i StrategyWiki testowano dodatkowo w przeglądarce po odmowach HTTP. Dokładne adresy i pomiary: [samples.json](samples.json).

## Wyniki

- 32 PDF, łącznie 338 stron, wszystkie wyrenderowane do podglądów.
- Dla każdego dostępnego serwisu jeden eksport z włączonym pobieraniem ilustracji i drugi bez obrazów.
- Tekst poza granicami strony: 0 przypadków.
- Uszkodzone odsyłacze wewnętrzne: 0 z 299 sprawdzonych.
- Minimalna zgodność zbioru słów z odczytanym HTML: 98.89%. Różnice obejmują łamanie słów i elementy wideo. Wskaźnik nie zastępuje oceny wizualnej.
- GreedFall: 163 rozdziały, 425 stron PDF, 0 adresów w kolejce, 0 uwag. Pełny poradnik testowano bez ilustracji.
- Cały PDF GreedFall: 0 wyjść poza stronę, 0 błędnych odsyłaczy z 5494. Wizualnie sprawdzono strony 1, 2, 5, 12, 40, 80, 160, 240, 320, 400, 425.
- GUI: 16 scenariuszy, wynik poprawny. Eksport, wymiary PDF, linki, kolejność, filtr, wznowienie, anulowanie, błędny URL, uszkodzone obrazy i układ 920 px.

## Serwisy

| Serwis | Odczyt próby | Tryb | Przykłady |
|---|---|---|---|
| Eurogamer | 2/2 | http | [The Blood of Dawnwalker best route walkthrough](<https://www.eurogamer.net/the-blood-of-dawnwalker-best-route-walkthrough>); [Control Resonant The Last Taxi walkthrough](<https://www.eurogamer.net/control-resonant-the-last-taxi-locations-puzzle-solutions>) |
| Game8 | 2/2 | http | [All Dexterity (Dex) Weapons List / Elden Ring｜Game8](<https://game8.co/games/Elden-Ring/archives/378552>); [Parry Ash of War Location and Effect / Elden Ring｜Game8](<https://game8.co/games/Elden-Ring/archives/370519>) |
| GameFAQs | 0/2 | http | HTTP 403: serwis odmówił dostępu lub strona nie istnieje. |
| Gamepressure | 2/2 | http | [GreedFall Guide](<https://www.gamepressure.com/greedfall/>); [Expedition 33 Guide](<https://www.gamepressure.com/clair-obscur-expedition-33/>) |
| Gamer Guides | 2/2 | http | [Gwent in Novigrad](<https://www.gamerguides.com/the-witcher-3-wild-hunt/guide/gwent/card-locations/gwent-in-novigrad>); [Settlement Levels & Buildings](<https://www.gamerguides.com/assassins-creed-valhalla/guide/settlement/settlement-guide/settlement-levels-and-buildings>) |
| GamesRadar+ | 2/2 | http | [Anime Galaxies codes (October 2026) for Gems, Trait Crystals, and more](<https://www.gamesradar.com/games/strategy/anime-galaxies-codes/>); [Anime Expeditions codes (October 2026) for free rerolls, gems, and more](<https://www.gamesradar.com/games/strategy/anime-expeditions-codes/>) |
| GRYOnline | 2/2 | http | [AC Black Flag Resynced - poradnik do gry](<https://www.gry-online.pl/poradniki/assassins-creed-black-flag-resynced/>); [Indiana Jones Great Circle - poradnik do gry](<https://www.gry-online.pl/poradniki/indiana-jones-and-the-great-circle/>) |
| IGN | 2/2 | http | [Ronin's Set](<https://www.ign.com/wikis/elden-ring/Ronin%27s_Set>); [Monk's Flamemace](<https://www.ign.com/wikis/elden-ring/Monk%27s_Flamemace>) |
| Neoseeker | 2/2 | browser | [Pinabby](<https://www.neoseeker.com/clair-obscur-expedition-33/Pinabby>); [Boss: Grosse Tète](<https://www.neoseeker.com/clair-obscur-expedition-33/Grosse_Tete>) |
| Nintendo Life | 2/2 | http | [Hyrule Warriors: Age Of Imprisonment: All Playable Characters & How To Unlock Them](<https://www.nintendolife.com/guides/hyrule-warriors-age-of-imprisonment-all-playable-characters-and-how-to-unlock-them>); [Pokémon Legends: Z-A: Pokédex - All Lumiose Pokémon Locations & Evolutions](<https://www.nintendolife.com/guides/pokemon-legends-z-a-pokedex-all-lumiose-pokemon-locations-and-evolutions>) |
| PC Gamer | 2/2 | http | [My full guide to Subnautica 2 after surviving the perils of an alien water planet](<https://www.pcgamer.com/games/survival-crafting/subnautica-2-guide/>); [All active Blue Lock Rivals codes in November 2026 and how to redeem them](<https://www.pcgamer.com/games/roblox/blue-lock-rivals-codes/>) |
| PlayStationTrophies | 2/2 | browser | [007 First Light Trophy Guide](<https://www.playstationtrophies.org/game/project-007-working-title/guide/>); [Mafia III: Definitive Edition Trophy Guide](<https://www.playstationtrophies.org/game/mafia-3/guide/>) |
| PowerPyx | 2/2 | http | [Red Dead Redemption 1 (PS5/PS4) Trophy Guide & Roadmap](<https://www.powerpyx.com/red-dead-redemption-1-ps5-ps4-trophy-guide-roadmap/>); [Dragon’s Dogma 2 Trophy Guide & Roadmap](<https://www.powerpyx.com/dragons-dogma-2-trophy-guide-roadmap/>) |
| PSNProfiles | 0/2 | http | HTTP 403: serwis odmówił dostępu lub strona nie istnieje. |
| Push Square | 2/2 | http | [Stellar Blade: Spire 4 Walkthrough - Cans, Design Patterns, Beta Cores, Body Cores, Exospines, Passcodes, Camps](<https://www.pushsquare.com/guides/stellar-blade-spire-4-walkthrough-cans-design-patterns-beta-cores-body-cores-exospines-passcodes-camps>); [Stellar Blade: All Butterflies in the Wasteland Locations](<https://www.pushsquare.com/guides/stellar-blade-all-butterflies-in-the-wasteland-locations>) |
| RPG Site | 0/2 | http | Nie można sprawdzić robots.txt: HTTP 500: serwis odmówił dostępu lub strona nie istnieje. |
| Samurai Gamers | 2/2 | http | [Dragon Quest 3 HD-2D Remake - Slime Earrings Accessory Guide: Stats and Effects](<https://samurai-gamers.com/dragon-quest-3-remake/dq3re-slime-earrings-accessory-guide/>); [Metaphor: ReFantazio - Does Demo Progress Carry Over?](<https://samurai-gamers.com/metaphor-refantazio/metaphor-does-demo-progress-carry-over/>) |
| Steam Community | 2/2 | http | [Steam Community :: Guide :: Steam Deck: Best settings for sexy stable 30 FPS](<https://steamcommunity.com/sharedfiles/filedetails/?id=2804069465>); [Steam Community :: Guide :: Melina](<https://steamcommunity.com/sharedfiles/filedetails/?id=3831381063>) |
| StrategyWiki | 2/2 | browser | [Tetris](<https://strategywiki.org/wiki/Tetris>); [ARMS](<https://strategywiki.org/wiki/ARMS>) |
| TrueAchievements | 0/2 | http | Nie można sprawdzić robots.txt: HTTP 403: serwis odmówił dostępu lub strona nie istnieje. |

## Poprawki wynikające z testów

1. Nintendo Life: przywrócone tabele i galerie w aside. Pokédex: 195 → około 1408 słów.
2. Game8: treść poradnika zamiast okna członkostwa, przywrócone statystyki i tabele.
3. PlayStationTrophies: roadmap oraz wszystkie opisy trofeów i DLC. 007 First Light: 651 → 4958 słów; Mafia III: 2378 → 12365 słów.
4. IGN: przywrócone obrazy zastąpione przez przezroczyste piksele, wyłącznie dla widocznych miejsc na zdjęcia.
5. Indeksy działów są zachowywane, a nie zgłaszane jako błędy. Szerokie tabele mają większą kolumnę nazw.
6. Usunięte dodatki reklamowe, udostępnianie, duplikaty noscript i karty ocen gry. Uszkodzone obrazy są raportowane.
7. Security check/CAPTCHA nie są poradnikami. Dodano automatyczne przełączenie na normalną przeglądarkę.
8. Zapis postępu, ponowienie błędnych stron, zachowanie kolejności, cache obrazów, historia, ustawienia papieru i tekstu.

## Ograniczenia

GameFAQs, PSNProfiles i TrueAchievements blokowały dostęp; RPG Site zwracało błąd podczas sprawdzania robots.txt. Nie oznaczono ich jako zweryfikowanych. Tryb przeglądarkowy może działać przejściowo i wymagać ręcznej weryfikacji. Game8: tekst działał, ale serwer ilustracji blokował sprawdzenie robots.txt; 17 brakujących obrazów trafiło do raportu. Jedna próbka Steam była krótkim wpisem społecznościowym, a ARMS w StrategyWiki krótką stroną startową; aplikacja ostrzega o małej ilości treści. Zgodność z widocznym HTML nie gwarantuje odkrycia stron niepodlinkowanych, płatnych ani niedostępnych.

Szczegóły: [PDF](pdf.json), [pełny poradnik](full-guide.json), [GUI](ui.json), [próby przeglądarkowe](browser.json).
