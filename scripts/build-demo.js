// يبني نسخة تجريبية ثابتة (بدون خادم) من المتجر ولوحة التحكم للمعاينة السريعة.
// الاستعمال: node scripts/build-demo.js <مجلد الإخراج>
const fs = require('fs');
const path = require('path');
const { seed } = require('../lib/seed');

const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'demo-build'));
fs.mkdirSync(out, { recursive: true });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ملاحظة: نمرّر دوال للاستبدال لأن الشيفرة تحتوي $ التي يفسّرها replace كأنماط خاصة
// تحويل كل صور /img/... إلى data URI حتى تعمل الصفحة بدون خادم
const toDataUri = (url) => {
  const f = path.join(root, 'public', url);
  if (!url.startsWith('/img/') || !fs.existsSync(f)) return url;
  return 'data:image/svg+xml;base64,' + fs.readFileSync(f).toString('base64');
};
const data = seed();
const walk = (v) => {
  if (typeof v === 'string') return v.startsWith('/img/') ? toDataUri(v) : v;
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
  return v;
};
const demo = walk(data);
demo.users = demo.users.map(({ salt, hash, ...u }) => ({ ...u, password: 'hesham1234' }));
demo.settings.popup.delay = 6;

const seedJs = `window.__DEMO_SEED__=${JSON.stringify(demo).replace(/</g, '\\u003c')};`;
const mock = read('demo/mock-api.js');
const commerce = read('lib/commerce.js');
const qrlib = fs.readFileSync(require.resolve('qrcode-generator/qrcode.js'), 'utf8');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(read('public/icon.svg')).toString('base64');
const fill = (html) => html.replaceAll('{{TITLE}}', 'متجر الجليل').replaceAll('{{DESC}}', data.settings.seo.description).replaceAll('{{THEME}}', data.settings.colors.primary);

// صفحة المتجر: محتوى بدون html/head/body لأن المعاينة تضيف الهيكل بنفسها
let store = fill(read('public/index.html'));
const head = store.slice(store.indexOf('<head>') + 6, store.indexOf('</head>'))
.replace(/<meta name="viewport"[^>]*>\s*/, '')
  .replace(/<link rel="manifest"[^>]*>\s*/, '').replace(/<link rel="apple-touch-icon"[^>]*>\s*/, '')
  .replace('href="/icon.svg"', `href="${icon}"`)
  .replace('<title>متجر الجليل</title>', '<title>متجر الجليل</title>\n  <meta name="claude:viewport-fit-sides" content="cover">\n  <script>document.documentElement.lang = "ar"; document.documentElement.dir = "rtl";</script>')
  .replace('<link rel="stylesheet" href="/css/store.css">', () => `<style>${read('public/css/store.css')}
.demo-pill{position:fixed;z-index:75;bottom:calc(20px + env(safe-area-inset-bottom,0px));inset-inline-end:max(20px,env(safe-area-inset-left,0px));display:flex;gap:8px;align-items:center;background:var(--surface);color:var(--text);box-shadow:var(--shadow);border-radius:99px;padding:6px 6px 6px 14px;font-size:.85em}
.demo-pill a{background:var(--primary);color:var(--primary-ink);padding:.45em 1em;border-radius:99px;font-weight:700}
.demo-pill button{border:0;background:transparent;color:var(--muted);font-size:.9em;text-decoration:underline}
.header{top:env(safe-area-inset-top,0px)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:60;background:var(--bg)}
</style>`);
let body = store.slice(store.indexOf('<body>') + 6, store.indexOf('</body>'))
    .replace('<script src="/js/commerce.js"></script>', '')
  .replace('<script src="/js/store.js"></script>', () => `<div class="demo-pill">نسخة تجريبية <button type="button" onclick="__demoReset()">إعادة ضبط</button><a href="admin.html">🔐 لوحة التحكم</a></div>
<script>${seedJs}</script>
<script>${commerce}</script>
<script>${mock}</script>
<script>${read('public/js/store.js')}</script>`);
fs.writeFileSync(path.join(out, 'index.html'), head.trim() + '\n' + body.trim() + '\n');

// صفحة الإدارة: ملف مستقل كامل
let admin = fill(read('public/admin/index.html'))
  .replace('href="/icon.svg"', `href="${icon}"`)
  .replace('<link rel="stylesheet" href="/admin/admin.css">', () => `<style>${read('public/admin/admin.css')}</style>`)
  .replace('<script src="/admin/admin.js"></script>', () => `<script>${seedJs}</script>\n<script>${commerce}</script>\n<script>${qrlib}</script>\n<script>${mock}</script>\n<script>${read('public/admin/admin.js')
    .replace(`href="/" target="_blank"`, `href="index.html"`).replaceAll('<a class="btn btn-sec" href="/" target="_blank">', '<a class="btn btn-sec" href="index.html">')
    .replace('href="/#/product/', 'href="index.html#/product/').replace('href="/api/admin/backup"', 'href="#backup"')}</script>`);
fs.writeFileSync(path.join(out, 'admin.html'), admin);
console.log('demo built in', out, Math.round(fs.statSync(path.join(out, 'index.html')).size / 1024) + 'KB');
