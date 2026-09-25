// Battle rules: units, movement, Charge-Time turn order, combat and AI.
// Pure game state — no drawing or DOM here.
(function () {
  const CT = (window.CT = window.CT || {});

  const DIRS = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const MELEE_REACH = 2; // max height difference for range-1 physical attacks

  const ATTACK = { name: 'Attack', mp: 0, aoe: 0, kind: 'dmg', stat: 'atk', power: 1.0, elem: 'hit', isAttack: true };

  function dirTo(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
    return dy >= 0 ? 1 : 3;
  }

  class Unit {
    constructor(id, spec) {
      const c = CT.CHARACTERS[spec.key];
      Object.assign(this, JSON.parse(JSON.stringify(c)));
      this.id = id;
      this.key = spec.key;
      this.team = spec.team;
      this.x = spec.x;
      this.y = spec.y;
      this.face = spec.face;
      this.maxHp = c.hp;
      this.maxMp = c.mp;
      this.ct = 0;
      this.alive = true;
      // Render state (interpolated position, effects).
      this.rx = this.x;
      this.ry = this.y;
      this.rh = 0;
      this.ox = 0;
      this.oy = 0;
      this.alpha = 1;
      this.flash = 0;
    }
  }

  class Battle {
    constructor(mapDef, roster) {
      this.size = mapDef.size;
      this.tiles = mapDef.tiles.map((r) => r.map((t) => ({ ...t })));
      const names = {};
      this.units = roster.map((spec, i) => {
        const u = new Unit(i, spec);
        names[u.name] = (names[u.name] || 0) + 1;
        if (roster.filter((s) => s.key === spec.key).length > 1) u.name += ' ' + String.fromCharCode(64 + names[u.name]);
        u.rh = this.tile(u.x, u.y).h;
        return u;
      });
      this.active = null;
      this.moved = false;
      this.acted = false;
    }

    tile(x, y) {
      if (x < 0 || y < 0 || x >= this.size || y >= this.size) return null;
      return this.tiles[y][x];
    }
    unitAt(x, y) {
      return this.units.find((u) => u.alive && u.x === x && u.y === y) || null;
    }
    living(team) {
      return this.units.filter((u) => u.alive && (team === undefined || u.team === team));
    }

    canStand(u, t) {
      if (!t) return false;
      const info = CT.TERRAIN_INFO[t.t];
      return info.walk || (info.swim && u.swim);
    }

    // BFS over tiles within move range, respecting jump height. Units may
    // pass through allies but not enemies, and can't stop on anyone.
    reachable(u, from = { x: u.x, y: u.y }) {
      const start = `${from.x},${from.y}`;
      const seen = new Map([[start, { x: from.x, y: from.y, d: 0, prev: null }]]);
      const queue = [seen.get(start)];
      while (queue.length) {
        const cur = queue.shift();
        if (cur.d >= u.move) continue;
        const ct = this.tile(cur.x, cur.y);
        for (const [dx, dy] of DIRS) {
          const nx = cur.x + dx;
          const ny = cur.y + dy;
          const key = `${nx},${ny}`;
          if (seen.has(key)) continue;
          const nt = this.tile(nx, ny);
          if (!this.canStand(u, nt)) continue;
          if (Math.abs(nt.h - ct.h) > u.jump) continue;
          const occ = this.unitAt(nx, ny);
          if (occ && occ.team !== u.team) continue;
          const node = { x: nx, y: ny, d: cur.d + 1, prev: cur };
          seen.set(key, node);
          queue.push(node);
        }
      }
      const out = new Map();
      for (const [k, n] of seen) {
        const occ = this.unitAt(n.x, n.y);
        if (occ && occ !== u) continue;
        out.set(k, n);
      }
      return out;
    }

    pathTo(node) {
      const path = [];
      for (let n = node; n; n = n.prev) path.unshift({ x: n.x, y: n.y });
      return path;
    }

    // ---- Charge Time ------------------------------------------------------
    // Every tick each living unit gains CT equal to its Speed; the first to
    // reach 100 acts. Ending a turn costs 60 CT, +20 each for moving/acting.
    nextActor() {
      for (;;) {
        const ready = this.living().filter((u) => u.ct >= 100);
        if (ready.length) {
          ready.sort((a, b) => b.ct - a.ct || a.id - b.id);
          return ready[0];
        }
        for (const u of this.living()) u.ct += u.spd;
      }
    }

    predictOrder(n) {
      const sim = this.living().map((u) => ({ u, ct: u.ct }));
      if (this.active) {
        const me = sim.find((s) => s.u === this.active);
        if (me) me.ct -= this.turnCost();
      }
      const order = [];
      let guard = 0;
      while (order.length < n && guard++ < 1000) {
        const ready = sim.filter((s) => s.ct >= 100);
        if (ready.length) {
          ready.sort((a, b) => b.ct - a.ct || a.u.id - b.u.id);
          order.push(ready[0].u);
          ready[0].ct -= 100;
        } else for (const s of sim) s.ct += s.u.spd;
      }
      return order;
    }

    beginTurn(u) {
      this.active = u;
      this.moved = false;
      this.acted = false;
    }
    turnCost() {
      return 60 + (this.moved ? 20 : 0) + (this.acted ? 20 : 0);
    }
    endTurn() {
      if (this.active) this.active.ct = Math.max(0, this.active.ct - this.turnCost());
      this.active = null;
    }

    // ---- Targeting -------------------------------------------------------
    actionOf(u, techKey) {
      if (!techKey) return { ...ATTACK, range: u.range, proj: u.proj };
      return { ...CT.TECHS[techKey], key: techKey };
    }

    tilesInRange(from, action) {
      const out = [];
      const [lo, hi] = action.range;
      for (let y = 0; y < this.size; y++)
        for (let x = 0; x < this.size; x++) {
          const d = Math.abs(x - from.x) + Math.abs(y - from.y);
          if (d < lo || d > hi) continue;
          if (action.isAttack && hi === 1) {
            const dh = Math.abs(this.tile(x, y).h - this.tile(from.x, from.y).h);
            if (dh > MELEE_REACH) continue;
          }
          out.push(this.tile(x, y));
        }
      return out;
    }

    aoeTiles(center, action) {
      const out = [];
      const r = action.aoe || 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > r) continue;
          const t = this.tile(center.x + dx, center.y + dy);
          if (t) out.push(t);
        }
      return out;
    }

    affected(u, action, center) {
      const wantTeam = action.kind === 'heal' ? u.team : 1 - u.team;
      return this.aoeTiles(center, action)
        .map((t) => this.unitAt(t.x, t.y))
        .filter((v) => v && v.team === wantTeam);
    }

    // Relative position of attacker to target, given the target's facing.
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

    // Deterministic preview (no variance) of what an action does to a target.
    preview(u, from, action, target) {
      const fromH = this.tile(from.x, from.y).h;
      if (action.kind === 'heal') {
        const amt = Math.round(u.mag * action.power * 1.3);
        return { kind: 'heal', amount: Math.min(amt, target.maxHp - target.hp), raw: amt, hit: 100 };
      }
      const physical = action.stat === 'atk';
      const base = (physical ? u.atk : u.mag) * action.power * (physical ? 1.25 : 0.95);
      const def = physical ? target.def : target.mdef;
      let mult = 60 / (60 + def);
      const dh = fromH - this.tile(target.x, target.y).h;
      mult *= 1 + Math.max(-0.3, Math.min(0.3, dh * 0.1));
      let hit = 100;
      let side = null;
      if (physical) {
        side = from.x === target.x && from.y === target.y ? 'front' : this.flank(from, target);
        mult *= { front: 1, side: 1.25, back: 1.5 }[side];
        hit = { front: 82, side: 91, back: 100 }[side];
      }
      const amount = Math.max(1, Math.round(base * mult));
      return { kind: 'dmg', amount, hit, side };
    }

    // Resolve an action. Returns per-target results for the renderer.
    execute(u, action, center) {
      if (action.mp) u.mp -= action.mp;
      if (center.x !== u.x || center.y !== u.y) u.face = dirTo(u.x, u.y, center.x, center.y);
      const results = [];
      for (const t of this.affected(u, action, center)) {
        const p = this.preview(u, u, action, t);
        if (Math.random() * 100 >= p.hit) {
          results.push({ target: t, miss: true });
          continue;
        }
        if (p.kind === 'heal') {
          const amt = Math.round(p.raw * (0.95 + Math.random() * 0.1));
          t.hp = Math.min(t.maxHp, t.hp + amt);
          results.push({ target: t, heal: amt });
        } else {
          const amt = Math.max(1, Math.round(p.amount * (0.9 + Math.random() * 0.2)));
          t.hp = Math.max(0, t.hp - amt);
          const ko = t.hp === 0;
          if (ko) t.alive = false;
          results.push({ target: t, dmg: amt, ko, side: p.side });
        }
      }
      this.acted = true;
      return results;
    }

    outcome() {
      if (!this.living(1).length) return 'victory';
      if (!this.living(0).length) return 'defeat';
      return null;
    }

    // ---- AI ----------------------------------------------------------------
    // Scores every (destination, action, target tile) combination and picks
    // the best. Falls back to advancing on the nearest foe.
    planAI(u) {
      const reach = this.reachable(u);
      const actions = [this.actionOf(u)];
      for (const k of u.techs) if (CT.TECHS[k].mp <= u.mp) actions.push(this.actionOf(u, k));

      let best = null;
      for (const node of reach.values()) {
        const from = { x: node.x, y: node.y };
        // Pretend the unit stands at `from` while evaluating.
        const ox = u.x;
        const oy = u.y;
        u.x = from.x;
        u.y = from.y;
        for (const action of actions) {
          for (const t of this.tilesInRange(from, action)) {
            const hits = this.affected(u, action, t);
            if (!hits.length) continue;
            let score = 0;
            for (const v of hits) {
              const p = this.preview(u, from, action, v);
              if (p.kind === 'heal') {
                const missing = v.maxHp - v.hp;
                if (missing < v.maxHp * 0.3) continue;
                score += (p.amount / v.maxHp) * 1.4;
              } else {
                const exp = Math.min(p.amount, v.hp) * (p.hit / 100);
                score += exp / v.maxHp;
                if (p.amount >= v.hp) score += 0.6 * (p.hit / 100);
              }
            }
            if (score <= 0) continue;
            score -= (action.mp || 0) * 0.004;
            score -= node.d * 0.005;
            if (!best || score > best.score) best = { score, dest: node, action, target: { x: t.x, y: t.y } };
          }
        }
        u.x = ox;
        u.y = oy;
      }
      if (best) return best;

      // Advance: nearest reachable tile to the closest enemy.
      const foes = this.living(1 - u.team);
      let adv = null;
      for (const node of reach.values()) {
        const d = Math.min(...foes.map((f) => Math.abs(f.x - node.x) + Math.abs(f.y - node.y)));
        if (!adv || d < adv.d || (d === adv.d && node.d < adv.dest.d)) adv = { d, dest: node };
      }
      return { dest: adv ? adv.dest : null, action: null };
    }
  }

  CT.Battle = Battle;
  CT.DIRS = DIRS;
  CT.dirTo = dirTo;
})();
