// Seamless status loops for the website: UwU acts out a product state, a small icon
// chip floats above the head and a few light effects play around.
// Needs uwu.js, uwu_props.js (labels, small props) and a font in window.UWU_FONT.
//
// Loop maths (spec §10):
//   * Every loop has a period T of 1.5, 2 or 2.5 s (90, 120 or 150 frames at 60 fps).
//   * Everything is a function of the loop phase p = (t / T) mod 1. Continuous motion uses
//     sin / cos with a whole number of cycles per loop; one-off actions ("beats") live in
//     a window [at, at + len) of the phase and start and end at rest, so frame T is frame 0.
//   * The texture boil steps 6 times a second over 3 seeds, which divides every T.
//   * Secondary motion is the same curve sampled a little later (lag), never a simulation,
//     so it is exactly periodic too.

const UWU_LOOPS = (() => {
  const TAU = Math.PI * 2;
  const S = 0.88; // mascot scale on the 720 canvas
  const G = 300; // ground line (canvas y, WEBGL origin at the centre)
  const ICON = [30, -600]; // icon chip centre in rig units, above the curl
  const deg = (d) => (d * Math.PI) / 180;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const mod1 = (x) => ((x % 1) + 1) % 1;
  const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // Easing curves on [0, 1]
  const E = {
    sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x)),
    outCubic: (x) => 1 - Math.pow(1 - clamp(x), 3),
    inCubic: (x) => Math.pow(clamp(x), 3),
    outBack: (x, s = 1.9) => { x = clamp(x) - 1; return 1 + (s + 1) * x * x * x + s * x * x; },
    // 0 → 1 → 0 hump, smooth at both ends
    hump: (x) => Math.pow(Math.sin(Math.PI * clamp(x)), 2),
    // damped wobble: starts at 0 moving up, ends at rest at 1
    wob: (x, cycles = 1.5, decay = 2) => (x <= 0 || x >= 1 ? 0 : Math.sin(TAU * cycles * x) * Math.pow(1 - x, decay)),
    // rise, hold, fall inside one window: a / b are the rise and fall fractions
    hold: (x, a = 0.15, b = 0.2, rise = null) => {
      if (x <= 0 || x >= 1) return 0;
      if (x < a) return (rise || E.sine)(x / a);
      if (x > 1 - b) return 1 - E.sine((x - (1 - b)) / b);
      return 1;
    },
  };

  // ---------------------------------------------------------------------------
  // Clock: periodic helpers bound to one loop period
  // ---------------------------------------------------------------------------

  function clock(t, T) {
    const p = mod1(t / T);
    const L = {
      t, T, p,
      s: (k, ph = 0) => Math.sin(TAU * (k * p + ph)),
      c: (k, ph = 0) => Math.cos(TAU * (k * p + ph)),
      fr: (k, ph = 0) => mod1(k * p + ph),
      // local progress 0..1 inside the beat window [at, at + len), else -1 (wraps)
      local(at, len) { const u = mod1(p - at); return u < len ? u / len : -1; },
      // value of a curve over a window, 0 outside
      env(at, len, f = E.hump) { const x = L.local(at, len); return x < 0 ? 0 : f(x); },
      // the same clock a little earlier: dt in seconds (secondary motion / lag)
      lag: (dt) => clock(t - dt, T),
    };
    return L;
  }

  // volume-preserving squash / stretch
  const sq = (sy) => ({ sy, sx: 1 / Math.sqrt(sy) });

  // rot / dx / dy add, sx / sy multiply
  function add(...poses) {
    const out = {};
    for (const p of poses) {
      if (!p) continue;
      for (const [part, tf] of Object.entries(p)) {
        const o = out[part] || (out[part] = {});
        for (const [f, v] of Object.entries(tf)) {
          if (f === "sx" || f === "sy") o[f] = (o[f] ?? 1) * v;
          else o[f] = (o[f] ?? 0) + v;
        }
      }
    }
    return out;
  }

  // breathing and secondary sway, whole cycles per loop
  const life = (L, k = 1, amt = 1) => ({
    body: { sy: 1 + 0.012 * L.s(k) * amt, sx: 1 - 0.008 * L.s(k) * amt },
    ruff: { sy: 1 + 0.02 * L.s(k, 0.1) * amt },
    tuft_L: { rot: 0.05 * L.s(k, 0.2) * amt },
    tail: { rot: 0.1 * L.s(2 * k, 0.1) * amt },
    curl: { rot: 0.03 * L.s(k, 0.35) * amt },
  });

  // A jump inside the window [at, at + len): anticipation squash, parabolic flight with
  // stretch, landing squash with one rebound. Hair and tail follow the vertical speed late.
  function jump(L, at, len, h, { arms = 0 } = {}) {
    const x = L.local(at, len);
    if (x < 0) return {};
    const A = 0.2, B = 0.7; // take-off and touch-down inside the window
    const air = x > A && x < B ? (x - A) / (B - A) : -1;
    const y = air < 0 ? 0 : 4 * air * (1 - air); // parabola, 1 at the apex
    let sy = 1;
    if (x < A) sy -= 0.1 * Math.pow(Math.sin((Math.PI / 2) * (x / A)), 2);
    if (x >= A && x < A + 0.06) sy -= 0.1 * Math.pow(Math.cos((Math.PI / 2) * ((x - A) / 0.06)), 2);
    if (air >= 0) sy += 0.07 * Math.pow(Math.sin(Math.PI * clamp(air / 0.35)), 2) + 0.05 * Math.pow(Math.sin(Math.PI * clamp((air - 0.7) / 0.3)), 2);
    if (x >= B) { const r = (x - B) / (1 - B); sy -= (0.12 * Math.sin(2.5 * Math.PI * r) * Math.pow(1 - r, 2)) / 0.64; }
    // vertical speed, sampled late for the hair
    const xl = x - 0.07, airL = xl > A && xl < B ? (xl - A) / (B - A) : -1;
    const v = airL < 0 ? 0 : (1 - 2 * airL) * Math.sin(Math.PI * airL);
    const land = x >= B ? E.wob((x - B) / (1 - B), 1, 2) : 0;
    const lift = air < 0 ? 0 : Math.sin(Math.PI * air);
    return {
      root: { dy: -h * y },
      body: sq(sy),
      shadow: { sx: 1 - 0.35 * y * Math.min(1, h / 50), sy: 1 - 0.35 * y * Math.min(1, h / 50) },
      curl: { rot: -0.22 * v - 0.12 * land },
      tuft_L: { rot: 0.28 * v + 0.15 * land },
      tail: { rot: 0.3 * v },
      arm_R: { rot: deg(arms) * lift },
      arm_L: { rot: -deg(arms) * lift },
    };
  }

  function face(name, over = {}) {
    const base = UWU.fullFace(UWU.EXPRESSIONS[name].face);
    return {
      eye: { ...base.eye, ...(over.eye || {}) }, brow: { ...base.brow, ...(over.brow || {}) },
      mouth: { ...base.mouth, ...(over.mouth || {}) }, blush: over.blush ?? base.blush, star: over.star ?? base.star,
    };
  }

  // a blink centred on loop phase `at` (only on open eyes), 0.14 s long
  function blink(f, L, at) {
    const x = L.local(at - 0.07 / L.T, 0.14 / L.T);
    if (x >= 0 && f.eye.shape === "open") f.eye = { ...f.eye, open: Math.min(f.eye.open, 1 - 0.92 * E.hump(x)) };
    return f;
  }

  // one rig transform, as in uwu.js: translate(pivot + d) · rotate · scale · translate(-pivot)
  function xf(pt, t, piv) {
    if (!t) return pt;
    const a = t.rot || 0, c = Math.cos(a), s = Math.sin(a);
    const x = (pt[0] - piv[0]) * (t.sx ?? 1), y = (pt[1] - piv[1]) * (t.sy ?? 1);
    return [piv[0] + (t.dx || 0) + x * c - y * s, piv[1] + (t.dy || 0) + x * s + y * c];
  }
  // canvas point of a rig point that moves with the head (head → body → root)
  function headPt(u, v, pose) {
    let q = xf([u, v], pose.head, [0, -150]);
    q = xf(q, pose.body, [0, -15]);
    q = xf(q, pose.root, [0, 0]);
    return [S * q[0], G + S * q[1]];
  }

  // blend two full faces: numbers interpolate, shapes switch at k = 0.5
  function faceLerp(fa, fb, k) {
    const mixObj = (oa, ob) => {
      const out = {};
      for (const key of new Set([...Object.keys(oa), ...Object.keys(ob)])) {
        const va = oa[key] ?? ob[key], vb = ob[key] ?? oa[key];
        if (typeof va === "number" && typeof vb === "number") out[key] = lerp(va, vb, k);
        else if (Array.isArray(va) && Array.isArray(vb)) out[key] = va.map((x, i) => lerp(x, vb[i], k));
        else out[key] = k < 0.5 ? va : vb;
      }
      return out;
    };
    return { eye: mixObj(fa.eye, fb.eye), brow: mixObj(fa.brow, fb.brow), mouth: mixObj(fa.mouth, fb.mouth), blush: lerp(fa.blush, fb.blush, k), star: lerp(fa.star, fb.star, k) };
  }

  // ---------------------------------------------------------------------------
  // Shapes: thick strokes as filled polygons (white ink strokes turn grey in p5.brush)
  // ---------------------------------------------------------------------------

  const K = () => UWU.kit;
  const COL = {
    mint: "#7fc9a0", red: "#e9707b", gold: "#f0b75e", sky: "#86b3e6", violet: "#a78bdb",
    pink: "#ee95b2", plum: "#a46a9a", white: "#fffaf2", ink: "#52263b", steel: "#9d8ca0",
    smoke: "#a99aa6", orange: "#f08a4b", glitchA: "#7fd6e8", glitchB: "#ef7fb8",
    magenta: "#d14f8a", coin: "#eaa53f", linked: "#82bec3", rays: "#e9a23b", gearDeep: "#7a6680",
  };

  function strokePoly(pts, w, closed = false) {
    const n = pts.length, h = w / 2, Lp = [], Rp = [], tan = [];
    const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    for (let i = 0; i < n; i++) {
      const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
      const b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
      let t1 = unit(a, pts[i]), t2 = unit(pts[i], b);
      if (!closed && i === 0) t1 = t2;
      if (!closed && i === n - 1) t2 = t1;
      const nx = -(t1[1] + t2[1]), ny = t1[0] + t2[0], nl = Math.hypot(nx, ny) || 1;
      const mx = nx / nl, my = ny / nl, m = h / Math.max(0.45, mx * -t1[1] + my * t1[0]);
      Lp.push([pts[i][0] + mx * m, pts[i][1] + my * m]);
      Rp.push([pts[i][0] - mx * m, pts[i][1] - my * m]);
      tan.push(t2);
    }
    // outer loop, a zero-width slit, the inner loop back to its start
    if (closed) return [...Lp, Lp[0], Rp[0], ...Rp.slice(1).reverse(), Rp[0]];
    const cap = (p, t, sgn) => {
      const nn = [-t[1], t[0]], out = [];
      for (let k = 1; k < 6; k++) {
        const f = (Math.PI * k) / 6;
        out.push([p[0] + h * sgn * (Math.cos(f) * nn[0] + Math.sin(f) * t[0]), p[1] + h * sgn * (Math.cos(f) * nn[1] + Math.sin(f) * t[1])]);
      }
      return out;
    };
    return [...Lp, ...cap(pts[n - 1], tan[n - 1], 1), ...Rp.slice().reverse(), ...cap(pts[0], tan[0], -1)];
  }
  const thick = (pts, w, color = COL.white, alpha = 255) => K().wash(strokePoly(pts, w), color, alpha);
  const circle = (x, y, r, n = 36) => K().ellipse(x, y, r, r, n);
  const dot = (x, y, r, color, alpha = 255) => K().wash(circle(x, y, r, 18), color, alpha);
  function arcPts(x, y, r, a0, a1, n = 24) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
    return out;
  }
  const ring = (x, y, r, w, color, alpha = 255) => K().wash(strokePoly(circle(x, y, r, 48), w, true), color, alpha);
  const arc = (x, y, r, w, a0, a1, color, alpha = 255) => thick(arcPts(x, y, r, a0, a1, Math.max(6, Math.ceil(Math.abs(a1 - a0) * 8))), w, color, alpha);
  const outlineRing = (pts, w = 3) => K().ink([...pts, pts[0]], w, { second: true, taper: [false, false] });
  const star4 = (r, k = 0.3) => {
    const out = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, rr = i % 2 ? r * k : r; out.push([rr * Math.cos(a), rr * Math.sin(a)]); }
    return K().smooth(out, true, 3);
  };
  function mix(a, b, k) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return "#" + pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(k))).toString(16).padStart(2, "0")).join("");
  }
  // transform with separate x / y scale (coin flip)
  function atXY(x, y, rot, sx, sy, fn) {
    push();
    try { translate(x, y); if (rot) rotate(rot); scale(sx, sy); fn(); } finally { pop(); }
  }

  // ---------------------------------------------------------------------------
  // Icon chips (drawn around their centre, radius 44 px before scaling)
  // ---------------------------------------------------------------------------

  const R = 44;
  function chipBase(color, r = R, shine = true) {
    const k = K();
    k.wash(circle(0, 0, r + 1.5), COL.white, 255); // keeps the chip opaque over effects
    k.wash(circle(0, 0, r), color);
    if (shine) k.wash(k.ellipse(-r * 0.22, -r * 0.34, r * 0.5, r * 0.3, 20), "#ffffff", 70);
    outlineRing(circle(0, 0, r), 3.2);
  }

  const GLYPH = {
    check() { thick([[-17, 2], [-5, 14], [18, -12]], 9); },
    cross() { thick([[-13, -13], [13, 13]], 9); thick([[13, -13], [-13, 13]], 9); },
    warn() { thick([[0, -19], [0, 5]], 9, COL.ink); dot(0, 17, 5.2, COL.ink); },
    coin(o) { PROPS.label("$", 0, 1, 46, COL.white, o.color ?? COL.gold); },
    percent(o) { PROPS.label("%", 0, 1, 46, COL.white, o.color ?? COL.pink); },
    q404() { PROPS.label("404", 0, 2, 36, COL.white, COL.violet); },
    sparkle(o) {
      PROPS.at(-3, 3, o.rot ?? 0, o.k ?? 1, () => K().wash(star4(25, 0.38), COL.white));
      PROPS.at(21, -21, 0, (o.k2 ?? 1) * 0.4, () => K().wash(star4(25, 0.38), COL.white));
    },
    heart() {
      const pts = [];
      for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; pts.push([1.2 * 16 * Math.pow(Math.sin(a), 3), -1.2 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) + 2]); }
      K().wash(pts, COL.white);
    },
    crown() {
      K().wash([[-21, 11], [-24, -13], [-11, -1], [0, -19], [11, -1], [24, -13], [21, 11]], COL.white);
      K().wash(PROPS.rrect(42, 7, 3).map(([x, y]) => [x, y + 16]), COL.white);
      dot(0, 3, 3.6, COL.violet);
    },
    lock(o) {
      const open = o.open ?? 0, lift = 9 * open, hole = o.hole ?? COL.violet, leg = 9 * Math.max(0, 1 - open);
      const shackle = [[-11, 2], [-11, -9 - lift], ...arcPts(0, -9 - lift, 11, Math.PI, TAU, 12).slice(1)];
      thick(leg > 0.5 ? [...shackle, [11, -9 - lift + leg]] : shackle, 6.5);
      K().wash(PROPS.rrect(36, 26, 6).map(([x, y]) => [x, y + 9]), COL.white);
      dot(0, 7, 3.6, hole);
      thick([[0, 8], [0, 14]], 3.2, hole);
    },
    mail(o) {
      const flap = o.flap ?? 0, ink = o.ink ?? COL.pink;
      if (flap > 0.02) K().wash([[-22, -13], [0, -13 - 15 * flap], [22, -13]], COL.white);
      K().wash(PROPS.rrect(44, 32, 5).map(([x, y]) => [x, y + 2]), COL.white);
      thick([[-17, 15], [0, 4], [17, 15]], 3, ink);
      if (flap > 0.02) thick([[-19, -13], [0, -13 - 15 * flap], [19, -13]], 3.4, ink);
      else thick([[-18, -11], [0, 3], [18, -11]], 3.4, ink);
    },
    link(o) {
      // two interlocking links; the second one gets an under-stroke in the chip colour
      const gap = o.gap ?? 0, c = Math.cos(-0.7), sn = Math.sin(-0.7);
      for (const s of [-1, 1]) {
        const ox = s * (9 + gap * 0.75), oy = s * (-7.5 - gap * 0.65);
        const pts = PROPS.rrect(26, 15, 7.5, 6).map(([x, y]) => [x * c - y * sn + ox, x * sn + y * c + oy]);
        if (s > 0 && o.bg) K().wash(strokePoly(pts, 12, true), o.bg);
        K().wash(strokePoly(pts, 6, true), COL.white);
      }
    },
    gear(o) {
      // 6 teeth: reads as a cog down to 80 px
      const r = 25, teeth = 6, pts = [];
      for (let i = 0; i < teeth * 4; i++) {
        const a = (i / (teeth * 4)) * TAU + (o.rot ?? 0), out = i % 4 === 1 || i % 4 === 2;
        pts.push([(out ? r : r * 0.66) * Math.cos(a), (out ? r : r * 0.66) * Math.sin(a)]);
      }
      K().wash(pts, o.color ?? COL.white);
      dot(0, 0, 7.5, o.hole ?? COL.sky);
    },
    dots(o) {
      for (let i = 0; i < 3; i++) {
        const b = Math.max(0, Math.sin(TAU * (o.ph ?? 0) - i * 0.9));
        dot(-14 + i * 14, -7 * b, 5.2 + 0.8 * b, COL.white);
      }
    },
    bubble(o) {
      K().wash(PROPS.rrect(42, 30, 11).map(([x, y]) => [x, y - 3]), COL.white);
      K().wash([[-11, 9], [-15, 20], [1, 10]], COL.white);
      const n = o.lines ?? 1;
      for (let i = 0; i < 2; i++) {
        const w = [22, 13][i] * clamp(n * 2 - i);
        if (w > 1) thick([[-11, -8 + i * 9], [-11 + w, -8 + i * 9]], 3.6, COL.mint);
      }
    },
    mic() {
      K().wash(PROPS.rrect(16, 27, 8).map(([x, y]) => [x, y - 6]), COL.white);
      thick(arcPts(0, -2, 13, 0.15, Math.PI - 0.15, 12), 4);
      thick([[0, 11], [0, 18]], 4);
      thick([[-7, 19], [7, 19]], 4);
    },
    trophy() {
      const k = K();
      k.wash(k.smooth([[-15, -17], [15, -17], [13, -3], [5, 5], [-5, 5], [-13, -3]], true, 3), COL.white);
      thick(arcPts(-15, -9, 7, Math.PI * 0.5, Math.PI * 1.5, 8), 4);
      thick(arcPts(15, -9, 7, -Math.PI * 0.5, Math.PI * 0.5, 8), 4);
      k.wash([[-3, 4], [3, 4], [4, 12], [-4, 12]], COL.white);
      k.wash(PROPS.rrect(26, 7, 2).map(([x, y]) => [x, y + 15]), COL.white);
    },
    chart(o) {
      const h = o.h || [0.5, 0.75, 1];
      h.forEach((v, i) => { const hh = 5 + 25 * v; K().wash(PROPS.rrect(10, hh, 2.5, 2).map(([x, y]) => [x - 13 + i * 13, y + 15 - hh / 2]), COL.white); });
      thick([[-21, 19.5], [21, 19.5]], 3);
    },
    factory() {
      K().wash([[-21, 15], [-21, -1], [-11, -9], [-11, -1], [-1, -9], [-1, -1], [21, -1], [21, 15]], COL.white);
      K().wash([[9, -1], [9, -17], [16, -17], [16, -1]], COL.white);
      for (let i = 0; i < 2; i++) K().wash(PROPS.rrect(6, 6, 1.5, 1).map(([x, y]) => [x - 12 + i * 11, y + 7]), COL.red);
    },
  };

  // chip(kind) draws a round chip with a glyph; pill(name) draws a brand pill.
  function chip(kind, color, o = {}) {
    chipBase(color, R, o.shine ?? kind !== "q404");
    if (GLYPH[kind]) GLYPH[kind](o);
  }
  function badgeDot(x, y, sc) {
    if (sc > 0.02) PROPS.at(x, y, 0, sc, () => { dot(0, 0, 13, COL.white); dot(0, 0, 10.5, COL.red); outlineRing(circle(0, 0, 10.5, 20), 2.4); });
  }
  const pillWidth = (name) => Math.max(100, 21 * name.length + 40);
  function pill(name, color, o = {}) {
    const k = K(), w = pillWidth(name), body = PROPS.rrect(w, 56, 28);
    k.wash(PROPS.rrect(w + 3, 59, 29.5), COL.white, 255);
    k.wash(body, color);
    k.wash(body.map(([x, y]) => [x * 0.86, y * 0.4 - 11]), "#ffffff", 60);
    outlineRing(body, 3.2);
    PROPS.label(name, 0, -1, 27, COL.white, color);
    const b = o.badge ?? 1;
    if (b > 0.02) PROPS.at(w / 2 - 6, -26, 0, 0.56 * b, () => { chipBase(COL.red); GLYPH.cross(); });
  }

  // small heart particle: flat colour plus a highlight, no ink outline (no specks when tiny)
  function heartFx(r = 14, color = COL.pink) {
    const pts = [];
    for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; pts.push([r * 0.06 * 16 * Math.pow(Math.sin(a), 3), -r * 0.06 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]); }
    K().wash(pts, color);
    K().wash(K().ellipse(-r * 0.4, -r * 0.35, r * 0.22, r * 0.16, 12), "#ffffff", 170);
  }

  // ---------------------------------------------------------------------------
  // Effects (canvas coordinates)
  // ---------------------------------------------------------------------------

  // each particle gets its own seed so items appearing or leaving never reshuffle the others
  let fxSeed = 0;
  const reseed = (i) => K().setSeed(fxSeed + i * 13);
  // effects never come closer than 30 px (720 canvas) to the top edge, even at the top of a jump
  const SAFE_TOP = -330;

  const FX = {
    // one ring emitted at `at`, expanding r0 → r1 and fading over len
    ripple(L, x, y, at, len, r0, r1, color, w = 6) {
      const u = L.local(at, len);
      if (u < 0) return;
      // fades by thinning, never by alpha: low-alpha washes turn grey in p5.brush
      const r1s = Math.max(r0 + 12, Math.min(r1, y - SAFE_TOP - w / 2));
      const r = lerp(r0, r1s, E.outCubic(u)), ww = w * (1 - E.inCubic(u));
      reseed(90);
      if (ww > 1.2) ring(x, y, r, ww, color, 255);
    },
    // radial dashes popping out of (x, y)
    burst(L, x, y, at, len, r0, r1, color, n = 8, w = 5, rot = 0.2) {
      const u = L.local(at, len);
      if (u < 0) return;
      const head = lerp(r0, r1, E.outCubic(u)), tail = lerp(r0, r1, E.inCubic(u) * 0.95);
      reseed(91);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rot, c = Math.cos(a), s = Math.sin(a);
        const k = s < -0.05 ? Math.min(1, (y - SAFE_TOP - w / 2) / (-s * r1)) : 1; // shorten rays that would leave the top
        const h = head * k, t = tail * k;
        if (h - t > 1.5) thick([[x + c * t, y + s * t], [x + c * h, y + s * h]], w * (1 - 0.6 * u), color);
      }
    },
    // fixed-position sparkles that each twinkle once per loop, staggered
    twinkle(L, spots, color = COL.gold, size = 16, k = 1, grow = 1.3) {
      spots.forEach(([x, y], i) => {
        const u = L.fr(k, i / spots.length), sc = u < 0.6 ? Math.sin((Math.PI * u) / 0.6) : 0;
        if (sc > 0.04) { reseed(i); PROPS.at(x, y, 0.6 * u, sc * grow, () => K().wash(star4(size, 0.3), color)); }
      });
    },
    // particles rising; each makes k trips per loop
    rise(L, n, k, x0, y0, spread, height, draw) {
      for (let i = 0; i < n; i++) {
        const u = L.fr(k, i / n);
        const x = x0 + (hash(i) - 0.5) * spread + 10 * Math.sin(TAU * (u + hash(i + 2)));
        const sc = Math.min(1, 3 * Math.sin(Math.PI * u)) * (1 - E.inCubic(u));
        if (sc > 0.04) { reseed(i); PROPS.at(x, y0 - height * E.outCubic(u), 0.25 * Math.sin(TAU * u + i), sc, () => draw(i)); }
      }
    },
    // particles falling and spinning; each makes one trip per loop
    // lanes(i) → x keeps pieces off the face and chip
    fall(L, n, x0, y0, spread, height, draw, lanes = null) {
      for (let i = 0; i < n; i++) {
        const u = L.fr(1, i / n + hash(i) * 0.37);
        const x = (lanes ? lanes(i) : x0 + (hash(i + 4) - 0.5) * spread) + 12 * Math.sin(TAU * (2 * u + hash(i)));
        const sc = Math.min(1, 4 * Math.sin(Math.PI * u));
        if (sc > 0.04) { reseed(i); PROPS.at(x, y0 + height * u, TAU * u * (hash(i + 6) > 0.5 ? 1 : -1), sc, () => draw(i)); }
      }
    },
    // confetti thrown out of (x, y) at `at`, with gravity; gone before the window ends
    // r0: spawn radius, so pieces start outside the chip
    pop(L, x, y, at, len, n, speed, draw, r0 = 0) {
      const u = L.local(at, len);
      if (u < 0) return;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.6 + 0.2 * (hash(i) - 0.5), sa = Math.sin(a);
        let v = speed * (0.75 + 0.5 * hash(i + 3));
        // cap the launch speed so the top of the arc, y + sa·r0 − (v·sa)²/2080, stays below SAFE_TOP + 12
        if (sa < -0.05) v = Math.min(v, Math.sqrt(2080 * Math.max(0, y + sa * r0 - SAFE_TOP - 12)) / -sa);
        const px = x + Math.cos(a) * (r0 + v * u), py = y + Math.sin(a) * (r0 + v * u) + 520 * u * u;
        const sc = Math.min(1, 6 * u) * (1 - E.inCubic(u));
        if (sc > 0.04) { reseed(i); PROPS.at(px, py, TAU * u * (i % 2 ? 1.5 : -1.5), sc, () => draw(i)); }
      }
    },
    // a drop that slides down the side of the head
    sweat(L, pose, at = 0.15, len = 0.8, side = -1) {
      const u = L.local(at, len);
      if (u < 0) return;
      // follows the head outline, about 8 units outside it
      const [x, y] = headPt(side * (98 + 44 * E.inCubic(u)), -310 + 48 * E.inCubic(u), pose);
      const sc = Math.min(1, u * 6) * (1 - E.inCubic(clamp((u - 0.8) / 0.2)));
      if (sc > 0.04) { reseed(3); PROPS.at(x, y, 0, sc * 1.25, () => PROPS.sweat(9)); }
    },
    // shock lines on both sides of the head
    shock(L, pose, at, len, color = COL.plum) {
      const u = L.local(at, len);
      if (u < 0) return;
      const e = E.outCubic(u);
      reseed(92);
      for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
        const ang = (sd < 0 ? Math.PI : 0) + sd * (i - 1) * 0.42, [cx, cy] = headPt(sd * 120, -330, pose);
        const r0 = 80 + 20 * e, r1 = r0 + 26 * (1 - E.inCubic(u)); // retracts instead of fading
        if (r1 - r0 > 2) thick([[cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0], [cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1]], 5.5 * (1 - 0.5 * u), color);
      }
    },
    // a spinner arc around the chip: whole turns per loop, length breathing once per loop
    spinner(L, x, y, r, color, turns = 1, w = 10) {
      const head = TAU * (turns * L.p) - Math.PI / 2, len = 0.9 + 1.6 * (0.5 - 0.5 * L.c(1));
      reseed(93);
      arc(x, y, r, w, head - len, head, color);
    },
    // sound arcs on both sides of a point, k waves per loop
    // inward = true: the waves travel towards the point (listening)
    sound(L, x, y, k, color, gap = 52, inward = false) {
      reseed(94);
      for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) {
        const u = L.fr(k, i * 0.5), r = gap + 34 * (inward ? 1 - u : u), a = Math.sin(Math.PI * u);
        if (a > 0.2) arc(x, y, r, 6.5 * a, (sd < 0 ? Math.PI : 0) - 0.5, (sd < 0 ? Math.PI : 0) + 0.5, color);
      }
    },
    // short horizontal bars beside the chip (glitch)
    scan(x, y, on, k) {
      if (!on) return;
      reseed(95);
      for (let i = 0; i < 3; i++) {
        const yy = y - 26 + 26 * i + 8 * hash(k + i), xx = x + (hash(k + i + 9) - 0.5) * 70, w = 30 + 40 * hash(k + i + 5);
        K().wash(PROPS.rrect(w, 6, 2, 1).map(([a, b]) => [a + xx, b + yy]), i % 2 ? COL.glitchA : COL.glitchB, 230);
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Loops
  // ---------------------------------------------------------------------------
  //
  // def(id, title, group, T, { motion(L) → pose, look(L, pose, I) → { face, icon, back, front } })
  //   I = [x, y] is the chip centre on the canvas. It follows the head 0.04 s late, so the
  //   chip trails the character's moves.

  const LOOPS = {};
  // SLOW stretches every loop in time (the client wants calm, smooth motion, not speed).
  // 6·T stays a multiple of 3 for T in {3, 4, 5}, so the texture boil still repeats with the loop.
  const SLOW = 2;
  const def = (id, title, group, T, spec) => (LOOPS[id] = { id, title, group, T: T * SLOW, ...spec });
  const LAG = 0.04;
  // icon = [dx, dy, scale, rot, drawFn, sx] relative to I
  const icon = (draw, { dx = 0, dy = 0, sc = 1, rot = 0, sx = 1 } = {}) => [dx, dy, sc, rot, draw, sx];

  // ---- everyday flow ----

  // T 2: waving hello (2 Hz, −14° … −50°), heart chip beating lub-dub twice per loop
  def("welcome", "مرحبًا", "flow", 2, {
    motion: (L) => add(life(L), {
      arm_L: { rot: -deg(32) - deg(18) * L.s(4) },
      head: { rot: deg(5) + deg(2) * L.s(1) + deg(1.5) * L.s(4, 0.15) },
      body: { sy: 1 + 0.01 * L.s(4, 0.3) },
      tuft_L: { rot: 0.06 * L.s(4, 0.2) },
    }),
    look(L, pose, I) {
      const beat = 0.16 * (L.env(0, 0.09) + L.env(0.5, 0.09)) + 0.1 * (L.env(0.11, 0.09) + L.env(0.61, 0.09));
      return {
        face: blink(face("happy", { eye: { shape: "open", shine: 1 }, mouth: { shape: "openSmile", open: 0.35, width: 1 } }), L, 0.8),
        icon: icon(() => chip("heart", COL.pink), { sc: 1 + beat, rot: deg(5) * L.s(1, 0.25) }),
        front() {
          FX.rise(L, 2, 1, I[0], I[1] + 10, 230, 95, () => heartFx(15));
          FX.twinkle(L, [[-200, -170], [205, -80], [-170, 60]], COL.gold, 16);
        },
      };
    },
  });

  // T 1.5: focused squint, typing rhythm (4 Hz); the cog ticks one tooth (60°) per beat
  def("working", "جاري العمل", "flow", 1.5, {
    motion(L) {
      const tap = L.s(6);
      return add(life(L, 1, 0.6), {
        arm_R: { rot: deg(8) + deg(16) * Math.max(0, tap) }, arm_L: { rot: -deg(8) - deg(16) * Math.max(0, -tap) },
        head: { rot: deg(1.5) * L.s(3), dy: 3 + 4 * Math.abs(L.s(3)) },
        curl: { rot: 0.06 * L.s(3, 0.12) },
      });
    },
    look(L, pose, I) {
      const n = Math.floor(L.p * 3), x = L.p * 3 - n, tick = n + E.outBack(clamp(x / 0.35), 2.4);
      return {
        face: blink(face("neutral", { eye: { open: 0.72, gaze: [0, 7] }, brow: { dy: 6, tilt: -12 }, mouth: { shape: "wavy", width: 0.6 } }), L, 0.55),
        icon: icon(() => chip("gear", COL.sky, { rot: (tick * TAU) / 6 })),
        back() { FX.spinner(L, I[0], I[1], 62, COL.sky, 1, 10); },
      };
    },
  });

  // T 1.5: one jump with arms up; on the apex the check chip pops, a ring and rays fly out
  def("success", "تم بنجاح", "flow", 1.5, {
    motion: (L) => add(life(L), jump(L, 0.04, 0.62, 40, { arms: 48 })),
    look(L, pose, I) {
      return {
        face: face("happy"),
        icon: icon(() => chip("check", COL.mint), { sc: 1 + 0.2 * L.env(0.28, 0.3, (x) => E.wob(x, 1.2, 1.6)) }),
        back() { FX.ripple(L, I[0], I[1], 0.3, 0.42, 46, 120, COL.mint, 8); },
        front() {
          FX.burst(L, I[0], I[1], 0.3, 0.32, 56, 104, COL.gold, 8, 6);
          FX.twinkle(L, [[-190, -150], [200, -60], [-160, 70], [190, 120]], COL.gold, 15);
        },
      };
    },
  });

  // T 2: coin toss above the head (one full flip); UwU's eyes follow it, then a cheer on the catch
  def("payment_done", "تم الدفع", "flow", 2, {
    motion: (L) => add(life(L), {
      head: { rot: -deg(4) * L.env(0.05, 0.4), dy: -4 * L.env(0.05, 0.4) },
      curl: { rot: 0.1 * L.env(0.05, 0.4) },
    }, jump(L, 0.38, 0.45, 26, { arms: 30 })),
    look(L, pose, I) {
      const toss = L.local(0.06, 0.38), air = toss < 0 ? 0 : 4 * toss * (1 - toss);
      const flip = toss < 0 ? 0 : TAU * E.sine(toss);
      // eyes open over ~4 frames as the coin leaves and close just before the cheer
      const open = toss < 0 || toss >= 0.9 ? 0 : 1.12 * E.outBack(clamp(toss / 0.08), 2) * (1 - E.sine(clamp((toss - 0.82) / 0.08)));
      return {
        face: toss >= 0 && toss < 0.9
          ? face("neutral", { eye: { open, gaze: [1, -8], shine: 1 }, brow: { dy: -6 }, mouth: { shape: "o", open: 0.45 } })
          : face("happy", { blush: 1.5 }),
        icon: icon(() => chip("coin", COL.coin, { color: COL.coin }), { dy: -55 * air, sx: Math.cos(flip) }),
        back() {
          FX.ripple(L, I[0], I[1], 0.43, 0.4, 46, 105, COL.gold, 8);
          FX.pop(L, I[0], I[1], 0.44, 0.5, 6, 240, (i) => (i % 2 ? PROPS.coin(12) : K().wash(star4(15, 0.35), COL.mint)), 50);
        },
        front() { FX.twinkle(L, [[-195, -130], [205, -40], [-175, 80]], COL.gold, 15); },
      };
    },
  });

  // T 2: a quick dip, then a proud puff (outBack) with arms out and chin up; the crown glints
  def("subscription", "الاشتراك المميز", "flow", 2, {
    motion: (L) => {
      const puff = (LL) => LL.env(0.1, 0.6, (x) => E.hold(x, 0.18, 0.3, (u) => E.outBack(u, 2)));
      const dip = L.env(0.03, 0.1), proud = puff(L), late = puff(L.lag(0.07));
      return add(life(L), {
        body: sq(1 - 0.06 * dip + 0.07 * proud), ruff: { sy: 1 + 0.12 * proud },
        head: { rot: deg(3) * L.s(1) - deg(5) * proud, dy: -6 * proud },
        arm_R: { rot: deg(26) * proud }, arm_L: { rot: -deg(26) * proud },
        curl: { rot: 0.2 * late }, tuft_L: { rot: -0.2 * late }, crown: { rot: 0.1 * late },
      });
    },
    look(L, pose, I) {
      const glint = L.env(0.2, 0.22);
      return {
        face: face("uwu", { eye: { shape: "arcHappy" }, blush: 1.5 }),
        icon: icon(() => {
          chip("crown", COL.violet);
          if (glint > 0.03) PROPS.at(24, -22, glint * 1.2, glint, () => K().wash(star4(18, 0.25), COL.white));
        }, { rot: deg(6) * L.s(1, 0.1), sc: 1 + 0.12 * L.env(0.16, 0.3, (x) => E.wob(x, 1.2, 1.6)) }),
        back() { FX.burst(L, I[0], I[1], 0.18, 0.34, 58, 92, COL.rays, 10, 6.5); },
        front() { FX.twinkle(L, [[-195, -170], [210, -90], [-185, 40], [180, 110]], COL.gold, 16); },
      };
    },
  });

  // T 1.5: two excited bounces; the % tag swings; confetti falls in side lanes, clear of the face
  def("offers", "العروض", "flow", 1.5, {
    motion: (L) => add(life(L), jump(L, 0, 0.5, 28, { arms: 28 }), jump(L, 0.5, 0.5, 28, { arms: 28 })),
    look(L, pose, I) {
      return {
        face: face("happy", { eye: { shape: "open", open: 1.1, shine: 1 }, mouth: { shape: "openSmile", open: 0.5 } }),
        icon: icon(() => chip("percent", COL.magenta, { color: COL.magenta }), { rot: deg(16) * L.s(2, 0.05) }),
        front() {
          FX.fall(L, 8, 0, -360, 0, 620, (i) => PROPS.confettiPiece(17, 9, [COL.pink, COL.gold, COL.mint, COL.violet, COL.sky][i % 5]),
            (i) => (i % 2 ? 1 : -1) * (250 + 55 * hash(i + 4)));
        },
      };
    },
  });

  // T 2: the lock rattles harder and harder, springs open with a click (mint), UwU hops; closes again
  const loginOpen = (L) => {
    const x = L.local(0.3, 0.6);
    return x < 0 ? 0 : x < 0.12 ? E.outBack(x / 0.12, 2.2) : x > 0.82 ? 1 - E.sine((x - 0.82) / 0.18) : 1;
  };
  def("login", "تسجيل الدخول", "flow", 2, {
    motion: (L) => {
      const open = clamp(loginOpen(L));
      return add(life(L), {
        head: { rot: -deg(3) * L.env(0.08, 0.25) + deg(4) * open },
        arm_L: { rot: -deg(22) * L.env(0.06, 0.3) },
        curl: { rot: 0.1 * open },
      }, jump(L, 0.26, 0.28, 12, { arms: 20 }));
    },
    look(L, pose, I) {
      const open = loginOpen(L), col = open > 0.5 ? COL.mint : COL.violet;
      const u = L.local(0.14, 0.16), shake = u < 0 ? 0 : deg(10) * Math.sin(TAU * 3 * u) * Math.pow(u, 1.5);
      const click = L.env(0.3, 0.2, (x) => E.wob(x, 1, 1.5)) + L.env(0.84, 0.12, (x) => E.wob(x, 1, 1.5));
      return {
        face: open > 0.5 ? face("uwu") : blink(face("neutral", { eye: { gaze: [1, -6] }, mouth: { shape: "smile", width: 0.7 } }), L, 0.18),
        icon: icon(() => chip("lock", col, { open: clamp(open, 0, 1.1), hole: col }), { rot: shake, sc: 1 + 0.1 * click }),
        back() { FX.burst(L, I[0], I[1], 0.31, 0.16, 54, 80, COL.mint, 8, 6); },
      };
    },
  });

  // T 1.5: new-mail nudge: the envelope wiggles and gets a badge, UwU looks up, hops as the flap opens
  def("email", "البريد الإلكتروني", "flow", 1.5, {
    motion: (L) => add(life(L), {
      arm_R: { rot: -deg(12), dx: 6 }, arm_L: { rot: deg(12), dx: -6 },
      head: { rot: deg(5) + deg(2) * L.s(1) },
    }, jump(L, 0.3, 0.24, 10, { arms: 14 })),
    look(L, pose, I) {
      const flap = L.env(0.4, 0.5, (x) => E.hold(x, 0.25, 0.25));
      const bsc = L.env(0.06, 0.86, (x) => E.hold(x, 0.15, 0.12, (u) => E.outBack(u, 2.4)));
      const g = L.env(0.02, 0.42, (x) => E.hold(x, 0.15, 0.2));
      return {
        face: face("happy", { eye: { shape: "open", shine: 1, gaze: [3 * g, -7 * g] }, mouth: { shape: "openSmile", open: 0.25 }, blush: 1.4 }),
        icon: icon(() => { chip("mail", COL.pink, { flap, ink: "#d4628a" }); badgeDot(31, -31, bsc); }, { rot: deg(12) * L.env(0, 0.36, (x) => E.wob(x, 2.5, 1.3)) }),
        front() {
          const u = L.local(0.48, 0.5);
          if (u >= 0) {
            const sc = E.outBack(clamp(u / 0.12), 2.2) * (1 - E.inCubic(clamp((u - 0.6) / 0.4)));
            reseed(1);
            if (sc > 0.02) PROPS.at(I[0] + 62 + 14 * Math.sin(TAU * u), I[1] - 20 - 80 * E.outCubic(u), 0, sc, () => heartFx(15));
          }
        },
      };
    },
  });

  // T 2: sky dots fly in, the links glide together and click (ring); later the chip flips edge-on
  // and comes back unlinked, so the reset is hidden instead of shown as a disconnect
  def("connect_accounts", "ربط الحسابات", "flow", 2, {
    motion: (L) => add(life(L), {
      arm_R: { rot: deg(10) + deg(20) * L.env(0.08, 0.3, E.sine) }, arm_L: { rot: -deg(10) - deg(20) * L.env(0.08, 0.3, E.sine) },
      head: { rot: deg(3) * L.s(1) },
    }, jump(L, 0.3, 0.34, 14, { arms: 20 })),
    look(L, pose, I) {
      const x1 = L.local(0.08, 0.27), x2 = L.local(0.82, 0.18), fl = x2 >= 0 ? E.sine(x2) : 0;
      const joined = (L.p >= 0.35 && L.p < 0.82) || (x2 >= 0 && fl < 0.5);
      let gap = 9;
      if (x1 >= 0) gap = 9 * (1 - E.inCubic(x1));
      else if (joined) gap = -2.5 * E.wob(clamp((L.p - 0.35) / 0.2), 1, 2);
      const col = joined ? COL.linked : COL.sky;
      const f = joined ? face("happy") : face("neutral", { eye: { gaze: [0, -6] }, brow: { dy: 2, tilt: -4 }, mouth: { shape: "smile", width: 0.6 } });
      return {
        face: blink(blink(f, L, 0.35), L, 0.91),
        icon: icon(() => chip("link", col, { gap, bg: col }), { sc: 1 + 0.12 * L.env(0.35, 0.3, (u) => E.wob(u, 1, 1.5)), sx: Math.cos(Math.PI * fl) }),
        back() {
          FX.ripple(L, I[0], I[1], 0.35, 0.4, 46, 115, COL.sky, 8);
          if (x1 >= 0) for (const sd of [-1, 1]) { reseed(sd + 5); dot(I[0] + sd * 150 * (1 - E.inCubic(x1)), I[1] + 10 * Math.sin(Math.PI * x1), 8, COL.sky); }
        },
      };
    },
  });

  // T 2: bars grow one after another (overshoot) from a rising staircase; UwU watches, then hops
  def("results", "النتائج", "flow", 2, {
    motion: (L) => add(life(L), {
      arm_L: { rot: -deg(30) - deg(4) * L.s(2) },
      head: { rot: deg(5) },
    }, jump(L, 0.33, 0.3, 14, { arms: 22 })),
    look(L, pose, I) {
      const h = [0.35, 0.65, 1].map((v, i) => {
        const g = L.local(0.06 + i * 0.08, 0.84 - i * 0.08);
        if (g < 0) return 0.35 * v;
        const up = E.outBack(clamp(g / 0.25), 2.2), down = E.sine(clamp((g - 0.86) / 0.14));
        return v * (0.35 + 0.65 * up * (1 - down));
      });
      const g = L.env(0.04, 0.34, (x) => E.hold(x, 0.2, 0.2));
      const cheer = L.local(0.36, 0.3) >= 0;
      const f = cheer ? face("happy") : face("happy", { eye: { shape: "open", shine: 1, gaze: [2 * g, -6 * g] }, mouth: { shape: "openSmile", open: 0.35 } });
      return {
        face: blink(blink(f, L, 0.36), L, 0.66),
        icon: icon(() => chip("chart", COL.mint, { h }), { sc: 1 + 0.12 * L.env(0.39, 0.2, (u) => E.wob(u, 1, 1.5)) }),
        front() {
          FX.rise(L, 3, 1, 0, -60, 520, 220, () => { thick([[0, 12], [0, -12]], 7, COL.mint); thick([[-10, -2], [0, -13], [10, -2]], 7, COL.mint); });
          FX.twinkle(L, [[-190, -160], [205, -60]], COL.gold, 15);
        },
      };
    },
  });

  // T 2: big jump + small hop with arms high; the trophy shines and throws confetti from behind
  def("project_success", "نجاح المشروع", "flow", 2, {
    motion: (L) => add(life(L), jump(L, 0, 0.5, 46, { arms: 52 }), jump(L, 0.5, 0.36, 18, { arms: 40 })),
    look(L, pose, I) {
      const glint = L.env(0.2, 0.2);
      return {
        face: face("happy", { blush: 1.5, mouth: { shape: "openSmile", open: 0.25 + 0.3 * L.env(0.1, 0.35) } }),
        icon: icon(() => {
          chip("trophy", COL.gold);
          if (glint > 0.03) PROPS.at(22, -24, glint, glint, () => K().wash(star4(18, 0.25), COL.white));
        }, { rot: deg(8) * L.env(0.2, 0.4, (x) => E.wob(x, 1.5, 1.5)), sc: 1 + 0.18 * L.env(0.18, 0.35, (x) => E.wob(x, 1.2, 1.6)) }),
        back() {
          FX.ripple(L, I[0], I[1], 0.2, 0.3, 46, 100, COL.gold, 8);
          FX.pop(L, I[0], I[1], 0.2, 0.75, 10, 300, (i) => PROPS.confettiPiece(17, 9, [COL.pink, COL.gold, COL.mint, COL.violet, COL.sky][i % 5]), 40);
        },
        front() { FX.twinkle(L, [[-200, -120], [210, -30]], COL.gold, 16); },
      };
    },
  });

  // ---- problems ----

  // T 1.5: alarm: the warning chip shakes, UwU jolts (surprised), then melts into worry; red pulse
  def("problem", "يوجد مشكلة", "problem", 1.5, {
    motion: (L) => add(life(L, 1, 0.6), jump(L, 0, 0.3, 12), {
      root: { dx: 4 * L.env(0.05, 0.3, (x) => E.wob(x, 4, 1)) },
      curl: { rot: -0.14 + 0.25 * L.env(0.02, 0.2) }, tuft_L: { rot: 0.2 - 0.3 * L.env(0.02, 0.2) },
      head: { dy: 3 },
    }),
    look(L, pose, I) {
      // the startle snaps in on the beat; the way back to worry is a 0.15 s blend under a blink
      const k = E.sine(clamp((L.p - 0.24) / 0.1));
      const f = faceLerp(face("surprised"), face("sad", { eye: { gaze: [0, -3] } }), k);
      return {
        face: blink(blink(f, L, 0.29), L, 0.75),
        icon: icon(() => chip("warn", COL.gold), { rot: deg(14) * L.env(0.02, 0.4, (x) => E.wob(x, 3, 1.4)), sc: 1 + 0.15 * L.env(0.02, 0.25, (x) => E.wob(x, 1, 1.5)) }),
        back() { FX.ripple(L, I[0], I[1], 0.03, 0.42, 46, 112, COL.red, 8); FX.ripple(L, I[0], I[1], 0.5, 0.42, 46, 100, COL.red, 6); },
        front() { FX.shock(L, pose, 0.02, 0.3); FX.sweat(L, pose, 0.3, 0.65); },
      };
    },
  });

  // T 2: looks left … right … (held looks with a settle), "?" pops on the side it looks to.
  // The body leans from the hips; the feet stay planted.
  const look404 = (L) => Math.tanh(3 * L.s(1)) / Math.tanh(3) + 0.18 * (E.wob(L.local(0.03, 0.3), 1, 2) - E.wob(L.local(0.53, 0.3), 1, 2));
  def("error404", "الصفحة غير موجودة", "problem", 2, {
    motion(L) {
      const look = look404(L);
      return add(life(L), {
        head: { rot: deg(12) * look, dy: 4 * Math.abs(look) }, face: { dx: 12 * look }, body: { rot: deg(2.5) * look },
        curl: { rot: 0.06 * look }, tuft_L: { rot: -0.05 * look },
      });
    },
    look(L, pose, I) {
      const look = look404(L);
      return {
        face: blink(face("neutral", { eye: { gaze: [10 * look, -3] }, brow: { tilt: 10, dy: -3 }, mouth: { shape: "wavy", width: 0.55 } }), L, 0.5),
        icon: icon(() => chip("q404", COL.violet), { rot: -deg(9) * look404(L.lag(0.08)) }),
        front() {
          [[0.1, 1], [0.6, -1]].forEach(([at, sd], i) => {
            const u = L.local(at, 0.36);
            if (u < 0) return;
            const sc = E.outBack(clamp(u / 0.3), 2.4) * (1 - E.inCubic(clamp((u - 0.75) / 0.25)));
            const [x, y] = headPt(sd * 190, -400 - 30 * u, pose);
            reseed(i);
            if (sc > 0.04) PROPS.at(x, y, sd * deg(12), sc, () => PROPS.label("?", 0, 0, 52, COL.plum));
          });
        },
      };
    },
  });

  // T 2: the factory chip smokes; a gear jumps out and falls, UwU flinches and its eyes follow it
  def("factory_problem", "مشكلة في المصنع", "problem", 2, {
    motion: (L) => add(life(L, 1, 0.5), {
      head: { rot: -deg(3), dy: 4 - 12 * L.env(0.28, 0.22) },
      curl: { rot: -0.18 + 0.2 * L.env(0.28, 0.2) }, tuft_L: { rot: 0.28 - 0.25 * L.env(0.28, 0.2) },
      arm_R: { rot: -deg(8) }, arm_L: { rot: deg(8) },
    }, jump(L, 0.25, 0.3, 14, { arms: 30 })),
    look(L, pose, I) {
      const u = L.local(0.28, 0.6);
      const f = L.local(0.28, 0.2) >= 0 ? face("surprised")
        : face("sad", { eye: { gaze: u >= 0 ? [lerp(3, 8, u), lerp(-8, 7, u)] : [0, 3] } });
      return {
        face: blink(f, L, 0.48),
        icon: icon(() => chip("factory", COL.red), { rot: deg(10) * L.env(0.26, 0.3, (x) => E.wob(x, 3, 1.3)) }),
        back() {
          // smoke from the chimney: round puffs that rise, grow and thin out
          for (let i = 0; i < 2; i++) {
            const v = L.fr(2, i * 0.5), a = 230 * (1 - E.inCubic(v));
            reseed(i);
            PROPS.at(I[0] + 12 + 6 * v, I[1] - 22 - 50 * v, 0, (0.6 + 0.6 * v) * Math.min(1, v * 6), () => { dot(-7, 2, 8, COL.smoke, a); dot(0, -4, 10, COL.smoke, a); dot(8, 2, 7, COL.smoke, a); });
          }
          FX.burst(L, I[0] + 30, I[1] - 20, 0.27, 0.25, 30, 66, COL.gold, 6, 5);
        },
        front() {
          if (u >= 0) {
            const x = I[0] + 34 + 150 * u, y = I[1] - 140 * u + 560 * u * u, sc = Math.min(1, u * 8) * (1 - E.inCubic(clamp((u - 0.7) / 0.3)));
            reseed(2);
            if (sc > 0.04) PROPS.at(x, y, TAU * u * 1.5, sc * 1.05, () => GLYPH.gear({ rot: 0, color: COL.gearDeep, hole: COL.white }));
          }
          FX.sweat(L, pose, 0.45, 0.5);
        },
      };
    },
  });

  // Integration problems share one layout: the brand pill with a red ✕ badge (always visible).
  //   pop:    the badge bounces, UwU startles with a hop       (n8n)
  //   snap:   the pill drops and swings on a snapped hinge    (Zapier)
  //   glitch: the pill stutters sideways with scan bars      (Albato)
  const glitchAt = (p) => [0.12, 0.17, 0.52, 0.56, 0.6].some((a) => p >= a && p < a + 0.025);
  function integration(id, title, name, color, style) {
    def(id, title, "problem", 2, {
      motion(L) {
        if (style === "pop") return add(life(L, 1, 0.6), jump(L, 0.1, 0.32, 16), { curl: { rot: -0.08 }, tuft_L: { rot: 0.12 } });
        if (style === "snap") return add(life(L, 1, 0.5), { head: { rot: -deg(4), dy: 4 + 5 * L.env(0.12, 0.25) }, curl: { rot: -0.2 - 0.08 * L.env(0.12, 0.25) }, tuft_L: { rot: 0.3 }, arm_R: { rot: -deg(10) }, arm_L: { rot: deg(10) } });
        const g = glitchAt(L.p);
        return add(life(L, 1, 0.6), { root: { dx: g ? 14 * (hash(Math.floor(L.p * 120)) - 0.5) : 0 }, head: { rot: deg(3) * L.s(1) }, curl: { rot: -0.1 }, tuft_L: { rot: 0.15 } });
      },
      look(L, pose, I) {
        if (style === "pop") {
          const bsc = 1 + 0.25 * L.env(0.14, 0.3, (x) => E.wob(x, 1.2, 1.4));
          const startled = L.local(0.1, 0.35) >= 0;
          const f = startled ? face("surprised", { eye: { iris: 0.85 } }) : face("neutral", { eye: { gaze: [2, -6] }, brow: { tilt: 12 }, mouth: { shape: "wavy", width: 0.6 } });
          return {
            face: blink(blink(f, L, 0.45), L, 0.8),
            icon: icon(() => pill(name, color, { badge: bsc }), { sc: 1.1, rot: deg(5) * L.env(0.14, 0.4, (x) => E.wob(x, 2, 1.4)) }),
            front() { FX.burst(L, I[0] + 1.1 * (pillWidth(name) / 2 - 6), I[1] - 29, 0.15, 0.3, 30, 64, COL.red, 7, 4.5); },
          };
        }
        if (style === "snap") {
          const x = L.local(0.1, 0.82);
          const swing = x < 0 ? 0 : x < 0.1 ? deg(16) * E.inCubic(x / 0.1) : x > 0.85 ? deg(16) * (1 - E.sine((x - 0.85) / 0.15)) : deg(16) + deg(9) * E.wob((x - 0.1) / 0.75, 2, 1.5);
          return {
            face: blink(face("sad", { eye: { gaze: [2, -6] } }), L, 0.05),
            icon: icon(() => pill(name, color), { sc: 1.1, rot: swing, dy: 10 * Math.sin(swing) }),
            front() { FX.burst(L, I[0] - 55, I[1] - 10, 0.1, 0.28, 18, 50, COL.gold, 6, 4.5); FX.sweat(L, pose, 0.3, 0.6); },
          };
        }
        const g = glitchAt(L.p), k = Math.floor(L.p * 120);
        return {
          face: face("shy", { mouth: { shape: "wavy", width: 0.6 }, eye: { gaze: [3, -5] } }),
          icon: icon(() => pill(name, color), { sc: 1.1, dx: g ? 28 * (hash(k + 1) - 0.5) : 0, rot: g ? deg(3) * (hash(k + 2) - 0.5) : 0 }),
          back() { FX.scan(I[0], I[1], g, k); },
          front() { FX.sweat(L, pose, 0.3, 0.6); },
        };
      },
    });
  }
  integration("n8n_problem", "مشكلة ربط n8n", "n8n", "#e66a8a", "pop");
  integration("zapier_problem", "مشكلة ربط Zapier", "Zapier", COL.orange, "snap");
  integration("albato_problem", "مشكلة ربط Albato", "Albato", "#7d73d9", "glitch");

  // ---- AI assistant (hovers clear of the ground) ----
  const float = (L, k = 1, h = 10) => ({ root: { dy: -30 - h * L.s(k) }, shadow: { sx: 0.78 - 0.08 * L.s(k), sy: 0.78 - 0.08 * L.s(k) } });

  // T 2.5: hovering and blinking; the sparkle chip sways and its small star pulses
  def("ai_idle", "المساعد — جاهز", "ai", 2.5, {
    motion: (L) => add(life(L), float(L), { head: { rot: deg(3) * L.s(1, 0.1) }, curl: { rot: 0.05 * L.s(1, 0.25) } }),
    look(L, pose, I) {
      return {
        face: blink(face("neutral", { mouth: { shape: "smile", width: 0.9 } }), L, 0.62),
        icon: icon(() => chip("sparkle", COL.violet, { rot: deg(8) * L.s(1), k: 1 + 0.06 * L.s(2), k2: 0.85 + 0.25 * L.env(0.4, 0.3) })),
        front() { FX.twinkle(L, [[-190, -180], [205, -90], [-170, 40]], COL.violet, 18); },
      };
    },
  });

  // T 1.5: tuft perks like an ear and the head tilts in on each incoming wave (waves travel inward)
  def("ai_listening", "المساعد — يستمع", "ai", 1.5, {
    motion: (L) => {
      const hear = L.env(0, 0.22) + L.env(0.5, 0.22), lean = L.env(0.03, 0.25) + L.env(0.53, 0.25);
      return add(life(L), float(L), {
        head: { rot: -deg(7) - deg(3) * lean }, tuft_L: { rot: -0.38 - 0.18 * hear }, face: { dx: -4 },
        body: sq(1 + 0.008 * L.s(2)),
      });
    },
    look(L, pose, I) {
      return {
        face: blink(face("neutral", { eye: { open: 1.12, gaze: [5, -2], shine: 1 }, brow: { dy: -6 }, mouth: { shape: "o", open: 0.35, width: 0.7 } }), L, 0.8),
        icon: icon(() => chip("mic", COL.sky), { sc: 1 + 0.05 * L.env(0, 0.25) + 0.05 * L.env(0.5, 0.25) }),
        back() { FX.sound(L, I[0], I[1], 2, COL.sky, 52, true); },
      };
    },
  });

  // T 1.5: eyes up, head tilt; thought bubbles climb to the "…" chip
  def("ai_thinking", "المساعد — يفكر", "ai", 1.5, {
    motion: (L) => add(life(L), float(L), { head: { rot: deg(6) + deg(2) * L.s(1) }, curl: { rot: 0.08 * L.s(2) }, arm_L: { rot: -deg(24) }, face: { dx: 3 } }),
    look(L, pose, I) {
      return {
        face: face("neutral", { eye: { gaze: [4, -8], open: 0.92 }, brow: { dy: -4, tilt: -6 }, mouth: { shape: "wavy", width: 0.5 } }),
        icon: icon(() => chip("dots", COL.violet, { ph: L.fr(2) })),
        back() {
          const [hx, hy] = headPt(70, -470, pose);
          [0.3, 0.62].forEach((k, i) => {
            const x = lerp(hx, I[0] - 10, k), y = lerp(hy, I[1] + 40, k), u = L.fr(2, -i * 0.2);
            const b = 1 + 0.2 * (u < 0.5 ? E.hump(u / 0.5) : 0);
            reseed(i);
            PROPS.at(x, y, 0, b, () => { dot(0, 0, 7 + 4 * i, COL.white); outlineRing(circle(0, 0, 7 + 4 * i, 18), 2.4); });
          });
        },
      };
    },
  });

  // T 1.5: talking mouth (4 Hz with an accent); the bubble chip types its lines
  def("ai_speaking", "المساعد — يجيب", "ai", 1.5, {
    motion: (L) => add(life(L), float(L), { head: { rot: deg(3) * L.s(1) + deg(1.5) * L.s(6) }, arm_R: { rot: deg(18) + deg(8) * L.s(2) } }),
    look(L, pose, I) {
      const talk = (0.5 + 0.5 * L.s(6)) * (0.65 + 0.35 * L.s(2));
      const typed = L.env(0.05, 0.92, (x) => E.hold(x, 0.6, 0.12, (u) => u));
      return {
        face: face("happy", { eye: { shape: "open", shine: 1 }, mouth: { shape: talk > 0.3 ? "openSmile" : "smile", open: 0.12 + 0.5 * talk }, blush: 1.2 }),
        icon: icon(() => chip("bubble", COL.mint, { lines: typed }), { sc: 1 + 0.04 * L.s(6) }),
        front() {
          const [x, y] = headPt(150, -230, pose);
          FX.burst(L, x - 10, y, 0, 0.5, 20, 58, COL.mint, 3, 6, -0.5);
          FX.burst(L, x - 10, y, 0.5, 0.5, 20, 58, COL.mint, 3, 6, -0.5);
        },
      };
    },
  });

  // T 1.5: error: glitch stutter, droop, sweat; ✕ chip
  const aiGlitch = (p) => [0.1, 0.16, 0.55].some((a) => p >= a && p < a + 0.035);
  def("ai_error", "المساعد — خطأ", "ai", 1.5, {
    motion: (L) => add(life(L, 1, 0.6), float(L, 1, 4), { root: { dx: aiGlitch(L.p) ? 7 * (L.p > 0.5 ? -1 : 1) : 0 }, curl: { rot: -0.2 }, tuft_L: { rot: 0.25 }, head: { dy: 3 } }),
    look(L, pose, I) {
      const g = aiGlitch(L.p), k = Math.floor(L.p * 90);
      return {
        face: blink(face("sad"), L, 0.8),
        icon: icon(() => chip("cross", COL.red), { dx: g ? 20 * (hash(k) - 0.5) : 0, rot: deg(10) * L.env(0.08, 0.3, (x) => E.wob(x, 2, 1.4)) }),
        back() { FX.scan(I[0], I[1], g, k); },
        front() { FX.sweat(L, pose, 0.25, 0.6); },
      };
    },
  });

  // Evaluate one loop at time t → everything the runner draws
  function evaluate(id, t) {
    const lp = LOOPS[id], L = clock(t, lp.T), pose = lp.motion(L);
    const I = headPt(ICON[0], ICON[1], lp.motion(L.lag(LAG)));
    return { lp, L, pose, I, ...lp.look(L, pose, I) };
  }

  return {
    LOOPS, S, G, ICON, E, clock, add, life, jump, face, blink, headPt, evaluate,
    chip, pill, GLYPH, FX, COL, strokePoly, ring, arc, thick, atXY,
    setFxSeed(s) { fxSeed = s; },
  };
})();

// Draws one loop frame on a WEBGL canvas. bg: CSS colour, or null for a cleared canvas.
const LOOP_RUNNER = {
  frame(id, t, { bg = "#f9f1e6", quality = "fast", zoom = 1 } = {}) {
    const st = UWU_LOOPS.evaluate(id, t);
    if (bg === null) clear(); else background(bg);
    UWU.kit.ready();
    UWU.kit.setQuality(quality);
    PROPS.setSize(1);
    // boil: 6 steps a second over 3 seeds, counted from the loop phase so it repeats with it
    const boil = Math.floor(st.L.p * st.lp.T * 6 + 1e-6) % 3;
    push();
    try {
      scale(zoom);
      UWU.kit.setSeed(31 + boil);
      UWU_LOOPS.setFxSeed(310 + boil * 1000);
      if (st.back) st.back();
      UWU.draw(0, UWU_LOOPS.G, UWU_LOOPS.S, { pose: st.pose, face: st.face, seed: 19 + boil, quality });
      UWU.kit.setSeed(41 + boil);
      if (st.icon) {
        const [dx, dy, sc, rot, draw, sx] = st.icon;
        UWU_LOOPS.atXY(st.I[0] + dx, st.I[1] + dy, rot, sc * Math.max(0.05, Math.abs(sx)), sc, draw);
      }
      UWU.kit.setSeed(51 + boil);
      UWU_LOOPS.setFxSeed(510 + boil * 1000);
      if (st.front) st.front();
    } finally {
      pop();
    }
  },
};
