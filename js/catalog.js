// Katalog elementów o standardowych wymiarach (cm).
// w = szerokość (wzdłuż ściany), d = głębokość. Front elementu jest po stronie +y (dół w układzie lokalnym).
// layer: 0 = dywan (pod meblami), 1 = mebel stojący, 2 = element na ścianie / na blacie (np. TV, szafki wiszące).

const tvWidth = (inch) => Math.round(inch * 2.54 * 16 / Math.sqrt(337) + 2);
const tv = (inch) => ({ l: `${inch}"  (${tvWidth(inch)} cm)`, w: tvWidth(inch), d: 8 });

export const CATEGORIES = [
  { id: 'salon', name: 'Salon' },
  { id: 'jadalnia', name: 'Jadalnia' },
  { id: 'sypialnia', name: 'Sypialnia' },
  { id: 'kuchnia', name: 'Kuchnia' },
  { id: 'lazienka', name: 'Łazienka' },
  { id: 'przedpokoj', name: 'Przedpokój' },
  { id: 'biuro', name: 'Gabinet / dziecko' },
  { id: 'balkon', name: 'Balkon' },
  { id: 'zwierzeta', name: 'Zwierzęta' },
  { id: 'inne', name: 'Inne' },
];

export const CATALOG = [
  // Salon
  { key: 'sofa3', name: 'Sofa 3-osobowa', cat: 'salon', kind: 'sofa', w: 210, d: 90,
    variants: [{ l: '190 × 90', w: 190, d: 90 }, { l: '210 × 90', w: 210, d: 90 }, { l: '230 × 95', w: 230, d: 95 }] },
  { key: 'sofa2', name: 'Sofa 2-osobowa', cat: 'salon', kind: 'sofa', w: 160, d: 88 },
  { key: 'sofa_l', name: 'Narożnik prawy', hint: 'szezlong po prawej, patrząc na front', cat: 'salon', kind: 'sofa_l', w: 260, d: 170,
    variants: [{ l: '240 × 160', w: 240, d: 160 }, { l: '260 × 170', w: 260, d: 170 }, { l: '280 × 180', w: 280, d: 180 }, { l: '300 × 200', w: 300, d: 200 }],
    opts: { mirror: false } },
  { key: 'sofa_l_left', name: 'Narożnik lewy', hint: 'szezlong po lewej, patrząc na front', cat: 'salon', kind: 'sofa_l', w: 260, d: 170,
    variants: [{ l: '240 × 160', w: 240, d: 160 }, { l: '260 × 170', w: 260, d: 170 }, { l: '280 × 180', w: 280, d: 180 }, { l: '300 × 200', w: 300, d: 200 }],
    opts: { mirror: true } },
  { key: 'armchair', name: 'Fotel', cat: 'salon', kind: 'armchair', w: 80, d: 80 },
  { key: 'coffee_table', name: 'Stolik kawowy', cat: 'salon', kind: 'table', w: 100, d: 60,
    variants: [{ l: '90 × 60', w: 90, d: 60 }, { l: '100 × 60', w: 100, d: 60 }, { l: '120 × 70', w: 120, d: 70 }] },
  { key: 'coffee_round', name: 'Stolik okrągły', cat: 'salon', kind: 'round', w: 80, d: 80, square: true,
    variants: [{ l: 'Ø 60', w: 60, d: 60 }, { l: 'Ø 80', w: 80, d: 80 }, { l: 'Ø 90', w: 90, d: 90 }] },
  { key: 'tv', name: 'Telewizor', cat: 'salon', kind: 'tv', w: tvWidth(55), d: 8, layer: 2,
    variants: [tv(50), tv(55), tv(65), tv(75), tv(85)], defaultVariant: 1 },
  { key: 'tv_stand', name: 'Szafka RTV', cat: 'salon', kind: 'cabinet', w: 180, d: 40,
    variants: [{ l: '120 × 40', w: 120, d: 40 }, { l: '160 × 40', w: 160, d: 40 }, { l: '180 × 40', w: 180, d: 40 }, { l: '200 × 40', w: 200, d: 40 }] },
  { key: 'bookshelf', name: 'Regał', cat: 'salon', kind: 'shelf', w: 80, d: 35,
    range: { min: 40, max: 240, step: 10, label: 'Szerokość' } },
  { key: 'sideboard', name: 'Komoda', cat: 'salon', kind: 'cabinet', w: 150, d: 45,
    variants: [{ l: '120 × 45', w: 120, d: 45 }, { l: '150 × 45', w: 150, d: 45 }, { l: '180 × 45', w: 180, d: 45 }] },

  // Jadalnia
  { key: 'table_ext', name: 'Stół rozkładany 120–220', cat: 'jadalnia', kind: 'table', w: 120, d: 80,
    range: { min: 120, max: 220, step: 10, label: 'Długość (złożony 120, rozłożony 220)', base: 120 },
    opts: { chairs: true } },
  { key: 'table_ext2', name: 'Stół rozkładany 160–260', cat: 'jadalnia', kind: 'table', w: 160, d: 90,
    range: { min: 160, max: 260, step: 10, label: 'Długość (złożony 160, rozłożony 260)', base: 160 },
    opts: { chairs: true } },
  { key: 'table_rect', name: 'Stół prostokątny', cat: 'jadalnia', kind: 'table', w: 140, d: 80,
    variants: [{ l: '120 × 80', w: 120, d: 80 }, { l: '140 × 80', w: 140, d: 80 }, { l: '160 × 90', w: 160, d: 90 }, { l: '180 × 90', w: 180, d: 90 }],
    opts: { chairs: true } },
  { key: 'table_round', name: 'Stół okrągły', cat: 'jadalnia', kind: 'round', w: 100, d: 100, square: true,
    variants: [{ l: 'Ø 90', w: 90, d: 90 }, { l: 'Ø 100', w: 100, d: 100 }, { l: 'Ø 120', w: 120, d: 120 }],
    opts: { chairs: true } },
  { key: 'chair', name: 'Krzesło', cat: 'jadalnia', kind: 'chair', w: 45, d: 50 },
  { key: 'stool', name: 'Hoker', cat: 'jadalnia', kind: 'stool', w: 40, d: 40 },

  // Sypialnia
  { key: 'bed', name: 'Łóżko podwójne', cat: 'sypialnia', kind: 'bed', w: 170, d: 210,
    variants: [{ l: 'materac 140 × 200', w: 150, d: 210 }, { l: 'materac 160 × 200', w: 170, d: 210 }, { l: 'materac 180 × 200', w: 190, d: 210 }, { l: 'materac 200 × 200', w: 210, d: 210 }],
    defaultVariant: 1 },
  { key: 'bed_single', name: 'Łóżko pojedyncze', cat: 'sypialnia', kind: 'bed', w: 100, d: 210,
    variants: [{ l: 'materac 80 × 200', w: 90, d: 210 }, { l: 'materac 90 × 200', w: 100, d: 210 }, { l: 'materac 120 × 200', w: 130, d: 210 }],
    defaultVariant: 1 },
  { key: 'nightstand', name: 'Szafka nocna', cat: 'sypialnia', kind: 'nightstand', w: 50, d: 40 },
  { key: 'wardrobe', name: 'Szafa', cat: 'sypialnia', kind: 'wardrobe', w: 150, d: 60,
    variants: [{ l: '2-drzwiowa 100 × 60', w: 100, d: 60 }, { l: '3-drzwiowa 150 × 60', w: 150, d: 60 }, { l: 'przesuwna 200 × 65', w: 200, d: 65 }, { l: 'przesuwna 250 × 65', w: 250, d: 65 }],
    defaultVariant: 1 },
  { key: 'dresser', name: 'Komoda z szufladami', cat: 'sypialnia', kind: 'cabinet', w: 120, d: 45 },
  { key: 'vanity', name: 'Toaletka', cat: 'sypialnia', kind: 'desk', w: 100, d: 45 },

  // Kuchnia
  { key: 'k_base', name: 'Szafka dolna', cat: 'kuchnia', kind: 'k_base', w: 60, d: 60,
    variants: [30, 40, 45, 50, 60, 80, 90, 100].map((w) => ({ l: `${w} cm`, w, d: 60 })), defaultVariant: 4 },
  { key: 'k_corner', name: 'Szafka narożna', cat: 'kuchnia', kind: 'k_corner', w: 90, d: 90,
    variants: [{ l: '90 × 90', w: 90, d: 90 }, { l: '100 × 100', w: 100, d: 100 }], opts: { mirror: false } },
  { key: 'k_sink', name: 'Szafka ze zlewem', cat: 'kuchnia', kind: 'k_sink', w: 80, d: 60,
    variants: [{ l: '60 cm', w: 60, d: 60 }, { l: '80 cm', w: 80, d: 60 }, { l: '100 cm (z ociekaczem)', w: 100, d: 60 }], defaultVariant: 1 },
  { key: 'k_hob', name: 'Płyta grzewcza + szafka', cat: 'kuchnia', kind: 'k_hob', w: 60, d: 60,
    variants: [{ l: '60 cm', w: 60, d: 60 }, { l: '80 cm', w: 80, d: 60 }] },
  { key: 'k_oven', name: 'Słupek z piekarnikiem', cat: 'kuchnia', kind: 'k_oven', w: 60, d: 60 },
  { key: 'k_fridge', name: 'Lodówka', cat: 'kuchnia', kind: 'k_fridge', w: 60, d: 65,
    variants: [{ l: 'wolnostojąca 60 × 65', w: 60, d: 65 }, { l: 'do zabudowy 60 × 60', w: 60, d: 60 }, { l: 'side-by-side 91 × 72', w: 91, d: 72 }] },
  { key: 'k_dishwasher', name: 'Zmywarka', cat: 'kuchnia', kind: 'k_appliance', w: 60, d: 60, mark: 'ZM',
    variants: [{ l: '45 cm', w: 45, d: 60 }, { l: '60 cm', w: 60, d: 60 }], defaultVariant: 1 },
  { key: 'k_wall', name: 'Szafka wisząca', cat: 'kuchnia', kind: 'k_wall', w: 60, d: 35, layer: 2,
    variants: [30, 40, 45, 50, 60, 80, 90, 100].map((w) => ({ l: `${w} cm`, w, d: 35 })), defaultVariant: 4 },
  { key: 'k_island', name: 'Wyspa / półwysep', cat: 'kuchnia', kind: 'k_island', w: 120, d: 90,
    range: { min: 80, max: 240, step: 10, label: 'Długość' } },

  // Łazienka
  { key: 'bath', name: 'Wanna', cat: 'lazienka', kind: 'bath', w: 170, d: 75,
    variants: [{ l: '150 × 70', w: 150, d: 70 }, { l: '160 × 70', w: 160, d: 70 }, { l: '170 × 75', w: 170, d: 75 }, { l: '180 × 80', w: 180, d: 80 }] },
  { key: 'shower', name: 'Kabina prysznicowa', cat: 'lazienka', kind: 'shower', w: 90, d: 90,
    variants: [{ l: '80 × 80', w: 80, d: 80 }, { l: '90 × 90', w: 90, d: 90 }, { l: '120 × 80', w: 120, d: 80 }, { l: '120 × 90', w: 120, d: 90 }, { l: '140 × 90', w: 140, d: 90 }],
    defaultVariant: 1 },
  { key: 'washbasin', name: 'Umywalka z szafką', cat: 'lazienka', kind: 'washbasin', w: 60, d: 45,
    variants: [{ l: '50 × 40', w: 50, d: 40 }, { l: '60 × 45', w: 60, d: 45 }, { l: '80 × 45', w: 80, d: 45 }, { l: 'podwójna 120 × 45', w: 120, d: 45 }], defaultVariant: 1 },
  { key: 'wc', name: 'WC', cat: 'lazienka', kind: 'wc', w: 38, d: 55,
    variants: [{ l: 'podwieszane 36 × 53', w: 36, d: 53 }, { l: 'kompakt 38 × 65', w: 38, d: 65 }] },
  { key: 'washer', name: 'Pralka', cat: 'lazienka', kind: 'washer', w: 60, d: 60,
    variants: [{ l: 'standard 60 × 60', w: 60, d: 60 }, { l: 'slim 60 × 45', w: 60, d: 45 }] },
  { key: 'dryer', name: 'Suszarka', cat: 'lazienka', kind: 'washer', w: 60, d: 60 },
  { key: 'bath_cabinet', name: 'Szafka / słupek łazienkowy', cat: 'lazienka', kind: 'cabinet', w: 40, d: 30 },

  // Przedpokój
  { key: 'wardrobe_built', name: 'Szafa wnękowa', cat: 'przedpokoj', kind: 'wardrobe', w: 200, d: 60,
    range: { min: 60, max: 300, step: 1, label: 'Długość' } },
  { key: 'shoe_cabinet', name: 'Szafka na buty', cat: 'przedpokoj', kind: 'cabinet', w: 80, d: 35 },
  { key: 'bench', name: 'Ławka', cat: 'przedpokoj', kind: 'bench', w: 100, d: 40 },
  { key: 'coat_rack', name: 'Wieszak stojący', cat: 'przedpokoj', kind: 'round', w: 45, d: 45, square: true },

  // Gabinet / dziecko
  { key: 'desk', name: 'Biurko', cat: 'biuro', kind: 'desk', w: 120, d: 60,
    variants: [{ l: '100 × 55', w: 100, d: 55 }, { l: '120 × 60', w: 120, d: 60 }, { l: '140 × 70', w: 140, d: 70 }, { l: '160 × 80', w: 160, d: 80 }], defaultVariant: 1 },
  { key: 'office_chair', name: 'Krzesło biurowe', cat: 'biuro', kind: 'office_chair', w: 60, d: 60 },
  { key: 'crib', name: 'Łóżeczko dziecięce', cat: 'biuro', kind: 'crib', w: 66, d: 126,
    variants: [{ l: '60 × 120', w: 66, d: 126 }, { l: '70 × 140', w: 76, d: 146 }] },
  { key: 'changing', name: 'Komoda z przewijakiem', cat: 'biuro', kind: 'cabinet', w: 100, d: 50 },

  // Balkon
  { key: 'b_table', name: 'Stolik balkonowy', cat: 'balkon', kind: 'round', w: 70, d: 70, square: true },
  { key: 'b_chair', name: 'Krzesło balkonowe', cat: 'balkon', kind: 'chair', w: 50, d: 55 },
  { key: 'lounger', name: 'Leżak', cat: 'balkon', kind: 'lounger', w: 65, d: 190 },
  { key: 'b_sofa', name: 'Sofa ogrodowa', cat: 'balkon', kind: 'sofa', w: 150, d: 70 },
  { key: 'planter', name: 'Donica', cat: 'balkon', kind: 'plant', w: 80, d: 30 },

  // Zwierzęta – legowisko dobierane do psa: długość ≈ długość psa leżącego na boku (nos–nasada ogona) + 15–20 cm.
  // Labrador 35 kg ≈ 95–105 cm → 110 × 85 cm (XL).
  { key: 'dog_bed', name: 'Legowisko dla psa', hint: 'labrador 35 kg → XL 110 × 85', cat: 'zwierzeta', kind: 'pet_bed', w: 110, d: 85,
    variants: [
      { l: 'L 100 × 70 – pies do 25 kg', w: 100, d: 70 },
      { l: 'XL 110 × 85 – labrador 30–38 kg (zalecane)', w: 110, d: 85 },
      { l: 'XXL 120 × 95 – dla psa, który lubi się rozciągać', w: 120, d: 95 },
      { l: 'XXXL 140 × 105 – pies 40 kg+', w: 140, d: 105 },
    ], defaultVariant: 1 },
  { key: 'dog_bed_round', name: 'Legowisko okrągłe', hint: 'labrador 35 kg → Ø 110', cat: 'zwierzeta', kind: 'pet_bed_round', w: 110, d: 110, square: true,
    variants: [{ l: 'Ø 90 – pies do 25 kg', w: 90, d: 90 }, { l: 'Ø 110 – labrador 30–38 kg (zalecane)', w: 110, d: 110 }, { l: 'Ø 120', w: 120, d: 120 }],
    defaultVariant: 1 },
  { key: 'dog_bowls', name: 'Stojak z miskami', cat: 'zwierzeta', kind: 'pet_bowls', w: 50, d: 28 },

  // Inne
  { key: 'rug', name: 'Dywan', cat: 'inne', kind: 'rug', w: 160, d: 230, layer: 0,
    variants: [{ l: '120 × 170', w: 120, d: 170 }, { l: '160 × 230', w: 160, d: 230 }, { l: '200 × 300', w: 200, d: 300 }, { l: '240 × 340', w: 240, d: 340 }],
    defaultVariant: 1 },
  { key: 'rug_round', name: 'Dywan okrągły', cat: 'inne', kind: 'rug_round', w: 160, d: 160, layer: 0, square: true,
    variants: [{ l: 'Ø 120', w: 120, d: 120 }, { l: 'Ø 160', w: 160, d: 160 }, { l: 'Ø 200', w: 200, d: 200 }] },
  { key: 'plant', name: 'Roślina', cat: 'inne', kind: 'plant', w: 45, d: 45, square: true },
  { key: 'lamp', name: 'Lampa podłogowa', cat: 'inne', kind: 'lamp', w: 35, d: 35, square: true },
  { key: 'radiator', name: 'Grzejnik', cat: 'inne', kind: 'radiator', w: 80, d: 10, layer: 2 },
  { key: 'custom', name: 'Własny element', cat: 'inne', kind: 'box', w: 100, d: 50 },
];

export const CATALOG_BY_KEY = Object.fromEntries(CATALOG.map((c) => [c.key, c]));
