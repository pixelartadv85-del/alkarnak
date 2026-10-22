// مولّد صور SVG أنيقة للمنتجات التجريبية والسلايدر (تُستبدل لاحقاً بصور حقيقية من لوحة التحكم).

const leaf = (x, y, s, r, c, o = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})" opacity="${o}">
    <path d="M0 0 C 18 -30, 58 -34, 80 -6 C 58 18, 20 22, 0 0 Z" fill="${c}"/>
    <path d="M2 0 C 30 -8, 54 -10, 78 -6" stroke="rgba(255,255,255,.45)" stroke-width="1.6" fill="none"/>
  </g>`;

const sprig = (x, y, s, r, c) =>
  `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
    <path d="M0 0 C 10 -60, 20 -120, 40 -170" stroke="${c}" stroke-width="3" fill="none"/>
    ${leaf(6, -40, 0.42, -70, c)}${leaf(12, -70, 0.42, -20, c)}
    ${leaf(20, -100, 0.4, -75, c)}${leaf(28, -128, 0.38, -25, c)}${leaf(36, -158, 0.34, -60, c)}
  </g>`;

const label = (cx, cy, w, h, c, accent) =>
  `<g>
    <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="10" fill="#fbf6ea" stroke="${accent}" stroke-width="2"/>
    <rect x="${cx - w / 2 + 6}" y="${cy - h / 2 + 6}" width="${w - 12}" height="${h - 12}" rx="7" fill="none" stroke="${accent}" stroke-opacity=".45" stroke-width="1"/>
    ${leaf(cx - 16, cy - h / 2 + 30, 0.4, -20, c)}
    <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="Tahoma, Arial" font-size="${Math.round(w / 6.5)}" font-weight="700" fill="${c}">الجليل</text>
    <rect x="${cx - w / 4}" y="${cy + 20}" width="${w / 2}" height="3" rx="2" fill="${accent}" opacity=".7"/>
  </g>`;

const vessels = {
  bottle: (c, a) => `
    <rect x="232" y="118" width="36" height="40" rx="5" fill="#2b2b2b"/>
    <rect x="240" y="92" width="20" height="30" rx="8" fill="#1d1d1d"/>
    <path d="M222 158 h56 v22 c0 10 34 18 34 46 v170 c0 16-12 26-28 26 h-68 c-16 0-28-10-28-26 v-170 c0-28 34-36 34-46 z" fill="url(#g)"/>
    <path d="M198 240 v140" stroke="rgba(255,255,255,.35)" stroke-width="8" stroke-linecap="round"/>
    ${label(250, 310, 96, 96, c, a)}`,
  jar: (c, a) => `
    <rect x="160" y="178" width="180" height="46" rx="12" fill="${a}"/>
    <rect x="160" y="200" width="180" height="6" fill="rgba(0,0,0,.12)"/>
    <rect x="150" y="224" width="200" height="190" rx="34" fill="url(#g)"/>
    <path d="M172 250 v130" stroke="rgba(255,255,255,.35)" stroke-width="9" stroke-linecap="round"/>
    ${label(250, 320, 120, 96, c, a)}`,
  pouch: (c, a) => `
    <path d="M160 150 h180 l14 270 c1 10-6 16-16 16 h-176 c-10 0-17-6-16-16 z" fill="url(#g)"/>
    <rect x="160" y="150" width="180" height="22" fill="rgba(0,0,0,.15)"/>
    <path d="M175 160 h150" stroke="rgba(255,255,255,.4)" stroke-width="3" stroke-dasharray="6 5"/>
    ${label(250, 310, 128, 110, c, a)}`,
  soap: (c, a) => `
    <rect x="130" y="250" width="240" height="130" rx="40" fill="url(#g)"/>
    <rect x="148" y="262" width="204" height="100" rx="30" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="3"/>
    <text x="250" y="328" text-anchor="middle" font-family="Tahoma, Arial" font-size="34" font-weight="700" fill="rgba(255,255,255,.75)">الجليل</text>
    <rect x="170" y="200" width="160" height="60" rx="24" fill="url(#g)" opacity=".75"/>
    ${leaf(205, 225, 0.55, -10, 'rgba(255,255,255,.5)')}`,
  honey: (c, a) => `
    <rect x="170" y="150" width="160" height="40" rx="10" fill="${a}"/>
    <path d="M160 190 h180 c14 0 24 10 24 24 v176 c0 22-18 38-40 38 h-148 c-22 0-40-16-40-38 v-176 c0-14 10-24 24-24 z" fill="url(#g)"/>
    <path d="M168 230 v150" stroke="rgba(255,255,255,.35)" stroke-width="9" stroke-linecap="round"/>
    ${label(250, 312, 120, 100, c, a)}`,
  box: (c, a) => `
    <path d="M150 170 l100 -40 l100 40 v230 l-100 40 l-100 -40 z" fill="url(#g)"/>
    <path d="M250 210 v230 M150 170 l100 40 l100 -40" stroke="rgba(0,0,0,.15)" stroke-width="3" fill="none"/>
    <path d="M150 170 l100 40 v230 l-100 -40 z" fill="rgba(255,255,255,.12)"/>
    ${label(200, 310, 76, 100, c, a)}`,
  spray: (c, a) => `
    <path d="M226 96 h48 v26 h22 v14 h-70 z" fill="#2b2b2b"/>
    <rect x="232" y="136" width="36" height="34" rx="4" fill="${a}"/>
    <rect x="196" y="170" width="108" height="250" rx="30" fill="url(#g)"/>
    <path d="M212 200 v190" stroke="rgba(255,255,255,.35)" stroke-width="8" stroke-linecap="round"/>
    ${label(250, 300, 84, 100, c, a)}`,
};

function productSVG({ type = 'bottle', color = '#2f5d3a', color2, accent = '#c8a24a', bg = '#efe6d2' }) {
  const c2 = color2 || shade(color, 0.25);
  const vessel = (vessels[type] || vessels.bottle)(color, accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="800" height="800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${color}"/></linearGradient>
    <radialGradient id="bg" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="${bg}"/></radialGradient>
  </defs>
  <rect width="500" height="500" fill="url(#bg)"/>
  <circle cx="250" cy="270" r="190" fill="${color}" opacity=".07"/>
  ${sprig(78, 470, 1.25, 12, shade(color, -0.1))}
  ${sprig(430, 480, 1.1, -18, shade(color, 0.1))}
  ${leaf(370, 120, 0.7, 30, accent, 0.55)}${leaf(90, 150, 0.6, -150, color, 0.35)}
  <ellipse cx="250" cy="440" rx="150" ry="16" fill="rgba(0,0,0,.13)"/>
  ${vessel}
</svg>`;
}

function slideSVG({ c1, c2, accent }) {
  let leaves = '';
  for (let i = 0; i < 26; i++) {
    const x = (i * 157) % 1600;
    const y = (i * 271) % 800;
    leaves += leaf(x, y, 0.8 + (i % 5) * 0.35, (i * 47) % 360, i % 3 ? accent : '#ffffff', 0.08 + (i % 4) * 0.04);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" width="1600" height="800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <radialGradient id="glow" cx=".25" cy=".5" r=".6"><stop offset="0" stop-color="${accent}" stop-opacity=".35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1600" height="800" fill="url(#s)"/>
  <rect width="1600" height="800" fill="url(#glow)"/>
  ${leaves}
  ${sprig(260, 820, 3.2, 8, 'rgba(255,255,255,.18)')}
  ${sprig(420, 840, 2.6, 24, 'rgba(255,255,255,.12)')}
  <circle cx="330" cy="420" r="230" fill="none" stroke="${accent}" stroke-opacity=".35" stroke-width="2"/>
  <circle cx="330" cy="420" r="280" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width="1"/>
</svg>`;
}

function shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

module.exports = { productSVG, slideSVG };
