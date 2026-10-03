// UwU mascot — front view, neutral pose.
// Needs p5.js 2.x (global mode, WEBGL canvas) and p5.brush 2.2.x.
// Rig layout, pivots and draw order: docs/UWU_RIG_SPEC.md (keep the two in sync).
//
// Rig units: 1u = 1px of the front view in docs/reference/uwu_turnaround.webp.
// Origin = ground point between the feet, +x = screen right, +y = down.
// Sides are the character's own: *_R is screen-left in the front view, *_L is screen-right.

const UWU = (() => {
  const PALETTE = {
    ink: "#3e1428",
    cream: "#f9e7d4",
    creamLight: "#fdf4e9",
    peach: "#fbd2bf",
    pink: "#f2abb3",
    pinkDeep: "#e58fab",
    rose: "#e99fbf",
    lavender: "#c47fae",
    purple: "#a46a9a",
    purpleDeep: "#87568a",
    blush: "#f6a1a2",
    sclera: "#fdf5ea",
    iris: "#56193b",
    irisLight: "#8a3a64",
    pupil: "#2f0c1c",
    shine: "#fffaf2",
    star: "#e5a04e",
    starDeep: "#cf883a",
    shadow: "#ac8a9d",
  };

  // Pivot of every part in rig units (neutral front view). Rotations and scales of a
  // part happen around its pivot; children inherit their parent's transform.
  const PIVOTS = {
    root: [0, 0],
    shadow: [0, 0],
    body: [0, -15],
    foot_R: [-52, -10],
    foot_L: [52, -10],
    tail: [62, -55],
    arm_R: [-68, -88],
    arm_L: [68, -88],
    ruff: [0, -146],
    head: [0, -150],
    tuft_L: [96, -306],
    curl: [-5, -378],
    crown: [26, -378],
    face: [0, -225],
    blush_R: [-97, -195],
    blush_L: [97, -195],
    star: [102, -189],
    eye_R: [-74, -234],
    eye_L: [74, -234],
    brow_R: [-66, -294],
    brow_L: [66, -294],
    mouth: [0, -196],
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
    curl: "head",
    crown: "head",
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
    "curl",
    "crown",
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
  const HEAD_TOP_R = [[-33, -391], [-36, -377], [-44, -361], [-57, -346], [-73, -330]];
  const HEAD_SIDE_R = [
    [-89, -314], [-106, -298], [-122, -280], [-137, -260], [-150, -240], [-159, -223],
    [-162, -208], [-158, -193], [-147, -177], [-129, -165], [-104, -156], [-72, -150],
    [-35, -148],
  ];
  const HEAD_SIDE_L = mirror(HEAD_SIDE_R).reverse();
  const HEAD_TOP_L = [[88, -315], [74, -332], [58, -348], [44, -361], [30, -373], [22, -387]];
  const HEAD = [
    ...HEAD_TOP_R, ...HEAD_SIDE_R, [0, -147], ...HEAD_SIDE_L, ...HEAD_TOP_L, [5, -398], [-14, -400],
  ];

  // Big curl (crest): stem rising from the head, sweeping to screen-left into a knob.
  const CURL = [
    [-33, -352], [-35, -377], [-36, -395], [-40, -409], [-48, -419], [-57, -421],
    [-61, -412], [-64, -399], [-73, -388], [-88, -382], [-105, -386], [-119, -399],
    [-126, -419], [-124, -442], [-113, -463], [-93, -481], [-68, -493], [-38, -497],
    [-8, -492], [14, -477], [25, -457], [26, -437], [24, -417], [22, -395], [21, -372],
    [17, -352],
  ];
  const CURL_OUTLINE = CURL.slice(1, 23).reverse();
  const CURL_KNOB = [-81, -410];

  // Small flame-shaped crown tuft beside the curl stem.
  const CROWN = [
    [21, -367], [20, -389], [23, -409], [27, -429], [32, -441], [39, -451], [46, -445],
    [52, -431], [54, -415], [50, -399], [41, -385], [31, -372],
  ];
  const CROWN_OUTLINE = [[31, -372], [41, -385], [50, -399], [54, -415], [52, -431], [46, -445], [39, -451], [32, -441], [26, -428]];

  // Side tuft on the character's left (screen right), curling down at its tip.
  const TUFT = [
    [79, -305], [83, -317], [79, -339], [87, -360], [102, -375], [122, -382], [144, -379],
    [162, -369], [169, -360], [164, -354], [175, -345], [182, -330], [183, -315],
    [177, -302], [164, -295], [152, -297], [147, -307], [135, -314], [120, -316],
    [110, -310], [107, -299], [108, -285], [92, -285],
  ];
  const TUFT_OUTLINE = TUFT.slice(1, 22);

  const BODY_R = [
    [-33, -151], [-55, -139], [-67, -122], [-75, -97], [-82, -72], [-82, -52], [-78, -35],
    [-71, -22], [-65, -12], [-35, -12], [-31, -22], [-18, -27],
  ];
  const BODY = [...BODY_R, [0, -29], ...mirror(BODY_R).reverse()];

  const FOOT_R = [[-75, -4], [-73, -14], [-63, -19], [-48, -19], [-35, -15], [-30, -7], [-33, 0], [-53, 2], [-71, 1]];
  const ARM_R = [
    [-59, -105], [-71, -107], [-88, -110], [-103, -110], [-119, -103], [-126, -90],
    [-125, -77], [-117, -66], [-103, -60], [-86, -60], [-73, -65], [-59, -67],
  ];
  const TAIL = [[67, -69], [79, -70], [93, -69], [104, -64], [110, -55], [106, -45], [94, -39], [79, -39], [67, -43]];

  // Collar fluff: [base, tip, width, colour]; back petals first.
  const RUFF_R = [
    [[-28, -150], [-70, -149], 30, "lavender"],
    [[-46, -142], [-96, -127], 28, "rose"],
    [[-44, -141], [-77, -107], 27, "rose"],
    [[-36, -142], [-48, -97], 25, "rose"],
  ];
  const RUFF = RUFF_R.flatMap(([b, t, w, c]) => [[b, t, w, c], [[-b[0], b[1]], [-t[0], t[1]], w, c]]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
    return insets.map((d, k) => {
      const a = Math.floor(base.length * random(0.02, 0.18));
      const b = Math.ceil(base.length * random(0.8, 0.98));
      return base.slice(a, b).map(([x, y], i, arr) => {
        const t = i / Math.max(1, arr.length - 1);
        const dd = d * (0.6 + 0.4 * Math.sin(Math.PI * t)) + random(-0.6, 0.6);
        const dx = center[0] - x, dy = center[1] - y, L = Math.hypot(dx, dy) || 1;
        return [x + (dx / L) * dd, y + (dy / L) * dd];
      });
    });
  }

  // Leaf / petal from base to tip.
  function leaf(base, tip, w, bend = 0.15) {
    const [bx, by] = base, [tx, ty] = tip;
    const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    const at = (t, o) => [bx + dx * t + nx * (o + bend * L * Math.sin(Math.PI * t)), by + dy * t + ny * (o + bend * L * Math.sin(Math.PI * t))];
    return [at(0, -w * 0.32), at(0.35, -w * 0.5), at(0.75, -w * 0.38), at(1, 0), at(0.75, w * 0.38), at(0.35, w * 0.5), at(0, w * 0.32)];
  }

  function star4(cx, cy, rx, ry, waist, rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const raw = [[0, -ry], [waist, -waist], [rx, 0], [waist, waist], [0, ry], [-waist, waist], [-rx, 0], [-waist, -waist]];
    return raw.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
  }

  // ---------------------------------------------------------------------------
  // Brush wrappers
  // ---------------------------------------------------------------------------

  let brushesReady = false;
  function ensureBrushes() {
    if (brushesReady) return;
    brush.add("uwu_ink", {
      type: "default", weight: 1, scatter: 0.2, sharpness: 0.85, grain: 0.8, opacity: 215,
      spacing: 0.1, pressure: { curve: [0.25, 0.25], min_max: [1.2, 0.8] }, rotate: "none", noise: 0.2,
    });
    brush.add("uwu_crayon", {
      type: "default", weight: 1, scatter: 2.5, sharpness: 0.25, grain: 0.9, opacity: 20,
      spacing: 0.05, pressure: [1.1, 0.8], rotate: "natural", noise: 0.8,
    });
    brushesReady = true;
  }

  function clearState() {
    brush.noStroke();
    brush.noFill();
    brush.noHatch();
    brush.noWash();
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

  function crayon(pts, color, gap, angle, weight = 1.4, rand = 0.35) {
    clearState();
    brush.hatch(gap, angle, { rand });
    brush.hatchStyle("uwu_crayon", color, weight);
    brush.polygon(pts);
    brush.noHatch();
  }

  // Sketchy ink line: one main pass plus a lighter, slightly offset second pass.
  function ink(pts, w = 2.1, { closed = false, steps = 5, second = true, color = PALETTE.ink } = {}) {
    clearState();
    const d = smooth(pts, closed, steps);
    if (closed) d.push(d[0].slice());
    brush.set("uwu_ink", color, w);
    brush.spline(d, 0);
    if (second && d.length > 6) {
      const ox = random(-1.2, 1.2), oy = random(-1.2, 1.2);
      const a = Math.floor(d.length * random(0.02, 0.12));
      const b = Math.ceil(d.length * random(0.85, 0.98));
      brush.set("uwu_ink", color, w * 0.6);
      brush.spline(d.slice(a, b).map(([x, y, p]) => (p === undefined ? [x + ox, y + oy] : [x + ox, y + oy, p])), 0);
    }
  }

  // Short pencil strokes that follow the form.
  function strokes(lines, color, w = 3) {
    clearState();
    brush.set("uwu_crayon", color, w);
    for (const l of lines) if (l.length > 1) brush.spline(l.length > 12 ? l : smooth(l, false, 4), 0);
  }

  // ---------------------------------------------------------------------------
  // Parts (each drawn in rig units at its neutral position)
  // ---------------------------------------------------------------------------

  const P = PALETTE;

  const PARTS = {
    shadow() {
      paint(ellipse(2, -1, 150, 10, 48), P.shadow, 90, 0.12, 0.5, 0.2);
      paint(ellipse(-52, 0, 34, 6, 32), P.shadow, 120, 0.05, 0.4, 0.3);
      paint(ellipse(52, 0, 34, 6, 32), P.shadow, 120, 0.05, 0.4, 0.3);
    },

    tail() {
      wash(smooth(TAIL, true), P.rose);
      paint(band([[79, -39], [94, -39], [106, -45], [110, -55], [104, -64]], [80, -58], 11), P.lavender, 230);
      strokes(along([[79, -69], [93, -69], [104, -64], [110, -55]], [80, -52], [4, 9]), P.lavender, 2.6);
      ink(TAIL.slice(1), 2);
    },

    body() {
      wash(smooth(BODY, true), P.cream);
      const sideR = BODY_R.slice(2, 9), sideL = mirror(sideR);
      paint(band(sideR, [0, -75], 24), P.pink, 170);
      paint(band(sideL, [0, -75], 22), P.pink, 150);
      paint(band(BODY_R.slice(4, 8), [0, -75], 8), P.lavender, 110);
      paint(band(mirror(BODY_R.slice(4, 8)), [0, -75], 8), P.lavender, 110);
      // shade cast by the head on the chest
      paint(ellipse(0, -140, 58, 16, 30), P.pink, 120, 0.1, 0.3, 0.1);
      paint(band([[-65, -14], [-50, -22], [-30, -24], [-18, -27], [0, -29], [18, -27], [30, -24], [50, -22], [65, -14]], [0, -70], 8), P.pink, 90);
      strokes([
        ...along(sideR, [0, -75], [5, 11, 17]),
        ...along(sideL, [0, -75], [5, 12]),
      ], P.pink, 2.6);
      ink(sideR, 2.2);
      ink(sideL, 2.2);
      ink([[-35, -12], [-31, -22], [-18, -27], [0, -29], [18, -27], [31, -22], [35, -12]], 2);
    },

    foot_R() { foot(-1); },
    foot_L() { foot(1); },
    arm_R() { arm(-1); },
    arm_L() { arm(1); },

    ruff() {
      for (const [base, tip, w, c] of RUFF) {
        const pts = leaf(base, tip, w, 0.05 * Math.sign(tip[0]));
        wash(smooth(pts, true, 5), P[c]);
        paint(band(pts.slice(0, 4), base, w * 0.4), c === "lavender" ? P.purple : P.lavender, 160);
        strokes([[base, [(base[0] + tip[0] * 2) / 3, (base[1] + tip[1] * 2) / 3]]], P.pink, 3);
        ink(pts.slice(1), 1.9);
      }
    },

    tuft_L() {
      wash(smooth(TUFT, true), P.pink);
      paint(band([[83, -317], [79, -339], [87, -360], [102, -375], [122, -382], [144, -379], [162, -369]], [120, -330], 28), P.creamLight, 200);
      paint(band([[164, -354], [175, -345], [182, -330], [183, -315], [177, -302], [164, -295], [152, -297], [147, -307]], [150, -330], 20), P.lavender, 220);
      paint(band([[147, -307], [135, -314], [120, -316], [110, -310], [107, -299]], [128, -330], 10), P.lavender, 160);
      strokes([
        [[98, -338], [118, -356], [145, -360], [166, -348]],
        [[106, -325], [128, -341], [155, -342], [174, -329]],
        [[118, -318], [140, -328], [162, -326], [176, -314]],
      ], P.pink, 3);
      ink(TUFT_OUTLINE, 2.2);
      ink([[169, -357], [158, -356], [151, -353]], 1.6, { second: false });
      ink([[118, -317], [132, -323], [148, -322], [160, -315]], 1.3, { second: false });
    },

    curl() {
      wash(smooth(CURL, true), P.peach);
      wash(band([[25, -457], [14, -477], [-8, -492], [-38, -497], [-68, -493], [-93, -481]], [-40, -425], 22), P.rose, 150);
      wash(band([[-93, -481], [-113, -463], [-124, -442], [-126, -419], [-119, -399], [-105, -386], [-88, -382]], CURL_KNOB, 18), P.lavender, 170);
      // pink outer band from the stem over the top
      paint(band([[26, -437], [25, -457], [14, -477], [-8, -492], [-38, -497], [-68, -493], [-93, -481], [-113, -463]], [-40, -425], 34), P.rose, 230);
      // lavender wrap around the knob, continuing down the inner edge of the stem
      paint(band([[-68, -493], [-93, -481], [-113, -463], [-124, -442], [-126, -419], [-119, -399], [-105, -386], [-88, -382], [-73, -388], [-64, -399]], CURL_KNOB, 26), P.lavender, 235);
      paint(band([[-57, -421], [-48, -419], [-40, -409], [-36, -395], [-35, -377], [-34, -360]], [-10, -400], 12), P.lavender, 190);
      wash(ellipse(CURL_KNOB[0], CURL_KNOB[1], 20, 20, 32), P.purple, 200);
      paint(ellipse(CURL_KNOB[0], CURL_KNOB[1], 21, 21, 32), P.purple, 200, 0.03, 0.4, 0.4);
      paint(ellipse(CURL_KNOB[0] - 2, CURL_KNOB[1] + 2, 12, 12, 24), P.purpleDeep, 150, 0.03, 0.4, 0.3);
      strokes([
        [[18, -445], [8, -470], [-18, -485], [-50, -486], [-80, -474], [-100, -455]],
        [[6, -425], [-4, -452], [-28, -467], [-60, -464], [-88, -450]],
        [[-6, -398], [-14, -428], [-36, -445], [-62, -441]],
      ], P.pink, 3);
      strokes([[[-110, -440], [-112, -420], [-104, -400]], [[-30, -370], [-31, -395], [-38, -412]]], P.lavender, 3);
      paint(band([[16, -455], [20, -430], [16, -405], [10, -385]], [-20, -420], 14), P.creamLight, 160);
      ink(CURL_OUTLINE, 2.3);
      ink(ellipse(CURL_KNOB[0], CURL_KNOB[1], 21, 21, 30, -0.35, Math.PI * 1.7), 2);
    },

    crown() {
      wash(smooth(CROWN, true), P.peach);
      paint(band([[50, -399], [54, -415], [52, -431], [46, -445], [39, -451]], [34, -415], 11), P.rose, 220);
      strokes([[[44, -440], [46, -420], [42, -400]]], P.pink, 2.6);
      ink(CROWN_OUTLINE, 2.1);
      ink([[35, -440], [31, -420], [28, -395]], 1.1, { second: false });
    },

    head() {
      wash(smooth(HEAD, true), P.cream);
      // warm stem colour running down from the curl
      paint(ellipse(-6, -372, 34, 26, 30), P.peach, 170, 0.1, 0.3, 0.1);
      strokes([[[-30, -395], [-34, -372], [-42, -356]], [[-18, -396], [-20, -372], [-24, -355]], [[16, -394], [18, -375], [24, -362]]], P.pink, 3);
      // pink / lavender rim on both cheeks and along the underside
      const rimR = [...HEAD_SIDE_R.slice(1), [0, -147]], rimL = [[0, -147], ...HEAD_SIDE_L.slice(0, -1)];
      paint(band(rimR, [-30, -230], 42), P.pink, 200);
      paint(band(rimL, [30, -230], 42), P.pink, 200);
      paint(band(HEAD_SIDE_R.slice(3, 11), [-50, -215], 18), P.lavender, 180);
      paint(band(HEAD_SIDE_L.slice(2, 10), [50, -215], 18), P.lavender, 180);
      paint(band([[-131, -167], [-104, -156], [-72, -150], [-35, -148], [0, -147], [35, -148], [72, -150], [104, -156], [131, -167]], [0, -200], 8), P.pink, 90);
      paint(ellipse(0, -255, 78, 72, 36), P.creamLight, 130, 0.1, 0.2, 0.1);
      strokes([...along(rimR, [-40, -235], [4, 9, 15, 22, 30]), ...along(rimL, [40, -235], [4, 10, 17, 25])], P.pink, 2.8);
      strokes([...along(HEAD_SIDE_R.slice(3, 9), [-60, -220], [4]), ...along(HEAD_SIDE_L.slice(3, 9), [60, -220], [4])], P.lavender, 2.4);
      // outline, open where the curl, crown and side tuft grow out of the head
      ink([[-33, -391], ...HEAD_TOP_R.slice(1), ...HEAD_SIDE_R, [0, -147], ...HEAD_SIDE_L.slice(0, -1), [108, -287]], 2.4);
      ink([[83, -317], [74, -332], [58, -348], [44, -361], [30, -373]], 2.2);
    },

    blush_R() { blush(-1); },
    blush_L() { blush(1); },

    star() {
      const [cx, cy] = PIVOTS.star;
      const shape = smooth(star4(cx, cy, 16, 20, 5, 0.16), true, 5);
      wash(shape, P.star, 240);
      paint(shape, P.starDeep, 110, 0.02, 0.5, 0.7);
    },

    eye_R() { eye(-1); },
    eye_L() { eye(1); },
    brow_R() { brow(-1); },
    brow_L() { brow(1); },

    mouth() {
      ink([[-21, -202, 0.5], [-17, -199, 0.8], [-9, -194, 1], [0, -192.5, 1.1], [9, -194, 1], [17, -199, 0.8], [21, -202, 0.5]], 1.8, { second: false });
    },
  };

  // s = -1 for the character's right (screen left), +1 for the left.
  function foot(s) {
    const pts = s < 0 ? FOOT_R : mirror(FOOT_R);
    wash(smooth(pts, true), P.pink);
    paint(band(s < 0 ? [[-71, 1], [-53, 2], [-33, 0]] : [[71, 1], [53, 2], [33, 0]], [52 * s, -12], 7), P.lavender, 190);
    paint(ellipse(50 * s, -14, 10, 3.5, 20), P.creamLight, 110, 0.05, 0.2, 0.1);
    ink(pts, 2.1, { closed: true });
  }

  function arm(s) {
    const side = (pts) => (s < 0 ? pts : mirror(pts));
    const pts = side(ARM_R);
    wash(smooth(pts, true), P.cream);
    paint(smooth(side(ARM_R.slice(1, 11)), true), P.pink, 230, 0.06, 0.4, 0.3);
    paint(band(side([[-125, -77], [-117, -66], [-103, -60], [-86, -60], [-73, -65]]), [92 * s, -86], 13), P.lavender, 210);
    paint(band(side([[-73, -107], [-62, -100], [-60, -86], [-62, -70]]), [80 * s, -86], 12), P.cream, 200);
    strokes([
      [[-120, -95], [-104, -100], [-84, -99]],
      [[-122, -84], [-104, -86], [-80, -84]],
      [[-118, -73], [-100, -72], [-82, -71]],
    ].map(side), P.pink, 2.6);
    ink(pts.slice(1, 11), 2.1);
  }

  function blush(s) {
    const [cx, cy] = PIVOTS[s < 0 ? "blush_R" : "blush_L"];
    paint(ellipse(cx, cy, 24, 19, 32), P.blush, 200, 0.12, 0.3, 0.15);
    paint(ellipse(cx + 2 * s, cy + 1, 15, 12, 24), P.blush, 160, 0.08, 0.4, 0.2);
  }

  function eye(s) {
    const [cx, cy] = PIVOTS[s < 0 ? "eye_R" : "eye_L"];
    const rx = 35, ry = 29;
    const ix = cx - s * 11, iy = cy + 5;
    const outer = s < 0 ? Math.PI : 0;
    const ang = (a) => (s < 0 ? a : Math.PI - a);
    wash(ellipse(cx, cy, rx, ry, 40), P.sclera);
    wash(ellipse(ix, iy, 26, 27, 36), P.iris);
    paint(ellipse(ix, iy + 6, 18, 16, 28), P.irisLight, 175, 0.05, 0.4, 0.3);
    wash(ellipse(ix, iy - 1, 11.5, 12, 24), P.pupil, 230);
    wash(ellipse(ix + 1, iy - 12, 4, 4, 14), P.shine);
    wash(ellipse(ix + 8 * s, iy + 10, 1.7, 1.7, 10), P.shine, 190);
    // thick upper lid resting on the iris, thin line round the outer-bottom of the eye
    const lid = ellipse(cx, cy, rx, ry, 18, ang(Math.PI * 1.04), ang(Math.PI * 1.97)).map(([x, y], i, a) => [x, y, 0.7 + 0.7 * Math.sin((Math.PI * i) / (a.length - 1))]);
    ink(lid, 3.3);
    ink(ellipse(cx, cy, rx, ry, 10, ang(Math.PI * 0.98), ang(Math.PI * 0.5)), 1.3, { second: false });
    // two lashes at the outer top corner
    const lx = cx + Math.cos(outer) * rx * 0.95, ly = cy - ry * 0.3;
    ink([[lx, ly], [lx + 5 * s, ly - 3], [lx + 8 * s, ly - 5]], 1.5, { second: false });
    ink([[lx - 3 * s, ly - 7], [lx + 1 * s, ly - 10], [lx + 4 * s, ly - 12]], 1.3, { second: false });
  }

  function brow(s) {
    const [cx, cy] = PIVOTS[s < 0 ? "brow_R" : "brow_L"];
    ink([[cx - 14 * s, cy + 3, 0.6], [cx - 6 * s, cy - 2, 1], [cx + 3 * s, cy - 3, 1.1], [cx + 13 * s, cy + 2, 0.6]], 1.8, { second: false });
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
  function draw(x = 0, y = 0, s = 1, { pose = NEUTRAL, seed = 19 } = {}) {
    ensureBrushes();
    randomSeed(seed);
    noiseSeed(seed);
    push();
    translate(x, y);
    scale(s);
    for (const name of DRAW_ORDER) {
      push();
      for (const n of chain(name)) applyTransform(n, pose);
      PARTS[name]();
      pop();
    }
    pop();
  }

  return { PALETTE, PIVOTS, PARENT, DRAW_ORDER, NEUTRAL, draw };
})();
