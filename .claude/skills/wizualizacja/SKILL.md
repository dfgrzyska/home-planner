---
name: wizualizacja
description: Fotorealistyczne wizualizacje mieszkania LM25 z planera home-planner. Ustawia wykończenie według opisu użytkownika (kolory ścian, posadzki, fronty kuchenne, blat, kolory mebli), zachowując układ z planera, renderuje ujęcia 3D i zamienia je w zdjęcia przez lokalne ComfyUI (Qwen Image Edit). Użyj, gdy użytkownik prosi o wizualizację, render, „jak to będzie wyglądać”, zmianę wystroju / kolorów w 3D albo podaje link z planera (#p=...) z opisem wykończenia.
---

# Wizualizacja mieszkania z planera

Wejście od użytkownika:
- **link z planera** (przycisk „Udostępnij link”, zawiera `#p=...`) – bez niego użyj układu startowego (`DEFAULT_ITEMS` z `js/plan.js`) i powiedz o tym;
- **opis wykończenia** w dowolnej formie („salon szałwia, podłoga jodełka, fronty butelkowa zieleń, sofa grafitowa”);
- opcjonalnie: które ujęcia, ile wariantów, zdjęcie inspiracji (tylko workflow `qwen-image-2.1`).

Wszystkie polecenia uruchamiaj z katalogu repozytorium. Skrypty korzystają wyłącznie z biblioteki standardowej Pythona.

## 1. Odczytaj projekt

```bash
mkdir -p renders/<folder>
python tools/hp_link.py decode "<link>" > renders/<folder>/projekt.json
```

Folder wyników: `renders/<RRRR-MM-DD-GGMM>-<krótki-opis>/` (katalog `renders/` jest w `.gitignore`).

## 2. Ustaw wykończenie – układ zostaw nietknięty

Zmieniaj **tylko** `style` oraz kolory mebli (`items[].c`). Nie ruszaj `x`, `y`, `r`, `w`, `d`, `t`, `demo`.

`style` (walidowane przez `normalizeStyle` w `js/style.js`):

| pole | wartości |
| --- | --- |
| `walls` | `{"1".."5": "#rrggbb"}` – 1 salon z aneksem, 2 pokój 2, 3 pokój 3, 4 łazienka, 5 przedpokój |
| `floors` | `{"1".."5": klucz}` – `oak_light`, `oak_natural`, `walnut`, `oak_herringbone`, `oak_grey`, `tile_light`, `tile_grey`, `tile_large`, `concrete`, `terrazzo` |
| `balcony` | `deck`, `balcony_tile` (lub dowolny klucz posadzki) |
| `kitchenFront` | `#rrggbb` |
| `counter` | `oak`, `white_quartz`, `black_stone`, `concrete`, `marble` |
| `frames` | `anthracite`, `white`, `black` (ramy okien) |
| `accent` | opcjonalnie `{"room": "1", "side": "n"/"s"/"e"/"w", "color": "#rrggbb"}` – ściana akcentowa (n = od klatki, s = od balkonu, e = wschodnia z oknami, w = zachodnia) |

Nazwy kolorów z palety aplikacji (`WALL_PALETTE`, `FRONTS` w `js/style.js`) – użyj ich, gdy pasują do opisu, inaczej dobierz hex sam.
Kolor mebla: `c` w elemencie (sofa – tkanina, stół/szafki – materiał frontu/blatu, dywan – kolor dywanu). Typy elementów: `t` (klucze z `js/catalog.js`).

Zapisz zmieniony JSON i zbuduj nowy link, który otworzy projekt od razu w 3D:

```bash
python tools/hp_link.py encode renders/<folder>/projekt.json --extra "v=3d&cam=salon_balcony"
```

Daj użytkownikowi ten link – może obejrzeć wnętrze w przeglądarce i dalej edytować.

## 3. Render 3D wybranych ujęć

```bash
python tools/render3d.py --doc renders/<folder>/projekt.json --cams salon_balcony,kitchen,room2,room3 --out renders/<folder>
```

Ujęcia: `top` (makieta z góry), `salon_balcony`, `salon_entry`, `kitchen`, `room2`, `room3`, `bath`, `hall`.
Domyślnie 2–4 ujęcia z pomieszczeń, o które pytał użytkownik (`top` nie nadaje się do fotorealizmu).
Skrypt sam stawia lokalny serwer z repozytorium i używa headless Chrome/Edge; wynik: `<ujęcie>_3d.png`.
Obejrzyj rendery (Read) zanim pójdziesz dalej – jeśli coś zasłania kadr (mebel tuż przed kamerą), powiedz o tym albo wybierz inne ujęcie.

## 4. Fotorealizm przez ComfyUI

Sprawdź serwer i modele:

```bash
python tools/comfy.py --check
```

- kod wyjścia 2 (`COMFY_OFFLINE`): ComfyUI nie działa. Katalog instalacji jest w `tools/config.local.json` (`comfy_dir`). Zapytaj użytkownika, czy je uruchomić; po zgodzie uruchom w tle
  `cd <comfy_dir> && ./python_embeded/python.exe -s ComfyUI/main.py --windows-standalone-build --disable-auto-launch`
  i ponawiaj `--check` co kilka sekund (start trwa do ~1 min). Jeśli port 8188 jest zajęty, ComfyUI już działa – nie uruchamiaj drugiego.
- kod wyjścia 3: brakuje modeli/węzłów dla workflow – pokaż listę i zaproponuj workflow `qwen-edit-gguf` albo instalację.

Dla każdego renderu napisz prompt **po angielsku** (Qwen rozumie go najlepiej) do `renders/<folder>/<ujęcie>_prompt.txt` według wzoru:

```
Transform this 3D render into a photorealistic interior photograph of a modern apartment. Keep exactly the same camera angle, room geometry, walls, ceiling, windows and doors, and keep every piece of furniture in the same position, size and shape. Do not add or remove furniture.
Materials: walls painted in <kolor ścian widocznego pomieszczenia> matte paint; floor is <posadzka>; <fronty, blat, AGD – tylko jeśli kuchnia w kadrze>; <kolory i materiały widocznych mebli>; white ceiling.
<styl / dodatki z opisu użytkownika, np. "add a few green plants and linen curtains" – tylko jeśli prosił>
Soft natural daylight from the windows, realistic soft shadows and reflections, fine material textures, professional architectural interior photography, 24mm lens, high detail.
```

Opisuj tylko to, co widać w danym ujęciu (kolor ścian właściwego pomieszczenia!). Dekoracji nie dodawaj, chyba że użytkownik prosi.

```bash
python tools/comfy.py --image renders/<folder>/kitchen_3d.png --prompt-file renders/<folder>/kitchen_prompt.txt --out renders/<folder>/kitchen_photo.png [--count 2] [--workflow qwen-image-2.1 --ref inspiracja.jpg]
```

- Czas: ok. 5 min na obraz z `qwen-edit-gguf` (20B, RTX 5060 Ti) – uruchamiaj w tle, gdy ujęć jest kilka, i informuj użytkownika o postępie.
- `--count N` daje N wariantów z różnymi seedami; `--seed` pozwala powtórzyć wynik.
- `--ref` (obraz inspiracji) działa tylko z `qwen-image-2.1`.

## 5. Oddaj wyniki

Pokaż użytkownikowi pary render 3D → zdjęcie (SendUserFile, `_photo.png` najważniejsze), link do projektu z kroku 2 i krótko: co ustawiono, na czym model się pomylił (np. zmienił kształt mebla, dodał dekorację) i co można poprawić (inne ujęcie, więcej wariantów, doprecyzowanie promptu).

## Modele i workflow

Szablony w `tools/workflows/*.json` (format API ComfyUI, pola `{{IMAGE}}`, `{{PROMPT}}`, `{{NEGATIVE}}`, `{{SEED}}`, `{{REF}}`). Domyślny workflow i adres serwera: `tools/config.json`, lokalne nadpisania: `tools/config.local.json`.

- `qwen-edit-gguf` – Qwen-Image-Edit (sierpień 2025, GGUF Q5) – zainstalowany, przetestowany.
- `qwen-image-2.1` – Qwen-Image 2.1 (wrzesień 2026, 7B, szybszy, przyjmuje obrazy referencyjne). Wymaga aktualizacji ComfyUI i modeli z `huggingface.co/Comfy-Org/Qwen-Image-2.1`; szablon odtworzony z oficjalnego workflow – przy pierwszym użyciu sprawdź `--check` i ewentualnie popraw nazwy wejść według `/object_info`.
