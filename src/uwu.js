// UwU mascot — front view, neutral pose.
// Needs p5.js 2.x (global mode, WEBGL canvas) and p5.brush 2.2.x.
// Rig layout, pivots and draw order: docs/UWU_RIG_SPEC.md (keep the two in sync).
//
// Rig units: 1u = 1px of the front view in docs/reference/uwu_turnaround.webp.
// Origin = ground point between the feet, +x = screen right, +y = down.
// Sides are the character's own: *_R is screen-left in the front view, *_L is screen-right.
// The neutral geometry follows the reference, including its small left/right asymmetries.

const UWU = (() => {
  const PALETTE = {
    ink: "#52263b",
    inkSoft: "#7a4a5c",
    cream: "#f9e7d4",
    creamLight: "#fdf4e9",
    peach: "#fbd2bf",
    pink: "#f2abb3",
    pinkDeep: "#e58fab",
    rose: "#e99fbf",
    lavender: "#c47fae",
    purple: "#a46a9a",
    purpleDeep: "#87568a",
    blush: "#f7a1a2",
    blushDeep: "#f58f95",
    sclera: "#f9eddf",
    lidShade: "#b99aa4",
    iris: "#4d1634",
    irisDark: "#350e25",
    irisLight: "#b2446f",
    pupil: "#40112b",
    shine: "#fffaf2",
    eyeLine: "#4a1229",
    eyeLineSoft: "#c98d8a",
    fold: "#d9ab9f",
    star: "#e69e58",
    starDeep: "#cf883a",
    shadow: "#ac8a9d",
    shadowDeep: "#8f6b83",
  };

  // Pivot of every part in rig units (neutral front view). Rotations and scales of a
  // part happen around its pivot; children inherit their parent's transform.
  const PIVOTS = {
    root: [0, 0],
    shadow: [0, 0],
    body: [0, -15],
    foot_R: [-52, -10],
    foot_L: [47, -10],
    tail: [62, -55],
    arm_R: [-64, -98],
    arm_L: [64, -98],
    ruff: [0, -146],
    head: [0, -150],
    tuft_L: [96, -306],
    crown: [26, -378],
    curl: [-5, -378],
    face: [0, -225],
    blush_R: [-105, -195],
    blush_L: [105, -194],
    star: [101, -189.5],
    eye_R: [-74, -234],
    eye_L: [74, -234],
    brow_R: [-66, -294],
    brow_L: [66, -294],
    mouth: [1.5, -194],
  };

  const PARENT = {
    shadow: "root",
    body: "root",
    foot_R: "root",
    foot_L: "root",
    tail: "body",
    arm_R: "body",
    arm_L: "body",
    ruff: "body",
    head: "body",
    tuft_L: "head",
    crown: "head",
    curl: "head",
    face: "head",
    blush_R: "face",
    blush_L: "face",
    star: "face",
    eye_R: "face",
    eye_L: "face",
    brow_R: "face",
    brow_L: "face",
    mouth: "face",
  };

  // Back to front for the front view.
  const DRAW_ORDER = [
    "shadow",
    "tail",
    "body",
    "foot_R",
    "foot_L",
    "arm_R",
    "arm_L",
    "ruff",
    "tuft_L",
    "crown",
    "curl",
    "head",
    "blush_R",
    "blush_L",
    "star",
    "eye_R",
    "eye_L",
    "brow_R",
    "brow_L",
    "mouth",
  ];

  // Neutral pose: every part at rest. A part transform is {rot, sx, sy, dx, dy}
  // (radians, scale factors, rig-unit offsets); missing fields mean identity.
  const NEUTRAL = {};

  // ---------------------------------------------------------------------------
  // Geometry (rig units)
  // ---------------------------------------------------------------------------

  const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

  // Head silhouette, clockwise from where the curl stem leaves the head.
  const HEAD_TOP_R = [[-41, -396], [-42, -384], [-44, -372], [-48, -361], [-57, -347], [-73, -330]];
  const HEAD_SIDE_R = [
    [-87, -314], [-102, -298], [-118, -280], [-136, -260], [-149, -240], [-158, -223],
    [-162, -209], [-155, -196], [-143, -182], [-127, -169], [-104, -157], [-72, -151],
    [-35, -149],
  ];
  // The character's left flank is a little narrower than the right one (bottom to top).
  const HEAD_SIDE_L = [
    [35, -149], [72, -151], [104, -157], [127, -166], [145, -178], [153, -192],
    [156, -205], [153, -220], [143, -240], [131, -260], [117, -280], [103, -298],
    [88, -314],
  ];
  const HEAD_TOP_L = [[72, -330], [61, -340], [49, -350], [40, -355], [30, -364], [24, -371], [21, -378]];
  const HEAD = [...HEAD_TOP_R, ...HEAD_SIDE_R, [0, -148], ...HEAD_SIDE_L, ...HEAD_TOP_L, [8, -392], [-18, -400]];

  // Big curl (crest): stem rising from the head, sweeping to screen-left into a knob.
  const CURL = [
    [-44, -365], [-42, -382], [-41, -397], [-44, -409], [-49, -419], [-59, -426],
    [-62, -416], [-66, -405], [-73, -392], [-88, -384], [-105, -386], [-119, -399],
    [-126, -419], [-125, -439], [-112, -456], [-93, -475], [-68, -488], [-38, -495],
    [-8, -489], [13, -474], [25, -457], [26, -437], [25, -429], [24, -417], [22, -395],
    [21, -372], [17, -352],
  ];
  // Right stem edge, over the top, round the knob and down the inner stem edge.
  const CURL_OUTLINE = CURL.slice(2, 25).reverse();
  const CURL_KNOB = [-81, -414];

  // Small flame-shaped crown tuft, tucked behind the right edge of the curl stem.
  const CROWN = [
    [20, -378], [21, -395], [23, -412], [25, -428], [31, -442], [39, -453], [46, -446],
    [51, -436], [53, -424], [51, -411], [47, -402], [41, -393], [33, -386], [25, -380],
  ];
  const CROWN_OUTLINE = [
    [21, -376], [27, -381], [34, -386], [41, -392], [47, -401], [51, -411], [53, -424],
    [51, -436], [46, -446], [39, -453], [33, -445], [26, -432], [23, -412], [21, -395],
  ];

  // Side tuft on the character's left (screen right), curling down at its tip.
  const TUFT = [
    [79, -305], [83, -317], [79, -339], [87, -360], [102, -375], [122, -382], [144, -379],
    [162, -369], [169, -360], [164, -354], [175, -345], [182, -330], [183, -315],
    [177, -302], [164, -295], [152, -297], [148, -303], [136, -310], [121, -308],
    [111, -304], [109, -293], [106, -285], [92, -285],
  ];
  const TUFT_OUTLINE = TUFT.slice(1, 21);

  // Torso and legs. The legs run down to y = -6 so they stay tucked into the feet
  // when the body leans; the character's left leg sits a little closer to the centre.
  const BODY_R = [
    [-33, -151], [-55, -139], [-67, -122], [-75, -97], [-82, -72], [-82, -52], [-78, -35],
    [-69, -22], [-64, -6], [-31, -6], [-28, -19], [-20, -25.5], [-9, -27.5],
  ];
  const BODY_L = [
    [9, -27.5], [18, -25.5], [25, -19], [27, -6], [60, -6], [65, -22], [74, -35],
    [79, -52], [81, -72], [75, -97], [67, -122], [55, -139], [33, -151],
  ];
  const BODY = [...BODY_R, [0, -28], ...BODY_L];

  const FOOT_R = [[-75, -4], [-73, -14], [-63, -19], [-48, -19], [-35, -15], [-30, -7], [-33, 0], [-53, 2], [-71, 1]];
  const FOOT_L_SHIFT = -5;
  const ARM_R = [
    [-60, -128], [-70, -123], [-80, -117], [-91, -110], [-103, -107], [-116, -103],
    [-123, -96], [-127, -85], [-124, -74], [-117, -66], [-103, -60], [-89, -59],
    [-78, -63], [-60, -67],
  ];
  const TAIL = [[66, -66], [80, -66], [94, -62], [101, -55], [99, -50], [90, -45], [80, -40], [72, -37], [64, -42]];

  // Collar fluff: [base, tip, width, colour]; the back petal is drawn first.
  const RUFF_R = [
    [[-36, -149], [-90, -126], 25, "lavender"],
    [[-34, -147], [-49, -97], 26, "pinkDeep"],
  ];
  const RUFF = RUFF_R.flatMap(([b, t, w, c]) => [[b, t, w, c], [[-b[0], b[1]], [-t[0], t[1]], w, c]]);

  // Eye outline for the character's right eye in (u, v): u outward from the eye pivot,
  // v down. It is the white of the eye joined with the iris, as in the reference.
  const SOCKET = [
    [34, 12], [35.5, 3], [33, -7], [28, -16], [21, -23], [12, -26], [3, -27], [-6, -26],
    [-14, -23], [-23.5, -18], [-31, -10], [-34.5, -1], [-35.5, 8], [-34.5, 18], [-31, 25],
    [-24, 29.5], [-14, 31.5], [-6, 31.5], [2, 29.5], [10, 28], [18, 26], [25, 22.5], [30, 18],
  ];
  const LID_PRESSURE = [1.0, 1.15, 1.35, 1.5, 1.6, 1.6, 1.6, 1.55, 1.4, 1.2, 1.0, 0.9];
  // Brow centre line in (u, v) from the inner end out, with pressure.
  const BROW = [[-14, 3, 1.0], [-10, 0, 1.2], [-6, -1, 1.3], [-2, -0.6, 1.3], [2, 1, 1.2], [6, 3.3, 1.0], [10, 6.5, 0.75], [14, 10, 0.45]];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  // Private random stream, so drawing UwU never reseeds the host sketch's random().
  function mulberry32(a) {
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = mulberry32(1);
  const rand = (a, b) => a + (b - a) * rng();

  // Catmull-Rom through the control points; keeps a third (pressure) value if present.
  function smooth(pts, closed = true, steps = 6) {
    const n = pts.length;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    const out = [];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const q = [0, 1].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3));
        if (p1.length > 2) q.push(p1[2] + ((p2[2] ?? p1[2]) - p1[2]) * t);
        out.push(q);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }

  function ellipse(cx, cy, rx, ry, n = 40, a0 = 0, a1 = Math.PI * 2) {
    const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-6;
    const count = full ? n : n + 1;
    const pts = [];
    for (let i = 0; i < count; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return pts;
  }

  // A strip along an open edge path, pulled toward `center` by up to `depth`
  // (zero at both ends). Used for rim shading inside a shape.
  function band(edge, center, depth, steps = 4) {
    const outer = smooth(edge, false, steps);
    const inner = outer.map(([x, y], i) => {
      const t = i / (outer.length - 1);
      const d = depth * Math.pow(Math.sin(Math.PI * t), 0.7);
      const dx = center[0] - x, dy = center[1] - y, L = Math.hypot(dx, dy) || 1;
      return [x + (dx / L) * d, y + (dy / L) * d];
    });
    return outer.concat(inner.reverse());
  }

  // Pencil strokes running parallel to an edge, at the given insets toward `center`.
  function along(edge, center, insets) {
    const base = smooth(edge, false, 4);
    return insets.map((d) => {
      const a = Math.floor(base.length * rand(0.02, 0.18));
      const b = Math.ceil(base.length * rand(0.8, 0.98));
      return base.slice(a, b).map(([x, y], i, arr) => {
        const t = i / Math.max(1, arr.length - 1);
        const dd = d * (0.85 + 0.15 * Math.sin(Math.PI * t)) + rand(-0.6, 0.6);
        const dx = center[0] - x, dy = center[1] - y, L = Math.hypot(dx, dy) || 1;
        return [x + (dx / L) * dd, y + (dy / L) * dd];
      });
    });
  }

  // Petal from base to tip with a rounded, spoon-like end.
  function leaf(base, tip, w, bend = 0.05) {
    const [bx, by] = base, [tx, ty] = tip;
    const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    const at = (t, o) => {
      const off = o + bend * L * Math.sin(Math.PI * t);
      return [bx + dx * t + nx * off, by + dy * t + ny * off];
    };
    return [
      at(0, -w * 0.3), at(0.35, -w * 0.45), at(0.75, -w * 0.5), at(0.95, -w * 0.3), at(1, 0),
      at(0.95, w * 0.3), at(0.75, w * 0.5), at(0.35, w * 0.45), at(0, w * 0.3),
    ];
  }

  // Four-point star; only its vertical axis leans by `tilt`, the side points stay level.
  function star4(cx, cy, rx, ry, waist, tilt) {
    const sn = Math.sin(tilt), cs = Math.cos(tilt);
    const raw = [[0, -ry], [waist, -waist], [rx, 0], [waist, waist], [0, ry], [-waist, waist], [-rx, 0], [-waist, -waist]];
    return raw.map(([x, y]) => [cx + x - y * sn, cy + y * cs]);
  }

  // One blue step away from `hex`, so p5.brush flushes its stroke mask between lines.
  const nudge = (hex) => hex.slice(0, 6) + (parseInt(hex[6], 16) ^ 1).toString(16);

  // ---------------------------------------------------------------------------
  // Brush wrappers
  // ---------------------------------------------------------------------------

  let brushesReady = false;
  function ensureBrushes() {
    if (brushesReady) return;
    // Outlines: soft plum core with a near-flat pressure curve (the ends taper in ink()).
    brush.add("uwu_ink", {
      type: "default", weight: 1, scatter: 0.45, sharpness: 0.6, grain: 0.7, opacity: 215,
      spacing: 0.1, pressure: { curve: [0.1, 0.2], min_max: [0.9, 1.0] }, rotate: "none", noise: 0.5,
    });
    // Face lines: constant pressure, so the per-point pressures set the width.
    brush.add("uwu_face", {
      type: "default", weight: 1, scatter: 0.08, sharpness: 0.9, grain: 0.9, opacity: 225,
      spacing: 0.1, pressure: [1, 1], rotate: "none", noise: 0.1,
    });
    // Crayon texture. Kept faint: p5.brush darkens a stroke once its mask passes 0.7.
    brush.add("uwu_crayon", {
      type: "default", weight: 1, scatter: 2.5, sharpness: 0.25, grain: 0.9, opacity: 7,
      spacing: 0.05, pressure: [1.1, 0.8], rotate: "natural", noise: 0.8,
    });
    brushesReady = true;
  }

  function clearState() {
    brush.noStroke();
    brush.noFill();
    brush.noHatch();
    brush.noWash();
    brush.noMass();
    brush.noField();
  }

  function wash(pts, color, alpha = 255) {
    clearState();
    brush.wash(color, alpha);
    brush.polygon(pts);
    brush.noWash();
  }

  function paint(pts, color, alpha = 170, bleed = 0.06, texture = 0.35, border = 0.25) {
    clearState();
    brush.fill(color, alpha);
    brush.fillBleed(bleed, "in");
    brush.fillTexture(texture, border);
    brush.polygon(pts);
    brush.noFill();
  }

  // Parallel crayon hatching clipped to a shape (angle in radians).
  function crayon(pts, color, gap, angle, weight = 1.4, rnd = 0.35) {
    clearState();
    brush.hatch(gap, angle, { rand: rnd });
    brush.hatchStyle("uwu_crayon", color, weight);
    brush.polygon(pts);
    brush.noHatch();
  }

  // Sketchy line: a main pass plus a thinner, lighter strand slightly offset.
  // uwu_ink lines taper at both ends unless the points carry their own pressure.
  function ink(pts, w = 2.1, { closed = false, steps = 5, second = true, color = PALETTE.ink, tip = "uwu_ink" } = {}) {
    clearState();
    let d = smooth(pts, closed, steps);
    if (closed) d.push(d[0].slice());
    if (tip === "uwu_ink" && !closed && d[0].length === 2) {
      d = d.map(([x, y], i) => [x, y, Math.min(1, 0.45 + 0.28 * Math.min(i, d.length - 1 - i))]);
    }
    brush.set(tip, color, w);
    brush.spline(d, 0);
    if (second && d.length > 6) {
      const ox = rand(-1.8, 1.8), oy = rand(-1.8, 1.8);
      const a = Math.floor(d.length * rand(0.02, 0.12));
      const b = Math.ceil(d.length * rand(0.85, 0.98));
      brush.set(tip, PALETTE.inkSoft, w * 0.5);
      brush.spline(d.slice(a, b).map(([x, y, p]) => (p === undefined ? [x + ox, y + oy] : [x + ox, y + oy, p])), 0);
    }
  }

  // Crayon strokes that follow the form; alternate colour steps keep each line separate.
  function strokes(lines, color, w = 3) {
    clearState();
    lines.forEach((l, k) => {
      if (l.length < 2) return;
      brush.set("uwu_crayon", k % 2 ? nudge(color) : color, w);
      brush.spline(l.length > 12 ? l : smooth(l, false, 4), 0);
    });
  }

  // ---------------------------------------------------------------------------
  // Parts (each drawn in rig units at its neutral position)
  // ---------------------------------------------------------------------------

  const P = PALETTE;

  const PARTS = {
    shadow() {
      paint(ellipse(8, -1, 122, 7, 48), P.shadow, 110, 0.15, 0.6, 0.15);
      paint(ellipse(6, -1, 92, 4.5, 40), P.shadowDeep, 150, 0.1, 0.6, 0.2);
      crayon(ellipse(6, -2, 110, 6, 40), P.shadowDeep, 2.2, 0, 1.4, 0.5);
      paint(ellipse(-52, 1, 30, 4, 32), P.shadowDeep, 170, 0.05, 0.4, 0.3);
      paint(ellipse(47, 1, 30, 4, 32), P.shadowDeep, 170, 0.05, 0.4, 0.3);
    },

    tail() {
      const shape = smooth(TAIL, true);
      wash(shape, P.pinkDeep);
      paint(shape, P.lavender, 110, 0.06, 0.4, 0.3);
      paint(band([[72, -37], [80, -40], [90, -45], [99, -50], [101, -55]], [84, -54], 8), P.purple, 200);
      strokes(along([[80, -64], [94, -60], [100, -54]], [84, -50], [4]), P.lavender, 2.6);
      ink(TAIL.slice(2, 8), 2);
    },

    body() {
      const shape = smooth(BODY, true);
      const sideR = BODY_R.slice(2, 9), sideL = BODY_L.slice(4, 11);
      wash(shape, P.cream);
      crayon(shape, P.peach, 6, Math.PI * 0.3, 1.2, 0.5);
      paint(band(sideR, [0, -75], 20), P.pink, 220, 0.15, 0.3, 0.02);
      paint(band(sideL, [0, -75], 18), P.pink, 210, 0.15, 0.3, 0.02);
      paint(band(BODY_R.slice(4, 8), [0, -75], 8), P.lavender, 110);
      paint(band(BODY_L.slice(5, 9), [0, -75], 8), P.lavender, 110);
      // warmer lower belly under the round tummy, and a thin shade under the head
      paint(smooth([[-66, -58], [-44, -42], [-20, -35], [0, -34], [20, -35], [44, -42], [64, -58], [70, -30], [58, -16], [28, -20], [0, -25], [-30, -20], [-60, -16], [-72, -30]], true), P.rose, 90, 0.15, 0.4, 0.1);
      paint(ellipse(0, -148, 44, 6, 30), P.shadow, 60, 0.15, 0.3, 0.1);
      strokes([
        ...along(sideR, [0, -75], [5, 12]),
        ...along(sideL, [0, -75], [5, 11]),
        [[-74, -100], [-66, -88], [-60, -80]], [[-80, -78], [-72, -64], [-66, -56]],
        [[71, -100], [63, -88], [57, -80]], [[77, -78], [69, -64], [63, -56]],
      ], P.pinkDeep, 2.4);
      ink(sideR, 2.1);
      ink(sideL, 2.1);
      ink([[-31, -6], [-28, -19], [-20, -25.5], [-9, -27.5], [0, -28], [9, -27.5], [18, -25.5], [25, -19], [27, -6]], 2);
      // fur flicks on the hips
      ink([[-81, -56], [-86, -52], [-83, -48]], 1.2, { second: false });
      ink([[-79, -36], [-83, -31]], 1.1, { second: false });
      ink([[78, -56], [83, -52], [80, -48]], 1.2, { second: false });
      ink([[75, -36], [79, -31]], 1.1, { second: false });
    },

    foot_R() { foot(-1); },
    foot_L() { foot(1); },
    arm_R() { arm(-1); },
    arm_L() { arm(1); },

    ruff() {
      for (const [base, tip, w, c] of RUFF) {
        const pts = leaf(base, tip, w, 0.05 * Math.sign(tip[0]));
        wash(smooth(pts, true, 5), P[c]);
        paint(band(pts.slice(0, 5), base, w * 0.4), c === "lavender" ? P.purple : P.lavender, 160);
        const hl = [0.3, 0.6].map((t) => [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t]);
        strokes([hl], P.peach, 2.4);
        ink(pts, 1.9);
      }
    },

    tuft_L() {
      wash(smooth(TUFT, true), P.cream);
      const OUT = [
        [87, -360], [102, -375], [122, -382], [144, -379], [162, -369], [169, -360], [164, -354],
        [175, -345], [182, -330], [183, -315], [177, -302], [164, -295], [152, -297], [148, -303],
        [136, -310], [121, -308],
      ];
      const feather = smooth([...OUT, [112, -322], [104, -338], [94, -350]], true);
      wash(feather, P.pink, 170);
      paint(feather, P.pinkDeep, 140, 0.15, 0.3, 0.05);
      paint(band(OUT.slice(0, 6), [130, -340], 12), P.pinkDeep, 220);
      wash(band(OUT.slice(6), [150, -326], 20), P.lavender, 190);
      paint(band(OUT.slice(6), [150, -326], 14), P.purple, 170);
      strokes([
        [[100, -335], [118, -352], [145, -358], [165, -350]],
        [[108, -325], [128, -338], [155, -340], [174, -330]],
      ], P.creamLight, 2.4);
      ink(TUFT_OUTLINE, 2.2);
      ink([[169, -357], [162, -356], [157, -354]], 1.6, { second: false });
    },

    crown() {
      wash(smooth(CROWN, true), P.peach);
      paint(smooth(CROWN, true), P.pink, 170, 0.12, 0.3, 0.05);
      paint(band([[41, -393], [47, -402], [51, -411], [53, -424], [51, -436], [46, -446], [39, -453]], [34, -420], 15), P.pink, 255, 0.1, 0.3, 0.1);
      paint(band([[47, -402], [51, -411], [53, -424], [51, -436], [46, -446]], [36, -420], 7), P.pinkDeep, 200);
      strokes([[[42, -444], [46, -425], [40, -402]]], P.pinkDeep, 1.4);
      ink(CROWN_OUTLINE, 2);
    },

    curl() {
      wash(smooth(CURL, true), P.peach);
      // saturated pink along the outer arc
      const ARC = [[-15, -490], [-38, -495], [-68, -488], [-93, -475], [-112, -456], [-125, -439], [-126, -425]];
      paint(band(ARC, [-70, -435], 52), P.rose, 250, 0.12, 0.3, 0.1);
      paint(band(ARC, [-70, -435], 28), P.pinkDeep, 235, 0.08, 0.35, 0.15);
      // lavender / purple only where the arm wraps round and under the knob
      const WRAP = [[-126, -425], [-119, -399], [-105, -386], [-88, -384], [-73, -392], [-66, -405]];
      paint(band(WRAP, CURL_KNOB, 22), P.lavender, 245, 0.1, 0.3, 0.1);
      paint(band(WRAP, CURL_KNOB, 15), P.purple, 210, 0.06, 0.35, 0.15);
      paint(band([[-98, -432], [-82, -438], [-66, -434], [-52, -424], [-42, -410]], [-55, -470], 14), P.lavender, 190);
      paint(band([[-59, -426], [-49, -419], [-44, -409], [-41, -397], [-42, -382]], [-10, -400], 12), P.lavender, 190);
      paint(band([[16, -455], [20, -430], [16, -405], [10, -385]], [-20, -420], 14), P.creamLight, 160);
      // knob: flat purple disc with hatching in its upper-right quarter
      paint(ellipse(CURL_KNOB[0] - 2, CURL_KNOB[1] + 3, 24, 22, 32), P.lavender, 220, 0.12, 0.3, 0.05);
      wash(ellipse(CURL_KNOB[0], CURL_KNOB[1], 19, 18, 32), P.purple, 215);
      strokes([
        [[-74, -430], [-66, -424], [-63, -414]],
        [[-78, -428], [-70, -421], [-67, -412]],
        [[-82, -426], [-74, -419], [-71, -410]],
      ], P.purpleDeep, 1.6);
      strokes([
        [[18, -445], [8, -470], [-18, -485], [-50, -486], [-80, -474]],
        [[6, -425], [-4, -452], [-28, -467], [-60, -464]],
      ], P.pinkDeep, 1.5);
      strokes([
        [[-2, -470], [-8, -440], [-6, -410], [-2, -385]],
        [[10, -462], [8, -432], [10, -402]],
        [[-22, -482], [-32, -462], [-34, -432]],
      ], P.creamLight, 3.5);
      ink(CURL_OUTLINE, 2.4);
      // the spiral line leaves the hook, runs over the knob top, round its left side and under it
      ink(ellipse(CURL_KNOB[0], CURL_KNOB[1], 19, 18, 30, -0.25, -0.25 - Math.PI * 1.75)
        .map(([x, y], i, a) => [x, y, 1.15 - 0.75 * i / (a.length - 1)]), 2);
      // hatched inner edge of the stem
      ink([[-47, -414], [-41, -402], [-38, -388], [-39, -374]], 1.1, { second: false, color: P.purpleDeep });
      ink([[-43, -410], [-36, -398], [-34, -384]], 0.9, { second: false, color: P.purpleDeep });
    },

    head() {
      const shape = smooth(HEAD, true);
      wash(shape, P.cream);
      crayon(shape, P.peach, 7, Math.PI * 0.3, 1.2, 0.5);
      // stem colour carried down into the head, so the curl grows out of it
      wash(smooth([[-38, -398], [-14, -404], [6, -402], [21, -389], [20, -381], [0, -385], [-20, -389], [-40, -390]], true), P.peach, 255);
      paint(smooth([[-40, -392], [-16, -390], [4, -387], [21, -383], [16, -368], [-4, -362], [-26, -366], [-42, -378]], true), P.peach, 150, 0.2, 0.3, 0.02);
      paint(band(HEAD_TOP_R, [0, -360], 14), P.lavender, 200);
      paint(smooth([[18, -382], [28, -378], [31, -362], [22, -352], [14, -362]], true), P.pink, 120, 0.2, 0.3, 0.02);
      strokes([
        [[-30, -398], [-33, -380], [-40, -360]],
        [[-14, -400], [-16, -382], [-20, -364]],
        [[6, -398], [8, -384], [12, -370]],
      ], P.rose, 1.6);
      // pink / lavender rims on both cheeks; the underside stays cream with a grey shade
      const rimR = HEAD_SIDE_R.slice(1, 11), rimL = HEAD_SIDE_L.slice(2, 12);
      paint(band(rimR, [-30, -230], 40), P.pink, 200);
      paint(band(rimL, [30, -230], 40), P.pink, 200);
      paint(band(HEAD_SIDE_R.slice(3, 11), [-50, -215], 18), P.lavender, 180);
      paint(band(HEAD_SIDE_L.slice(2, 10), [50, -215], 18), P.lavender, 180);
      // deeper mauve where the cheeks turn under
      paint(band(HEAD_SIDE_R.slice(6, 12), [-90, -200], 16), P.lavender, 220, 0.12, 0.35, 0.1);
      paint(band(HEAD_SIDE_L.slice(1, 7), [90, -200], 14), P.pinkDeep, 200, 0.12, 0.35, 0.1);
      paint(band([[-127, -169], [-104, -157], [-72, -151], [-35, -149], [0, -148], [35, -149], [72, -151], [104, -157], [127, -166]], [0, -200], 8), P.shadow, 70);
      paint(ellipse(0, -262, 60, 52, 36), P.creamLight, 70, 0.25, 0.2, 0);
      strokes([...along(rimR, [-30, -230], [6, 18, 30]), ...along(rimL, [30, -230], [6, 18, 28])], P.pinkDeep, 2.8);
      strokes([...along(HEAD_SIDE_R.slice(3, 9), [-60, -220], [4]), ...along(HEAD_SIDE_L.slice(4, 10), [60, -220], [4])], P.lavender, 2.4);
      // outline: broken under the chin, open where the curl, crown and side tuft leave the head
      ink([...HEAD_TOP_R, ...HEAD_SIDE_R.slice(0, -1), [-28, -149]], 2.4);
      ink([[20, -149], ...HEAD_SIDE_L.slice(1, 11), [109, -292]], 2.4);
      ink([[86, -316], ...HEAD_TOP_L], 2.2);
    },

    blush_R() { blush(-1); },
    blush_L() { blush(1); },

    star() {
      const [cx, cy] = PIVOTS.star;
      const shape = smooth(star4(cx, cy, 16, 19.5, 6.8, 0.22), true, 5);
      wash(shape, P.star, 240);
      paint(shape, P.starDeep, 90, 0.02, 0.5, 0.6);
    },

    eye_R() { eye(-1); },
    eye_L() { eye(1); },
    brow_R() { brow(-1); },
    brow_L() { brow(1); },

    mouth() {
      ink([[-19.5, -199.6, 1.15], [-16, -196.4, 1], [-11, -193.2, 1], [-5, -191.1, 1], [1.5, -190.3, 1],
        [8, -191.2, 1], [14, -193.4, 1], [18.5, -196, 1], [22, -199.4, 1.15]], 2.6, { second: false, tip: "uwu_face" });
    },
  };

  // s = -1 for the character's right (screen left), +1 for the left.
  function foot(s) {
    const side = (pts) => (s < 0 ? pts : pts.map(([x, y]) => [-x + FOOT_L_SHIFT, y]));
    const pts = side(FOOT_R);
    wash(smooth(pts, true), P.pink);
    paint(band(side([[-75, -6], [-71, 1], [-53, 2], [-33, 0], [-30, -6]]), side([[-52, -30]])[0], 5), P.pinkDeep, 170);
    // leg fur lapping over the top of the foot
    paint(smooth(side([[-66, -20], [-34, -20], [-34, -16], [-42, -13], [-52, -15], [-61, -13], [-66, -15]]), true), P.cream, 210, 0.12, 0.3, 0.1);
    ink(side([[-66, -18], [-73, -14], [-75, -4], [-71, 1], [-53, 2], [-33, 0], [-30, -7], [-33, -14]]), 2);
    ink(side([[-62, -10], [-64, -5], [-63, -1]]), 1.2, { second: false });
    ink(side([[-48, -11], [-49, -6], [-48, -1]]), 1.2, { second: false });
  }

  function arm(s) {
    const side = (pts) => (s < 0 ? pts : mirror(pts));
    const pts = side(ARM_R);
    wash(smooth(pts, true), P.cream);
    wash(smooth(pts, true), P.pink, 175);
    paint(band(side([[-127, -85], [-124, -74], [-117, -66], [-103, -60], [-89, -59], [-78, -63], [-62, -67]]), [95 * s, -92], 14), P.lavender, 255, 0.1, 0.3, 0.1);
    paint(band(side([[-70, -123], [-62, -112], [-60, -90], [-62, -70]]), [84 * s, -92], 15), P.cream, 230, 0.15, 0.3, 0.02);
    strokes([
      [[-78, -114], [-96, -109], [-116, -101]],
      [[-82, -100], [-102, -97], [-121, -90]],
    ].map(side), P.creamLight, 3);
    paint(band(side([[-124, -74], [-117, -66], [-103, -60], [-89, -59], [-78, -63]]), [98 * s, -84], 8), P.purple, 190, 0.06, 0.35, 0.15);
    strokes([[[-84, -72], [-102, -68], [-119, -74]]].map(side), P.purple, 2.4);
    ink(pts.slice(1, 13), 2);
    // crease where the arm root overlaps the body, and fur at the tip
    ink(side([[-64, -104], [-67, -92], [-71, -80], [-77, -66]]), 1.2, { second: false, color: P.inkSoft });
    ink(side([[-127, -86], [-121, -85]]), 1.2, { second: false });
    ink(side([[-124, -73], [-118, -74]]), 1.2, { second: false });
  }

  function blush(s) {
    const [cx, cy] = PIVOTS[s < 0 ? "blush_R" : "blush_L"];
    paint(ellipse(cx, cy, 29, 24, 36), P.blush, 170, 0.2, 0.3, 0.05);
    paint(ellipse(cx, cy, 21, 17, 32), P.blushDeep, 230, 0.15, 0.3, 0.05);
    strokes([ellipse(cx, cy, 9, 7, 16, 0.3, 5.6), ellipse(cx, cy, 15, 12, 20, 0.4, 5.4)], P.blushDeep, 1.8);
  }

  function eye(s) {
    const [cx, cy] = PIVOTS[s < 0 ? "eye_R" : "eye_L"];
    const at = ([u, v]) => [cx + s * u, cy + v];
    const ix = cx - 11 * s, iy = cy + 4, irx = 24.5, iry = 27.5;
    wash(smooth(SOCKET.map(at), true), P.sclera);
    paint(band(SOCKET.slice(2, 9).map(at), [ix, iy], 6), P.lidShade, 150, 0.05, 0.3, 0.2);
    // iris: dark under the lid, mid plum, raspberry band along the bottom
    wash(ellipse(ix, iy, irx, iry, 36), P.iris);
    wash(band(ellipse(ix, iy, irx, iry, 16, Math.PI * 1.08, Math.PI * 1.92), [ix, iy], 14), P.irisDark, 230);
    wash(band(ellipse(ix, iy, irx - 0.5, iry - 0.5, 16, Math.PI * 0.12, Math.PI * 0.88), [ix, iy], 14), P.irisLight, 235);
    paint(band(ellipse(ix, iy, irx - 1, iry - 1, 16, Math.PI * 0.2, Math.PI * 0.8), [ix, iy], 5), "#c9587f", 110, 0.05, 0.5, 0.3);
    wash(ellipse(ix - 2 * s, iy + 4, 10, 11, 24), P.pupil, 150);
    wash(ellipse(ix - 2 * s, iy - 8.5, 2.8, 2.8, 14), P.shine);
    wash(ellipse(ix + 12 * s, iy + 17, 1.3, 1.3, 10), "#f3b6c8", 150);
    // heavy upper lid, thickest over the outer top
    ink(SOCKET.slice(0, 12).map((q, i) => [...at(q), LID_PRESSURE[i]]), 2.9, { second: false, tip: "uwu_face" });
    // dark line along the inner side and under the iris, faint warm line under the white
    ink(SOCKET.slice(11, 19).map(at), 1.6, { second: false, tip: "uwu_face", color: P.eyeLine });
    ink([...SOCKET.slice(18), SOCKET[0]].map((q, i, a) => [...at(q), 0.6 + 0.4 * i / (a.length - 1)]), 1.3, { second: false, tip: "uwu_face", color: P.eyeLineSoft });
    ink([at([25, 22.5]), at([30, 18]), at([34, 12])], 1.4, { second: false, tip: "uwu_face" });
    // two short lashes on the upper-outer lid, and the faint fold above it
    ink([[...at([22, -25]), 1.25], [...at([23.5, -28]), 0.9], [...at([25, -30.5]), 0.35]], 1.5, { second: false, tip: "uwu_face" });
    ink([[...at([29, -18]), 1.2], [...at([30.5, -20.5]), 0.85], [...at([32, -22.5]), 0.3]], 1.4, { second: false, tip: "uwu_face" });
    ink([at([5, -34]), at([-5, -34]), at([-15, -32]), at([-24, -28.5])], 0.9, { second: false, tip: "uwu_face", color: P.fold });
  }

  function brow(s) {
    const [cx, cy] = PIVOTS[s < 0 ? "brow_R" : "brow_L"];
    ink(BROW.map(([u, v, p]) => [cx + s * u, cy + v, p]), 2.3, { second: false, tip: "uwu_face" });
  }

  // ---------------------------------------------------------------------------
  // Rig
  // ---------------------------------------------------------------------------

  function chain(name) {
    const out = [];
    for (let n = name; n; n = PARENT[n]) out.unshift(n);
    return out;
  }

  function applyTransform(name, pose) {
    const t = pose[name];
    if (!t) return;
    const [px, py] = PIVOTS[name];
    translate(px + (t.dx || 0), py + (t.dy || 0));
    if (t.rot) rotate(t.rot);
    if (t.sx !== undefined || t.sy !== undefined) scale(t.sx ?? 1, t.sy ?? 1);
    translate(-px, -py);
  }

  // Draw UwU with the ground point at (x, y); s = canvas pixels per rig unit.
  // Every part gets its own seed, so a change in one part never re-rolls another's texture.
  function draw(x = 0, y = 0, s = 1, { pose = NEUTRAL, seed = 19 } = {}) {
    ensureBrushes();
    const mode = angleMode();
    angleMode(RADIANS);
    push();
    try {
      translate(x, y);
      scale(s);
      DRAW_ORDER.forEach((name, k) => {
        const partSeed = seed * 1009 + k;
        rng = mulberry32(partSeed);
        brush.seed(partSeed);
        brush.noiseSeed(seed);
        push();
        for (const n of chain(name)) applyTransform(n, pose);
        PARTS[name]();
        pop();
      });
    } finally {
      pop();
      angleMode(mode);
      // hand p5.brush a fresh seed from the host's own stream
      brush.seed(Math.floor(random(1e9)));
    }
  }

  return { PALETTE, PIVOTS, PARENT, DRAW_ORDER, NEUTRAL, draw };
})();
