const crypto = require('crypto');
const U = require('./_util.js');
// بدء جولة: الخادم يصدر بذرة عشوائية موقّعة (لا حاجة لقاعدة بيانات).
module.exports = (req, res) => {
  if (!U.guard(req, res)) return;
  try {
    if (U.limited(req, 'start', 30)) return res.status(429).json({ error: 'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة.' });
    if (!process.env.RESEND_API_KEY) { console.error('RESEND_API_KEY غير مضبوط'); return res.status(503).json({ error: 'الحملة غير جاهزة بعد، حاول لاحقًا.' }); }
    if (!U.campaignOpen()) return res.status(403).json({ error: 'الحملة غير متاحة حاليًا.' });
    const seed = crypto.randomBytes(12).toString('hex'), ts = Date.now();
    res.status(200).json({ seed, ts, sig: U.sign(`s|${seed}|${ts}`) });
  } catch (e) { console.error('start', e.message); res.status(500).json({ error: 'خطأ في الخادم.' }); }
};
