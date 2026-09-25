// DOM user interface: dialogue, menus, HUDs, title, shop, saves, credits.
// Every interactive piece returns a Promise so scenes/battles can await it.
(function () {
  const CT = (window.CT = window.CT || {});
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const sfx = (id) => CT.audio && CT.audio.sfx(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const UI = {};
  CT.UI = UI;
  const openMenus = new Set();

  // Global key routing: the top-most modal handler gets keys first.
  const keyStack = [];
  UI.pushKeys = (fn) => {
    keyStack.push(fn);
    return () => {
      const i = keyStack.indexOf(fn);
      if (i >= 0) keyStack.splice(i, 1);
    };
  };
  UI.handleKey = (e) => {
    for (let i = keyStack.length - 1; i >= 0; i--) {
      if (keyStack[i](e) !== false) return true;
    }
    return false;
  };
  UI.modalOpen = () => keyStack.length > 0;

  // ---- Dialogue --------------------------------------------------------------------
  const portraitURL = {};
  function portrait(who, emotion) {
    if (!CT.getPortrait || !who || who === 'narrator') return null;
    const k = who + ':' + emotion;
    if (!portraitURL[k]) {
      const cv = CT.getPortrait(who, emotion || 'neutral');
      portraitURL[k] = cv.toDataURL();
    }
    return portraitURL[k];
  }
  UI.speakerName = (who) => (CT.SPEAKERS && CT.SPEAKERS[who] != null ? CT.SPEAKERS[who] : who ? who[0].toUpperCase() + who.slice(1) : '');

  // Shows one line; resolves when the player advances.
  UI.say = function (who, emotion, text, opts = {}) {
    const box = $('dialogue');
    const curator = who === 'curator';
    box.className = 'dlg' + (curator ? ' curator' : '') + (opts.radio ? ' radio' : '') + (who === 'narrator' ? ' narrator' : '');
    const url = portrait(who, emotion);
    const name = opts.name || UI.speakerName(who);
    box.innerHTML = '';
    if (url) {
      const p = el('div', 'dlg-portrait');
      const img = el('img');
      img.src = url;
      p.appendChild(img);
      if (opts.radio) p.appendChild(el('div', 'static'));
      box.appendChild(p);
    }
    const body = el('div', 'dlg-body');
    if (name) body.appendChild(el('div', 'dlg-name', esc(name) + (opts.radio ? ' <span class="tag">(radio)</span>' : '')));
    const tx = el('div', 'dlg-text');
    body.appendChild(tx);
    const more = el('div', 'dlg-more', '▼');
    body.appendChild(more);
    box.appendChild(body);
    box.classList.add('show');
    if (curator) sfx('sfx_curator_speak');
    const shown = curator ? text.toUpperCase() : text;
    const speed = [36, 22, 12, 0][(CT.game && CT.game.settings.textSpeed) ?? 2] ?? 12;
    return new Promise((resolve) => {
      let i = 0;
      let done = false;
      let timer = null;
      const finish = () => {
        done = true;
        clearInterval(timer);
        tx.innerHTML = fmt(shown);
        more.classList.add('on');
      };
      const fmt = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
      if (!speed) finish();
      else
        timer = setInterval(() => {
          i += 1;
          tx.innerHTML = fmt(shown.slice(0, i));
          if (i % 2 === 0 && shown[i] && shown[i] !== ' ') sfx('sfx_text_blip');
          if (i >= shown.length) finish();
        }, speed);
      const advance = () => {
        if (!done) return finish();
        cleanup();
        box.classList.remove('show');
        resolve();
      };
      const onClick = (e) => {
        e.stopPropagation();
        advance();
      };
      box.addEventListener('click', onClick);
      UI.dlgAdvance = advance;
      const pop = UI.pushKeys((e) => {
        if (['Enter', ' ', 'z', 'Z', 'Escape'].includes(e.key)) {
          advance();
          return true;
        }
        return true; // swallow other keys while talking
      });
      const cleanup = () => {
        box.removeEventListener('click', onClick);
        pop();
        UI.dlgAdvance = null;
      };
      if (UI.autoAdvance) setTimeout(() => { finish(); advance(); }, 5);
    });
  };

  // ---- Generic menu ------------------------------------------------------------------
  // items: [{label, note, disabled, value, hint}] → Promise<value|null> (null on cancel)
  UI.menu = function (items, opts = {}) {
    const host = opts.host || $('menu-layer');
    const m = el('div', 'panel menu ' + (opts.cls || ''));
    if (opts.style) Object.assign(m.style, opts.style);
    if (opts.title) m.appendChild(el('div', 'menu-title', esc(opts.title)));
    const hint = el('div', 'menu-hint');
    let sel = Math.max(0, items.findIndex((it) => !it.disabled));
    const btns = items.map((it, i) => {
      const b = el('button', 'mi' + (it.cls ? ' ' + it.cls : ''), `<span>${it.label}</span>${it.note != null ? `<small>${it.note}</small>` : ''}`);
      b.disabled = !!it.disabled;
      b.onmouseenter = () => {
        if (!it.disabled) setSel(i);
      };
      b.onclick = (e) => {
        e.stopPropagation();
        if (!it.disabled) choose(i);
      };
      m.appendChild(b);
      return b;
    });
    if (items.some((it) => it.hint)) m.appendChild(hint);
    host.appendChild(m);
    const setSel = (i) => {
      sel = i;
      btns.forEach((b, j) => b.classList.toggle('sel', j === sel));
      hint.textContent = (items[sel] && (items[sel].hint || items[sel].why)) || '';
      if (opts.onHover) opts.onHover(items[sel]);
    };
    setSel(sel);
    let resolveFn;
    const p = new Promise((r) => (resolveFn = r));
    const close = (v) => {
      pop();
      m.remove();
      resolveFn(v);
    };
    const choose = (i) => {
      sfx('sfx_confirm');
      close(items[i].value !== undefined ? items[i].value : i);
    };
    const pop = UI.pushKeys((e) => {
      const n = items.length;
      if (e.key === 'ArrowDown' || e.key === 's') {
        let j = sel;
        do j = (j + 1) % n;
        while (items[j].disabled && j !== sel);
        setSel(j);
        sfx('sfx_menu_move');
      } else if (e.key === 'ArrowUp' || e.key === 'w') {
        let j = sel;
        do j = (j - 1 + n) % n;
        while (items[j].disabled && j !== sel);
        setSel(j);
        sfx('sfx_menu_move');
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
        if (!items[sel].disabled) choose(sel);
      } else if ((e.key === 'Escape' || e.key === 'x' || e.key === 'Backspace') && !opts.noCancel) {
        sfx('sfx_cancel');
        close(null);
      } else if (!opts.passKeys) return true;
      else return false;
      return true;
    });
    p.close = () => close(null);
    p.el = m;
    openMenus.add(p);
    p.then(() => openMenus.delete(p));
    if (UI.autoChoose != null && opts.auto !== false) setTimeout(() => {
      const i = typeof UI.autoChoose === 'function' ? UI.autoChoose(items, opts) : UI.autoChoose;
      if (i != null && items[i] && !items[i].disabled) choose(i);
    }, 5);
    return p;
  };

  UI.choice = async function (options, opts = {}) {
    const items = options.map((o, i) => ({ label: '☛ ' + esc(o), value: i }));
    const r = await UI.menu(items, { cls: 'choice', noCancel: true, ...opts });
    return r == null ? 0 : r;
  };

  UI.popup = function (text, opts = {}) {
    return new Promise((resolve) => {
      const p = el('div', 'panel popup' + (opts.cls ? ' ' + opts.cls : ''), `<div class="popup-text">${text}</div><div class="dlg-more on">▼</div>`);
      $('menu-layer').appendChild(p);
      sfx(opts.sfx || 'sfx_item_get');
      const close = () => {
        pop();
        p.remove();
        resolve();
      };
      p.onclick = (e) => {
        e.stopPropagation();
        close();
      };
      const pop = UI.pushKeys((e) => {
        if (['Enter', ' ', 'z', 'Escape'].includes(e.key)) close();
        return true;
      });
      if (UI.autoAdvance) setTimeout(close, 5);
    });
  };

  let bannerTimer = null;
  UI.banner = function (text, ms = 1300, cls = '') {
    const b = $('banner');
    b.className = 'show ' + cls;
    b.innerHTML = text;
    clearTimeout(bannerTimer);
    if (ms) bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
  };

  UI.chapterCard = async function (title, sub) {
    const c = $('card');
    c.innerHTML = `<div class="card-title">${esc(title)}</div>${sub ? `<div class="card-sub">${esc(sub)}</div>` : ''}`;
    c.className = 'show';
    sfx('sfx_leene_bell');
    await wait(UI.autoAdvance ? 20 : 2600);
    c.className = '';
    await wait(UI.autoAdvance ? 5 : 600);
  };
  UI.textOnBlack = async function (text) {
    const c = $('card');
    c.innerHTML = `<div class="card-quote">${esc(text)}</div>`;
    c.className = 'show slow';
    await wait(UI.autoAdvance ? 20 : 4200);
    c.className = '';
    await wait(UI.autoAdvance ? 5 : 900);
  };

  UI.hint = (text) => {
    const h = $('hint');
    h.innerHTML = text || '';
    h.classList.toggle('show', !!text);
  };
  UI.prompt = (text) => {
    const h = $('prompt');
    h.innerHTML = text || '';
    h.classList.toggle('show', !!text);
  };

  // ---- Battle HUD ------------------------------------------------------------------------
  UI.battleHud = (on) => {
    for (const id of ['turns', 'objective']) $(id).classList.toggle('hidden', !on);
    if (!on) {
      $('active').classList.add('hidden');
      $('target').classList.add('hidden');
    }
  };
  UI.turnBar = (list) => {
    $('turns').innerHTML = list
      .map((u, i) => `<div class="tb t${u.guest ? 'g' : u.team}${i === 0 ? ' now' : ''}" title="${esc(u.name)}"><img src="${CT.portrait(u.sprite || u.key)}"><span>${esc(u.name.split(' ')[0])}</span></div>`)
      .join('');
  };
  UI.objective = (text, hatch, secondary) => {
    $('objective').innerHTML = `<div class="obj-label">OBJECTIVE</div><div>${esc(text || 'Defeat all enemies')}</div>${secondary ? `<div class="obj-sec">${esc(secondary)}</div>` : ''}${hatch != null ? `<div class="hatch">Hatch in: <b>${hatch}</b></div>` : ''}`;
  };
  const STATUS_NAMES = { burn: 'Burn', slow: 'Slow', haste: 'Haste', stun: 'Stun', catalogued: 'Catalogued', stasis: 'Stasis', magdown: 'MAG↓' };
  UI.unitPanel = (which, u, battle, extra = '') => {
    const e = $(which);
    if (!u) return e.classList.add('hidden');
    e.classList.remove('hidden');
    const t = battle.tile(u.x, u.y);
    const hp = (u.hp / u.maxHp) * 100;
    const mp = u.maxMp && u.maxMp < 999 ? (u.mp / u.maxMp) * 100 : 0;
    const st = Object.keys(u.status || {}).map((s) => `<span class="st st-${s}">${STATUS_NAMES[s] || s}</span>`).join('');
    const img = CT.getPortrait && (u.hero || ['iselle', 'curator', 'curator_core', 'spekkio', 'echo_nu'].includes(u.key)) ? CT.getPortrait(u.hero ? u.id : u.key === 'curator_core' ? 'curator' : u.key === 'echo_nu' ? 'nu' : u.key, 'neutral').toDataURL() : CT.portrait(u.sprite || u.key);
    e.innerHTML = `
      <img class="portrait" src="${img}">
      <div class="info">
        <div class="name"><span class="team${u.guest ? 'g' : u.team}">${esc(u.name)}</span>${u.level ? ` <small>Lv${u.level}</small>` : ''}</div>
        <div class="bar-row"><b>HP</b><div class="bar hp"><i style="width:${hp}%"></i></div><span>${u.hp}/${u.maxHp}</span></div>
        ${u.maxMp && u.maxMp < 999 ? `<div class="bar-row"><b>MP</b><div class="bar mp"><i style="width:${mp}%"></i></div><span>${u.mp}/${u.maxMp}</span></div>` : ''}
        <div class="stats">ATK${u.atk} DEF${u.def} MAG${u.mag} MDF${u.mdef} SPD${u.spd}</div>
        <div class="stats">Mv${u.move} ${u.float ? 'Float' : 'Jp' + u.jump} · CT${Math.min(100, Math.floor(u.ct))} · H${t ? t.h : '?'} ${t ? CT.TERRAIN[t.t].name : ''}</div>
        ${st ? `<div class="stline">${st}</div>` : ''}
        ${extra}
      </div>`;
  };
  UI.tilePanel = (t) => {
    const e = $('target');
    e.classList.remove('hidden');
    const m = CT.TERRAIN[t.t];
    e.innerHTML = `<div class="info"><div class="name">${esc(m.name)}</div><div class="stats">Height ${t.h} · (${t.x},${t.y})</div><div class="stats">${m.walk ? 'Passable' : m.swim ? 'Swimmers & floaters only' : m.void ? 'The void — floaters only' : m.lava ? 'Lava — impassable' : 'Blocked'}</div></div>`;
  };

  // Post-battle results with level ups.
  UI.results = async function (r) {
    const lines = [`<div class="res-title">VICTORY</div>`, `<div>EXP <b>${r.xp}</b> · Gold <b>${r.gold}</b></div>`];
    if (r.items && Object.keys(r.items).length) lines.push(`<div>Items: ${Object.entries(r.items).map(([k, n]) => `${CT.ITEMS[k] ? CT.ITEMS[k].name : k} ×${n}`).join(', ')}</div>`);
    if (r.key) lines.push(`<div>Key item: ${esc(CT.KEY_ITEMS[r.key] || r.key)}</div>`);
    for (const up of r.ups) {
      lines.push(`<div class="lvup">${esc(CT.HEROES[up.id].name)} reached Lv ${up.level}!${up.learned.length ? ` Learned <b>${up.learned.map((t) => CT.TECHS[t].name).join(', ')}</b>!` : ''}</div>`);
    }
    if (r.ups.length) sfx('sfx_level_up');
    await UI.popup(lines.join(''), { cls: 'results', sfx: 'sfx_item_get' });
  };

  // ---- Shop -------------------------------------------------------------------------
  UI.shop = async function (shopId) {
    const shop = CT.SHOPS[shopId];
    const g = CT.game;
    if (!shop) return;
    for (;;) {
      const items = [
        ...shop.items.map((id) => ({ label: CT.ITEMS[id].name, note: `${CT.ITEMS[id].price}G (have ${g.inventory[id] || 0})`, value: { item: id }, disabled: g.gold < CT.ITEMS[id].price, hint: CT.ITEMS[id].desc })),
        ...shop.gear.map((id) => {
          const e = CT.EQUIPMENT[id];
          const owners = e.who === 'all' ? g.party : [e.who];
          const has = owners.every((o) => g.members[o] && g.members[o].equip[e.slot] === id);
          const stats = Object.entries(e.stats).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ');
          return { label: e.name, note: has ? 'Equipped' : `${e.price}G`, value: { gear: id }, disabled: has || g.gold < e.price || (e.who !== 'all' && !g.party.includes(e.who)), hint: `${e.slot} · ${stats} · ${e.who === 'all' ? 'anyone' : CT.HEROES[e.who].name}` };
        }),
        { label: 'Leave', value: 'leave' },
      ];
      const r = await UI.menu(items, { title: `${shop.name} — ${g.gold}G`, cls: 'shop' });
      if (!r || r === 'leave') return;
      if (r.item) {
        const it = CT.ITEMS[r.item];
        if (g.gold >= it.price) {
          g.gold -= it.price;
          g.addItem(r.item);
          sfx('sfx_buy');
        }
      } else if (r.gear) {
        const who = g.buyGear(r.gear);
        if (who) {
          sfx('sfx_buy');
          UI.banner(`${CT.HEROES[who].name} equipped ${CT.EQUIPMENT[r.gear].name}!`);
        } else UI.banner('Nobody would be better off with that.');
      }
    }
  };

  // ---- Save slots ----------------------------------------------------------------------
  const fmtTime = (s) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
  UI.slotMenu = async function (mode) {
    const slots = mode === 'save' ? [1, 2, 3] : ['auto', 1, 2, 3];
    const items = slots.map((s) => {
      const info = CT.Game.info(s);
      return {
        label: s === 'auto' ? 'Autosave' : `Slot ${s}`,
        note: info ? `Lv${info.level} · ${esc(info.where || '')} · ${fmtTime(info.playtime)}` : '— empty —',
        value: s,
        disabled: mode === 'load' && !info,
      };
    });
    return UI.menu(items, { title: mode === 'save' ? 'Save game' : 'Load game', cls: 'slots' });
  };

  // ---- Party status / pause menu ------------------------------------------------------
  UI.partyStatus = async function () {
    const g = CT.game;
    const rows = g.party.map((id) => {
      const m = g.members[id];
      const s = CT.heroStats(m);
      const eq = ['weapon', 'armor', 'helmet', 'accessory'].map((sl) => (m.equip[sl] ? CT.EQUIPMENT[m.equip[sl]].name : '—')).join(' / ');
      const techs = CT.heroTechs(m).map((t) => CT.TECHS[t].name).join(', ');
      return `<div class="ps-row"><img src="${CT.getPortrait ? CT.getPortrait(id, 'neutral').toDataURL() : CT.portrait(id)}"><div>
        <div class="name">${CT.HEROES[id].name} <small>Lv${m.level}</small> <small class="xp">EXP ${m.xp}/${CT.xpToNext(m.level)}</small></div>
        <div class="stats">HP ${m.hp}/${s.hp} · MP ${m.mp}/${s.mp} · ATK ${s.atk} DEF ${s.def} MAG ${s.mag} MDEF ${s.mdef} SPD ${s.spd}</div>
        <div class="stats">${esc(eq)}</div><div class="stats techs">${esc(techs)}</div></div></div>`;
    });
    const duals = Object.values(CT.TECHS).filter((t) => t.dual && g.isTechUnlocked(t) && t.dual.every((id) => g.party.includes(id))).map((t) => t.name);
    await UI.popup(`<div class="res-title">PARTY — ${g.gold}G</div>${rows.join('')}${duals.length ? `<div class="stats">Combo techs: ${duals.join(', ')}</div>` : ''}${g.keyItems.length ? `<div class="stats">Key items: ${g.keyItems.map((k) => CT.KEY_ITEMS[k]).join(', ')}</div>` : ''}`, { cls: 'status', sfx: 'sfx_confirm' });
  };

  UI.itemMenu = async function () {
    const g = CT.game;
    for (;;) {
      const items = Object.entries(g.inventory)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => ({ label: CT.ITEMS[id].name, note: `×${n}`, value: id, hint: CT.ITEMS[id].desc, disabled: !(CT.ITEMS[id].heal || CT.ITEMS[id].mpHeal || id === 'magic_tab' || id === 'revive') }));
      if (!items.length) return UI.popup('No items.');
      const id = await UI.menu(items, { title: 'Items' });
      if (!id) return;
      const who = await UI.menu(g.party.map((p) => {
        const m = g.members[p];
        const s = CT.heroStats(m);
        return { label: CT.HEROES[p].name, note: `HP ${m.hp}/${s.hp} MP ${m.mp}/${s.mp}`, value: p };
      }), { title: 'Use on' });
      if (!who) continue;
      const m = g.members[who];
      const s = CT.heroStats(m);
      const it = CT.ITEMS[id];
      if (id === 'magic_tab') {
        m.bonus.mag = (m.bonus.mag || 0) + 1;
      } else if (it.heal || it.revive) {
        if (m.hp >= s.hp) continue;
        m.hp = Math.min(s.hp, m.hp + (it.heal || Math.round(s.hp * it.revive)));
      } else if (it.mpHeal) {
        if (m.mp >= s.mp) continue;
        m.mp = Math.min(s.mp, m.mp + it.mpHeal);
      }
      g.useItem(id);
      sfx('sfx_heal_chime');
    }
  };

  UI.options = async function () {
    const g = CT.game || { settings: { music: 0.55, sfx: 0.7, textSpeed: 2 } };
    for (;;) {
      const s = g.settings;
      const r = await UI.menu([
        { label: 'Music volume', note: `${Math.round(s.music * 10)}/10`, value: 'music' },
        { label: 'SFX volume', note: `${Math.round(s.sfx * 10)}/10`, value: 'sfx' },
        { label: 'Text speed', note: ['Slow', 'Normal', 'Fast', 'Instant'][s.textSpeed], value: 'text' },
        { label: 'Done', value: 'done' },
      ], { title: 'Options' });
      if (!r || r === 'done') return;
      if (r === 'music') s.music = s.music >= 1 ? 0 : Math.round((s.music + 0.1) * 10) / 10;
      if (r === 'sfx') s.sfx = s.sfx >= 1 ? 0 : Math.round((s.sfx + 0.1) * 10) / 10;
      if (r === 'text') s.textSpeed = (s.textSpeed + 1) % 4;
      CT.audio && CT.audio.setVolume({ music: s.music, sfx: s.sfx });
      try {
        localStorage.setItem('ct_hollow_settings', JSON.stringify(s));
      } catch (e) {}
    }
  };

  // ---- Title & credits --------------------------------------------------------------------
  UI.title = function () {
    const t = $('title');
    t.classList.add('show');
    const has = CT.Game.anySave();
    t.innerHTML = `
      <div class="logo">
        <div class="logo-clock"></div>
        <div class="logo-main">CHRONO&nbsp;TRIGGER</div>
        <div class="logo-sub">THE HOLLOW FUTURE</div>
        <div class="logo-note">a fan-made tactics sequel</div>
      </div>
      <div id="title-menu"></div>
      <div class="legal">Non-commercial fan project. Chrono Trigger © Square Enix. Original art, music & code.</div>`;
    const items = [
      { label: 'New Game', value: 'new' },
      { label: 'Continue', value: 'continue', disabled: !has },
      { label: 'Skirmish (Extra)', value: 'skirmish', hint: 'A free battle on the Zenan riverbank with guests Dave & Mat.' },
      { label: 'Options', value: 'options' },
    ];
    if (CT.DEBUG) items.push({ label: 'Debug: jump to…', value: 'debug' });
    return UI.menu(items, { host: $('title-menu'), cls: 'title-menu', noCancel: true }).then((v) => v);
  };
  UI.hideTitle = () => $('title').classList.remove('show');

  UI.credits = async function (credits) {
    const c = $('credits');
    c.classList.add('show');
    const roles = (credits && credits.roles) || [];
    c.innerHTML = `<div class="roll">${roles.map(([h, names]) => `<h3>${esc(h)}</h3>${names.map((n) => `<p>${esc(n)}</p>`).join('')}`).join('')}<h3 class="fin">THE END</h3></div><div class="still-cap"></div>`;
    const roll = c.querySelector('.roll');
    roll.style.animationDuration = UI.autoAdvance ? '0.05s' : `${Math.max(60, roles.length * 9)}s`;
    return c;
  };
  UI.hideCredits = () => $('credits').classList.remove('show');

  UI.retry = async function () {
    return UI.menu([
      { label: 'Retry battle', value: 'retry' },
      { label: 'Load save', value: 'load', disabled: !CT.Game.anySave() },
      { label: 'Return to title', value: 'title' },
    ], { title: 'DEFEAT', cls: 'defeat', noCancel: true });
  };

  UI.clearMenus = () => {
    for (const m of [...openMenus]) m.close();
    $('menu-layer').innerHTML = '';
  };
})();
