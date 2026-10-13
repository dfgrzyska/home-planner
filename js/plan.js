// Geometria lokalu LM25 (budynek I, Dębowy Park) w centymetrach.
// Źródło: rzut 1:100 z document.pdf, zmierzony pikselowo i domknięty do wymiarów opisanych na rzucie.
// Układ współrzędnych: (0,0) = wewnętrzny narożnik ścian północnej i zachodniej (lewy górny róg przedpokoju),
// x rośnie w prawo (wschód), y w dół (południe / balkon). Prostokąty: [x, y, szerokość, wysokość].

export const PLAN = {
  id: 'LM25',
  title: 'LM25 · budynek I',
  subtitle: 'Osiedle Dębowy Park · piętro III',
  area: 63.93,
  height: 272,

  // Widok startowy (łącznie z balkonem)
  bounds: { x: -95, y: -90, w: 1075, h: 1170 },

  // Ściany konstrukcyjne / zewnętrzne (czarne na rzucie)
  walls: [
    [-25, -67, 25, 104],   // zachodnia, nad drzwiami wejściowymi
    [-25, 130, 25, 736],   // zachodnia, pod drzwiami wejściowymi
    [-25, -25, 842, 25],   // północna
    [-25, -67, 79, 42],    // północna – wysunięcie (klatka)
    [304, -67, 74, 42],    // północna – wysunięcie (szacht)
    [771, -67, 46, 225],   // wschodnia
    [771, 267, 46, 212],
    [771, 588, 46, 323],
    [-72, 866, 140, 45],   // południowa
    [179, 866, 269, 45],
    [736, 866, 81, 45],
    [321, 0, 57, 37],      // szacht przy łazience
    [172, 304, 41, 47],    // szacht w łazience
    [291, 476, 78, 53],    // szacht przy aneksie
  ],

  // Elementy budynku poza lokalem (szare)
  context: [
    [-72, 144, 47, 25],
    [-72, 269, 47, 82],
    [-30, 911, 35, 153],   // ścianka boczna balkonu
    [817, 7, 140, 9],      // ścianka balkonu od północy
    [174, -67, 12, 42],
  ],

  // Ściany nierozbieralne ograniczające łazienkę
  bathWalls: [
    [172, 0, 12, 112],
    [172, 190, 12, 114],
    [363, 37, 15, 314],
    [213, 342, 165, 9],
  ],

  // Ściany działowe możliwe do demontażu (czerwone na rzucie)
  partitions: [
    { id: 'p3', name: 'Pokój 3 ↔ salon', rects: [[378, 290, 61, 9], [520, 290, 251, 9]], door: 'd4' },
    { id: 'p2h', name: 'Pokój 2 ↔ przedpokój', rects: [[0, 478, 72, 8], [155, 478, 136, 8]], door: 'd3' },
    { id: 'p2k', name: 'Pokój 2 ↔ aneks', rects: [[293, 529, 10, 337]] },
  ],

  // Okna / drzwi balkonowe: prostokąt otworu w ścianie + podziały
  windows: [
    { rect: [771, 158, 46, 109] },
    { rect: [771, 479, 46, 109] },
    { rect: [68, 866, 111, 45] },
    { rect: [448, 866, 288, 45], mullions: [627], label: 'wyjście na balkon' },
  ],

  // Drzwi: zawias, promień, kąt skrzydła otwartego (open) i zamkniętego (closed) w stopniach (0 = +x, 90 = +y)
  doors: [
    { id: 'd1', hinge: [0, 37], r: 90, open: 0, closed: 90, entry: true },
    { id: 'd2', hinge: [172, 190], r: 78, open: 180, closed: 270 },
    { id: 'd3', hinge: [72, 486], r: 82, open: 90, closed: 0 },
    { id: 'd4', hinge: [439, 290], r: 80, open: 270, closed: 0 },
  ],

  balcony: {
    area: 25.70,
    rects: [[5, 911, 951, 141], [817, 16, 139, 895]],
    railing: [[956, 16, 5, 1041], [5, 1052, 956, 5]],
    label: [70, 950],
  },

  // Pomieszczenia: numer, nazwa, powierzchnia z karty lokalu, pozycja etykiety, obrys podłogi
  rooms: [
    { n: 1, name: 'Pokój z aneksem kuchennym', area: 24.94, label: [610, 715] },
    { n: 2, name: 'Pokój', area: 11.13, label: [146, 690] },
    { n: 3, name: 'Pokój', area: 11.40, label: [575, 150] },
    { n: 4, name: 'Łazienka', area: 5.77, label: [242, 160] },
    { n: 5, name: 'Przedpokój', area: 10.69, label: [80, 175] },
  ],

  // Cała podłoga lokalu (do wypełnienia tła)
  floor: [[0, 0, 771, 866]],

  // Obniżenie sufitu h = 2,49 m
  soffit: { rect: [0, 299, 771, 50], label: 'h = 2,49 m' },

  // Wymiary opisane na rzucie: [x1, y1, x2, y2, etykieta]
  dims: [
    [0, 149, 172, 149, '172'],
    [184, 120, 363, 120, '179'],
    [378, 149, 771, 149, '393'],
    [734, 0, 734, 290, '290'],
    [297, 0, 297, 342, '342'],
    [128, 0, 128, 478, '479'],
    [0, 392, 378, 392, '380'],
    [378, 392, 771, 392, '395'],
    [423, 299, 423, 349, '50'],
    [423, 349, 423, 476, '123'],
    [423, 476, 423, 529, '54'],
    [423, 529, 423, 866, '339'],
    [734, 299, 734, 866, '567'],
    [128, 486, 128, 866, '380'],
    [0, 823, 293, 823, '293'],
    [303, 823, 771, 823, '468'],
  ],

  // Podkład z PDF (wycinek rzutu) dopasowany do układu współrzędnych
  overlay: { href: 'assets/plan-lm25.png', x: -126.4, y: -94.8, w: 1158.96, h: 1211.64 },
};

// Układ startowy = umeblowanie narysowane na rzucie dewelopera
export const DEFAULT_ITEMS = [
  { t: 'wardrobe_built', x: 30, y: 345, r: 270, w: 258, d: 60 },
  { t: 'k_base', x: 333, y: 549, r: 270, w: 40, d: 60 },
  { t: 'k_hob', x: 333, y: 599, r: 270, w: 60, d: 60 },
  { t: 'k_base', x: 333, y: 659, r: 270, w: 60, d: 60 },
  { t: 'k_sink', x: 333, y: 729, r: 270, w: 80, d: 60 },
  { t: 'k_dishwasher', x: 333, y: 799, r: 270, w: 60, d: 60 },
  { t: 'k_base', x: 333, y: 846, r: 270, w: 30, d: 60 },
  { t: 'bath', x: 288, y: 306, r: 180, w: 150, d: 70 },
  { t: 'wc', x: 242, y: 28, r: 0, w: 38, d: 55 },
  { t: 'washer', x: 333, y: 67, r: 90, w: 60, d: 60 },
  { t: 'washbasin', x: 340, y: 166, r: 90, w: 60, d: 45 },
  { t: 'tv_stand', x: 609, y: 317, r: 0, w: 120, d: 35 },
  { t: 'tv', x: 609, y: 312, r: 0, w: 124, d: 8, v: 1 },
  { t: 'sofa3', x: 596, y: 605, r: 180, w: 210, d: 90 },
  { t: 'coffee_table', x: 598, y: 525, r: 0, w: 90, d: 60 },
];
