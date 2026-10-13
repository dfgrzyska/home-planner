# Planer mieszkania – LM25

**Wersja online:** https://dfgrzyska.github.io/home-planner/

Interaktywny planer umeblowania mieszkania LM25 (budynek I, Osiedle Dębowy Park) działający w przeglądarce.
Rzut jest odwzorowany wektorowo w skali 1:1 w centymetrach na podstawie rzutu 1:100 dewelopera –
ściany, okna, drzwi, szachty, ściany do wyburzenia i balkon zgadzają się z wymiarami z karty lokalu.

## Funkcje

- **Drag & drop** mebli z katalogu na rzut (lub kliknięcie – dodaje na środek widoku).
- **Katalog ~55 elementów o standardowych wymiarach**: sofy, narożnik, łóżka 140/160/180/200, szafy,
  TV 50–85″ (szerokość liczona z przekątnej 16:9), stół rozkładany 120–220 (suwak + krzesła),
  szafki kuchenne 30–100 cm, AGD, wanna, prysznic, WC, pralka, dywany i inne.
- **Przyciąganie** do ścian i krawędzi innych mebli (Alt – wyłącza), **odległości** do najbliższych ścian/mebli,
  **wykrywanie kolizji** (czerwony obrys), **miarka** (M).
- **Ściany działowe do wyburzenia** (czerwone na rzucie) – można je „wyburzyć” w panelu.
- **Podkład z PDF** (Widok → suwak) – nakłada oryginalny rzut na wektorowy, do kontroli zgodności.
- **Autozapis w localStorage**, nazwane wersje (Projekty), eksport/import JSON.
- **Udostępnianie linkiem** – cały układ jest skompresowany w adresie (`#p=…`), bez serwera.
- Cofnij/ponów (Ctrl+Z / Ctrl+Y), skróty klawiszowe (R, Q/E, strzałki, Del, Ctrl+D, F, spacja).
- **Widok 3D** (Three.js, ładowany z CDN dopiero po przełączeniu): ściany 272 cm, obniżenie sufitu 249 cm, otwory okien
  i drzwi, meble jako bryły, gotowe ujęcia kamery, przekrój, eksport PNG. Meble można zaznaczać i przesuwać także w 3D.
- **Drzwi do konfiguracji** (kliknij drzwi na rzucie): zawiasy na drugą stronę, otwieranie do drugiego pomieszczenia,
  typ – skrzydłowe, ukryte (zlicowane ze ścianą, w kolorze ściany), przesuwne naścienne, sam otwór – i kolor skrzydła.
- **Zwierzęta**: legowiska dobrane do wagi psa (labrador 35 kg → XL 110 × 85 cm), stojak z miskami.
- **Wykończenie** (panel po prawej, gdy nic nie jest zaznaczone): kolor ścian i posadzka dla każdego pomieszczenia,
  ściana akcentowa, fronty kuchenne, blat, ramy okien, posadzka balkonu – zapisywane w projekcie i w linku.

## Fotorealistyczne wizualizacje (skill `/wizualizacja`)

Skill Claude Code w `.claude/skills/wizualizacja/` zamienia projekt w zdjęcia: ustawia wykończenie z opisu słownego,
renderuje ujęcia 3D (`tools/render3d.py`, headless Chrome/Edge) i przepuszcza je przez lokalne ComfyUI
(`tools/comfy.py`, Qwen Image Edit). Szablony workflow: `tools/workflows/`, ustawienia: `tools/config.json`
(+ `tools/config.local.json` z lokalną ścieżką do ComfyUI, poza repozytorium). Wyniki trafiają do `renders/`.

## Uruchomienie lokalne

Aplikacja to statyczne pliki (HTML + ES modules, bez builda). Moduły wymagają serwera HTTP:

```bash
python -m http.server 8123
```

i otwórz http://localhost:8123.

## GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.

## Struktura

| Plik | Zawartość |
| --- | --- |
| `js/plan.js` | geometria lokalu w cm (ściany, okna, drzwi, pomieszczenia, wymiary) + układ startowy |
| `js/catalog.js` | katalog mebli i ich standardowe wymiary/warianty |
| `js/shapes.js` | rysunki mebli (SVG) |
| `js/storage.js` | localStorage + kodowanie projektu w linku |
| `js/app.js` | edytor: renderowanie, drag & drop, przyciąganie, kolizje, panel, historia |
| `js/view3d.js`, `js/furniture3d.js` | scena 3D: ściany z kolorami pomieszczeń, okna, drzwi, posadzki, bryły mebli |
| `js/style.js`, `js/textures.js` | palety kolorów, posadzki (proceduralne tekstury), domyślne wykończenie |
| `tools/` | skrypty skilla: link ↔ JSON, render 3D, klient ComfyUI |
| `assets/plan-lm25.png` | wycinek rzutu z PDF używany jako podkład kontrolny |

Układ współrzędnych: (0, 0) to wewnętrzny narożnik ścian północnej i zachodniej (lewy górny róg przedpokoju),
x rośnie na wschód, y na południe (w stronę balkonu). Front każdego mebla jest po stronie +y w jego układzie lokalnym.
