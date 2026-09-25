// Boot, input routing and the top-level game flow
// (title → story scenes → credits, plus Continue, Skirmish and debug jumps).
(function () {
  const CT = window.CT;
  const UI = CT.UI;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search + '&' + location.hash.slice(1));

  // Test / debug switches: ?debug, ?test (fast + auto-advance), ?autoplay (AI plays the party).
  CT.DEBUG = params.has('debug') || params.has('test');
  if (params.has('test')) {
    CT.FAST = true;
    UI.autoAdvance = true;
    CT.AUTOFACE = true;
    CT.AUTOFIELD = true;
    // Story choices: first option; defeat: retry; other menus: the last (Leave/Cancel/Done).
    UI.autoChoose = (items, opts) => {
      const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
      if (!enabled.length) return null;
      if (opts.cls && opts.cls.includes('choice')) return enabled[+(params.get('choice') || 0) % enabled.length];
      if (opts.cls === 'defeat') return 0;
      if (opts.cls === 'title-menu') return null; // stay on the title when a test run finishes
      // Shops: buy the first affordable gear upgrade, then leave (like a real player would).
      if (opts.cls === 'shop') {
        const gear = enabled.find((i) => items[i].value && items[i].value.gear);
        if (gear != null) return gear;
      }
      return enabled[enabled.length - 1];
    };
    window.TEST_LOG = [];
  }
  if (params.has('autoplay')) CT.AUTOPLAY = true;
  if (params.has('fast')) CT.FAST = true;

  const cv = $('cv');
  const renderer = new CT.Renderer(cv);
  CT.renderer = renderer;
  CT.input = { field: null };

  // ---- Layout & render loop -----------------------------------------------------
  function fit() {
    const s = Math.min(window.innerWidth / 960, window.innerHeight / 600);
    $('stage').style.transform = `scale(${s}) translate(-50%, -50%)`;
  }
  window.addEventListener('resize', fit);
  fit();

  const ui0 = { grid: false };
  let last = performance.now();
  function loop(now) {
    const ctl = CT.activeBattle;
    try {
      renderer.draw(ctl ? ctl.ui : ui0, now);
    } catch (e) {
      console.error(e);
    }
    if (CT.game) CT.game.playtime += (now - last) / 1000;
    last = now;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---- Input -------------------------------------------------------------------------
  function mousePos(e) {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height];
  }
  cv.addEventListener('mousemove', (e) => {
    const ctl = CT.activeBattle;
    if (!ctl) return;
    const [mx, my] = mousePos(e);
    const t = renderer.pick(mx, my);
    if (t !== ctl.ui.hover) ctl.onHover(t);
  });
  cv.addEventListener('mouseleave', () => CT.activeBattle && CT.activeBattle.onHover(null));
  cv.addEventListener('click', (e) => {
    CT.audio && CT.audio.unlock();
    if (UI.dlgAdvance) return UI.dlgAdvance();
    if (UI.modalOpen() && !CT.activeBattle) return;
    const [mx, my] = mousePos(e);
    const t = renderer.pick(mx, my);
    if (CT.activeBattle) CT.activeBattle.onClick(t, mx, my);
    else if (CT.input.field) CT.input.field.click(t);
  });
  cv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (CT.activeBattle) CT.activeBattle.cancel();
  });
  window.addEventListener('keydown', (e) => {
    CT.audio && CT.audio.unlock();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) e.preventDefault();
    if (UI.handleKey(e)) return;
    if (e.key === 'q' || e.key === 'Q') return (renderer.rot = renderer.rot + 3);
    if (e.key === 'e' || e.key === 'E') return (renderer.rot = renderer.rot + 1);
    if (CT.activeBattle && CT.activeBattle.onKey(e)) return;
    if (CT.input.field) CT.input.field.key(e);
  });
  document.addEventListener('pointerdown', () => CT.audio && CT.audio.unlock(), { once: false });

  // ---- Flow ----------------------------------------------------------------------------
  let scene = null;
  function newScene(game) {
    CT.game = game;
    scene = new CT.Scene(renderer, game);
    CT.scene = scene;
    if (CT.audio) CT.audio.setVolume({ music: game.settings.music, sfx: game.settings.sfx });
    return scene;
  }

  async function playStory(start, resume) {
    let next = { goto: start, resume };
    while (next) {
      if (next.goto) {
        const r = await scene.play(next.goto, { resume: next.resume });
        next = r;
      } else if (next.credits) {
        next = await scene.credits();
      } else if (next.load) {
        const slot = await UI.slotMenu('load');
        const g = slot && CT.Game.load(slot);
        if (!g) return;
        newScene(g);
        next = { goto: g.resume.scene, resume: g.resume };
      } else break;
    }
  }

  async function titleBackdrop() {
    const mapId = CT.MAPS.leene_square ? 'leene_square' : 'zenan';
    const map = CT.prepareMap({ id: mapId, ...CT.MAPS[mapId] });
    renderer.setWorld({ map, units: [], active: null });
    renderer.focusMap(true);
    renderer.fade = 0;
    if (CT.audio) CT.audio.playMusic('mus_title');
  }

  async function skirmish() {
    const g = new CT.Game();
    for (const id of CT.SKIRMISH.partyOverride) {
      g.members[id] = g.newMember(id, CT.SKIRMISH.level);
    }
    g.setParty(CT.SKIRMISH.partyOverride);
    g.inventory = { tonic: 5, mid_tonic: 3, ether: 3, revive: 2 };
    const prev = CT.game;
    const sc = new CT.Scene(renderer, g);
    CT.game = g;
    sc.loadMap(CT.SKIRMISH.map);
    UI.banner('Skirmish: Zenan Riverbank', 1800);
    const res = await CT.runBattle(CT.SKIRMISH, sc, { game: g, noRewards: true });
    if (res === 'victory') await UI.popup('<div class="res-title">VICTORY!</div>The Zenan riverbank holds.');
    CT.game = prev;
  }

  async function debugJump() {
    const items = [
      ...Object.entries(CT.SCENES || {}).map(([id, s]) => ({ label: `Scene ${id}`, note: s.title || s.map, value: { scene: id } })),
      ...Object.keys(CT.BATTLES || {}).map((id) => ({ label: `Battle ${id}`, note: CT.BATTLES[id].name || '', value: { battle: id } })),
    ];
    const r = await UI.menu(items, { title: 'Debug jump', cls: 'debug-list' });
    if (!r) return;
    const g = new CT.Game();
    newScene(g);
    const lvl = +(params.get('level') || 0);
    const ch = r.scene ? parseInt(r.scene, 10) : parseInt((r.battle || 'B0').replace(/\D/g, '') || '0', 10);
    const party = ch >= 3 || /^B[3-5]/.test(r.battle || '') || (r.scene || '').startsWith('4') ? ['crono', 'frog', 'ayla', 'magus'] : ch >= 2 ? ['crono', 'frog', 'ayla'] : ['crono', 'frog'];
    const level = lvl || [2, 6, 11, 16, 22, 22][Math.min(5, ch)];
    for (const id of Object.keys(g.members)) g.members[id] = g.newMember(id, level);
    g.setParty(party);
    for (const t of ['x_strike', 'shadow_cyclone', 'ice_water']) if (ch >= 3 || t === 'x_strike') g.unlock(t);
    g.inventory = { tonic: 6, mid_tonic: 4, ether: 4, revive: 3, shelter: 1 };
    g.gold = 3000;
    for (let i = 1; i <= Math.min(4, ch + 1); i++) g.flags[`ch${i}_open`] = true;
    if (r.scene) return playStory(r.scene);
    const def = CT.BATTLES[r.battle];
    scene.loadMap(def.map);
    if (def.guests || /^B4/.test(r.battle)) g.guests = ['iselle'];
    await CT.runBattle(r.battle, scene);
  }

  async function boot() {
    try {
      const s = JSON.parse(localStorage.getItem('ct_hollow_settings') || 'null');
      if (s && CT.audio) CT.audio.setVolume(s);
    } catch (e) {}
    await CT.loadAssets();
    $('loading').remove();
    if (window.TEST_SCENES) CT.SCENES = Object.assign(CT.SCENES || {}, window.TEST_SCENES);
    if (window.TEST_BATTLES) CT.BATTLES = Object.assign(CT.BATTLES || {}, window.TEST_BATTLES);
    if (params.has('sim')) {
      window.SIM_READY = true;
      return;
    }
    if (params.get('scene') || params.get('battle')) {
      // Direct entry for testing: ?scene=1.2 or ?battle=B1
      const g = new CT.Game();
      newScene(g);
      if (params.get('scene')) await playStory(params.get('scene'));
    }
    for (;;) {
      await titleBackdrop();
      const choice = await UI.title();
      UI.hideTitle();
      if (choice === 'new') {
        newScene(new CT.Game());
        await playStory(CT.STORY_START || '0.2');
      } else if (choice === 'continue') {
        const slot = await UI.slotMenu('load');
        const g = slot && CT.Game.load(slot);
        if (g) {
          newScene(g);
          await playStory(g.resume.scene, g.resume);
        }
      } else if (choice === 'skirmish') await skirmish();
      else if (choice === 'options') await UI.options();
      else if (choice === 'debug') await debugJump();
      UI.clearMenus();
      UI.battleHud(false);
      UI.hint('');
      UI.prompt('');
    }
  }
  CT.boot = boot;
  CT.playStory = (id) => {
    newScene(CT.game || new CT.Game());
    return playStory(id);
  };
  boot().catch((e) => {
    console.error(e);
    const l = $('loading');
    if (l) l.textContent = 'Error: ' + e.message;
  });
})();
