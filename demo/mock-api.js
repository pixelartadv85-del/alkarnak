// خادم وهمي داخل المتصفح للنسخة التجريبية: يحاكي /api/public و /api/admin ويحفظ البيانات في localStorage.
// يُحقن قبل store.js / admin.js بواسطة scripts/build-demo.js، ويحتاج window.__DEMO_SEED__.
(() => {
  'use strict';
  const KEY = 'jalil-demo-db-v2';
  const SESSION = 'jalil-demo-session';
  const CSESSION = 'jalil-demo-customer';
  const round2 = (n) => Math.round(n * 100) / 100;
  const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';
  const uid = (p) => p + Math.random().toString(16).slice(2, 14);
  const PHONE_RE = /^(\+?(972|970)|0)5\d{8}$/;
  const normPhone = (p) => String(p || '').replace(/[\s\-()]/g, '');
  const STATUS = { new: 'جديد', confirmed: 'تم التأكيد', preparing: 'قيد التحضير', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
  const ROLES = { owner: ['orders', 'catalog', 'content', 'settings', 'users'], admin: ['orders', 'catalog', 'content', 'settings'], editor: ['catalog', 'content'], orders: ['orders'] };

  let mem = null;
  function db() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { mem = null; }
    if (!mem) mem = JSON.parse(JSON.stringify(window.__DEMO_SEED__));
    mem.customers = mem.customers || [];
    mem.campaigns = mem.campaigns || [];
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* التخزين ممتلئ أو غير متاح */ } }
  window.addEventListener('storage', (e) => { if (e.key === KEY) mem = null; });

  const finalPrice = (p) => round2(p.price * (1 - Math.min(100, Math.max(0, p.discount || 0)) / 100));
  function rating(pid) {
    const rs = db().reviews.filter((r) => r.productId === pid && r.approved);
    return { rating: rs.length ? round2(rs.reduce((a, r) => a + r.rating, 0) / rs.length) : 0, reviewsCount: rs.length };
  }
  const publicProduct = (p) => ({ ...p, finalPrice: finalPrice(p), inStock: p.stock > 0, ...rating(p.id) });

  function findCoupon(code) {
    const c = db().coupons.find((k) => k.active && k.code.toLowerCase() === String(code).trim().toLowerCase());
    if (!c || (c.expires && new Date(c.expires + 'T23:59:59') < new Date())) return null;
    return c;
  }
  function priceCart(items, couponCode) {
    const s = db().settings.shop;
    const lines = [];
    for (const it of items || []) {
      const p = db().products.find((x) => x.id === it.id && x.active);
      if (!p) continue;
      const qty = Math.max(1, Math.min(99, Math.floor(num(it.qty, 1))));
      const unit = finalPrice(p);
      lines.push({ productId: p.id, name: p.name, size: p.size || '', image: p.images[0] || '', price: p.price, discount: p.discount || 0, unitFinal: unit, qty, lineTotal: round2(unit * qty), stock: p.stock });
    }
    const subtotal = round2(lines.reduce((a, l) => a + l.price * l.qty, 0));
    const productDiscount = round2(lines.reduce((a, l) => a + (l.price - l.unitFinal) * l.qty, 0));
    const after = round2(subtotal - productDiscount);
    let coupon = null, couponDiscount = 0, couponError = '';
    if (couponCode) {
      const c = findCoupon(couponCode);
      if (!c) couponError = 'كود الخصم غير صالح أو منتهي';
      else if (after < (c.minTotal || 0)) couponError = `هذا الكود يتطلب طلباً بقيمة ${c.minTotal} ₪ على الأقل`;
      else { coupon = c; couponDiscount = c.type === 'percent' ? round2((after * c.value) / 100) : Math.min(after, c.value); }
    }
    const net = round2(after - couponDiscount);
    const freeOver = num(s.freeShippingOver);
    const shipping = !lines.length ? 0 : freeOver > 0 && net >= freeOver ? 0 : num(s.shippingFee);
    return { lines, subtotal, productDiscount, couponCode: coupon ? coupon.code : '', couponDiscount, couponError, shipping, total: round2(net + shipping) };
  }
  const nextNumber = (k, start) => { const d = db(); d.counters = d.counters || {}; d.counters[k] = (d.counters[k] || start) + 1; return d.counters[k]; };

  // ردود تجريبية للمستشار (النسخة الحقيقية تستعمل الذكاء الاصطناعي)
  const BLENDS = [
    [/تنحيف|رشاقة|وزن|سمنة|كرش|حرق/, { title: 'خلطة الرشاقة الآمنة', purpose: 'دعم الحرق وتقليل الانتفاخ والشهية', ingredients: [['شاي أخضر', '40 غ'], ['زنجبيل مجفف', '20 غ'], ['قرفة سيلانية', '15 غ'], ['شمرة', '15 غ']], preparation: 'ملعقة صغيرة في كوب ماء مغلي، تُنقع 7 دقائق ثم تُصفّى', usage: 'كوب قبل الفطور وكوب بعد الغداء، مع أكل متوازن ومشي 30 دقيقة يومياً', duration: '4 أسابيع ثم استراحة أسبوع', warnings: 'لا تُستعمل أثناء الحمل والرضاعة أو مع أدوية الضغط والقلب دون استشارة الطبيب.', products: ['p_slim-blend', 'p_digest-blend'] }],
    [/نوم|أرق|ارق|توتر|قلق|أعصاب/, { title: 'خلطة النوم الهادئ', purpose: 'استرخاء طبيعي ونوم أعمق', ingredients: [['بابونج', '30 غ'], ['مليسة (ليمون بلسم)', '20 غ'], ['لافندر', '10 غ'], ['زيزفون', '20 غ']], preparation: 'ملعقة صغيرة في كوب ماء مغلي، تُغطى 10 دقائق', usage: 'كوب قبل النوم بنصف ساعة', duration: '3 أسابيع', warnings: 'قد تسبب النعاس، لا تُستعمل قبل القيادة أو مع أدوية مهدئة.', products: ['p_sleep-blend', 'p_chamomile'] }],
    [/شعر|تساقط|صلع|قشرة/, { title: 'زيت تقوية الشعر', purpose: 'تقليل التساقط وتحفيز النمو', ingredients: [['زيت خروع', '30 مل'], ['زيت حبة البركة', '30 مل'], ['زيت روزماري مخفف', '10 مل'], ['زيت جوز الهند', '30 مل']], preparation: 'تُخلط الزيوت في عبوة زجاجية داكنة وتُرج جيداً', usage: 'تدليك فروة الرأس 3 مرات أسبوعياً وتُترك ساعتين على الأقل', duration: '8 أسابيع', warnings: 'للاستعمال الخارجي فقط. اختبار على جزء صغير قبل الاستعمال.', products: ['p_seven-herbs-oil', 'p_rosemary-oil'] }],
    [/مناعة|زكام|رشح|كحة|سعال|برد/, { title: 'خلطة المناعة الدافئة', purpose: 'تقوية المناعة وتلطيف الحلق', ingredients: [['زنجبيل', '25 غ'], ['كركم', '15 غ'], ['زعتر', '20 غ'], ['قرفة', '15 غ']], preparation: 'ملعقة صغيرة تُغلى دقيقتين في كوب ماء، ثم يُضاف العسل بعد أن تبرد قليلاً', usage: 'كوب مرتين يومياً', duration: 'أسبوعان', warnings: 'يُستشار الطبيب لمن يتناول مميعات الدم. العسل لا يُعطى لأقل من سنة.', products: ['p_immunity-blend', 'p_thyme-honey'] }],
    [/قولون|معدة|هضم|انتفاخ|غازات/, { title: 'خلطة الهضم المريح', purpose: 'تهدئة القولون وتقليل الانتفاخ', ingredients: [['نعناع', '20 غ'], ['شمرة', '20 غ'], ['كمون', '15 غ'], ['يانسون', '15 غ']], preparation: 'ملعقة صغيرة في كوب ماء مغلي، 7 دقائق', usage: 'كوب بعد الوجبات الرئيسية', duration: '3 أسابيع', warnings: 'النعناع قد يزيد حرقة المعدة عند البعض.', products: ['p_digest-blend', 'p_chamomile'] }],
  ];
  function demoChat(messages) {
    const users = messages.filter((m) => m.role === 'user');
    const all = users.map((m) => m.content).join(' ');
    const match = BLENDS.find(([re]) => re.test(all));
    if (users.length === 1) {
      return { reply: `أهلاً وسهلاً 🌿\n\nحتى أقترح عليك خلطة آمنة تناسبك، احكِ لي باختصار:\n- **كم عمرك؟**\n- هل يوجد **حمل أو رضاعة**؟\n- هل عندك **أمراض مزمنة** (ضغط، سكري، قلب، غدة) أو تتناول **أدوية**؟\n\n_(هذه نسخة تجريبية للعرض، والردود محاكاة. في الموقع الحقيقي يرد الذكاء الاصطناعي على أي سؤال.)_`, offer: null, product_ids: [], quick_replies: ['عمري 30 وما عندي أمراض', 'عندي ضغط وباخد دواء'] };
    }
    if (/ضغط|سكري|قلب|حامل|حمل|رضاعة|مرضع|دواء|أدوية/.test(users[users.length - 1].content) && !/ما عندي|لا يوجد|بدون/.test(users[users.length - 1].content)) {
      return { reply: 'شكراً على التوضيح 🙏\n\nبوجود حمل/رضاعة أو أمراض مزمنة أو أدوية، **الأفضل استشارة طبيبك قبل أي خلطة تؤخذ عن طريق الفم**، لأن بعض الأعشاب تتداخل مع الأدوية.\n\nأقدر أقترح لك بدائل خارجية آمنة (زيوت، كريمات)، أو تتواصل معنا على واتساب ليساعدك المختص مباشرة.', offer: null, product_ids: [], quick_replies: ['بدائل خارجية آمنة'] };
    }
    const [, b] = match || BLENDS[0];
    return {
      reply: `ممتاز، بناءً على ما ذكرته هذه خلطة طبيعية آمنة تناسبك:\n\n**${b.title}**\n${b.ingredients.map(([n, a]) => `- ${n}: ${a}`).join('\n')}\n\n**طريقة الاستعمال:** ${b.usage}\n\n⚕️ الوصفة للتثقيف ولا تغني عن استشارة الطبيب.\n\n**هل تحب أن نحضّر لك هذه الخلطة جاهزة ونوصلها لبيتك؟**`,
      offer: { has_offer: true, title: b.title, purpose: b.purpose, ingredients: b.ingredients.map(([name, amount]) => ({ name, amount })), preparation: b.preparation, usage: b.usage, duration: b.duration, warnings: b.warnings },
      product_ids: b.products, quick_replies: ['نعم أريدها', 'ما النظام الغذائي المناسب؟'],
    };
  }

  const getCustomer = () => { try { const id = localStorage.getItem(CSESSION); return db().customers.find((c) => c.id === id) || null; } catch { return null; } };
  const setCustomer = (c) => { try { if (c) localStorage.setItem(CSESSION, c.id); else localStorage.removeItem(CSESSION); } catch { /* تجاهل */ } };
  const orderSummary = (o) => ({ number: o.number, status: o.status, statusLabel: STATUS[o.status], createdAt: o.createdAt, total: o.total, shipping: o.shipping, items: o.items.map((i) => ({ name: i.name, qty: i.qty, image: i.image, lineTotal: i.lineTotal })), history: o.history });
  const activeCampaigns = () => db().campaigns.filter((k) => k.active).sort((a, b) => b.createdAt - a.createdAt);
  const accountPayload = (c) => ({ customer: { id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, town: c.town || '', address: c.address || '', marketing: !!c.marketing }, orders: db().orders.filter((o) => o.customerId === c.id).sort((a, b) => b.createdAt - a.createdAt).map(orderSummary), campaigns: activeCampaigns() });
  const me = () => { try { const id = sessionStorage.getItem(SESSION); return db().users.find((u) => u.id === id && u.active) || null; } catch { return null; } };
  const safeUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, active: u.active, permissions: ROLES[u.role] || [] });

  class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const need = (perm) => { const u = me(); if (!u) throw new HttpError(401, 'يجب تسجيل الدخول'); if (perm && !ROLES[u.role].includes(perm)) throw new HttpError(403, 'لا تملك صلاحية'); return u; };

  const lines = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => str(x, 300)).filter(Boolean);
  const slug = (s) => String(s).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || uid('');
  const CLEAN = {
    campaigns: (b, old) => {
      if (!str(b.title)) throw new HttpError(400, 'عنوان الحملة مطلوب');
      return { id: old ? old.id : uid('m_'), title: str(b.title, 150), text: str(b.text, 3000), image: str(b.image, 2e6), link: str(b.link, 400), linkText: str(b.linkText, 60), active: bool(b.active), createdAt: old ? old.createdAt : Date.now(), sentTo: old ? old.sentTo || [] : [] };
    },
    products: (b, old) => {
      if (!str(b.name)) throw new HttpError(400, 'اسم المنتج مطلوب');
      return { ...(old || { createdAt: Date.now(), sold: 0, id: uid('p_') }), name: str(b.name, 150), slug: old ? old.slug : slug(b.name), categoryId: str(b.categoryId), price: Math.max(0, num(b.price)), discount: Math.max(0, Math.min(100, num(b.discount))), stock: Math.max(0, Math.floor(num(b.stock))), size: str(b.size), images: (b.images || []).filter(Boolean).slice(0, 10), shortDesc: str(b.shortDesc), description: str(b.description, 5000), benefits: lines(b.benefits), usage: str(b.usage, 2000), ingredients: str(b.ingredients, 2000), warnings: str(b.warnings, 2000), featured: bool(b.featured), bestseller: bool(b.bestseller), isNew: bool(b.isNew), active: bool(b.active) };
    },
    categories: (b, old) => {
      if (!str(b.name)) throw new HttpError(400, 'اسم القسم مطلوب');
      return { id: old ? old.id : uid('c_'), slug: old ? old.slug : slug(b.name), name: str(b.name), icon: str(b.icon, 20), description: str(b.description), image: str(b.image, 2e6), order: num(b.order, 99), active: bool(b.active) };
    },
    slides: (b, old) => ({ id: old ? old.id : uid('s_'), badge: str(b.badge), title: str(b.title), subtitle: str(b.subtitle), buttonText: str(b.buttonText), buttonLink: str(b.buttonLink), button2Text: str(b.button2Text), button2Link: str(b.button2Link), image: str(b.image, 2e6), sideImage: str(b.sideImage, 2e6), order: num(b.order, 99), active: bool(b.active) }),
    coupons: (b, old) => {
      const code = str(b.code, 40).toUpperCase();
      if (!code) throw new HttpError(400, 'الكود مطلوب');
      return { id: old ? old.id : uid('k_'), code, type: b.type === 'fixed' ? 'fixed' : 'percent', value: Math.max(0, num(b.value)), minTotal: Math.max(0, num(b.minTotal)), expires: str(b.expires, 10), active: bool(b.active) };
    },
  };

  function route(method, path, q, body) {
    const d = db();
    let m;
    // ---------------- عام
    if (path === '/public/bootstrap') return {
      settings: d.settings, categories: d.categories.filter((c) => c.active).sort((a, b) => a.order - b.order),
      products: d.products.filter((p) => p.active).map(publicProduct), slides: d.slides.filter((s) => s.active).sort((a, b) => a.order - b.order),
      testimonials: d.reviews.filter((r) => r.approved && r.rating >= 4).sort((a, b) => b.createdAt - a.createdAt).slice(0, 9).map((r) => ({ ...r, productName: (d.products.find((p) => p.id === r.productId) || {}).name || '' })),
      aiAvailable: d.settings.ai.enabled,
    };
    if ((m = path.match(/^\/public\/products\/([^/]+)\/reviews$/))) {
      if (method === 'GET') return d.reviews.filter((r) => r.productId === m[1] && r.approved).sort((a, b) => b.createdAt - a.createdAt);
      if (!str(body.name) || str(body.text).length < 3) throw new HttpError(400, 'يرجى كتابة الاسم والتقييم');
      const approved = !!d.settings.shop.autoApproveReviews;
      d.reviews.push({ id: uid('r_'), productId: m[1], name: str(body.name, 60), town: str(body.town, 60), rating: Math.max(1, Math.min(5, Math.round(num(body.rating, 5)))), text: str(body.text, 1000), approved, createdAt: Date.now() });
      save(); return { ok: true, approved };
    }
    if (path === '/public/cart/price') return priceCart(body.items, body.coupon);
    if (path === '/public/orders') {
      const c = body.customer || {};
      const customer = { firstName: str(c.firstName, 60), lastName: str(c.lastName, 60), town: str(c.town, 80), address: str(c.address, 300), phone: normPhone(c.phone), phone2: normPhone(c.phone2), notes: str(c.notes, 1000), location: c.location || null, locationLink: str(c.locationLink, 400) };
      const errs = [];
      if (!customer.firstName) errs.push('الاسم الشخصي مطلوب');
      if (!customer.lastName) errs.push('اسم العائلة مطلوب');
      if (!customer.town) errs.push('البلدة مطلوبة');
      if (!customer.address) errs.push('العنوان مطلوب');
      if (!PHONE_RE.test(customer.phone)) errs.push('رقم الهاتف غير صحيح');
      const pr = priceCart(body.items, body.coupon);
      if (!pr.lines.length) errs.push('السلة فارغة');
      for (const l of pr.lines) if (l.qty > l.stock) errs.push(`الكمية المتوفرة من "${l.name}" هي ${l.stock} فقط`);
      let owner = getCustomer();
      const pw = !owner && body.createAccount ? String(body.createAccount.password || '') : '';
      if (pw && d.customers.some((x) => x.phone === customer.phone)) errs.push('يوجد حساب بهذا الرقم، سجّل الدخول من صفحة "حسابي"');
      if (errs.length) throw new HttpError(400, errs.join(' • '));
      if (pw) { owner = { id: uid('cu_'), firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, town: customer.town, address: customer.address, marketing: bool(body.marketing), password: pw, createdAt: Date.now() }; d.customers.push(owner); setCustomer(owner); }
      else if (owner && bool(body.marketing)) owner.marketing = true;
      const number = nextNumber('order', 1000);
      d.orders.push({ id: uid('o_'), number, customer, items: pr.lines.map(({ stock, ...l }) => l), subtotal: pr.subtotal, productDiscount: pr.productDiscount, couponCode: pr.couponCode, couponDiscount: pr.couponDiscount, shipping: pr.shipping, total: pr.total, payment: 'cod', status: 'new', seen: false, adminNote: '', createdAt: Date.now(), history: [{ status: 'new', at: Date.now() }], customerId: owner ? owner.id : null, marketing: bool(body.marketing) });
      for (const l of pr.lines) { const p = d.products.find((x) => x.id === l.productId); p.stock = Math.max(0, p.stock - l.qty); p.sold = (p.sold || 0) + l.qty; }
      save(); return { ok: true, number, total: pr.total, accountCreated: !!pw };
    }
    if (path === '/public/track') {
      const o = d.orders.find((x) => x.number === Math.floor(num(q.get('number'))) && x.customer.phone === normPhone(q.get('phone')));
      if (!o) throw new HttpError(404, 'لم يتم العثور على طلب بهذه البيانات');
      return { number: o.number, status: o.status, statusLabel: STATUS[o.status], createdAt: o.createdAt, total: o.total, items: o.items.map((i) => ({ name: i.name, qty: i.qty })), history: o.history };
    }
    if (path === '/public/chat') return demoChat(body.messages || []);
    if (path === '/public/account/register') {
      const phone = normPhone(body.phone);
      if (!str(body.firstName) || !str(body.lastName)) throw new HttpError(400, 'يرجى كتابة الاسم والعائلة');
      if (!PHONE_RE.test(phone)) throw new HttpError(400, 'رقم الهاتف غير صحيح');
      if (String(body.password || '').length < 6) throw new HttpError(400, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      if (d.customers.some((x) => x.phone === phone)) throw new HttpError(400, 'هذا الرقم مسجّل مسبقاً، سجّل الدخول بدلاً من ذلك');
      const c = { id: uid('cu_'), firstName: str(body.firstName, 60), lastName: str(body.lastName, 60), town: str(body.town, 80), address: '', phone, marketing: bool(body.marketing), password: String(body.password), createdAt: Date.now() };
      d.customers.push(c); setCustomer(c); save(); return accountPayload(c);
    }
    if (path === '/public/account/login') {
      const c = d.customers.find((x) => x.phone === normPhone(body.phone) && x.password === String(body.password || ''));
      if (!c) throw new HttpError(401, 'رقم الهاتف أو كلمة المرور غير صحيحة');
      setCustomer(c); return accountPayload(c);
    }
    if (path === '/public/account/logout') { setCustomer(null); return { ok: true }; }
    if (path === '/public/account') {
      const c = getCustomer();
      if (!c) throw new HttpError(401, 'غير مسجّل');
      if (method === 'PUT') {
        for (const k of ['firstName', 'lastName', 'town', 'address']) if (body[k] !== undefined) c[k] = str(body[k], 300) || c[k];
        if (body.marketing !== undefined) c.marketing = bool(body.marketing);
        if (body.password) { if (body.current !== c.password) throw new HttpError(400, 'كلمة المرور الحالية غير صحيحة'); c.password = String(body.password); }
        save();
      }
      return accountPayload(c);
    }
    if (path === '/public/account/link-order') {
      const c = getCustomer();
      if (!c) throw new HttpError(401, 'غير مسجّل');
      const o = d.orders.find((x) => x.number === Math.floor(num(body.number)) && x.customer.phone === normPhone(body.phone));
      if (!o) throw new HttpError(404, 'لم يتم العثور على طلب بهذا الرقم وهذا الهاتف');
      o.customerId = c.id; save(); return accountPayload(c);
    }
    if (path === '/public/my-orders') {
      const out = (body.refs || []).map((r) => d.orders.find((x) => x.number === Math.floor(num(r.number)) && x.customer.phone === normPhone(r.phone))).filter(Boolean).map(orderSummary);
      return { orders: out.sort((a, b) => b.createdAt - a.createdAt), campaigns: activeCampaigns().slice(0, 3) };
    }
    if (path === '/public/blend-requests') {
      const c = body.customer || {};
      const customer = { firstName: str(c.firstName, 60), lastName: str(c.lastName, 60), town: str(c.town, 80), phone: normPhone(c.phone), notes: str(c.notes, 1000) };
      if (!customer.firstName || !customer.lastName || !customer.town) throw new HttpError(400, 'يرجى تعبئة الاسم والعائلة والبلدة');
      if (!PHONE_RE.test(customer.phone)) throw new HttpError(400, 'رقم الهاتف غير صحيح');
      const number = nextNumber('blend', 500);
      d.blendRequests.push({ id: uid('b_'), number, customer, blend: body.blend || {}, conversation: body.conversation || [], status: 'new', seen: false, adminNote: '', price: 0, createdAt: Date.now() });
      save(); return { ok: true, number };
    }

    // ---------------- الإدارة
    if (path === '/admin/login') {
      const u = d.users.find((x) => x.username === str(body.username).toLowerCase() && x.active && x.password === String(body.password || ''));
      if (!u) throw new HttpError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
      try { sessionStorage.setItem(SESSION, u.id); } catch { /* تجاهل */ }
      return { user: safeUser(u) };
    }
    if (path === '/admin/logout') { try { sessionStorage.removeItem(SESSION); } catch { /* تجاهل */ } return { ok: true }; }
    if (path === '/admin/me') return { user: safeUser(need()), aiConfigured: true, aiModel: 'نسخة تجريبية' };
    if (path === '/admin/me/password') {
      const u = need();
      if (u.password !== body.current) throw new HttpError(400, 'كلمة المرور الحالية غير صحيحة');
      if (String(body.password || '').length < 6) throw new HttpError(400, 'كلمة المرور 6 أحرف على الأقل');
      u.password = body.password; save(); return { ok: true };
    }
    if (path === '/admin/summary') {
      need();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const valid = d.orders.filter((o) => o.status !== 'cancelled');
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const s = new Date(today); s.setDate(s.getDate() - i); const e = new Date(s); e.setDate(e.getDate() + 1);
        const os = valid.filter((o) => o.createdAt >= s && o.createdAt < e);
        days.push({ date: s.toISOString().slice(0, 10), orders: os.length, revenue: round2(os.reduce((a, o) => a + o.total, 0)) });
      }
      const sales = {};
      for (const o of valid) for (const it of o.items) sales[it.name] = (sales[it.name] || 0) + it.qty;
      const low = num(d.settings.shop.lowStockAlert, 5);
      return {
        counts: { newOrders: d.orders.filter((o) => o.status === 'new').length, unseenOrders: d.orders.filter((o) => !o.seen).length, unseenBlends: d.blendRequests.filter((b) => !b.seen).length, newBlends: d.blendRequests.filter((b) => b.status === 'new').length, pendingReviews: d.reviews.filter((r) => !r.approved).length, lowStock: d.products.filter((p) => p.active && p.stock <= low).length },
        todayOrders: valid.filter((o) => o.createdAt >= today.getTime()).length,
        todayRevenue: round2(valid.filter((o) => o.createdAt >= today.getTime()).reduce((a, o) => a + o.total, 0)),
        totalRevenue: round2(valid.filter((o) => o.status === 'delivered').reduce((a, o) => a + o.total, 0)),
        pipelineRevenue: round2(valid.filter((o) => o.status !== 'delivered').reduce((a, o) => a + o.total, 0)),
        days, topProducts: Object.entries(sales).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty })),
        recentOrders: d.orders.slice(-6).reverse(), lowStockProducts: d.products.filter((p) => p.active && p.stock <= low).map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
      };
    }
    if (path === '/admin/orders' && method === 'GET') { need('orders'); return d.orders.slice().reverse(); }
    if (path === '/admin/orders/mark-seen') { need('orders'); d.orders.forEach((o) => (o.seen = true)); save(); return { ok: true }; }
    if ((m = path.match(/^\/admin\/orders\/(.+)$/))) {
      const u = need('orders');
      if (method === 'DELETE') { d.orders = d.orders.filter((x) => x.id !== m[1]); save(); return { ok: true }; }
      const o = d.orders.find((x) => x.id === m[1]);
      if (body.status && STATUS[body.status] && body.status !== o.status) {
        const delta = body.status === 'cancelled' ? 1 : o.status === 'cancelled' ? -1 : 0;
        if (delta) for (const it of o.items) { const p = d.products.find((x) => x.id === it.productId); if (p) p.stock = Math.max(0, p.stock + delta * it.qty); }
        o.status = body.status; o.history.push({ status: o.status, at: Date.now(), by: u.username });
      }
      if ('adminNote' in body) o.adminNote = str(body.adminNote, 2000);
      if ('seen' in body) o.seen = bool(body.seen);
      save(); return o;
    }
    if (path === '/admin/customers') {
      need('orders');
      const map = new Map();
      for (const c of d.customers) map.set(c.phone, { phone: c.phone, name: `${c.firstName} ${c.lastName}`, town: c.town || '', account: true, marketing: !!c.marketing, orders: 0, spent: 0, lastOrderAt: 0, createdAt: c.createdAt });
      for (const o of d.orders) {
        const e = map.get(o.customer.phone) || { phone: o.customer.phone, name: `${o.customer.firstName} ${o.customer.lastName}`, town: o.customer.town, account: false, marketing: false, orders: 0, spent: 0, lastOrderAt: 0, createdAt: o.createdAt };
        e.orders++; if (o.status !== 'cancelled') e.spent = round2(e.spent + o.total); e.lastOrderAt = Math.max(e.lastOrderAt, o.createdAt);
        if (!e.account && o.marketing) e.marketing = true;
        map.set(o.customer.phone, e);
      }
      return [...map.values()].sort((a, b) => (b.lastOrderAt || b.createdAt) - (a.lastOrderAt || a.createdAt));
    }
    if ((m = path.match(/^\/admin\/customers\/(.+)$/))) {
      need('orders');
      const phone = normPhone(decodeURIComponent(m[1]));
      const c = d.customers.find((x) => x.phone === phone);
      if (body.password !== undefined) {
        if (!c) throw new HttpError(404, 'هذا الزبون ليس لديه حساب');
        if (String(body.password).length < 6) throw new HttpError(400, 'كلمة المرور 6 أحرف على الأقل');
        c.password = String(body.password); save(); return { ok: true };
      }
      if (c) c.marketing = bool(body.marketing);
      if (!bool(body.marketing)) d.orders.forEach((o) => { if (o.customer.phone === phone) o.marketing = false; });
      save(); return { ok: true };
    }
    if ((m = path.match(/^\/admin\/campaigns\/([^/]+)\/sent$/))) {
      need('content');
      const k = d.campaigns.find((x) => x.id === m[1]);
      k.sentTo = k.sentTo || [];
      if (!k.sentTo.includes(normPhone(body.phone))) k.sentTo.push(normPhone(body.phone));
      save(); return k;
    }
    if (path === '/admin/blends') { need('orders'); return d.blendRequests.slice().reverse(); }
    if ((m = path.match(/^\/admin\/blends\/(.+)$/))) {
      need('orders');
      if (method === 'DELETE') { d.blendRequests = d.blendRequests.filter((x) => x.id !== m[1]); save(); return { ok: true }; }
      const b = d.blendRequests.find((x) => x.id === m[1]);
      if (body.status) b.status = str(body.status, 20);
      if ('adminNote' in body) b.adminNote = str(body.adminNote, 2000);
      if ('price' in body) b.price = num(body.price);
      if ('seen' in body) b.seen = bool(body.seen);
      save(); return b;
    }
    if ((m = path.match(/^\/admin\/(products|categories|slides|coupons|campaigns)(?:\/(.+))?$/))) {
      const [, coll, id] = m;
      need(coll === 'coupons' ? 'settings' : coll === 'slides' || coll === 'campaigns' ? 'content' : 'catalog');
      if (method === 'GET') return d[coll];
      if (method === 'DELETE') { d[coll] = d[coll].filter((x) => x.id !== id); save(); return { ok: true }; }
      if (method === 'POST') { const it = CLEAN[coll](body, null); d[coll].push(it); save(); return it; }
      const i = d[coll].findIndex((x) => x.id === id);
      d[coll][i] = CLEAN[coll](body, d[coll][i]); save(); return d[coll][i];
    }
    if (path === '/admin/reviews') { need('catalog'); const n = Object.fromEntries(d.products.map((p) => [p.id, p.name])); return d.reviews.slice().sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r, productName: n[r.productId] || '—' })); }
    if ((m = path.match(/^\/admin\/reviews\/(.+)$/))) {
      need('catalog');
      if (method === 'DELETE') d.reviews = d.reviews.filter((x) => x.id !== m[1]);
      else { const r = d.reviews.find((x) => x.id === m[1]); if ('approved' in body) r.approved = bool(body.approved); }
      save(); return { ok: true };
    }
    if (path === '/admin/settings') {
      need();
      if (method === 'GET') return d.settings;
      for (const [k, v] of Object.entries(body)) d.settings[k] = k !== 'typography' && v && typeof v === 'object' && !Array.isArray(v) ? { ...d.settings[k], ...v } : v;
      save(); return d.settings;
    }
    if (path === '/admin/users' && method === 'GET') { need('users'); return d.users.map(safeUser); }
    if (path === '/admin/users') {
      need('users');
      const username = str(body.username, 40).toLowerCase();
      if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw new HttpError(400, 'اسم المستخدم: أحرف إنجليزية وأرقام فقط');
      if (d.users.some((u) => u.username === username)) throw new HttpError(400, 'اسم المستخدم مستعمل');
      if (String(body.password || '').length < 6) throw new HttpError(400, 'كلمة المرور 6 أحرف على الأقل');
      const u = { id: uid('u_'), username, name: str(body.name) || username, role: ROLES[body.role] ? body.role : 'editor', active: true, password: String(body.password) };
      d.users.push(u); save(); return safeUser(u);
    }
    if ((m = path.match(/^\/admin\/users\/(.+)$/))) {
      const cur = need('users');
      if (method === 'DELETE') { if (m[1] === cur.id) throw new HttpError(400, 'لا يمكنك حذف حسابك'); d.users = d.users.filter((x) => x.id !== m[1]); save(); return { ok: true }; }
      const u = d.users.find((x) => x.id === m[1]);
      if (body.name !== undefined) u.name = str(body.name);
      if (body.role && ROLES[body.role]) u.role = body.role;
      if (body.active !== undefined) u.active = bool(body.active);
      if (body.password) u.password = String(body.password);
      save(); return safeUser(u);
    }
    if (path === '/admin/upload') { need(); return { url: String(body.data || '') }; }
    if (path === '/admin/restore') { need('users'); mem = body; save(); return { ok: true }; }
    throw new HttpError(404, 'غير موجود');
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const i = url.pathname.indexOf('/api/');
    if (i < 0) return realFetch(input, init);
    const path = url.pathname.slice(i + 4);
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { body = {}; }
    await new Promise((r) => setTimeout(r, path === '/public/chat' ? 900 : 60));
    try {
      const data = route(method, path, url.searchParams, body);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: e.status || 500, headers: { 'Content-Type': 'application/json' } });
    }
  };

  // المعاينة لا تعرض نوافذ التأكيد، فنعتبرها موافقة في النسخة التجريبية
  window.confirm = () => true;
  window.__demoReset = () => { try { localStorage.removeItem(KEY); } catch { /* تجاهل */ } mem = null; location.reload(); };
})();
