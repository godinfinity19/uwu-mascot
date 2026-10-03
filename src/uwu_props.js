// Props drawn in UwU's hand-drawn style (cards, envelopes, gears, cables, signs ...).
// Needs src/uwu.js. Every prop is drawn around its own origin in canvas pixels;
// place it with PROPS.at(x, y, rot, scale, () => PROPS.card()).

const PROPS = (() => {
  const K = () => UWU.kit;
  const C = {
    mint: "#9fd3b4", mintDeep: "#5fae86", red: "#ea7a83", redDeep: "#c9505d", gold: "#f0b75e",
    goldDeep: "#c98a2e", sky: "#a9c8ec", skyDeep: "#6f97c9", paper: "#fffaf2", grey: "#b7a7b0",
    smoke: "#8f7d89", steel: "#c9bcc6", wood: "#d9a77a", woodDeep: "#a8714a",
  };

  // Global size of props relative to their drawn units (scenes set this).
  let size = 1;

  function at(x, y, rot, sc, fn) {
    push();
    try {
      translate(x, y);
      if (rot) rotate(rot);
      const k = (sc ?? 1) * size;
      if (k !== 1) scale(k);
      size = 1; // nested props are already scaled
      fn();
    } finally {
      pop();
      size = sizeDefault;
    }
  }
  let sizeDefault = 1;
  const setSize = (k) => { size = sizeDefault = k; };

  // Rounded rectangle centred on the origin.
  function rrect(w, h, r, n = 5) {
    const pts = [];
    const corners = [[w / 2 - r, -h / 2 + r, -Math.PI / 2], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI]];
    for (const [cx, cy, a0] of corners) {
      for (let i = 0; i <= n; i++) {
        const a = a0 + (Math.PI / 2) * (i / n);
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    return pts;
  }

  // Text drawn as brush shapes from the font outlines (p5 text() breaks p5.brush in WEBGL).
  // `hole` paints the inside of letters like "0", "4", "a".
  const glyphCache = new Map();
  function label(str, x, y, size, color = "#52263b", hole = null) {
    const key = str + "|" + size;
    if (!glyphCache.has(key)) {
      textSize(size);
      const contours = window.UWU_FONT.textToContours(str, 0, 0, { sampleFactor: 0.25 }).map((c) => c.map((p) => [p.x, p.y])).filter((c) => c.length > 2);
      const all = contours.flat();
      const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
      const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
      const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
      const area = (c) => c.reduce((a, p, i) => { const q = c[(i + 1) % c.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
      const shifted = contours.map((c) => ({ pts: c.map(([px, py]) => [px - ox, py - oy]), a: area(c) }));
      const outerSign = Math.sign(shifted.reduce((m, c) => (Math.abs(c.a) > Math.abs(m.a) ? c : m), shifted[0]).a);
      glyphCache.set(key, shifted.map((c) => ({ pts: c.pts, outer: Math.sign(c.a) === outerSign })));
    }
    const k = K();
    at(x, y, 0, 1, () => {
      for (const c of glyphCache.get(key)) if (c.outer) k.wash(c.pts, color);
      for (const c of glyphCache.get(key)) if (!c.outer && hole) k.wash(c.pts, hole);
    });
  }

  const outline = (pts, w = 2.6, extra = {}) => K().ink([...pts, pts[0]], w, { second: true, taper: [false, false], ...extra });

  // ---------------------------------------------------------------------------

  function card(color = UWU.PALETTE.pink) {
    const P = UWU.PALETTE, k = K(), body = rrect(150, 96, 14);
    k.wash(body, color);
    k.paint(rrect(150, 96, 14).map(([x, y]) => [x, y + 6]), P.lavender, 90, 0.05, 0.3, 0.2);
    k.wash(rrect(150, 18, 2).map(([x, y]) => [x, y - 22]), P.purple, 220);
    k.wash(rrect(30, 22, 5).map(([x, y]) => [x - 44, y + 10]), C.gold);
    k.ink([[-58, 10], [-30, 10]], 1.2, { second: false });
    k.ink([[-10, 28], [50, 28]], 2, { second: false, color: P.purple });
    outline(body, 2.8);
  }

  function coin(r = 26) {
    const k = K();
    k.wash(k.ellipse(0, 0, r, r, 28), C.gold);
    k.paint(k.ellipse(-r * 0.15, -r * 0.15, r * 0.6, r * 0.6, 20), "#fff2cf", 160, 0.1, 0.3, 0.05);
    outline(k.ellipse(0, 0, r, r, 28), 2.4);
    k.ink([[-r * 0.25, -r * 0.35], [r * 0.25, -r * 0.35], [-r * 0.2, r * 0.35], [r * 0.25, r * 0.35]], 2, { second: false, color: C.goldDeep });
  }

  // open: 0 closed .. 1 flap fully up; letter: 0 inside .. 1 pulled out
  function envelope(open = 0, letter = 0) {
    const P = UWU.PALETTE, k = K(), w = 170, h = 110;
    if (open > 0.5 || letter > 0) {
      at(0, -letter * 70, 0, 1, () => {
        const sheet = rrect(140, 96, 6);
        k.wash(sheet, C.paper);
        for (let i = 0; i < 3; i++) k.ink([[-48, -24 + i * 18], [i === 2 ? 10 : 48, -24 + i * 18]], 1.6, { second: false, color: P.lavender });
        k.wash(k.ellipse(40, 24, 9, 8, 16), P.blushDeep, 220);
        outline(sheet, 2.2);
      });
    }
    const body = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    k.wash(body, P.rose);
    k.wash([[-w / 2, h / 2], [0, 4], [w / 2, h / 2]], P.pink);
    k.wash([[-w / 2, -h / 2], [0, 8], [-w / 2, h / 2]], P.pinkDeep, 140);
    k.wash([[w / 2, -h / 2], [0, 8], [w / 2, h / 2]], P.pinkDeep, 140);
    outline(body, 2.8);
    k.ink([[-w / 2, h / 2], [0, 4], [w / 2, h / 2]], 1.8, { second: false });
    // flap: folds over the top edge as it opens
    const fy = Math.cos(Math.PI * Math.min(1, open)) * 62;
    const flap = [[-w / 2, -h / 2], [0, -h / 2 + fy], [w / 2, -h / 2]];
    k.wash(flap, fy < 0 ? P.pinkDeep : P.rose);
    k.ink([...flap], 2.2, { second: false, taper: [false, false] });
    if (open < 0.3) {
      k.wash(k.ellipse(0, -h / 2 + fy * 0.9, 13, 13, 20), P.purple);
      k.ink(k.ellipse(0, -h / 2 + fy * 0.9, 13, 13, 20).concat([[13, -h / 2 + fy * 0.9]]), 1.6, { second: false });
    }
  }

  // round badge with a check (good), cross (bad) or "!" (warn); p = 0..1 draw-on
  function badge(kind = "check", p = 1, r = 46) {
    const k = K(), color = kind === "check" ? C.mint : kind === "warn" ? C.gold : C.red;
    const deep = kind === "check" ? C.mintDeep : kind === "warn" ? C.goldDeep : C.redDeep;
    const c = k.ellipse(0, 0, r, r, 32);
    k.wash(c, color);
    k.paint(k.ellipse(-r * 0.2, -r * 0.25, r * 0.55, r * 0.45, 20), "#ffffff", 120, 0.1, 0.3, 0.05);
    outline(c, 3);
    if (p <= 0.05) return;
    if (kind === "check") {
      const path = [[-r * 0.42, 0], [-r * 0.12, r * 0.3], [r * 0.45, -r * 0.3]];
      const cut = partial(path, p);
      if (cut.length > 1) k.ink(cut, 5.5, { second: false, color: "#ffffff", taper: [false, false] });
    } else if (kind === "cross") {
      const a = partial([[-r * 0.33, -r * 0.33], [r * 0.33, r * 0.33]], Math.min(1, p * 2));
      if (a.length > 1) k.ink(a, 5.5, { second: false, color: "#ffffff", taper: [false, false] });
      if (p > 0.5) {
        const b = partial([[r * 0.33, -r * 0.33], [-r * 0.33, r * 0.33]], (p - 0.5) * 2);
        if (b.length > 1) k.ink(b, 5.5, { second: false, color: "#ffffff", taper: [false, false] });
      }
    } else {
      k.ink(partial([[0, -r * 0.45], [0, r * 0.12]], p), 6, { second: false, color: "#ffffff", taper: [false, false] });
      if (p > 0.8) k.wash(k.ellipse(0, r * 0.38, 4.5, 4.5, 12), "#ffffff");
    }
  }

  // first fraction p of a polyline
  function partial(pts, p) {
    if (p >= 1) return pts;
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let left = total * Math.max(0, p);
    seg.push(pts[0]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay);
      if (left >= L) { seg.push(pts[i]); left -= L; } else { seg.push([ax + (bx - ax) * left / L, ay + (by - ay) * left / L]); left = 0; }
    }
    return seg;
  }

  function warning(r = 70) {
    const k = K(), tri = [[0, -r], [r * 0.95, r * 0.7], [-r * 0.95, r * 0.7]];
    const soft = k.smooth(tri, true, 4);
    k.wash(soft, C.gold);
    k.paint(soft.map(([x, y]) => [x * 0.7, y * 0.7 + 6]), "#ffe2a8", 140, 0.1, 0.3, 0.05);
    outline(soft, 3.2);
    k.ink([[0, -r * 0.42], [0, r * 0.22]], 7, { second: false, taper: [false, true] });
    k.wash(k.ellipse(0, r * 0.45, 6, 6, 14), UWU.PALETTE.ink);
  }

  function sparkle(r = 18, color = C.gold) {
    const k = K(), s = k.smooth(k.star4(0, 0, r, r * 1.2, r * 0.32, 0), true, 4);
    k.wash(s, color);
    k.ink([...s, s[0]], 1.6, { second: false, color: UWU.PALETTE.ink, taper: [false, false] });
  }

  function heart(r = 20, color = UWU.PALETTE.blushDeep) {
    const k = K(), pts = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      pts.push([r * 0.06 * 16 * Math.pow(Math.sin(a), 3), -r * 0.06 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]);
    }
    k.wash(pts, color);
    outline(pts, 2.2);
  }

  function confettiPiece(w, h, color) {
    const k = K();
    k.wash(rrect(w, h, 2, 2), color);
  }

  function gear(r = 50, teeth = 8, color = C.steel) {
    const k = K(), pts = [];
    for (let i = 0; i < teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2, out = i % 4 === 1 || i % 4 === 2;
      pts.push([(out ? r : r * 0.8) * Math.cos(a), (out ? r : r * 0.8) * Math.sin(a)]);
    }
    k.wash(pts, color);
    k.paint(k.ellipse(0, 0, r * 0.75, r * 0.75, 24), UWU.PALETTE.lavender, 90, 0.05, 0.3, 0.2);
    outline(pts, 2.4);
    k.wash(k.ellipse(0, 0, r * 0.28, r * 0.28, 18), C.paper);
    outline(k.ellipse(0, 0, r * 0.28, r * 0.28, 18), 2);
  }

  function puff(r = 30, color = C.smoke, alpha = 200) {
    const k = K(), pts = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2, rr = r * (1 + 0.18 * Math.sin(a * 5));
      pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
    k.wash(pts, color, alpha);
  }

  // jam: 0 running .. 1 broken (red window glow)
  function factory(jam = 0) {
    const P = UWU.PALETTE, k = K();
    const body = [[-150, 0], [-150, -120], [-90, -160], [-90, -120], [-30, -160], [-30, -120], [30, -160], [30, -120], [150, -120], [150, 0]];
    const chimney = [[90, -120], [90, -230], [125, -230], [125, -120]];
    k.wash(chimney, P.lavender);
    outline(chimney, 2.6);
    k.wash(body, P.rose);
    k.paint(body.map(([x, y]) => [x, y + 10]), P.purple, 70, 0.05, 0.3, 0.2);
    outline(body, 3);
    for (let i = 0; i < 4; i++) {
      const win = rrect(36, 30, 4).map(([x, y]) => [x - 105 + i * 70, y - 60]);
      k.wash(win, jam > 0.5 ? C.red : C.gold, 230);
      outline(win, 2);
    }
    const door = rrect(44, 54, 6).map(([x, y]) => [x + 105, y - 27]);
    k.wash(door, P.purple);
    outline(door, 2.2);
    k.wash([[-170, 0], [170, 0], [170, 10], [-170, 10]], P.shadow, 120);
  }

  function plug(color = UWU.PALETTE.pink) {
    const k = K(), body = rrect(54, 40, 10);
    k.wash([[-27, -8], [-44, -8], [-44, -4], [-27, -4]], C.steel);
    k.wash([[-27, 4], [-44, 4], [-44, 8], [-27, 8]], C.steel);
    k.ink([[-27, -6], [-44, -6]], 1.4, { second: false });
    k.ink([[-27, 6], [-44, 6]], 1.4, { second: false });
    k.wash(body, color);
    outline(body, 2.4);
  }

  function socket(color = UWU.PALETTE.lavender) {
    const k = K(), body = rrect(54, 46, 10);
    k.wash(body, color);
    outline(body, 2.4);
    k.wash(k.ellipse(-8, -6, 3, 3, 10), UWU.PALETTE.ink);
    k.wash(k.ellipse(-8, 6, 3, 3, 10), UWU.PALETTE.ink);
  }

  function cable(pts, color = UWU.PALETTE.purple) {
    const k = K();
    k.ink(pts, 5, { second: false, color, taper: [false, false] });
  }

  // service tag: rounded pill with a name
  function tag(name, color, w = 150) {
    const k = K(), body = rrect(w, 60, 24);
    k.wash(body, color);
    k.paint(body.map(([x, y]) => [x * 0.9, y * 0.5 - 8]), "#ffffff", 70, 0.1, 0.3, 0.05);
    outline(body, 2.8);
    label(name, 0, -2, 28, "#ffffff", color);
  }

  function spark(r = 30, color = C.gold) {
    const k = K();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      k.ink([[Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35], [Math.cos(a) * r, Math.sin(a) * r]], 3.4, { second: false, color, taper: [false, true] });
    }
  }

  function sign404() {
    const P = UWU.PALETTE, k = K();
    const post = [[-8, 0], [8, 0], [8, -150], [-8, -150]];
    k.wash(post, C.woodDeep);
    outline(post, 2.2);
    const board = [[-110, -220], [110, -226], [114, -138], [-106, -132]];
    k.wash(board, C.wood);
    k.paint(board.map(([x, y]) => [x * 0.9, y + 8]), C.woodDeep, 80, 0.05, 0.3, 0.2);
    outline(board, 3);
    label("404", 2, -182, 64, P.ink, C.wood);
  }

  function magnifier() {
    const k = K();
    k.ink([[22, 22], [56, 56]], 9, { second: false, color: C.woodDeep, taper: [false, false] });
    k.wash(k.ellipse(0, 0, 30, 30, 28), "#e3f0ff", 200);
    k.paint(k.ellipse(-8, -8, 12, 10, 16), "#ffffff", 200, 0.05, 0.3, 0.05);
    outline(k.ellipse(0, 0, 30, 30, 28), 4);
  }

  // shackle: 0 locked .. 1 open
  function padlock(open = 0, color = UWU.PALETTE.purple) {
    const k = K(), lift = open * 26;
    const shackle = k.ellipse(0, -40 - lift, 26, 30, 24, Math.PI, Math.PI * 2);
    k.ink([[-26, -14], [-26, -40 - lift], ...shackle, [26, -40 - lift], [26, -14 - lift * (open > 0.5 ? 1 : 0)]], 9, { second: false, color: C.steel, taper: [false, false] });
    k.ink([[-26, -14], [-26, -40 - lift], ...shackle, [26, -40 - lift], [26, -14 - lift * (open > 0.5 ? 1 : 0)]], 2, { second: false });
    const body = rrect(84, 70, 12).map(([x, y]) => [x, y + 16]);
    k.wash(body, color);
    k.paint(body.map(([x, y]) => [x * 0.8, y * 0.6]), UWU.PALETTE.lavender, 120, 0.05, 0.3, 0.1);
    outline(body, 3);
    k.wash(k.ellipse(0, 10, 7, 7, 14), UWU.PALETTE.ink);
    k.ink([[0, 14], [0, 30]], 5, { second: false, taper: [false, false] });
  }

  function key(color = C.gold) {
    const k = K();
    k.ink([[16, 0], [86, 0]], 9, { second: false, color, taper: [false, false] });
    k.ink([[70, 0], [70, 14]], 7, { second: false, color, taper: [false, false] });
    k.ink([[82, 0], [82, 12]], 7, { second: false, color, taper: [false, false] });
    k.wash(k.ellipse(0, 0, 20, 20, 24), color);
    k.wash(k.ellipse(0, 0, 7, 7, 14), C.paper);
    outline(k.ellipse(0, 0, 20, 20, 24), 2.4);
  }

  // open: lid lift 0..1
  function gift(open = 0) {
    const P = UWU.PALETTE, k = K();
    const box = rrect(130, 100, 8).map(([x, y]) => [x, y + 10]);
    k.wash(box, P.pink);
    k.wash([[-12, -40], [12, -40], [12, 60], [-12, 60]], C.gold);
    outline(box, 3);
    at(0, -open * 70, open * -0.4, 1, () => {
      const lid = rrect(146, 30, 6).map(([x, y]) => [x, y - 50]);
      k.wash(lid, P.rose);
      k.wash([[-12, -65], [12, -65], [12, -35], [-12, -35]], C.gold);
      outline(lid, 3);
      k.wash(k.ellipse(-20, -76, 20, 12, 18), C.gold);
      k.wash(k.ellipse(20, -76, 20, 12, 18), C.gold);
      outline(k.ellipse(-20, -76, 20, 12, 18), 2);
      outline(k.ellipse(20, -76, 20, 12, 18), 2);
    });
  }

  function priceTag(textStr = "%", color = UWU.PALETTE.blushDeep) {
    const k = K(), body = [[-46, -34], [30, -34], [56, 0], [30, 34], [-46, 34]];
    const s = k.smooth(body, true, 3);
    k.wash(s, color);
    outline(s, 2.8);
    k.wash(k.ellipse(34, 0, 6, 6, 12), C.paper);
    label(textStr, -6, -2, textStr.length > 2 ? 26 : 38, "#ffffff", color);
  }

  function crown(color = C.gold) {
    const k = K(), pts = [[-50, 20], [-56, -30], [-28, -2], [0, -40], [28, -2], [56, -30], [50, 20]];
    k.wash(pts, color);
    k.paint(pts.map(([x, y]) => [x * 0.8, y * 0.6 + 6]), "#fff0c4", 150, 0.05, 0.3, 0.05);
    outline(pts, 2.8);
    for (const [x, y] of [[-56, -30], [0, -40], [56, -30]]) k.wash(k.ellipse(x, y, 7, 7, 12), UWU.PALETTE.blushDeep);
  }

  // p: growth 0..1
  function chart(p = 1) {
    const P = UWU.PALETTE, k = K(), heights = [60, 95, 80, 140, 190];
    k.ink([[-130, 0], [130, 0]], 3, { second: false });
    k.ink([[-130, 0], [-130, -220]], 3, { second: false });
    heights.forEach((h, i) => {
      const hh = h * Math.min(1, Math.max(0, p * 1.4 - i * 0.12));
      if (hh < 2) return;
      const bar = [[-110 + i * 48, 0], [-78 + i * 48, 0], [-78 + i * 48, -hh], [-110 + i * 48, -hh]];
      k.wash(bar, i === 4 ? P.pinkDeep : P.lavender);
      outline(bar, 2.2);
    });
  }

  function arrowUp(p = 1, color = C.mint) {
    const k = K();
    const path = partial([[-120, -40], [-60, -90], [-10, -70], [60, -150], [110, -190]], p);
    if (path.length > 1) k.ink(path, 9, { second: false, color, taper: [false, false] });
    if (p > 0.95) k.wash([[110, -190], [80, -186], [104, -164]], color);
  }

  function trophy(color = C.gold) {
    const k = K();
    const cup = [[-46, -110], [46, -110], [40, -60], [20, -40], [-20, -40], [-40, -60]];
    k.ink(k.ellipse(-50, -88, 16, 18, 16, Math.PI * 0.5, Math.PI * 1.5), 6, { second: false, color, taper: [false, false] });
    k.ink(k.ellipse(50, -88, 16, 18, 16, -Math.PI * 0.5, Math.PI * 0.5), 6, { second: false, color, taper: [false, false] });
    const s = k.smooth(cup, true, 4);
    k.wash(s, color);
    k.paint(s.map(([x, y]) => [x * 0.6 - 10, y]), "#fff0c4", 150, 0.05, 0.3, 0.05);
    outline(s, 3);
    const stem = [[-8, -40], [8, -40], [12, -14], [-12, -14]];
    k.wash(stem, C.goldDeep);
    const base = rrect(70, 18, 4).map(([x, y]) => [x, y - 6]);
    k.wash(base, UWU.PALETTE.purple);
    outline(base, 2.4);
  }

  // speech / thought bubble
  function bubble(w = 170, h = 110, tail = [-40, 80], thought = false) {
    const P = UWU.PALETTE, k = K();
    const body = thought ? k.ellipse(0, 0, w / 2, h / 2, 40).map(([x, y], i) => {
      const a = (i / 40) * Math.PI * 2; return [x * (1 + 0.06 * Math.sin(a * 7)), y * (1 + 0.06 * Math.sin(a * 7))];
    }) : rrect(w, h, 30);
    k.wash(body, C.paper);
    outline(body, 2.8);
    if (thought) {
      for (const [x, y, r] of [[tail[0] * 0.55, tail[1] * 0.75, 12], [tail[0], tail[1], 7]]) {
        k.wash(k.ellipse(x, y, r, r, 14), C.paper);
        outline(k.ellipse(x, y, r, r, 14), 2);
      }
    } else {
      const tl = [[tail[0] - 18, h / 2 - 2], [tail[0], tail[1]], [tail[0] + 14, h / 2 - 2]];
      k.wash(tl, C.paper);
      k.ink(tl, 2.6, { second: false, taper: [false, false] });
    }
  }

  function dots(t, color = UWU.PALETTE.purple) {
    const k = K();
    for (let i = 0; i < 3; i++) {
      const b = Math.max(0, Math.sin(t * 6 - i * 0.9));
      k.wash(k.ellipse(-30 + i * 30, -b * 10, 9, 9, 14), color);
    }
  }

  function waves(t, color = UWU.PALETTE.lavender) {
    const k = K();
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.6 + i / 3) % 1, r = 20 + ph * 60;
      k.ink(k.ellipse(0, 0, r, r, 18, -0.6, 0.6), 3.2 * (1 - ph) + 0.5, { second: false, color, taper: [true, true] });
    }
  }

  function sweat(r = 9) {
    const k = K(), pts = [[0, -r * 1.8], [r, 0], [r * 0.7, r * 0.8], [0, r], [-r * 0.7, r * 0.8], [-r, 0]];
    const s = k.smooth(pts, true, 4);
    k.wash(s, C.sky);
    k.ink([...s, s[0]], 1.6, { second: false, color: C.skyDeep, taper: [false, false] });
  }

  function rocket(flame = 1) {
    const P = UWU.PALETTE, k = K();
    for (let i = 0; i < 3; i++) {
      const fl = k.smooth([[-14 + i * 4, 60], [0, 60 + (40 + i * 10) * flame * (0.8 + 0.2 * Math.sin(frameCount * 0.9 + i))], [14 - i * 4, 60]], true, 4);
      k.wash(fl, [C.red, C.gold, "#fff2cf"][i]);
    }
    const body = k.smooth([[0, -80], [26, -30], [26, 60], [-26, 60], [-26, -30]], true, 5);
    k.wash([[26, 20], [50, 64], [26, 56]], P.purple);
    k.wash([[-26, 20], [-50, 64], [-26, 56]], P.purple);
    k.wash(body, C.paper);
    k.paint(body.map(([x, y]) => [x * 0.5 + 8, y]), P.lavender, 90, 0.05, 0.3, 0.1);
    outline(body, 3);
    k.wash(k.ellipse(0, -14, 13, 13, 18), C.sky);
    outline(k.ellipse(0, -14, 13, 13, 18), 2.4);
  }

  // person avatar in a circle (for account linking)
  function account(color = UWU.PALETTE.lavender) {
    const k = K(), c = k.ellipse(0, 0, 54, 54, 32);
    k.wash(c, color);
    k.wash(k.ellipse(0, -12, 16, 16, 20), C.paper);
    k.wash(k.ellipse(0, 30, 30, 22, 24, Math.PI, Math.PI * 2), C.paper);
    outline(c, 3);
  }

  function wrench(color = C.steel) {
    const k = K();
    k.ink([[0, 0], [0, 90]], 14, { second: false, color, taper: [false, false] });
    const head = [[-22, -6], [-22, -30], [-8, -30], [-8, -12], [8, -12], [8, -30], [22, -30], [22, -6], [10, 6], [-10, 6]];
    k.wash(head, color);
    outline(head, 2.4);
  }

  return {
    C, at, setSize, rrect, label, partial, card, coin, envelope, badge, warning, sparkle, heart, confettiPiece, gear,
    puff, factory, plug, socket, cable, tag, spark, sign404, magnifier, padlock, key, gift, priceTag, crown,
    chart, arrowUp, trophy, bubble, dots, waves, sweat, rocket, account, wrench,
  };
})();
