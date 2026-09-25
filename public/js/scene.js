// Scene runner: executes story scripts (docs/ENGINE_SPEC.md §7) — cutscenes,
// field exploration, battles, chapter cards and credits.
(function () {
  const CT = (window.CT = window.CT || {});
  const UI = CT.UI;
  const wait = (ms) => new Promise((r) => setTimeout(r, CT.FAST ? Math.min(ms, 5) : ms));
  const key = (x, y) => `${x},${y}`;
  const FACE = { E: 0, S: 1, W: 2, N: 3 };
  const sfx = (id) => CT.audio && CT.audio.sfx(id);

  function tween(ms, fn) {
    if (CT.FAST) ms = Math.min(ms, 8);
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
  CT.tween = tween;
  CT.wait = wait;

  class Scene {
    constructor(renderer, game) {
      this.r = renderer;
      this.game = game;
      this.world = null;
      this.actors = [];
      this.sceneId = null;
    }

    // ---- World & actors ------------------------------------------------------------
    loadMap(mapId, theme) {
      const def = CT.MAPS[mapId];
      if (!def) throw new Error('unknown map ' + mapId);
      const map = CT.prepareMap({ id: mapId, ...def });
      if (theme) map.theme = theme;
      this.actors = [];
      this.world = { map, units: this.actors, active: null };
      this.r.setWorld(this.world);
      this.r.focusMap(true);
      return map;
    }
    tile(x, y) {
      const m = this.world.map;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null;
      return m.tiles[y][x];
    }
    resolve(at) {
      if (at == null) return null;
      if (Array.isArray(at)) return { x: at[0], y: at[1] };
      if (typeof at === 'string' && at.startsWith('@')) {
        const m = this.world.map.markers && this.world.map.markers[at.slice(1)];
        if (!m) {
          console.warn('unknown marker', at, 'on', this.world.map.id);
          return { x: Math.floor(this.world.map.w / 2), y: Math.floor(this.world.map.h / 2) };
        }
        return { x: m[0], y: m[1] };
      }
      if (typeof at === 'string') {
        const a = this.actor(at);
        return a ? { x: a.x, y: a.y } : null;
      }
      return at;
    }
    actor(id) {
      return this.actors.find((a) => a.id === id);
    }
    visH(t) {
      return this.r.tileHeight(t);
    }
    // Nearest free walkable tile (actors sharing a marker spread out).
    freeNear(p, a) {
      for (let r = 0; r < 6; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const t = this.tile(p.x + dx, p.y + dy);
            if (t && this.walkable(t, a) && !this.occupied(t.x, t.y, a)) return { x: t.x, y: t.y };
          }
      return p;
    }
    spawn(spec) {
      let p = this.resolve(spec.at) || { x: 0, y: 0 };
      if (!spec.prop && this.occupied(p.x, p.y, this.actor(spec.id))) p = this.freeNear(p, { id: spec.id });
      const t = this.tile(p.x, p.y);
      const face = typeof spec.face === 'string' ? FACE[spec.face] ?? 1 : spec.face ?? 1;
      const old = this.actor(spec.id);
      if (old) this.actors.splice(this.actors.indexOf(old), 1);
      const a = {
        id: spec.id, key: spec.sprite || spec.id, sprite: spec.sprite || spec.id, x: p.x, y: p.y, rx: p.x, ry: p.y,
        rh: t ? this.visH(t) : 0, ox: 0, oy: 0, oz: 0, face, alpha: spec.alpha ?? 1, alive: true, prop: !!spec.prop,
        team: null, flash: 0, hidden: !!spec.hidden,
      };
      this.actors.push(a);
      return a;
    }
    despawn(id) {
      const a = this.actor(id);
      if (a) this.actors.splice(this.actors.indexOf(a), 1);
    }
    occupied(x, y, except) {
      return this.actors.some((a) => a !== except && !a.hidden && !a.prop && a.x === x && a.y === y);
    }
    walkable(t, a) {
      if (!t) return false;
      const m = CT.TERRAIN[t.t];
      if (!m || m.void || m.lava) return !!(a && CT.HEROES[a.id] && CT.HEROES[a.id].float && m && !m.lava);
      const d = this.world.map.decorAt.get(key(t.x, t.y));
      if (d && CT.DECOR[d.kind] && CT.DECOR[d.kind].blocks) return false;
      return m.walk || (m.swim && a && CT.HEROES[a.id] && (CT.HEROES[a.id].swim || CT.HEROES[a.id].float));
    }
    // BFS path for cutscenes & field walking.
    path(a, to, avoidActors) {
      const from = { x: a.x, y: a.y };
      const prev = new Map([[key(from.x, from.y), null]]);
      const q = [from];
      const goalOk = (x, y) => x === to.x && y === to.y;
      while (q.length) {
        const c = q.shift();
        if (goalOk(c.x, c.y)) break;
        const ct = this.tile(c.x, c.y);
        for (const [dx, dy] of CT.DIRS) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          const k = key(nx, ny);
          if (prev.has(k)) continue;
          const nt = this.tile(nx, ny);
          if (!nt || !this.walkable(nt, a)) continue;
          if (Math.abs(nt.h - ct.h) > 3) continue;
          if (avoidActors && this.occupied(nx, ny, a) && !goalOk(nx, ny)) continue;
          prev.set(k, c);
          q.push({ x: nx, y: ny });
        }
      }
      if (!prev.has(key(to.x, to.y))) return null;
      const path = [];
      for (let n = to; n; n = prev.get(key(n.x, n.y))) path.unshift({ x: n.x, y: n.y });
      return path;
    }
    async walk(a, path, speed = 180) {
      for (let i = 1; i < path.length; i++) {
        const p0 = path[i - 1];
        const p1 = path[i];
        const t0 = this.tile(p0.x, p0.y);
        const t1 = this.tile(p1.x, p1.y);
        const h0 = t0 ? this.visH(t0) : 0;
        const h1 = t1 ? this.visH(t1) : 0;
        a.face = CT.dirTo(p0.x, p0.y, p1.x, p1.y);
        const jump = Math.abs(h1 - h0) >= 1;
        if (i % 2 === 0) sfx('sfx_step');
        await tween(jump ? speed * 1.5 : speed, (k) => {
          a.rx = p0.x + (p1.x - p0.x) * k;
          a.ry = p0.y + (p1.y - p0.y) * k;
          a.rh = h0 + (h1 - h0) * k + Math.sin(k * Math.PI) * (jump ? 0.8 : 0.12);
        });
        a.x = p1.x;
        a.y = p1.y;
        if (this.onStep) this.onStep(a);
      }
      a.rx = a.x;
      a.ry = a.y;
      const t = this.tile(a.x, a.y);
      a.rh = t ? this.visH(t) : 0;
    }
    async moveActor(id, at, opts = {}) {
      const a = this.actor(id);
      const to = this.resolve(at);
      if (!a || !to) return;
      let goal = to;
      if (this.occupied(to.x, to.y, a)) goal = this.freeNear(to, a);
      const path = this.path(a, goal, false) || [{ x: a.x, y: a.y }, goal];
      await this.walk(a, path, opts.speed || (opts.run ? 110 : 190));
    }

    // ---- Script execution ------------------------------------------------------------
    async play(sceneId, opts = {}) {
      const sc = CT.SCENES[sceneId];
      if (!sc) {
        console.warn('unknown scene', sceneId);
        return { title: true };
      }
      this.sceneId = sceneId;
      this.game.lastScene = sceneId;
      if (window.TEST_LOG) window.TEST_LOG.push({ scene: sceneId, t: Math.round(performance.now() / 1000) });
      UI.hint('');
      this.loadMap(sc.map, sc.theme);
      const music = sc.music !== undefined ? sc.music : CT.MAPS[sc.map].music;
      if (music && CT.audio) CT.audio.playMusic(music);
      if (opts.resume && opts.resume.actors) for (const s of opts.resume.actors) this.spawn(s);
      else for (const s of sc.actors || []) this.spawn(s);
      if (opts.resume && opts.resume.theme) this.world.map.theme = opts.resume.theme;
      this.r.fade = 1;
      this.fadeIn = true;
      const start = opts.resume ? opts.resume.cmd : 0;
      const script = sc.script || [];
      // Fade in unless the scene opens with its own fade/chapter card.
      const first = script[start];
      if (!first || !['fade', 'chapter', 'text'].includes(first[0])) tween(500, (k) => (this.r.fade = 1 - k));
      const res = await this.run(script, start, opts.resume);
      return res || { title: true };
    }

    // Runs commands; returns a directive ({goto}|{title}|{credits}) when one ends the scene.
    async run(cmds, start = 0, resume) {
      for (let i = start; i < cmds.length; i++) {
        this.cmdIndex = i;
        this.cmdTop = cmds === (CT.SCENES[this.sceneId] || {}).script;
        const r = await this.exec(cmds[i], resume && i === start ? resume : null, i);
        if (r) return r;
      }
      return null;
    }

    snapshot(cmdIndex) {
      return {
        scene: this.sceneId,
        cmd: cmdIndex,
        theme: this.world.map.theme,
        actors: this.actors.map((a) => ({ id: a.id, sprite: a.sprite, at: [a.x, a.y], face: a.face, prop: a.prop, hidden: a.hidden })),
      };
    }

    async exec(c, resume, index) {
      const [op, ...a] = c;
      const g = this.game;
      switch (op) {
        case 'say': {
          // Pan gently to whoever is speaking (if they're on stage).
          const sp = this.actor(a[0]);
          if (sp && !sp.hidden && !(a[3] && a[3].radio)) {
            const t = this.tile(sp.x, sp.y);
            this.r.focus(sp.x, sp.y, t ? t.h : 0);
          }
          this.r.dialogueBias = -70;
          await UI.say(a[0], a[1], a[2], a[3] || {});
          this.r.dialogueBias = 0;
          break;
        }
        case 'choice': {
          const idx = await UI.choice(a[0]);
          if (a[2]) g.flags[a[2]] = idx;
          const branch = a[1] && a[1][idx];
          if (branch) return this.run(branch);
          break;
        }
        case 'move': {
          const p = this.moveActor(a[0], a[1], a[2] || {});
          if (!(a[2] && a[2].nowait)) await p;
          break;
        }
        case 'face': {
          const u = this.actor(a[0]);
          if (!u) break;
          if (typeof a[1] === 'string' && FACE[a[1]] != null) u.face = FACE[a[1]];
          else {
            const o = this.resolve(a[1]);
            if (o) u.face = CT.dirTo(u.x, u.y, o.x, o.y);
          }
          break;
        }
        case 'anim':
          await this.anim(a[0], a[1]);
          break;
        case 'emote': {
          const u = this.actor(a[0]);
          if (u) u.emote = { text: a[1], t0: performance.now(), ms: 1500 };
          await wait(500);
          break;
        }
        case 'spawn':
          this.spawn(a[0]);
          break;
        case 'despawn':
          this.despawn(a[0]);
          break;
        case 'music':
          if (!CT.audio) break;
          if (a[0]) CT.audio.playMusic(a[0], { fade: 400 });
          else CT.audio.stopMusic(600);
          break;
        case 'sfx':
          sfx(a[0]);
          break;
        case 'wait':
          await wait(a[0] || 500);
          break;
        case 'fade': {
          const [dir, ms = 600, color] = a;
          if (color) this.r.fadeColor = color;
          const from = this.r.fade;
          const to = dir === 'out' ? 1 : 0;
          await tween(ms, (k) => (this.r.fade = from + (to - from) * k));
          if (dir === 'in') this.r.fadeColor = '0,0,0';
          break;
        }
        case 'flash':
          this.r.flashScreen(a[0] || '255,255,255', a[1] || 250);
          await wait(150);
          break;
        case 'shake':
          this.r.shake(8, a[0] || 500);
          await wait(Math.min(400, a[0] || 400));
          break;
        case 'vfx':
          await this.vfx(a[0], a[1]);
          break;
        case 'close_rift':
          this.r.rifts = [];
          break;
        case 'camera': {
          if (a[0] === 'map') this.r.focusMap(false);
          else {
            const p = this.resolve(a[0]);
            if (p) {
              const t = this.tile(p.x, p.y);
              this.r.focus(p.x, p.y, t ? t.h : 0);
            }
          }
          await wait(a[1] || 400);
          break;
        }
        case 'theme':
          this.world.map.theme = a[0];
          break;
        case 'chapter':
          await UI.chapterCard(a[0], a[1]);
          if (this.r.fade > 0) tween(500, (k) => (this.r.fade = 1 - k));
          break;
        case 'text':
          await UI.textOnBlack(a[0]);
          break;
        case 'battle': {
          if (this.cmdTop) g.save('auto', this.snapshot(index));
          const res = await CT.runBattle(a[0], this);
          if (res === 'title') return { title: true };
          if (res && res.load) return res;
          break;
        }
        case 'party':
          g.setParty(a[0]);
          break;
        case 'join':
          g.join(a[0]);
          UI.banner(`${CT.HEROES[a[0]].name} joined the party!`, 1800);
          sfx('sfx_item_get');
          break;
        case 'guest':
          if (a[1] === false) g.guests = g.guests.filter((x) => x !== a[0]);
          else if (!g.guests.includes(a[0])) g.guests.push(a[0]);
          break;
        case 'unlock':
          g.unlock(a[0]);
          await UI.popup(`<b>Combo tech unlocked:</b><br>${CT.TECHS[a[0]].name}<br><small>${CT.TECHS[a[0]].desc || ''}</small>`);
          break;
        case 'popup':
          await UI.popup(a[0]);
          break;
        case 'reward':
          await this.reward(a[0]);
          break;
        case 'setflag':
          g.flags[a[0]] = a.length > 1 ? a[1] : true;
          break;
        case 'if': {
          const ok = g.checkFlag(a[0]);
          const branch = ok ? a[1] : a[2];
          if (branch) {
            const r = await this.run(branch);
            if (r) return r;
          }
          break;
        }
        case 'shop':
          await UI.shop(a[0]);
          break;
        case 'save_prompt':
          await this.savePrompt(index);
          break;
        case 'field': {
          const r = await this.field(a[0], index, resume);
          if (r) return r;
          break;
        }
        case 'goto':
          await tween(400, (k) => (this.r.fade = Math.max(this.r.fade, k)));
          return { goto: a[0] };
        case 'credits':
          return { credits: true };
        case 'title':
          return { title: true };
        default:
          console.warn('unknown command', op);
      }
      return null;
    }

    async reward(r) {
      const g = this.game;
      const parts = [];
      let ups = [];
      if (r.xp) {
        ups = g.gainXp(r.xp);
        parts.push(`EXP +${r.xp}`);
      }
      if (r.gold) {
        g.gold += r.gold;
        parts.push(`${r.gold}G`);
      }
      for (const [k, n] of Object.entries(r.items || {})) {
        g.addItem(k, n);
        parts.push(`${CT.ITEMS[k] ? CT.ITEMS[k].name : k} ×${n}`);
      }
      if (r.key) {
        g.addKey(r.key);
        parts.push(`<b>${CT.KEY_ITEMS[r.key] || r.key}</b>`);
      }
      if (parts.length) await UI.popup(`Obtained: ${parts.join(' · ')}${ups.map((u) => `<div class="lvup">${CT.HEROES[u.id].name} reached Lv ${u.level}!</div>`).join('')}`);
    }

    async savePrompt(index) {
      const g = this.game;
      const items = [{ label: 'Save', value: 'save' }];
      if (g.inventory.shelter > 0) items.push({ label: `Use Shelter (×${g.inventory.shelter})`, value: 'shelter', hint: 'Fully restores the party.' });
      items.push({ label: 'Cancel', value: null });
      const r = await UI.menu(items, { title: 'Save point' });
      if (r === 'shelter') {
        g.useItem('shelter');
        g.fullHeal();
        sfx('sfx_save');
        UI.banner('The party is fully rested.');
      } else if (r === 'save') {
        const slot = await UI.slotMenu('save');
        if (slot) {
          g.save(slot, this.snapshot(index));
          sfx('sfx_save');
          UI.banner('Game saved.');
        }
      }
    }

    async vfx(kind, at) {
      const p = this.resolve(at) || { x: Math.floor(this.world.map.w / 2), y: Math.floor(this.world.map.h / 2) };
      const t = this.tile(p.x, p.y);
      const h = t ? this.visH(t) : 0;
      switch (kind) {
        case 'time_rift':
          this.r.addRift(p.x, p.y, h, { grey: true });
          sfx('sfx_hollow_gate');
          await wait(600);
          break;
        case 'gate':
          this.r.addRift(p.x, p.y, h, { grey: false });
          sfx('sfx_gate_open');
          await wait(600);
          break;
        case 'seed_hatch':
          this.r.burst(p.x, p.y, h, 'lavos', { r: 60 });
          sfx('sfx_seed_hatch');
          await wait(500);
          break;
        case 'glass_shatter':
          this.r.burst(p.x, p.y, h, 'glass', { r: 50 });
          sfx('sfx_glass_shatter');
          await wait(400);
          break;
        case 'heal':
          this.r.burst(p.x, p.y, h, 'heal');
          sfx('sfx_heal_chime');
          await wait(300);
          break;
        default:
          this.r.burst(p.x, p.y, h, kind === 'sparkle' ? 'heal' : kind);
          await wait(300);
      }
    }

    // Crono's (and everyone's) wordless acting.
    async anim(id, name) {
      const u = this.actor(id);
      if (!u) return;
      switch (name) {
        case 'nod':
          for (let i = 0; i < 2; i++) await tween(180, (k) => (u.oz = -Math.sin(k * Math.PI) * 3));
          break;
        case 'shake_head':
          await tween(500, (k) => (u.ox = Math.sin(k * Math.PI * 4) * 0.06));
          u.ox = 0;
          break;
        case 'shrug':
          u.emote = { text: '...', t0: performance.now(), ms: 1200 };
          await tween(300, (k) => (u.oz = Math.sin(k * Math.PI) * 3));
          break;
        case 'draw_sword':
          sfx('sfx_sword_swing');
          u.flash = 1;
          u.emote = { text: '!', t0: performance.now(), ms: 900, color: '#c02020' };
          await tween(300, (k) => (u.flash = 1 - k));
          break;
        case 'point':
          u.emote = { text: '!', t0: performance.now(), ms: 900 };
          await tween(250, (k) => (u.ox = Math.sin(k * Math.PI) * 0.15 * (u.face === 0 ? 1 : u.face === 2 ? -1 : 0)));
          u.ox = 0;
          break;
        case 'bow':
          await tween(600, (k) => (u.oz = -Math.sin(k * Math.PI) * 5));
          break;
        case 'spin':
          for (let i = 0; i < 8; i++) {
            u.face = (u.face + 1) % 4;
            await wait(110);
          }
          break;
        case 'jump':
          sfx('sfx_step');
          await tween(400, (k) => (u.oz = Math.sin(k * Math.PI) * 18));
          break;
        case 'kneel':
          await tween(300, (k) => (u.oz = -4 * k));
          break;
        case 'stand':
          u.oz = 0;
          u.koPose = false;
          break;
        case 'fall':
          u.koPose = true;
          sfx('sfx_ko');
          break;
        case 'run_off': {
          const m = this.world.map;
          const edges = [{ x: 0, y: u.y }, { x: m.w - 1, y: u.y }, { x: u.x, y: 0 }, { x: u.x, y: m.h - 1 }];
          edges.sort((p, q) => Math.abs(p.x - u.x) + Math.abs(p.y - u.y) - (Math.abs(q.x - u.x) + Math.abs(q.y - u.y)));
          const path = this.path(u, edges[0]) || [{ x: u.x, y: u.y }];
          this.walk(u, path, 90).then(() => tween(250, (k) => (u.alpha = 1 - k))).then(() => (u.hidden = true));
          await wait(300);
          break;
        }
        case 'dissolve':
          sfx('sfx_scanline');
          u.flicker = true;
          await tween(1400, (k) => (u.alpha = 1 - k));
          u.hidden = true;
          break;
        default:
          await wait(200);
      }
      u.oz = name === 'kneel' ? u.oz : 0;
    }

    // ---- Field exploration ----------------------------------------------------------
    async field(cfg, index, resume) {
      const g = this.game;
      const leader = this.actor(cfg.leader || 'crono') || this.actors[0];
      if (!leader) return null;
      if (resume && resume.leader) {
        /* positions already restored via snapshot */
      }
      const followers = g.party.filter((id) => id !== leader.id).map((id) => this.actor(id)).filter(Boolean);
      const trail = [];
      const npcs = (cfg.npcs || []).map((n) => ({ ...n }));
      const events = (cfg.events || []).map((e) => ({ ...e, fired: false }));
      const exits = cfg.exits || [];
      const savePos = cfg.save ? this.resolve(cfg.save) : null;
      const inZone = (z, x, y) => {
        if (Array.isArray(z)) return z.some(([zx, zy]) => zx === x && zy === y);
        const s = this.world.map.zones[z];
        return !!(s && s.has(key(x, y)));
      };
      UI.hint(cfg.hint || '');
      this.r.focus(leader.x, leader.y, this.tile(leader.x, leader.y).h);
      let busy = false;
      let result = null;
      let finish;
      const done = new Promise((r) => (finish = r));
      this.fieldState = { leader, npcs, exits, savePos };

      const npcAt = (x, y) => npcs.find((n) => {
        const a = this.actor(n.id);
        return a && !a.hidden && a.x === x && a.y === y;
      });
      const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
      const talk = async (n) => {
        const a = this.actor(n.id);
        if (a) {
          a.face = CT.dirTo(a.x, a.y, leader.x, leader.y);
          leader.face = CT.dirTo(leader.x, leader.y, a.x, a.y);
        }
        UI.prompt('');
        const r = await this.run(n.talk || []);
        if (r) result = r;
      };
      const followStep = () => {
        trail.unshift({ x: leader.x, y: leader.y });
        followers.forEach((f, i) => {
          const p = trail[i + 1];
          if (!p || (f.x === p.x && f.y === p.y)) return;
          this.walk(f, [{ x: f.x, y: f.y }, p], 150);
        });
        trail.length = followers.length + 2;
      };
      const checkTile = async () => {
        this.r.focus(leader.x, leader.y, this.tile(leader.x, leader.y).h);
        for (const e of events) {
          if (e.fired && e.once !== false) continue;
          if (inZone(e.zone, leader.x, leader.y)) {
            e.fired = true;
            const r = await this.run(e.script || []);
            if (r) return r;
          }
        }
        for (const ex of exits) {
          if (!inZone(ex.zone, leader.x, leader.y)) continue;
          if (ex.requires && !g.checkFlag(ex.requires)) {
            if (ex.locked) await this.run(ex.locked);
            else UI.banner('The way is closed.');
            return 'blocked';
          }
          return { goto: ex.goto, fromField: true };
        }
        if (savePos && leader.x === savePos.x && leader.y === savePos.y) UI.prompt('Save point — press Enter / click to save');
        else {
          const near = npcs.find((n) => {
            const a = this.actor(n.id);
            return a && !a.hidden && adjacent(a, leader);
          });
          UI.prompt(near ? `Talk: ${UI.speakerName(near.id) || near.id} — Enter / click` : '');
        }
        return null;
      };
      const walkPath = async (path) => {
        for (let i = 1; i < path.length; i++) {
          const prevPos = { x: leader.x, y: leader.y };
          await this.walk(leader, [prevPos, path[i]], 170);
          followStep();
          const r = await checkTile();
          if (r === 'blocked') {
            await this.walk(leader, [{ x: leader.x, y: leader.y }, prevPos], 170);
            return null;
          }
          if (r) return r;
        }
        return null;
      };
      const act = async (fn) => {
        if (busy || result) return;
        busy = true;
        try {
          const r = await fn();
          if (r && r !== 'blocked') result = r;
        } finally {
          busy = false;
        }
        if (result) finish();
      };

      const onClick = (t) =>
        act(async () => {
          if (!t) return null;
          const n = npcAt(t.x, t.y);
          if (n) {
            const a = this.actor(n.id);
            if (!adjacent(a, leader)) {
              let best = null;
              for (const [dx, dy] of CT.DIRS) {
                const p = this.path(leader, { x: a.x + dx, y: a.y + dy }, true);
                if (p && (!best || p.length < best.length)) best = p;
              }
              if (best) {
                const r = await walkPath(best);
                if (r) return r;
              }
            }
            if (adjacent(this.actor(n.id), leader)) await talk(n);
            return result;
          }
          if (savePos && t.x === savePos.x && t.y === savePos.y && leader.x === t.x && leader.y === t.y) {
            await this.savePrompt(index);
            return null;
          }
          const p = this.path(leader, t, true);
          if (p) return walkPath(p);
          return null;
        });
      const onKey = (e) => {
        if (busy) return true;
        const dirs = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
        if (dirs[e.key]) {
          const [vx, vy] = dirs[e.key];
          const [dx, dy] = this.r.vecToWorld(vx, vy);
          const t = this.tile(leader.x + dx, leader.y + dy);
          leader.face = CT.dirTo(0, 0, dx, dy);
          if (t && !this.occupied(t.x, t.y, leader) && this.walkable(t, leader) && Math.abs(t.h - this.tile(leader.x, leader.y).h) <= 3)
            act(() => walkPath([{ x: leader.x, y: leader.y }, { x: t.x, y: t.y }]));
          return true;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
          act(async () => {
            if (savePos && leader.x === savePos.x && leader.y === savePos.y) return this.savePrompt(index);
            const [fx, fy] = CT.DIRS[leader.face];
            let n = npcAt(leader.x + fx, leader.y + fy);
            if (!n) n = npcs.find((m) => { const a = this.actor(m.id); return a && !a.hidden && adjacent(a, leader); });
            if (n) await talk(n);
            return result;
          });
          return true;
        }
        if (e.key === 'Escape' || e.key === 'Tab' || e.key === 'm') {
          act(() => this.pauseMenu(index, savePos && Math.abs(leader.x - savePos.x) + Math.abs(leader.y - savePos.y) <= 1));
          return true;
        }
        return false;
      };
      CT.input.field = { click: onClick, key: onKey };
      await checkTile();
      if (CT.onFieldReady) CT.onFieldReady(this, cfg);
      // Test mode: talk to every NPC, then take the first open exit.
      if (CT.AUTOFIELD && !result)
        act(async () => {
          for (const n of npcs) {
            const flat = JSON.stringify(n.talk || []);
            if (flat.includes('"battle"') || flat.includes('"goto"')) continue;
            await talk(n);
            if (result) return result;
          }
          const open = exits.filter((e) => !e.requires || g.checkFlag(e.requires));
          const pickEx = (CT.AUTOFIELD_PREFER && open.find((e) => e.goto === CT.AUTOFIELD_PREFER)) || open.find((e) => e.goto !== 'spekkio') || open[0];
          if (!pickEx) return null;
          const cells = Array.isArray(pickEx.zone) ? pickEx.zone : [...(this.world.map.zones[pickEx.zone] || [])].map((k) => k.split(',').map(Number));
          if (!cells.length) return null;
          const [x, y] = cells[0];
          leader.x = x;
          leader.y = y;
          leader.rx = x;
          leader.ry = y;
          leader.rh = this.visH(this.tile(x, y));
          const r = await checkTile();
          return r === 'blocked' ? null : r;
        });
      await done;
      CT.input.field = null;
      UI.hint('');
      UI.prompt('');
      this.fieldState = null;
      return result;
    }

    async pauseMenu(index, canSave) {
      const r = await UI.menu([
        { label: 'Party', value: 'party' },
        { label: 'Items', value: 'items' },
        { label: 'Save', value: 'save', disabled: !canSave, hint: canSave ? '' : 'Find a save point to save.' },
        { label: 'Options', value: 'options' },
        { label: 'Quit to title', value: 'title' },
      ], { title: 'MENU' });
      if (r === 'party') await UI.partyStatus();
      if (r === 'items') await UI.itemMenu();
      if (r === 'options') await UI.options();
      if (r === 'save') await this.savePrompt(index);
      if (r === 'title') {
        const ok = await UI.menu([{ label: 'Quit (unsaved progress is lost)', value: true }, { label: 'Cancel', value: false }], { title: 'Quit?' });
        if (ok) return { title: true };
      }
      return null;
    }

    // ---- Credits ----------------------------------------------------------------------------
    async credits() {
      const C = CT.CREDITS || { stills: [], roles: [] };
      if (window.TEST_LOG) window.TEST_LOG.push({ credits: 'start', stills: (C.stills || []).length, flags: { ...this.game.flags } });
      CT.audio && CT.audio.playMusic('mus_credits');
      const panel = await UI.credits(C);
      const cap = panel.querySelector('.still-cap');
      const stills = C.stills || [];
      const per = CT.FAST ? 5 : 9000;
      for (let i = 0; i < Math.max(1, stills.length); i++) {
        let s = stills[i];
        if (s && s.variants) {
          const v = s.variants.find((vr) => this.game.checkFlag(vr.if));
          if (v) s = { ...s, ...v };
        }
        if (s) {
          await tween(500, (k) => (this.r.fade = k));
          this.loadMap(s.map, s.theme);
          for (const a of s.actors || []) this.spawn(a);
          for (const d of s.decor || []) this.world.map.decorAt.set(`${d.x},${d.y}`, { variant: 0, ...d });
          cap.textContent = s.caption || '';
          await tween(500, (k) => (this.r.fade = 1 - k));
          for (const a of s.actors || []) if (a.anim) this.anim(a.id, a.anim);
          for (const [kind, at] of s.vfx || []) this.vfx(kind, at);
        }
        await wait(per);
      }
      await tween(800, (k) => (this.r.fade = k));
      UI.hideCredits();
      if (window.TEST_LOG) window.TEST_LOG.push({ credits: 'end' });
      return { title: true };
    }
  }

  CT.Scene = Scene;
})();
