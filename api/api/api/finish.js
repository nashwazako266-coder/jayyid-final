const U = require('./_util.js');
// إنهاء جولة: الخادم يعيد تشغيل المحاكاة بنفس البذرة ويحسب النقاط والتأهل بنفسه، ولا يثق بأي نقاط من المتصفح.
module.exports = (req, res) => {
  if (!U.guard(req, res)) return;
  try {
    if (U.limited(req, 'finish', 30)) return res.status(429).json({ error: 'محاولات كثيرة، انتظر قليلًا.' });
    if (!U.campaignOpen()) return res.status(403).json({ error: 'الحملة غير متاحة حاليًا.' });
    const b = U.body(req), seed = String(b.seed || ''), ts = Number(b.ts), sig = String(b.sig || '');
    if (!/^[0-9a-f]{24}$/.test(seed) || !Number.isFinite(ts) || !U.safeEq(sig, U.sign(`s|${seed}|${ts}`))) { console.warn('finish: invalid session'); return res.status(400).json({ error: 'جلسة غير صالحة.' }); }
    const now = Date.now(), elapsed = now - ts;
    if (elapsed > 5 * 60 * 1000) return res.status(400).json({ error: 'انتهت صلاحية الجولة، العب من جديد.' });
    const ev = Array.isArray(b.events) ? b.events.slice(0, 200).map(e => ({ id: +e.id, t: +e.t, bx: +e.bx })) : null;
    if (!ev) return res.status(400).json({ error: 'بيانات الجولة غير صالحة.' });
    const r = U.SIM.simulate(seed, ev), R = U.rules();
    if (!r.valid) { console.warn('finish: rejected', r.reason); return res.status(200).json({ ok: true, valid: false, rules: R }); }
    // جولة مكتملة لا تصل قبل انقضاء مدتها الفعلية؛ ولا يوجد حدث بعد زمن الخادم المنقضي
    const last = ev.length ? ev[ev.length - 1].t : 0;
    if (last > elapsed + 300 || (r.completed && elapsed < U.SIM.CFG.durationMs)) { console.warn('finish: timing mismatch'); return res.status(200).json({ ok: true, valid: false, rules: R }); }
    const qualified = r.completed && r.score >= R.minScore && r.mistakes <= R.maxMistakes && r.caught >= R.minCaught;
    const out = { ok: true, valid: true, score: r.score, caught: r.caught, mistakes: r.mistakes, completed: r.completed, qualified, rules: R };
    if (qualified) { const exp = now + 15 * 60 * 1000; out.token = `${seed}.${r.score}.${r.caught}.${exp}.${U.sign(`q|${seed}|${r.score}|${r.caught}|${exp}`)}`; }
    res.status(200).json(out);
  } catch (e) { console.error('finish', e.message); res.status(500).json({ error: 'خطأ في الخادم.' }); }
};
