// Sprite, portrait and effect sheets loaded at boot (see js/sheet.js).
// A listed file that doesn't exist yet is skipped; its key keeps the older art.
window.CT = window.CT || {};
CT.SHEET_FILES = [
  // party and guests
  'crono', 'frog', 'ayla', 'magus', 'marle', 'lucca', 'robo',
  // Sir Cyrus (armoured Warden; unarmoured human form) and Spekkio's Frog King shape
  'cyrus', 'cyrus_human', 'frog_king',
  // enemies and bosses (echo_<key> sprites are derived from these)
  'imp', 'mud_imp', 'green_imp', 'stone_imp', 'lizardactyl', 'avian_rex', 'azala', 'ozzie', 'flea', 'slash',
  'goon', 'prophet', 'curator_p2', 'lavos_sprout', 'lavos_sprout_large',
  // story characters
  'guard', 'king', 'leene', 'kino', 'elder', 'gaspar', 'nu', 'fairgoer', 'fairgoer_b', 'fairgoer_c', 'fairgoer_d',
  'villager_600', 'villager_600_b', 'villager_600_c', 'villager_ioka', 'villager_ioka_b', 'villager_ioka_c',
  'villager_last', 'villager_last_b', 'villager_last_c',
  // props
  'epoch', 'lavos_seed', 'lavos_seed_inert', 'time_gate', 'hollow_gate',
  // dialogue portraits: the original game's, and the recast cast's
  'portraits_ct', 'portraits_recast',
  // effects
  'fx_crono', 'fx_frog', 'fx_ayla', 'fx_magus', 'fx_allies', 'fx_enemies', 'fx_duals',
];
