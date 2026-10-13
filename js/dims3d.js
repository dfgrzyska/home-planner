// Wysokości mebli w 3D (cm) i wysokość montażu elementów naściennych – bez zależności od Three.js,
// żeby panel 2D mógł je pokazywać.

// Domyślne wysokości (cm) – można nadpisać w elemencie (it.h)
export const H_BY_KEY = {
  tv_stand: 50, sideboard: 85, dresser: 85, shoe_cabinet: 100, changing: 95, bath_cabinet: 180,
  bookshelf: 200, wardrobe: 220, wardrobe_built: 255, coffee_table: 42, coffee_round: 45, b_table: 72,
  coat_rack: 180, vanity: 75, nightstand: 50, k_wall: 72, k_oven: 215, k_fridge: 185, radiator: 60,
  planter: 45, plant: 130, hue_signe_floor: 145, hue_play_floor: 135, hue_signe_table: 55, hue_play_table: 60, hue_strip_vertical: 200,
  pl_monstera: 120, pl_fikus: 170, pl_strelicja: 160, pl_oliwka: 150, pl_kentia: 180, pl_sansewieria: 80, pl_zamiokulkas: 70,
  pl_storczyk: 50, pl_bukiet: 50, pl_ziola: 25, pl_lawenda: 45, lamele_wall: 270, lamele_tv: 270, lamele_half: 110, lamele_partition: 272, lamp: 165, custom: 75, desk: 75, bench: 45, k_island: 90,
};
export const H_BY_KIND = {
  bed: 105, crib: 95, sofa: 85, sofa_l: 85, armchair: 85, table: 76, round: 76, chair: 90, stool: 65,
  office_chair: 110, tv: 0, cabinet: 85, shelf: 200, wardrobe: 220, desk: 75, bench: 45,
  k_base: 90, k_corner: 90, k_sink: 90, k_hob: 90, k_oven: 215, k_fridge: 185, k_appliance: 90, k_wall: 72, k_island: 90,
  bath: 55, shower: 200, washbasin: 85, wc: 40, washer: 85, lounger: 45, plant: 60, lamp: 165, rug: 1, rug_round: 1, radiator: 60, box: 75,
  slats: 270, slat_partition: 272, led_strip: 1.5, led_strip_v: 200, light_tube: 5, light_bar: 25, signe: 145, iris: 19, go: 15, bloom: 10, twilight: 28,
  pendant: 28, being: 6, ceiling_round: 10, ceiling_panel: 5, centris: 10, downlight: 2, string_lights: 3, plant3: 100, pet_bed: 22, pet_bed_round: 22, pet_bowls: 30,
};
// Montaż od podłogi dla elementów na ścianie
export const E_BY_KIND = {
  tv: 75, k_wall: 145, radiator: 15, led_strip: 230, led_strip_v: 20, light_tube: 52, light_bar: 52, signe: 0, iris: 50, go: 50, bloom: 0, twilight: 50,
  pendant: 150, being: 165, ceiling_round: 262, ceiling_panel: 267, centris: 262, downlight: 270, string_lights: 210, plant3: 0,
};
const E_BY_KEY = { hue_signe_table: 85, hue_play_table: 85, pl_storczyk: 76, pl_bukiet: 76, pl_ziola: 85 };

export const heightOf = (it, def) =>
  it.h ?? (def.kind === 'tv' ? Math.round(it.w * 0.5625 + 2) : H_BY_KEY[def.key] ?? H_BY_KIND[def.kind] ?? 75);
export const elevationOf = (it, def) => it.e ?? E_BY_KEY[def.key] ?? E_BY_KIND[def.kind] ?? 0;

