// Game controller: turn flow, player input, menus and animation sequencing.
(function () {
  const CT = window.CT;
  const $ = (id) => document.getElementById(id);

  const cv = $('cv');
  const renderer = new CT.Renderer(cv);
  let battle = null;
  const ui = { mode: 'title', highlights: null, hover: null, path: null };
  let endTurn = null; // resolver for the current player turn

  // ---- Layout ----------------------------------------------------------------
  function fit() {
    const s = Math.min(window.innerWidth / 960, window.innerHeight / 600);
    $('stage').style.transform = `scale(${s}) translate(-50%, -50%)`;
  }
  window.addEventListener('resize', fit);
  fit();

  function loop(now) {
    renderer.draw(battle, ui, now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---- Small async helpers -------------------------------------------------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function tween(ms, fn) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        fn(k);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  let bannerTimer = null;
  function banner(text, ms = 1100) {
    const b = $('banner');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(bannerTimer);
    if (ms) bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
  }

  // ---- Panels ----------------------------------------------------------------
  function unitPanel(el, u, extra = '') {
    if (!u) return el.classList.add('hidden');
    el.classList.remove('hidden');
    const hpPct = (u.hp / u.maxHp) * 100;
    const mpPct = u.maxMp ? (u.mp / u.maxMp) * 100 : 0;
    const t = battle.tile(u.x, u.y);
    el.innerHTML = `
      <img class="portrait" src="${CT.portrait(u.key)}">
      <div class="info">
        <div class="name"><span class="team${u.team}">${u.name}</span></div>
        <div class="bar-row"><b>HP</b><div class="bar hp"><i style="width:${hpPct}%"></i></div><span>${u.hp}/${u.maxHp}</span></div>
        <div class="bar-row"><b>MP</b><div class="bar mp"><i style="width:${mpPct}%"></i></div><span>${u.mp}/${u.maxMp}</span></div>
        <div class="stats">Mv${u.move} Jp${u.jump} Sp${u.spd} CT${Math.min(100, u.ct)}</div>
        <div class="stats">${u.weapon} &middot; H${t.h} ${CT.TERRAIN_INFO[t.t].name}</div>
        ${extra}
      </div>`;
  }

  function tilePanel(el, t) {
    el.classList.remove('hidden');
    el.innerHTML = `<div class="info"><div class="name">${CT.TERRAIN_INFO[t.t].name}</div>
      <div class="stats">Height ${t.h} &middot; (${t.x},${t.y})</div>
      <div class="stats">${CT.TERRAIN_INFO[t.t].walk ? 'Passable' : CT.TERRAIN_INFO[t.t].swim ? 'Only swimmers may enter' : 'Blocked'}</div></div>`;
  }

  function refreshTurns() {
    if (!battle) return;
    const list = (battle.active ? [battle.active] : []).concat(battle.predictOrder(battle.active ? 7 : 8));
    $('turns').innerHTML =
      '<h3>TURN ORDER</h3>' +
      list.map((u) => `<div class="turn t${u.team}"><img src="${CT.portrait(u.key)}">${u.name}</div>`).join('');
  }

  function refreshPanels() {
    unitPanel($('active'), battle.active && battle.active.alive ? battle.active : null);
    refreshHover();
    refreshTurns();
  }

  function refreshHover() {
    const el = $('target');
    const t = ui.hover;
    if (!battle || !t) return el.classList.add('hidden');
    const v = battle.unitAt(t.x, t.y);
    let extra = '';
    if (ui.mode === 'target' && ui.aoe && ui.aoe.has(`${t.x},${t.y}`)) {
      const u = battle.active;
      const hits = battle.affected(u, ui.action, ui.center);
      if (v && hits.includes(v)) {
        const p = battle.preview(u, u, ui.action, v);
        extra =
          p.kind === 'heal'
            ? `<div class="preview heal">Heal +${p.amount}</div>`
            : `<div class="preview">Dmg ${p.amount} &middot; Hit ${p.hit}%${p.side && p.side !== 'front' ? ' &middot; ' + p.side.toUpperCase() : ''}</div>`;
      }
    }
    if (v) unitPanel(el, v, extra);
    else tilePanel(el, t);
  }

  // ---- Menus -----------------------------------------------------------------
  function showMenu(kind = 'main') {
    const u = battle.active;
    const m = $('menu');
    m.classList.remove('hidden');
    m.innerHTML = '';
    const add = (label, fn, disabled, note) => {
      const b = document.createElement('button');
      b.innerHTML = label + (note ? `<small>${note}</small>` : '');
      b.disabled = !!disabled;
      b.onclick = (e) => {
        e.stopPropagation();
        fn();
      };
      m.appendChild(b);
    };
    if (kind === 'main') {
      add('Move', startMove, battle.moved);
      add('Attack', () => startTarget(battle.actionOf(u)), battle.acted);
      add('Tech', () => showMenu('tech'), battle.acted || !u.techs.length);
      add('Wait', finishTurn);
    } else {
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = 'TECH';
      m.appendChild(title);
      for (const k of u.techs) {
        const tech = CT.TECHS[k];
        add(tech.name, () => startTarget(battle.actionOf(u, k)), tech.mp > u.mp, `${tech.mp}MP`);
      }
      add('Back', () => showMenu('main'));
    }
    ui.mode = kind === 'main' ? 'menu' : 'techmenu';
    ui.highlights = null;
    ui.path = null;
    ui.aoe = null;
  }
  function hideMenu() {
    $('menu').classList.add('hidden');
  }

  function backToMenu() {
    if (battle.moved && battle.acted) return finishTurn();
    showMenu('main');
    refreshPanels();
  }

  // ---- Player: move ---------------------------------------------------------
  function startMove() {
    const u = battle.active;
    ui.mode = 'move';
    ui.reach = battle.reachable(u);
    ui.highlights = new Map([...ui.reach.keys()].map((k) => [k, 'move']));
    hideMenu();
    updatePathPreview();
  }

  function updatePathPreview() {
    ui.path = null;
    if (ui.mode !== 'move' || !ui.hover) return;
    const node = ui.reach.get(`${ui.hover.x},${ui.hover.y}`);
    if (node) ui.path = new Set(battle.pathTo(node).map((p) => `${p.x},${p.y}`));
  }

  async function moveAlong(u, path) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const ha = renderer.tileHeight(battle.tile(a.x, a.y));
      const hb = renderer.tileHeight(battle.tile(b.x, b.y));
      u.face = CT.dirTo(a.x, a.y, b.x, b.y);
      const jump = Math.abs(hb - ha) >= 1;
      await tween(jump ? 260 : 150, (k) => {
        u.rx = a.x + (b.x - a.x) * k;
        u.ry = a.y + (b.y - a.y) * k;
        u.rh = ha + (hb - ha) * k + Math.sin(k * Math.PI) * (jump ? 0.9 : 0.15);
      });
      u.x = b.x;
      u.y = b.y;
    }
    u.rx = u.x;
    u.ry = u.y;
    u.rh = renderer.tileHeight(battle.tile(u.x, u.y));
  }

  // ---- Player: target -------------------------------------------------------
  function startTarget(action) {
    const u = battle.active;
    ui.mode = 'target';
    ui.action = action;
    ui.range = new Set(battle.tilesInRange(u, action).map((t) => `${t.x},${t.y}`));
    ui.center = null;
    ui.aoe = null;
    hideMenu();
    // Self-centred techs (Cyclone, Laser Spin) preview immediately.
    if (action.range[1] === 0) ui.hover = battle.tile(u.x, u.y);
    updateTargetPreview();
  }

  function updateTargetPreview() {
    const h = ui.hover;
    ui.highlights = new Map([...ui.range].map((k) => [k, 'range']));
    ui.center = null;
    ui.aoe = null;
    if (h && ui.range.has(`${h.x},${h.y}`)) {
      ui.center = { x: h.x, y: h.y };
      ui.aoe = new Set(battle.aoeTiles(h, ui.action).map((t) => `${t.x},${t.y}`));
      for (const k of ui.aoe) ui.highlights.set(k, 'aoe');
    }
  }

  // ---- Shared action animation ----------------------------------------------
  async function performAction(u, action, center) {
    if (center.x !== u.x || center.y !== u.y) u.face = CT.dirTo(u.x, u.y, center.x, center.y);
    if (!action.isAttack) {
      banner(`${u.name}: ${action.name}`, 1200);
      // Charge-up glow.
      await tween(380, (k) => (u.flash = 0.6 * Math.sin(k * Math.PI * 3) ** 2));
      u.flash = 0;
    }

    const hitsBefore = battle.affected(u, action, center);
    if (action.isAttack && action.proj) {
      const from = renderer.project(u.x, u.y, u.rh + 1.3);
      const to = renderer.project(center.x, center.y, renderer.tileHeight(battle.tile(center.x, center.y)) + 1.2);
      const dur = 120 + 50 * (Math.abs(u.x - center.x) + Math.abs(u.y - center.y));
      renderer.projectile(from, to, action.proj, dur);
      await wait(dur);
    } else if (action.isAttack || action.stat === 'atk') {
      const [dx, dy] = CT.DIRS[CT.dirTo(u.x, u.y, center.x, center.y)];
      const reach = center.x === u.x && center.y === u.y ? 0 : 0.35;
      await tween(110, (k) => {
        u.ox = dx * reach * k;
        u.oy = dy * reach * k;
      });
    }

    for (const t of battle.aoeTiles(center, action)) {
      if (!action.isAttack || hitsBefore.length) renderer.burst(t.x, t.y, renderer.tileHeight(t), action.aoe || !action.isAttack ? action.elem : 'hit');
    }
    const results = battle.execute(u, action, center);
    for (const r of results) {
      if (r.miss) renderer.floatText(r.target, 'MISS', '#c0c8ff');
      else if (r.heal !== undefined) renderer.floatText(r.target, `+${r.heal}`, '#80ff90');
      else {
        renderer.floatText(r.target, `${r.dmg}`, r.side === 'back' ? '#ffb040' : '#ffffff');
        r.target.flash = 1;
      }
    }
    await tween(160, (k) => {
      u.ox *= 1 - k;
      u.oy *= 1 - k;
      for (const r of results) if (r.dmg) r.target.flash = Math.floor(k * 6) % 2 ? 0 : 1;
    });
    u.ox = u.oy = 0;
    for (const r of results) r.target.flash = 0;
    refreshPanels();

    const kos = results.filter((r) => r.ko).map((r) => r.target);
    if (kos.length) {
      await wait(250);
      for (const v of kos) renderer.floatText(v, 'KO', '#ff6060');
      await tween(600, (k) => kos.forEach((v) => (v.alpha = 1 - k)));
    }
    await wait(350);
  }

  // ---- Turn flow -------------------------------------------------------------
  function finishTurn() {
    hideMenu();
    ui.mode = 'busy';
    ui.highlights = null;
    ui.path = null;
    if (endTurn) {
      const r = endTurn;
      endTurn = null;
      r();
    }
  }

  function playerTurn(u) {
    return new Promise((resolve) => {
      endTurn = resolve;
      showMenu('main');
      refreshPanels();
    });
  }

  async function aiTurn(u) {
    ui.mode = 'busy';
    await wait(450);
    const plan = battle.planAI(u);
    if (plan.dest && (plan.dest.x !== u.x || plan.dest.y !== u.y)) {
      const reach = battle.reachable(u);
      ui.highlights = new Map([...reach.keys()].map((k) => [k, 'move']));
      await wait(450);
      ui.highlights = null;
      await moveAlong(u, battle.pathTo(plan.dest));
      battle.moved = true;
      refreshPanels();
      await wait(150);
    }
    if (plan.action) {
      ui.highlights = new Map(battle.aoeTiles(plan.target, plan.action).map((t) => [`${t.x},${t.y}`, 'aoe']));
      await wait(500);
      ui.highlights = null;
      await performAction(u, plan.action, plan.target);
    } else {
      // Face the nearest foe before waiting.
      const foes = battle.living(1 - u.team);
      if (foes.length) {
        foes.sort((a, b) => Math.abs(a.x - u.x) + Math.abs(a.y - u.y) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
        u.face = CT.dirTo(u.x, u.y, foes[0].x, foes[0].y);
      }
      await wait(250);
    }
  }

  async function runBattle() {
    battle = new CT.Battle(CT.MAP, CT.ROSTER);
    renderer.floaters = [];
    renderer.particles = [];
    $('turns').classList.remove('hidden');
    refreshTurns();
    banner(`Battle: ${CT.MAP.name}`, 1600);
    await wait(1400);

    while (!battle.outcome()) {
      const u = battle.nextActor();
      battle.beginTurn(u);
      refreshPanels();
      banner(`${u.name}'s turn`, 900);
      if (u.team === 0) await playerTurn(u);
      else await aiTurn(u);
      battle.endTurn();
      refreshTurns();
    }
    hideMenu();
    $('active').classList.add('hidden');
    await wait(500);
    showEnd(battle.outcome());
  }

  // ---- Overlays ------------------------------------------------------------
  function overlay(html, onClick) {
    const o = $('overlay');
    o.innerHTML = html;
    o.classList.add('show');
    o.onclick = () => {
      o.classList.remove('show');
      o.onclick = null;
      onClick();
    };
  }

  function showTitle() {
    const party = ['crono', 'marle', 'lucca', 'frog', 'robo', 'ayla'].map((k) => `<img src="${CT.portrait(k)}">`).join('');
    const foes = ['magus', 'ozzie', 'slash', 'flea', 'hench'].map((k) => `<img src="${CT.portrait(k)}">`).join('');
    $('turns').classList.add('hidden');
    overlay(
      `<h1>CHRONO TACTICS</h1>
       <div class="party">${party}</div>
       <p>Magus and his generals have crossed the Zenan river.<br>
       Hold the bridge and defeat every last one of them.</p>
       <div class="party">${foes}</div>
       <p>Units act in Charge-Time order. Each turn you may Move once and Act once.<br>
       Strike from the side or back for bonus damage. High ground hits harder.</p>
       <div class="blink">CLICK TO START</div>`,
      runBattle
    );
  }

  function showEnd(result) {
    const win = result === 'victory';
    overlay(
      `<h1>${win ? 'VICTORY!' : 'DEFEAT...'}</h1>
       <p>${win ? 'Magus retreats into the mist. The bridge is safe... for now.' : 'The party has fallen. But time can always be rewritten.'}</p>
       <div class="blink">CLICK TO PLAY AGAIN</div>`,
      runBattle
    );
  }

  // ---- Input -----------------------------------------------------------------
  function mousePos(e) {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height];
  }

  cv.addEventListener('mousemove', (e) => {
    if (!battle) return;
    const [mx, my] = mousePos(e);
    const t = renderer.pick(battle, mx, my);
    if (t === ui.hover) return;
    if (ui.mode === 'target' && ui.action.range[1] === 0) return; // self-centred: fixed
    ui.hover = t;
    if (ui.mode === 'move') updatePathPreview();
    if (ui.mode === 'target') updateTargetPreview();
    refreshHover();
  });

  cv.addEventListener('mouseleave', () => {
    if (ui.mode === 'target' && ui.action.range[1] === 0) return;
    ui.hover = null;
    if (ui.mode === 'target') updateTargetPreview();
    refreshHover();
  });

  cv.addEventListener('click', async (e) => {
    if (!battle || !battle.active || battle.active.team !== 0) return;
    const u = battle.active;
    const [mx, my] = mousePos(e);
    const t = ui.mode === 'target' && ui.action.range[1] === 0 ? battle.tile(u.x, u.y) : renderer.pick(battle, mx, my);
    if (!t) return;
    const key = `${t.x},${t.y}`;

    if (ui.mode === 'move') {
      const node = ui.reach.get(key);
      if (!node) return;
      ui.mode = 'busy';
      ui.highlights = null;
      ui.path = null;
      if (node.d > 0) await moveAlong(u, battle.pathTo(node));
      battle.moved = node.d > 0 || battle.moved;
      backToMenu();
    } else if (ui.mode === 'target') {
      if (!ui.range.has(key)) return;
      if (!battle.affected(u, ui.action, t).length) {
        banner('No valid targets there', 800);
        return;
      }
      ui.mode = 'busy';
      ui.highlights = null;
      await performAction(u, ui.action, { x: t.x, y: t.y });
      if (battle.outcome()) return finishTurn();
      backToMenu();
    }
  });

  function cancel() {
    if (!battle || !battle.active || battle.active.team !== 0) return;
    if (ui.mode === 'move' || ui.mode === 'target' || ui.mode === 'techmenu') {
      showMenu('main');
      refreshHover();
    }
  }
  cv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    cancel();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancel();
    if (e.key === 'q' || e.key === 'Q') renderer.rot = (renderer.rot + 3) % 4;
    if (e.key === 'e' || e.key === 'E') renderer.rot = (renderer.rot + 1) % 4;
  });

  // Debug handle for the console / automated tests.
  CT.debug = { get battle() { return battle; }, renderer, ui };

  // Decode sprite assets, then draw the map behind the title screen.
  CT.loadAssets().then(() => {
    battle = new CT.Battle(CT.MAP, CT.ROSTER);
    showTitle();
  });
})();
