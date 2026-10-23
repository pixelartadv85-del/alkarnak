// خادم متجر الجليل: واجهة المتجر + واجهة برمجية عامة + لوحة إدارة محمية.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const store = require('./lib/store');
const { seed, defaultSettings, hashPassword, writeSeedImages } = require('./lib/seed');
const ai = require('./lib/ai');

const PORT = process.env.PORT || 3000;
const db = () => store.db;
store.load(seed);
writeSeedImages();

migrateSettings();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// ---------------------------------------------------------------- أدوات مساعدة
const round2 = (n) => Math.round(n * 100) / 100;
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
const slugify = (s) =>
  String(s).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || store.id();

function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

// إضافة أي إعدادات جديدة للنسخ القديمة من قاعدة البيانات دون المساس بالقيم الموجودة
function migrateSettings() {
  const merged = deepMerge(defaultSettings(), db().settings);
  db().settings = merged;
  for (const key of ['coupons', 'orders', 'blendRequests', 'reviews', 'slides', 'users', 'customers', 'campaigns']) db()[key] = db()[key] || [];
  store.save();
}

function rateLimiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const rec = hits.get(key) || { n: 0, t: now };
    if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
    rec.n++;
    hits.set(key, rec);
    if (hits.size > 5000) hits.clear();
    if (rec.n > max) return res.status(429).json({ error: 'طلبات كثيرة، يرجى المحاولة لاحقاً' });
    next();
  };
}

const finalPrice = (p) => round2(p.price * (1 - Math.min(100, Math.max(0, p.discount || 0)) / 100));

function productRating(pid) {
  const rs = db().reviews.filter((r) => r.productId === pid && r.approved);
  return { rating: rs.length ? round2(rs.reduce((a, r) => a + r.rating, 0) / rs.length) : 0, reviewsCount: rs.length };
}

function publicProduct(p) {
  const { sold, ...rest } = p;
  return { ...rest, finalPrice: finalPrice(p), inStock: p.stock > 0, ...productRating(p.id) };
}

function findCoupon(code) {
  if (!code) return null;
  const c = db().coupons.find((k) => k.active && k.code.toLowerCase() === String(code).trim().toLowerCase());
  if (!c) return null;
  if (c.expires && new Date(c.expires + 'T23:59:59') < new Date()) return null;
  return c;
}

// حساب الطلب على الخادم دائماً (لا نثق بأسعار المتصفح)
function priceCart(items, couponCode) {
  const s = db().settings.shop;
  const lines = [];
  for (const it of Array.isArray(items) ? items : []) {
    const p = db().products.find((x) => x.id === it.id && x.active);
    const qty = Math.max(1, Math.min(99, Math.floor(num(it.qty, 1))));
    if (!p) continue;
    const unit = finalPrice(p);
    lines.push({ productId: p.id, name: p.name, size: p.size || '', image: p.images[0] || '', price: p.price, discount: p.discount || 0, unitFinal: unit, qty, lineTotal: round2(unit * qty), stock: p.stock });
  }
  const subtotal = round2(lines.reduce((a, l) => a + l.price * l.qty, 0));
  const productDiscount = round2(lines.reduce((a, l) => a + (l.price - l.unitFinal) * l.qty, 0));
  const afterDiscount = round2(subtotal - productDiscount);
  let coupon = null;
  let couponDiscount = 0;
  let couponError = '';
  if (couponCode) {
    const c = findCoupon(couponCode);
    if (!c) couponError = 'كود الخصم غير صالح أو منتهي';
    else if (afterDiscount < (c.minTotal || 0)) couponError = `هذا الكود يتطلب طلباً بقيمة ${c.minTotal} ₪ على الأقل`;
    else {
      coupon = c;
      couponDiscount = c.type === 'percent' ? round2((afterDiscount * c.value) / 100) : Math.min(afterDiscount, c.value);
    }
  }
  const net = round2(afterDiscount - couponDiscount);
  const freeOver = num(s.freeShippingOver);
  const shipping = lines.length === 0 ? 0 : freeOver > 0 && net >= freeOver ? 0 : num(s.shippingFee);
  return { lines, subtotal, productDiscount, couponCode: coupon ? coupon.code : '', couponDiscount, couponError, shipping, total: round2(net + shipping) };
}

const PHONE_RE = /^(\+?(972|970)|0)5\d{8}$/;
const normPhone = (p) => String(p || '').replace(/[\s\-()]/g, '');

// ---------------------------------------------------------------- المصادقة
const SECRET_FILE = path.join(store.DATA_DIR, 'secret.key');
const SECRET = process.env.SESSION_SECRET || (fs.existsSync(SECRET_FILE)
  ? fs.readFileSync(SECRET_FILE, 'utf8')
  : (() => { const k = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(SECRET_FILE, k); return k; })());
const COOKIE = 'jalil_admin';
const SESSION_HOURS = 12;

const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function issueToken(user) {
  const payload = Buffer.from(JSON.stringify({ uid: user.id, v: user.hash.slice(0, 12), exp: Date.now() + SESSION_HOURS * 3600e3 })).toString('base64url');
  return payload + '.' + sign(payload);
}

function readToken(req) {
  const raw = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    const user = db().users.find((u) => u.id === data.uid && u.active);
    // تغيير كلمة المرور يُبطل الجلسات القديمة
    if (!user || user.hash.slice(0, 12) !== data.v) return null;
    return user;
  } catch {
    return null;
  }
}

function setCookie(req, res, value, maxAge) {
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

// ---------------------------------------------------------------- حسابات الزبائن (اختيارية)
const CUSTOMER_COOKIE = 'jalil_customer';
const CUSTOMER_DAYS = 180;

function issueCustomerToken(c) {
  const payload = Buffer.from(JSON.stringify({ cid: c.id, v: c.hash.slice(0, 12), exp: Date.now() + CUSTOMER_DAYS * 864e5 })).toString('base64url');
  return payload + '.' + sign('customer:' + payload);
}

function readCustomer(req) {
  const raw = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(CUSTOMER_COOKIE + '='));
  if (!raw) return null;
  const [payload, sig] = raw.slice(CUSTOMER_COOKIE.length + 1).split('.');
  if (!payload || !sig) return null;
  const expected = sign('customer:' + payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    const c = db().customers.find((x) => x.id === data.cid && x.active !== false);
    return c && c.hash.slice(0, 12) === data.v ? c : null;
  } catch {
    return null;
  }
}

function setCustomerCookie(req, res, value, maxAge) {
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${CUSTOMER_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

const ROLES = {
  owner: ['orders', 'catalog', 'content', 'settings', 'users'],
  admin: ['orders', 'catalog', 'content', 'settings'],
  editor: ['catalog', 'content'],
  orders: ['orders'],
};
const can = (user, perm) => (ROLES[user.role] || []).includes(perm);

function auth(perm) {
  return (req, res, next) => {
    const user = readToken(req);
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    if (perm && !can(user, perm)) return res.status(403).json({ error: 'لا تملك صلاحية لهذا الإجراء' });
    req.user = user;
    next();
  };
}

const safeUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, active: u.active, permissions: ROLES[u.role] || [] });

// ---------------------------------------------------------------- الواجهة العامة
const api = express.Router();

api.get('/bootstrap', (req, res) => {
  const d = db();
  res.json({
    settings: d.settings,
    categories: d.categories.filter((c) => c.active).sort((a, b) => a.order - b.order),
    products: d.products.filter((p) => p.active).map(publicProduct),
    slides: d.slides.filter((s) => s.active).sort((a, b) => a.order - b.order),
    testimonials: d.reviews.filter((r) => r.approved && r.rating >= 4).sort((a, b) => b.createdAt - a.createdAt).slice(0, 9)
      .map((r) => ({ ...r, productName: (d.products.find((p) => p.id === r.productId) || {}).name || '' })),
    aiAvailable: d.settings.ai.enabled && ai.isConfigured(),
  });
});

api.get('/products/:id/reviews', (req, res) => {
  res.json(db().reviews.filter((r) => r.productId === req.params.id && r.approved).sort((a, b) => b.createdAt - a.createdAt)
    .map(({ id, name, town, rating, text, createdAt }) => ({ id, name, town, rating, text, createdAt })));
});

api.post('/products/:id/reviews', rateLimiter(5, 3600e3), (req, res) => {
  const p = db().products.find((x) => x.id === req.params.id && x.active);
  if (!p) return res.status(404).json({ error: 'المنتج غير موجود' });
  const name = str(req.body.name, 60);
  const text = str(req.body.text, 1000);
  const rating = Math.max(1, Math.min(5, Math.round(num(req.body.rating, 5))));
  if (!name || text.length < 3) return res.status(400).json({ error: 'يرجى كتابة الاسم والتقييم' });
  const approved = Boolean(db().settings.shop.autoApproveReviews);
  db().reviews.push({ id: store.id('r_'), productId: p.id, name, town: str(req.body.town, 60), rating, text, approved, createdAt: Date.now() });
  store.save();
  res.json({ ok: true, approved });
});

api.post('/cart/price', (req, res) => {
  res.json(priceCart(req.body.items, req.body.coupon));
});

api.post('/orders', rateLimiter(10, 3600e3), (req, res) => {
  const b = req.body || {};
  const c = b.customer || {};
  const customer = {
    firstName: str(c.firstName, 60),
    lastName: str(c.lastName, 60),
    town: str(c.town, 80),
    address: str(c.address, 300),
    phone: normPhone(c.phone),
    phone2: normPhone(c.phone2).slice(0, 20),
    notes: str(c.notes, 1000),
    location: null,
  };
  if (c.location && Number.isFinite(Number(c.location.lat)) && Number.isFinite(Number(c.location.lng))) {
    customer.location = { lat: round6(c.location.lat), lng: round6(c.location.lng), accuracy: Math.round(num(c.location.accuracy)) };
  }
  customer.locationLink = str(c.locationLink, 400);
  const errors = [];
  if (!customer.firstName) errors.push('الاسم الشخصي مطلوب');
  if (!customer.lastName) errors.push('اسم العائلة مطلوب');
  if (!customer.town) errors.push('البلدة مطلوبة');
  if (!customer.address) errors.push('العنوان مطلوب');
  if (!PHONE_RE.test(customer.phone)) errors.push('رقم الهاتف غير صحيح (مثال: 0501234567)');
  if (db().settings.shop.requireLocation && !customer.location && !customer.locationLink) errors.push('يرجى تحديد موقعك');
  const priced = priceCart(b.items, b.coupon);
  if (!priced.lines.length) errors.push('السلة فارغة');
  const minOrder = num(db().settings.shop.minOrder);
  if (minOrder && priced.total - priced.shipping < minOrder) errors.push(`الحد الأدنى للطلب ${minOrder} ₪`);
  for (const l of priced.lines) if (l.qty > l.stock) errors.push(`الكمية المتوفرة من "${l.name}" هي ${l.stock} فقط`);
  const account = readCustomer(req);
  const newPassword = !account && b.createAccount ? String(b.createAccount.password || '') : '';
  if (newPassword) {
    if (newPassword.length < 6) errors.push('كلمة مرور الحساب يجب أن تكون 6 أحرف على الأقل');
    else if (db().customers.some((x) => x.phone === customer.phone)) errors.push('يوجد حساب بهذا الرقم، سجّل الدخول من صفحة "حسابي" أو ألغِ خيار إنشاء الحساب');
  }
  if (errors.length) return res.status(400).json({ error: errors.join(' • '), errors });

  let owner = account;
  if (newPassword) {
    owner = { id: store.id('cu_'), firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, town: customer.town, address: customer.address, marketing: bool(b.marketing), active: true, ...hashPassword(newPassword), createdAt: Date.now() };
    db().customers.push(owner);
    setCustomerCookie(req, res, issueCustomerToken(owner), CUSTOMER_DAYS * 86400);
  } else if (owner && b.marketing !== undefined && bool(b.marketing)) {
    owner.marketing = true;
  }

  const number = store.nextNumber('order', 1000);
  const order = {
    id: store.id('o_'), number, customer,
    items: priced.lines.map(({ stock, ...l }) => l),
    subtotal: priced.subtotal, productDiscount: priced.productDiscount, couponCode: priced.couponCode, couponDiscount: priced.couponDiscount,
    shipping: priced.shipping, total: priced.total, payment: 'cod', status: 'new', seen: false, adminNote: '',
    source: str(b.source, 30) || 'store', createdAt: Date.now(), history: [{ status: 'new', at: Date.now() }],
    customerId: owner ? owner.id : null, marketing: bool(b.marketing),
  };
  db().orders.push(order);
  for (const l of priced.lines) {
    const p = db().products.find((x) => x.id === l.productId);
    p.stock = Math.max(0, p.stock - l.qty);
    p.sold = (p.sold || 0) + l.qty;
  }
  store.save();
  res.json({ ok: true, number, total: order.total, accountCreated: Boolean(newPassword) });
});

const round6 = (n) => Math.round(Number(n) * 1e6) / 1e6;

const STATUS = { new: 'جديد', confirmed: 'تم التأكيد', preparing: 'قيد التحضير', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };

api.get('/track', rateLimiter(30, 600e3), (req, res) => {
  const number = Math.floor(num(req.query.number));
  const phone = normPhone(req.query.phone);
  const o = db().orders.find((x) => x.number === number && x.customer.phone === phone);
  if (!o) return res.status(404).json({ error: 'لم يتم العثور على طلب بهذه البيانات' });
  res.json({ number: o.number, status: o.status, statusLabel: STATUS[o.status], createdAt: o.createdAt, total: o.total, items: o.items.map((i) => ({ name: i.name, qty: i.qty })), history: o.history });
});

api.post('/chat', rateLimiter(40, 600e3), async (req, res) => {
  if (!db().settings.ai.enabled) return res.status(503).json({ error: 'المستشار الذكي غير مفعّل حالياً' });
  if (!ai.isConfigured()) return res.status(503).json({ error: 'المستشار الذكي غير متاح حالياً، يمكنك التواصل معنا عبر واتساب.' });
  try {
    res.json(await ai.chat(db(), req.body.messages));
  } catch (e) {
    console.error('AI error:', e.status || '', e.message);
    res.status(e.status === 400 ? 400 : 502).json({ error: 'تعذّر الاتصال بالمستشار الآن، حاول بعد قليل.' });
  }
});

api.post('/blend-requests', rateLimiter(8, 3600e3), (req, res) => {
  const c = req.body.customer || {};
  const customer = { firstName: str(c.firstName, 60), lastName: str(c.lastName, 60), town: str(c.town, 80), phone: normPhone(c.phone), notes: str(c.notes, 1000) };
  if (!customer.firstName || !customer.lastName || !customer.town) return res.status(400).json({ error: 'يرجى تعبئة الاسم والعائلة والبلدة' });
  if (!PHONE_RE.test(customer.phone)) return res.status(400).json({ error: 'رقم الهاتف غير صحيح (مثال: 0501234567)' });
  const bl = req.body.blend || {};
  const blend = {
    title: str(bl.title, 200), purpose: str(bl.purpose, 500),
    ingredients: (Array.isArray(bl.ingredients) ? bl.ingredients : []).slice(0, 30).map((i) => ({ name: str(i.name, 100), amount: str(i.amount, 100) })),
    preparation: str(bl.preparation, 2000), usage: str(bl.usage, 2000), duration: str(bl.duration, 300), warnings: str(bl.warnings, 2000),
  };
  const conversation = (Array.isArray(req.body.conversation) ? req.body.conversation : []).slice(-30)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: str(m.content, 4000) }));
  const number = store.nextNumber('blend', 500);
  db().blendRequests.push({ id: store.id('b_'), number, customer, blend, conversation, status: 'new', seen: false, adminNote: '', price: 0, createdAt: Date.now() });
  store.save();
  res.json({ ok: true, number });
});

// ---------------------------------------------------------------- حساب الزبون: طلباتي والعروض
const publicCustomer = (c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, town: c.town || '', address: c.address || '', marketing: Boolean(c.marketing), createdAt: c.createdAt });
const orderSummary = (o) => ({
  number: o.number, status: o.status, statusLabel: STATUS[o.status], createdAt: o.createdAt, total: o.total, shipping: o.shipping,
  items: o.items.map((i) => ({ name: i.name, qty: i.qty, image: i.image, lineTotal: i.lineTotal })), history: o.history,
});
const activeCampaigns = () => db().campaigns.filter((k) => k.active).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)
  .map(({ id, title, text, image, link, linkText, createdAt }) => ({ id, title, text, image, link, linkText, createdAt }));

function accountPayload(c) {
  return {
    customer: publicCustomer(c),
    orders: db().orders.filter((o) => o.customerId === c.id).sort((a, b) => b.createdAt - a.createdAt).map(orderSummary),
    campaigns: activeCampaigns(),
  };
}

const accountLimiter = rateLimiter(15, 15 * 60e3);

api.post('/account/register', accountLimiter, (req, res) => {
  const b = req.body || {};
  const phone = normPhone(b.phone);
  const c = { firstName: str(b.firstName, 60), lastName: str(b.lastName, 60), town: str(b.town, 80) };
  if (!c.firstName || !c.lastName) return res.status(400).json({ error: 'يرجى كتابة الاسم والعائلة' });
  if (!PHONE_RE.test(phone)) return res.status(400).json({ error: 'رقم الهاتف غير صحيح (مثال: 0501234567)' });
  if (String(b.password || '').length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
  if (db().customers.some((x) => x.phone === phone)) return res.status(400).json({ error: 'هذا الرقم مسجّل مسبقاً، سجّل الدخول بدلاً من ذلك' });
  const cust = { id: store.id('cu_'), ...c, phone, address: '', marketing: bool(b.marketing), active: true, ...hashPassword(String(b.password)), createdAt: Date.now() };
  db().customers.push(cust);
  store.save();
  setCustomerCookie(req, res, issueCustomerToken(cust), CUSTOMER_DAYS * 86400);
  res.json(accountPayload(cust));
});

api.post('/account/login', accountLimiter, (req, res) => {
  const phone = normPhone(req.body.phone);
  const c = db().customers.find((x) => x.phone === phone && x.active !== false);
  const ok = c && crypto.timingSafeEqual(Buffer.from(hashPassword(String(req.body.password || ''), c.salt).hash, 'hex'), Buffer.from(c.hash, 'hex'));
  if (!ok) return res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
  c.lastLogin = Date.now();
  store.save();
  setCustomerCookie(req, res, issueCustomerToken(c), CUSTOMER_DAYS * 86400);
  res.json(accountPayload(c));
});

api.post('/account/logout', (req, res) => {
  setCustomerCookie(req, res, '', 0);
  res.json({ ok: true });
});

api.get('/account', (req, res) => {
  const c = readCustomer(req);
  if (!c) return res.status(401).json({ error: 'غير مسجّل' });
  res.json(accountPayload(c));
});

api.put('/account', (req, res) => {
  const c = readCustomer(req);
  if (!c) return res.status(401).json({ error: 'غير مسجّل' });
  const b = req.body || {};
  if (b.firstName !== undefined) c.firstName = str(b.firstName, 60) || c.firstName;
  if (b.lastName !== undefined) c.lastName = str(b.lastName, 60) || c.lastName;
  if (b.town !== undefined) c.town = str(b.town, 80);
  if (b.address !== undefined) c.address = str(b.address, 300);
  if (b.marketing !== undefined) c.marketing = bool(b.marketing);
  if (b.password) {
    if (hashPassword(String(b.current || ''), c.salt).hash !== c.hash) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    if (String(b.password).length < 6) return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
    Object.assign(c, hashPassword(String(b.password)));
    setCustomerCookie(req, res, issueCustomerToken(c), CUSTOMER_DAYS * 86400);
  }
  store.save();
  res.json(accountPayload(c));
});

// ربط طلب قديم بالحساب: يجب معرفة رقم الطلب ورقم الهاتف معاً
api.post('/account/link-order', accountLimiter, (req, res) => {
  const c = readCustomer(req);
  if (!c) return res.status(401).json({ error: 'غير مسجّل' });
  const o = db().orders.find((x) => x.number === Math.floor(num(req.body.number)) && x.customer.phone === normPhone(req.body.phone));
  if (!o) return res.status(404).json({ error: 'لم يتم العثور على طلب بهذا الرقم وهذا الهاتف' });
  if (o.customerId && o.customerId !== c.id) return res.status(400).json({ error: 'هذا الطلب مرتبط بحساب آخر' });
  o.customerId = c.id;
  store.save();
  res.json(accountPayload(c));
});

// طلبات محفوظة على جهاز الزبون (بدون حساب): نرجع فقط الطلبات التي يطابق فيها الرقم والهاتف
api.post('/my-orders', rateLimiter(60, 600e3), (req, res) => {
  const refs = (Array.isArray(req.body.refs) ? req.body.refs : []).slice(0, 30);
  const out = [];
  for (const r of refs) {
    const o = db().orders.find((x) => x.number === Math.floor(num(r.number)) && x.customer.phone === normPhone(r.phone));
    if (o) out.push(orderSummary(o));
  }
  res.json({ orders: out.sort((a, b) => b.createdAt - a.createdAt), campaigns: activeCampaigns().slice(0, 3) });
});

app.use('/api/public', api);

// ---------------------------------------------------------------- واجهة الإدارة
const adm = express.Router();
const loginLimiter = rateLimiter(10, 15 * 60e3);

adm.post('/login', loginLimiter, (req, res) => {
  const username = str(req.body.username, 60).toLowerCase();
  const password = String(req.body.password || '');
  const user = db().users.find((u) => u.username.toLowerCase() === username && u.active);
  const ok = user && crypto.timingSafeEqual(Buffer.from(hashPassword(password, user.salt).hash, 'hex'), Buffer.from(user.hash, 'hex'));
  if (!ok) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  user.lastLogin = Date.now();
  store.save();
  setCookie(req, res, issueToken(user), SESSION_HOURS * 3600);
  res.json({ user: safeUser(user) });
});

adm.post('/logout', (req, res) => {
  setCookie(req, res, '', 0);
  res.json({ ok: true });
});

adm.get('/me', auth(), (req, res) => res.json({ user: safeUser(req.user), aiConfigured: ai.isConfigured(), aiModel: ai.MODEL }));

adm.post('/me/password', auth(), (req, res) => {
  const u = req.user;
  const cur = String(req.body.current || '');
  if (hashPassword(cur, u.salt).hash !== u.hash) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  const next = String(req.body.password || '');
  if (next.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
  Object.assign(u, hashPassword(next));
  store.save();
  setCookie(req, res, issueToken(u), SESSION_HOURS * 3600);
  res.json({ ok: true });
});

adm.get('/summary', auth(), (req, res) => {
  const d = db();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const valid = d.orders.filter((o) => o.status !== 'cancelled');
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(today); start.setDate(start.getDate() - i);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const os = valid.filter((o) => o.createdAt >= start && o.createdAt < end);
    days.push({ date: start.toISOString().slice(0, 10), orders: os.length, revenue: round2(os.reduce((a, o) => a + o.total, 0)) });
  }
  const sales = {};
  for (const o of valid) for (const it of o.items) sales[it.name] = (sales[it.name] || 0) + it.qty;
  res.json({
    counts: {
      newOrders: d.orders.filter((o) => o.status === 'new').length,
      unseenOrders: d.orders.filter((o) => !o.seen).length,
      unseenBlends: d.blendRequests.filter((b) => !b.seen).length,
      newBlends: d.blendRequests.filter((b) => b.status === 'new').length,
      pendingReviews: d.reviews.filter((r) => !r.approved).length,
      lowStock: d.products.filter((p) => p.active && p.stock <= num(d.settings.shop.lowStockAlert, 5)).length,
      products: d.products.length,
      ordersTotal: d.orders.length,
    },
    todayOrders: valid.filter((o) => o.createdAt >= today.getTime()).length,
    todayRevenue: round2(valid.filter((o) => o.createdAt >= today.getTime()).reduce((a, o) => a + o.total, 0)),
    totalRevenue: round2(valid.filter((o) => o.status === 'delivered').reduce((a, o) => a + o.total, 0)),
    pipelineRevenue: round2(valid.filter((o) => o.status !== 'delivered').reduce((a, o) => a + o.total, 0)),
    days,
    topProducts: Object.entries(sales).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty })),
    recentOrders: d.orders.slice(-6).reverse(),
    lowStockProducts: d.products.filter((p) => p.active && p.stock <= num(d.settings.shop.lowStockAlert, 5)).map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
  });
});

// الطلبات
adm.get('/orders', auth('orders'), (req, res) => res.json(db().orders.slice().reverse()));
adm.put('/orders/:id', auth('orders'), (req, res) => {
  const o = db().orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'غير موجود' });
  if (req.body.status && STATUS[req.body.status] && req.body.status !== o.status) {
    // إرجاع المخزون عند الإلغاء، وخصمه مجدداً عند التراجع عن الإلغاء
    const delta = req.body.status === 'cancelled' ? 1 : o.status === 'cancelled' ? -1 : 0;
    if (delta) for (const it of o.items) {
      const p = db().products.find((x) => x.id === it.productId);
      if (p) { p.stock = Math.max(0, p.stock + delta * it.qty); p.sold = Math.max(0, (p.sold || 0) - delta * it.qty); }
    }
    o.status = req.body.status;
    o.history = o.history || [];
    o.history.push({ status: o.status, at: Date.now(), by: req.user.username });
  }
  if ('adminNote' in req.body) o.adminNote = str(req.body.adminNote, 2000);
  if ('seen' in req.body) o.seen = bool(req.body.seen);
  store.save();
  res.json(o);
});
adm.post('/orders/mark-seen', auth('orders'), (req, res) => {
  db().orders.forEach((o) => (o.seen = true));
  store.save();
  res.json({ ok: true });
});
adm.delete('/orders/:id', auth('orders'), (req, res) => {
  db().orders = db().orders.filter((x) => x.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

// طلبات الخلطات من المستشار الذكي
adm.get('/blends', auth('orders'), (req, res) => res.json(db().blendRequests.slice().reverse()));
adm.put('/blends/:id', auth('orders'), (req, res) => {
  const b = db().blendRequests.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'غير موجود' });
  if (req.body.status) b.status = str(req.body.status, 20);
  if ('adminNote' in req.body) b.adminNote = str(req.body.adminNote, 2000);
  if ('price' in req.body) b.price = num(req.body.price);
  if ('seen' in req.body) b.seen = bool(req.body.seen);
  store.save();
  res.json(b);
});
adm.delete('/blends/:id', auth('orders'), (req, res) => {
  db().blendRequests = db().blendRequests.filter((x) => x.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

// منشئ CRUD عام للمجموعات
function crud(name, perm, clean) {
  adm.get(`/${name}`, auth(perm), (req, res) => res.json(db()[name]));
  adm.post(`/${name}`, auth(perm), (req, res) => {
    try {
      const item = clean(req.body, null);
      db()[name].push(item);
      store.save();
      res.json(item);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  adm.put(`/${name}/:id`, auth(perm), (req, res) => {
    const list = db()[name];
    const i = list.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'غير موجود' });
    try {
      list[i] = clean(req.body, list[i]);
      store.save();
      res.json(list[i]);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  adm.delete(`/${name}/:id`, auth(perm), (req, res) => {
    db()[name] = db()[name].filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });
}

const lines = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => str(x, 300)).filter(Boolean);

function uniqueSlug(list, base, selfId) {
  let s = base;
  let n = 2;
  while (list.some((x) => x.slug === s && x.id !== selfId)) s = `${base}-${n++}`;
  return s;
}

crud('products', 'catalog', (b, old) => {
  const name = str(b.name, 150);
  if (!name) throw new Error('اسم المنتج مطلوب');
  const idv = old ? old.id : store.id('p_');
  return {
    ...(old || { createdAt: Date.now(), sold: 0 }),
    id: idv,
    name,
    slug: uniqueSlug(db().products, slugify(b.slug || name), idv),
    categoryId: str(b.categoryId, 60),
    price: Math.max(0, num(b.price)),
    discount: Math.max(0, Math.min(100, num(b.discount))),
    stock: Math.max(0, Math.floor(num(b.stock))),
    size: str(b.size, 60),
    images: (Array.isArray(b.images) ? b.images : []).map((x) => str(x, 500)).filter(Boolean).slice(0, 10),
    shortDesc: str(b.shortDesc, 300),
    description: str(b.description, 5000),
    benefits: lines(b.benefits),
    usage: str(b.usage, 2000),
    ingredients: str(b.ingredients, 2000),
    warnings: str(b.warnings, 2000),
    featured: bool(b.featured),
    bestseller: bool(b.bestseller),
    isNew: bool(b.isNew),
    active: bool(b.active),
  };
});

crud('categories', 'catalog', (b, old) => {
  const name = str(b.name, 100);
  if (!name) throw new Error('اسم القسم مطلوب');
  const idv = old ? old.id : store.id('c_');
  return { id: idv, name, slug: uniqueSlug(db().categories, slugify(b.slug || name), idv), icon: str(b.icon, 20), description: str(b.description, 300), image: str(b.image, 500), order: num(b.order, 99), active: bool(b.active) };
});

crud('slides', 'content', (b, old) => ({
  id: old ? old.id : store.id('s_'),
  badge: str(b.badge, 80), title: str(b.title, 200), subtitle: str(b.subtitle, 500),
  buttonText: str(b.buttonText, 60), buttonLink: str(b.buttonLink, 300), button2Text: str(b.button2Text, 60), button2Link: str(b.button2Link, 300),
  image: str(b.image, 500), sideImage: str(b.sideImage, 500), order: num(b.order, 99), active: bool(b.active),
}));

crud('coupons', 'settings', (b, old) => {
  const code = str(b.code, 40).toUpperCase();
  if (!code) throw new Error('الكود مطلوب');
  if (db().coupons.some((c) => c.code === code && (!old || c.id !== old.id))) throw new Error('هذا الكود موجود مسبقاً');
  return { id: old ? old.id : store.id('k_'), code, type: b.type === 'fixed' ? 'fixed' : 'percent', value: Math.max(0, num(b.value)), minTotal: Math.max(0, num(b.minTotal)), expires: str(b.expires, 10), active: bool(b.active) };
});

adm.get('/reviews', auth('catalog'), (req, res) => {
  const names = Object.fromEntries(db().products.map((p) => [p.id, p.name]));
  res.json(db().reviews.slice().sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r, productName: names[r.productId] || '—' })));
});
adm.put('/reviews/:id', auth('catalog'), (req, res) => {
  const r = db().reviews.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'غير موجود' });
  if ('approved' in req.body) r.approved = bool(req.body.approved);
  if ('text' in req.body) r.text = str(req.body.text, 1000);
  store.save();
  res.json(r);
});
adm.delete('/reviews/:id', auth('catalog'), (req, res) => {
  db().reviews = db().reviews.filter((x) => x.id !== req.params.id);
  store.save();
  res.json({ ok: true });
});

// الإعدادات: المحتوى (texts/home/popup/announcement) لمن يملك content، والباقي لمن يملك settings
const CONTENT_KEYS = ['texts', 'home', 'popup', 'announcement'];
adm.get('/settings', auth(), (req, res) => res.json(db().settings));
adm.put('/settings', auth(), (req, res) => {
  const patch = req.body || {};
  const keys = Object.keys(patch);
  const needsSettings = keys.some((k) => !CONTENT_KEYS.includes(k));
  if (needsSettings && !can(req.user, 'settings')) return res.status(403).json({ error: 'لا تملك صلاحية تعديل الإعدادات' });
  if (!needsSettings && !can(req.user, 'content') && !can(req.user, 'settings')) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const defaults = defaultSettings();
  for (const k of keys) {
    if (!(k in defaults)) continue;
    if (k === 'typography') {
      db().settings.typography = cleanTypography(patch[k]);
      continue;
    }
    const v = patch[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) db().settings[k] = { ...db().settings[k], ...v };
    else db().settings[k] = v;
  }
  store.save();
  res.json(db().settings);
});

// الخطوط لكل جزء: يُستبدل الكائن كاملاً حتى تُحذف الأجزاء التي أُعيدت للافتراضي
function cleanTypography(v) {
  const out = {};
  for (const [key, t] of Object.entries(v && typeof v === 'object' ? v : {})) {
    if (!/^\w{1,30}$/.test(key) || !t || typeof t !== 'object') continue;
    const o = {};
    const font = String(t.font || '').replace(/[^\w\s-]/g, '').trim().slice(0, 60);
    if (font) o.font = font;
    if (num(t.size) > 0) o.size = Math.min(120, Math.round(num(t.size)));
    if (t.weight === 'bold' || t.weight === 'normal') o.weight = t.weight;
    if (/^#[0-9a-f]{3,8}$/i.test(t.color || '')) o.color = t.color;
    if (Object.keys(o).length) out[key] = o;
  }
  return out;
}

// الزبائن: أصحاب الحسابات + كل من طلب (مجمّعين حسب رقم الهاتف)
adm.get('/customers', auth('orders'), (req, res) => {
  const map = new Map();
  for (const c of db().customers) {
    map.set(c.phone, { phone: c.phone, name: `${c.firstName} ${c.lastName}`, town: c.town || '', account: true, marketing: Boolean(c.marketing), orders: 0, spent: 0, lastOrderAt: 0, createdAt: c.createdAt, customerId: c.id });
  }
  for (const o of db().orders) {
    const p = o.customer.phone;
    const e = map.get(p) || { phone: p, name: `${o.customer.firstName} ${o.customer.lastName}`, town: o.customer.town, account: false, marketing: false, orders: 0, spent: 0, lastOrderAt: 0, createdAt: o.createdAt };
    e.orders++;
    if (o.status !== 'cancelled') e.spent = round2(e.spent + o.total);
    e.lastOrderAt = Math.max(e.lastOrderAt, o.createdAt);
    if (!e.account && o.marketing) e.marketing = true;
    map.set(p, e);
  }
  res.json([...map.values()].sort((a, b) => (b.lastOrderAt || b.createdAt) - (a.lastOrderAt || a.createdAt)));
});

adm.put('/customers/:phone', auth('orders'), (req, res) => {
  const phone = normPhone(req.params.phone);
  const c = db().customers.find((x) => x.phone === phone);
  // تعيين كلمة مرور جديدة لزبون نسي كلمته (يُبطل جلساته القديمة)
  if (req.body.password !== undefined) {
    if (!c) return res.status(404).json({ error: 'هذا الزبون ليس لديه حساب' });
    if (String(req.body.password).length < 6) return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
    Object.assign(c, hashPassword(String(req.body.password)));
    store.save();
    return res.json({ ok: true });
  }
  if (c) c.marketing = bool(req.body.marketing);
  // إلغاء الاشتراك لزبون بدون حساب: نزيل الموافقة من طلباته
  if (!bool(req.body.marketing)) db().orders.forEach((o) => { if (o.customer.phone === phone) o.marketing = false; });
  store.save();
  res.json({ ok: true });
});

crud('campaigns', 'content', (b, old) => {
  const title = str(b.title, 150);
  if (!title) throw new Error('عنوان الحملة مطلوب');
  return {
    id: old ? old.id : store.id('m_'), title, text: str(b.text, 3000), image: str(b.image, 500), link: str(b.link, 400), linkText: str(b.linkText, 60),
    active: bool(b.active), createdAt: old ? old.createdAt : Date.now(), sentTo: old ? old.sentTo || [] : [],
  };
});

// تعليم زبون بأنه أُرسلت له الحملة على واتساب
adm.post('/campaigns/:id/sent', auth('content'), (req, res) => {
  const k = db().campaigns.find((x) => x.id === req.params.id);
  if (!k) return res.status(404).json({ error: 'غير موجود' });
  const phone = normPhone(req.body.phone);
  k.sentTo = k.sentTo || [];
  if (bool(req.body.sent)) { if (!k.sentTo.includes(phone)) k.sentTo.push(phone); } else k.sentTo = k.sentTo.filter((x) => x !== phone);
  store.save();
  res.json(k);
});

// المستخدمون
adm.get('/users', auth('users'), (req, res) => res.json(db().users.map(safeUser)));
adm.post('/users', auth('users'), (req, res) => {
  const username = str(req.body.username, 40).toLowerCase();
  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) return res.status(400).json({ error: 'اسم المستخدم: أحرف إنجليزية وأرقام فقط (3 أحرف على الأقل)' });
  if (db().users.some((u) => u.username === username)) return res.status(400).json({ error: 'اسم المستخدم مستعمل' });
  const password = String(req.body.password || '');
  if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
  const role = ROLES[req.body.role] ? req.body.role : 'editor';
  const u = { id: store.id('u_'), username, name: str(req.body.name, 60) || username, role, active: true, ...hashPassword(password), createdAt: Date.now() };
  db().users.push(u);
  store.save();
  res.json(safeUser(u));
});
adm.put('/users/:id', auth('users'), (req, res) => {
  const u = db().users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'غير موجود' });
  const owners = db().users.filter((x) => x.role === 'owner' && x.active);
  const demoting = u.role === 'owner' && ((req.body.role && req.body.role !== 'owner') || req.body.active === false);
  if (demoting && owners.length <= 1) return res.status(400).json({ error: 'يجب أن يبقى مالك واحد فعّال على الأقل' });
  if (req.body.name !== undefined) u.name = str(req.body.name, 60);
  if (req.body.role && ROLES[req.body.role]) u.role = req.body.role;
  if (req.body.active !== undefined) u.active = bool(req.body.active);
  if (req.body.password) {
    if (String(req.body.password).length < 6) return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
    Object.assign(u, hashPassword(String(req.body.password)));
  }
  store.save();
  res.json(safeUser(u));
});
adm.delete('/users/:id', auth('users'), (req, res) => {
  const u = db().users.find((x) => x.id === req.params.id);
  if (!u) return res.json({ ok: true });
  if (u.id === req.user.id) return res.status(400).json({ error: 'لا يمكنك حذف حسابك' });
  if (u.role === 'owner' && db().users.filter((x) => x.role === 'owner' && x.active).length <= 1) return res.status(400).json({ error: 'لا يمكن حذف آخر مالك' });
  db().users = db().users.filter((x) => x.id !== u.id);
  store.save();
  res.json({ ok: true });
});

// رفع الصور (Data URL)
const MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' };
adm.post('/upload', auth(), (req, res) => {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(String(req.body.data || ''));
  if (!m || !MIME[m[1]]) return res.status(400).json({ error: 'صيغة الصورة غير مدعومة (PNG, JPG, WEBP, GIF)' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 12 * 1024 * 1024) return res.status(400).json({ error: 'حجم الصورة كبير جداً (الحد 12MB)' });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${MIME[m[1]]}`;
  fs.writeFileSync(path.join(store.UPLOAD_DIR, name), buf);
  res.json({ url: `/uploads/${name}` });
});

// النسخ الاحتياطي
adm.get('/backup', auth('users'), (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="aljalil-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(db());
});
adm.post('/restore', auth('users'), (req, res) => {
  const data = req.body;
  if (!data || !data.settings || !Array.isArray(data.products) || !Array.isArray(data.users) || !data.users.length) {
    return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح' });
  }
  store.db = data;
  migrateSettings();
  store.flush();
  res.json({ ok: true });
});

app.use('/api/admin', adm);
app.use('/api', (req, res) => res.status(404).json({ error: 'غير موجود' }));

// ---------------------------------------------------------------- الملفات الثابتة
app.use('/uploads', express.static(store.UPLOAD_DIR, { maxAge: '30d', immutable: true }));
app.get('/manifest.webmanifest', (req, res) => {
  const s = db().settings;
  res.type('application/manifest+json').json({
    name: s.storeName, short_name: s.storeName, description: s.seo.description, lang: 'ar', dir: 'rtl',
    start_url: '/', display: 'standalone', background_color: s.colors.background, theme_color: s.colors.primary,
    icons: [{ src: s.logo && !s.logo.endsWith('.svg') ? s.logo : '/icon.svg', sizes: 'any', type: s.logo && !s.logo.endsWith('.svg') ? undefined : 'image/svg+xml', purpose: 'any' }],
  });
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', index: false }));

function renderIndex(file) {
  const html = fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
  return (req, res) => {
    const s = db().settings;
    const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    res.type('html').send(html.replaceAll('{{TITLE}}', esc(s.seo.title)).replaceAll('{{DESC}}', esc(s.seo.description)).replaceAll('{{THEME}}', esc(s.colors.primary)));
  };
}
app.get('/admin', renderIndex('admin/index.html'));
app.get('/admin/', renderIndex('admin/index.html'));
app.get('*', renderIndex('index.html'));

process.on('SIGTERM', () => { store.flush(); process.exit(0); });
process.on('SIGINT', () => { store.flush(); process.exit(0); });

app.listen(PORT, () => console.log(`🌿 متجر الجليل يعمل على http://localhost:${PORT}  | لوحة الإدارة: /admin`));
