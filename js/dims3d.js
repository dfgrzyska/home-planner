// Wysokości mebli w 3D (cm) i wysokość montażu elementów naściennych – bez zależności od Three.js,
// żeby panel 2D mógł je pokazywać.

// Domyślne wysokości (cm) – można nadpisać w elemencie (it.h)
export const H_BY_KEY = {
  tv_stand: 50, sideboard: 85, dresser: 85, shoe_cabinet: 100, changing: 95, bath_cabinet: 180,
  bookshelf: 200, wardrobe: 220, wardrobe_built: 255, coffee_table: 42, coffee_round: 45, b_table: 72,
  coat_rack: 180, vanity: 75, nightstand: 50, k_wall: 72, k_oven: 215, k_fridge: 185, radiator: 60,
  planter: 45, plant: 130, lamp: 165, custom: 75, desk: 75, bench: 45, k_island: 90,
};
export const H_BY_KIND = {
  bed: 105, crib: 95, sofa: 85, sofa_l: 85, armchair: 85, table: 76, round: 76, chair: 90, stool: 65,
  office_chair: 110, tv: 0, cabinet: 85, shelf: 200, wardrobe: 220, desk: 75, bench: 45,
  k_base: 90, k_corner: 90, k_sink: 90, k_hob: 90, k_oven: 215, k_fridge: 185, k_appliance: 90, k_wall: 72, k_island: 90,
  bath: 55, shower: 200, washbasin: 85, wc: 40, washer: 85, lounger: 45, plant: 60, lamp: 165, rug: 1, rug_round: 1, radiator: 60, box: 75,
};
// Montaż od podłogi dla elementów na ścianie
export const E_BY_KIND = { tv: 75, k_wall: 145, radiator: 15 };

export const heightOf = (it, def) =>
  it.h ?? (def.kind === 'tv' ? Math.round(it.w * 0.5625 + 2) : H_BY_KEY[def.key] ?? H_BY_KIND[def.kind] ?? 75);
export const elevationOf = (it, def) => it.e ?? E_BY_KIND[def.kind] ?? 0;

