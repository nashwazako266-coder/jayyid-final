const crypto = require('crypto');
const SIM = require('../src/sim.js');

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const rules = () => ({ minScore: +env('MIN_SCORE', 350), maxMistakes: +env('MAX_MISTAKES', 1), minCaught: +env('MIN_CAUGHT', 0) });

function secret() { const s = process.env.SIGNING_SECRET; if (s && s.length >= 16) return s; const k = process.env.RESEND_API_KEY; if (k) return crypto.createHash('sha256').update('jy-signing|' + k).digest('hex'); throw new Error('اضبط RESEND_API_KEY (أو SIGNING_SECRET)'); }
const sign = s => crypto.createHmac('sha256', secret()).update(s).digest('hex');
function safeEq(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }

// حدّ الطلبات (على مستوى النسخة الواحدة من الخادم فقط — للحماية الإضافية فعّل Vercel Firewall rate limit)
const hits = new Map();
function limited(req, route, max, windowMs = 60000) {
  const ip = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'local').split(',')[0].trim();
  const k = route + '|' + ip, now = Date.now(), arr = (hits.get(k) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(k, arr);
  if (hits.size > 5000) for (const [kk, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(kk);
  return arr.length > max;
}

function campaignOpen(now = Date.now()) {
  if (env('CAMPAIGN_OPEN', 'true') === 'false') return false;
  const s = Date.parse(env('CAMPAIGN_START', '')), e = Date.parse(env('CAMPAIGN_END', ''));
  if (Number.isFinite(s) && now < s) return false;
  if (Number.isFinite(e) && now > e) return false;
  return true;
}

// منع التكرار (اختياري): يحتاج Upstash Redis. بدونه يعمل النظام لكن دون منع تكرار الجلسة/الرقم.
async function once(key, ttl = 60 * 60 * 24 * 30) {
  const url = process.env.UPSTASH_REDIS_REST_URL, tok = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return true;
  const r = await fetch(`${url}/set/${encodeURIComponent(key)}/1/NX/EX/${ttl}`, { headers: { Authorization: `Bearer ${tok}` } });
  const j = await r.json().catch(() => ({}));
  return j.result === 'OK';
}

const AR = '٠١٢٣٤٥٦٧٨٩', FA = '۰۱۲۳۴۵۶۷۸۹';
function normalizeLibyanMobile(raw) {
  const prefixes = env('PHONE_PREFIXES', '91,92,93,94').split(',').map(x => x.trim());
  let s = String(raw == null ? '' : raw).replace(/[٠-٩۰-۹]/g, c => String(AR.includes(c) ? AR.indexOf(c) : FA.indexOf(c))).replace(/[\s\-().]/g, '');
  if (s.startsWith('+218')) s = s.slice(4); else if (s.startsWith('00218')) s = s.slice(5); else if (s.startsWith('218')) s = s.slice(3);
  if (s.startsWith('0')) s = s.slice(1);
  return /^\d{9}$/.test(s) && prefixes.includes(s.slice(0, 2)) ? '+218' + s : null;
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const body = req => { let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } } return b && typeof b === 'object' ? b : {}; };
function guard(req, res) { res.setHeader('Cache-Control', 'no-store'); if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'الطريقة غير مسموحة' }); return false; } return true; }

module.exports = { SIM, env, rules, sign, safeEq, limited, campaignOpen, once, normalizeLibyanMobile, clean, esc, body, guard };
