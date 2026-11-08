// فحص جاهزية النشر: افتح /api/health بعد النشر. لا يكشف أي أسرار.
const U = require('./_util.js');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const mail = !!process.env.RESEND_API_KEY, signing = mail || !!process.env.SIGNING_SECRET;
  res.status(mail && signing ? 200 : 503).json({ ready: mail && signing, mail, signing, adminEmail: U.env('ADMIN_EMAIL', 'nashwazako266@gmail.com'), campaignOpen: U.campaignOpen(), rules: U.rules(), dedupe: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) });
};
