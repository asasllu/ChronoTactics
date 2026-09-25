// Persistent game state: party, levels, inventory, gold, flags, tech unlocks,
// plus save/load (localStorage) and autosave snapshots.
(function () {
  const CT = (window.CT = window.CT || {});
  const SAVE_PREFIX = 'ct_hollow_save_';

  class Game {
    constructor() {
      this.members = {}; // id -> { id, level, xp, hp, mp, equip, bonus }
      this.party = [];
      this.inventory = { tonic: 3, mid_tonic: 0, ether: 1, revive: 1, shelter: 0, magic_tab: 0 };
      this.keyItems = [];
      this.gold = 100;
      this.flags = {};
      this.unlocked = {};
      this.guests = [];
      this.playtime = 0;
      this.settings = { music: 0.55, sfx: 0.7, textSpeed: 2 };
      for (const id of Object.keys(CT.HEROES)) this.members[id] = this.newMember(id, 1);
      this.setParty(['crono', 'frog']);
    }

    newMember(id, level) {
      const m = { id, level, xp: 0, equip: {}, bonus: {} };
      const s = CT.heroStats(m);
      m.hp = s.hp;
      m.mp = s.mp;
      return m;
    }

    setParty(ids) {
      this.party = ids.slice();
    }
    avgLevel() {
      const ls = this.party.map((id) => this.members[id].level);
      return Math.max(1, Math.round(ls.reduce((a, b) => a + b, 0) / Math.max(1, ls.length)));
    }
    join(id) {
      const lv = this.avgLevel();
      if (!this.party.includes(id)) this.party.push(id);
      const m = this.members[id];
      if (m.level < lv) {
        m.level = lv;
        m.xp = 0;
      }
      this.fullHeal(id);
    }
    fullHeal(id) {
      const ids = id ? [id] : Object.keys(this.members);
      for (const i of ids) {
        const m = this.members[i];
        const s = CT.heroStats(m);
        m.hp = s.hp;
        m.mp = s.mp;
      }
    }

    // XP is shared by everyone (even members not in the battle), per §3.9.
    gainXp(xp) {
      const ups = [];
      for (const m of Object.values(this.members)) {
        if (m.level >= CT.LEVEL_CAP) continue;
        m.xp += xp;
        while (m.level < CT.LEVEL_CAP && m.xp >= CT.xpToNext(m.level)) {
          m.xp -= CT.xpToNext(m.level);
          const before = CT.heroTechs(m);
          const oldS = CT.heroStats(m);
          m.level += 1;
          const s = CT.heroStats(m);
          m.hp += s.hp - oldS.hp;
          m.mp += s.mp - oldS.mp;
          const learned = CT.heroTechs(m).filter((t) => !before.includes(t));
          if (this.party.includes(m.id)) ups.push({ id: m.id, level: m.level, learned });
        }
      }
      return ups;
    }

    addItem(id, n = 1) {
      this.inventory[id] = (this.inventory[id] || 0) + n;
    }
    useItem(id) {
      if (!this.inventory[id]) return false;
      this.inventory[id] -= 1;
      return true;
    }
    addKey(id) {
      if (!this.keyItems.includes(id)) this.keyItems.push(id);
    }

    // Equipment is bought for its owner ('all' = the best candidate) and equipped
    // if it's an upgrade. Returns who got it.
    buyGear(gid) {
      const e = CT.EQUIPMENT[gid];
      if (!e || this.gold < e.price) return null;
      const owners = e.who === 'all' ? Object.keys(this.members).filter((id) => this.party.includes(id)) : [e.who];
      const score = (g) => (g ? Object.values(CT.EQUIPMENT[g].stats).reduce((a, b) => a + b, 0) : 0);
      const cand = owners
        .map((id) => ({ id, cur: score(this.members[id].equip[e.slot]) }))
        .filter((c) => c.cur < score(gid))
        .sort((a, b) => a.cur - b.cur)[0];
      if (!cand) return null;
      this.gold -= e.price;
      this.members[cand.id].equip[e.slot] = gid;
      return cand.id;
    }

    isTechUnlocked(t) {
      return !t.unlock || !!this.unlocked[t.id];
    }
    unlock(id) {
      this.unlocked[id] = true;
    }

    // Copies surviving HP/MP back from battle units. KO'd heroes revive at 1 HP.
    syncFromBattle(battle) {
      for (const u of battle.units) {
        if (!u.hero || !this.members[u.id]) continue;
        const m = this.members[u.id];
        m.hp = u.alive ? u.hp : 1;
        m.mp = u.mp;
      }
    }

    checkFlag(cond) {
      if (typeof cond === 'string') {
        if (cond.startsWith('!')) return !this.flags[cond.slice(1)];
        return !!this.flags[cond];
      }
      if (cond && cond.flag) {
        const v = this.flags[cond.flag] || 0;
        if (cond.gt != null) return v > cond.gt;
        if (cond.gte != null) return v >= cond.gte;
        if (cond.lt != null) return v < cond.lt;
        if (cond.eq != null) return v === cond.eq;
        return !!v;
      }
      return !!cond;
    }

    // ---- Save / load ---------------------------------------------------------------
    serialize(resume) {
      return JSON.stringify({
        v: 1, t: Date.now(), members: this.members, party: this.party, inventory: this.inventory,
        keyItems: this.keyItems, gold: this.gold, flags: this.flags, unlocked: this.unlocked,
        guests: this.guests, playtime: this.playtime, settings: this.settings, resume,
      });
    }
    static deserialize(str) {
      const d = JSON.parse(str);
      const g = new Game();
      Object.assign(g, { members: d.members, party: d.party, inventory: d.inventory, keyItems: d.keyItems, gold: d.gold, flags: d.flags, unlocked: d.unlocked, guests: d.guests || [], playtime: d.playtime || 0, settings: { ...g.settings, ...(d.settings || {}) } });
      g.resume = d.resume;
      return g;
    }
    save(slot, resume) {
      try {
        localStorage.setItem(SAVE_PREFIX + slot, this.serialize(resume));
        return true;
      } catch (e) {
        return false;
      }
    }
    static load(slot) {
      try {
        const s = localStorage.getItem(SAVE_PREFIX + slot);
        return s ? Game.deserialize(s) : null;
      } catch (e) {
        return null;
      }
    }
    static info(slot) {
      try {
        const s = localStorage.getItem(SAVE_PREFIX + slot);
        if (!s) return null;
        const d = JSON.parse(s);
        const scene = d.resume && CT.SCENES && CT.SCENES[d.resume.scene];
        return { t: d.t, level: Math.max(...Object.values(d.members).map((m) => m.level)), where: scene ? scene.title : d.resume && d.resume.scene, playtime: d.playtime || 0, party: d.party };
      } catch (e) {
        return null;
      }
    }
    static anySave() {
      return ['auto', 1, 2, 3].some((s) => Game.info(s));
    }
  }

  CT.Game = Game;
})();
