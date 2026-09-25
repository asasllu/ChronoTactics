// Isometric renderer. Draws tiles back-to-front with units interleaved so
// taller terrain correctly hides characters standing behind it.
(function () {
  const CT = (window.CT = window.CT || {});

  const TW = 64; // tile diamond width
  const TH = 32; // tile diamond height
  const HS = 16; // pixels per height level
  const SCALE = 2; // sprite pixel scale

  // Terrain palettes: top, top detail light/dark, left face, right face.
  const PAL = {
    g: { top: '#58a848', lt: '#78c860', dk: '#3c8034', side: '#8a5a30', sideDk: '#6a4020', edge: '#2c6024', lip: '#4c9840' },
    d: { top: '#b88848', lt: '#d0a060', dk: '#946830', side: '#8a5a30', sideDk: '#6a4020', edge: '#704818' },
    s: { top: '#9898a8', lt: '#b8b8c8', dk: '#707080', side: '#78788a', sideDk: '#585868', edge: '#484858' },
    b: { top: '#a87038', lt: '#c88848', dk: '#704820', side: '#704820', sideDk: '#503010', edge: '#402808' },
    f: { top: '#58a0c8', lt: '#88c8e8', dk: '#3878a8', side: '#3878a8', sideDk: '#285888', edge: '#285888' },
    w: { top: '#2860b0', lt: '#5898e0', dk: '#1c4888', side: '#1c4888', sideDk: '#143468', edge: '#143468' },
  };
  PAL.t = PAL.g;
  PAL.r = PAL.d;

  function makePattern(ctx, w, h, fn) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    fn(cv.getContext('2d'));
    return ctx.createPattern(cv, 'repeat');
  }

  // Seeded PRNG so textures are identical every load.
  function rng(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.W = canvas.width;
      this.H = canvas.height;
      this.rot = 0;
      this.ox = this.W / 2;
      this.oy = 150;
      this.floaters = [];
      this.particles = [];
      this.buildPatterns();
    }

    buildPatterns() {
      const ctx = this.ctx;
      this.tops = {};
      this.sides = {};
      let seed = 7;
      for (const k of Object.keys(PAL)) {
        const p = PAL[k];
        const r = rng(seed++ * 977);
        this.tops[k] = makePattern(ctx, 32, 32, (g) => {
          g.fillStyle = p.top;
          g.fillRect(0, 0, 32, 32);
          for (let i = 0; i < 70; i++) {
            g.fillStyle = r() < 0.5 ? p.lt : p.dk;
            const x = Math.floor(r() * 16) * 2;
            const y = Math.floor(r() * 16) * 2;
            if (k === 'g') g.fillRect(x, y, 2, 4);
            else g.fillRect(x, y, 2, 2);
          }
          if (k === 's') {
            g.fillStyle = p.dk;
            for (let y = 0; y < 32; y += 8) g.fillRect(0, y, 32, 1);
            for (let y = 0; y < 32; y += 8) g.fillRect((y / 8) % 2 ? 8 : 24, y, 1, 8);
          }
          if (k === 'b') {
            g.fillStyle = p.dk;
            for (let x = 0; x < 32; x += 6) g.fillRect(x, 0, 1, 32);
          }
        });
        this.sides[k] = makePattern(ctx, 32, 16, (g) => {
          g.fillStyle = p.side;
          g.fillRect(0, 0, 32, 16);
          for (let i = 0; i < 30; i++) {
            g.fillStyle = r() < 0.5 ? p.sideDk : p.edge;
            g.fillRect(Math.floor(r() * 16) * 2, Math.floor(r() * 8) * 2, 2, 2);
          }
          g.fillStyle = p.sideDk;
          g.fillRect(0, 15, 32, 1);
        });
      }
    }

    // ---- Projection --------------------------------------------------------
    view(x, y) {
      const n = CT.MAP.size - 1;
      switch (this.rot) {
        case 1: return [n - y, x];
        case 2: return [n - x, n - y];
        case 3: return [y, n - x];
        default: return [x, y];
      }
    }
    project(x, y, h) {
      const [vx, vy] = this.view(x, y);
      return [this.ox + ((vx - vy) * TW) / 2, this.oy + ((vx + vy) * TH) / 2 - h * HS];
    }
    depth(x, y) {
      const [vx, vy] = this.view(x, y);
      return vx + vy;
    }
    // World facing → does the sprite face screen-left?
    facesLeft(face) {
      const [fx, fy] = CT.DIRS[face];
      const [ax, ay] = this.view(0, 0);
      const [bx, by] = this.view(fx, fy);
      const vx = bx - ax;
      const vy = by - ay;
      return vx - vy < 0;
    }

    tileHeight(t) {
      return t.t === 'w' ? t.h - 0.3 : t.t === 'f' ? t.h - 0.15 : t.h;
    }

    // ---- Picking -----------------------------------------------------------
    pick(battle, mx, my) {
      const order = this.tileOrder(battle).reverse();
      for (const t of order) {
        const [sx, sy] = this.project(t.x, t.y, this.tileHeight(t));
        const dx = Math.abs(mx - sx) / (TW / 2);
        const dy = Math.abs(my - sy) / (TH / 2);
        if (dx + dy <= 1) return t;
        // Clicking the column's visible side faces also counts.
        if (dx <= 1) {
          const top = sy + (TH / 2) * (1 - dx);
          if (my >= top && my <= top + (t.h + 0.6) * HS) return t;
        }
      }
      return null;
    }

    tileOrder(battle) {
      const all = [];
      for (const row of battle.tiles) for (const t of row) all.push(t);
      return all.sort((a, b) => this.depth(a.x, a.y) - this.depth(b.x, b.y) || this.view(a.x, a.y)[0] - this.view(b.x, b.y)[0]);
    }

    // ---- Frame -------------------------------------------------------------
    draw(battle, ui, now) {
      const ctx = this.ctx;
      this.drawBackground(now);
      if (!battle) return;

      const drawables = [];
      for (const t of this.tileOrder(battle)) drawables.push({ z: this.depth(t.x, t.y), sub: 0, t });
      for (const u of battle.units) {
        if (!u.alive && u.alpha <= 0) continue;
        // While moving between tiles use the nearer (front-most) of the two.
        const z = Math.max(this.depth(Math.floor(u.rx), Math.floor(u.ry)), this.depth(Math.ceil(u.rx), Math.ceil(u.ry)));
        drawables.push({ z, sub: 1, u });
      }
      drawables.sort((a, b) => a.z - b.z || a.sub - b.sub);

      for (const d of drawables) {
        if (d.t) this.drawTile(d.t, ui, now);
        else this.drawUnit(d.u, battle, ui, now);
      }

      this.drawParticles(now);
      this.drawFloaters(now);
    }

    drawBackground(now) {
      const ctx = this.ctx;
      const grd = ctx.createLinearGradient(0, 0, 0, this.H);
      grd.addColorStop(0, '#182048');
      grd.addColorStop(0.6, '#304880');
      grd.addColorStop(1, '#101830');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, this.W, this.H);
      // Slow-drifting pixel stars.
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const r = rng(99);
      for (let i = 0; i < 60; i++) {
        const x = (r() * this.W + now * 0.004 * (1 + (i % 3))) % this.W;
        const y = r() * this.H * 0.5;
        ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
      }
    }

    diamond(sx, sy) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(sx, sy - TH / 2);
      ctx.lineTo(sx + TW / 2, sy);
      ctx.lineTo(sx, sy + TH / 2);
      ctx.lineTo(sx - TW / 2, sy);
      ctx.closePath();
    }

    drawTile(t, ui, now) {
      const ctx = this.ctx;
      const h = this.tileHeight(t);
      const p = PAL[t.t];
      const [sx, sy] = this.project(t.x, t.y, h);
      const depth = (h + 0.6) * HS;

      // Left face.
      ctx.beginPath();
      ctx.moveTo(sx - TW / 2, sy);
      ctx.lineTo(sx, sy + TH / 2);
      ctx.lineTo(sx, sy + TH / 2 + depth);
      ctx.lineTo(sx - TW / 2, sy + depth);
      ctx.closePath();
      ctx.fillStyle = this.sides[t.t];
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
      // Right face.
      ctx.beginPath();
      ctx.moveTo(sx + TW / 2, sy);
      ctx.lineTo(sx, sy + TH / 2);
      ctx.lineTo(sx, sy + TH / 2 + depth);
      ctx.lineTo(sx + TW / 2, sy + depth);
      ctx.closePath();
      ctx.fillStyle = this.sides[t.t];
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fill();

      // Grass overhang lip.
      if (p.lip && t.h > 0) {
        ctx.fillStyle = p.lip;
        ctx.beginPath();
        ctx.moveTo(sx - TW / 2, sy);
        ctx.lineTo(sx, sy + TH / 2);
        ctx.lineTo(sx + TW / 2, sy);
        ctx.lineTo(sx + TW / 2, sy + 4);
        ctx.lineTo(sx, sy + TH / 2 + 4);
        ctx.lineTo(sx - TW / 2, sy + 4);
        ctx.closePath();
        ctx.fill();
      }

      // Top.
      this.diamond(sx, sy);
      if (t.t === 'w' || t.t === 'f') {
        ctx.save();
        ctx.translate(Math.floor(now / 90) % 32, 0);
        ctx.fillStyle = this.tops[t.t];
        ctx.fill();
        ctx.restore();
        const shimmer = Math.sin(now / 400 + t.x + t.y * 0.7) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(160,210,255,${0.12 * shimmer})`;
        this.diamond(sx, sy);
        ctx.fill();
      } else {
        ctx.fillStyle = this.tops[t.t];
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      this.diamond(sx, sy);
      ctx.stroke();

      // Highlights (move range, attack range, area of effect).
      const key = `${t.x},${t.y}`;
      const pulse = 0.55 + 0.25 * Math.sin(now / 180);
      const hl = ui.highlights && ui.highlights.get(key);
      if (hl) {
        this.diamond(sx, sy);
        ctx.fillStyle = hl === 'move' ? `rgba(80,150,255,${0.45 * pulse})` : hl === 'aoe' ? `rgba(255,220,60,${0.6 * pulse})` : `rgba(255,70,70,${0.4 * pulse})`;
        ctx.fill();
        ctx.strokeStyle = hl === 'move' ? '#a8d0ff' : hl === 'aoe' ? '#fff0a0' : '#ffa0a0';
        ctx.stroke();
      }
      if (ui.path && ui.path.has(key)) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(sx - 3, sy - 2, 6, 4);
      }
      if (ui.hover && ui.hover.x === t.x && ui.hover.y === t.y) {
        ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(now / 120)})`;
        ctx.lineWidth = 2;
        this.diamond(sx, sy);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Decoration on blocking tiles.
      if (t.t === 't' || t.t === 'r') {
        const img = CT.getDecor(t.t === 't' ? 'tree' : 'rock');
        const w = img.width * SCALE;
        const hh = img.height * SCALE;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(img, Math.round(sx - w / 2 + (t.t === 't' ? 6 : 0)), Math.round(sy - hh + 6), w, hh);
      }
    }

    unitScreenPos(u) {
      return this.project(u.rx + u.ox, u.ry + u.oy, u.rh);
    }

    drawUnit(u, battle, ui, now) {
      const ctx = this.ctx;
      const spr = CT.getSprite(u.key);
      const [sx, sy] = this.unitScreenPos(u);
      const left = this.facesLeft(u.face);
      const w = spr.w * SCALE;
      const h = spr.h * SCALE;
      const isActive = battle.active === u;
      const bob = isActive ? Math.round(Math.sin(now / 160) * 1.5) : 0;

      ctx.save();
      ctx.globalAlpha = u.alpha;

      // Team ring + shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = u.team === 0 ? 'rgba(90,170,255,0.9)' : 'rgba(255,90,90,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 17, 8, 0, 0, Math.PI * 2);
      ctx.stroke();

      const dx = Math.round(sx - w / 2);
      const dy = Math.round(sy - h + 4 + bob);
      ctx.drawImage(left ? spr.left : spr.right, dx, dy, w, h);
      if (u.flash > 0) {
        ctx.globalAlpha = u.alpha * Math.min(1, u.flash);
        ctx.drawImage(left ? spr.flashLeft : spr.flashRight, dx, dy, w, h);
      }
      ctx.restore();

      // Mini HP bar.
      if (u.alive) {
        const bw = 28;
        const bx = Math.round(sx - bw / 2);
        const by = Math.round(dy - 8);
        ctx.fillStyle = '#101018';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
        const f = u.hp / u.maxHp;
        ctx.fillStyle = f > 0.5 ? '#50e070' : f > 0.25 ? '#f0d040' : '#f05040';
        ctx.fillRect(bx, by, Math.max(1, Math.round(bw * f)), 3);
      }

      // Bouncing FFT-style crystal marker over the active unit.
      if (isActive && u.alive) {
        const ay = dy - 22 + Math.sin(now / 200) * 4;
        ctx.fillStyle = u.team === 0 ? '#70d0ff' : '#ff7070';
        ctx.strokeStyle = '#101018';
        ctx.beginPath();
        ctx.moveTo(sx, ay + 12);
        ctx.lineTo(sx - 7, ay);
        ctx.lineTo(sx, ay - 5);
        ctx.lineTo(sx + 7, ay);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(sx - 3, ay - 1, 2, 4);
      }
    }

    // ---- Floating numbers & particles -------------------------------------
    floatText(u, text, color) {
      const [sx, sy] = this.project(u.x, u.y, u.rh);
      this.floaters.push({ x: sx, y: sy - 56, text, color, t0: performance.now() });
    }

    drawFloaters(now) {
      const ctx = this.ctx;
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      this.floaters = this.floaters.filter((f) => now - f.t0 < 1100);
      for (const f of this.floaters) {
        const k = (now - f.t0) / 1100;
        const y = f.y - Math.min(1, k * 4) * 18 + (k > 0.25 ? 0 : 0);
        ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) * 4 : 1;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#101018';
        ctx.strokeText(f.text, f.x, y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, y);
        ctx.globalAlpha = 1;
      }
    }

    burst(x, y, h, elem) {
      const [sx, sy] = this.project(x, y, h);
      const colors = {
        fire: ['#ff5020', '#ffa030', '#ffe060'],
        ice: ['#a0e8ff', '#e0f8ff', '#60b0f0'],
        bolt: ['#fff8a0', '#ffffff', '#f0e040'],
        dark: ['#8040c0', '#301050', '#c080ff'],
        water: ['#4090f0', '#a0d0ff', '#2060c0'],
        laser: ['#ff60c0', '#60f0ff', '#ffffff'],
        heal: ['#80ff90', '#e0ffe0', '#40d060'],
        slash: ['#ffffff', '#d0e0ff', '#a0b0ff'],
        hit: ['#ffffff', '#ffe0a0'],
      }[elem] || ['#ffffff'];
      const now = performance.now();
      const n = elem === 'hit' ? 10 : 22;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.5 + Math.random() * 2.5;
        this.particles.push({
          x: sx,
          y: sy - 20,
          vx: Math.cos(a) * sp,
          vy: elem === 'heal' ? -1 - Math.random() * 1.5 : Math.sin(a) * sp - 1.2,
          g: elem === 'heal' ? -0.01 : 0.08,
          c: colors[i % colors.length],
          t0: now,
          life: 500 + Math.random() * 400,
          s: elem === 'hit' ? 3 : 4,
        });
      }
      if (elem === 'bolt') this.bolts = (this.bolts || []).concat({ x: sx, y: sy - 16, t0: now });
    }

    projectile(from, to, kind, dur) {
      const t0 = performance.now();
      this.shots = (this.shots || []).concat({ from, to, kind, t0, dur });
    }

    drawParticles(now) {
      const ctx = this.ctx;
      this.particles = this.particles.filter((p) => now - p.t0 < p.life);
      for (const p of this.particles) {
        const t = (now - p.t0) / 16;
        const x = p.x + p.vx * t;
        const y = p.y + p.vy * t + 0.5 * p.g * t * t;
        ctx.globalAlpha = 1 - (now - p.t0) / p.life;
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(x), Math.round(y), p.s, p.s);
      }
      ctx.globalAlpha = 1;

      this.bolts = (this.bolts || []).filter((b) => now - b.t0 < 300);
      for (const b of this.bolts) {
        ctx.strokeStyle = (Math.floor(now / 40) % 2) ? '#ffffff' : '#fff060';
        ctx.lineWidth = 3;
        ctx.beginPath();
        let x = b.x;
        ctx.moveTo(x, 0);
        for (let y = 0; y < b.y; y += 24) {
          x = b.x + (Math.random() - 0.5) * 24;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      this.shots = (this.shots || []).filter((s) => now - s.t0 < s.dur);
      for (const s of this.shots) {
        const k = (now - s.t0) / s.dur;
        const x = s.from[0] + (s.to[0] - s.from[0]) * k;
        const y = s.from[1] + (s.to[1] - s.from[1]) * k - Math.sin(k * Math.PI) * 24;
        ctx.fillStyle = s.kind === 'shot' ? '#ffe060' : '#e0e0f0';
        ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
        ctx.fillStyle = '#101018';
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        ctx.fillStyle = s.kind === 'shot' ? '#fff' : '#b08040';
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
    }
  }

  CT.Renderer = Renderer;
})();
