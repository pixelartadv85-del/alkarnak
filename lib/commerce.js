// منطق الأسعار والمخزون والتوصيل والتقارير – مشترك بين الخادم والمتصفح والنسخة التجريبية.
// يعمل في Node (require) وفي المتصفح (window.Commerce).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Commerce = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const round2 = (n) => Math.round(n * 100) / 100;
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const clampPct = (d) => Math.min(100, Math.max(0, num(d)));
  const applyDiscount = (price, discount) => round2(num(price) * (1 - clampPct(discount) / 100));

  // ---------------------------------------------------------------- الأحجام (Variants)
  // المنتج إما بسعر ومخزون واحد، أو بقائمة أحجام لكل منها اسم وسعر ومخزون. نسبة الخصم على مستوى المنتج.
  const hasVariants = (p) => Array.isArray(p.variants) && p.variants.length > 0;

  function option(p, variantId) {
    if (!hasVariants(p)) return { variant: null, label: p.size || '', price: num(p.price), stock: num(p.stock) };
    const v = p.variants.find((x) => x.id === variantId) || (variantId ? null : p.variants[0]);
    if (!v) return null;
    return { variant: v, label: v.name, price: num(v.price), stock: num(v.stock) };
  }

  function totalStock(p) {
    return hasVariants(p) ? p.variants.reduce((a, v) => a + Math.max(0, num(v.stock)), 0) : num(p.stock);
  }

  // سعر العرض في البطاقات: أرخص حجم متوفر (أو أرخص حجم إن لم يتوفر شيء)
  function displayPrice(p) {
    if (!hasVariants(p)) return { price: num(p.price), finalPrice: applyDiscount(p.price, p.discount), from: false };
    const pool = p.variants.filter((v) => num(v.stock) > 0);
    const cheapest = (pool.length ? pool : p.variants).reduce((a, v) => (num(v.price) < num(a.price) ? v : a));
    return { price: num(cheapest.price), finalPrice: applyDiscount(cheapest.price, p.discount), from: p.variants.length > 1 };
  }

  // ---------------------------------------------------------------- مناطق التوصيل
  const zones = (settings) => (Array.isArray(settings.shop.zones) ? settings.shop.zones.filter((z) => z && z.name) : []);

  function shippingFor(settings, net, zoneId, hasLines) {
    const shop = settings.shop;
    const list = zones(settings);
    const zone = list.length ? list.find((z) => z.id === zoneId) || null : null;
    const fee = zone ? num(zone.fee) : num(shop.shippingFee);
    const freeOver = zone && num(zone.freeOver) > 0 ? num(zone.freeOver) : num(shop.freeShippingOver);
    const shipping = !hasLines ? 0 : freeOver > 0 && net >= freeOver ? 0 : fee;
    return { shipping, zone, freeOver, needsZone: list.length > 0 && !zone };
  }

  // ---------------------------------------------------------------- الكوبونات والسلة
  function findCoupon(db, code) {
    if (!code) return null;
    const c = (db.coupons || []).find((k) => k.active && k.code.toLowerCase() === String(code).trim().toLowerCase());
    if (!c) return null;
    if (c.expires && new Date(c.expires + 'T23:59:59') < new Date()) return null;
    return c;
  }

  // يحسب السلة من بيانات المتجر فقط (لا يثق بأي سعر قادم من المتصفح)
  function priceCart(db, items, couponCode, zoneId) {
    const lines = [];
    for (const it of Array.isArray(items) ? items : []) {
      const p = db.products.find((x) => x.id === (it && it.id) && x.active);
      if (!p) continue;
      const o = option(p, it.variant || '');
      if (!o) continue;
      const qty = Math.max(1, Math.min(99, Math.floor(num(it.qty, 1))));
      const unit = applyDiscount(o.price, p.discount);
      lines.push({
        productId: p.id, variantId: o.variant ? o.variant.id : '', name: p.name, size: o.label, image: (p.images || [])[0] || '',
        price: o.price, discount: num(p.discount), unitFinal: unit, qty, lineTotal: round2(unit * qty), stock: o.stock,
      });
    }
    const subtotal = round2(lines.reduce((a, l) => a + l.price * l.qty, 0));
    const productDiscount = round2(lines.reduce((a, l) => a + (l.price - l.unitFinal) * l.qty, 0));
    const afterDiscount = round2(subtotal - productDiscount);
    let coupon = null;
    let couponDiscount = 0;
    let couponError = '';
    if (couponCode) {
      const c = findCoupon(db, couponCode);
      if (!c) couponError = 'كود الخصم غير صالح أو منتهي';
      else if (afterDiscount < num(c.minTotal)) couponError = `هذا الكود يتطلب طلباً بقيمة ${c.minTotal} ₪ على الأقل`;
      else {
        coupon = c;
        couponDiscount = c.type === 'percent' ? round2((afterDiscount * c.value) / 100) : Math.min(afterDiscount, num(c.value));
      }
    }
    const net = round2(afterDiscount - couponDiscount);
    const ship = shippingFor(db.settings, net, zoneId, lines.length > 0);
    return {
      lines, subtotal, productDiscount, couponCode: coupon ? coupon.code : '', couponDiscount, couponError,
      shipping: ship.shipping, zone: ship.zone ? { id: ship.zone.id, name: ship.zone.name } : null, needsZone: ship.needsZone,
      freeOver: ship.freeOver, total: round2(net + ship.shipping),
    };
  }

  // تعديل المخزون: sign = -1 عند الطلب، +1 عند الإلغاء
  function adjustStock(db, items, sign) {
    for (const it of items) {
      const p = db.products.find((x) => x.id === it.productId);
      if (!p) continue;
      if (hasVariants(p) && it.variantId) {
        const v = p.variants.find((x) => x.id === it.variantId);
        if (v) v.stock = Math.max(0, num(v.stock) + sign * it.qty);
      } else if (!hasVariants(p)) {
        p.stock = Math.max(0, num(p.stock) + sign * it.qty);
      }
      p.sold = Math.max(0, num(p.sold) - sign * it.qty);
    }
  }

  // ---------------------------------------------------------------- التقارير
  const monthKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
  const monthLabel = (key) => { const [y, m] = key.split('-'); return `${MONTHS[Number(m) - 1]} ${y}`; };

  function report(db, month) {
    const now = new Date();
    const key = /^\d{4}-\d{2}$/.test(month || '') ? month : monthKey(now);
    // سلسلة آخر 12 شهراً تنتهي بالشهر المختار
    const [y, m] = key.split('-').map(Number);
    const series = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const k = monthKey(d);
      const os = db.orders.filter((o) => monthKey(o.createdAt) === k && o.status !== 'cancelled');
      series.push({ month: k, label: monthLabel(k), orders: os.length, revenue: round2(os.reduce((a, o) => a + o.total, 0)) });
    }
    const all = db.orders.filter((o) => monthKey(o.createdAt) === key);
    const valid = all.filter((o) => o.status !== 'cancelled');
    const delivered = valid.filter((o) => o.status === 'delivered');
    const sum = (arr, f) => round2(arr.reduce((a, x) => a + f(x), 0));
    const group = (arr, keyFn, valFn) => {
      const map = {};
      for (const x of arr) {
        const k = keyFn(x) || '—';
        map[k] = map[k] || { name: k, orders: 0, qty: 0, revenue: 0 };
        valFn(map[k], x);
      }
      return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    };
    const products = {};
    for (const o of valid) {
      for (const it of o.items) {
        const k = it.name + (it.size ? ` (${it.size})` : '');
        products[k] = products[k] || { name: k, qty: 0, revenue: 0 };
        products[k].qty += it.qty;
        products[k].revenue = round2(products[k].revenue + it.lineTotal);
      }
    }
    const statuses = {};
    for (const o of all) statuses[o.status] = (statuses[o.status] || 0) + 1;
    const blends = (db.blendRequests || []).filter((b) => monthKey(b.createdAt) === key);
    const newCustomers = (db.customers || []).filter((c) => monthKey(c.createdAt) === key).length;
    return {
      month: key, label: monthLabel(key), series,
      totals: {
        orders: all.length, validOrders: valid.length, cancelled: all.length - valid.length,
        revenue: sum(valid, (o) => o.total), deliveredRevenue: sum(delivered, (o) => o.total),
        shipping: sum(valid, (o) => o.shipping), discounts: sum(valid, (o) => (o.productDiscount || 0) + (o.couponDiscount || 0)),
        avgOrder: valid.length ? round2(sum(valid, (o) => o.total) / valid.length) : 0,
        items: valid.reduce((a, o) => a + o.items.reduce((b, i) => b + i.qty, 0), 0),
        blendRequests: blends.length, newCustomers,
      },
      products: Object.values(products).sort((a, b) => b.revenue - a.revenue).slice(0, 15),
      towns: group(valid, (o) => o.customer.town, (g, o) => { g.orders++; g.revenue = round2(g.revenue + o.total); }).slice(0, 15),
      zones: group(valid, (o) => (o.zone && o.zone.name) || '', (g, o) => { g.orders++; g.revenue = round2(g.revenue + o.total); }),
      statuses,
    };
  }

  return { round2, applyDiscount, hasVariants, option, totalStock, displayPrice, zones, shippingFor, findCoupon, priceCart, adjustStock, report, monthKey, monthLabel };
});
