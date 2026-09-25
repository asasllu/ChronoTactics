// Battle controller: the async flow of a battle on top of the rules engine —
// transitions, turns, player input, AI, animation and the trigger engine.
(function () {
  const CT = (window.CT = window.CT || {});
  const UI = CT.UI;
  const key = (x, y) => `${x},${y}`;
  const wait = (ms) => CT.wait(ms);
  const tween = (ms, fn) => CT.tween(ms, fn);
  const sfx = (id) => CT.audio && CT.audio.sfx(id);
  const ELEM_COL = { lightning: '#fff080', fire: '#ffa060', ice: '#a0e8ff', water: '#80b8ff', shadow: '#d0a0ff' };

  class BattleCtl {
    constructor(def, game, scene) {
      this.def = def;
      this.game = game;
      this.scene = scene;
      this.r = scene.r;
      this.b = new CT.Battle(def, game);
      if (scene.world && scene.world.map && scene.world.map.id === def.map) this.b.map.theme = scene.world.map.theme;
      else if (def.theme) this.b.map.theme = def.theme;
      this.props = [];
      this.ui = { grid: true, highlights: null, hover: null, path: null };
      this.fired = new Set();
      this.flagRound = {};
      this.zoneVisitors = {};
      this.roundStart = 1;
      this.phase = 'pre';
      const ctl = this;
      this.world = {
        map: this.b.map,
        get units() {
          return ctl.b.units.concat(ctl.props);
        },
        get active() {
          return ctl.b.active;
        },
      };
    }

    // ---- Setup ------------------------------------------------------------------
    setup() {
      const b = this.b;
      const g = this.game;
      const def = this.def;
      const partyIds = def.partyOverride || g.party;
      const posOf = (id) => (def.party && def.party[id] ? b.resolveAt(def.party[id]) : null);
      let first = null;
      for (const id of partyIds) {
        const m = g.members[id];
        if (!m) continue;
        let p = posOf(id) || (first ? b.freeTileNear(first, { float: !!CT.HEROES[id].float }) : b.freeTileNear(null, {}));
        if (b.unitAt(p.x, p.y)) p = b.freeTileNear(p, {});
        first = first || p;
        const face = def.partyFace != null ? def.partyFace : 3;
        b.addHero(m, p, typeof face === 'string' ? CT.FACE[face] : face);
      }
      const guests = def.guests || g.guests.map((id) => ({ type: `${id}_ally`, id, near: first ? [first.x, first.y] : null }));
      const seen = new Set();
      for (const gs of guests) {
        if (seen.has(gs.id || gs.type)) continue;
        seen.add(gs.id || gs.type);
        const u = b.addEnemy({ ...gs, near: gs.near || (first ? [first.x + 1, first.y] : null), guest: true, team: 0 }, 0);
        if (u) {
          u.guest = true;
          u.protect = gs.protect || u.protect || 'frog';
          u.ai = gs.ai || 'protect';
          const saved = g.guestHp && g.guestHp[u.id];
          if (saved) u.hp = Math.max(1, Math.round(u.maxHp * saved));
          if (gs.hpPctIf && g.checkFlag(gs.hpPctIf.flag)) u.hp = Math.max(1, Math.round(u.maxHp * gs.hpPctIf.pct / 100));
        }
      }
      for (const spec of def.units || []) b.addEnemy(spec);
      for (const u of b.units) {
        u.ct = Math.floor(Math.random() * 30);
        if (u.hero) u.ct += 20;
      }
      this.updateObjective();
    }

    // Seamless transition: field actors slide to their battle tiles.
    async transition() {
      const scene = this.scene;
      const sameMap = scene.world && scene.world.map && scene.world.map.id === this.def.map;
      const b = this.b;
      if (sameMap) {
        for (const u of b.units) {
          const a = scene.actor(u.id);
          if (a && !a.hidden) {
            u.rx = a.x;
            u.ry = a.y;
            u.face = a.face;
            const t = b.tile(a.x, a.y);
            u.rh = t ? b.visH(t) : 0;
          }
        }
        // Non-combatant actors stay as props (e.g. dropped seeds, the Epoch).
        for (const a of scene.actors) if (!b.units.some((u) => u.id === a.id) && a.prop && !a.hidden) this.props.push(a);
      }
      this.r.setWorld(this.world);
      this.r.flashScreen('255,255,255', 260);
      sfx('sfx_battle_start');
      if (this.r.fade > 0) tween(400, (k) => (this.r.fade = 1 - k));
      await tween(CT.FAST ? 5 : 360, (k) => {
        for (const u of b.units) {
          u.rx += (u.x - u.rx) * k;
          u.ry += (u.y - u.ry) * k;
          const t = b.tile(u.x, u.y);
          u.rh += (b.visH(t) - u.rh) * k;
        }
      });
      for (const u of b.units) {
        u.rx = u.x;
        u.ry = u.y;
        u.rh = b.visH(b.tile(u.x, u.y));
        u.flicker = CT.ENEMIES[u.key] && CT.ENEMIES[u.key].flicker;
      }
      this.r.focusMap(false);
      UI.battleHud(true);
      this.refresh();
    }

    // ---- HUD -----------------------------------------------------------------------
    updateObjective() {
      const o = this.b.objective;
      UI.objective(o.text || { DEFEAT_ALL: 'Defeat all enemies', DEFEAT_UNIT: 'Defeat the target' }[o.type] || '', this.b.hatchLeft(), o.secondary);
    }
    refresh() {
      const b = this.b;
      const list = (b.active ? [b.active] : []).concat(b.predictOrder(b.active ? 7 : 8));
      UI.turnBar(list);
      if (b.active && b.active.team === 0) UI.unitPanel('active', b.active, b);
      else if (b.active) UI.unitPanel('active', b.active, b);
      this.updateObjective();
      this.refreshHover();
    }
    refreshHover() {
      const t = this.ui.hover;
      const b = this.b;
      if (!t) return UI.unitPanel('target', null, b);
      const v = b.unitAt(t.x, t.y) || b.bodyAt(t.x, t.y);
      let extra = '';
      if (this.targeting && this.ui.aoe && this.ui.aoe.has(key(t.x, t.y)) && v) {
        const u = b.active;
        const tech = this.targeting.tech;
        const from = { x: u.x, y: u.y };
        if (b.targetsOf(u, from, tech, this.targeting.center || t).includes(v) || tech.special === 'leap' || tech.special === 'dash') {
          const p = b.preview(u, from, tech, v);
          if (p.kind === 'heal') extra = `<div class="preview heal">Heal +${p.amount}</div>`;
          else if (p.kind === 'dmg')
            extra = `<div class="preview">${p.immune ? 'IMMUNE' : `Dmg ${p.amount}`} · Hit ${p.hit}%${p.side && p.side !== 'front' ? ' · ' + p.side.toUpperCase() : ''}${p.elemMult > 1 ? ' · WEAK' : p.elemMult != null && p.elemMult < 1 ? ' · RESIST' : ''}</div>`;
          else extra = `<div class="preview">${tech.name}</div>`;
        }
      }
      if (v) UI.unitPanel('target', v, b, extra);
      else UI.tilePanel(t);
    }

    // ---- Main loop ---------------------------------------------------------------------
    async run() {
      this.setup();
      await this.transition();
      await this.triggers();
      this.phase = 'battle';
      for (let guard = 0; guard < 2000; guard++) {
        const res = await this.checkEnd();
        if (res) return res;
        const b = this.b;
        const u = b.nextActor();
        b.beginTurn(u);
        if (this.roundStart) {
          if (this.roundStart > 1) await this.roundBegins();
          await this.triggers({ turnStart: this.roundStart });
          this.roundStart = 0;
          const r2 = await this.checkEnd();
          if (r2) return r2;
        }
        if (!u.alive) {
          b.endTurn();
          continue;
        }
        this.refresh();
        this.r.focus(u.x, u.y, b.tile(u.x, u.y).h);
        let skip = false;
        if (u.status.burn) {
          const d = Math.max(1, Math.round(u.maxHp * 0.05));
          const out = { results: [] };
          b.damage(u, d, out, {});
          this.r.floatText(u, `${d}`, '#ff9040');
          this.r.burst(u.x, u.y, u.rh, 'fire', { n: 10, noShake: true });
          await wait(400);
          await this.showResults(out);
          if (!u.alive) skip = true;
        }
        if (!skip && (u.status.stun || u.status.stasis)) {
          this.r.floatText(u, u.status.stun ? 'STUNNED' : 'STASIS', '#c0c8ff');
          await wait(600);
          skip = true;
        }
        if (!skip) {
          if (u.team === 2 || u.ai === 'passive' || u.passive) {
            await wait(150);
          } else if (u.team === 0 && u.hero && !CT.AUTOPLAY) await this.playerTurn(u);
          else await this.aiTurn(u);
        }
        await this.triggers();
        if (b.hatch && u.alive) {
          const h = b.carrierCheck(u);
          if (h === 'hatch') await this.hatch();
        }
        const newRound = b.endTurn();
        if (newRound) this.roundStart = b.round;
        this.refresh();
      }
      return 'defeat';
    }

    // End-of-round bookkeeping (hatch counters, erased tiles returning, Erase Era warnings).
    async roundBegins() {
      const b = this.b;
      const h = b.tickHatch();
      if (h === 'hatch') await this.hatch();
      else if (h === 'inert') {
        UI.banner('The seed goes inert.', 1600);
        sfx('sfx_glass_shatter');
      }
      const back = b.restoreVoid();
      if (back.length) {
        this.r.invalidateTiles();
        UI.banner('The erased ground returns…', 1400);
      }
      const core = b.living(1).find((u) => u.ai === 'curator_core');
      if (core && (!b.erasure || !b.erasure.pending) && b.round % 4 === 3) {
        const zones = ['Q_N', 'Q_E', 'Q_S', 'Q_W'].filter((z) => b.map.zones[z]);
        if (zones.length) {
          const z = zones[Math.floor(Math.random() * zones.length)];
          b.erasure = { pending: true, zone: z, round: b.round + 1 };
          const name = { Q_N: 'north', Q_E: 'east', Q_S: 'south', Q_W: 'west' }[z];
          UI.banner(`The ${name} quadrant is being erased!`, 2400, 'warn');
          sfx('sfx_scanline');
        }
      }
      this.updateObjective();
    }

    async hatch() {
      const b = this.b;
      const h = b.hatch;
      this.game.flags.seed_hatched = true;
      const at = h.spawn && (h.spawn.at || h.spawn.near);
      const p = b.resolveAt(at) || (h.zone ? (() => { const [x, y] = b.zoneCells(h.zone)[0]; return { x, y }; })() : { x: 8, y: 8 });
      sfx('sfx_seed_hatch');
      this.r.shake(10, 700);
      this.r.flashScreen('255,60,60', 400);
      this.r.burst(p.x, p.y, b.visH(b.tile(p.x, p.y)), 'lavos', { r: 80 });
      UI.banner('The seed has hatched!', 2200, 'warn');
      if (h.spawn) {
        const u = b.addEnemy({ ...h.spawn, near: h.spawn.at || h.spawn.near });
        if (u) {
          u.ct = 50;
          u.alpha = 0;
          await tween(500, (k) => (u.alpha = k));
        }
      }
      if (h.lava) {
        b.fillTiles(b.zoneCells(h.lava), 'l');
        this.r.invalidateTiles();
      }
      if (h.objective) {
        b.objective = h.objective;
        this.updateObjective();
      }
      b.events.push({ type: 'hatch' });
      await wait(600);
      await this.triggers();
    }

    async checkEnd() {
      const res = this.forcedEnd || this.b.outcome();
      if (!res) return null;
      this.phase = 'end';
      if (res === 'victory') await this.triggers({ victory: true });
      else await this.triggers({ defeat: true });
      return res;
    }

    // ---- Player turn -------------------------------------------------------------------
    playerTurn(u) {
      return new Promise((resolve) => {
        this.endPlayerTurn = resolve;
        this.showMain(u);
      });
    }

    closeMenu() {
      if (this.menuP) {
        this.menuP.close();
        this.menuP = null;
      }
    }

    async showMain(u) {
      const b = this.b;
      this.mode = 'menu';
      this.ui.highlights = null;
      this.ui.path = null;
      this.targeting = null;
      this.ui.facingFor = null;
      this.refresh();
      if (b.moved && b.acted1) return this.chooseFacing(u);
      const canUndo = b.moved && !b.acted1 && !this.noUndo;
      const items = [
        { label: 'Move', value: 'move', disabled: b.moved },
        { label: 'Attack', value: 'attack', disabled: b.acted1 },
        { label: 'Tech', value: 'tech', disabled: b.acted1 },
        { label: 'Item', value: 'item', disabled: b.acted1 || !Object.entries(this.game.inventory).some(([k, n]) => n > 0 && CT.ITEMS[k].battle) },
        { label: 'Wait', value: 'wait' },
      ];
      if (canUndo) items.splice(1, 0, { label: 'Undo Move', value: 'undo' });
      this.menuP = UI.menu(items, { cls: 'battle-menu', title: u.name, noCancel: !canUndo });
      const v = await this.menuP;
      this.menuP = null;
      if (v == null && canUndo) return this.undoMove(u);
      if (v === 'move') return this.startMove(u);
      if (v === 'undo') return this.undoMove(u);
      if (v === 'attack') return this.startTarget(u, b.attackOf(u));
      if (v === 'tech') return this.techMenu(u);
      if (v === 'item') return this.itemMenu(u);
      if (v === 'wait') return this.chooseFacing(u);
    }

    undoMove(u) {
      const b = this.b;
      const p = b.startPos;
      u.x = p.x;
      u.y = p.y;
      u.rx = p.x;
      u.ry = p.y;
      u.rh = b.visH(b.tile(p.x, p.y));
      b.moved = false;
      this.showMain(u);
    }

    async techMenu(u) {
      const b = this.b;
      const own = u.techs.map((id) => CT.TECHS[id]).filter(Boolean);
      const items = own.map((t) => ({ label: t.name, note: `${t.mp}MP`, value: t, disabled: t.mp > u.mp, hint: t.desc }));
      for (const d of b.dualsFor(u)) {
        const who = d.tech.dual.slice(1).map((id) => CT.HEROES[id].name).join('+');
        items.push({ label: `✦ ${d.tech.name}`, note: `${d.tech.mp}MP`, value: d.tech, disabled: !d.usable, cls: 'dual', hint: d.usable ? `With ${who}. ${d.tech.desc || ''}` : d.why });
      }
      if (!items.length) return this.showMain(u);
      this.menuP = UI.menu(items, { cls: 'battle-menu techs', title: 'TECH' });
      const t = await this.menuP;
      this.menuP = null;
      if (!t) return this.showMain(u);
      return this.startTarget(u, t);
    }

    async itemMenu(u) {
      const g = this.game;
      const items = Object.entries(g.inventory)
        .filter(([k, n]) => n > 0 && CT.ITEMS[k].battle)
        .map(([k, n]) => ({ label: CT.ITEMS[k].name, note: `×${n}`, value: k, hint: CT.ITEMS[k].desc }));
      this.menuP = UI.menu(items, { cls: 'battle-menu', title: 'ITEM' });
      const id = await this.menuP;
      this.menuP = null;
      if (!id) return this.showMain(u);
      const it = CT.ITEMS[id];
      const tech = { id: 'item_' + id, name: it.name, range: [0, 2], shape: 'single', r: 0, target: 'ally', kind: 'item', item: id, mp: 0 };
      return this.startTarget(u, tech);
    }

    startMove(u) {
      this.mode = 'move';
      this.reach = this.b.reachable(u);
      this.ui.highlights = new Map([...this.reach.keys()].map((k) => [k, 'move']));
      this.updatePath();
    }
    updatePath() {
      this.ui.path = null;
      if (this.mode !== 'move' || !this.ui.hover) return;
      const n = this.reach.get(key(this.ui.hover.x, this.ui.hover.y));
      if (n) this.ui.path = new Set(this.b.pathTo(n).map((p) => key(p.x, p.y)));
    }

    startTarget(u, tech) {
      const b = this.b;
      this.mode = 'target';
      const from = { x: u.x, y: u.y };
      let tiles;
      if (tech.kind === 'item') {
        tiles = [];
        for (let y = 0; y < b.map.h; y++)
          for (let x = 0; x < b.map.w; x++) if (Math.abs(x - u.x) + Math.abs(y - u.y) <= 2) tiles.push(b.tile(x, y));
      } else tiles = b.tilesInRange(u, from, tech);
      this.targeting = { tech, range: new Set(tiles.map((t) => key(t.x, t.y))) };
      if (tech.range[1] === 0) this.ui.hover = b.tile(u.x, u.y);
      this.updateTarget();
    }
    updateTarget() {
      const b = this.b;
      const u = b.active;
      const tg = this.targeting;
      this.ui.highlights = new Map([...tg.range].map((k) => [k, 'range']));
      tg.center = null;
      this.ui.aoe = null;
      const h = tg.tech.range[1] === 0 ? b.tile(u.x, u.y) : this.ui.hover;
      if (h && tg.range.has(key(h.x, h.y))) {
        tg.center = { x: h.x, y: h.y };
        const area = tg.tech.kind === 'item' ? [h] : b.areaTiles(u, { x: u.x, y: u.y }, tg.tech, h);
        this.ui.aoe = new Set(area.map((t) => key(t.x, t.y)));
        for (const k of this.ui.aoe) this.ui.highlights.set(k, 'aoe');
      }
    }

    async chooseFacing(u) {
      this.mode = 'facing';
      this.ui.highlights = null;
      this.ui.facingFor = u;
      UI.prompt('Choose facing — click an arrow / arrow keys, Enter to confirm');
      if (CT.AUTOFACE) return this.finishTurn();
    }
    finishTurn() {
      this.ui.facingFor = null;
      UI.prompt('');
      this.mode = 'busy';
      const r = this.endPlayerTurn;
      this.endPlayerTurn = null;
      if (r) r();
    }

    // Input from main.js while a battle runs.
    onHover(t) {
      if (this.mode === 'target' && this.targeting && this.targeting.tech.range[1] === 0) return;
      this.ui.hover = t;
      if (this.mode === 'move') this.updatePath();
      if (this.mode === 'target') this.updateTarget();
      this.refreshHover();
    }
    async onClick(t, mx, my) {
      const b = this.b;
      const u = b.active;
      if (!u || this.busy) return;
      if (this.mode === 'facing') {
        const [sx, sy] = this.r.unitScreenPos(u);
        const f = this.r.faceForScreen(mx - sx, my - sy);
        if (u.face === f) return this.finishTurn();
        u.face = f;
        return;
      }
      if (!t) return;
      if (this.mode === 'move') {
        const n = this.reach.get(key(t.x, t.y));
        if (!n) return;
        this.busy = true;
        this.mode = 'busy';
        this.ui.highlights = null;
        this.ui.path = null;
        if (n.d > 0) await this.animateMove(u, b.pathTo(n));
        b.moved = n.d > 0 || b.moved;
        this.noUndo = false;
        await this.triggers();
        this.busy = false;
        if (await this.midCheck()) return;
        return this.showMain(u);
      }
      if (this.mode === 'target') {
        const tg = this.targeting;
        const c = tg.tech.range[1] === 0 ? b.tile(u.x, u.y) : t;
        if (!tg.range.has(key(c.x, c.y))) return;
        if (tg.tech.kind === 'item') return this.useItem(u, tg.tech.item, c);
        if (!b.validAim(u, { x: u.x, y: u.y }, tg.tech, c)) {
          UI.banner('No valid targets there', 900);
          return;
        }
        this.busy = true;
        this.mode = 'busy';
        this.ui.highlights = null;
        this.targeting = null;
        this.closeMenu();
        await this.perform(u, tg.tech, { x: c.x, y: c.y });
        this.busy = false;
        if (await this.midCheck()) return;
        return this.showMain(u);
      }
    }
    onKey(e) {
      const b = this.b;
      const u = b.active;
      if (!u || this.busy) return false;
      if (this.mode === 'facing') {
        const map = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] };
        if (map[e.key]) {
          const [vx, vy] = map[e.key];
          const [dx, dy] = this.r.vecToWorld(vx, vy);
          u.face = CT.dirTo(0, 0, dx, dy);
          return true;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          this.finishTurn();
          return true;
        }
        if (e.key === 'Escape') {
          this.ui.facingFor = null;
          UI.prompt('');
          this.showMain(u);
          return true;
        }
      }
      if ((this.mode === 'move' || this.mode === 'target') && (e.key === 'Escape' || e.key === 'x')) {
        this.cancel();
        return true;
      }
      return false;
    }
    cancel() {
      const u = this.b.active;
      if (!u || this.busy) return;
      if (this.mode === 'move' || this.mode === 'target') {
        this.ui.highlights = null;
        this.targeting = null;
        this.showMain(u);
      }
    }
    // After a player action: stop if the battle ended mid-turn.
    async midCheck() {
      if (this.forcedEnd || this.b.outcome() || !this.b.active || !this.b.active.alive) {
        this.finishTurn();
        return true;
      }
      return false;
    }

    async useItem(u, id, t) {
      const b = this.b;
      const it = CT.ITEMS[id];
      const v = b.unitAt(t.x, t.y) || b.bodyAt(t.x, t.y);
      if (!v || b.hostile(u, v)) return UI.banner('Choose an ally', 800);
      if (it.revive && v.alive) return UI.banner('They are still standing!', 900);
      if (!it.revive && !v.alive) return UI.banner('They need a Revive.', 900);
      this.busy = true;
      this.mode = 'busy';
      this.ui.highlights = null;
      this.targeting = null;
      this.game.useItem(id);
      u.face = t.x === u.x && t.y === u.y ? u.face : CT.dirTo(u.x, u.y, t.x, t.y);
      sfx('sfx_heal_chime');
      if (it.revive) {
        v.alive = true;
        v.ko = false;
        v.koPose = false;
        v.alpha = 1;
        v.hp = Math.max(1, Math.round(v.maxHp * it.revive));
        this.r.floatText(v, 'REVIVED', '#80ff90');
      } else if (it.heal) {
        const amt = Math.min(it.heal, v.maxHp - v.hp);
        v.hp += amt;
        this.r.floatText(v, `+${amt}`, '#80ff90');
      } else if (it.mpHeal) {
        const amt = Math.min(it.mpHeal, v.maxMp - v.mp);
        v.mp += amt;
        this.r.floatText(v, `+${amt} MP`, '#80c0ff');
      }
      this.r.burst(v.x, v.y, v.rh, 'heal');
      b.acted1 = true;
      await wait(600);
      this.busy = false;
      this.refresh();
      return this.showMain(u);
    }

    // ---- AI turn ---------------------------------------------------------------------------
    async aiTurn(u) {
      const b = this.b;
      await wait(CT.FAST ? 5 : 350);
      const plan = b.planAI(u);
      if (plan.dest && (plan.dest.x !== u.x || plan.dest.y !== u.y)) {
        const reach = b.reachable(u);
        this.ui.highlights = new Map([...reach.keys()].map((k) => [k, 'move']));
        await wait(CT.FAST ? 5 : 380);
        this.ui.highlights = null;
        await this.animateMove(u, b.pathTo(plan.dest));
        b.moved = true;
        this.refresh();
        await this.triggers();
        if (this.forcedEnd || b.outcome() || !u.alive) return;
      }
      if (plan.tech) {
        const tech = plan.tech;
        if (tech.special === 'erase') return this.eraseEra(u);
        if (!['core_rain', 'reconstruct'].includes(tech.special)) {
          const area = b.areaTiles(u, { x: u.x, y: u.y }, tech, plan.target);
          this.ui.highlights = new Map(area.map((t) => [key(t.x, t.y), 'aoe']));
          await wait(CT.FAST ? 5 : 450);
          this.ui.highlights = null;
        }
        await this.perform(u, tech, plan.target);
      } else {
        const foes = b.foesOf(u);
        if (foes.length) {
          foes.sort((p, q) => Math.abs(p.x - u.x) + Math.abs(p.y - u.y) - (Math.abs(q.x - u.x) + Math.abs(q.y - u.y)));
          u.face = CT.dirTo(u.x, u.y, foes[0].x, foes[0].y);
        }
        await wait(CT.FAST ? 5 : 200);
      }
    }

    async eraseEra(u) {
      const b = this.b;
      const z = b.erasure && b.erasure.zone;
      b.erasure = { pending: false };
      UI.banner('ERASE ERA', 1600, 'warn');
      sfx('sfx_hollow_gate');
      this.r.bigFx('erase', 900);
      await wait(400);
      const out = { results: [] };
      if (z) b.voidTiles(b.zoneCells(z), 2, out);
      this.r.invalidateTiles();
      await this.showResults(out, u);
      b.acted1 = true;
    }

    // ---- Animation -------------------------------------------------------------------------
    async animateMove(u, path) {
      const b = this.b;
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const c = path[i];
        const ha = b.visH(b.tile(a.x, a.y));
        const hc = b.visH(b.tile(c.x, c.y));
        u.face = CT.dirTo(a.x, a.y, c.x, c.y);
        const jump = Math.abs(hc - ha) >= 1 || u.float;
        if (i % 2) sfx(u.key === 'seedbearer' || u.key === 'iselle' ? 'sfx_porcelain_step' : 'sfx_step');
        await tween(jump ? 240 : 140, (k) => {
          u.rx = a.x + (c.x - a.x) * k;
          u.ry = a.y + (c.y - a.y) * k;
          u.rh = ha + (hc - ha) * k + Math.sin(k * Math.PI) * (u.float ? 0.4 : jump ? 0.9 : 0.12);
        });
      }
      b.moveUnit(u, path);
      u.rx = u.x;
      u.ry = u.y;
      u.rh = b.visH(b.tile(u.x, u.y));
      this.r.focus(u.x, u.y, b.tile(u.x, u.y).h);
    }

    async perform(u, tech, center) {
      const b = this.b;
      const from = { x: u.x, y: u.y };
      if (center.x !== u.x || center.y !== u.y) u.face = CT.dirTo(u.x, u.y, center.x, center.y);
      const partners = tech.dual ? b.partnersFor(u, tech) : [];
      if (!tech.isAttack) {
        UI.banner(`${u.name}${partners.length ? ' & ' + partners.map((p) => p.name).join(' & ') : ''}: ${tech.name}`, 1400, tech.dual ? 'dual' : '');
        for (const m of [u, ...partners]) m.flash = 0.6;
        await tween(CT.FAST ? 5 : 420, (k) => {
          for (const m of [u, ...partners]) m.flash = 0.6 * Math.sin(k * Math.PI * 3) ** 2;
        });
        for (const m of [u, ...partners]) m.flash = 0;
      }
      if (tech.big) {
        this.r.bigFx(tech.big, tech.big === 'eclipse' ? 1600 : 1100);
        await wait(tech.big === 'eclipse' ? 900 : 400);
      }
      const physMelee = (tech.isAttack || tech.kind === 'phys') && tech.range[1] <= 1 && !tech.special;
      if (tech.isAttack && tech.proj) {
        const fromP = this.r.project(u.x, u.y, u.rh + 1.3);
        const tt = b.tile(center.x, center.y);
        const toP = this.r.project(center.x, center.y, b.visH(tt) + 1.2);
        const dur = 120 + 50 * (Math.abs(u.x - center.x) + Math.abs(u.y - center.y));
        sfx('sfx_sword_swing');
        this.r.projectile(fromP, toP, u.key === 'magus' ? 'dark' : 'shot', dur);
        await wait(dur);
      } else if (physMelee && (center.x !== u.x || center.y !== u.y)) {
        const [dx, dy] = CT.DIRS[CT.dirTo(u.x, u.y, center.x, center.y)];
        sfx('sfx_sword_swing');
        await tween(110, (k) => {
          u.ox = dx * 0.35 * k;
          u.oy = dy * 0.35 * k;
        });
      }
      const out = b.execute(u, tech, center);
      // Moves caused by the tech (leap, dash, knockback, rearrange).
      for (const mv of out.moves.filter((m) => m.unit === u && (m.leap !== undefined || m.teleport))) await this.animateJump(mv);
      if (tech.sfx) sfx(tech.sfx);
      if (out.rainTiles) {
        this.r.rain(out.rainTiles);
        this.ui.highlights = new Map(out.rainTiles.map((t) => [key(t.x, t.y), 'danger']));
        await wait(CT.FAST ? 5 : 600);
        this.ui.highlights = null;
      }
      const area = tech.shape === 'map' ? b.living().filter((v) => b.hostile(u, v)).map((v) => b.tile(v.x, v.y)) : tech.special === 'rearrange' || tech.special === 'reconstruct' ? [] : b.areaTiles(u, { x: u.x, y: u.y }, tech, center);
      if (tech.kind !== 'special' || tech.special === 'steal') {
        const elem = tech.isAttack ? 'hit' : tech.vfx || tech.elem || 'hit';
        const tiles = tech.isAttack || tech.shape === 'single' ? [b.tile(center.x, center.y)] : area;
        tiles.forEach((t, i) => t && setTimeout(() => this.r.burst(t.x, t.y, b.visH(t), elem, { noShake: i > 0, n: tiles.length > 6 ? 10 : undefined }), CT.FAST ? 0 : i * 25));
      }
      for (const s of out.spawns) {
        s.alpha = 0;
        this.r.burst(s.x, s.y, b.visH(b.tile(s.x, s.y)), 'glass');
        tween(500, (k) => (s.alpha = k));
      }
      await this.showResults(out, u);
      await tween(160, (k) => {
        u.ox *= 1 - k;
        u.oy *= 1 - k;
      });
      u.ox = u.oy = 0;
      for (const mv of out.moves.filter((m) => m.unit !== u || m.push)) await this.animateJump(mv);
      if (out.placard) {
        UI.banner('The placard shatters!', 1400);
        sfx('sfx_glass_shatter');
        this.r.shake(8);
      }
      for (const n of out.notes) UI.banner(n, 1200);
      this.refresh();
      await wait(CT.FAST ? 5 : 280);
      await this.triggers();
    }

    async animateJump(mv) {
      const b = this.b;
      const u = mv.unit;
      const t0 = b.tile(mv.from.x, mv.from.y);
      const t1 = b.tile(mv.to.x, mv.to.y);
      const h0 = t0 ? b.visH(t0) : 0;
      const h1 = t1 && !CT.TERRAIN[t1.t].void ? b.visH(t1) : h0 - 6;
      if (mv.teleport) {
        sfx('sfx_scanline');
        await tween(200, (k) => (u.alpha = 1 - k));
        u.rx = mv.to.x;
        u.ry = mv.to.y;
        u.rh = h1;
        await tween(200, (k) => (u.alpha = k));
        return;
      }
      await tween(mv.fall ? 500 : 300, (k) => {
        u.rx = mv.from.x + (mv.to.x - mv.from.x) * Math.min(1, k * (mv.fall ? 2 : 1));
        u.ry = mv.from.y + (mv.to.y - mv.from.y) * Math.min(1, k * (mv.fall ? 2 : 1));
        u.rh = h0 + (h1 - h0) * k + (mv.push || mv.fall ? 0 : Math.sin(k * Math.PI) * 2);
      });
      u.rx = u.x;
      u.ry = u.y;
      if (!mv.fall) u.rh = h1;
    }

    async showResults(out, attacker) {
      const b = this.b;
      for (const r of out.results) {
        const v = r.target;
        if (r.miss) {
          this.r.floatText(v, 'MISS', '#c0c8ff');
          sfx('sfx_miss');
        } else if (r.immune) this.r.floatText(v, 'IMMUNE', '#c0f0ff');
        else if (r.heal != null) this.r.floatText(v, `+${r.heal}`, '#80ff90');
        else if (r.status) this.r.floatText(v, { stun: 'STUN', slow: 'SLOW', burn: 'BURN', catalogued: 'CATALOGUED', stasis: 'STASIS', magdown: 'MAG DOWN', haste: 'HASTE' }[r.status] || r.status.toUpperCase(), '#ffd0f0');
        else if (r.text) this.r.floatText(v, r.text, r.steal ? '#ffe080' : '#ffffff');
        else if (r.dmg != null) {
          const col = r.crit ? '#ff6040' : r.weak ? '#ffe040' : r.side === 'back' ? '#ffb040' : '#ffffff';
          this.r.floatText(v, `${r.dmg}${r.crit ? '!' : ''}`, col, r.crit || r.dmg > 150);
          if (r.crit) sfx('sfx_crit');
          v.flash = 1;
        }
      }
      await tween(CT.FAST ? 5 : 200, (k) => {
        for (const r of out.results) if (r.dmg) r.target.flash = Math.floor(k * 6) % 2 ? 0 : 1;
      });
      for (const r of out.results) if (r.target) r.target.flash = 0;
      const kos = [...new Set(out.results.filter((r) => r.ko || (r.target && !r.target.alive && r.dmg != null)).map((r) => r.target))];
      if (kos.length) {
        await wait(CT.FAST ? 5 : 200);
        sfx('sfx_ko');
        for (const v of kos) {
          if (v.hero || v.guest) {
            v.koPose = true;
            v.alpha = 0.75;
            this.r.floatText(v, 'KO', '#ff6060');
          } else this.r.burst(v.x, v.y, v.rh, v.flicker ? 'porcelain' : 'hit', { n: 12, noShake: true });
        }
        const fade = kos.filter((v) => !v.hero && !v.guest);
        if (fade.length) await tween(CT.FAST ? 5 : 600, (k) => fade.forEach((v) => (v.alpha = 1 - k)));
      }
      this.refresh();
    }

    // ---- Trigger engine ---------------------------------------------------------------------
    unitMatch(sel, u) {
      if (!u) return false;
      if (sel === 'any') return true;
      if (sel === 'any_party') return u.team === 0 && u.hero;
      if (sel === 'any_enemy') return u.team === 1;
      return u.id === sel;
    }
    zoneHas(zone, x, y) {
      if (Array.isArray(zone)) return zone.some(([zx, zy]) => zx === x && zy === y);
      return this.b.inZone(zone, x, y);
    }
    condition(tr, ctx, events) {
      const b = this.b;
      const a = tr.args || {};
      const unit = (id) => b.units.find((u) => u.id === id);
      switch (tr.when) {
        case 'PRE_BATTLE':
          return this.phase === 'pre';
        case 'TURN_START': {
          if (ctx.turnStart == null) return false;
          // `phase` rounds count from the moment the trigger's `requires` flag was set.
          const base = a.phase && tr.requires ? this.flagRound[tr.requires] || 0 : 0;
          return ctx.turnStart === base + (a.n || 1);
        }
        case 'UNIT_HP_BELOW': {
          const u = unit(a.unit);
          if (!u || u.despawned) return false;
          if (a.pct <= 0) return u.hp <= (u.immortal ? 1 : 0);
          return u.alive && (u.hp / u.maxHp) * 100 < a.pct;
        }
        case 'UNIT_DEFEATED': {
          const u = unit(a.unit);
          return !!u && !u.alive && !u.despawned;
        }
        case 'UNIT_ENTERS_TILE':
          return b.units.some((u) => u.alive && this.unitMatch(a.unit, u) && u.x === a.x && u.y === a.y);
        case 'UNIT_ENTERS_ZONE': {
          const hit = b.units.find((u) => u.alive && this.unitMatch(a.unit, u) && this.zoneHas(a.zone, u.x, u.y));
          if (hit) this.triggerUnit = hit;
          return !!hit;
        }
        case 'ANY_ENEMY_ENTERS_ZONE':
          return (this.zoneVisitors[a.zone] || new Set()).size >= (a.count || 1);
        case 'TECH_USED':
          return events.some((e) => e.type === 'tech' && this.unitMatch(a.unit || 'any', e.unit) && (!a.tech || e.tech === a.tech) && (!a.knockedDown || e.knockedDown));
        case 'DUAL_TECH_USED':
          return events.some((e) => e.type === 'tech' && e.dual && (!a.tech || e.tech === a.tech));
        case 'UNIT_ADJACENT': {
          const A = unit(a.a);
          const B = unit(a.b);
          if (!A || !B || !A.alive || !B.alive) return false;
          const adj = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) === 1;
          if (!adj(A, B) && !a.near) return false;
          if (a.enemyAdjacent) return b.living().some((v) => b.hostile(A, v) && adj(v, A) && adj(v, B));
          return true;
        }
        case 'ALLY_KO':
          return events.some((e) => e.type === 'allyko' && (a.unit ? this.unitMatch(a.unit, e.unit) : true));
        case 'COUNT_DEFEATED':
          return b.units.filter((u) => u.type === a.enemyType && !u.alive && !u.despawned).length >= a.count;
        case 'HATCH':
          return events.some((e) => e.type === 'hatch');
        case 'PLACARD_SHATTERED':
          return !!b.placards && b.placards.broken.size >= (a.count || 1);
        case 'VICTORY':
          return !!ctx.victory;
        case 'DEFEAT':
          return !!ctx.defeat;
      }
      return false;
    }

    async triggers(ctx = {}) {
      const b = this.b;
      if (this.inTriggers) return;
      this.inTriggers = true;
      try {
        for (let pass = 0; pass < 6; pass++) {
          const events = b.events.splice(0);
          for (const e of events) {
            if (e.type === 'enter' && e.unit.team === 1)
              for (const z of Object.keys(b.map.zones)) if (b.inZone(z, e.x, e.y)) (this.zoneVisitors[z] = this.zoneVisitors[z] || new Set()).add(e.unit.uid);
          }
          let firedAny = false;
          for (const tr of this.def.triggers || []) {
            if (this.fired.has(tr.id) && !tr.repeatable) continue;
            if (tr.after && !this.fired.has(tr.after)) continue;
            if (tr.requires && !this.game.checkFlag(tr.requires)) continue;
            if (!this.condition(tr, ctx, events)) continue;
            this.fired.add(tr.id);
            firedAny = true;
            await this.fire(tr);
          }
          if (!firedAny && !b.events.length) break;
          ctx = { ...ctx, turnStart: null };
        }
      } finally {
        this.inTriggers = false;
      }
    }

    async fire(tr) {
      const b = this.b;
      const prevMenu = this.menuP;
      if (tr.focus) {
        const u = b.units.find((v) => v.id === tr.focus);
        if (u) this.r.focus(u.x, u.y, b.tile(u.x, u.y).h);
      }
      UI.battleHud(true);
      const hidden = [];
      for (const id of ['active', 'target']) {
        const e = document.getElementById(id);
        if (!e.classList.contains('hidden')) {
          hidden.push(e);
          e.classList.add('hidden');
        }
      }
      if (prevMenu && prevMenu.el) prevMenu.el.style.visibility = 'hidden';
      let lines = tr.lines || [];
      if (tr.lineMode === 'first_alive') {
        const alive = lines.find((l) => b.units.some((u) => u.id === l[0] && u.alive));
        lines = alive ? [alive] : [];
      }
      for (const l of lines) await UI.say(l[0], l[1], l[2], l[3] || {});
      if (tr.script) await this.runScript(tr.script);
      for (const ef of tr.effect || []) await this.effect(ef);
      if (prevMenu && prevMenu.el) prevMenu.el.style.visibility = '';
      hidden.forEach((e) => e.classList.remove('hidden'));
      this.refresh();
    }

    // Subset of scene commands usable inside battle triggers.
    async runScript(cmds) {
      for (const c of cmds) {
        const [op, ...a] = c;
        switch (op) {
          case 'say':
            await UI.say(a[0], a[1], a[2], a[3] || {});
            break;
          case 'choice': {
            const i = await UI.choice(a[0]);
            if (a[2]) this.game.flags[a[2]] = i;
            if (a[1] && a[1][i]) await this.runScript(a[1][i]);
            break;
          }
          case 'wait':
            await wait(a[0] || 400);
            break;
          case 'sfx':
            sfx(a[0]);
            break;
          case 'music':
            if (CT.audio) a[0] ? CT.audio.playMusic(a[0]) : CT.audio.stopMusic(400);
            break;
          case 'shake':
            this.r.shake(8, a[0] || 500);
            await wait(300);
            break;
          case 'flash':
            this.r.flashScreen();
            break;
          case 'emote': {
            const u = this.b.units.find((v) => v.id === a[0]);
            if (u) u.emote = { text: a[1], t0: performance.now() };
            await wait(400);
            break;
          }
          case 'anim': {
            const u = this.b.units.find((v) => v.id === a[0]);
            if (u && a[1] === 'kneel') u.oz = -4;
            if (u && a[1] === 'draw_sword') {
              sfx('sfx_sword_swing');
              u.flash = 1;
              await tween(300, (k) => (u.flash = 1 - k));
            }
            await wait(200);
            break;
          }
          case 'popup':
            await UI.popup(a[0]);
            break;
          case 'camera': {
            if (a[0] === 'map') this.r.focusMap(false);
            else {
              const p = this.b.resolveAt(a[0]);
              if (p) this.r.focus(p.x, p.y, this.b.tile(p.x, p.y).h);
            }
            await wait(a[1] || 300);
            break;
          }
          case 'setflag':
            this.game.flags[a[0]] = a.length > 1 ? a[1] : true;
            break;
          case 'unlock':
            this.game.unlock(a[0]);
            await UI.popup(`<b>Combo tech unlocked:</b><br>${CT.TECHS[a[0]].name}`);
            break;
          case 'vfx': {
            const p = this.b.resolveAt(a[1]);
            if (p) this.r.burst(p.x, p.y, this.b.visH(this.b.tile(p.x, p.y)), a[0] === 'glass_shatter' ? 'glass' : a[0] === 'seed_hatch' ? 'lavos' : 'porcelain', { r: 60 });
            break;
          }
          case 'if': {
            const br = this.game.checkFlag(a[0]) ? a[1] : a[2];
            if (br) await this.runScript(br);
            break;
          }
          default:
            console.warn('battle script: unsupported', op);
        }
      }
    }

    async effect(ef) {
      const b = this.b;
      const unit = (id) => b.units.find((u) => u.id === id);
      switch (ef.type) {
        case 'SPAWN': {
          // Per the script grammar the enemy type is in `unit` (`type` is 'SPAWN').
          const count = ef.count || 1;
          for (let i = 0; i < count; i++) {
            const u = b.addEnemy({ ...ef, id: count > 1 && ef.id ? `${ef.id}_${i + 1}` : ef.id, near: ef.near || ef.at || ef.tile, at: undefined, type: ef.enemy || ef.unit });
            if (u) {
              u.ct = 30;
              u.alpha = 0;
              u.flicker = CT.ENEMIES[u.key] && CT.ENEMIES[u.key].flicker;
              this.r.burst(u.x, u.y, b.visH(b.tile(u.x, u.y)), 'porcelain', { noShake: true });
              await tween(400, (k) => (u.alpha = k));
            }
          }
          break;
        }
        case 'DESPAWN': {
          const u = unit(ef.unit);
          if (u) {
            u.despawned = true;
            u.alive = false;
            await tween(500, (k) => (u.alpha = 1 - k));
          }
          break;
        }
        case 'MOVE_UNIT': {
          const u = unit(ef.unit);
          const p = b.resolveAt(ef.at || ef.tile);
          if (u && p) {
            const q = b.unitAt(p.x, p.y) && b.unitAt(p.x, p.y) !== u ? b.freeTileNear(p, u) : p;
            await this.animateJump({ unit: u, from: { x: u.x, y: u.y }, to: q, teleport: true });
            u.x = q.x;
            u.y = q.y;
          }
          break;
        }
        case 'SET_OBJECTIVE':
          b.objective = ef.objective || { ...b.objective, text: ef.text };
          if (ef.text) b.objective = { ...b.objective, text: ef.text };
          UI.banner(`New objective: ${b.objective.text || ''}`, 2000);
          this.updateObjective();
          break;
        case 'SET_TEAM': {
          const u = unit(ef.unit);
          if (u) {
            u.team = ef.team;
            if (ef.team === 2) u.ai = 'passive';
          }
          break;
        }
        case 'SET_AI': {
          const u = unit(ef.unit);
          if (u) {
            u.ai = ef.ai;
            u.passive = false;
          }
          break;
        }
        case 'PLAY_MUSIC':
          if (CT.audio) ef.track ? CT.audio.playMusic(ef.track) : CT.audio.stopMusic(600);
          break;
        case 'HEAL': {
          const u = unit(ef.unit);
          if (u) {
            u.hp = Math.min(u.maxHp, Math.max(u.hp, Math.round(u.maxHp * (ef.pct / 100))));
            this.r.burst(u.x, u.y, u.rh, 'heal', { noShake: true });
          }
          break;
        }
        case 'APPLY_STATUS': {
          let targets = [];
          if (ef.unit === 'all_party') targets = b.living().filter((u) => u.team === 0);
          else if (ef.unit === 'last_seedbearer') targets = b.living(1).filter((u) => u.type === 'seedbearer').slice(-1);
          else targets = [unit(ef.unit)].filter(Boolean);
          for (const u of targets) {
            b.addStatus(u, ef.status, ef.turns || 2);
            this.r.floatText(u, ef.status.toUpperCase(), '#ffd0f0');
          }
          await wait(300);
          break;
        }
        case 'UNLOCK_TECH':
          this.game.unlock(ef.tech);
          await UI.popup(`<b>${ef.tech === 'eclipse_blade' ? 'Triple' : 'Combo'} tech unlocked:</b><br>${CT.TECHS[ef.tech].name}<br><small>${CT.TECHS[ef.tech].desc || ''}</small>`);
          break;
        case 'SHAKE':
          this.r.shake(10, 600);
          await wait(300);
          break;
        case 'FLASH':
          this.r.flashScreen(ef.color || '255,255,255', 400);
          await wait(200);
          break;
        case 'RIFT': {
          const p = b.resolveAt(ef.at || ef.unit);
          if (p) {
            this.r.addRift(p.x, p.y, b.visH(b.tile(p.x, p.y)), { grey: ef.grey !== false, id: ef.id || 'rift' });
            sfx('sfx_hollow_gate');
            await wait(500);
          }
          break;
        }
        case 'CLOSE_RIFT':
          this.r.rifts = [];
          break;
        case 'DROP_SEED': {
          const p = b.resolveAt(ef.at || ef.unit) || (unit(ef.unit) && { x: unit(ef.unit).x, y: unit(ef.unit).y });
          if (p) {
            const t = b.tile(p.x, p.y);
            this.props.push({ id: 'seed_drop', sprite: 'lavos_seed_inert', key: 'lavos_seed_inert', x: p.x, y: p.y, rx: p.x, ry: p.y, rh: b.visH(t), ox: 0, oy: 0, oz: 0, face: 1, alpha: 1, alive: true, prop: true });
            sfx('sfx_item_get');
          }
          break;
        }
        case 'VOID_TILES': {
          const out = { results: [] };
          b.voidTiles(b.zoneCells(ef.zone), ef.rounds || 0, out);
          this.r.invalidateTiles();
          this.r.shake(10, 700);
          sfx('sfx_glass_shatter');
          await this.showResults(out);
          break;
        }
        case 'FILL_TILES':
          b.fillTiles(b.zoneCells(ef.zone), ef.terrain || 'k', ef.h);
          b.voided = b.voided.filter((v) => !b.inZone(ef.zone, v.x, v.y));
          this.r.invalidateTiles();
          sfx('sfx_door');
          this.r.shake(6, 400);
          break;
        case 'TRANSFORM': {
          const u = unit(ef.unit);
          const base = CT.ENEMIES[ef.into];
          if (u && base) {
            this.r.flashScreen('255,80,80', 600);
            this.r.shake(12, 900);
            Object.assign(u, {
              key: ef.into, type: ef.into, sprite: base.sprite, name: base.name, maxHp: ef.hp || base.hp, hp: ef.hp || base.hp,
              atk: base.atk, def: base.def, mag: base.mag, mdef: base.mdef, spd: base.spd, move: base.move, jump: base.jump,
              techs: [...base.techs], ai: ef.ai || base.ai, affinity: { ...base.affinity }, immortal: !!ef.immortal, alive: true, status: {}, big: base.big, xp: base.xp, gold: base.gold,
            });
            this.r.burst(u.x, u.y, u.rh, 'lavos', { r: 90 });
            await wait(700);
          }
          break;
        }
        case 'FREE_ACTION': {
          const u = unit(ef.unit);
          const tech = CT.TECHS[ef.tech];
          let target = ef.target && (unit(ef.target) || null);
          if (ef.target === 'trigger_unit') target = this.triggerUnit && this.triggerUnit.alive ? this.triggerUnit : null;
          if (!target && ef.targetZone) target = b.living(0).find((v) => b.inZone(ef.targetZone, v.x, v.y));
          if (!target) target = b.living(0).filter((v) => v.hero).sort((p, q) => Math.abs(p.x - (u ? u.x : 0)) - Math.abs(q.x - (u ? u.x : 0)))[0];
          if (u && tech && target && u.alive) {
            const saved = { moved: b.moved, acted1: b.acted1 };
            await this.perform(u, { ...tech, range: [0, 99] }, { x: target.x, y: target.y });
            Object.assign(b, saved);
          }
          break;
        }
        case 'SET_FLAG':
          this.game.flags[ef.flag] = ef.value !== undefined ? ef.value : true;
          this.flagRound[ef.flag] = b.round;
          break;
        case 'END_BATTLE':
          this.forcedEnd = ef.result || 'victory';
          break;
        case 'SWAP_BARKS':
          break;
        default:
          console.warn('unknown effect', ef.type);
      }
      this.refresh();
    }
  }

  // ---- Entry point used by scenes ------------------------------------------------------------
  CT.runBattle = async function (id, scene, opts = {}) {
    const base = typeof id === 'string' ? CT.BATTLES[id] : id;
    if (!base) {
      console.warn('unknown battle', id);
      return 'victory';
    }
    const def = typeof id === 'string' ? { ...base, id, enemyLevel: base.enemyLevel ?? CT.BATTLE_LEVEL[id], tune: { ...(CT.BATTLE_TUNE[id] || {}), ...(base.tune || {}) } } : base;
    const g = opts.game || CT.game;
    const snap = g.serialize();
    for (;;) {
      if (CT.audio && def.music) CT.audio.playMusic(def.music);
      g.pendingXp = 0;
      g.pendingGold = 0;
      const ctl = new BattleCtl(def, g, scene);
      CT.activeBattle = ctl;
      const result = await ctl.run();
      window.LAST_BATTLE = ctl.b;
      CT.activeBattle = null;
      UI.battleHud(false);
      UI.prompt('');
      UI.clearMenus();
      if (result === 'victory') {
        if (window.TEST_LOG) window.TEST_LOG.push({ battle: def.name, result: 'victory', round: ctl.b.round, lv: g.avgLevel(), hp: ctl.b.party().map((u) => Math.round((u.hp / u.maxHp) * 100)) });
        if (CT.audio && !def.noFanfare) CT.audio.playMusic('mus_victory');
        g.syncFromBattle(ctl.b);
        const guestHp = {};
        for (const u of ctl.b.units) if (u.guest) guestHp[u.id] = u.alive ? u.hp / u.maxHp : 0.5;
        g.guestHp = guestHp;
        const rw = def.rewards || {};
        const xp = (g.pendingXp || 0) + (rw.xp || 0);
        const gold = (g.pendingGold || 0) + (rw.gold || 0);
        const ups = opts.noRewards ? [] : g.gainXp(xp);
        if (!opts.noRewards) {
          g.gold += gold;
          if (def.noFanfare) {
            for (const [k, n] of Object.entries(rw.items || {})) g.addItem(k, n);
            scene.r.setWorld(scene.world);
            return 'victory';
          }
          for (const [k, n] of Object.entries(rw.items || {})) g.addItem(k, n);
          if (rw.key) g.addKey(rw.key);
          await UI.results({ xp, gold, items: rw.items, key: rw.key, ups });
        }
        // Everyone gets back on their feet after a win.
        for (const m of Object.values(g.members)) if (m.hp < 1) m.hp = 1;
        scene.r.setWorld(scene.world);
        scene.r.rifts = scene.r.rifts.filter(() => false);
        return 'victory';
      }
      // Defeat.
      if (window.TEST_LOG) window.TEST_LOG.push({ battle: def.name, result: 'defeat', round: ctl.b.round });
      if (opts.noRetry) {
        scene.r.setWorld(scene.world);
        return 'defeat';
      }
      if (CT.AUTOPLAY && (opts.tries = (opts.tries || 0) + 1) > 2) {
        // Test mode: after repeated AI losses, skip ahead so the flow test continues.
        window.TEST_LOG && window.TEST_LOG.push({ battle: def.name, result: 'forced' });
        scene.r.setWorld(scene.world);
        return 'victory';
      }
      if (CT.audio) CT.audio.stopMusic(800);
      const choice = CT.AUTOPLAY ? 'retry' : await UI.retry();
      const restored = CT.Game.deserialize(snap);
      Object.assign(g, { members: restored.members, inventory: restored.inventory, gold: restored.gold, flags: restored.flags, unlocked: restored.unlocked, guests: restored.guests });
      if (choice === 'retry') {
        if (opts.onRetry) opts.onRetry();
        continue;
      }
      scene.r.setWorld(scene.world);
      if (choice === 'load') return { load: true };
      return 'title';
    }
  };
  CT.BattleCtl = BattleCtl;
})();
