# Weryfikacja lokalna 1.2.1 — 2026-11-02

- 45 testów jednostkowych: zaliczone.
- `scripts/ui-check.cjs`: UI_CHECK_OK; lokalny test interfejsu i eksportu PDF.
- `scripts/file-assets-check.cjs`: FILE_ASSETS_CHECK_OK; dwuklatkowy GIF zamieniony na pierwszą klatkę z linkiem, dwie ilustracje odczytane z PDF po usunięciu plików źródłowych. Cache sharp wyłączony w teście, aby nie trzymał uchwytów plików w Windows.
- Standardowy start deweloperski z `--smoke`: SMOKE_OK.
- Instalator NSIS i portable x64: zbudowane w `dist/`, bez publikacji.

Nie ponawiano testów wszystkich serwisów w sieci ani ręcznej instalacji. Dotychczasowe raporty sieciowe dotyczą wcześniejszych prób. Tryb `--smoke` wymaga drzewa źródeł i pliku testowego; nie działa wewnątrz gotowego pakietu aplikacji. Pliki wydania nie mają podpisu cyfrowego.
