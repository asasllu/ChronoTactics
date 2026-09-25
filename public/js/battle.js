// Tactics rules engine (no drawing, no DOM). The async flow — turns, input,
// animation and triggers — lives in battlectl.js.
(function () {
  const CT = (window.CT = window.CT || {});
  const DIRS = CT.DIRS;
  const key = (x, y) => `${x},${y}`;
  const MELEE_REACH = 2; // vertical reach for range-1 physical attacks
  const FACE_MULT = { front: 1, side: 1.25, back: 1.5 };

  // ---- Units ---------------------------------------------------------------------
  let nextUid = 1;
  class Unit {
    constructor(o) {
      Object.assign(this, {
        uid: nextUid++, team: 1, face: 1, ct: 0, alive: true, ko: false, status: {}, techs: [],
        rx: 0, ry: 0, rh: 0, ox: 0, oy: 0, oz: 0, alpha: 1, flash: 0, affinity: {}, equip: {},
      }, o);
      this.rx = this.x;
      this.ry = this.y;
    }
  }

  // Hero stats at a level, including equipment and permanent bonuses.
  CT.heroStats = function (member) {
    const H = CT.HEROES[member.id];
    const L = member.level;
    const s = {};
    for (const k of Object.keys(H.base)) s[k] = Math.round(H.base[k] + (H.growth[k] || 0) * (L - 1));
    for (const slot of Object.values(member.equip || {})) {
      const e = CT.EQUIPMENT[slot];
      if (e) for (const [k, v] of Object.entries(e.stats)) s[k] += v;
    }
    for (const [k, v] of Object.entries(member.bonus || {})) s[k] = (s[k] || 0) + v;
    return s;
  };
  CT.heroTechs = (member) => CT.HEROES[member.id].techs.filter(([, lv]) => member.level >= lv).map(([t]) => t);

  class Battle {
    constructor(def, game) {
      this.def = def;
      this.game = game;
      const mdef = CT.MAPS[def.map];
      this.map = CT.prepareMap({ id: def.map, ...mdef, terrain: [...mdef.terrain], height: [...mdef.height] });
      this.units = [];
      this.round = 1;
      this.acted = new Set();
      this.active = null;
      this.moved = false;
      this.acted1 = false;
      this.events = [];
      this.objective = def.objective || { type: 'DEFEAT_ALL' };
      this.hatch = def.hatch ? { ...def.hatch, count: 0, done: false, inert: false, max: def.hatch.max || 0 } : null;
      this.placards = def.placards ? { ...def.placards, broken: new Set() } : null;
      this.erasure = null; // curator_core's Erase Era state
      this.voided = []; // tiles temporarily voided: {x,y,t,h,until}
      this.flags = {};
      this.log = [];
    }

    // ---- Setup ----------------------------------------------------------------------
    resolveAt(at) {
      if (!at) return null;
      if (Array.isArray(at)) return { x: at[0], y: at[1] };
      if (typeof at === 'string' && at.startsWith('@')) {
        const m = this.map.markers && this.map.markers[at.slice(1)];
        if (m) return { x: m[0], y: m[1] };
        console.warn('unknown marker', at);
        return null;
      }
      if (typeof at === 'string') {
        const u = this.unitById(at);
        return u ? { x: u.x, y: u.y } : null;
      }
      return at;
    }
    // Nearest free tile a unit can stand on (spiral search).
    freeTileNear(p, u) {
      if (!p) p = { x: Math.floor(this.map.w / 2), y: Math.floor(this.map.h / 2) };
      for (let r = 0; r < 8; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const t = this.tile(p.x + dx, p.y + dy);
            if (t && this.canStand(u || { float: false }, t) && !this.unitAt(t.x, t.y)) return { x: t.x, y: t.y };
          }
      return p;
    }

    addHero(member, pos, face = 3) {
      const H = CT.HEROES[member.id];
      const s = CT.heroStats(member);
      const u = new Unit({
        id: member.id, key: member.id, sprite: member.id, name: H.name, team: 0, hero: true,
        level: member.level, maxHp: s.hp, maxMp: s.mp, hp: Math.max(1, Math.min(member.hp ?? s.hp, s.hp)),
        mp: Math.min(member.mp ?? s.mp, s.mp), atk: s.atk, def: s.def, mag: s.mag, mdef: s.mdef, spd: s.spd,
        move: s.move, jump: s.jump, float: !!H.float, swim: !!H.swim, affinity: { ...(H.affinity || {}) },
        techs: CT.heroTechs(member), weapon: H.weapon, range: H.range, x: pos.x, y: pos.y, face, member,
      });
      this.place(u);
      return u;
    }

    addEnemy(spec, team = 1) {
      const base = CT.ENEMIES[spec.type];
      if (!base) {
        console.warn('unknown enemy type', spec.type);
        return null;
      }
      let st = base;
      const lvl = spec.scale === 'party' && this.game ? this.game.avgLevel() : spec.level || (!base.fixed && this.def.enemyLevel) || 0;
      st = lvl ? CT.scaleEnemy(base, lvl) : { ...base };
      if (spec.hp) st.hp = spec.hp;
      for (const k of ['atk', 'def', 'mag', 'mdef', 'spd']) if (spec[k] != null) st = { ...st, [k]: spec[k] };
      const tune = this.def.tune || {};
      if (!base.guest && team !== 0)
        st = { ...st, hp: Math.round(st.hp * (tune.hp || 1)), atk: Math.round(st.atk * (tune.atk || 1)), mag: Math.round(st.mag * (tune.mag || tune.atk || 1)), def: Math.round(st.def * (tune.def || 1)), mdef: Math.round(st.mdef * (tune.def || 1)) };
      const pos = this.resolveAt(spec.at) || this.resolveAt(spec.near);
      const u = new Unit({
        id: spec.id || `${spec.type}_${nextUid}`, key: spec.type, type: spec.type, sprite: base.sprite, name: spec.name || base.name,
        team: spec.team ?? team, guest: !!(spec.guest || base.guest),
        maxHp: st.hp, hp: st.hp, maxMp: 999, mp: 999,
        atk: st.atk, def: st.def, mag: st.mag, mdef: st.mdef, spd: st.spd, move: spec.move ?? base.move, jump: base.jump,
        float: !!base.float, affinity: { ...base.affinity }, techs: [...base.techs], range: base.range,
        ai: spec.ai || base.ai || 'aggressive', zone: spec.zone, protect: spec.protect, immortal: !!spec.immortal,
        carrying: !!spec.carrying, boss: !!base.boss, big: !!base.big, steal: base.steal, xp: base.xp, gold: base.gold,
        shatter: base.shatter, flicker: !!base.flicker, passive: !!spec.passive,
        face: spec.face != null ? (typeof spec.face === 'string' ? CT.FACE[spec.face] : spec.face) : 2,
        x: 0, y: 0,
      });
      if (base.guest || spec.guest) {
        u.team = 0;
        u.guest = true;
      }
      const p = spec.near || !pos || this.unitAt(pos.x, pos.y) ? this.freeTileNear(pos, u) : pos;
      u.x = p.x;
      u.y = p.y;
      this.place(u);
      return u;
    }

    place(u) {
      u.rx = u.x;
      u.ry = u.y;
      const t = this.tile(u.x, u.y);
      u.rh = t ? this.visH(t) : 0;
      this.units.push(u);
    }

    // ---- Map queries -----------------------------------------------------------------
    tile(x, y) {
      if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return null;
      return this.map.tiles[y][x];
    }
    visH(t) {
      const m = CT.TERRAIN[t.t];
      return t.h - ((m && m.depthOffset) || 0);
    }
    unitAt(x, y) {
      return this.units.find((u) => u.alive && u.x === x && u.y === y) || null;
    }
    bodyAt(x, y) {
      return this.units.find((u) => u.ko && u.x === x && u.y === y) || null;
    }
    unitById(id) {
      return this.units.find((u) => u.id === id && (u.alive || u.ko)) || this.units.find((u) => u.id === id) || null;
    }
    living(team) {
      return this.units.filter((u) => u.alive && (team === undefined || u.team === team));
    }
    party() {
      return this.units.filter((u) => u.team === 0 && u.hero);
    }
    foesOf(u) {
      return this.living().filter((v) => this.hostile(u, v));
    }
    hostile(a, b) {
      if (a.team === 2 || b.team === 2) return false;
      return a.team !== b.team;
    }
    decorBlocks(t) {
      const d = this.map.decorAt.get(key(t.x, t.y));
      return !!(d && !d.hidden && CT.DECOR[d.kind] && CT.DECOR[d.kind].blocks);
    }
    canStand(u, t) {
      if (!t) return false;
      const m = CT.TERRAIN[t.t];
      if (!m || m.void || m.lava) return false;
      if (this.decorBlocks(t)) return false;
      if (m.walk) return true;
      return !!(m.swim && (u.swim || u.float));
    }
    canPass(u, t) {
      if (!t) return false;
      if (this.canStand(u, t)) return true;
      const m = CT.TERRAIN[t.t];
      return !!(u.float && m && (m.void || m.lava || m.swim) && !this.decorBlocks(t));
    }
    inZone(zone, x, y) {
      const z = this.map.zones[zone];
      return !!(z && z.has(key(x, y)));
    }

    // Dijkstra over tiles within move range. Climbing more than JUMP costs one
    // extra step per level; floaters ignore height. Allies can be passed through.
    reachable(u, from = { x: u.x, y: u.y }, move = u.move) {
      const dist = new Map();
      const start = { x: from.x, y: from.y, d: 0, prev: null };
      dist.set(key(from.x, from.y), start);
      const open = [start];
      while (open.length) {
        open.sort((a, b) => a.d - b.d);
        const cur = open.shift();
        const ct = this.tile(cur.x, cur.y);
        for (const [dx, dy] of DIRS) {
          const nx = cur.x + dx;
          const ny = cur.y + dy;
          const nt = this.tile(nx, ny);
          if (!this.canPass(u, nt)) continue;
          let cost = 1;
          if (!u.float) {
            const up = nt.h - ct.h;
            if (up > u.jump) cost += up - u.jump;
            if (-up > u.jump + 2) continue; // too far to drop
          }
          const d = cur.d + cost;
          if (d > move) continue;
          const occ = this.unitAt(nx, ny);
          if (occ && this.hostile(u, occ)) continue;
          const k = key(nx, ny);
          const old = dist.get(k);
          if (old && old.d <= d) continue;
          const node = { x: nx, y: ny, d, prev: cur };
          dist.set(k, node);
          open.push(node);
        }
      }
      const out = new Map();
      for (const [k, n] of dist) {
        const occ = this.unitAt(n.x, n.y);
        if (occ && occ !== u) continue;
        if (this.bodyAt(n.x, n.y) && !(n.x === u.x && n.y === u.y)) continue;
        if (!this.canStand(u, this.tile(n.x, n.y))) continue;
        out.set(k, n);
      }
      return out;
    }
    pathTo(node) {
      const path = [];
      for (let n = node; n; n = n.prev) path.unshift({ x: n.x, y: n.y });
      return path;
    }
    // Unlimited-range path distance (for AI advancing); ignores units except hostiles.
    distanceField(u, targets) {
      const d = new Map();
      const q = [];
      for (const t of targets) {
        d.set(key(t.x, t.y), 0);
        q.push(t);
      }
      while (q.length) {
        const c = q.shift();
        const cd = d.get(key(c.x, c.y));
        const ct = this.tile(c.x, c.y);
        for (const [dx, dy] of DIRS) {
          const n = this.tile(c.x + dx, c.y + dy);
          if (!n || !this.canPass(u, n) || d.has(key(n.x, n.y))) continue;
          if (!u.float && Math.abs(n.h - ct.h) > Math.max(u.jump + 1, 3)) continue;
          d.set(key(n.x, n.y), cd + 1);
          q.push(n);
        }
      }
      return d;
    }

    // ---- Stats & statuses -----------------------------------------------------------
    stat(u, s) {
      let v = u[s];
      if (s === 'spd') {
        if (u.status.slow) v *= 0.6;
        if (u.status.haste) v *= 1.4;
      }
      if (s === 'mag' && u.status.magdown) v *= 0.5;
      return v;
    }
    addStatus(u, name, turns) {
      if (!u.alive) return false;
      if (u.boss && name === 'stun') return false;
      u.status[name] = turns === 'permanent' ? Infinity : turns;
      return true;
    }

    // ---- Charge Time ------------------------------------------------------------------
    nextActor() {
      for (let guard = 0; guard < 10000; guard++) {
        const ready = this.living().filter((u) => u.ct >= 100);
        if (ready.length) {
          ready.sort((a, b) => b.ct - a.ct || a.uid - b.uid);
          return ready[0];
        }
        for (const u of this.living()) u.ct += Math.max(1, this.stat(u, 'spd'));
      }
      return this.living()[0];
    }
    predictOrder(n) {
      const sim = this.living().map((u) => ({ u, ct: u.ct }));
      if (this.active) {
        const me = sim.find((s) => s.u === this.active);
        if (me) me.ct -= this.turnCost();
      }
      const order = [];
      for (let guard = 0; order.length < n && guard < 3000; guard++) {
        const ready = sim.filter((s) => s.ct >= 100);
        if (ready.length) {
          ready.sort((a, b) => b.ct - a.ct || a.u.uid - b.u.uid);
          order.push(ready[0].u);
          ready[0].ct -= 100;
        } else for (const s of sim) s.ct += Math.max(1, this.stat(s.u, 'spd'));
      }
      return order;
    }
    beginTurn(u) {
      this.active = u;
      this.moved = false;
      this.acted1 = false;
      this.startPos = { x: u.x, y: u.y };
    }
    turnCost() {
      if (this.moved && this.acted1) return 100;
      if (this.moved || this.acted1) return 80;
      return 60;
    }
    // Ends a unit's turn. Returns true when a new round began.
    endTurn() {
      const u = this.active;
      let newRound = false;
      if (u) {
        u.ct = Math.max(0, u.ct - this.turnCost());
        for (const s of Object.keys(u.status)) {
          if (u.status[s] === Infinity) continue;
          u.status[s] -= 1;
          if (u.status[s] <= 0) delete u.status[s];
        }
        this.acted.add(u.uid);
        if (this.living().every((v) => this.acted.has(v.uid))) {
          this.round += 1;
          this.acted.clear();
          newRound = true;
        }
      }
      this.active = null;
      return newRound;
    }

    // ---- Techs ---------------------------------------------------------------------
    tech(id) {
      return CT.TECHS[id];
    }
    attackOf(u) {
      const range = u.range || [1, 1];
      return { id: 'attack', name: 'Attack', mp: 0, range, shape: 'single', r: 0, target: 'enemy', kind: 'phys', stat: 'atk', mult: 1, elem: 'none', isAttack: true, vfx: 'hit', sfx: 'sfx_sword_hit', proj: range[1] > 1 ? 'shot' : null };
    }
    // Members that must join a dual/triple tech.
    partnersFor(u, tech) {
      if (!tech.dual) return [];
      return tech.dual.slice(1).map((id) => this.units.find((v) => v.id === id && v.alive && v.team === u.team));
    }
    // Dual/triple techs usable right now: unlocked, levels met, partners alive,
    // CT >= 50 and within 3 tiles, and everyone has the MP.
    dualsFor(u) {
      if (!u.hero) return [];
      const out = [];
      for (const t of Object.values(CT.TECHS)) {
        if (!t.dual || t.dual[0] !== u.id) continue;
        const status = this.dualStatus(u, t);
        if (status.known) out.push({ tech: t, ...status });
      }
      return out;
    }
    dualStatus(u, t) {
      const unlocked = this.game ? this.game.isTechUnlocked(t) : true;
      const partners = this.partnersFor(u, t);
      const members = [u, ...partners];
      const present = partners.every(Boolean);
      const levelOk = !t.lv || members.every((m) => m && m.level >= t.lv);
      const known = unlocked && present && levelOk;
      let why = '';
      if (known) {
        for (const p of partners) {
          if (p.ct < 50) why = `${p.name} not ready (CT ${Math.floor(p.ct)}/50)`;
          else if (Math.abs(p.x - u.x) + Math.abs(p.y - u.y) > 3) why = `${p.name} too far`;
          else if (p.status.stun || p.status.stasis) why = `${p.name} can't act`;
        }
        for (const m of members) if (m.mp < t.mp) why = `${m.name} lacks MP`;
      }
      return { known, usable: known && !why, why, partners };
    }
    usableTechs(u) {
      return u.techs.map((id) => CT.TECHS[id]).filter((t) => t && t.mp <= u.mp);
    }

    // Tiles a tech can be aimed at from a position.
    tilesInRange(u, from, tech) {
      const out = [];
      const [lo, hiBase] = tech.range;
      const ft = this.tile(from.x, from.y);
      if (tech.range[1] === 0) return [ft];
      for (let y = 0; y < this.map.h; y++)
        for (let x = 0; x < this.map.w; x++) {
          const t = this.tile(x, y);
          if (CT.TERRAIN[t.t].void) continue;
          const d = Math.abs(x - from.x) + Math.abs(y - from.y);
          let hi = hiBase;
          if (hiBase > 1 && t.h < ft.h) hi += 1; // high ground extends ranged reach
          if (d < lo || d > hi) continue;
          if (hiBase === 1 && tech.kind === 'phys' && tech.shape === 'single' && !tech.special) {
            if (Math.abs(t.h - ft.h) > MELEE_REACH) continue;
          }
          out.push(t);
        }
      return out;
    }

    // Tiles affected when a tech from `from` is aimed at `center`.
    areaTiles(u, from, tech, center) {
      const out = [];
      const add = (x, y) => {
        const t = this.tile(x, y);
        if (t && !out.includes(t)) out.push(t);
      };
      switch (tech.shape) {
        case 'square':
          for (let dy = -tech.r; dy <= tech.r; dy++) for (let dx = -tech.r; dx <= tech.r; dx++) add(center.x + dx, center.y + dy);
          break;
        case 'radius':
          for (let dy = -tech.r; dy <= tech.r; dy++)
            for (let dx = -tech.r; dx <= tech.r; dx++) if (Math.abs(dx) + Math.abs(dy) <= tech.r) add(center.x + dx, center.y + dy);
          break;
        case 'ring':
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) add(from.x + dx, from.y + dy);
          break;
        case 'aura':
          for (let dy = -tech.r; dy <= tech.r; dy++)
            for (let dx = -tech.r; dx <= tech.r; dx++) if (Math.abs(dx) + Math.abs(dy) <= tech.r) add(from.x + dx, from.y + dy);
          break;
        case 'line': {
          const f = CT.dirTo(from.x, from.y, center.x, center.y);
          const [dx, dy] = DIRS[f];
          for (let i = 1; i <= tech.r; i++) add(from.x + dx * i, from.y + dy * i);
          break;
        }
        case 'cone': {
          const f = CT.dirTo(from.x, from.y, center.x, center.y);
          const [dx, dy] = DIRS[f];
          for (let i = 1; i <= tech.r; i++) for (let w = -(i - 1); w <= i - 1; w++) add(from.x + dx * i + dy * w, from.y + dy * i + dx * w);
          break;
        }
        case 'cross':
          add(center.x, center.y);
          for (const [dx, dy] of DIRS) for (let i = 1; i <= tech.r; i++) add(center.x + dx * i, center.y + dy * i);
          break;
        case 'map':
          for (const row of this.map.tiles) for (const t of row) out.push(t);
          break;
        default:
          add(center.x, center.y);
      }
      return out;
    }

    targetsOf(u, from, tech, center) {
      const tiles = this.areaTiles(u, from, tech, center);
      const set = new Set(tiles.map((t) => key(t.x, t.y)));
      return this.living().filter((v) => {
        if (!set.has(key(v.x, v.y))) return false;
        if (v === u && ((tech.target !== 'ally' && tech.target !== 'self') || tech.noSelf)) return false;
        if (tech.target === 'enemy') return this.hostile(u, v);
        if (tech.target === 'ally') return !this.hostile(u, v) && v.team !== 2 || v === u;
        return true;
      }).filter((v) => !(tech.special === 'needs_catalogued' && !v.status.catalogued));
    }

    // Whether a tech aimed at `center` from `from` is legal.
    validAim(u, from, tech, center) {
      if (tech.special === 'leap' || tech.special === 'dash') {
        const v = this.unitAt(center.x, center.y);
        if (!v || !this.hostile(u, v)) return false;
        return !!this.approachTile(u, from, v, tech.special === 'dash' ? 2 : 4);
      }
      if (tech.special === 'rearrange' || tech.special === 'reconstruct' || tech.special === 'core_rain' || tech.special === 'erase') return true;
      return this.targetsOf(u, from, tech, center).length > 0;
    }
    // Free tile next to a victim for leap/dash techs.
    approachTile(u, from, v, maxDist) {
      let best = null;
      for (const [dx, dy] of DIRS) {
        const t = this.tile(v.x + dx, v.y + dy);
        if (!t) continue;
        const occ = this.unitAt(t.x, t.y);
        if ((occ && occ !== u) || !this.canStand(u, t)) continue;
        const d = Math.abs(t.x - from.x) + Math.abs(t.y - from.y);
        if (d > maxDist) continue;
        if (!best || d < best.d) best = { x: t.x, y: t.y, d };
      }
      return best;
    }

    flank(attackerPos, target) {
      const dx = attackerPos.x - target.x;
      const dy = attackerPos.y - target.y;
      const [fx, fy] = DIRS[target.face];
      const along = dx * fx + dy * fy;
      const across = Math.abs(dx * fy - dy * fx);
      if (along > across) return 'front';
      if (-along > across) return 'back';
      return 'side';
    }

    // Attacking power and defence for a tech.
    power(u, tech, v) {
      const members = tech.dual ? [u, ...this.partnersFor(u, tech)].filter(Boolean) : [u];
      const sum = (s) => members.reduce((a, m) => a + this.stat(m, s), 0);
      switch (tech.stat) {
        case 'mag': return [this.stat(u, 'mag'), v ? v.mdef : 0];
        case 'atkmag': return [this.stat(u, 'atk') + this.stat(u, 'mag'), v ? (v.def + v.mdef) / 2 : 0];
        case 'pair_atk': return [sum('atk'), v ? v.def : 0];
        case 'pair_mag': return [sum('mag'), v ? v.mdef : 0];
        case 'pair_both': return [members.reduce((a, m) => a + Math.max(this.stat(m, 'atk'), this.stat(m, 'mag')), 0), v ? (v.def + v.mdef) / 2 : 0];
        case 'triple': return [members.reduce((a, m) => a + (m.id === 'magus' ? this.stat(m, 'mag') : this.stat(m, 'atk')), 0) * 0.75, v ? (v.def + v.mdef) / 2 : 0];
        default: return [this.stat(u, 'atk'), v ? v.def : 0];
      }
    }

    // Deterministic outcome preview for one target.
    preview(u, from, tech, v) {
      const ft = this.tile(from.x, from.y);
      const vt = this.tile(v.x, v.y);
      if (tech.kind === 'heal') {
        const [P] = this.power(u, tech, null);
        const amt = Math.round(P * tech.mult * 4);
        return { kind: 'heal', amount: Math.min(amt, v.maxHp - v.hp), raw: amt, hit: 100 };
      }
      if (tech.kind === 'status' || tech.kind === 'special') return { kind: 'status', amount: 0, hit: 100 };
      if (v.status.stasis) return { kind: 'dmg', amount: 0, hit: 100, immune: true };
      const physical = tech.kind === 'phys';
      let [A, D] = this.power(u, tech, v);
      let mult = tech.mult;
      if (tech.special === 'squash') mult *= 1 + 2 * (1 - u.hp / u.maxHp);
      let dmg = A * mult * 2 - D;
      dmg = Math.max(1, dmg);
      let k = 1;
      if (ft.h > vt.h) k *= 1.1;
      else if (ft.h < vt.h) k *= 0.9;
      let side = null;
      let hit = 100;
      if (physical) {
        side = from.x === v.x && from.y === v.y ? 'front' : this.flank(from, v);
        k *= FACE_MULT[side];
        if (side === 'front') hit = 100 - Math.max(0, Math.min(30, (this.stat(v, 'spd') - this.stat(u, 'spd')) * 2));
      }
      const aff = v.affinity[tech.elem];
      if (aff != null) k *= aff;
      if (v.status.catalogued) k *= 1.5;
      const hits = tech.hits || 1;
      const amount = aff != null && aff < 0 ? -Math.round(dmg * Math.abs(aff)) : Math.max(1, Math.round(dmg * k)) * hits;
      return { kind: 'dmg', amount, hit, side, elemMult: aff, crit: physical ? 8 : 0 };
    }

    // ---- Resolution ------------------------------------------------------------------
    // Applies a tech. Returns { results: [...], moves: [...], spawns: [...] }.
    execute(u, tech, center, opts = {}) {
      const out = { results: [], moves: [], spawns: [], notes: [] };
      const members = tech.dual ? [u, ...this.partnersFor(u, tech)] : [u];
      for (const m of members) if (tech.mp) m.mp = Math.max(0, m.mp - tech.mp);
      if (tech.dual) for (const p of members.slice(1)) p.ct = 0;
      if (tech.range[1] > 0 && (center.x !== u.x || center.y !== u.y)) u.face = CT.dirTo(u.x, u.y, center.x, center.y);

      let from = { x: u.x, y: u.y };
      // Leap/dash: move beside the target first.
      if (tech.special === 'leap' || tech.special === 'dash') {
        const v = this.unitAt(center.x, center.y);
        const spot = v && this.approachTile(u, from, v, tech.special === 'dash' ? 2 : 4);
        if (spot) {
          out.moves.push({ unit: u, from: { ...from }, to: { x: spot.x, y: spot.y }, leap: tech.special === 'leap' });
          u.x = spot.x;
          u.y = spot.y;
          u.face = CT.dirTo(u.x, u.y, v.x, v.y);
          from = { x: u.x, y: u.y };
          this.events.push({ type: 'enter', unit: u, x: u.x, y: u.y });
        }
      }

      if (tech.special === 'rearrange') return this.doRearrange(u, center, out);
      if (tech.special === 'reconstruct') return this.doReconstruct(u, out);
      if (tech.special === 'core_rain') return this.doCoreRain(u, out);
      if (tech.special === 'steal') {
        const v = this.unitAt(center.x, center.y);
        if (v && v.steal && !v.stolen) {
          v.stolen = true;
          out.results.push({ target: v, text: `Stole ${CT.ITEMS[v.steal].name}!`, steal: v.steal });
          if (this.game) this.game.addItem(v.steal, 1);
        } else if (v) out.results.push({ target: v, text: 'Nothing!' });
        this.afterTech(u, tech, out);
        return out;
      }

      const targets = this.targetsOf(u, from, tech, center);
      for (const v of targets) {
        const p = this.preview(u, from, tech, v);
        if (tech.kind === 'status') {
          const [st, chance, turns] = tech.status;
          if (Math.random() < chance && this.addStatus(v, st, turns)) out.results.push({ target: v, status: st });
          else out.results.push({ target: v, miss: true });
          continue;
        }
        if (p.kind === 'heal') {
          if (!v.alive) continue;
          const amt = Math.round(p.raw * (0.95 + Math.random() * 0.1));
          v.hp = Math.min(v.maxHp, v.hp + amt);
          out.results.push({ target: v, heal: amt });
          continue;
        }
        if (p.immune) {
          out.results.push({ target: v, immune: true });
          continue;
        }
        if (Math.random() * 100 >= p.hit) {
          out.results.push({ target: v, miss: true });
          continue;
        }
        // Black Hole erases weakened non-bosses outright.
        if (tech.special === 'blackhole' && !v.boss && !v.immortal && v.hp < v.maxHp * 0.3) {
          const dmg = v.hp;
          this.damage(v, dmg, out, { erased: true });
          continue;
        }
        if (p.amount < 0) {
          v.hp = Math.min(v.maxHp, v.hp - p.amount);
          out.results.push({ target: v, heal: -p.amount, absorbed: true });
          continue;
        }
        const crit = p.crit && Math.random() * 100 < p.crit;
        let dmg = Math.max(1, Math.round(p.amount * (0.95 + Math.random() * 0.1) * (crit ? 1.5 : 1)));
        this.damage(v, dmg, out, { crit, side: p.side, weak: p.elemMult > 1, resist: p.elemMult != null && p.elemMult < 1 });
        if (tech.special === 'drain') {
          u.hp = Math.min(u.maxHp, u.hp + dmg);
          out.results.push({ target: u, heal: dmg });
        }
        if (tech.special === 'dispel') {
          for (const s of ['haste', 'stasis']) if (v.status[s]) {
            delete v.status[s];
            out.notes.push(`${v.name}'s ${s} was severed.`);
            break;
          }
        }
        if (tech.status && v.alive) {
          const [st, chance, turns] = tech.status;
          if (Math.random() < chance && this.addStatus(v, st, turns)) out.results.push({ target: v, status: st });
        }
        if (tech.special === 'knockback' && v.alive) this.knockback(u, v, out);
      }
      this.afterTech(u, tech, out);
      return out;
    }

    afterTech(u, tech, out) {
      this.acted1 = true;
      if (!tech.isAttack) {
        this.events.push({ type: 'tech', unit: u, tech: tech.id, dual: !!tech.dual, knockedDown: out.knockedDown });
        if (tech.id === 'eclipse_blade' && this.game) this.game.flags.eclipse_uses = (this.game.flags.eclipse_uses || 0) + 1;
        // Placards: a tech used while standing on an intact pedestal shatters it.
        if (this.placards && u.team === 0) {
          for (const z of this.placards.zones) {
            if (!this.placards.broken.has(z) && this.inZone(z, u.x, u.y)) {
              this.placards.broken.add(z);
              out.placard = z;
              const boss = this.unitById(this.placards.target);
              if (boss && boss.alive) this.damage(boss, this.placards.damage || 150, out, { placard: true });
              for (const k of this.map.zones[z]) {
                const d = this.map.decorAt.get(k);
                if (d && d.kind === 'pedestal_placard') d.variant = 4;
              }
              this.events.push({ type: 'placard', zone: z, count: this.placards.broken.size });
            }
          }
        }
      }
    }

    damage(v, dmg, out, info = {}) {
      if (v.status.stasis) {
        out.results.push({ target: v, immune: true });
        return;
      }
      v.hp = Math.max(0, v.hp - dmg);
      if (v.hp <= 0 && v.immortal) v.hp = 1;
      out.results.push({ target: v, dmg, ...info });
      if (v.hp <= 0) this.ko(v, out, info);
    }

    ko(v, out, info = {}) {
      v.hp = 0;
      v.alive = false;
      v.status = {};
      if (v.team === 0 && v.hero) {
        v.ko = true;
        this.events.push({ type: 'allyko', unit: v });
      } else if (v.guest) {
        v.ko = true;
        this.events.push({ type: 'allyko', unit: v });
        if (v.id === 'iselle' && this.game) this.game.flags.iselle_ko = true;
      }
      if (out) {
        const r = out.results.find((q) => q.target === v && q.dmg != null);
        if (r) r.ko = true;
        else out.results.push({ target: v, ko: true });
      }
      this.events.push({ type: 'defeated', unit: v, fell: info.fell });
      if (v.team === 1 && this.game) {
        this.game.pendingXp = (this.game.pendingXp || 0) + (v.xp || 0);
        this.game.pendingGold = (this.game.pendingGold || 0) + (v.gold || 0);
      }
    }

    // Rollo Kick: push the target one tile away. Drops of 2+ hurt; vitrines shatter.
    knockback(u, v, out) {
      const f = CT.dirTo(u.x, u.y, v.x, v.y);
      const [dx, dy] = DIRS[f];
      const from = this.tile(v.x, v.y);
      const to = this.tile(v.x + dx, v.y + dy);
      if (!to || this.unitAt(to.x, to.y) || this.decorBlocks(to)) return;
      const m = CT.TERRAIN[to.t];
      if (m.void && !v.float) {
        out.moves.push({ unit: v, from: { x: v.x, y: v.y }, to: { x: to.x, y: to.y }, fall: true });
        v.x = to.x;
        v.y = to.y;
        out.results.push({ target: v, text: 'FELL!' });
        if (!v.boss && !v.immortal) this.ko(v, out, { fell: true });
        return;
      }
      if (to.h > from.h) return;
      if (!this.canStand(v, to)) return;
      out.moves.push({ unit: v, from: { x: v.x, y: v.y }, to: { x: to.x, y: to.y }, push: true });
      v.x = to.x;
      v.y = to.y;
      this.events.push({ type: 'enter', unit: v, x: v.x, y: v.y });
      const drop = from.h - to.h;
      if (drop >= 1) out.knockedDown = true;
      if (v.shatter && drop >= 1) {
        out.notes.push(`${v.name} shatters!`);
        this.damage(v, v.shatter, out, { shatter: true });
      } else if (drop >= 2) {
        this.damage(v, Math.round(v.maxHp * 0.1 * drop), out, { fall: true });
      }
    }

    doRearrange(u, center, out) {
      const victim = this.unitAt(center.x, center.y);
      if (!victim) return out;
      const peds = [];
      if (this.placards)
        for (const z of this.placards.zones) {
          if (this.placards.broken.has(z)) continue;
          for (const k of this.map.zones[z] || []) {
            const [x, y] = k.split(',').map(Number);
            if (!this.unitAt(x, y) && this.canStand(victim, this.tile(x, y))) peds.push({ x, y });
          }
        }
      const pick = peds.length ? peds[Math.floor(Math.random() * peds.length)] : null;
      if (!pick) {
        out.results.push({ target: victim, text: 'RESISTED' });
        this.acted1 = true;
        return out;
      }
      out.moves.push({ unit: victim, from: { x: victim.x, y: victim.y }, to: pick, teleport: true });
      victim.x = pick.x;
      victim.y = pick.y;
      out.results.push({ target: victim, text: 'REARRANGED' });
      this.events.push({ type: 'enter', unit: victim, x: pick.x, y: pick.y });
      this.acted1 = true;
      return out;
    }

    doReconstruct(u, out) {
      for (let i = 0; i < 2; i++) {
        const p = this.freeTileNear({ x: u.x + (i ? 2 : -2), y: u.y + 1 }, { float: false });
        const s = this.addEnemy({ type: 'vitrine_sentinel', at: [p.x, p.y], face: 'S' });
        if (s) {
          s.ct = 0;
          out.spawns.push(s);
        }
      }
      this.acted1 = true;
      return out;
    }

    doCoreRain(u, out) {
      const party = this.living().filter((v) => this.hostile(u, v));
      const tiles = [];
      for (let i = 0; i < 3 && party.length; i++) {
        const v = party[Math.floor(Math.random() * party.length)];
        const c = { x: v.x + Math.round(Math.random() * 2 - 1), y: v.y + Math.round(Math.random() * 2 - 1) };
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const t = this.tile(c.x + dx, c.y + dy);
            if (t && !tiles.includes(t)) tiles.push(t);
          }
      }
      out.rainTiles = tiles;
      const tech = { ...CT.TECHS.destruction_rain, shape: 'single' };
      const hitSet = new Set(tiles.map((t) => key(t.x, t.y)));
      for (const v of party) {
        if (!hitSet.has(key(v.x, v.y))) continue;
        const p = this.preview(u, { x: u.x, y: u.y }, tech, v);
        this.damage(v, Math.max(1, Math.round(p.amount * (0.9 + Math.random() * 0.2))), out, {});
      }
      this.acted1 = true;
      return out;
    }

    // Moves a unit along a path (logic only), emitting zone-entry events.
    moveUnit(u, path) {
      for (const p of path.slice(1)) this.events.push({ type: 'enter', unit: u, x: p.x, y: p.y });
      const last = path[path.length - 1];
      u.x = last.x;
      u.y = last.y;
      this.moved = true;
    }

    // Void tiles (Erase Era / crumbling). Units standing there fall.
    voidTiles(cells, rounds, out) {
      for (const [x, y] of cells) {
        const t = this.tile(x, y);
        if (!t || CT.TERRAIN[t.t].void) continue;
        this.voided.push({ x, y, t: t.t, h: t.h, until: rounds ? this.round + rounds : Infinity });
        t.t = 'v';
        const v = this.unitAt(x, y);
        if (v && !v.float && !v.boss) {
          if (out) out.results.push({ target: v, text: 'FELL!' });
          this.ko(v, out || { results: [] }, { fell: true });
        }
        const b = this.bodyAt(x, y);
        if (b) b.hidden = true;
      }
    }
    restoreVoid() {
      const back = [];
      this.voided = this.voided.filter((vd) => {
        if (vd.until <= this.round) {
          const t = this.tile(vd.x, vd.y);
          t.t = vd.t;
          t.h = vd.h;
          back.push(t);
          return false;
        }
        return true;
      });
      return back;
    }
    fillTiles(cells, terrain, h) {
      for (const [x, y] of cells) {
        const t = this.tile(x, y);
        if (!t) continue;
        t.t = terrain;
        if (h != null) t.h = h;
      }
    }
    zoneCells(zone) {
      return [...(this.map.zones[zone] || [])].map((k) => k.split(',').map(Number));
    }

    // ---- Seeds ----------------------------------------------------------------------
    // Called at the end of every round. Returns 'hatch' when the seed hatches.
    tickHatch() {
      const h = this.hatch;
      if (!h || h.done || h.inert) return null;
      if (h.mode === 'feeders') {
        const alive = (h.feeders || []).filter((id) => { const f = this.unitById(id); return f && f.alive; }).length;
        if (!alive) {
          h.inert = true;
          return 'inert';
        }
        // The seed only grows while enough feeders survive ("every round they all survive, it grows").
        if (alive >= (h.minFeeders || 1)) h.count += 1;
      } else if (h.mode === 'guard') {
        const g = this.unitById(h.guard);
        if (!g || !g.alive) {
          h.inert = true;
          return 'inert';
        }
        h.count += 1;
      } else return null;
      if (h.count >= h.max) {
        h.done = true;
        return 'hatch';
      }
      return null;
    }
    // Carrier mode: called after the carrier ends a turn.
    carrierCheck(u) {
      const h = this.hatch;
      if (!h || h.done || h.inert || h.mode !== 'carrier' || u.id !== h.carrier) return null;
      if (this.inZone(h.zone, u.x, u.y)) {
        h.done = true;
        return 'hatch';
      }
      return null;
    }
    hatchLeft() {
      const h = this.hatch;
      if (!h || h.done || h.inert) return null;
      if (h.mode === 'carrier') return null;
      return h.max - h.count;
    }

    // ---- Objectives -----------------------------------------------------------------
    outcome() {
      const heroes = this.units.filter((u) => u.team === 0 && u.hero);
      if (heroes.length && heroes.every((u) => !u.alive)) return 'defeat';
      const o = this.objective;
      const enemies = this.units.filter((u) => u.team === 1);
      const dead = (id) => {
        const u = this.units.find((v) => v.id === id);
        return !u || !u.alive || u.despawned;
      };
      switch (o.type) {
        case 'DEFEAT_ALL':
          return enemies.every((u) => !u.alive) ? 'victory' : null;
        case 'DEFEAT_UNIT':
          return dead(o.unit) ? 'victory' : null;
        case 'DEFEAT_UNITS':
          return o.units.every(dead) ? 'victory' : null;
        case 'DEFEAT_TYPE':
          return enemies.filter((u) => u.type === o.enemyType).every((u) => !u.alive) ? 'victory' : null;
        case 'SURVIVE':
          return this.round > o.rounds ? 'victory' : null;
        default:
          return null;
      }
    }

    // ---- AI --------------------------------------------------------------------------
    // Returns { dest (reachable node or null), tech, target } or a special plan.
    planAI(u) {
      const ai = u.ai || 'aggressive';
      if (u.passive || ai === 'passive') return { dest: null, tech: null };
      if (ai === 'curator') return this.planCurator(u);
      if (ai === 'curator_core') return this.planCore(u);
      const canMove = !['hold', 'sprout'].includes(ai) && u.move > 0;
      let reach = canMove ? this.reachable(u) : new Map([[key(u.x, u.y), { x: u.x, y: u.y, d: 0, prev: null }]]);
      if (ai === 'guard_zone' && u.zone) {
        const zc = this.zoneCells(u.zone);
        reach = new Map([...reach].filter(([, n]) => zc.some(([x, y]) => Math.abs(x - n.x) + Math.abs(y - n.y) <= 2)));
        if (!reach.size) reach = new Map([[key(u.x, u.y), { x: u.x, y: u.y, d: 0, prev: null }]]);
      }
      if (ai === 'protect' && u.protect) {
        const p = this.unitById(u.protect);
        if (p && p.alive) {
          const near = new Map([...reach].filter(([, n]) => Math.abs(p.x - n.x) + Math.abs(p.y - n.y) <= 3));
          if (near.size) reach = near;
        }
      }
      // Carriers head for the planting zone before anything else.
      if (ai === 'seek_zone' && u.zone) {
        const zc = this.zoneCells(u.zone).map(([x, y]) => ({ x, y }));
        const df = this.distanceField(u, zc);
        let best = null;
        for (const n of reach.values()) {
          const d = df.get(key(n.x, n.y)) ?? 99;
          if (!best || d < best.dd || (d === best.dd && n.d < best.node.d)) best = { node: n, dd: d };
        }
        const dest = best ? best.node : null;
        const act = dest ? this.bestActionFrom(u, dest, true) : null;
        return { dest, tech: act && act.tech, target: act && act.target };
      }
      const techs = [this.attackOf(u), ...u.techs.map((id) => CT.TECHS[id]).filter((t) => t && t.mp <= u.mp)];
      let best = null;
      for (const node of reach.values()) {
        const act = this.bestActionFrom(u, node, false, techs);
        if (!act) continue;
        let score = act.score - node.d * 0.004;
        if (ai === 'ranged' || ai === 'healer') score += this.safety(u, node) * 0.05;
        if (!best || score > best.score) best = { score, dest: node, tech: act.tech, target: act.target };
      }
      if (best && best.score > 0.02) return best;
      // Advance toward the nearest foe.
      if (!canMove) return { dest: null, tech: null };
      const foes = this.foesOf(u);
      if (!foes.length) return { dest: null, tech: null };
      let goal = ai === 'protect' && u.protect && this.unitById(u.protect)?.alive ? [this.unitById(u.protect)] : foes;
      // Heroes chase objective targets (seed carriers / DEFEAT_UNIT) rather than the nearest foe.
      if (u.team === 0) {
        const o = this.objective || {};
        const obj = foes.filter((f) => f.carrying || f.id === o.unit || (o.units || []).includes(f.id) || (this.hatch && !this.hatch.done && ((this.hatch.feeders || []).includes(f.id) || this.hatch.guard === f.id)));
        if (obj.length) goal = obj;
      }
      const df = this.distanceField(u, goal.map((f) => ({ x: f.x, y: f.y })));
      let adv = null;
      for (const n of reach.values()) {
        const d = df.get(key(n.x, n.y)) ?? 99;
        if (!adv || d < adv.dd || (d === adv.dd && n.d < adv.node.d)) adv = { node: n, dd: d };
      }
      return { dest: adv ? adv.node : null, tech: null };
    }

    safety(u, node) {
      const foes = this.foesOf(u);
      if (!foes.length) return 0;
      return Math.min(...foes.map((f) => Math.abs(f.x - node.x) + Math.abs(f.y - node.y)));
    }

    // Best tech+target from a tile. Temporarily moves the unit there to evaluate.
    bestActionFrom(u, node, onlyAttack, techs) {
      techs = techs || [this.attackOf(u), ...u.techs.map((id) => CT.TECHS[id]).filter((t) => t && t.mp <= u.mp && !['rearrange', 'reconstruct', 'core_rain', 'erase_era'].includes(t.id))];
      const ox = u.x;
      const oy = u.y;
      u.x = node.x;
      u.y = node.y;
      let best = null;
      for (const tech of techs) {
        for (const t of this.tilesInRange(u, node, tech)) {
          if (!this.validAim(u, node, tech, t)) continue;
          const score = this.scoreAim(u, node, tech, t);
          if (score > 0 && (!best || score > best.score)) best = { score, tech, target: { x: t.x, y: t.y } };
        }
      }
      u.x = ox;
      u.y = oy;
      return best;
    }

    scoreAim(u, node, tech, t) {
      const hits = tech.special === 'leap' || tech.special === 'dash' ? [this.unitAt(t.x, t.y)].filter(Boolean) : this.targetsOf(u, node, tech, t);
      let score = 0;
      for (const v of hits) {
        if (tech.kind === 'heal') {
          const missing = v.maxHp - v.hp;
          if (missing < v.maxHp * 0.3) continue;
          const p = this.preview(u, node, tech, v);
          score += (p.amount / v.maxHp) * 1.5 * (v.boss || v.id === 'iselle' ? 1.5 : 1);
        } else if (tech.kind === 'status') {
          const st = tech.status[0];
          if (v.status[st]) continue;
          if (st === 'stasis') {
            if (v.hp < v.maxHp * 0.45) score += 0.5;
          } else score += 0.28;
        } else if (tech.kind === 'special') {
          if (tech.special === 'steal') continue;
        } else {
          const p = this.preview(u, node, tech, v);
          if (p.immune || p.amount <= 0) continue;
          const exp = Math.min(p.amount, v.hp) * (p.hit / 100);
          score += exp / v.maxHp;
          if (p.amount >= v.hp) score += 0.6 * (p.hit / 100);
          // Objective targets matter most (seed carriers, DEFEAT_UNIT targets).
          const o = this.objective || {};
          if (v.carrying || (o.unit && o.unit === v.id) || (o.units && o.units.includes(v.id))) score += 0.5 + exp / v.maxHp;
          if (this.hatch && !this.hatch.done && ((this.hatch.feeders || []).includes(v.id) || this.hatch.guard === v.id)) score += 0.4;
        }
      }
      return score;
    }

    // Phase 1: immobile; reconstructs every 3 rounds, executes catalogued units,
    // otherwise catalogues clusters or rearranges someone onto a pedestal.
    planCurator(u) {
      const party = this.foesOf(u);
      const here = { x: u.x, y: u.y, d: 0, prev: null };
      if (this.round % 3 === 0 && this.lastReconstruct !== this.round) {
        this.lastReconstruct = this.round;
        return { dest: null, tech: CT.TECHS.reconstruct, target: { x: u.x, y: u.y } };
      }
      const cat = party.filter((v) => v.status.catalogued);
      if (cat.length) {
        const v = cat.sort((a, b) => a.hp - b.hp)[0];
        return { dest: null, tech: CT.TECHS.deaccession, target: { x: v.x, y: v.y } };
      }
      const intact = this.placards ? this.placards.zones.filter((z) => !this.placards.broken.has(z)) : [];
      if (intact.length && Math.random() < 0.4 && party.length) {
        const v = party[Math.floor(Math.random() * party.length)];
        return { dest: null, tech: CT.TECHS.rearrange, target: { x: v.x, y: v.y } };
      }
      const act = this.bestActionFrom(u, here, false, [CT.TECHS.catalogue_all]);
      if (act) return { dest: null, tech: act.tech, target: act.target };
      return { dest: null, tech: null };
    }

    // Phase 2: lurches toward the party; Erase Era every 4 rounds (warned a round
    // ahead), Consume when adjacent, Destruction Rain otherwise.
    planCore(u) {
      if (this.erasure && this.erasure.pending && this.round >= this.erasure.round) {
        return { dest: null, tech: CT.TECHS.erase_era, target: { x: u.x, y: u.y } };
      }
      const reach = this.reachable(u);
      let best = null;
      for (const node of reach.values()) {
        const act = this.bestActionFrom(u, node, false, [CT.TECHS.consume]);
        if (act && (!best || act.score > best.score)) best = { ...act, dest: node };
      }
      if (best && Math.random() < 0.6) return { dest: best.dest, tech: best.tech, target: best.target };
      const foes = this.foesOf(u);
      const df = this.distanceField(u, foes.map((f) => ({ x: f.x, y: f.y })));
      let adv = null;
      for (const n of reach.values()) {
        const d = df.get(key(n.x, n.y)) ?? 99;
        if (!adv || d < adv.dd) adv = { node: n, dd: d };
      }
      return { dest: adv && adv.node, tech: CT.TECHS.core_rain, target: { x: u.x, y: u.y } };
    }
  }

  CT.Unit = Unit;
  CT.Battle = Battle;
})();
