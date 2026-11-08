const crypto = require('crypto');
const U = require('./_util.js');

async function sendMail({ ref, name, phone, city, score, caught }) {
  const key = process.env.RESEND_API_KEY; if (!key) throw new Error('RESEND_API_KEY غير مضبوط');
  const to = U.env('ADMIN_EMAIL', 'nashwazako266@gmail.com'), from = U.env('MAIL_FROM', 'تحدّي سلة الجيد <onboarding@resend.dev>');
  const when = new Date().toLocaleString('ar-LY', { timeZone: 'Africa/Tripoli' });
  const rows = [['الرقم المرجعي', ref], ['الاسم', name], ['الهاتف', phone], ['المدينة', city || '—'], ['النقاط', score], ['المنتجات الملتقطة', caught], ['الوقت', when]];
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h2 style="color:#c40012">مشاركة مؤهلة جديدة — تحدّي سلة الجيد</h2><table cellpadding="8" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="border:1px solid #ddd;background:#fafafa"><b>${U.esc(k)}</b></td><td style="border:1px solid #ddd">${U.esc(v)}</td></tr>`).join('')}</table><p style="color:#777">التأهل لا يعني الفوز النهائي؛ الاختيار يتم بالسحب وفق شروط الحملة.</p></div>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject: `مشاركة مؤهلة جديدة — ${ref}`, html, text }) });
  if (!r.ok) throw new Error('Resend ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

module.exports = async (req, res) => {
  if (!U.guard(req, res)) return;
  try {
    if (U.limited(req, 'register', 8)) return res.status(429).json({ error: 'محاولات كثيرة، انتظر قليلًا.' });
    if (!U.campaignOpen()) return res.status(403).json({ error: 'التسجيل مغلق حاليًا.' });
    const b = U.body(req), p = String(b.token || '').split('.');
    if (p.length !== 5) return res.status(400).json({ error: 'رمز التأهل غير صالح.' });
    const [seed, score, caught, exp, sig] = p;
    if (!/^[0-9a-f]{24}$/.test(seed) || !U.safeEq(sig, U.sign(`q|${seed}|${score}|${caught}|${exp}`))) return res.status(400).json({ error: 'رمز التأهل غير صالح.' });
    if (Date.now() > +exp) return res.status(400).json({ error: 'انتهت صلاحية رمز التأهل، العب جولة جديدة.' });
    const name = U.clean(b.name, 80), city = U.clean(b.city, 60), phone = U.normalizeLibyanMobile(b.phone);
    if (name.length < 3) return res.status(400).json({ error: 'اكتب اسمك الكامل.' });
    if (!phone) return res.status(400).json({ error: 'رقم الهاتف غير صحيح (مثال: 0912345678).' });
    if (b.consent !== true) return res.status(400).json({ error: 'يجب الموافقة على سياسة الخصوصية وشروط المشاركة.' });
    if (!(await U.once('seed:' + seed))) return res.status(409).json({ error: 'تم تسجيل هذه الجولة مسبقًا.' });
    const phoneKey = 'phone:' + crypto.createHash('sha256').update(phone).digest('hex');
    if (!(await U.once(phoneKey))) return res.status(409).json({ error: 'هذا الرقم مسجّل مسبقًا في الحملة.' });
    const ref = 'JY-' + crypto.createHash('sha256').update(seed).digest('hex').slice(0, 6).toUpperCase();
    try { await sendMail({ ref, name, phone, city, score, caught }); }
    catch (e) { console.error('MAIL_FAILED', JSON.stringify({ ref, name, phone, city, score }), e.message); return res.status(502).json({ error: 'تعذّر إرسال بياناتك الآن، أعد المحاولة بعد لحظات.' }); }
    console.log('REGISTERED', ref, 'score', score);
    res.status(200).json({ ok: true, ref });
  } catch (e) { console.error('register', e.message); res.status(500).json({ error: 'خطأ في الخادم.' }); }
};
