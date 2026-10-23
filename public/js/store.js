/* ===================== متجر الجليل – واجهة المتجر ===================== */
(() => {
  'use strict';

  // ---------------------------------------------------------------- الحالة
  const S = {
    data: null, // settings, categories, products, slides, testimonials, aiAvailable
    cart: load('jalil-cart', []),
    favs: load('jalil-favs', []),
    chat: load('jalil-chat', [], sessionStorage),
    account: null, // بيانات حساب الزبون عند تسجيل الدخول
    myOrders: load('jalil-my-orders', []), // طلبات هذا الجهاز [{number, phone}]
    sliderTimer: null,
  };

  function load(key, def, store = localStorage) {
    try { const v = JSON.parse(store.getItem(key)); return v ?? def; } catch { return def; }
  }
  function persist(key, val, store = localStorage) {
    try { store.setItem(key, JSON.stringify(val)); } catch { /* التخزين غير متاح */ }
  }

  // ---------------------------------------------------------------- أدوات
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cur = () => S.data.settings.shop.currency || '₪';
  const money = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur()}`;
  const round2 = (n) => Math.round(n * 100) / 100;
  const PHONE_RE = /^(\+?(972|970)|0)5\d{8}$/;
  const normPhone = (p) => String(p || '').replace(/[\s\-()]/g, '');
  const T = (k) => S.data.settings.texts[k] || '';
  const product = (id) => S.data.products.find((p) => p.id === id);
  const category = (id) => S.data.categories.find((c) => c.id === id);
  const safeUrl = (u) => (/^(https?:|\/|#|data:image\/)/i.test(String(u || '').trim()) ? String(u).trim() : '#');
  const waLink = (text = '') => {
    const n = String(S.data.settings.contact.whatsapp || '').replace(/\D/g, '');
    return n ? `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}` : '';
  };

  const ICON = {
    cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.3 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.7 0 6 3.8 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    arrowR: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    leaf: '<svg viewBox="0 0 24 24"><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 13 11"/></svg>',
    filter: '<svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v6l-4-2v-4z"/></svg>',
    wa: '<svg viewBox="0 0 32 32"><path fill="currentColor" stroke="none" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm5.8 15.7c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8.9 3.9.8a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.1-.3-.2-.7-.4z"/></svg>',
    ig: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/></svg>',
    fb: '<svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg>',
    tt: '<svg viewBox="0 0 24 24"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 3 2.5 5 5.5 5"/></svg>',
  };

  function stars(r) {
    const full = Math.round(r);
    return `<span class="stars" aria-label="${r} من 5">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= full ? '' : 'off'}">★</span>`).join('')}</span>`;
  }

  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    $('#toasts').append(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 2600);
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api/public' + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'حدث خطأ، حاول مجدداً'), { data });
    return data;
  }

  // ---------------------------------------------------------------- المظهر
  function hexToRgb(hex) {
    const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(hex, other, amt) {
    const a = hexToRgb(hex), b = hexToRgb(other);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amt).toString(16).padStart(2, '0')).join('');
  }
  const luminance = (hex) => { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

  function applyTheme() {
    const s = S.data.settings;
    const c = s.colors;
    const typo = s.typography || {};
    loadFonts([s.fontFamily, s.headingFont, s.nameFont, ...Object.values(typo).map((t) => t && t.font)]);
    const ink = luminance(c.primary) > 0.6 ? '#1d1a10' : '#ffffff';
    const light = `--primary:${c.primary};--primary-rgb:${hexToRgb(c.primary)};--primary-ink:${ink};--accent:${c.accent};--accent-rgb:${hexToRgb(c.accent)};
      --bg:${c.background};--surface:${c.surface};--surface-2:${mix(c.background, c.text, 0.05)};--text:${c.text};--muted:${mix(c.text, c.background, 0.42)};
      --line:${mix(c.background, c.text, 0.12)};--footer-bg:${c.footerBg || mix(c.primary, '#000000', 0.7)};${c.headerBg ? `--header-bg:${c.headerBg};` : ''}`;
    const darkText = '#e9efe9';
    const dark = `--primary:${luminance(c.primary) < 0.25 ? mix(c.primary, '#ffffff', 0.25) : c.primary};--bg:${c.darkBackground};--surface:${c.darkSurface};
      --surface-2:${mix(c.darkSurface, '#ffffff', 0.06)};--text:${darkText};--muted:#9fb0a4;--line:rgba(255,255,255,.1);--header-bg:${c.darkBackground}d9;
      --shadow-sm:0 2px 10px rgba(0,0,0,.3);--shadow:0 12px 40px rgba(0,0,0,.4);--footer-bg:${mix(c.darkBackground, '#000000', 0.4)};`;
    $('#theme-vars').textContent = `:root{${light}--radius:${s.radius}px;--font:'${s.fontFamily}',system-ui,sans-serif;--font-head:'${s.headingFont}','${s.fontFamily}',sans-serif;
      --font-brand:'${s.nameFont}','${s.headingFont}',serif;--base-size:${s.baseFontSize}px;--logo-size:${s.logoSize}px;--logo-radius:${s.logoRadius}%;--name-size:${s.nameSize}px}
      html[data-dark="1"]{${dark}color-scheme:dark}
      html[data-dark="1"] .brand-name{color:${mix(c.primary, '#ffffff', 0.55)}}`;
    $('#custom-css').textContent = typographyCSS(typo) + (s.customCss || '');
    setDark();
  }

  // الخط والحجم والوزن واللون لكل جزء من الموقع بشكل منفصل (من لوحة التحكم ← الخطوط لكل قسم)
  const TYPO_SELECTORS = {
    body: 'body',
    announce: '.announce',
    nav: '.nav a, #mobileLinks a',
    brandTag: '.brand-tag',
    heroBadge: '.slide-badge',
    heroTitle: '.slide h1',
    heroText: '.slide p',
    buttons: '.btn',
    featureTitle: '.feature h4',
    featureText: '.feature p',
    sectionTitle: '.section-head h2, .page-hero h1',
    sectionSub: '.section-head p',
    categoryName: '.cat-card h3',
    cardTitle: '.card-title, .card-title a',
    cardPrice: '.card .price b',
    tags: '.tag',
    productTitle: '.p-info h1',
    productPrice: '.p-price b',
    productText: '.p-short, .tab-pane, .benefits li',
    productTabs: '.tab-btns button',
    reviews: '.testi p, .review p',
    advisorTitle: '.advisor-banner h2',
    advisorText: '.advisor-banner p',
    chat: '.bubble, .offer-body',
    forms: '.input, .textarea, .select, .field label',
    cart: '.drawer, .summary-item',
    popupTitle: '.popup-body h3',
    popupText: '.popup-body p',
    articleTitle: '.article-head h1',
    articleLead: '.article-head .lead',
    articleHeadings: '.article-content h4',
    articleText: '.article-content p, .article-content li',
    articleCardTitle: '.article-card h3',
    articleCardText: '.article-body p',
    footerTitle: '.footer h4, .footer-brand',
    footer: '.footer p, .footer li, .footer-bottom',
  };
  const cleanFont = (f) => String(f || '').replace(/[^\w\s-]/g, '').trim();
  function typographyCSS(typo) {
    let css = '', mobile = '';
    for (const [key, sel] of Object.entries(TYPO_SELECTORS)) {
      const t = typo[key];
      if (!t) continue;
      const scoped = sel.split(',').map((x) => 'html ' + x.trim()).join(', ');
      const rules = [];
      const font = cleanFont(t.font);
      if (font) rules.push(`font-family:'${font}','${cleanFont(S.data.settings.fontFamily)}',system-ui,sans-serif`);
      const size = Number(t.size);
      if (size > 0) {
        rules.push(`font-size:${size}px`);
        if (size > 20) mobile += `${scoped}{font-size:${Math.round(size * 0.78)}px}`;
      }
      if (t.weight) rules.push(`font-weight:${t.weight === 'bold' ? 700 : 400}`);
      if (/^#[0-9a-f]{3,8}$/i.test(t.color || '')) rules.push(`color:${t.color}`);
      if (rules.length) css += `${scoped}{${rules.join(';')}}\n`;
    }
    return css + (mobile ? `@media (max-width:700px){${mobile}}\n` : '');
  }

  // بعض الخطوط متوفرة بوزن واحد فقط، وطلب وزن غير موجود يُفشل تحميل الخط
  const SINGLE_WEIGHT = ['Lalezar', 'Rakkas', 'Jomhuria', 'Katibeh', 'Vibes', 'Blaka', 'Gulzar'];
  function loadFonts(list) {
    $$('link[data-font]').forEach((l) => l.remove());
    for (const f of [...new Set(list.map(cleanFont).filter(Boolean))]) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.dataset.font = f;
      link.href = `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}${SINGLE_WEIGHT.includes(f) ? '' : ':wght@400;700'}&display=swap`;
      document.head.append(link);
    }
    $('#gfonts')?.remove();
  }

  function themeMode() {
    try { return localStorage.getItem('jalil-theme') || S.data.settings.defaultTheme || 'auto'; } catch { return 'auto'; }
  }
  function setDark() {
    const mode = themeMode();
    const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.dark = dark ? '1' : '0';
    document.documentElement.dataset.theme = mode;
  }

  // ---------------------------------------------------------------- الهيكل
  function renderShell() {
    const s = S.data.settings;
    document.title = s.seo.title || s.storeName;
    const mark = s.logo
      ? `<img src="${esc(safeUrl(s.logo))}" alt="${esc(s.storeName)}">`
      : `<span class="brand-mark">${ICON.leaf}</span>`;
    $('#brand').innerHTML = `${s.showLogo ? mark : ''}${s.showName || s.showTagline ? `<span class="brand-text">${s.showName ? `<span class="brand-name">${esc(s.storeName)}</span>` : ''}${s.showTagline ? `<span class="brand-tag">${esc(s.tagline)}</span>` : ''}</span>` : ''}`;
    $('#header').dataset.pos = s.namePosition || 'right';
    $('#mobileBrand').textContent = s.storeName;

    const catLinks = S.data.categories.slice(0, S.data.aiAvailable ? 2 : 3).map((c) => [`#/shop?cat=${c.slug}`, c.name, 'cat-link']);
    const links = [['#/', 'الرئيسية'], ['#/shop', 'المتجر'], ...catLinks];
    if (S.data.aiAvailable) links.push(['#/advisor', '🌿 ' + (s.ai.assistantName || 'المستشار')]);
    if ((S.data.articles || []).length) links.push(['#/blog', 'نصائح']);
    links.push(['#/about', 'من نحن'], ['#/contact', 'تواصل معنا']);
    $('#nav').innerHTML = links.map(([h, t, cls]) => `<a href="${h}" class="${cls || ''}">${esc(t)}</a>`).join('');
    $('#mobileLinks').innerHTML = [...links, ['#/account', '👤 حسابي وطلباتي'], ['#/track', 'تتبع طلبك'], ['#/favorites', 'المفضلة']]
      .map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join('') +
      S.data.categories.slice(catLinks.length).map((c) => `<a href="#/shop?cat=${c.slug}">${esc(c.icon)} ${esc(c.name)}</a>`).join('');

    const an = $('#announce');
    an.hidden = !s.announcement.enabled || !s.announcement.text;
    an.innerHTML = `<span>${esc(s.announcement.text)}</span>`;

    const wa = waLink('مرحباً، لدي استفسار عن منتجاتكم');
    $('#waFloat').hidden = !wa;
    if (wa) $('#waFloat').href = wa;
    $('#aiFloat').hidden = !S.data.aiAvailable;

    renderFooter();
    updateBadges();
  }

  function renderFooter() {
    const s = S.data.settings;
    const c = s.contact;
    const social = [
      [c.instagram, ICON.ig, 'Instagram'], [c.facebook, ICON.fb, 'Facebook'], [c.tiktok, ICON.tt, 'TikTok'], [waLink(), ICON.wa, 'WhatsApp'],
    ].filter(([u]) => u).map(([u, i, l]) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener" aria-label="${l}">${i}</a>`).join('');
    $('#footer').innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">${esc(s.storeName)}</div>
            <p>${esc(T('footerAbout'))}</p>
            <div class="socials">${social}</div>
          </div>
          <div><h4>الأقسام</h4><ul>${S.data.categories.map((k) => `<li><a href="#/shop?cat=${k.slug}">${esc(k.name)}</a></li>`).join('')}</ul></div>
          <div><h4>روابط</h4><ul>
            <li><a href="#/shop">جميع المنتجات</a></li><li><a href="#/shop?sale=1">العروض</a></li>
            ${S.data.aiAvailable ? `<li><a href="#/advisor">${esc(s.ai.assistantName)}</a></li>` : ''}
            <li><a href="#/account">طلباتي وحسابي</a></li><li><a href="#/track">تتبع طلبك</a></li><li><a href="#/about">من نحن</a></li><li><a href="#/contact">تواصل معنا</a></li></ul></div>
          <div><h4>تواصل معنا</h4><ul>
            ${c.phone ? `<li>📞 <a href="tel:${esc(c.phone)}" dir="ltr">${esc(c.phone)}</a></li>` : ''}
            ${c.whatsapp ? `<li>💬 <a href="${esc(waLink())}" target="_blank" rel="noopener">واتساب</a></li>` : ''}
            ${c.email ? `<li>✉️ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : ''}
            ${c.address ? `<li>📍 ${esc(c.address)}</li>` : ''}
            ${c.hours ? `<li>🕘 ${esc(c.hours)}</li>` : ''}
            <li>💵 الدفع عند الاستلام فقط</li></ul></div>
        </div>
        <p class="disclaimer">⚕️ ${esc(T('medicalDisclaimer'))}</p>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(T('copyright'))}</span><span>صُنع بحب 🌿 في الجليل</span></div>
      </div>`;
  }

  function updateBadges() {
    const n = S.cart.reduce((a, i) => a + i.qty, 0);
    const b = $('#cartCount');
    b.hidden = !n; b.textContent = n;
    const f = $('#favCount');
    f.hidden = !S.favs.length; f.textContent = S.favs.length;
  }

  // ---------------------------------------------------------------- بطاقة المنتج
  function card(p) {
    const fav = S.favs.includes(p.id);
    const cat = category(p.categoryId);
    return `<article class="card reveal" data-id="${p.id}">
      <div class="card-media">
        <a href="#/product/${encodeURIComponent(p.slug)}" aria-label="${esc(p.name)}">
          <img src="${esc(safeUrl(p.images[0]))}" alt="${esc(p.name)}" loading="lazy">
          ${p.images[1] ? `<img class="alt" src="${esc(safeUrl(p.images[1]))}" alt="" loading="lazy">` : ''}
        </a>
        <div class="card-tags">
          ${!p.inStock ? '<span class="tag tag-out">نفد</span>' : ''}
          ${p.discount ? `<span class="tag tag-sale">-${p.discount}%</span>` : ''}
          ${p.isNew ? '<span class="tag tag-new">جديد</span>' : ''}
          ${p.bestseller ? '<span class="tag tag-best">الأكثر طلباً</span>' : ''}
        </div>
        <button class="card-fav ${fav ? 'on' : ''}" data-fav="${p.id}" aria-label="أضف للمفضلة">${ICON.heart}</button>
        ${p.inStock ? `<div class="card-quick"><button class="btn btn-block btn-sm" data-add="${p.id}">${ICON.cart} ${p.fromPrice ? 'اختر الحجم' : 'أضف للسلة'}</button></div>` : ''}
      </div>
      <div class="card-body">
        <span class="card-cat">${esc(cat ? cat.name : '')}${p.size ? ' • ' + esc(p.size) : ''}</span>
        <h3 class="card-title"><a href="#/product/${encodeURIComponent(p.slug)}">${esc(p.name)}</a></h3>
        ${p.reviewsCount ? `<div class="rating-line">${stars(p.rating)} (${p.reviewsCount})</div>` : ''}
        <div class="card-foot">
          <div class="price">${p.fromPrice ? '<small>من</small>' : ''}<b>${money(p.finalPrice)}</b>${p.discount ? `<s>${money(p.price)}</s>` : ''}</div>
          ${p.inStock ? `<button class="add-mini" data-add="${p.id}" aria-label="أضف للسلة">${ICON.plus}</button>` : ''}
        </div>
      </div>
    </article>`;
  }

  // ---------------------------------------------------------------- السلة
  // عنصر السلة: {id, variant, qty}. المنتج بأكثر من حجم له عنصر منفصل لكل حجم.
  const cartKey = (i) => `${i.id}|${i.variant || ''}`;
  const zoneList = () => Commerce.zones(S.data.settings);
  const currentZone = () => { const z = load('jalil-zone', ''); return zoneList().some((x) => x.id === z) ? z : ''; };

  function addToCart(id, qty = 1, silent = false, variant = '') {
    const p = product(id);
    if (!p) return;
    const o = Commerce.option(p, variant);
    if (!o || o.stock <= 0) return toast('هذا المنتج غير متوفر حالياً', 'err');
    const v = o.variant ? o.variant.id : '';
    const line = S.cart.find((i) => i.id === id && (i.variant || '') === v);
    const nextQty = Math.min(o.stock, (line ? line.qty : 0) + qty);
    if (line) line.qty = nextQty; else S.cart.push({ id, variant: v, qty: Math.min(qty, o.stock) });
    saveCart();
    const b = $('#cartCount');
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    if (!silent) toast(`✓ أُضيف "${p.name}${o.variant ? ' – ' + o.label : ''}" إلى السلة`);
  }
  function saveCart() {
    S.cart = S.cart.filter((i) => { const p = product(i.id); return p && Commerce.option(p, i.variant || '') && i.qty > 0; });
    persist('jalil-cart', S.cart);
    updateBadges();
    renderCart();
  }

  // نفس منطق الخادم (lib/commerce.js) حتى تطابق الأرقام المعروضة ما سيُحسب فعلاً
  function cartTotals(couponDiscount = 0, zoneId = currentZone()) {
    const pr = Commerce.priceCart({ products: S.data.products, settings: S.data.settings, coupons: [] }, S.cart, '', zoneId);
    const lines = pr.lines.map((l) => ({ ...l, key: `${l.productId}|${l.variantId}`, p: product(l.productId) }));
    const after = round2(pr.subtotal - pr.productDiscount);
    const net = round2(after - couponDiscount);
    const ship = Commerce.shippingFor(S.data.settings, net, zoneId, lines.length > 0);
    const fees = zoneList().map((z) => Number(z.fee) || 0);
    return { lines, subtotal: pr.subtotal, discount: pr.productDiscount, after, shipping: ship.shipping, needsZone: ship.needsZone, minFee: fees.length ? Math.min(...fees) : 0, total: round2(net + ship.shipping), freeOver: ship.freeOver };
  }

  function renderCart() {
    const t = cartTotals();
    const body = $('#cartBody');
    if (!t.lines.length) {
      body.innerHTML = `<div class="empty"><div class="big">🧺</div><p>سلتك فارغة حالياً</p><a href="#/shop" class="btn" data-close-cart>ابدأ التسوق</a></div>`;
      $('#cartFoot').innerHTML = '';
      return;
    }
    const remain = t.freeOver - t.after;
    body.innerHTML = `
      ${t.freeOver > 0 ? `<div class="ship-progress">${remain > 0 ? `أضف <b>${money(remain)}</b> للحصول على توصيل مجاني 🚚` : '🎉 مبروك! طلبك مؤهل للتوصيل المجاني'}<i><b style="width:${Math.min(100, (t.after / t.freeOver) * 100)}%"></b></i></div>` : ''}
      ${t.lines.map((l) => `
        <div class="cart-item">
          <img src="${esc(safeUrl(l.image))}" alt="">
          <div>
            <h4><a href="#/product/${encodeURIComponent(l.p.slug)}" data-close-cart>${esc(l.name)}</a>${l.size && Commerce.hasVariants(l.p) ? ` <small class="variant-tag">${esc(l.size)}</small>` : ''}</h4>
            <div class="price"><b>${money(l.unitFinal)}</b>${l.discount ? `<s>${money(l.price)}</s>` : ''}</div>
            <div class="qty sm" style="margin-top:6px"><button data-dec="${esc(l.key)}">−</button><input value="${l.qty}" data-qty="${esc(l.key)}" inputmode="numeric" aria-label="الكمية"><button data-inc="${esc(l.key)}">+</button></div>
          </div>
          <button class="remove-btn" data-remove="${esc(l.key)}" aria-label="حذف">${ICON.trash}</button>
        </div>`).join('')}`;
    $('#cartFoot').innerHTML = `
      <div class="sum-row"><span>المجموع</span><span>${money(t.subtotal)}</span></div>
      ${t.discount ? `<div class="sum-row discount"><span>التوفير</span><span>-${money(t.discount)}</span></div>` : ''}
      <div class="sum-row"><span>التوصيل</span><span>${t.needsZone ? (t.after >= t.freeOver && t.freeOver > 0 ? 'مجاني' : `حسب المنطقة (من ${money(t.minFee)})`) : t.shipping ? money(t.shipping) : 'مجاني'}</span></div>
      <div class="sum-row total"><span>الإجمالي</span><span>${money(t.total)}${t.needsZone && t.shipping === 0 && !(t.after >= t.freeOver && t.freeOver > 0) ? ' + التوصيل' : ''}</span></div>
      <a href="#/checkout" class="btn btn-block" style="margin-top:12px" data-close-cart>إتمام الطلب • الدفع عند الاستلام</a>`;
  }

  function openCart(open = true) {
    $('#cartDrawer').classList.toggle('open', open);
    $('#cartBackdrop').hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) renderCart();
  }

  function toggleFav(id) {
    const i = S.favs.indexOf(id);
    if (i >= 0) S.favs.splice(i, 1); else { S.favs.push(id); toast('❤ أُضيف إلى المفضلة'); }
    persist('jalil-favs', S.favs);
    updateBadges();
    $$(`[data-fav="${id}"]`).forEach((b) => b.classList.toggle('on', S.favs.includes(id)));
  }

  // ---------------------------------------------------------------- الموجّه
  const routes = [
    [/^\/?$/, pageHome],
    [/^\/shop$/, pageShop],
    [/^\/product\/(.+)$/, pageProduct],
    [/^\/checkout$/, pageCheckout],
    [/^\/success\/(\d+)$/, pageSuccess],
    [/^\/track$/, pageTrack],
    [/^\/advisor$/, pageAdvisor],
    [/^\/favorites$/, pageFavorites],
    [/^\/account$/, pageAccount],
    [/^\/blog$/, pageBlog],
    [/^\/blog\/(.+)$/, pageArticle],
    [/^\/about$/, pageAbout],
    [/^\/contact$/, pageContact],
  ];

  function parseHash() {
    const raw = location.hash.slice(1) || (/^\/(blog|product)(\/|$)/.test(location.pathname) ? location.pathname : '/');
    const [path, qs] = raw.split('?');
    return { path, query: new URLSearchParams(qs || '') };
  }

  function router() {
    const { path, query } = parseHash();
    clearInterval(S.sliderTimer);
    // تحديث الحساب كل دقيقة حتى يظهر إشعار العروض الجديدة دون إعادة تحميل الصفحة
    if (S.account && path !== '/account' && Date.now() - (S.accountAt || 0) > 60000) refreshAccount();
    const app = $('#app');
    let handled = false;
    for (const [re, fn] of routes) {
      const m = path.match(re);
      if (m) { fn(app, query, ...m.slice(1).map(decodeURIComponent)); handled = true; break; }
    }
    if (!handled) page404(app);
    app.classList.remove('page-enter'); void app.offsetWidth; app.classList.add('page-enter');
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + (path + (query.toString() ? '?' + query : '')) || (a.getAttribute('href') === '#/' && path === '/')));
    $('#mobileNav').hidden = true;
    document.body.classList.toggle('on-advisor', path === '/advisor');
    $('.floaters').style.display = path === '/advisor' ? 'none' : '';
    if (!S.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
    S.keepScroll = false;
    observeReveal();
  }

  function navigate(hash, keepScroll = false) {
    S.keepScroll = keepScroll;
    if (location.hash === hash) router(); else location.hash = hash;
  }

  // ---------------------------------------------------------------- الرئيسية
  function pageHome(app) {
    const s = S.data.settings;
    const P = S.data.products;
    const html = [];
    for (const sec of s.home.sections) {
      if (!sec.enabled) continue;
      if (sec.key === 'slider' && S.data.slides.length) html.push(heroHTML());
      if (sec.key === 'features' && s.home.features.length) html.push(`<section class="features container"><div class="features-grid reveal">${s.home.features.map((f) => `<div class="feature"><div class="feature-icon">${esc(f.icon)}</div><div><h4>${esc(f.title)}</h4><p>${esc(f.text)}</p></div></div>`).join('')}</div></section>`);
      if (sec.key === 'categories') html.push(`<section class="section container">${head(T('categoriesTitle'), T('categoriesSubtitle'), '#/shop')}<div class="cats-grid">${S.data.categories.map((c) => `
        <a class="cat-card reveal" href="#/shop?cat=${c.slug}"><div class="cat-img">${c.image ? `<img src="${esc(safeUrl(c.image))}" alt="" loading="lazy">` : ''}<span class="cat-icon">${esc(c.icon)}</span></div><h3>${esc(c.name)}</h3><small>${P.filter((p) => p.categoryId === c.id).length} منتج</small></a>`).join('')}</div></section>`);
      if (sec.key === 'featured') { const f = P.filter((p) => p.featured).slice(0, 8); if (f.length) html.push(`<section class="section container" style="padding-top:0">${head(T('featuredTitle'), T('featuredSubtitle'), '#/shop')}<div class="grid">${f.map(card).join('')}</div></section>`); }
      if (sec.key === 'advisor' && S.data.aiAvailable) html.push(`<section class="section container" style="padding-top:0"><div class="advisor-banner reveal">
        <svg class="leaf-deco" style="top:-60px;left:-40px" viewBox="0 0 24 24"><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15" fill="#fff"/></svg>
        <div><span class="slide-badge">🤖 ذكاء اصطناعي</span><h2>${esc(T('advisorTitle'))}</h2><p>${esc(T('advisorText'))}</p><a class="btn btn-accent" href="#/advisor">${esc(T('advisorButton'))} ←</a></div>
        <div class="advisor-chat-mock"><div class="mock-msg u">بدي خلطة طبيعية للتنحيف ما بتضر 🙏</div><div class="mock-msg a">أكيد! خلينا نبدأ بسؤالين صغار عن صحتك، وبعدها بقترح عليك خلطة آمنة ومدروسة 🌿</div><div class="mock-msg u">تمام، جاهز ✨</div></div>
      </div></section>`);
      if (sec.key === 'offers') { const o = P.filter((p) => p.discount > 0).sort((a, b) => b.discount - a.discount).slice(0, 10); if (o.length) html.push(`<section class="section container" style="padding-top:0">${head(T('offersTitle'), T('offersSubtitle'), '#/shop?sale=1')}<div class="rail">${o.map(card).join('')}</div></section>`); }
      if (sec.key === 'bestsellers') { const b = P.filter((p) => p.bestseller).slice(0, 8); if (b.length) html.push(`<section class="section container" style="padding-top:0">${head(T('bestsellersTitle'), '', '#/shop?sort=popular')}<div class="grid">${b.map(card).join('')}</div></section>`); }
      if (sec.key === 'articles' && (S.data.articles || []).length) html.push(`<section class="section container" style="padding-top:0">${head(T('articlesTitle') || 'نصائح ومقالات', T('articlesSubtitle'), '#/blog')}<div class="articles-grid">${S.data.articles.slice(0, 3).map(articleCard).join('')}</div></section>`);
      if (sec.key === 'testimonials' && S.data.testimonials.length) html.push(`<section class="section container" style="padding-top:0">${head(T('testimonialsTitle'), '')}<div class="rail">${S.data.testimonials.map((r) => `
        <div class="testi reveal">${stars(r.rating)}<p>${esc(r.text)}</p><div class="testi-who"><span class="avatar">${esc(r.name.trim()[0] || '؟')}</span><div><b>${esc(r.name)}</b><small>${esc(r.town || '')}${r.productName ? ' • ' + esc(r.productName) : ''}</small></div></div></div>`).join('')}</div></section>`);
    }
    app.innerHTML = html.join('');
    startSlider();
  }

  function head(title, sub, more) {
    return `<div class="section-head reveal"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${more ? `<a class="link-more" href="${more}">عرض الكل ${ICON.arrow}</a>` : ''}</div>`;
  }

  function heroHTML() {
    const slides = S.data.slides;
    return `<section class="hero" id="hero" style="--slide-ms:${(S.data.settings.home.sliderInterval || 6) * 1000}ms">
      ${slides.map((s, i) => `
        <div class="slide ${i === 0 ? 'active' : ''}" data-i="${i}">
          <div class="slide-bg" style="background-image:url('${esc(safeUrl(s.image))}')"></div>
          <div class="container slide-inner">
            <div class="slide-content">
              ${s.badge ? `<span class="slide-badge">${esc(s.badge)}</span>` : '<span></span>'}
              <h1>${esc(s.title)}</h1>
              <p>${esc(s.subtitle)}</p>
              <div class="slide-actions">
                ${s.buttonText ? `<a class="btn btn-accent" href="${esc(safeUrl(s.buttonLink))}">${esc(s.buttonText)}</a>` : ''}
                ${s.button2Text ? `<a class="btn btn-ghost" href="${esc(safeUrl(s.button2Link))}" style="color:#fff">${esc(s.button2Text)}</a>` : ''}
              </div>
            </div>
            ${s.sideImage ? `<div class="slide-visual"><img src="${esc(safeUrl(s.sideImage))}" alt=""></div>` : ''}
          </div>
        </div>`).join('')}
      ${slides.length > 1 ? `<div class="hero-nav"><button class="hero-arrow" data-hero="prev" aria-label="السابق">${ICON.arrowR}</button>
        <div class="hero-dots">${slides.map((_, i) => `<button class="${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="شريحة ${i + 1}"></button>`).join('')}</div>
        <button class="hero-arrow" data-hero="next" aria-label="التالي">${ICON.arrow}</button></div>` : ''}
    </section>`;
  }

  function startSlider() {
    const hero = $('#hero');
    if (!hero) return;
    const slides = $$('.slide', hero);
    if (slides.length < 2) return;
    let i = 0;
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('active', k === i));
      $$('[data-dot]', hero).forEach((d, k) => { d.classList.remove('active'); if (k === i) { void d.offsetWidth; d.classList.add('active'); } });
    };
    const restart = () => { clearInterval(S.sliderTimer); S.sliderTimer = setInterval(() => go(i + 1), (S.data.settings.home.sliderInterval || 6) * 1000); };
    hero.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hero],[data-dot]');
      if (!b) return;
      if (b.dataset.dot) go(+b.dataset.dot); else go(i + (b.dataset.hero === 'next' ? 1 : -1));
      restart();
    });
    let x0 = null;
    hero.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) { go(i + (dx > 0 ? 1 : -1)); restart(); }
      x0 = null;
    });
    restart();
  }

  // ---------------------------------------------------------------- المتجر
  function pageShop(app, q) {
    const catSlug = q.get('cat') || '';
    const search = (q.get('q') || '').trim();
    const sale = q.get('sale') === '1';
    const inStock = q.get('stock') === '1';
    const sort = q.get('sort') || 'default';
    const max = Number(q.get('max')) || 0;
    const cat = S.data.categories.find((c) => c.slug === catSlug);
    let list = S.data.products.slice();
    if (cat) list = list.filter((p) => p.categoryId === cat.id);
    if (search) { const s = search.toLowerCase(); list = list.filter((p) => (p.name + ' ' + p.shortDesc + ' ' + p.ingredients).toLowerCase().includes(s)); }
    if (sale) list = list.filter((p) => p.discount > 0);
    if (inStock) list = list.filter((p) => p.inStock);
    if (max) list = list.filter((p) => p.finalPrice <= max);
    const sorters = {
      default: (a, b) => (b.featured - a.featured) || (b.bestseller - a.bestseller),
      priceAsc: (a, b) => a.finalPrice - b.finalPrice,
      priceDesc: (a, b) => b.finalPrice - a.finalPrice,
      newest: (a, b) => b.createdAt - a.createdAt,
      popular: (a, b) => (b.bestseller - a.bestseller) || (b.reviewsCount - a.reviewsCount),
      rating: (a, b) => b.rating - a.rating,
      discount: (a, b) => b.discount - a.discount,
    };
    list.sort(sorters[sort] || sorters.default);
    const setQ = (k, v) => { const n = new URLSearchParams(q); if (v === '' || v === null || v === false) n.delete(k); else n.set(k, v); return '#/shop' + (n.toString() ? '?' + n : ''); };
    const maxPrice = Math.ceil(Math.max(...S.data.products.map((p) => p.finalPrice), 10) / 10) * 10;
    const title = cat ? cat.name : search ? `نتائج البحث: "${search}"` : sale ? 'العروض والخصومات' : 'جميع المنتجات';

    app.innerHTML = `
      <section class="page-hero"><div class="container"><div class="crumbs"><a href="#/">الرئيسية</a> / <a href="#/shop">المتجر</a>${cat ? ' / ' + esc(cat.name) : ''}</div>
        <h1>${cat ? esc(cat.icon) + ' ' : ''}${esc(title)}</h1>${cat && cat.description ? `<p style="color:var(--muted);margin:.3em 0 0">${esc(cat.description)}</p>` : ''}</div></section>
      <div class="container shop-layout">
        <aside class="filters" id="filters">
          <h4>الأقسام</h4>
          <div class="chip-list">
            <button data-go="${setQ('cat', '')}" class="${!cat ? 'on' : ''}">الكل <small>${S.data.products.length}</small></button>
            ${S.data.categories.map((c) => `<button data-go="${setQ('cat', c.slug)}" class="${cat && cat.id === c.id ? 'on' : ''}">${esc(c.icon)} ${esc(c.name)} <small>${S.data.products.filter((p) => p.categoryId === c.id).length}</small></button>`).join('')}
          </div>
          <h4>السعر الأقصى: <span id="maxLbl">${max ? money(max) : 'الكل'}</span></h4>
          <input type="range" min="0" max="${maxPrice}" step="5" value="${max || maxPrice}" id="maxRange" style="width:100%;accent-color:var(--primary)">
          <h4>تصفية</h4>
          <label class="toggle-row"><input type="checkbox" id="fSale" ${sale ? 'checked' : ''}> عليها خصم فقط</label>
          <label class="toggle-row"><input type="checkbox" id="fStock" ${inStock ? 'checked' : ''}> متوفر فقط</label>
          <button class="btn btn-soft btn-block btn-sm" style="margin-top:14px" data-go="#/shop">مسح الفلاتر</button>
        </aside>
        <div>
          <div class="toolbar">
            <button class="btn btn-soft btn-sm filter-btn" id="filterToggle">${ICON.filter} تصفية</button>
            <span class="count">${list.length} منتج</span>
            <select class="select" id="sortSel" aria-label="ترتيب">
              ${[['default', 'الترتيب المميز'], ['popular', 'الأكثر طلباً'], ['newest', 'الأحدث'], ['priceAsc', 'السعر: من الأقل'], ['priceDesc', 'السعر: من الأعلى'], ['rating', 'الأعلى تقييماً'], ['discount', 'أكبر خصم']].map(([v, t]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<div class="empty"><div class="big">🔍</div><p>لا توجد منتجات مطابقة</p><a class="btn" href="#/shop">عرض كل المنتجات</a></div>`}
        </div>
      </div>`;
    $('#sortSel').onchange = (e) => navigate(setQ('sort', e.target.value === 'default' ? '' : e.target.value), true);
    $('#fSale').onchange = (e) => navigate(setQ('sale', e.target.checked ? '1' : ''), true);
    $('#fStock').onchange = (e) => navigate(setQ('stock', e.target.checked ? '1' : ''), true);
    const r = $('#maxRange');
    r.oninput = () => { $('#maxLbl').textContent = +r.value >= maxPrice ? 'الكل' : money(r.value); };
    r.onchange = () => navigate(setQ('max', +r.value >= maxPrice ? '' : r.value), true);
    $('#filterToggle').onclick = () => $('#filters').classList.toggle('open');
  }

  // ---------------------------------------------------------------- صفحة المنتج
  function pageProduct(app, q, slug) {
    const p = S.data.products.find((x) => x.slug === slug || x.id === slug);
    if (!p) return page404(app);
    const cat = category(p.categoryId);
    const s = S.data.settings;
    const variants = Commerce.hasVariants(p) ? p.variants : [];
    let sel = (variants.find((v) => v.stock > 0) || variants[0] || {}).id || '';
    const lowAt = s.shop.lowStockAlert || 5;
    const related = S.data.products.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 4);
    const tabs = [
      ['desc', 'الوصف', `<p>${esc(p.description).replace(/\n/g, '<br>')}</p>`],
      p.benefits.length && ['benefits', 'الفوائد', `<ul class="benefits">${p.benefits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`],
      p.usage && ['usage', 'طريقة الاستعمال', `<p>${esc(p.usage).replace(/\n/g, '<br>')}</p>`],
      p.ingredients && ['ingredients', 'المكونات', `<p>${esc(p.ingredients)}</p>`],
      p.warnings && p.warnings !== '—' && ['warnings', 'تحذيرات', `<div class="warn-box">⚠️ ${esc(p.warnings)}</div>`],
    ].filter(Boolean);

    app.innerHTML = `
      <div class="container">
        <div class="crumbs" style="padding-top:22px"><a href="#/">الرئيسية</a> / <a href="#/shop">المتجر</a> / ${cat ? `<a href="#/shop?cat=${cat.slug}">${esc(cat.name)}</a> / ` : ''}<span>${esc(p.name)}</span></div>
        <div class="product">
          <div class="gallery">
            <div class="gallery-main" id="gMain"><img src="${esc(safeUrl(p.images[0]))}" alt="${esc(p.name)}" id="gImg">
              <div class="card-tags">${p.discount ? `<span class="tag tag-sale">-${p.discount}%</span>` : ''}${p.isNew ? '<span class="tag tag-new">جديد</span>' : ''}</div></div>
            ${p.images.length > 1 ? `<div class="gallery-thumbs">${p.images.map((im, i) => `<button class="${i === 0 ? 'on' : ''}" data-img="${esc(safeUrl(im))}"><img src="${esc(safeUrl(im))}" alt=""></button>`).join('')}</div>` : ''}
          </div>
          <div class="p-info">
            <span class="card-cat">${esc(cat ? cat.icon + ' ' + cat.name : '')}</span>
            <h1>${esc(p.name)}</h1>
            <div class="p-meta">${p.reviewsCount ? `${stars(p.rating)} <a href="#reviews" data-scroll="reviews">${p.rating} • ${p.reviewsCount} تقييم</a>` : '<span>كن أول من يقيّم</span>'}${p.size ? `<span>📦 ${esc(p.size)}</span>` : ''}</div>
            <div class="p-price" id="pPrice"></div>
            ${variants.length ? `<div class="variants"><span>الحجم:</span>${variants.map((v) => `<button type="button" class="variant ${v.id === sel ? 'on' : ''}" data-variant="${esc(v.id)}" ${v.stock > 0 ? '' : 'data-out="1"'}>${esc(v.name)}<small>${money(Commerce.applyDiscount(v.price, p.discount))}</small></button>`).join('')}</div>` : ''}
            <p class="p-short">${esc(p.shortDesc)}</p>
            <div class="stock-line" id="pStock"></div>
            <div class="p-actions">
              ${p.inStock ? `<div class="qty"><button id="qDec">−</button><input id="qVal" value="1" inputmode="numeric" aria-label="الكمية"><button id="qInc">+</button></div>
              <button class="btn" id="addBtn" style="flex:1">${ICON.cart} أضف إلى السلة</button>
              <button class="btn btn-accent" id="buyNow">اشترِ الآن</button>` : ''}
              <button class="btn btn-fav ${S.favs.includes(p.id) ? 'on' : ''}" data-fav="${p.id}" aria-label="المفضلة">${ICON.heart}</button>
            </div>
            ${waLink() ? `<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${esc(waLink('مرحباً، أريد الاستفسار عن: ' + p.name))}">${ICON.wa} استفسر عبر واتساب</a>` : ''}
            <div class="assurance"><div><span>🌿</span>طبيعي 100%</div><div><span>💵</span>الدفع عند الاستلام</div><div><span>🚚</span>${s.shop.freeShippingOver ? 'مجاني فوق ' + money(s.shop.freeShippingOver) : 'توصيل سريع'}</div></div>
            <div class="tabs">
              <div class="tab-btns">${tabs.map(([k, t], i) => `<button class="${i === 0 ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</div>
              ${tabs.map(([k, , html], i) => `<div class="tab-pane" data-pane="${k}" ${i ? 'hidden' : ''}>${html}</div>`).join('')}
            </div>
          </div>
        </div>
        <section class="section" id="reviews" style="padding-top:20px">
          ${head('آراء الزبائن', '')}
          <div class="reviews-wrap"><div class="rev-summary" id="revSummary"><div class="skeleton" style="height:180px"></div></div>
            <div><div id="revList"></div>
              <form class="panel" id="revForm" style="margin-top:20px"><h3>أضف تقييمك</h3>
                <div class="star-input">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" id="st${n}" value="${n}" ${n === 5 ? 'checked' : ''}><label for="st${n}">★</label>`).join('')}</div>
                <div class="form-grid" style="margin-top:12px"><div class="field"><input class="input" name="name" placeholder="الاسم" required maxlength="60"></div><div class="field"><input class="input" name="town" placeholder="البلدة (اختياري)" maxlength="60"></div>
                <div class="field full"><textarea class="textarea" name="text" placeholder="شاركنا تجربتك مع المنتج…" required maxlength="1000"></textarea></div></div>
                <button class="btn" style="margin-top:12px">إرسال التقييم</button></form></div></div>
        </section>
        ${related.length ? `<section class="section" style="padding-top:0">${head('منتجات مشابهة', '')}<div class="grid">${related.map(card).join('')}</div></section>` : ''}
      </div>`;

    // المعرض والتكبير
    const gMain = $('#gMain'), gImg = $('#gImg');
    gMain.addEventListener('mousemove', (e) => {
      const r = gMain.getBoundingClientRect();
      gImg.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      gImg.style.transform = 'scale(1.8)';
    });
    gMain.addEventListener('mouseleave', () => { gImg.style.transform = ''; });
    $$('[data-img]').forEach((b) => (b.onclick = () => {
      $$('[data-img]').forEach((x) => x.classList.remove('on')); b.classList.add('on');
      gImg.style.opacity = 0; setTimeout(() => { gImg.src = b.dataset.img; gImg.style.opacity = 1; }, 180);
    }));
    $$('[data-tab]').forEach((b) => (b.onclick = () => {
      $$('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
      $$('[data-pane]').forEach((x) => (x.hidden = x.dataset.pane !== b.dataset.tab));
    }));
    // السعر والمخزون حسب الحجم المختار
    const showOption = () => {
      const o = Commerce.option(p, sel);
      const final = Commerce.applyDiscount(o.price, p.discount);
      $('#pPrice').innerHTML = `<b>${money(final)}</b>${p.discount ? `<s>${money(o.price)}</s><span class="save-pill">وفّر ${money(o.price - final)}</span>` : ''}`;
      const st = $('#pStock');
      st.className = 'stock-line ' + (o.stock <= 0 ? 'out' : o.stock <= lowAt ? 'low' : 'ok');
      st.textContent = o.stock <= 0 ? '✕ نفدت الكمية' + (variants.length ? ' من هذا الحجم' : '') : o.stock <= lowAt ? `⚡ بقي ${o.stock} قطع فقط – اطلب الآن` : '✓ متوفر في المخزون';
      ['#addBtn', '#buyNow'].forEach((id) => { const b = $(id); if (b) b.disabled = o.stock <= 0; });
      return o;
    };
    showOption();
    $$('[data-variant]').forEach((b) => (b.onclick = () => {
      sel = b.dataset.variant;
      $$('[data-variant]').forEach((x) => x.classList.toggle('on', x === b));
      showOption();
      const qv = $('#qVal');
      if (qv) qv.value = Math.max(1, Math.min(Commerce.option(p, sel).stock || 1, +qv.value || 1));
    }));
    if (p.inStock) {
      const qv = $('#qVal');
      const clamp = (v) => Math.max(1, Math.min(Commerce.option(p, sel).stock || 1, parseInt(v, 10) || 1));
      $('#qDec').onclick = () => (qv.value = clamp(+qv.value - 1));
      $('#qInc').onclick = () => (qv.value = clamp(+qv.value + 1));
      qv.onchange = () => (qv.value = clamp(qv.value));
      $('#addBtn').onclick = () => { addToCart(p.id, clamp(qv.value), false, sel); openCart(); };
      $('#buyNow').onclick = () => { addToCart(p.id, clamp(qv.value), true, sel); navigate('#/checkout'); };
    }
    loadReviews(p);
    $('#revForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const r = await api(`/products/${p.id}/reviews`, { body: Object.fromEntries(f) });
        toast(r.approved ? 'شكراً! تم نشر تقييمك' : 'شكراً! سيظهر تقييمك بعد المراجعة');
        e.target.reset();
        if (r.approved) loadReviews(p);
      } catch (err) { toast(err.message, 'err'); }
    };
  }

  async function loadReviews(p) {
    let list = [];
    try { list = await api(`/products/${p.id}/reviews`); } catch { /* تجاهل */ }
    const avg = list.length ? round2(list.reduce((a, r) => a + r.rating, 0) / list.length) : 0;
    const box = $('#revSummary');
    if (!box) return;
    box.innerHTML = `<div class="big">${avg || '–'}</div>${stars(avg)}<div style="color:var(--muted);font-size:.9em">${list.length} تقييم</div>
      <div class="rev-bars">${[5, 4, 3, 2, 1].map((n) => { const c = list.filter((r) => r.rating === n).length; return `<div class="rev-bar"><span>${n}★</span><i><b style="width:${list.length ? (c / list.length) * 100 : 0}%"></b></i><span>${c}</span></div>`; }).join('')}</div>`;
    $('#revList').innerHTML = list.length ? list.map((r) => `<div class="review"><div class="review-head"><div class="testi-who"><span class="avatar">${esc(r.name.trim()[0] || '؟')}</span><div><b>${esc(r.name)}</b><small style="color:var(--muted);display:block">${esc(r.town || '')} • ${new Date(r.createdAt).toLocaleDateString('ar-EG')}</small></div></div>${stars(r.rating)}</div><p style="margin:.6em 0 0">${esc(r.text)}</p></div>`).join('') : '<p style="color:var(--muted)">لا توجد تقييمات بعد.</p>';
  }

  // ---------------------------------------------------------------- إتمام الطلب
  function pageCheckout(app) {
    if (!S.cart.length) {
      app.innerHTML = `<div class="container"><div class="empty" style="padding:100px 0"><div class="big">🧺</div><h2>سلتك فارغة</h2><a class="btn" href="#/shop">تصفح المنتجات</a></div></div>`;
      return;
    }
    const s = S.data.settings;
    const acc = S.account ? S.account.customer : null;
    const saved = acc ? { ...load('jalil-customer', {}), firstName: acc.firstName, lastName: acc.lastName, phone: acc.phone, town: acc.town || load('jalil-customer', {}).town, address: acc.address || load('jalil-customer', {}).address } : load('jalil-customer', {});
    const st = { coupon: '', couponDiscount: 0, location: null };
    app.innerHTML = `
      <section class="page-hero"><div class="container"><div class="crumbs"><a href="#/">الرئيسية</a> / إتمام الطلب</div><h1>إتمام الطلب</h1></div></section>
      <div class="container checkout">
        <form id="coForm" novalidate>
          <div class="panel">
            <h3><span class="num">1</span> معلومات المستلم</h3>
            <div class="form-grid">
              ${field('firstName', 'الاسم الشخصي', saved.firstName, true)}
              ${field('lastName', 'اسم العائلة', saved.lastName, true)}
              ${field('phone', 'رقم الهاتف', saved.phone, true, 'tel', 'مثال: 0501234567', 'dir="ltr" inputmode="tel"')}
              ${field('phone2', 'رقم هاتف إضافي', saved.phone2, false, 'tel', 'اختياري', 'dir="ltr" inputmode="tel"')}
              ${zoneList().length ? `<div class="field"><label>منطقة التوصيل <span class="req">*</span></label><select class="select" name="zone" id="zoneSel"><option value="">— اختر منطقتك —</option>${zoneList().map((z) => `<option value="${esc(z.id)}" ${currentZone() === z.id ? 'selected' : ''}>${esc(z.name)} – ${Number(z.fee) ? money(z.fee) : 'مجاني'}</option>`).join('')}</select></div>` : ''}
              ${field('town', 'البلدة / المدينة', saved.town, true)}
              ${field('address', 'العنوان بالتفصيل', saved.address, true, 'text', 'الحي، الشارع، رقم البيت أو علامة مميزة')}
              <div class="field full"><label>📍 الموقع على الخريطة ${s.shop.requireLocation ? '<span class="req">*</span>' : '<small style="color:var(--muted)">(يساعدنا على الوصول أسرع)</small>'}</label>
                <div class="loc-box" id="locBox"><button type="button" class="btn btn-soft btn-sm" id="locBtn">${ICON.pin} تحديد موقعي الحالي</button><span id="locTxt" style="font-size:.9em;color:var(--muted)">لم يتم تحديد الموقع</span></div>
                <input class="input" name="locationLink" placeholder="أو الصق رابط موقعك من Google Maps / Waze (اختياري)" style="margin-top:8px" dir="ltr" value="${esc(saved.locationLink || '')}"></div>
              <div class="field full"><label>ملاحظات للطلب</label><textarea class="textarea" name="notes" placeholder="مثال: الاتصال قبل الوصول، وقت مفضل للتوصيل…" maxlength="1000"></textarea></div>
            </div>
          </div>
          <div class="panel" style="margin-top:20px">
            ${S.account ? `<div class="acct-note">👤 تطلب من حسابك باسم <b>${esc(S.account.customer.firstName)}</b> – سيظهر الطلب في صفحة <a href="#/account">طلباتي</a>.</div>
              ${S.account.customer.marketing ? '' : '<label class="toggle-row"><input type="checkbox" name="marketing" id="mkChk"> أريد أن يصلني جديد المنتجات والعروض على واتساب</label>'}`
            : `<h3>👤 تابع طلباتك بسهولة <small style="color:var(--muted);font-weight:400;font-size:.7em">(اختياري)</small></h3>
              <label class="toggle-row"><input type="checkbox" id="acctChk"> أنشئ لي حساباً برقم هاتفي لمتابعة طلباتي</label>
              <div class="field" id="acctPwBox" hidden style="max-width:340px;margin:6px 0 4px"><input class="input" type="password" id="acctPw" placeholder="اختر كلمة مرور (6 أحرف على الأقل)" autocomplete="new-password" dir="ltr"><div class="hint">تدخل لاحقاً برقم هاتفك وكلمة المرور هذه. <a href="#/account" style="color:var(--primary)">لديك حساب؟ سجّل الدخول</a></div></div>
              <label class="toggle-row"><input type="checkbox" name="marketing" id="mkChk"> أريد أن يصلني جديد المنتجات والعروض والحملات على واتساب</label>`}
          </div>
          <div class="panel" style="margin-top:20px">
            <h3><span class="num">2</span> طريقة الدفع</h3>
            <div class="pay-option"><span class="ico">💵</span><div><b>الدفع نقداً عند الاستلام</b><div style="font-size:.88em;color:var(--muted)">ادفع بأمان عندما يصلك الطلب – لا حاجة لبطاقة ائتمان</div></div><span style="margin-inline-start:auto;color:var(--primary);font-size:1.4em">✓</span></div>
            <p style="font-size:.9em;color:var(--muted);margin:14px 0 0">ℹ️ ${esc(T('checkoutNote'))} ${esc(s.shop.shippingNote || '')}</p>
          </div>
        </form>
        <div class="sticky-col">
          <div class="panel">
            <h3><span class="num">3</span> ملخص الطلب</h3>
            <div class="summary-items" id="sumItems"></div>
            <div class="coupon-row"><input class="input" id="couponIn" placeholder="كود الخصم" dir="ltr" style="text-transform:uppercase"><button type="button" class="btn btn-soft" id="couponBtn">تطبيق</button></div>
            <div id="couponMsg" style="font-size:.85em"></div>
            <div id="sumTotals"></div>
            <label class="toggle-row" style="margin-top:12px;font-size:.9em"><input type="checkbox" id="confirmChk"> أؤكد صحة المعلومات وأوافق على الدفع عند الاستلام</label>
            <button class="btn btn-block" id="placeBtn" style="margin-top:12px;padding:1.05em">تأكيد الطلب</button>
          </div>
        </div>
      </div>`;

    const renderSummary = () => {
      const t = cartTotals(st.couponDiscount);
      $('#sumItems').innerHTML = t.lines.map((l) => `<div class="summary-item"><img src="${esc(safeUrl(l.image))}" alt=""><div><div>${esc(l.name)}${l.size && Commerce.hasVariants(l.p) ? ` <small class="variant-tag">${esc(l.size)}</small>` : ''}</div><small style="color:var(--muted)">${l.qty} × ${money(l.unitFinal)}</small></div><b>${money(l.lineTotal)}</b></div>`).join('');
      $('#sumTotals').innerHTML = `
        <div class="sum-row"><span>المجموع</span><span>${money(t.subtotal)}</span></div>
        ${t.discount ? `<div class="sum-row discount"><span>خصم المنتجات</span><span>-${money(t.discount)}</span></div>` : ''}
        ${st.couponDiscount ? `<div class="sum-row discount"><span>كوبون (${esc(st.coupon)})</span><span>-${money(st.couponDiscount)}</span></div>` : ''}
        <div class="sum-row"><span>التوصيل${t.needsZone ? '' : ''}</span><span>${t.needsZone ? '<span style="color:var(--muted)">اختر منطقة التوصيل</span>' : t.shipping ? money(t.shipping) : 'مجاني 🎉'}</span></div>
        <div class="sum-row total"><span>الإجمالي للدفع</span><span>${money(t.total)}</span></div>`;
    };
    renderSummary();
    $('#zoneSel')?.addEventListener('change', (e) => { persist('jalil-zone', e.target.value); renderSummary(); renderCart(); const f = e.target.closest('.field'); f.classList.remove('err'); f.querySelector('.err-msg')?.remove(); });

    const applyCoupon = async (code) => {
      try {
        const r = await api('/cart/price', { body: { items: S.cart, coupon: code, zone: currentZone() } });
        if (r.couponError) { st.coupon = ''; st.couponDiscount = 0; $('#couponMsg').innerHTML = `<span style="color:#c0392b">${esc(r.couponError)}</span>`; }
        else { st.coupon = r.couponCode; st.couponDiscount = r.couponDiscount; $('#couponMsg').innerHTML = `<span style="color:#2e8b57">✓ تم تطبيق الكود – وفّرت ${money(r.couponDiscount)}</span>`; }
        renderSummary();
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#acctChk')?.addEventListener('change', (e) => { $('#acctPwBox').hidden = !e.target.checked; if (e.target.checked) $('#acctPw').focus(); });
    $('#couponBtn').onclick = () => { const c = $('#couponIn').value.trim(); if (c) applyCoupon(c); };
    const pending = sessionStorage.getItem('jalil-coupon');
    if (pending) { $('#couponIn').value = pending; applyCoupon(pending); }

    $('#locBtn').onclick = () => {
      if (!navigator.geolocation) return toast('المتصفح لا يدعم تحديد الموقع', 'err');
      $('#locTxt').textContent = 'جارٍ تحديد الموقع…';
      navigator.geolocation.getCurrentPosition((pos) => {
        st.location = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        $('#locBox').classList.add('ok');
        $('#locTxt').innerHTML = `✓ تم تحديد موقعك بدقة ${Math.round(pos.coords.accuracy)} م – <a target="_blank" rel="noopener" style="color:var(--primary)" href="https://maps.google.com/?q=${st.location.lat},${st.location.lng}">عرض على الخريطة</a>`;
      }, () => { $('#locTxt').textContent = 'تعذّر تحديد الموقع – يمكنك لصق رابط الموقع بدلاً من ذلك'; }, { enableHighAccuracy: true, timeout: 15000 });
    };

    $('#placeBtn').onclick = async () => {
      const form = $('#coForm');
      const data = Object.fromEntries(new FormData(form));
      data.phone = normPhone(data.phone);
      data.phone2 = normPhone(data.phone2);
      $$('.field', form).forEach((f) => { f.classList.remove('err'); f.querySelector('.err-msg')?.remove(); });
      const errs = {};
      for (const k of ['firstName', 'lastName', 'town', 'address']) if (!String(data[k] || '').trim()) errs[k] = 'هذا الحقل مطلوب';
      if (!PHONE_RE.test(data.phone)) errs.phone = 'رقم هاتف غير صحيح (10 أرقام تبدأ بـ 05)';
      if (data.phone2 && !PHONE_RE.test(data.phone2)) errs.phone2 = 'رقم غير صحيح';
      if (zoneList().length && !data.zone) errs.zone = 'اختر منطقة التوصيل';
      if (s.shop.requireLocation && !st.location && !data.locationLink) { toast('يرجى تحديد موقعك', 'err'); return; }
      for (const [k, m] of Object.entries(errs)) {
        const f = form.querySelector(`[name="${k}"]`).closest('.field');
        f.classList.add('err'); f.insertAdjacentHTML('beforeend', `<div class="err-msg">${m}</div>`);
      }
      if (Object.keys(errs).length) { form.querySelector('.err .input, .err .select').focus(); toast('يرجى تصحيح الحقول المطلوبة', 'err'); return; }
      const wantAcct = $('#acctChk') && $('#acctChk').checked;
      if (wantAcct && $('#acctPw').value.length < 6) { toast('اختر كلمة مرور للحساب من 6 أحرف على الأقل', 'err'); $('#acctPw').focus(); return; }
      if (!$('#confirmChk').checked) { toast('يرجى تأكيد صحة المعلومات', 'err'); return; }
      const btn = $('#placeBtn');
      btn.disabled = true; btn.textContent = 'جارٍ إرسال الطلب…';
      try {
        const { notes, marketing, zone, ...rest } = data;
        persist('jalil-customer', rest);
        const r = await api('/orders', { body: { items: S.cart, coupon: st.coupon, zone: data.zone || '', marketing: Boolean($('#mkChk') && $('#mkChk').checked), createAccount: wantAcct ? { password: $('#acctPw').value } : null, customer: { ...data, location: st.location } } });
        rememberOrder(r.number, data.phone);
        if (r.accountCreated || S.account) await refreshAccount();
        const t = cartTotals(st.couponDiscount);
        persist('jalil-last-order', { number: r.number, total: r.total, phone: data.phone, items: t.lines.map((l) => ({ name: l.name, qty: l.qty })) }, sessionStorage);
        S.cart = []; saveCart();
        sessionStorage.removeItem('jalil-coupon');
        navigate('#/success/' + r.number);
      } catch (e) {
        toast(e.message, 'err');
        btn.disabled = false; btn.textContent = 'تأكيد الطلب';
      }
    };
  }

  function field(name, label, value, req, type = 'text', hint = '', attrs = '') {
    return `<div class="field"><label>${label} ${req ? '<span class="req">*</span>' : ''}</label><input class="input" type="${type}" name="${name}" value="${esc(value || '')}" ${hint ? `placeholder="${esc(hint)}"` : ''} ${attrs} ${req ? 'required' : ''} maxlength="300"></div>`;
  }

  function pageSuccess(app, q, number) {
    const o = load('jalil-last-order', {}, sessionStorage);
    const wa = waLink(`مرحباً، قمت بطلب رقم #${number} من متجر ${S.data.settings.storeName}${o.total ? ` بقيمة ${money(o.total)}` : ''}`);
    app.innerHTML = `<div class="container"><div class="success panel">
      <div class="check-anim"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h1>تم استلام طلبك بنجاح!</h1>
      <div class="order-num">#${esc(number)}</div>
      <p>${esc(T('orderSuccess'))}</p>
      ${o.total ? `<p><b>المبلغ للدفع عند الاستلام: ${money(o.total)}</b></p>` : ''}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px">
        <a class="btn" href="#/account">📦 طلباتي</a>
        <a class="btn btn-soft" href="#/track?number=${esc(number)}&phone=${esc(o.phone || '')}">تتبع هذا الطلب</a>
        ${wa ? `<a class="btn btn-wa" target="_blank" rel="noopener" href="${esc(wa)}">${ICON.wa} تواصل عبر واتساب</a>` : ''}
        <a class="btn btn-soft" href="#/shop">متابعة التسوق</a>
      </div></div></div>`;
    confetti();
  }

  function confetti() {
    const colors = [S.data.settings.colors.primary, S.data.settings.colors.accent, '#e0475b', '#2e8b57'];
    for (let i = 0; i < 70; i++) {
      const d = document.createElement('i');
      d.style.cssText = `position:fixed;z-index:200;top:-12px;left:${Math.random() * 100}vw;width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px;background:${colors[i % colors.length]};border-radius:2px;pointer-events:none;transition:transform ${2 + Math.random() * 2}s cubic-bezier(.2,.6,.3,1),opacity 1s ${2.5 + Math.random()}s;`;
      document.body.append(d);
      requestAnimationFrame(() => { d.style.transform = `translate(${(Math.random() - 0.5) * 200}px, ${100 + Math.random() * 10}vh) rotate(${Math.random() * 720}deg)`; d.style.opacity = '0'; });
      setTimeout(() => d.remove(), 4500);
    }
  }

  // ---------------------------------------------------------------- تتبع الطلب
  function pageTrack(app, q) {
    app.innerHTML = `<section class="page-hero"><div class="container"><h1>تتبع طلبك</h1><p style="color:var(--muted)">أدخل رقم الطلب ورقم الهاتف الذي استعملته عند الطلب</p></div></section>
      <div class="container" style="max-width:640px;padding-bottom:80px"><form class="panel" id="trackForm"><div class="form-grid">
        ${field('number', 'رقم الطلب', q.get('number'), true, 'text', 'مثال: 1001', 'dir="ltr" inputmode="numeric"')}
        ${field('phone', 'رقم الهاتف', q.get('phone'), true, 'tel', '05XXXXXXXX', 'dir="ltr" inputmode="tel"')}</div>
        <button class="btn btn-block" style="margin-top:14px">بحث</button></form><div id="trackRes" style="margin-top:20px"></div></div>`;
    const run = async () => {
      const f = Object.fromEntries(new FormData($('#trackForm')));
      try {
        const o = await api(`/track?number=${encodeURIComponent(f.number.replace(/\D/g, ''))}&phone=${encodeURIComponent(normPhone(f.phone))}`);
        const steps = [['new', 'تم استلام الطلب'], ['confirmed', 'تم التأكيد'], ['preparing', 'قيد التحضير'], ['shipped', 'في الطريق إليك'], ['delivered', 'تم التسليم']];
        const idx = steps.findIndex(([k]) => k === o.status);
        $('#trackRes').innerHTML = `<div class="panel"><h3>طلب #${o.number} – ${esc(o.statusLabel)}</h3>
          <p style="color:var(--muted)">${new Date(o.createdAt).toLocaleString('ar-EG')} • الإجمالي ${money(o.total)}</p>
          ${o.status === 'cancelled' ? '<div class="warn-box">تم إلغاء هذا الطلب. للاستفسار تواصل معنا.</div>' : `<div class="timeline">${steps.map(([k, t], i) => `<div class="tl-step ${i <= idx ? 'done' : ''}"><span class="tl-dot">${i <= idx ? '✓' : i + 1}</span><div style="padding-top:5px"><b>${t}</b></div></div>`).join('')}</div>`}
          <p style="font-size:.9em">${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join(' • ')}</p></div>`;
      } catch (e) { $('#trackRes').innerHTML = `<div class="panel" style="text-align:center">😕 ${esc(e.message)}</div>`; }
    };
    $('#trackForm').onsubmit = (e) => { e.preventDefault(); run(); };
    if (q.get('number') && q.get('phone')) run();
  }

  // ---------------------------------------------------------------- المستشار الذكي
  function pageAdvisor(app) {
    const s = S.data.settings;
    const name = s.ai.assistantName || 'حكيم الجليل';
    if (!S.data.aiAvailable) {
      app.innerHTML = `<div class="container"><div class="empty" style="padding:100px 0"><div class="big">🌿</div><h2>${esc(name)} غير متاح حالياً</h2><p>يمكنك التواصل معنا مباشرة وسنساعدك باختيار الخلطة المناسبة.</p>${waLink() ? `<a class="btn btn-wa" target="_blank" rel="noopener" href="${esc(waLink('مرحباً، أريد استشارة بخصوص خلطة أعشاب'))}">${ICON.wa} تواصل عبر واتساب</a>` : ''}</div></div>`;
      return;
    }
    app.innerHTML = `<div class="advisor-page"><div class="container"><div class="chat-shell">
      <aside class="chat-side">
        <div class="sage-card"><div class="sage-avatar">🌿</div><h3 style="margin:0">${esc(name)}</h3><small style="color:var(--muted)">مستشار الأعشاب والطب البديل</small></div>
        <div class="tips">
          <div>💬 <span>احكِ عن حالتك بالتفصيل: العمر، الأعراض، ومنذ متى.</span></div>
          <div>🩺 <span>اذكر إن كنتِ حاملاً أو مرضعة، أو لديك أمراض مزمنة أو أدوية.</span></div>
          <div>🍵 <span>ستحصل على خلطة طبيعية مع الكميات وطريقة التحضير.</span></div>
          <div>📦 <span>إذا أعجبتك الخلطة، نحضّرها لك ونوصلها لبيتك.</span></div>
        </div>
        <button class="btn btn-soft btn-sm" id="newChat">✨ محادثة جديدة</button>
        <p style="font-size:.78em;color:var(--muted);margin-top:auto">⚕️ ${esc(T('medicalDisclaimer'))}</p>
      </aside>
      <section class="chat-main">
        <div class="chat-head"><div class="sage-avatar">🌿</div><div><b>${esc(name)}</b><small>متصل الآن • يرد خلال ثوانٍ</small></div>
          <button class="icon-btn" id="newChat2" style="margin-inline-start:auto" title="محادثة جديدة" aria-label="محادثة جديدة"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button></div>
        <div class="chat-log" id="chatLog" aria-live="polite"></div>
        <div class="quick-replies" id="quickReplies"></div>
        <form class="chat-input" id="chatForm"><textarea id="chatIn" rows="1" placeholder="اكتب سؤالك هنا… مثال: بدي خلطة طبيعية للتنحيف" maxlength="2000"></textarea><button class="send-btn" aria-label="إرسال">${ICON.send}</button></form>
        <div class="chat-disclaimer">الوصفات للتثقيف ولا تغني عن استشارة الطبيب</div>
      </section></div></div></div>`;

    const log = $('#chatLog');
    const input = $('#chatIn');
    renderChatLog();
    const reset = () => { S.chat = []; persist('jalil-chat', S.chat, sessionStorage); renderChatLog(); };
    $('#newChat').onclick = reset;
    $('#newChat2').onclick = reset;
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px'; });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } });
    $('#chatForm').onsubmit = (e) => { e.preventDefault(); const t = input.value.trim(); if (t) { input.value = ''; input.style.height = 'auto'; sendChat(t); } };
    log.addEventListener('click', onChatClick);
    $('#quickReplies').addEventListener('click', (e) => { const b = e.target.closest('[data-qr]'); if (b) sendChat(b.dataset.qr); });
    setTimeout(() => input.focus({ preventScroll: true }), 300);
  }

  function renderChatLog() {
    const log = $('#chatLog');
    if (!log) return;
    const s = S.data.settings;
    let html = botBubble(s.ai.welcome);
    S.chat.forEach((m, i) => {
      if (m.role === 'user') html += `<div class="msg user"><div class="bubble">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`;
      else {
        html += botBubble(m.content);
        if (m.products && m.products.length) html += recProducts(m.products);
        if (m.offer) html += offerCard(m.offer, i, m.offerState);
      }
    });
    log.innerHTML = html;
    const last = S.chat[S.chat.length - 1];
    const qrs = !S.chat.length ? s.ai.suggestions : last && last.role === 'assistant' ? last.quick || [] : [];
    $('#quickReplies').innerHTML = qrs.map((q) => `<button data-qr="${esc(q)}">${esc(q)}</button>`).join('');
    log.scrollTop = log.scrollHeight;
  }

  const botBubble = (text) => `<div class="msg bot"><span class="mini-avatar">🌿</span><div class="bubble">${md(text)}</div></div>`;

  // تحويل بسيط وآمن لتنسيق Markdown
  function md(text) {
    const lines = esc(text).split('\n');
    let out = '', list = null;
    const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
    const close = () => { if (list) { out += `</${list}>`; list = null; } };
    for (const raw of lines) {
      const l = raw.trim();
      let m;
      if (!l) { close(); continue; }
      if ((m = l.match(/^#{1,4}\s+(.*)/))) { close(); out += `<h4>${inline(m[1])}</h4>`; }
      else if ((m = l.match(/^[-•*]\s+(.*)/))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
      else if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
      else { close(); out += `<p>${inline(l)}</p>`; }
    }
    close();
    return out;
  }

  function recProducts(ids) {
    const ps = ids.map(product).filter(Boolean);
    if (!ps.length) return '';
    return `<div class="rec-products">${ps.map((p) => `<div class="rec-card"><a href="#/product/${encodeURIComponent(p.slug)}"><img src="${esc(safeUrl(p.images[0]))}" alt=""></a><div><a href="#/product/${encodeURIComponent(p.slug)}">${esc(p.name)}</a><b>${money(p.finalPrice)}</b>${p.inStock ? `<button class="btn btn-sm" data-add="${p.id}">${ICON.plus} للسلة</button>` : '<small>غير متوفر</small>'}</div></div>`).join('')}</div>`;
  }

  function offerCard(o, idx, state = {}) {
    const saved = load('jalil-customer', {});
    const ingredients = (o.ingredients || []).map((i) => `<div><b>${esc(i.name)}</b><span>${esc(i.amount)}</span></div>`).join('');
    let foot;
    if (state.done) foot = `<div class="offer-done">✅ تم إرسال طلب الخلطة رقم <b>#${esc(state.number)}</b><br>سيتواصل معك فريقنا قريباً لتأكيد التفاصيل والسعر.</div>`;
    else if (state.declined) foot = `<div class="offer-done" style="color:var(--muted)">لا مشكلة 🌿 يمكنك تحضيرها بنفسك، أو طلبها لاحقاً.<br><button class="btn btn-soft btn-sm" data-offer-yes="${idx}" style="margin-top:8px">غيّرت رأيي، أريدها</button></div>`;
    else if (state.form) foot = `<form class="offer-form" data-offer-form="${idx}">
        <b>أكمل بياناتك لنحضّر لك الخلطة:</b>
        <div class="form-grid">
          <input class="input" name="firstName" placeholder="الاسم *" value="${esc(saved.firstName || '')}" required maxlength="60">
          <input class="input" name="lastName" placeholder="العائلة *" value="${esc(saved.lastName || '')}" required maxlength="60">
          <input class="input" name="town" placeholder="البلدة *" value="${esc(saved.town || '')}" required maxlength="80">
          <input class="input" name="phone" placeholder="رقم الهاتف *" value="${esc(saved.phone || '')}" required dir="ltr" inputmode="tel" maxlength="20">
          <textarea class="textarea full" name="notes" placeholder="ملاحظات إضافية (اختياري)" style="min-height:60px" maxlength="1000"></textarea>
        </div>
        <div style="display:flex;gap:8px"><button class="btn" style="flex:1">إرسال الطلب</button><button type="button" class="btn btn-soft" data-offer-cancel="${idx}">إلغاء</button></div>
      </form>`;
    else foot = `<div class="offer-actions"><button class="btn btn-accent" data-offer-yes="${idx}" style="flex:1">✓ موافق، أريد هذه الخلطة</button><button class="btn btn-soft" data-offer-no="${idx}">لا، شكراً</button></div>`;
    return `<div class="offer-card"><div class="offer-head"><small>🍵 خلطة مقترحة لك</small><h4>${esc(o.title || 'خلطة طبيعية')}</h4>${o.purpose ? `<small>${esc(o.purpose)}</small>` : ''}</div>
      <div class="offer-body">${ingredients ? `<div class="ing-list">${ingredients}</div>` : ''}
        ${o.preparation ? `<div><b>التحضير:</b> ${esc(o.preparation)}</div>` : ''}
        ${o.usage ? `<div><b>الاستعمال:</b> ${esc(o.usage)}</div>` : ''}
        ${o.duration ? `<div><b>المدة:</b> ${esc(o.duration)}</div>` : ''}
        ${o.warnings ? `<div class="warn-box" style="font-size:.92em">⚠️ ${esc(o.warnings)}</div>` : ''}</div>${foot}</div>`;
  }

  function setOfferState(idx, patch) {
    const m = S.chat[idx];
    m.offerState = { ...(m.offerState || {}), ...patch };
    persist('jalil-chat', S.chat, sessionStorage);
    const log = $('#chatLog');
    const keep = log.scrollTop;
    renderChatLog();
    log.scrollTop = keep;
  }

  async function onChatClick(e) {
    const t = e.target;
    let el;
    if ((el = t.closest('[data-offer-yes]'))) setOfferState(+el.dataset.offerYes, { form: true, declined: false });
    else if ((el = t.closest('[data-offer-no]'))) setOfferState(+el.dataset.offerNo, { declined: true });
    else if ((el = t.closest('[data-offer-cancel]'))) setOfferState(+el.dataset.offerCancel, { form: false });
    if ((el = t.closest('[data-offer-form]')) && t.matches('button:not([type=button])')) {
      e.preventDefault();
      const idx = +el.dataset.offerForm;
      const data = Object.fromEntries(new FormData(el));
      data.phone = normPhone(data.phone);
      if (!data.firstName || !data.lastName || !data.town) return toast('يرجى تعبئة الاسم والعائلة والبلدة', 'err');
      if (!PHONE_RE.test(data.phone)) return toast('رقم الهاتف غير صحيح (مثال: 0501234567)', 'err');
      const btn = t; btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
      try {
        const r = await api('/blend-requests', { body: { customer: data, blend: S.chat[idx].offer, conversation: chatPayload() } });
        persist('jalil-customer', { ...load('jalil-customer', {}), firstName: data.firstName, lastName: data.lastName, town: data.town, phone: data.phone });
        setOfferState(idx, { done: true, form: false, number: r.number });
        toast('✅ تم إرسال طلب الخلطة بنجاح');
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'إرسال الطلب'; }
    }
  }

  const chatPayload = () => S.chat.filter((m) => !m.failed && !m.error).map(({ role, content }) => ({ role, content }));

  async function sendChat(text) {
    if (S.chatBusy) return;
    S.chatBusy = true;
    S.chat.push({ role: 'user', content: text });
    persist('jalil-chat', S.chat, sessionStorage);
    renderChatLog();
    const log = $('#chatLog');
    log.insertAdjacentHTML('beforeend', '<div class="msg bot" id="typing"><span class="mini-avatar">🌿</span><div class="bubble typing"><i></i><i></i><i></i></div></div>');
    log.scrollTop = log.scrollHeight;
    $('#quickReplies').innerHTML = '';
    try {
      const r = await api('/chat', { body: { messages: chatPayload() } });
      S.chat.push({ role: 'assistant', content: r.reply, offer: r.offer, products: r.product_ids, quick: r.quick_replies });
    } catch (e) {
      // نعلّم الرسالة الفاشلة حتى لا تُرسل مع المحادثة لاحقاً
      S.chat[S.chat.length - 1].failed = true;
      S.chat.push({ role: 'assistant', content: '⚠️ ' + e.message, error: true, quick: [text] });
    }
    persist('jalil-chat', S.chat, sessionStorage);
    S.chatBusy = false;
    if ($('#chatLog')) renderChatLog();
  }

  // ---------------------------------------------------------------- المقالات والنصائح
  const articleUrl = (a) => `${location.origin}/blog/${encodeURIComponent(a.slug)}`;
  const fmtDate = (t) => new Date(t).toLocaleDateString('ar-EG', { dateStyle: 'long' });

  function articleCard(a) {
    return `<a class="article-card reveal" href="#/blog/${encodeURIComponent(a.slug)}">
      <div class="article-img">${a.image ? `<img src="${esc(safeUrl(a.image))}" alt="" loading="lazy">` : ''}</div>
      <div class="article-body"><small>${fmtDate(a.createdAt)}</small><h3>${esc(a.title)}</h3><p>${esc(a.excerpt)}</p><span class="link-more">اقرأ المزيد ${ICON.arrow}</span></div></a>`;
  }

  function pageBlog(app) {
    const list = S.data.articles || [];
    app.innerHTML = `<section class="page-hero"><div class="container"><div class="crumbs"><a href="#/">الرئيسية</a> / نصائح ومقالات</div><h1>${esc(T('articlesTitle') || 'نصائح ومقالات')}</h1><p style="color:var(--muted);margin:.3em 0 0">${esc(T('articlesSubtitle'))}</p></div></section>
      <div class="container" style="padding-bottom:80px">${list.length ? `<div class="articles-grid">${list.map(articleCard).join('')}</div>` : '<div class="empty"><div class="big">📝</div><p>لا توجد مقالات بعد</p></div>'}</div>`;
  }

  async function pageArticle(app, q, slug) {
    const summary = (S.data.articles || []).find((a) => a.slug === slug);
    if (!summary) return page404(app);
    app.innerHTML = `<div class="container"><div class="skeleton" style="height:420px;margin:40px 0"></div></div>`;
    let a;
    try { a = await api('/articles/' + encodeURIComponent(slug)); } catch { return page404(app); }
    if (parseHash().path !== '/blog/' + slug) return; // انتقل الزائر لصفحة أخرى أثناء التحميل
    document.title = `${a.title} | ${S.data.settings.storeName}`;
    const prods = (a.productIds || []).map(product).filter(Boolean);
    const more = (S.data.articles || []).filter((x) => x.slug !== slug).slice(0, 3);
    const share = `${a.title}\n${articleUrl(a)}`;
    app.innerHTML = `<article class="article container">
        <div class="crumbs" style="padding-top:22px"><a href="#/">الرئيسية</a> / <a href="#/blog">نصائح ومقالات</a></div>
        <header class="article-head"><small>${fmtDate(a.createdAt)}</small><h1>${esc(a.title)}</h1><p class="lead">${esc(a.excerpt)}</p></header>
        ${a.image ? `<div class="article-hero"><img src="${esc(safeUrl(a.image))}" alt=""></div>` : ''}
        <div class="article-content prose">${md(a.content)}</div>
        <div class="article-share"><span>شارك المقال:</span><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(share)}">${ICON.wa} واتساب</a><a class="btn btn-soft btn-sm" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl(a))}">فيسبوك</a><button class="btn btn-soft btn-sm" data-copy-link="${esc(articleUrl(a))}">🔗 نسخ الرابط</button></div>
        <p class="disclaimer-note">⚕️ ${esc(T('medicalDisclaimer'))}</p>
      </article>
      ${prods.length ? `<section class="section container" style="padding-top:20px">${head('منتجات ذكرناها في المقال', '')}<div class="grid">${prods.map(card).join('')}</div></section>` : ''}
      ${more.length ? `<section class="section container" style="padding-top:0">${head('اقرأ أيضاً', '', '#/blog')}<div class="articles-grid">${more.map(articleCard).join('')}</div></section>` : ''}
      ${S.data.aiAvailable ? `<section class="container" style="padding-bottom:60px"><div class="advisor-banner"><div><h2>عندك سؤال عن حالتك؟</h2><p>اسأل ${esc(S.data.settings.ai.assistantName)} واحصل على خلطة طبيعية تناسبك.</p><a class="btn btn-accent" href="#/advisor">${esc(T('advisorButton'))}</a></div></div></section>` : ''}`;
    observeReveal();
  }

  // ---------------------------------------------------------------- حسابي وطلباتي
  function rememberOrder(number, phone) {
    S.myOrders = [{ number, phone }, ...S.myOrders.filter((o) => o.number !== number)].slice(0, 30);
    persist('jalil-my-orders', S.myOrders);
  }

  async function refreshAccount() {
    S.accountAt = Date.now();
    try { S.account = await api('/account'); } catch { S.account = null; }
    updateAccountBadge();
    return S.account;
  }

  // شارة على أيقونة الحساب عند وجود عروض جديدة لم يرها الزبون
  function updateAccountBadge() {
    const b = $('#acctBadge');
    if (!b) return;
    const seen = load('jalil-seen-campaigns', []);
    const fresh = S.account ? S.account.campaigns.filter((k) => !seen.includes(k.id)).length : 0;
    b.hidden = !fresh;
    b.textContent = fresh;
  }

  const STATUS_STEPS = [['new', 'تم الاستلام'], ['confirmed', 'تم التأكيد'], ['preparing', 'قيد التحضير'], ['shipped', 'في الطريق'], ['delivered', 'تم التسليم']];

  function orderCard(o) {
    const idx = STATUS_STEPS.findIndex(([k]) => k === o.status);
    return `<details class="order-card">
      <summary>
        <div><b>طلب #${o.number}</b><small>${new Date(o.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' })} • ${o.items.reduce((a, i) => a + i.qty, 0)} قطعة</small></div>
        <span class="st-pill st-${esc(o.status)}">${esc(o.statusLabel)}</span>
        <b class="order-total">${money(o.total)}</b>
      </summary>
      <div class="order-body">
        ${o.status === 'cancelled' ? '<div class="warn-box">تم إلغاء هذا الطلب. للاستفسار تواصل معنا.</div>' : `<div class="steps">${STATUS_STEPS.map(([k, t], i) => `<div class="step ${i <= idx ? 'done' : ''}"><i>${i <= idx ? '✓' : i + 1}</i><span>${t}</span></div>`).join('')}</div>`}
        <div class="order-items">${o.items.map((i) => `<div><img src="${esc(safeUrl(i.image))}" alt=""><span>${esc(i.name)} × ${i.qty}</span><b>${money(i.lineTotal)}</b></div>`).join('')}</div>
        <div class="sum-row"><span>التوصيل</span><span>${o.shipping ? money(o.shipping) : 'مجاني'}</span></div>
        <div class="sum-row total"><span>المبلغ عند الاستلام</span><span>${money(o.total)}</span></div>
      </div></details>`;
  }

  function campaignCards(list) {
    if (!list.length) return '';
    return `<div class="camp-grid">${list.map((k) => `<article class="camp-card">${k.image ? `<img src="${esc(safeUrl(k.image))}" alt="">` : ''}<div><small>${new Date(k.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}</small><h4>${esc(k.title)}</h4><p>${esc(k.text).replace(/\n/g, '<br>')}</p>${k.link ? `<a class="btn btn-sm" href="${esc(safeUrl(k.link))}">${esc(k.linkText || 'شاهد الآن')}</a>` : ''}</div></article>`).join('')}</div>`;
  }

  async function pageAccount(app) {
    app.innerHTML = `<section class="page-hero"><div class="container"><h1>👤 حسابي وطلباتي</h1></div></section><div class="container" style="padding-bottom:80px" id="acctBox"><div class="skeleton" style="height:200px"></div></div>`;
    await refreshAccount();
    const box = $('#acctBox');
    if (!box) return;
    if (S.account) return renderLoggedIn(box);

    // زائر: طلبات هذا الجهاز + دخول / إنشاء حساب
    let local = { orders: [], campaigns: [] };
    if (S.myOrders.length) { try { local = await api('/my-orders', { body: { refs: S.myOrders } }); } catch { /* تجاهل */ } }
    box.innerHTML = `<div class="acct-layout">
      <div>
        <div class="panel"><h3>📦 طلباتك على هذا الجهاز</h3>
          ${local.orders.length ? `<div class="orders-list">${local.orders.map(orderCard).join('')}</div>` : '<p style="color:var(--muted)">لا توجد طلبات محفوظة على هذا الجهاز. إذا طلبت من جهاز آخر، استعمل <a href="#/track" style="color:var(--primary)">تتبع الطلب</a> أو سجّل الدخول لحسابك.</p>'}
        </div>
      </div>
      <div class="panel acct-auth">
        <div class="tab-btns"><button class="on" data-auth="login">تسجيل الدخول</button><button data-auth="register">حساب جديد</button></div>
        <form id="loginForm" class="auth-form">
          <p style="color:var(--muted);margin:0">ادخل برقم هاتفك لمتابعة كل طلباتك والعروض الخاصة بك.</p>
          ${field('phone', 'رقم الهاتف', load('jalil-customer', {}).phone, true, 'tel', '05XXXXXXXX', 'dir="ltr" inputmode="tel" autocomplete="tel"')}
          ${field('password', 'كلمة المرور', '', true, 'password', '', 'dir="ltr" autocomplete="current-password"')}
          <button class="btn btn-block">دخول</button>
          ${waLink() ? `<a class="forgot-link" target="_blank" rel="noopener" href="${esc(waLink('مرحباً، نسيت كلمة المرور لحسابي في المتجر. رقم هاتفي: '))}">نسيت كلمة المرور؟ راسلنا على واتساب</a>` : ''}
        </form>
        <form id="regForm" class="auth-form" hidden>
          <p style="color:var(--muted);margin:0">الحساب اختياري: يحفظ كل طلباتك في مكان واحد، ويوصلك جديد المنتجات والعروض.</p>
          <div class="form-grid">${field('firstName', 'الاسم', load('jalil-customer', {}).firstName, true)}${field('lastName', 'العائلة', load('jalil-customer', {}).lastName, true)}</div>
          ${field('phone', 'رقم الهاتف', load('jalil-customer', {}).phone, true, 'tel', '05XXXXXXXX', 'dir="ltr" inputmode="tel" autocomplete="tel"')}
          ${field('town', 'البلدة', load('jalil-customer', {}).town, false)}
          ${field('password', 'كلمة المرور (6 أحرف على الأقل)', '', true, 'password', '', 'dir="ltr" autocomplete="new-password"')}
          <label class="toggle-row"><input type="checkbox" name="marketing" checked> أريد أن يصلني جديد المنتجات والعروض والحملات على واتساب</label>
          <button class="btn btn-block">إنشاء الحساب</button>
        </form>
      </div></div>`;
    $$('[data-auth]', box).forEach((b) => (b.onclick = () => {
      $$('[data-auth]', box).forEach((x) => x.classList.toggle('on', x === b));
      $('#loginForm').hidden = b.dataset.auth !== 'login';
      $('#regForm').hidden = b.dataset.auth !== 'register';
    }));
    const submit = (form, path) => (form.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      d.phone = normPhone(d.phone);
      d.marketing = Boolean(form.querySelector('[name=marketing]')?.checked);
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        S.account = await api(path, { body: d });
        // ربط طلبات هذا الجهاز بنفس الرقم تلقائياً
        for (const ref of S.myOrders.filter((x) => x.phone === d.phone)) { try { S.account = await api('/account/link-order', { body: ref }); } catch { /* مرتبط مسبقاً */ } }
        toast(path.endsWith('register') ? '🎉 تم إنشاء حسابك' : 'أهلاً بعودتك 🌿');
        updateAccountBadge();
        renderLoggedIn(box);
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
    });
    submit($('#loginForm'), '/account/login');
    submit($('#regForm'), '/account/register');
  }

  function renderLoggedIn(box) {
    const { customer: c, orders, campaigns } = S.account;
    const seen = load('jalil-seen-campaigns', []);
    persist('jalil-seen-campaigns', [...new Set([...seen, ...campaigns.map((k) => k.id)])]);
    updateAccountBadge();
    box.innerHTML = `<div class="acct-hello panel"><span class="avatar" style="width:56px;height:56px;font-size:1.4em">${esc(c.firstName[0] || '؟')}</span>
        <div><h3 style="margin:0">أهلاً ${esc(c.firstName)} 🌿</h3><small style="color:var(--muted)" dir="ltr">${esc(c.phone)}</small></div>
        <button class="btn btn-soft btn-sm" id="logoutBtn" style="margin-inline-start:auto">تسجيل الخروج</button></div>
      <div class="acct-layout">
        <div>
          <div class="panel"><h3>📦 طلباتي (${orders.length})</h3>
            ${orders.length ? `<div class="orders-list">${orders.map(orderCard).join('')}</div>` : '<p style="color:var(--muted)">لا توجد طلبات في حسابك بعد. <a href="#/shop" style="color:var(--primary)">ابدأ التسوق</a></p>'}
            <details style="margin-top:12px"><summary style="cursor:pointer;color:var(--primary);font-weight:700">طلبت قبل إنشاء الحساب؟ أضف الطلب لحسابك</summary>
              <form id="linkForm" class="form-grid" style="margin-top:10px">${field('number', 'رقم الطلب', '', true, 'text', '1001', 'dir="ltr" inputmode="numeric"')}${field('phone', 'رقم الهاتف المستعمل بالطلب', c.phone, true, 'tel', '', 'dir="ltr"')}<button class="btn btn-sm">إضافة</button></form></details>
          </div>
          ${campaigns.length ? `<div class="panel" style="margin-top:20px"><h3>🎁 جديدنا وعروضنا</h3>${campaignCards(campaigns)}</div>` : ''}
        </div>
        <form class="panel" id="profileForm"><h3>⚙️ بياناتي</h3>
          <div class="form-grid">${field('firstName', 'الاسم', c.firstName, true)}${field('lastName', 'العائلة', c.lastName, true)}</div>
          ${field('town', 'البلدة', c.town, false)}${field('address', 'العنوان', c.address, false)}
          <label class="toggle-row" style="margin:10px 0"><input type="checkbox" name="marketing" ${c.marketing ? 'checked' : ''}> أريد أن يصلني جديد المنتجات والعروض على واتساب</label>
          <details><summary style="cursor:pointer;color:var(--primary);font-weight:700">تغيير كلمة المرور</summary>
            ${field('current', 'كلمة المرور الحالية', '', false, 'password', '', 'dir="ltr" autocomplete="current-password"')}${field('password', 'كلمة المرور الجديدة', '', false, 'password', '', 'dir="ltr" autocomplete="new-password"')}</details>
          <button class="btn btn-block" style="margin-top:14px">حفظ</button>
        </form>
      </div>`;
    $('#logoutBtn').onclick = async () => { await api('/account/logout', { body: {} }).catch(() => {}); S.account = null; updateAccountBadge(); toast('تم تسجيل الخروج'); pageAccount($('#app')); };
    $('#profileForm').onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      d.marketing = e.target.querySelector('[name=marketing]').checked;
      try { S.account = await api('/account', { method: 'PUT', body: d }); toast('✓ تم حفظ بياناتك'); renderLoggedIn(box); } catch (err) { toast(err.message, 'err'); }
    };
    $('#linkForm').onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      try { S.account = await api('/account/link-order', { body: { number: d.number.replace(/\D/g, ''), phone: normPhone(d.phone) } }); toast('✓ تمت إضافة الطلب لحسابك'); renderLoggedIn(box); } catch (err) { toast(err.message, 'err'); }
    };
  }

  // ---------------------------------------------------------------- صفحات أخرى
  function pageFavorites(app) {
    const list = S.favs.map(product).filter(Boolean);
    app.innerHTML = `<section class="page-hero"><div class="container"><h1>❤ المفضلة</h1></div></section><div class="container" style="padding-bottom:80px">
      ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<div class="empty"><div class="big">🤍</div><p>لم تضف أي منتج للمفضلة بعد</p><a class="btn" href="#/shop">تصفح المنتجات</a></div>`}</div>`;
  }

  function pageAbout(app) {
    app.innerHTML = `<section class="page-hero"><div class="container"><h1>${esc(T('aboutTitle'))}</h1></div></section>
      <div class="container" style="padding-bottom:80px"><div class="panel prose reveal">${esc(T('aboutContent')).split('\n').filter(Boolean).map((p) => `<p>${p}</p>`).join('')}</div>
      <div class="features-grid reveal" style="margin-top:30px">${S.data.settings.home.features.map((f) => `<div class="feature"><div class="feature-icon">${esc(f.icon)}</div><div><h4>${esc(f.title)}</h4><p>${esc(f.text)}</p></div></div>`).join('')}</div></div>`;
  }

  function pageContact(app) {
    const c = S.data.settings.contact;
    const cards = [
      c.whatsapp && ['💬', 'واتساب', 'راسلنا مباشرة', waLink('مرحباً')],
      c.phone && ['📞', 'اتصل بنا', c.phone, 'tel:' + c.phone],
      c.email && ['✉️', 'البريد الإلكتروني', c.email, 'mailto:' + c.email],
      c.address && ['📍', 'العنوان', c.address, c.mapsUrl || ''],
      c.hours && ['🕘', 'ساعات العمل', c.hours, ''],
    ].filter(Boolean);
    app.innerHTML = `<section class="page-hero"><div class="container"><h1>تواصل معنا</h1><p style="color:var(--muted)">يسعدنا خدمتك والإجابة عن جميع استفساراتك</p></div></section>
      <div class="container" style="padding-bottom:80px"><div class="contact-cards">${cards.map(([i, t, v, h]) => `<${h ? `a href="${esc(safeUrl(h))}" target="_blank" rel="noopener"` : 'div'} class="contact-card reveal"><span>${i}</span><b>${esc(t)}</b><span style="font-size:1em;color:var(--muted)" dir="auto">${esc(v)}</span></${h ? 'a' : 'div'}>`).join('')}</div></div>`;
  }

  function page404(app) {
    app.innerHTML = `<div class="container"><div class="empty" style="padding:120px 0"><div class="big">🍃</div><h2>الصفحة غير موجودة</h2><a class="btn" href="#/">العودة للرئيسية</a></div></div>`;
  }

  // ---------------------------------------------------------------- البحث
  function openSearch() {
    $('#searchOverlay').hidden = false;
    const inp = $('#searchInput');
    inp.value = '';
    $('#searchResults').innerHTML = '';
    setTimeout(() => inp.focus(), 50);
  }
  function runSearch() {
    const q = $('#searchInput').value.trim().toLowerCase();
    if (!q) { $('#searchResults').innerHTML = ''; return; }
    const res = S.data.products.filter((p) => (p.name + ' ' + p.shortDesc + ' ' + p.ingredients).toLowerCase().includes(q)).slice(0, 8);
    $('#searchResults').innerHTML = res.length
      ? res.map((p) => `<a href="#/product/${encodeURIComponent(p.slug)}" data-close-search><img src="${esc(safeUrl(p.images[0]))}" alt=""><div><b>${esc(p.name)}</b><div style="font-size:.85em;color:var(--muted)">${esc(p.shortDesc)}</div></div><b style="color:var(--primary)">${money(p.finalPrice)}</b></a>`).join('') +
        `<a href="#/shop?q=${encodeURIComponent(q)}" data-close-search style="display:block;text-align:center;color:var(--primary);font-weight:700">عرض كل النتائج ←</a>`
      : `<div class="empty" style="padding:30px">لا نتائج لـ "${esc(q)}"${S.data.aiAvailable ? `<br><a class="btn btn-sm" style="margin-top:12px" href="#/advisor" data-close-search>اسأل ${esc(S.data.settings.ai.assistantName)}</a>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- الإعلان المنبثق
  function maybePopup() {
    const p = S.data.settings.popup;
    if (!p.enabled || (!p.title && !p.image)) return;
    const key = 'jalil-popup-' + hashStr(JSON.stringify(p));
    try {
      if (p.frequency === 'session' && sessionStorage.getItem(key)) return;
      if (p.frequency === 'daily' && Date.now() - Number(localStorage.getItem(key) || 0) < 864e5) return;
    } catch { /* تجاهل */ }
    setTimeout(() => {
      if (location.hash.startsWith('#/checkout') || location.hash.startsWith('#/advisor')) return;
      const el = $('#popup');
      el.innerHTML = `<div class="popup-card ${p.image ? '' : 'no-img'}" role="dialog" aria-modal="true">
        <button class="icon-btn popup-close" data-popup-close aria-label="إغلاق"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        ${p.image ? `<div class="popup-img"><img src="${esc(safeUrl(p.image))}" alt=""></div>` : ''}
        <div class="popup-body"><h3>${esc(p.title)}</h3><p style="margin:0">${esc(p.text)}</p>
          ${p.couponCode ? `<div class="popup-code" data-copy="${esc(p.couponCode)}" title="اضغط للنسخ">${esc(p.couponCode)}</div><small style="color:var(--muted)">اضغط على الكود لنسخه وتفعيله تلقائياً</small>` : ''}
          ${p.buttonText ? `<a class="btn" href="${esc(safeUrl(p.buttonLink || '#/shop'))}" data-popup-close>${esc(p.buttonText)}</a>` : ''}</div></div>`;
      el.hidden = false;
      try {
        if (p.frequency === 'session') sessionStorage.setItem(key, '1');
        if (p.frequency === 'daily') localStorage.setItem(key, String(Date.now()));
      } catch { /* تجاهل */ }
    }, Math.max(0, Number(p.delay) || 0) * 1000);
  }
  const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

  // ---------------------------------------------------------------- حركة الظهور
  let io;
  function observeReveal() {
    if (!('IntersectionObserver' in window)) { $$('.reveal').forEach((e) => e.classList.add('in')); return; }
    io = io || new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        const sibs = [...en.target.parentElement.children].filter((x) => x.classList.contains('reveal'));
        en.target.style.transitionDelay = Math.min(sibs.indexOf(en.target), 6) * 70 + 'ms';
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    }), { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal:not(.in)').forEach((e) => io.observe(e));
  }

  // ---------------------------------------------------------------- الأحداث العامة
  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      let el;
      if ((el = t.closest('[data-add]'))) {
        e.preventDefault();
        const p = product(el.dataset.add);
        // منتج بأكثر من حجم: نفتح صفحته لاختيار الحجم
        if (p && Commerce.hasVariants(p) && p.variants.length > 1) { navigate('#/product/' + encodeURIComponent(p.slug)); return; }
        addToCart(el.dataset.add);
        return;
      }
      if ((el = t.closest('[data-fav]'))) { e.preventDefault(); toggleFav(el.dataset.fav); return; }
      if ((el = t.closest('[data-go]'))) { navigate(el.dataset.go, true); $('#filters')?.classList.remove('open'); return; }
      if ((el = t.closest('[data-inc]'))) { const l = S.cart.find((i) => cartKey(i) === el.dataset.inc); const max = Commerce.option(product(l.id), l.variant || '').stock; if (l.qty < max) l.qty++; else toast(`الكمية المتوفرة ${max} فقط`, 'err'); saveCart(); return; }
      if ((el = t.closest('[data-dec]'))) { const l = S.cart.find((i) => cartKey(i) === el.dataset.dec); l.qty = Math.max(1, l.qty - 1); saveCart(); return; }
      if ((el = t.closest('[data-remove]'))) { S.cart = S.cart.filter((i) => cartKey(i) !== el.dataset.remove); saveCart(); return; }
      if (t.closest('[data-close-cart]')) openCart(false);
      if (t.closest('[data-close-search]') || (t.closest('#searchOverlay [data-close]')) || t.id === 'searchOverlay') $('#searchOverlay').hidden = true;
      if (t.closest('#mobileNav [data-close]') || t.id === 'mobileNav') $('#mobileNav').hidden = true;
      if (t.closest('[data-popup-close]') || t.id === 'popup') $('#popup').hidden = true;
      if ((el = t.closest('[data-copy]'))) {
        const code = el.dataset.copy;
        navigator.clipboard?.writeText(code).catch(() => {});
        sessionStorage.setItem('jalil-coupon', code);
        toast('✓ تم نسخ الكود وسيُطبّق تلقائياً عند الدفع');
      }
      if ((el = t.closest('[data-copy-link]'))) {
        const url = el.dataset.copyLink;
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('✓ تم نسخ الرابط'), () => toast(url));
        return;
      }
      if ((el = t.closest('[data-scroll]'))) { e.preventDefault(); document.getElementById(el.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }); }
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-qty]');
      if (!el) return;
      const l = S.cart.find((i) => cartKey(i) === el.dataset.qty);
      const max = Commerce.option(product(l.id), l.variant || '').stock;
      l.qty = Math.max(1, Math.min(max, parseInt(el.value, 10) || 1));
      saveCart();
    });
    $('#cartBtn').onclick = () => openCart(true);
    $('#cartClose').onclick = () => openCart(false);
    $('#cartBackdrop').onclick = () => openCart(false);
    $('#searchBtn').onclick = openSearch;
    $('#searchInput').addEventListener('input', runSearch);
    $('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) { $('#searchOverlay').hidden = true; navigate('#/shop?q=' + encodeURIComponent(e.target.value.trim())); } });
    $('#menuBtn').onclick = () => { $('#mobileNav').hidden = false; };
    $('#themeBtn').onclick = () => {
      const dark = document.documentElement.dataset.dark === '1';
      try { localStorage.setItem('jalil-theme', dark ? 'light' : 'dark'); } catch { /* تجاهل */ }
      setDark();
    };
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', setDark);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { openCart(false); $('#searchOverlay').hidden = true; $('#popup').hidden = true; $('#mobileNav').hidden = true; }
    });
    window.addEventListener('scroll', () => $('#header').classList.toggle('scrolled', scrollY > 10), { passive: true });
    window.addEventListener('hashchange', router);
    window.addEventListener('storage', (e) => { if (e.key === 'jalil-cart') { S.cart = load('jalil-cart', []); updateBadges(); renderCart(); } });
  }

  // ---------------------------------------------------------------- التشغيل
  async function init() {
    try {
      S.data = await api('/bootstrap');
    } catch {
      $('#app').innerHTML = '<div class="container"><div class="empty" style="padding:120px 0"><div class="big">⚠️</div><h2>تعذّر تحميل المتجر</h2><button class="btn" onclick="location.reload()">إعادة المحاولة</button></div></div>';
      return;
    }
    S.cart = S.cart.filter((i) => product(i.id) && Commerce.option(product(i.id), i.variant || ''));
    refreshAccount();
    applyTheme();
    renderShell();
    bindGlobal();
    router();
    renderCart();
    maybePopup();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  init();
})();
