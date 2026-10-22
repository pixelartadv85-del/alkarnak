/* ===================== لوحة تحكم متجر الجليل ===================== */
(() => {
  'use strict';

  const A = { user: null, settings: null, page: 'dashboard', counts: {}, lastUnseen: null, poll: null, cache: {} };

  // ---------------------------------------------------------------- أدوات
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${(A.settings && A.settings.shop.currency) || '₪'}`;
  const dt = (t) => new Date(t).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  const can = (p) => A.user && A.user.permissions.includes(p);
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const set = (obj, path, v) => { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach((k) => (o = o[k] = o[k] || {})); o[ks[ks.length - 1]] = v; };
  const intlPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('0') ? '972' + d.slice(1) : d; };
  const waTo = (phone, text) => `https://wa.me/${intlPhone(phone)}?text=${encodeURIComponent(text)}`;
  const safeUrl = (u) => (/^(https?:|\/|data:image\/)/i.test(String(u || '').trim()) ? String(u).trim() : '');

  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), type === 'new' ? 7000 : 3200);
  }

  async function api(path, method = 'GET', body) {
    const res = await fetch('/api/admin' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login') { A.user = null; renderLogin(); throw new Error('انتهت الجلسة'); }
    if (!res.ok) throw new Error(data.error || 'حدث خطأ');
    return data;
  }

  const ICON = {
    leaf: '<svg viewBox="0 0 24 24"><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 13 11"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  };

  // صوت تنبيه للطلبات الجديدة
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880, 1100].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.16 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.15);
        o.start(ctx.currentTime + i * 0.16); o.stop(ctx.currentTime + i * 0.16 + 0.16);
      });
    } catch { /* المتصفح يمنع الصوت قبل التفاعل */ }
  }

  // ---------------------------------------------------------------- الدخول
  function renderLogin() {
    clearInterval(A.poll);
    $('#root').innerHTML = `<div class="login"><form class="login-card" id="loginForm">
      <div class="login-logo">${ICON.leaf}</div>
      <h1>لوحة التحكم</h1><div class="sub">الدخول لإدارة الموقع فقط</div>
      <div class="f"><label>اسم المستخدم</label><input class="in" name="username" autocomplete="username" required dir="ltr"></div>
      <div class="f" style="margin-top:12px"><label>كلمة المرور</label><input class="in" type="password" name="password" autocomplete="current-password" required dir="ltr"></div>
      <div id="loginErr" class="alert err" style="margin-top:14px" hidden></div>
      <button class="btn" style="width:100%;justify-content:center;margin-top:18px;padding:.8em">دخول</button>
      <div class="login-note">الدخول لإدارة الموقع فقط</div>
    </form></div>`;
    $('#loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        const r = await api('/login', 'POST', f);
        A.user = r.user;
        boot();
      } catch (err) { const b = $('#loginErr'); b.hidden = false; b.textContent = err.message; }
    };
  }

  // ---------------------------------------------------------------- الهيكل
  const MENU = [
    ['', [['dashboard', '📊', 'الرئيسية', null]]],
    ['المبيعات', [['orders', '🧾', 'الطلبات', 'orders'], ['blends', '🍵', 'طلبات الخلطات (AI)', 'orders']]],
    ['الكتالوج', [['products', '📦', 'المنتجات', 'catalog'], ['categories', '🗂️', 'الأقسام', 'catalog'], ['reviews', '⭐', 'التقييمات', 'catalog']]],
    ['المحتوى', [['slides', '🖼️', 'السلايدر', 'content'], ['popup', '📢', 'الإعلان المنبثق', 'content'], ['home', '🏠', 'الصفحة الرئيسية', 'content'], ['texts', '✏️', 'النصوص', 'content']]],
    ['الإعدادات', [['identity', '🌿', 'الاسم والشعار', 'settings'], ['design', '🎨', 'الألوان والخطوط', 'settings'], ['typography', '🔤', 'الخطوط لكل قسم', 'settings'], ['contact', '📞', 'التواصل وواتساب', 'settings'], ['shop', '🚚', 'الشحن والأسعار', 'settings'], ['coupons', '🏷️', 'كوبونات الخصم', 'settings'], ['ai', '🤖', 'المستشار الذكي', 'settings']]],
    ['النظام', [['users', '👥', 'المستخدمون', 'users'], ['backup', '💾', 'النسخ الاحتياطي', 'users'], ['account', '🔐', 'حسابي', null]]],
  ];

  function renderLayout() {
    $('#root').innerHTML = `<div class="layout">
      <aside class="side" id="side">
        <div class="side-brand"><div class="lg">${ICON.leaf}</div><div><b>${esc(A.settings.storeName)}</b><small>لوحة التحكم</small></div></div>
        <nav>${MENU.map(([g, items]) => {
          const vis = items.filter(([, , , p]) => !p || can(p));
          return vis.length ? (g ? `<div class="grp">${g}</div>` : '') + vis.map(([k, i, t]) => `<a href="#${k}" data-page="${k}">${i} ${t}<span class="cnt" data-cnt="${k}" hidden></span></a>`).join('') : '';
        }).join('')}</nav>
        <div class="side-foot">
          <a href="/" target="_blank" class="btn btn-sec btn-sm" style="justify-content:center">${ICON.ext} عرض المتجر</a>
          <div class="muted" style="font-size:.85em;text-align:center">👤 ${esc(A.user.name || A.user.username)}</div>
          <button class="btn btn-sec btn-sm" id="logout" style="justify-content:center">تسجيل الخروج</button>
        </div>
      </aside>
      <div class="main">
        <div class="topbar"><button class="btn btn-sec btn-icon menu-btn" id="menuBtn">${ICON.menu}</button><h2 id="pageTitle"></h2><span class="sp"></span>
          <button class="btn btn-sec btn-icon" id="darkBtn" title="الوضع الليلي">${ICON.moon}</button></div>
        <div class="content" id="content"></div>
      </div></div>`;
    $('#logout').onclick = async () => { await api('/logout', 'POST').catch(() => {}); A.user = null; renderLogin(); };
    $('#menuBtn').onclick = () => $('#side').classList.toggle('open');
    $('#darkBtn').onclick = () => {
      const on = document.documentElement.dataset.dark !== '1';
      document.documentElement.dataset.dark = on ? '1' : '0';
      try { localStorage.setItem('jalil-admin-dark', on ? '1' : '0'); } catch { /* تجاهل */ }
    };
  }

  function route() {
    const page = location.hash.slice(1) || 'dashboard';
    A.page = PAGES[page] ? page : 'dashboard';
    $$('[data-page]').forEach((a) => a.classList.toggle('on', a.dataset.page === A.page));
    $('#side').classList.remove('open');
    const item = MENU.flatMap(([, i]) => i).find(([k]) => k === A.page);
    $('#pageTitle').textContent = item ? item[2] : '';
    const c = $('#content');
    c.innerHTML = '<div class="empty">جارٍ التحميل…</div>';
    if (item && item[3] && !can(item[3])) { c.innerHTML = '<div class="alert err">لا تملك صلاحية الوصول لهذه الصفحة</div>'; return; }
    PAGES[A.page](c).catch((e) => { c.innerHTML = `<div class="alert err">${esc(e.message)}</div>`; });
    window.scrollTo(0, 0);
  }

  async function refreshCounts(first = false) {
    try {
      const s = await api('/summary');
      A.counts = s.counts;
      const map = { orders: s.counts.unseenOrders, blends: s.counts.unseenBlends, reviews: s.counts.pendingReviews };
      for (const [k, v] of Object.entries(map)) { const el = $(`[data-cnt="${k}"]`); if (el) { el.hidden = !v; el.textContent = v; } }
      const unseen = s.counts.unseenOrders + s.counts.unseenBlends;
      document.title = (unseen ? `(${unseen}) ` : '') + 'لوحة التحكم | ' + A.settings.storeName;
      if (!first && A.lastUnseen !== null && unseen > A.lastUnseen) {
        beep();
        toast('🔔 وصل طلب جديد!', 'new');
        if ('Notification' in window && Notification.permission === 'granted') new Notification('طلب جديد – ' + A.settings.storeName, { body: 'وصل طلب جديد إلى لوحة التحكم', icon: '/icon.svg' });
        if (A.page === 'orders' || A.page === 'blends' || A.page === 'dashboard') route();
      }
      A.lastUnseen = unseen;
      return s;
    } catch { return null; }
  }

  // ---------------------------------------------------------------- النوافذ
  function modal(title, body, foot = '', size = '') {
    const m = $('#modal');
    m.innerHTML = `<div class="modal ${size}"><div class="modal-head"><h3>${title}</h3><button class="btn btn-sec btn-icon" data-mclose>${ICON.close}</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    return m;
  }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; document.body.style.overflow = ''; }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-mclose]') || e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  const confirmDo = (msg) => window.confirm(msg);

  // ---------------------------------------------------------------- مكوّنات النماذج
  const FONTS = ['Tajawal', 'Cairo', 'Almarai', 'IBM Plex Sans Arabic', 'Noto Kufi Arabic', 'Noto Sans Arabic', 'Noto Naskh Arabic', 'Readex Pro', 'Alexandria', 'Changa', 'Mada', 'Harmattan', 'Baloo Bhaijaan 2', 'Kufam', 'El Messiri', 'Reem Kufi', 'Amiri', 'Scheherazade New', 'Lemonada', 'Marhey', 'Aref Ruqaa', 'Lalezar', 'Rakkas', 'Vibes', 'Blaka', 'Gulzar'];
  const SINGLE_WEIGHT = ['Lalezar', 'Rakkas', 'Vibes', 'Blaka', 'Gulzar'];
  let fontsPreviewLoaded = false;
  function loadPreviewFonts() {
    if (fontsPreviewLoaded) return;
    fontsPreviewLoaded = true;
    // رابط لكل خط حتى لا يُفشل خطٌّ واحد تحميل البقية
    for (const f of FONTS) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}${SINGLE_WEIGHT.includes(f) ? '' : ':wght@400;700'}&display=swap`;
      document.head.append(l);
    }
  }

  // أجزاء الموقع التي يمكن ضبط خطها بشكل منفصل (المفاتيح تطابق TYPO_SELECTORS في store.js)
  const TYPO_PARTS = [
    ['عام', [['body', 'نص الموقع العام']]],
    ['أعلى الموقع', [['announce', 'شريط الإعلانات المتحرك'], ['nav', 'روابط القائمة'], ['brandTag', 'الشعار النصي تحت الاسم']]],
    ['السلايدر', [['heroBadge', 'الشارة الصغيرة'], ['heroTitle', 'العنوان الكبير'], ['heroText', 'النص تحت العنوان']]],
    ['الصفحة الرئيسية', [['featureTitle', 'عناوين المزايا'], ['featureText', 'نصوص المزايا'], ['sectionTitle', 'عناوين الأقسام والصفحات'], ['sectionSub', 'الوصف تحت العناوين'], ['categoryName', 'أسماء الأقسام'], ['advisorTitle', 'عنوان بانر المستشار'], ['advisorText', 'نص بانر المستشار'], ['reviews', 'آراء الزبائن']]],
    ['بطاقات المنتجات', [['cardTitle', 'اسم المنتج'], ['cardPrice', 'السعر'], ['tags', 'الشارات (خصم، جديد…)']]],
    ['صفحة المنتج', [['productTitle', 'اسم المنتج'], ['productPrice', 'السعر'], ['productText', 'الوصف والفوائد'], ['productTabs', 'تبويبات (الوصف، الفوائد…)']]],
    ['الطلب والسلة', [['buttons', 'كل الأزرار'], ['forms', 'حقول التعبئة'], ['cart', 'السلة وملخص الطلب']]],
    ['المستشار والإعلان', [['chat', 'رسائل المحادثة'], ['popupTitle', 'عنوان الإعلان المنبثق'], ['popupText', 'نص الإعلان المنبثق']]],
    ['الفوتر', [['footerTitle', 'عناوين الفوتر'], ['footer', 'نصوص الفوتر']]],
  ];

  // يبني حقلاً من تعريف: {k, label, type, opts, hint, full, min, max, step, unit}
  function fieldHTML(fd, val) {
    const id = 'f_' + fd.k.replace(/\./g, '_');
    const v = val ?? '';
    let input;
    switch (fd.type) {
      case 'textarea': input = `<textarea class="ta ${fd.code ? 'code' : ''}" id="${id}" data-k="${fd.k}" ${fd.rows ? `style="min-height:${fd.rows * 24}px"` : ''}>${esc(v)}</textarea>`; break;
      case 'lines': input = `<textarea class="ta" id="${id}" data-k="${fd.k}" data-lines>${esc((v || []).join('\n'))}</textarea>`; break;
      case 'number': input = `<input class="in" type="number" id="${id}" data-k="${fd.k}" value="${esc(v)}" ${fd.min !== undefined ? `min="${fd.min}"` : ''} ${fd.max !== undefined ? `max="${fd.max}"` : ''} step="${fd.step || 'any'}" data-num>`; break;
      case 'range': input = `<div class="range-in"><input type="range" id="${id}" data-k="${fd.k}" value="${esc(v)}" min="${fd.min}" max="${fd.max}" step="${fd.step || 1}" data-num oninput="this.nextElementSibling.value=this.value+'${fd.unit || ''}'"><output>${esc(v)}${fd.unit || ''}</output></div>`; break;
      case 'color': input = `<div class="color-in"><input type="color" value="${esc(v || '#000000')}" oninput="this.nextElementSibling.value=this.value"><input class="in" id="${id}" data-k="${fd.k}" value="${esc(v)}" dir="ltr" placeholder="${fd.optional ? 'تلقائي' : '#000000'}" oninput="if(/^#[0-9a-f]{6}$/i.test(this.value))this.previousElementSibling.value=this.value"></div>`; break;
      case 'select': input = `<select class="sel" id="${id}" data-k="${fd.k}">${fd.opts.map(([ov, ot]) => `<option value="${esc(ov)}" ${String(v) === String(ov) ? 'selected' : ''}>${esc(ot)}</option>`).join('')}</select>`; break;
      case 'font': loadPreviewFonts(); input = `<select class="sel" id="${id}" data-k="${fd.k}" style="font-family:'${esc(v)}'" onchange="this.style.fontFamily=\`'\${this.value}'\`">${FONTS.map((f) => `<option ${v === f ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select>`; break;
      case 'bool': input = `<label class="switch"><input type="checkbox" id="${id}" data-k="${fd.k}" ${v ? 'checked' : ''} data-bool><i></i> ${esc(fd.text || 'مفعّل')}</label>`; break;
      case 'image': input = `<div class="img-in"><img class="prev" src="${esc(safeUrl(v))}" alt="" onerror="this.style.visibility='hidden'" onload="this.style.visibility='visible'"><div style="flex:1;display:grid;gap:6px"><input class="in" id="${id}" data-k="${fd.k}" value="${esc(v)}" dir="ltr" placeholder="رابط الصورة أو ارفع صورة" data-img-input>
        <div class="row"><label class="btn btn-sec btn-sm">⬆ رفع صورة<input type="file" accept="image/*" hidden data-upload="${id}"></label>${v ? `<button type="button" class="btn btn-sec btn-sm" data-clear="${id}">إزالة</button>` : ''}</div></div></div>`; break;
      default: input = `<input class="in" id="${id}" data-k="${fd.k}" value="${esc(v)}" ${fd.ltr ? 'dir="ltr"' : ''} ${fd.placeholder ? `placeholder="${esc(fd.placeholder)}"` : ''}>`;
    }
    return `<div class="f ${fd.full || ['textarea', 'lines'].includes(fd.type) ? 'full' : ''}">${fd.type === 'bool' ? '' : `<label for="${id}">${esc(fd.label)}</label>`}${fd.type === 'bool' ? `<label style="display:block;font-weight:700;font-size:.88em;margin-bottom:5px">${esc(fd.label)}</label>` : ''}${input}${fd.hint ? `<div class="hint">${esc(fd.hint)}</div>` : ''}</div>`;
  }

  function readFields(root, target) {
    $$('[data-k]', root).forEach((el) => {
      let v;
      if (el.hasAttribute('data-bool')) v = el.checked;
      else if (el.hasAttribute('data-num')) v = el.value === '' ? 0 : Number(el.value);
      else if (el.hasAttribute('data-lines')) v = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
      else v = el.value.trim();
      set(target, el.dataset.k, v);
    });
    return target;
  }

  // تصغير الصور قبل الرفع لتسريع الموقع
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject;
      r.onload = () => {
        if (file.type === 'image/gif' || file.size < 300 * 1024) return resolve(r.result);
        const img = new Image();
        img.onload = () => {
          const max = 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/webp', 0.86));
        };
        img.onerror = () => resolve(r.result);
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  async function uploadFile(file) {
    if (!file.type.startsWith('image/')) throw new Error('يرجى اختيار صورة');
    const data = await fileToDataURL(file);
    return (await api('/upload', 'POST', { data })).url;
  }

  // ربط أزرار رفع الصور داخل أي نموذج
  function bindUploads(root) {
    root.addEventListener('change', async (e) => {
      const inp = e.target.closest('[data-upload]');
      if (!inp || !inp.files[0]) return;
      const target = document.getElementById(inp.dataset.upload);
      try {
        toast('جارٍ رفع الصورة…');
        const url = await uploadFile(inp.files[0]);
        target.value = url;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        toast('✓ تم رفع الصورة');
      } catch (err) { toast(err.message, 'err'); }
      inp.value = '';
    });
    root.addEventListener('input', (e) => {
      if (e.target.matches('[data-img-input]')) { const prev = e.target.closest('.img-in').querySelector('.prev'); prev.src = safeUrl(e.target.value); }
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-clear]');
      if (b) { const t = document.getElementById(b.dataset.clear); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }

  // صفحة إعدادات عامة مبنية من تعريف الحقول
  function settingsPage(sections, note = '') {
    return async (c) => {
      A.settings = await api('/settings');
      c.innerHTML = `${note}<form id="sform">${sections.map(([title, fields, desc]) => `<div class="card"><div class="card-head"><h3>${title}</h3></div>${desc ? `<p class="muted" style="margin-top:-6px">${desc}</p>` : ''}<div class="form">${fields.map((f) => fieldHTML(f, get(A.settings, f.k))).join('')}</div></div>`).join('')}
        <div class="save-bar"><a class="btn btn-sec" href="/" target="_blank">${ICON.ext} معاينة المتجر</a><button class="btn">💾 حفظ التغييرات</button></div></form>`;
      bindUploads(c);
      $('#sform').onsubmit = async (e) => {
        e.preventDefault();
        const draft = JSON.parse(JSON.stringify(A.settings));
        readFields(e.target, draft);
        const keys = [...new Set($$('[data-k]', e.target).map((el) => el.dataset.k.split('.')[0]))];
        const patch = Object.fromEntries(keys.map((k) => [k, draft[k]]));
        try { A.settings = await api('/settings', 'PUT', patch); toast('✓ تم الحفظ – التغييرات ظاهرة الآن في المتجر'); } catch (err) { toast(err.message, 'err'); }
      };
    };
  }

  // ---------------------------------------------------------------- الصفحات
  const STATUS = { new: 'جديد', confirmed: 'تم التأكيد', preparing: 'قيد التحضير', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
  const BSTATUS = { new: 'جديد', contacted: 'تم التواصل', preparing: 'قيد التحضير', done: 'مكتمل', cancelled: 'ملغي' };
  const pill = (s, map = STATUS) => `<span class="pill st-${esc(s)}">${esc(map[s] || s)}</span>`;

  const PAGES = {
    async dashboard(c) {
      const s = await refreshCounts(true) || await api('/summary');
      const max = Math.max(1, ...s.days.map((d) => d.revenue));
      c.innerHTML = `
        ${'Notification' in window && Notification.permission === 'default' ? '<div class="alert">🔔 <a href="#" id="notifBtn"><b>فعّل إشعارات المتصفح</b></a> ليصلك تنبيه فوري عند وصول طلب جديد.</div>' : ''}
        <div class="stats">
          <a class="stat" href="#orders"><div class="ic">🧾</div><div><b>${s.counts.newOrders}</b><small>طلبات جديدة بانتظار التأكيد</small></div></a>
          <a class="stat" href="#blends"><div class="ic">🍵</div><div><b>${s.counts.newBlends}</b><small>طلبات خلطات جديدة (AI)</small></div></a>
          <div class="stat"><div class="ic">📅</div><div><b>${money(s.todayRevenue)}</b><small>مبيعات اليوم (${s.todayOrders} طلب)</small></div></div>
          <div class="stat"><div class="ic">💰</div><div><b>${money(s.totalRevenue)}</b><small>إيرادات الطلبات المسلّمة</small></div></div>
          <div class="stat"><div class="ic">⏳</div><div><b>${money(s.pipelineRevenue)}</b><small>قيمة طلبات قيد التنفيذ</small></div></div>
          <a class="stat" href="#products"><div class="ic">⚠️</div><div><b>${s.counts.lowStock}</b><small>منتجات مخزونها منخفض</small></div></a>
        </div>
        <div class="grid2">
          <div class="card"><div class="card-head"><h3>المبيعات آخر 14 يوم</h3></div>
            <div class="chart">${s.days.map((d) => `<div class="bar" title="${d.date}: ${money(d.revenue)} • ${d.orders} طلب"><span>${d.orders || ''}</span><i style="height:${(d.revenue / max) * 100}%"></i><small>${d.date.slice(8)}/${d.date.slice(5, 7)}</small></div>`).join('')}</div></div>
          <div class="card"><div class="card-head"><h3>الأكثر مبيعاً</h3></div>
            ${s.topProducts.length ? `<table><tbody>${s.topProducts.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td><b>${p.qty}</b></td></tr>`).join('')}</tbody></table>` : '<div class="empty">لا توجد مبيعات بعد</div>'}</div>
        </div>
        <div class="card" style="margin-top:18px"><div class="card-head"><h3>أحدث الطلبات</h3><a class="btn btn-sec btn-sm" href="#orders">كل الطلبات</a></div>${ordersTable(s.recentOrders)}</div>
        ${s.lowStockProducts.length ? `<div class="card"><div class="card-head"><h3>⚠️ مخزون منخفض</h3></div><div class="row">${s.lowStockProducts.map((p) => `<span class="pill st-cancelled">${esc(p.name)}: ${p.stock}</span>`).join('')}</div></div>` : ''}`;
      $('#notifBtn')?.addEventListener('click', (e) => { e.preventDefault(); Notification.requestPermission().then(() => route()); });
      bindOrderRows(c, s.recentOrders);
    },

    async orders(c) {
      const orders = await api('/orders');
      A.cache.orders = orders;
      const st = A.cache.orderFilter || 'all';
      const q = A.cache.orderQ || '';
      const filtered = orders.filter((o) => (st === 'all' || o.status === st) && (!q || `${o.number} ${o.customer.firstName} ${o.customer.lastName} ${o.customer.phone} ${o.customer.town}`.includes(q)));
      c.innerHTML = `<div class="card">
        <div class="card-head"><div class="tabs">${[['all', 'الكل'], ...Object.entries(STATUS)].map(([k, t]) => `<button data-st="${k}" class="${st === k ? 'on' : ''}">${t} <small>(${k === 'all' ? orders.length : orders.filter((o) => o.status === k).length})</small></button>`).join('')}</div>
          <div class="row"><input class="in" id="oq" placeholder="بحث: رقم، اسم، هاتف، بلدة" value="${esc(q)}" style="width:240px"><button class="btn btn-sec btn-sm" id="markAll">✓ تعليم الكل كمقروء</button><button class="btn btn-sec btn-sm" id="csv">⬇ تصدير Excel</button></div></div>
        ${filtered.length ? ordersTable(filtered) : '<div class="empty">لا توجد طلبات</div>'}</div>`;
      $$('[data-st]', c).forEach((b) => (b.onclick = () => { A.cache.orderFilter = b.dataset.st; route(); }));
      $('#oq').onchange = (e) => { A.cache.orderQ = e.target.value.trim(); route(); };
      $('#markAll').onclick = async () => { await api('/orders/mark-seen', 'POST'); refreshCounts(); route(); };
      $('#csv').onclick = () => exportCSV(filtered);
      bindOrderRows(c, filtered);
    },

    async blends(c) {
      const list = await api('/blends');
      c.innerHTML = `<div class="alert">🤖 هذه الطلبات تصل من محادثات الزبائن مع المستشار الذكي بعد موافقتهم على الخلطة المقترحة. تواصل معهم لتأكيد السعر والتوصيل.</div>
        <div class="card">${list.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>التاريخ</th><th>الزبون</th><th>البلدة</th><th>الهاتف</th><th>الخلطة</th><th>الحالة</th></tr></thead><tbody>
        ${list.map((b) => `<tr class="clickable ${b.seen ? '' : 'unseen'}" data-blend="${b.id}"><td><b>#${b.number}</b></td><td>${dt(b.createdAt)}</td><td>${esc(b.customer.firstName + ' ' + b.customer.lastName)}</td><td>${esc(b.customer.town)}</td><td dir="ltr">${esc(b.customer.phone)}</td><td>${esc(b.blend.title)}</td><td>${pill(b.status, BSTATUS)}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">لا توجد طلبات خلطات بعد</div>'}</div>`;
      $$('[data-blend]', c).forEach((r) => (r.onclick = () => blendModal(list.find((b) => b.id === r.dataset.blend))));
    },

    async products(c) {
      const [products, categories] = await Promise.all([api('/products'), api('/categories')]);
      A.cache.categories = categories;
      const q = A.cache.prodQ || '';
      const cat = A.cache.prodCat || '';
      const list = products.filter((p) => (!q || p.name.includes(q)) && (!cat || p.categoryId === cat));
      const catName = Object.fromEntries(categories.map((k) => [k.id, k.name]));
      const low = A.settings.shop.lowStockAlert || 5;
      c.innerHTML = `<div class="card"><div class="card-head"><div class="row"><input class="in" id="pq" placeholder="بحث عن منتج" value="${esc(q)}" style="width:220px">
          <select class="sel" id="pc" style="width:180px"><option value="">كل الأقسام</option>${categories.map((k) => `<option value="${k.id}" ${cat === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></div>
          <button class="btn" id="addP">${ICON.plus} إضافة منتج</button></div>
        <div class="table-wrap"><table><thead><tr><th></th><th>المنتج</th><th>القسم</th><th>السعر</th><th>الخصم</th><th>بعد الخصم</th><th>المخزون</th><th>المبيعات</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${list.map((p) => `<tr><td><img class="thumb" src="${esc(safeUrl(p.images[0]))}" alt=""></td><td><b>${esc(p.name)}</b><div class="muted" style="font-size:.82em">${esc(p.size || '')} ${p.featured ? '• ⭐ مميز' : ''} ${p.bestseller ? '• 🔥' : ''} ${p.isNew ? '• 🆕' : ''}</div></td>
          <td>${esc(catName[p.categoryId] || '—')}</td><td>${money(p.price)}</td><td>${p.discount ? `<span class="pill st-cancelled">${p.discount}%</span>` : '—'}</td><td><b>${money(Math.round(p.price * (1 - p.discount / 100) * 100) / 100)}</b></td>
          <td>${p.stock <= low ? `<span class="pill ${p.stock ? 'st-new' : 'st-cancelled'}">${p.stock}</span>` : p.stock}</td><td>${p.sold || 0}</td><td>${p.active ? pill('delivered', { delivered: 'ظاهر' }) : pill('cancelled', { cancelled: 'مخفي' })}</td>
          <td style="white-space:nowrap"><button class="btn btn-sec btn-icon" data-edit="${p.id}" title="تعديل">${ICON.edit}</button> <a class="btn btn-sec btn-icon" href="/#/product/${encodeURIComponent(p.slug)}" target="_blank" title="عرض">${ICON.ext}</a> <button class="btn btn-sec btn-icon" data-del="${p.id}" title="حذف">${ICON.trash}</button></td></tr>`).join('')}
        </tbody></table></div>${list.length ? '' : '<div class="empty">لا توجد منتجات</div>'}</div>`;
      $('#pq').onchange = (e) => { A.cache.prodQ = e.target.value.trim(); route(); };
      $('#pc').onchange = (e) => { A.cache.prodCat = e.target.value; route(); };
      $('#addP').onclick = () => productModal(null);
      $$('[data-edit]', c).forEach((b) => (b.onclick = () => productModal(products.find((p) => p.id === b.dataset.edit))));
      $$('[data-del]', c).forEach((b) => (b.onclick = async () => { if (confirmDo('حذف هذا المنتج نهائياً؟')) { await api('/products/' + b.dataset.del, 'DELETE'); toast('تم الحذف'); route(); } }));
    },

    async categories(c) {
      const [cats, products] = await Promise.all([api('/categories'), api('/products')]);
      c.innerHTML = `<div class="card"><div class="card-head"><h3>أقسام المتجر</h3><button class="btn" id="addC">${ICON.plus} إضافة قسم</button></div>
        <div class="table-wrap"><table><thead><tr><th></th><th>القسم</th><th>الأيقونة</th><th>الترتيب</th><th>عدد المنتجات</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${cats.sort((a, b) => a.order - b.order).map((k) => `<tr><td><img class="thumb" src="${esc(safeUrl(k.image))}" alt=""></td><td><b>${esc(k.name)}</b><div class="muted" style="font-size:.82em">${esc(k.description)}</div></td><td style="font-size:1.4em">${esc(k.icon)}</td><td>${k.order}</td>
          <td>${products.filter((p) => p.categoryId === k.id).length}</td><td>${k.active ? pill('delivered', { delivered: 'ظاهر' }) : pill('cancelled', { cancelled: 'مخفي' })}</td>
          <td style="white-space:nowrap"><button class="btn btn-sec btn-icon" data-edit="${k.id}">${ICON.edit}</button> <button class="btn btn-sec btn-icon" data-del="${k.id}">${ICON.trash}</button></td></tr>`).join('')}
        </tbody></table></div></div>`;
      const fields = [
        { k: 'name', label: 'اسم القسم' }, { k: 'icon', label: 'أيقونة (إيموجي)', placeholder: '🌿' },
        { k: 'description', label: 'وصف قصير', full: true }, { k: 'image', label: 'صورة القسم', type: 'image', full: true },
        { k: 'order', label: 'الترتيب', type: 'number' }, { k: 'active', label: 'ظاهر في المتجر', type: 'bool' },
      ];
      const edit = (k) => crudModal(k ? 'تعديل قسم' : 'قسم جديد', fields, k || { active: true, order: cats.length + 1 }, (data) => api(k ? '/categories/' + k.id : '/categories', k ? 'PUT' : 'POST', data));
      $('#addC').onclick = () => edit(null);
      $$('[data-edit]', c).forEach((b) => (b.onclick = () => edit(cats.find((k) => k.id === b.dataset.edit))));
      $$('[data-del]', c).forEach((b) => (b.onclick = async () => {
        const n = products.filter((p) => p.categoryId === b.dataset.del).length;
        if (confirmDo(n ? `هذا القسم يحتوي ${n} منتج. حذفه سيترك المنتجات بدون قسم. متابعة؟` : 'حذف القسم؟')) { await api('/categories/' + b.dataset.del, 'DELETE'); route(); }
      }));
    },

    async reviews(c) {
      const list = await api('/reviews');
      const f = A.cache.revF || 'pending';
      const shown = list.filter((r) => (f === 'all' ? true : f === 'pending' ? !r.approved : r.approved));
      c.innerHTML = `<div class="card"><div class="card-head"><div class="tabs">${[['pending', 'بانتظار الموافقة'], ['approved', 'منشورة'], ['all', 'الكل']].map(([k, t]) => `<button data-f="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        ${shown.length ? `<div class="table-wrap"><table><thead><tr><th>المنتج</th><th>الزبون</th><th>التقييم</th><th>النص</th><th>التاريخ</th><th></th></tr></thead><tbody>
        ${shown.map((r) => `<tr><td>${esc(r.productName)}</td><td>${esc(r.name)}<div class="muted" style="font-size:.8em">${esc(r.town || '')}</div></td><td style="color:var(--a)">${'★'.repeat(r.rating)}</td><td style="max-width:380px">${esc(r.text)}</td><td>${dt(r.createdAt)}</td>
          <td style="white-space:nowrap">${r.approved ? `<button class="btn btn-sec btn-sm" data-ap="${r.id}" data-v="0">إخفاء</button>` : `<button class="btn btn-ok btn-sm" data-ap="${r.id}" data-v="1">✓ نشر</button>`} <button class="btn btn-sec btn-icon" data-del="${r.id}">${ICON.trash}</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">لا توجد تقييمات هنا</div>'}</div>`;
      $$('[data-f]', c).forEach((b) => (b.onclick = () => { A.cache.revF = b.dataset.f; route(); }));
      $$('[data-ap]', c).forEach((b) => (b.onclick = async () => { await api('/reviews/' + b.dataset.ap, 'PUT', { approved: b.dataset.v === '1' }); refreshCounts(); route(); }));
      $$('[data-del]', c).forEach((b) => (b.onclick = async () => { if (confirmDo('حذف التقييم؟')) { await api('/reviews/' + b.dataset.del, 'DELETE'); refreshCounts(); route(); } }));
    },

    async slides(c) {
      const slides = (await api('/slides')).sort((a, b) => a.order - b.order);
      c.innerHTML = `<div class="card"><div class="card-head"><h3>شرائح السلايدر الرئيسي</h3><button class="btn" id="addS">${ICON.plus} إضافة شريحة</button></div>
        <p class="muted" style="margin-top:-6px">كل شريحة لها صورة خلفية، وصورة جانبية اختيارية (مثل صورة منتج)، وعنوان ونص وزرين. الحركة والانتقال يتمّان تلقائياً. مدة كل شريحة تُضبط من صفحة "الصفحة الرئيسية".</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">${slides.map((s) => `<div class="card" style="padding:0;overflow:hidden;margin:0">
          <div style="height:140px;background:#123 url('${esc(safeUrl(s.image))}') center/cover;position:relative;display:flex;align-items:end;padding:12px;color:#fff"><div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.7),transparent)"></div><b style="position:relative">${esc(s.title)}</b></div>
          <div style="padding:12px" class="row"><span class="muted">ترتيب ${s.order}</span>${s.active ? pill('delivered', { delivered: 'ظاهرة' }) : pill('cancelled', { cancelled: 'مخفية' })}<span style="flex:1"></span>
          <button class="btn btn-sec btn-icon" data-edit="${s.id}">${ICON.edit}</button><button class="btn btn-sec btn-icon" data-del="${s.id}">${ICON.trash}</button></div></div>`).join('')}</div></div>`;
      const fields = [
        { k: 'badge', label: 'شارة صغيرة فوق العنوان' }, { k: 'title', label: 'العنوان الرئيسي' }, { k: 'subtitle', label: 'النص', type: 'textarea' },
        { k: 'buttonText', label: 'نص الزر الأول' }, { k: 'buttonLink', label: 'رابط الزر الأول', ltr: true, hint: 'مثال: #/shop أو #/shop?cat=oils أو #/advisor' },
        { k: 'button2Text', label: 'نص الزر الثاني (اختياري)' }, { k: 'button2Link', label: 'رابط الزر الثاني', ltr: true },
        { k: 'image', label: 'صورة الخلفية (يفضل 1600×800)', type: 'image', full: true }, { k: 'sideImage', label: 'صورة جانبية دائرية (اختياري)', type: 'image', full: true },
        { k: 'order', label: 'الترتيب', type: 'number' }, { k: 'active', label: 'ظاهرة', type: 'bool' },
      ];
      const edit = (s) => crudModal(s ? 'تعديل شريحة' : 'شريحة جديدة', fields, s || { active: true, order: slides.length + 1, buttonText: 'تسوّق الآن', buttonLink: '#/shop' }, (data) => api(s ? '/slides/' + s.id : '/slides', s ? 'PUT' : 'POST', data));
      $('#addS').onclick = () => edit(null);
      $$('[data-edit]', c).forEach((b) => (b.onclick = () => edit(slides.find((s) => s.id === b.dataset.edit))));
      $$('[data-del]', c).forEach((b) => (b.onclick = async () => { if (confirmDo('حذف الشريحة؟')) { await api('/slides/' + b.dataset.del, 'DELETE'); route(); } }));
    },

    popup: settingsPage([
      ['الإعلان المنبثق (Popup)', [
        { k: 'popup.enabled', label: 'تفعيل الإعلان', type: 'bool' },
        { k: 'popup.frequency', label: 'متى يظهر؟', type: 'select', opts: [['session', 'مرة واحدة في كل زيارة'], ['daily', 'مرة واحدة يومياً'], ['always', 'في كل مرة يفتح الصفحة']] },
        { k: 'popup.title', label: 'العنوان' }, { k: 'popup.delay', label: 'يظهر بعد (ثوانٍ)', type: 'number', min: 0 },
        { k: 'popup.text', label: 'النص', type: 'textarea' },
        { k: 'popup.image', label: 'الصورة', type: 'image', full: true },
        { k: 'popup.couponCode', label: 'كود خصم يظهر في الإعلان (اختياري)', ltr: true, hint: 'يجب إنشاؤه أيضاً في صفحة كوبونات الخصم' },
        { k: 'popup.buttonText', label: 'نص الزر' }, { k: 'popup.buttonLink', label: 'رابط الزر', ltr: true },
      ]],
      ['شريط الإعلانات المتحرك أعلى الموقع', [
        { k: 'announcement.enabled', label: 'إظهار الشريط', type: 'bool' }, { k: 'announcement.text', label: 'نص الشريط', type: 'textarea' },
      ]],
    ]),

    async home(c) {
      A.settings = await api('/settings');
      const names = { slider: '🖼️ السلايدر الرئيسي', features: '✨ شريط المزايا', categories: '🗂️ الأقسام', featured: '⭐ منتجات مختارة', advisor: '🤖 بانر المستشار الذكي', offers: '🏷️ العروض والخصومات', bestsellers: '🔥 الأكثر مبيعاً', testimonials: '💬 آراء الزبائن' };
      let secs = A.settings.home.sections.slice();
      let feats = A.settings.home.features.slice();
      const draw = () => {
        c.innerHTML = `<div class="card"><div class="card-head"><h3>أقسام الصفحة الرئيسية وترتيبها</h3></div><p class="muted" style="margin-top:-6px">رتّب الأقسام بالأسهم، وأخفِ ما لا تريده.</p>
          <div class="sec-list">${secs.map((s, i) => `<div class="li"><b>${names[s.key] || s.key}</b><label class="switch"><input type="checkbox" data-en="${i}" ${s.enabled ? 'checked' : ''}><i></i></label>
            <button class="btn btn-sec btn-sm" data-up="${i}" ${i === 0 ? 'disabled' : ''}>▲</button><button class="btn btn-sec btn-sm" data-down="${i}" ${i === secs.length - 1 ? 'disabled' : ''}>▼</button></div>`).join('')}</div>
          <div class="form" style="margin-top:14px">${fieldHTML({ k: 'sliderInterval', label: 'مدة كل شريحة في السلايدر (ثوانٍ)', type: 'range', min: 3, max: 15, unit: ' ث' }, A.settings.home.sliderInterval)}</div></div>
          <div class="card"><div class="card-head"><h3>شريط المزايا</h3><button class="btn btn-sec btn-sm" id="addF">${ICON.plus} إضافة ميزة</button></div>
          <div class="list-editor">${feats.map((f, i) => `<div class="li"><input class="in" data-fi="${i}" data-fk="icon" value="${esc(f.icon)}" style="text-align:center"><input class="in" data-fi="${i}" data-fk="title" value="${esc(f.title)}" placeholder="العنوان"><input class="in" data-fi="${i}" data-fk="text" value="${esc(f.text)}" placeholder="الوصف"><button class="btn btn-sec btn-icon" data-fdel="${i}">${ICON.trash}</button></div>`).join('')}</div></div>
          <div class="save-bar"><button class="btn" id="saveHome">💾 حفظ</button></div>`;
        $$('[data-en]', c).forEach((el) => (el.onchange = () => { secs[+el.dataset.en].enabled = el.checked; }));
        $$('[data-up]', c).forEach((b) => (b.onclick = () => { const i = +b.dataset.up; [secs[i - 1], secs[i]] = [secs[i], secs[i - 1]]; sync(); draw(); }));
        $$('[data-down]', c).forEach((b) => (b.onclick = () => { const i = +b.dataset.down; [secs[i + 1], secs[i]] = [secs[i], secs[i + 1]]; sync(); draw(); }));
        $$('[data-fi]', c).forEach((el) => (el.oninput = () => { feats[+el.dataset.fi][el.dataset.fk] = el.value; }));
        $$('[data-fdel]', c).forEach((b) => (b.onclick = () => { feats.splice(+b.dataset.fdel, 1); sync(); draw(); }));
        $('#addF').onclick = () => { sync(); feats.push({ icon: '🌿', title: '', text: '' }); draw(); };
        $('#saveHome').onclick = async () => {
          sync();
          try { A.settings = await api('/settings', 'PUT', { home: { sections: secs, features: feats.filter((f) => f.title), sliderInterval: Number($('[data-k="sliderInterval"]', c).value) } }); toast('✓ تم الحفظ'); } catch (e) { toast(e.message, 'err'); }
        };
      };
      const sync = () => { A.settings.home.sliderInterval = Number($('[data-k="sliderInterval"]', c)?.value || A.settings.home.sliderInterval); };
      draw();
    },

    texts: settingsPage([
      ['عناوين الصفحة الرئيسية', [
        { k: 'texts.categoriesTitle', label: 'عنوان الأقسام' }, { k: 'texts.categoriesSubtitle', label: 'وصف الأقسام' },
        { k: 'texts.featuredTitle', label: 'عنوان المنتجات المختارة' }, { k: 'texts.featuredSubtitle', label: 'وصف المنتجات المختارة' },
        { k: 'texts.offersTitle', label: 'عنوان العروض' }, { k: 'texts.offersSubtitle', label: 'وصف العروض' },
        { k: 'texts.bestsellersTitle', label: 'عنوان الأكثر مبيعاً' }, { k: 'texts.testimonialsTitle', label: 'عنوان آراء الزبائن' },
      ]],
      ['بانر المستشار الذكي', [
        { k: 'texts.advisorTitle', label: 'العنوان', full: true }, { k: 'texts.advisorText', label: 'النص', type: 'textarea' }, { k: 'texts.advisorButton', label: 'نص الزر' },
      ]],
      ['الطلب', [
        { k: 'texts.checkoutNote', label: 'ملاحظة في صفحة الدفع', type: 'textarea' }, { k: 'texts.orderSuccess', label: 'رسالة نجاح الطلب', type: 'textarea' },
      ]],
      ['صفحة من نحن والفوتر', [
        { k: 'texts.aboutTitle', label: 'عنوان صفحة من نحن' }, { k: 'texts.copyright', label: 'نص حقوق النشر' },
        { k: 'texts.aboutContent', label: 'محتوى صفحة من نحن', type: 'textarea', rows: 7 }, { k: 'texts.footerAbout', label: 'نبذة في الفوتر', type: 'textarea' },
        { k: 'texts.medicalDisclaimer', label: 'التنبيه الطبي', type: 'textarea' },
      ]],
    ]),

    identity: settingsPage([
      ['اسم المتجر', [
        { k: 'storeName', label: 'اسم المتجر' }, { k: 'tagline', label: 'الشعار النصي (تحت الاسم)' },
        { k: 'showName', label: 'إظهار الاسم', type: 'bool' }, { k: 'showTagline', label: 'إظهار الشعار النصي', type: 'bool' },
        { k: 'namePosition', label: 'مكان الاسم والشعار في الأعلى', type: 'select', opts: [['right', 'يمين'], ['center', 'وسط'], ['left', 'يسار']] },
        { k: 'nameFont', label: 'خط الاسم', type: 'font' },
        { k: 'nameSize', label: 'حجم الاسم', type: 'range', min: 16, max: 56, unit: 'px' },
      ]],
      ['اللوجو', [
        { k: 'logo', label: 'صورة اللوجو', type: 'image', full: true, hint: 'إذا تركته فارغاً يظهر رمز ورقة تلقائياً. يفضّل صورة مربعة PNG.' },
        { k: 'showLogo', label: 'إظهار اللوجو', type: 'bool' },
        { k: 'logoSize', label: 'حجم اللوجو', type: 'range', min: 28, max: 120, unit: 'px' },
        { k: 'logoRadius', label: 'استدارة اللوجو (0 مربع – 50 دائرة)', type: 'range', min: 0, max: 50, unit: '%' },
      ]],
      ['محركات البحث (SEO)', [
        { k: 'seo.title', label: 'عنوان الموقع في جوجل', full: true }, { k: 'seo.description', label: 'وصف الموقع في جوجل', type: 'textarea' },
      ]],
    ]),

    design: settingsPage([
      ['الألوان', [
        { k: 'colors.primary', label: 'اللون الرئيسي', type: 'color' }, { k: 'colors.accent', label: 'اللون الثانوي (الذهبي)', type: 'color' },
        { k: 'colors.background', label: 'لون خلفية الموقع', type: 'color' }, { k: 'colors.surface', label: 'لون البطاقات', type: 'color' },
        { k: 'colors.text', label: 'لون النص', type: 'color' }, { k: 'colors.footerBg', label: 'لون الفوتر', type: 'color' },
        { k: 'colors.headerBg', label: 'لون الهيدر (اتركه فارغاً للشفاف)', type: 'color', optional: true },
      ]],
      ['الوضع الليلي', [
        { k: 'defaultTheme', label: 'الوضع الافتراضي للزوار', type: 'select', opts: [['auto', 'تلقائي حسب جهاز الزائر'], ['light', 'نهاري'], ['dark', 'ليلي']] },
        { k: 'colors.darkBackground', label: 'خلفية الوضع الليلي', type: 'color' }, { k: 'colors.darkSurface', label: 'بطاقات الوضع الليلي', type: 'color' },
      ]],
      ['الخطوط والأحجام', [
        { k: 'fontFamily', label: 'خط النصوص', type: 'font', hint: 'لتغيير خط كل جزء بشكل منفصل افتح صفحة "الخطوط لكل قسم"' }, { k: 'headingFont', label: 'خط العناوين', type: 'font' },
        { k: 'baseFontSize', label: 'حجم الخط الأساسي', type: 'range', min: 13, max: 20, unit: 'px' },
        { k: 'radius', label: 'استدارة الزوايا', type: 'range', min: 0, max: 32, unit: 'px' },
      ]],
      ['CSS مخصص (متقدم)', [{ k: 'customCss', label: 'كود CSS إضافي', type: 'textarea', code: true, hint: 'للتحكم الدقيق بأي تفصيل في التصميم. مثال: .card-title{font-size:18px}' }]],
    ]),

    async typography(c) {
      A.settings = await api('/settings');
      loadPreviewFonts();
      const typo = JSON.parse(JSON.stringify(A.settings.typography || {}));
      const base = A.settings.fontFamily;
      const row = (key, label) => {
        const t = typo[key] || {};
        return `<tr data-row="${key}">
          <td><b>${esc(label)}</b><div class="typo-prev" data-prev="${key}">الجليل – طبيعة نقية 123 ₪</div></td>
          <td><select class="sel" data-t="font"><option value="">افتراضي</option>${FONTS.map((f) => `<option value="${f}" ${t.font === f ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select></td>
          <td><div class="row" style="flex-wrap:nowrap"><input class="in" type="number" min="0" max="120" data-t="size" value="${t.size || ''}" placeholder="افتراضي" style="width:96px"><span class="muted">px</span></div></td>
          <td><select class="sel" data-t="weight"><option value="">افتراضي</option><option value="normal" ${t.weight === 'normal' ? 'selected' : ''}>عادي</option><option value="bold" ${t.weight === 'bold' ? 'selected' : ''}>عريض</option></select></td>
          <td><div class="color-in"><input type="color" value="${esc(t.color || '#2f5d3a')}" data-t-picker><input class="in" data-t="color" value="${esc(t.color || '')}" placeholder="افتراضي" dir="ltr" style="width:100px"></div></td>
          <td><button type="button" class="btn btn-sec btn-sm" data-reset="${key}">↺</button></td></tr>`;
      };
      c.innerHTML = `<div class="alert">🔤 اختر لكل جزء من الموقع خطاً وحجماً ووزناً ولوناً خاصاً به. أي خانة تتركها على "افتراضي" تأخذ الإعدادات العامة من صفحة "الألوان والخطوط" (الخط العام حالياً: <b>${esc(base)}</b>). الأحجام على الموبايل تُصغَّر تلقائياً.</div>
        ${TYPO_PARTS.map(([group, parts]) => `<div class="card"><div class="card-head"><h3>${group}</h3></div><div class="table-wrap"><table class="typo-table"><thead><tr><th>الجزء</th><th>الخط</th><th>الحجم</th><th>الوزن</th><th>اللون</th><th></th></tr></thead><tbody>${parts.map(([k, l]) => row(k, l)).join('')}</tbody></table></div></div>`).join('')}
        <div class="save-bar"><button type="button" class="btn btn-sec" id="typoResetAll">إرجاع الكل للافتراضي</button><a class="btn btn-sec" href="/" target="_blank">${ICON.ext} معاينة المتجر</a><button type="button" class="btn" id="typoSave">💾 حفظ الخطوط</button></div>`;
      const readRow = (tr) => {
        const o = {};
        $$('[data-t]', tr).forEach((el) => { const v = el.value.trim(); if (v) o[el.dataset.t] = el.dataset.t === 'size' ? Number(v) : v; });
        return o;
      };
      const preview = (tr) => {
        const t = readRow(tr);
        const pv = $('[data-prev]', tr);
        pv.style.fontFamily = `'${t.font || base}', sans-serif`;
        pv.style.fontSize = t.size ? Math.min(t.size, 40) + 'px' : '';
        pv.style.fontWeight = t.weight === 'bold' ? 700 : t.weight === 'normal' ? 400 : '';
        pv.style.color = /^#[0-9a-f]{3,8}$/i.test(t.color || '') ? t.color : '';
      };
      $$('[data-row]', c).forEach((tr) => {
        preview(tr);
        tr.addEventListener('input', (e) => {
          if (e.target.matches('[data-t-picker]')) $('[data-t="color"]', tr).value = e.target.value;
          if (e.target.matches('[data-t="color"]') && /^#[0-9a-f]{6}$/i.test(e.target.value)) $('[data-t-picker]', tr).value = e.target.value;
          preview(tr);
        });
        tr.addEventListener('change', () => preview(tr));
      });
      $$('[data-reset]', c).forEach((b) => (b.onclick = () => { const tr = b.closest('tr'); $$('[data-t]', tr).forEach((el) => (el.value = '')); preview(tr); }));
      $('#typoResetAll').onclick = () => $$('[data-row]', c).forEach((tr) => { $$('[data-t]', tr).forEach((el) => (el.value = '')); preview(tr); });
      $('#typoSave').onclick = async () => {
        const out = {};
        $$('[data-row]', c).forEach((tr) => { const t = readRow(tr); if (Object.keys(t).length) out[tr.dataset.row] = t; });
        try {
          A.settings = await api('/settings', 'PUT', { typography: out });
          toast('✓ تم حفظ الخطوط – التغييرات ظاهرة الآن في المتجر');
        } catch (e) { toast(e.message, 'err'); }
      };
    },

    contact: settingsPage([
      ['معلومات التواصل', [
        { k: 'contact.whatsapp', label: 'رقم واتساب (بالصيغة الدولية)', ltr: true, hint: 'مثال: 972501234567 – بدون + أو أصفار في البداية' },
        { k: 'contact.phone', label: 'رقم الهاتف', ltr: true }, { k: 'contact.email', label: 'البريد الإلكتروني', ltr: true },
        { k: 'contact.hours', label: 'ساعات العمل' }, { k: 'contact.address', label: 'العنوان', full: true },
        { k: 'contact.mapsUrl', label: 'رابط الموقع على Google Maps', ltr: true, full: true },
      ]],
      ['مواقع التواصل الاجتماعي', [
        { k: 'contact.instagram', label: 'رابط إنستغرام', ltr: true }, { k: 'contact.facebook', label: 'رابط فيسبوك', ltr: true }, { k: 'contact.tiktok', label: 'رابط تيك توك', ltr: true },
      ]],
    ]),

    shop: settingsPage([
      ['الشحن والطلبات', [
        { k: 'shop.currency', label: 'رمز العملة', hint: 'الشيكل: ₪' }, { k: 'shop.shippingFee', label: 'رسوم التوصيل', type: 'number', min: 0 },
        { k: 'shop.freeShippingOver', label: 'توصيل مجاني للطلبات فوق (0 = بدون)', type: 'number', min: 0 }, { k: 'shop.minOrder', label: 'الحد الأدنى للطلب (0 = بدون)', type: 'number', min: 0 },
        { k: 'shop.shippingNote', label: 'ملاحظة التوصيل', full: true },
        { k: 'shop.lowStockAlert', label: 'تنبيه عند انخفاض المخزون إلى', type: 'number', min: 0 },
        { k: 'shop.requireLocation', label: 'إلزام الزبون بتحديد موقعه', type: 'bool' },
        { k: 'shop.autoApproveReviews', label: 'نشر تقييمات الزبائن تلقائياً دون مراجعة', type: 'bool' },
      ]],
    ], '<div class="alert ok">💵 طريقة الدفع الوحيدة: الدفع عند الاستلام. خصومات المنتجات (%) والكوبونات تُحسب تلقائياً على الخادم.</div>'),

    async coupons(c) {
      const list = await api('/coupons');
      c.innerHTML = `<div class="card"><div class="card-head"><h3>كوبونات الخصم</h3><button class="btn" id="addK">${ICON.plus} كوبون جديد</button></div>
        ${list.length ? `<div class="table-wrap"><table><thead><tr><th>الكود</th><th>الخصم</th><th>حد أدنى</th><th>ينتهي</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${list.map((k) => `<tr><td><b dir="ltr">${esc(k.code)}</b></td><td>${k.type === 'percent' ? k.value + '%' : money(k.value)}</td><td>${k.minTotal ? money(k.minTotal) : '—'}</td><td>${esc(k.expires || 'بدون')}</td><td>${k.active ? pill('delivered', { delivered: 'فعّال' }) : pill('cancelled', { cancelled: 'متوقف' })}</td>
          <td><button class="btn btn-sec btn-icon" data-edit="${k.id}">${ICON.edit}</button> <button class="btn btn-sec btn-icon" data-del="${k.id}">${ICON.trash}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">لا توجد كوبونات</div>'}</div>`;
      const fields = [
        { k: 'code', label: 'الكود', ltr: true }, { k: 'type', label: 'نوع الخصم', type: 'select', opts: [['percent', 'نسبة مئوية %'], ['fixed', 'مبلغ ثابت ₪']] },
        { k: 'value', label: 'قيمة الخصم', type: 'number', min: 0 }, { k: 'minTotal', label: 'الحد الأدنى للطلب', type: 'number', min: 0 },
        { k: 'expires', label: 'تاريخ الانتهاء (اختياري) YYYY-MM-DD', ltr: true }, { k: 'active', label: 'فعّال', type: 'bool' },
      ];
      const edit = (k) => crudModal(k ? 'تعديل كوبون' : 'كوبون جديد', fields, k || { type: 'percent', value: 10, active: true }, (data) => api(k ? '/coupons/' + k.id : '/coupons', k ? 'PUT' : 'POST', data), 'sm');
      $('#addK').onclick = () => edit(null);
      $$('[data-edit]', c).forEach((b) => (b.onclick = () => edit(list.find((k) => k.id === b.dataset.edit))));
      $$('[data-del]', c).forEach((b) => (b.onclick = async () => { if (confirmDo('حذف الكوبون؟')) { await api('/coupons/' + b.dataset.del, 'DELETE'); route(); } }));
    },

    async ai(c) {
      const me = await api('/me');
      await settingsPage([
        ['المستشار الذكي', [
          { k: 'ai.enabled', label: 'تفعيل المستشار الذكي في المتجر', type: 'bool' }, { k: 'ai.assistantName', label: 'اسم المستشار' },
          { k: 'ai.welcome', label: 'رسالة الترحيب', type: 'textarea' },
          { k: 'ai.suggestions', label: 'أسئلة مقترحة تظهر للزبون (كل سطر سؤال)', type: 'lines' },
          { k: 'ai.extraInstructions', label: 'تعليمات إضافية للمستشار', type: 'textarea', hint: 'مثال: ركّز على منتجات المتجر، أو لا تقترح أعشاباً غير متوفرة لدينا، أو أضف معلومة عن عروض حالية.' },
        ]],
      ], me.aiConfigured
        ? `<div class="alert ok">✅ المستشار متصل بنموذج الذكاء الاصطناعي (${esc(me.aiModel)}). المستشار يعرف كل منتجاتك وأسعارك تلقائياً.</div>`
        : '<div class="alert err">⚠️ لم يتم ضبط مفتاح الذكاء الاصطناعي بعد. أضف متغير البيئة <b dir="ltr">ANTHROPIC_API_KEY</b> في إعدادات الاستضافة ثم أعد تشغيل الموقع (راجع ملف README).</div>')(c);
    },

    async users(c) {
      const list = await api('/users');
      const ROLE = { owner: 'مالك (كل الصلاحيات)', admin: 'مدير (كل شيء عدا المستخدمين)', editor: 'محرر (المنتجات والمحتوى)', orders: 'موظف طلبات (الطلبات فقط)' };
      c.innerHTML = `<div class="card"><div class="card-head"><h3>المستخدمون المسموح لهم بالدخول</h3><button class="btn" id="addU">${ICON.plus} مستخدم جديد</button></div>
        <div class="table-wrap"><table><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${list.map((u) => `<tr><td><b>${esc(u.name)}</b></td><td dir="ltr" style="text-align:end">${esc(u.username)}</td><td>${ROLE[u.role]}</td><td>${u.active ? pill('delivered', { delivered: 'فعّال' }) : pill('cancelled', { cancelled: 'موقوف' })}</td>
          <td><button class="btn btn-sec btn-icon" data-edit="${u.id}">${ICON.edit}</button> ${u.id !== A.user.id ? `<button class="btn btn-sec btn-icon" data-del="${u.id}">${ICON.trash}</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
      const roles = Object.entries(ROLE);
      $('#addU').onclick = () => crudModal('مستخدم جديد', [
        { k: 'name', label: 'الاسم' }, { k: 'username', label: 'اسم المستخدم (إنجليزي)', ltr: true }, { k: 'password', label: 'كلمة المرور', ltr: true },
        { k: 'role', label: 'الصلاحية', type: 'select', opts: roles },
      ], { role: 'editor' }, (d) => api('/users', 'POST', d), 'sm');
      $$('[data-edit]', c).forEach((b) => (b.onclick = () => {
        const u = list.find((x) => x.id === b.dataset.edit);
        crudModal('تعديل ' + u.username, [
          { k: 'name', label: 'الاسم' }, { k: 'role', label: 'الصلاحية', type: 'select', opts: roles },
          { k: 'password', label: 'كلمة مرور جديدة (اتركها فارغة لعدم التغيير)', ltr: true }, { k: 'active', label: 'فعّال', type: 'bool' },
        ], { ...u, password: '' }, (d) => api('/users/' + u.id, 'PUT', d), 'sm');
      }));
      $$('[data-del]', c).forEach((b) => (b.onclick = async () => { if (confirmDo('حذف المستخدم؟')) { try { await api('/users/' + b.dataset.del, 'DELETE'); route(); } catch (e) { toast(e.message, 'err'); } } }));
    },

    async backup(c) {
      c.innerHTML = `<div class="card"><div class="card-head"><h3>💾 تنزيل نسخة احتياطية</h3></div><p>ملف واحد يحتوي كل بيانات المتجر: المنتجات، الطلبات، الإعدادات، المستخدمين. ننصح بتنزيل نسخة أسبوعياً.</p><a class="btn" href="/api/admin/backup">⬇ تنزيل النسخة الآن</a></div>
        <div class="card"><div class="card-head"><h3>♻️ استعادة نسخة احتياطية</h3></div><div class="alert err">تحذير: الاستعادة تستبدل كل البيانات الحالية بالبيانات الموجودة في الملف.</div>
        <label class="btn btn-sec">اختيار ملف النسخة (.json)<input type="file" accept=".json,application/json" id="restoreIn" hidden></label></div>
        <div class="card"><div class="card-head"><h3>ملاحظة عن الصور</h3></div><p class="muted">الصور المرفوعة محفوظة في مجلد <code dir="ltr">data/uploads</code> على الخادم. عند نقل الموقع لخادم آخر انقل مجلد <code dir="ltr">data</code> كاملاً.</p></div>`;
      $('#restoreIn').onchange = async (e) => {
        const f = e.target.files[0];
        if (!f || !confirmDo('هل أنت متأكد؟ سيتم استبدال كل البيانات الحالية.')) return;
        try { await api('/restore', 'POST', JSON.parse(await f.text())); toast('✓ تمت الاستعادة'); setTimeout(() => location.reload(), 800); } catch (err) { toast(err.message || 'ملف غير صالح', 'err'); }
      };
    },

    async account(c) {
      c.innerHTML = `<div class="card" style="max-width:520px"><div class="card-head"><h3>تغيير كلمة المرور</h3></div>
        <p class="muted">أنت مسجّل باسم <b dir="ltr">${esc(A.user.username)}</b></p>
        <form id="pwForm" style="display:grid;gap:12px">
          <div class="f"><label>كلمة المرور الحالية</label><input class="in" type="password" name="current" required dir="ltr" autocomplete="current-password"></div>
          <div class="f"><label>كلمة المرور الجديدة</label><input class="in" type="password" name="password" required minlength="6" dir="ltr" autocomplete="new-password"></div>
          <div class="f"><label>تأكيد كلمة المرور الجديدة</label><input class="in" type="password" name="confirm" required dir="ltr" autocomplete="new-password"></div>
          <button class="btn">حفظ كلمة المرور</button></form></div>`;
      $('#pwForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        if (f.password !== f.confirm) return toast('كلمتا المرور غير متطابقتين', 'err');
        try { await api('/me/password', 'POST', f); toast('✓ تم تغيير كلمة المرور'); e.target.reset(); } catch (err) { toast(err.message, 'err'); }
      };
    },
  };

  // ---------------------------------------------------------------- الطلبات
  function ordersTable(list) {
    if (!list.length) return '<div class="empty">لا توجد طلبات بعد</div>';
    return `<div class="table-wrap"><table><thead><tr><th>#</th><th>التاريخ</th><th>الزبون</th><th>البلدة</th><th>الهاتف</th><th>المنتجات</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody>
      ${list.map((o) => `<tr class="clickable ${o.seen ? '' : 'unseen'}" data-order="${o.id}"><td><b>#${o.number}</b></td><td style="white-space:nowrap">${dt(o.createdAt)}</td><td>${esc(o.customer.firstName + ' ' + o.customer.lastName)}</td><td>${esc(o.customer.town)}</td>
        <td dir="ltr" style="text-align:end">${esc(o.customer.phone)}</td><td>${o.items.reduce((a, i) => a + i.qty, 0)} قطعة</td><td><b>${money(o.total)}</b></td><td>${pill(o.status)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function bindOrderRows(root, list) {
    $$('[data-order]', root).forEach((r) => (r.onclick = () => orderModal(list.find((o) => o.id === r.dataset.order))));
  }

  async function orderModal(o) {
    if (!o.seen) { api('/orders/' + o.id, 'PUT', { seen: true }).then(() => refreshCounts()); o.seen = true; }
    const c = o.customer;
    const name = `${c.firstName} ${c.lastName}`;
    const loc = c.location ? `https://maps.google.com/?q=${c.location.lat},${c.location.lng}` : '';
    const msg = `مرحباً ${c.firstName}، معك متجر ${A.settings.storeName} 🌿\nنؤكد استلام طلبك رقم #${o.number} بقيمة ${money(o.total)} (الدفع عند الاستلام).\n${o.items.map((i) => `• ${i.name} × ${i.qty}`).join('\n')}\nسيتم التوصيل إلى: ${c.town} – ${c.address}`;
    const m = modal(`طلب #${o.number} ${pill(o.status)}`, `
      <div class="grid2" style="grid-template-columns:1fr 1fr">
        <div><h4>👤 معلومات الزبون</h4><dl class="kv">
          <dt>الاسم</dt><dd>${esc(name)}</dd>
          <dt>الهاتف</dt><dd dir="ltr" style="text-align:end"><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></dd>
          ${c.phone2 ? `<dt>هاتف إضافي</dt><dd dir="ltr" style="text-align:end"><a href="tel:${esc(c.phone2)}">${esc(c.phone2)}</a></dd>` : ''}
          <dt>البلدة</dt><dd>${esc(c.town)}</dd>
          <dt>العنوان</dt><dd>${esc(c.address)}</dd>
          <dt>الموقع</dt><dd>${loc ? `<a href="${loc}" target="_blank" rel="noopener">📍 فتح على الخريطة</a> <span class="muted">(دقة ${c.location.accuracy || '?'} م)</span>` : ''}${c.locationLink ? `<div><a href="${esc(safeUrl(c.locationLink) || '#')}" target="_blank" rel="noopener">🔗 رابط الموقع من الزبون</a></div>` : ''}${!loc && !c.locationLink ? '<span class="muted">لم يحدد</span>' : ''}</dd>
          ${c.notes ? `<dt>ملاحظات</dt><dd>${esc(c.notes)}</dd>` : ''}
          <dt>تاريخ الطلب</dt><dd>${dt(o.createdAt)}</dd>
          <dt>الدفع</dt><dd>💵 عند الاستلام</dd></dl></div>
        <div class="no-print"><h4>⚙️ إدارة الطلب</h4>
          <div class="f"><label>حالة الطلب</label><select class="sel" id="oStatus">${Object.entries(STATUS).map(([k, t]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="f" style="margin-top:10px"><label>ملاحظة داخلية</label><textarea class="ta" id="oNote" style="min-height:70px">${esc(o.adminNote || '')}</textarea></div>
          <div class="row" style="margin-top:10px"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${esc(waTo(c.phone, msg))}">💬 واتساب للزبون</a><a class="btn btn-sec btn-sm" href="tel:${esc(c.phone)}">📞 اتصال</a></div>
          ${(o.history || []).length ? `<div class="muted" style="font-size:.82em;margin-top:12px">${o.history.map((h) => `${STATUS[h.status]} – ${dt(h.at)}${h.by ? ' (' + esc(h.by) + ')' : ''}`).join('<br>')}</div>` : ''}
        </div>
      </div>
      <h4 style="margin-top:18px">🛒 المنتجات</h4>
      <div class="table-wrap"><table><thead><tr><th></th><th>المنتج</th><th>السعر</th><th>الخصم</th><th>الكمية</th><th>المجموع</th></tr></thead><tbody>
        ${o.items.map((i) => `<tr><td><img class="thumb" src="${esc(safeUrl(i.image))}" alt=""></td><td>${esc(i.name)} <span class="muted">${esc(i.size || '')}</span></td><td>${i.discount ? `<s class="muted">${money(i.price)}</s> ` : ''}${money(i.unitFinal)}</td><td>${i.discount ? i.discount + '%' : '—'}</td><td>${i.qty}</td><td><b>${money(i.lineTotal)}</b></td></tr>`).join('')}
      </tbody></table></div>
      <div class="sum" style="margin-top:12px">
        <div><span>المجموع قبل الخصم</span><span>${money(o.subtotal)}</span></div>
        ${o.productDiscount ? `<div style="color:var(--err)"><span>خصم المنتجات</span><span>-${money(o.productDiscount)}</span></div>` : ''}
        ${o.couponDiscount ? `<div style="color:var(--err)"><span>كوبون ${esc(o.couponCode)}</span><span>-${money(o.couponDiscount)}</span></div>` : ''}
        <div><span>التوصيل</span><span>${o.shipping ? money(o.shipping) : 'مجاني'}</span></div>
        <div class="t"><span>المطلوب تحصيله</span><span>${money(o.total)}</span></div>
      </div>`,
      `<button class="btn btn-err" id="oDel" style="margin-inline-end:auto">${ICON.trash} حذف</button><button class="btn btn-sec" onclick="window.print()">🖨 طباعة</button><button class="btn" id="oSave">💾 حفظ</button>`);
    $('#oSave', m).onclick = async () => {
      try { await api('/orders/' + o.id, 'PUT', { status: $('#oStatus').value, adminNote: $('#oNote').value }); toast('✓ تم تحديث الطلب'); closeModal(); route(); refreshCounts(); } catch (e) { toast(e.message, 'err'); }
    };
    $('#oDel', m).onclick = async () => { if (confirmDo('حذف الطلب نهائياً؟ (لإرجاع المخزون غيّر الحالة إلى "ملغي" بدلاً من الحذف)')) { await api('/orders/' + o.id, 'DELETE'); closeModal(); route(); refreshCounts(); } };
  }

  function blendModal(b) {
    if (!b.seen) { api('/blends/' + b.id, 'PUT', { seen: true }).then(() => refreshCounts()); b.seen = true; }
    const c = b.customer;
    const bl = b.blend;
    const msg = `مرحباً ${c.firstName}، معك متجر ${A.settings.storeName} 🌿\nبخصوص طلبك لـ "${bl.title}" (رقم #${b.number}) عبر المستشار الذكي، يسعدنا تحضيرها لك.`;
    const m = modal(`طلب خلطة #${b.number} ${pill(b.status, BSTATUS)}`, `
      <div class="grid2" style="grid-template-columns:1fr 1fr">
        <div><h4>👤 الزبون</h4><dl class="kv"><dt>الاسم</dt><dd>${esc(c.firstName + ' ' + c.lastName)}</dd><dt>البلدة</dt><dd>${esc(c.town)}</dd>
          <dt>الهاتف</dt><dd dir="ltr" style="text-align:end"><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></dd>${c.notes ? `<dt>ملاحظات</dt><dd>${esc(c.notes)}</dd>` : ''}<dt>التاريخ</dt><dd>${dt(b.createdAt)}</dd></dl>
          <div class="row" style="margin-top:10px"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${esc(waTo(c.phone, msg))}">💬 واتساب</a><a class="btn btn-sec btn-sm" href="tel:${esc(c.phone)}">📞 اتصال</a></div></div>
        <div class="no-print"><h4>⚙️ الإدارة</h4>
          <div class="f"><label>الحالة</label><select class="sel" id="bStatus">${Object.entries(BSTATUS).map(([k, t]) => `<option value="${k}" ${b.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="f" style="margin-top:10px"><label>السعر المتفق عليه</label><input class="in" type="number" id="bPrice" value="${b.price || ''}" min="0"></div>
          <div class="f" style="margin-top:10px"><label>ملاحظة داخلية</label><textarea class="ta" id="bNote" style="min-height:60px">${esc(b.adminNote || '')}</textarea></div></div>
      </div>
      <h4 style="margin-top:18px">🍵 ${esc(bl.title)}</h4>${bl.purpose ? `<p class="muted">${esc(bl.purpose)}</p>` : ''}
      ${bl.ingredients.length ? `<div class="ing">${bl.ingredients.map((i) => `<div><b>${esc(i.name)}</b><span class="muted">${esc(i.amount)}</span></div>`).join('')}</div>` : ''}
      <dl class="kv" style="margin-top:12px">${bl.preparation ? `<dt>التحضير</dt><dd>${esc(bl.preparation)}</dd>` : ''}${bl.usage ? `<dt>الاستعمال</dt><dd>${esc(bl.usage)}</dd>` : ''}${bl.duration ? `<dt>المدة</dt><dd>${esc(bl.duration)}</dd>` : ''}${bl.warnings ? `<dt>تحذيرات</dt><dd>${esc(bl.warnings)}</dd>` : ''}</dl>
      ${b.conversation.length ? `<details style="margin-top:16px" class="no-print"><summary style="cursor:pointer;font-weight:700">💬 عرض المحادثة كاملة (${b.conversation.length} رسالة)</summary><div class="chat-view" style="margin-top:10px">${b.conversation.map((x) => `<div class="m ${x.role === 'user' ? 'u' : 'a'}">${esc(x.content)}</div>`).join('')}</div></details>` : ''}`,
      `<button class="btn btn-err" id="bDel" style="margin-inline-end:auto">${ICON.trash} حذف</button><button class="btn btn-sec" onclick="window.print()">🖨 طباعة</button><button class="btn" id="bSave">💾 حفظ</button>`);
    $('#bSave', m).onclick = async () => {
      try { await api('/blends/' + b.id, 'PUT', { status: $('#bStatus').value, price: $('#bPrice').value, adminNote: $('#bNote').value }); toast('✓ تم الحفظ'); closeModal(); route(); } catch (e) { toast(e.message, 'err'); }
    };
    $('#bDel', m).onclick = async () => { if (confirmDo('حذف الطلب؟')) { await api('/blends/' + b.id, 'DELETE'); closeModal(); route(); refreshCounts(); } };
  }

  function exportCSV(list) {
    const rows = [['رقم الطلب', 'التاريخ', 'الاسم', 'العائلة', 'الهاتف', 'البلدة', 'العنوان', 'الموقع', 'المنتجات', 'المجموع', 'الخصم', 'الكوبون', 'التوصيل', 'الإجمالي', 'الحالة', 'ملاحظات']];
    for (const o of list) {
      const c = o.customer;
      rows.push([o.number, new Date(o.createdAt).toLocaleString('en-GB'), c.firstName, c.lastName, c.phone, c.town, c.address, c.location ? `${c.location.lat},${c.location.lng}` : c.locationLink || '',
        o.items.map((i) => `${i.name} x${i.qty}`).join(' | '), o.subtotal, o.productDiscount, o.couponDiscount, o.shipping, o.total, STATUS[o.status], c.notes]);
    }
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // ---------------------------------------------------------------- المنتجات
  function crudModal(title, fields, data, save, size = '') {
    const m = modal(title, `<form id="cform" class="form">${fields.map((f) => fieldHTML(f, get(data, f.k))).join('')}</form>`, `<button class="btn btn-sec" data-mclose>إلغاء</button><button class="btn" id="cSave">💾 حفظ</button>`, size);
    bindUploads(m);
    $('#cSave', m).onclick = async () => {
      const out = readFields($('#cform', m), JSON.parse(JSON.stringify(data)));
      try { await save(out); toast('✓ تم الحفظ'); closeModal(); route(); } catch (e) { toast(e.message, 'err'); }
    };
  }

  function productModal(p) {
    const d = p ? JSON.parse(JSON.stringify(p)) : { active: true, images: [], benefits: [], discount: 0, stock: 10, categoryId: (A.cache.categories[0] || {}).id };
    const cats = A.cache.categories.map((k) => [k.id, k.name]);
    const fields1 = [
      { k: 'name', label: 'اسم المنتج', full: true },
      { k: 'categoryId', label: 'القسم', type: 'select', opts: [['', '— بدون —'], ...cats] }, { k: 'size', label: 'الحجم / الوزن', placeholder: 'مثال: 100 مل' },
      { k: 'price', label: 'السعر الأصلي (₪)', type: 'number', min: 0 }, { k: 'discount', label: 'نسبة الخصم %', type: 'number', min: 0, max: 100, hint: 'السعر بعد الخصم يُحسب تلقائياً' },
      { k: 'stock', label: 'الكمية في المخزون', type: 'number', min: 0 },
    ];
    const fields2 = [
      { k: 'shortDesc', label: 'وصف قصير (يظهر تحت الاسم)', full: true }, { k: 'description', label: 'الوصف الكامل', type: 'textarea' },
      { k: 'benefits', label: 'الفوائد (كل سطر فائدة)', type: 'lines' }, { k: 'usage', label: 'طريقة الاستعمال', type: 'textarea' },
      { k: 'ingredients', label: 'المكونات', type: 'textarea' }, { k: 'warnings', label: 'تحذيرات', type: 'textarea' },
      { k: 'featured', label: '⭐ منتج مميز (يظهر في الرئيسية)', type: 'bool' }, { k: 'bestseller', label: '🔥 الأكثر مبيعاً', type: 'bool' },
      { k: 'isNew', label: '🆕 منتج جديد', type: 'bool' }, { k: 'active', label: 'ظاهر في المتجر', type: 'bool' },
    ];
    const m = modal(p ? 'تعديل منتج' : 'منتج جديد', `<form id="pform" class="form">${fields1.map((f) => fieldHTML(f, get(d, f.k))).join('')}
      <div class="f full"><label>السعر بعد الخصم</label><div id="finalP" style="font-weight:800;font-size:1.2em;color:var(--p)"></div></div>
      <div class="f full"><label>صور المنتج (الأولى هي الرئيسية)</label><div class="imgs-list" id="imgs"></div>
        <div class="row" style="margin-top:8px"><input class="in" id="imgUrl" placeholder="أو الصق رابط صورة" dir="ltr" style="flex:1"><button type="button" class="btn btn-sec btn-sm" id="imgUrlAdd">إضافة الرابط</button></div></div>
      ${fields2.map((f) => fieldHTML(f, get(d, f.k))).join('')}</form>`,
      `<button class="btn btn-sec" data-mclose>إلغاء</button><button class="btn" id="pSave">💾 حفظ المنتج</button>`);
    const calc = () => {
      const price = Number($('[data-k="price"]', m).value) || 0, disc = Number($('[data-k="discount"]', m).value) || 0;
      $('#finalP').innerHTML = disc ? `${money(Math.round(price * (1 - disc / 100) * 100) / 100)} <s class="muted" style="font-size:.8em">${money(price)}</s>` : money(price);
    };
    $('[data-k="price"]', m).oninput = calc; $('[data-k="discount"]', m).oninput = calc; calc();
    const drawImgs = () => {
      $('#imgs').innerHTML = d.images.map((u, i) => `<div class="it"><img src="${esc(safeUrl(u))}" alt=""><button type="button" class="x" data-ix="${i}">×</button><div class="mv">${i ? `<button type="button" data-first="${i}" title="اجعلها الرئيسية">★</button>` : ''}</div></div>`).join('') +
        `<label class="add">⬆<br>رفع صور<input type="file" accept="image/*" multiple hidden id="imgFiles"></label>`;
      $$('[data-ix]', m).forEach((b) => (b.onclick = () => { d.images.splice(+b.dataset.ix, 1); drawImgs(); }));
      $$('[data-first]', m).forEach((b) => (b.onclick = () => { const [x] = d.images.splice(+b.dataset.first, 1); d.images.unshift(x); drawImgs(); }));
      $('#imgFiles').onchange = async (e) => {
        for (const f of e.target.files) { try { toast('جارٍ رفع ' + f.name); d.images.push(await uploadFile(f)); drawImgs(); } catch (err) { toast(err.message, 'err'); } }
      };
    };
    drawImgs();
    $('#imgUrlAdd').onclick = () => { const u = $('#imgUrl').value.trim(); if (safeUrl(u)) { d.images.push(u); $('#imgUrl').value = ''; drawImgs(); } else toast('رابط غير صالح', 'err'); };
    $('#pSave', m).onclick = async () => {
      const out = readFields($('#pform', m), d);
      try { await api(p ? '/products/' + p.id : '/products', p ? 'PUT' : 'POST', out); toast('✓ تم حفظ المنتج'); closeModal(); route(); } catch (e) { toast(e.message, 'err'); }
    };
  }

  // ---------------------------------------------------------------- التشغيل
  async function boot() {
    A.settings = await api('/settings');
    renderLayout();
    window.onhashchange = route;
    route();
    await refreshCounts(true);
    clearInterval(A.poll);
    A.poll = setInterval(() => refreshCounts(), 20000);
  }

  (async () => {
    try {
      const r = await fetch('/api/admin/me');
      if (!r.ok) return renderLogin();
      A.user = (await r.json()).user;
      boot();
    } catch { renderLogin(); }
  })();
})();
