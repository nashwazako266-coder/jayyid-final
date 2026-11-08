// المحاكاة الحتمية: نفس الملف يعمل في المتصفح (داخل index.html) وعلى الخادم (api/*). لا تعدّله في مكان واحد فقط.
(function (root, f) { var x = f(); if (typeof module === 'object' && module.exports) module.exports = x; else root.SIM = x; })(typeof self !== 'undefined' ? self : this, function () {
  const CFG = { durationMs: 30000, lives: 3, goodPts: 10, badPenalty: 5, basketHalfW: 0.09, maxBasketSpeed: 2.0, tolMs: 140, variants: 13 };
  const BASKET_Y = 0.88, REACH = 1.5;
  function xmur3(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }; }
  function rng(seed) { let a = xmur3(seed)(); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const catchMs = i => i.spawnMs + BASKET_Y / i.speed * 1000;
  // ثلاث مراحل (30–21 / 20–11 / 10–0 ثانية متبقية)
  const ST = [
    { gap: [620, 830], sp: [0.41, 0.54], bad: 0.22, burst: 0.12 },
    { gap: [440, 610], sp: [0.56, 0.74], bad: 0.28, burst: 0.24 },
    { gap: [300, 440], sp: [0.74, 0.98], bad: 0.32, burst: 0.36 }];
  const stage = ms => { const l = (CFG.durationMs - ms) / 1000; return l > 20 ? 0 : l > 10 ? 1 : 2; };
  function generateSchedule(seed) {
    const r = rng(String(seed)), it = []; let t = 700, id = 0;
    while (t < CFG.durationMs - 600) {
      const s = ST[stage(t)], n = r() < s.burst ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const sp = s.sp[0] + r() * (s.sp[1] - s.sp[0]);
        const c = { id, spawnMs: t + k * 90, x: 0, speed: sp, good: r() >= s.bad, variant: Math.floor(r() * CFG.variants) };
        if (catchMs(c) > CFG.durationMs - 100) continue;
        const near = it.filter(o => Math.abs(catchMs(o) - catchMs(c)) < 1600); let ok = false;
        for (let q = 0; q < 40 && !ok; q++) { c.x = 0.08 + r() * 0.84; ok = near.every(o => Math.abs(o.x - c.x) <= REACH * Math.abs(catchMs(o) - catchMs(c)) / 1000); }
        if (ok) { it.push(c); id++; }
      }
      t += s.gap[0] + r() * (s.gap[1] - s.gap[0]);
    }
    return it;
  }
  const comboBonus = s => Math.min(Math.floor(s / 3) * 2, 10);
  const fail = reason => ({ valid: false, reason, score: 0, caught: 0, mistakes: 0, livesLeft: 0, maxCombo: 0, completed: false });
  function simulate(seed, ev) {
    const items = generateSchedule(seed), byId = new Map(items.map(i => [i.id, i]));
    if (!Array.isArray(ev) || ev.length > items.length) return fail('too_many_events');
    const seen = new Set(); let pT = 0, pX = 0.5;
    for (const e of ev) {
      const it = e && byId.get(e.id);
      if (!it || !Number.isFinite(e.t) || !Number.isFinite(e.bx)) return fail('bad_event');
      if (seen.has(e.id)) return fail('duplicate_item'); seen.add(e.id);
      if (e.t < pT) return fail('unordered');
      if (Math.abs(e.t - catchMs(it)) > CFG.tolMs) return fail('impossible_timing');
      if (e.bx < 0 || e.bx > 1) return fail('out_of_bounds');
      if (Math.abs(e.bx - it.x) > CFG.basketHalfW + 0.02) return fail('basket_not_under_item');
      const dt = Math.max(e.t - pT, 1) / 1000;
      if (Math.abs(e.bx - pX) > CFG.maxBasketSpeed * dt + 0.03) return fail('basket_too_fast');
      pT = e.t; pX = e.bx;
    }
    const m = new Map(ev.map(e => [e.id, e]));
    const tl = items.filter(i => m.has(i.id) || (i.good && catchMs(i) <= CFG.durationMs))
      .map(i => ({ t: m.has(i.id) ? m.get(i.id).t : catchMs(i), i, hit: m.has(i.id) })).sort((a, b) => a.t - b.t);
    let sc = 0, st = 0, lv = CFG.lives, g = 0, b = 0, mx = 0, end = false;
    for (const x of tl) {
      if (end) { if (x.hit) return fail('event_after_round_end'); continue; }
      if (x.t > CFG.durationMs) { if (x.hit) return fail('event_after_time'); continue; }
      if (x.hit && x.i.good) { st++; g++; sc += CFG.goodPts + comboBonus(st); mx = Math.max(mx, st); }
      else if (x.hit) { b++; lv--; st = 0; sc = Math.max(0, sc - CFG.badPenalty); if (lv <= 0) end = true; }
      else st = 0;
    }
    return { valid: true, score: sc, caught: g, mistakes: b, livesLeft: Math.max(lv, 0), maxCombo: mx, completed: !end };
  }
  return { CFG, BASKET_Y, generateSchedule, simulate, catchMs, comboBonus, stage, rng };
});
