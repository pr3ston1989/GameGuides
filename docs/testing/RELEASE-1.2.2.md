# Weryfikacja 1.2.2 — 2026-11-04

Zmiany wspólnego silnika: trzy równoległe pobrania stron HTTP, cztery ilustracje, kompresja gzip/deflate/Brotli, minimalny odstęp stron 250 ms. Kolejka odstępów działa osobno dla każdego źródła i zachowuje crawl-delay. Odczyt przeglądarkowy jest serializowany. Kolejność odpowiedzi HTTP nie zmienia kolejności rozdziałów. Nawigacja źródła ma pierwszeństwo przed przypadkowymi odsyłaczami; indeksy działów są rozwijane w miejscu. Brak kompletnego spisu w źródle pozostaje ograniczeniem.

## Wyniki

- 51 testów jednostkowych: zaliczone, w tym równoległość, kolejność poza IGN, hierarchia indeksów i ograniczenie rozmiaru rozpakowanej odpowiedzi HTTP.
- UI_CHECK_OK, FILE_ASSETS_CHECK_OK, BATCH_PDF_OK (42 strony, 80 linków offline, 40 zakładek) i SMOKE_OK.
- Próby sieciowe pojedynczych stron: IGN Horizon Walkthrough 760 ms, Gamepressure GreedFall 735 ms, PowerPyx Horizon 1225 ms. Czasy są pojedynczym pomiarem, a nie benchmarkiem pełnego pobierania.
- Pełny eksport zapisanej lokalnej sesji Horizon Forbidden West z IGN: 351 rozdziałów, 3354 osadzenia ilustracji, 2561 stron PDF, zero ostrzeżeń eksportu. Przygotowanie z cache: 18,074 s; tworzenie i łączenie PDF: 29,054 s; razem 47,128 s. Plik: 457 514 165 bajtów. Niezależny odczyt pierwszych i ostatniej strony oraz 162 linków spisu potwierdził dostępność celów, w tym ostatniego rozdziału.

Pomiar pełnego eksportu nie obejmuje pobierania stron ani ilustracji z internetu. Nie gwarantuje wykonania dowolnego poradnika w określonym czasie. Nie ponowiono pełnych testów sieciowych wszystkich adapterów ani ręcznej instalacji.

Duże dokumenty są drukowane partiami i łączone. Przygotowanie JPEG zapobiega rozrastaniu się fotograficznych ilustracji do ogromnych nieskompresowanych strumieni PDF. Poprzednia próba z WebP zakończyła się brakiem pamięci przy łączeniu; końcowy test JPEG zachował wszystkie ilustracje. Mapy oznaczone przez adapter nie są zmniejszane. Limit obrazów pozostaje 512 MB.
