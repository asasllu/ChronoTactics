// Hand-pixelled sprite and effect sheets loaded at boot (see js/sheet.js).
// A listed file that doesn't exist yet is skipped; its key keeps the older art.
window.CT = window.CT || {};
CT.SHEET_FILES = [
  // party and allies
  'crono', 'frog', 'ayla', 'magus', 'iselle', 'iselle_broken', 'knight', 'dave', 'mat', 'spekkio',
  // enemies and bosses
  'imp', 'hench', 'kilwala', 'nu', 'roundillo', 'seedbearer',
  'tyrano', 'lavos_sprout', 'lavos_sprout_large', 'vitrine', 'curator_p1', 'curator_p2',
  // story characters
  'guard', 'king', 'leene', 'kino', 'elder', 'gaspar', 'fairgoer', 'fairgoer_b', 'fairgoer_c', 'fairgoer_d',
  'marle', 'lucca', 'robo',
  'villager_600', 'villager_600_b', 'villager_600_c', 'villager_ioka', 'villager_ioka_b', 'villager_ioka_c',
  'villager_last', 'villager_last_b', 'villager_last_c',
  // props
  'epoch', 'lavos_seed', 'lavos_seed_inert', 'time_gate', 'hollow_gate',
  // effects
  'fx_crono', 'fx_frog', 'fx_ayla', 'fx_magus', 'fx_allies', 'fx_enemies', 'fx_duals',
];
